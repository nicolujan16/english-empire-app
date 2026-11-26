/**
 * Autenticación de las rutas /api del registro de asistencia (solo servidor).
 *
 * - Computadoras (aplicación de escritorio): `Authorization: Bearer <token>`.
 *   El token es aleatorio (32 bytes) y se entrega una sola vez al vincular la PC.
 *   En `Dispositivos` se guarda solo su huella SHA-256, nunca el token.
 * - Director (vincular y administrar computadoras): `Authorization: Bearer <ID token
 *   de Firebase Auth>`, y su doc de Admins con esDirector == true y activo.
 */
import { createHash, randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const COL_DISPOSITIVOS = "Dispositivos";

export interface DispositivoAutenticado {
	id: string;
	nombre: string;
}

export interface DirectorAutenticado {
	uid: string;
	email: string | null;
}

/** Token nuevo para una computadora: "eedisp_" + 43 caracteres aleatorios */
export const generarToken = () => `eedisp_${randomBytes(32).toString("base64url")}`;

export const huellaToken = (token: string) => createHash("sha256").update(token).digest("hex");

const bearer = (req: Request) => {
	const h = req.headers.get("authorization") ?? "";
	const m = /^Bearer\s+(.+)$/i.exec(h.trim());
	return m ? m[1].trim() : null;
};

/** La computadora que hace el pedido, o null si el token no es de una computadora activa */
export async function autenticarDispositivo(
	req: Request,
): Promise<DispositivoAutenticado | null> {
	const token = bearer(req);
	if (!token || !token.startsWith("eedisp_") || token.length > 200) return null;
	const snap = await adminDb
		.collection(COL_DISPOSITIVOS)
		.where("tokenHash", "==", huellaToken(token))
		.limit(1)
		.get();
	const doc = snap.docs[0];
	if (!doc || doc.data().activo !== true) return null;
	// Último contacto (sin esperar: no frena la respuesta)
	doc.ref.update({ ultimoContactoEn: FieldValue.serverTimestamp() }).catch(() => {});
	return { id: doc.id, nombre: String(doc.data().nombre ?? "") };
}

export interface AdminAutenticado {
	uid: string;
	email: string | null;
	nombre: string;
	rol: string; // "admin" | "secretario"
	esDirector: boolean;
}

/** Cualquier cuenta del panel (Admins) activa que hace el pedido, o null */
export async function autenticarAdmin(req: Request): Promise<AdminAutenticado | null> {
	const token = bearer(req);
	if (!token || token.startsWith("eedisp_")) return null;
	try {
		const decod = await adminAuth.verifyIdToken(token);
		const snap = await adminDb.collection("Admins").doc(decod.uid).get();
		const d = snap.data();
		if (!snap.exists || !d || d.activo === false) return null;
		return {
			uid: decod.uid,
			email: decod.email ?? null,
			nombre: String(d.nombre ?? decod.email ?? ""),
			rol: String(d.rol ?? ""),
			esDirector: d.esDirector === true,
		};
	} catch {
		return null;
	}
}

/** El director logueado que hace el pedido, o null */
export async function autenticarDirector(req: Request): Promise<DirectorAutenticado | null> {
	const token = bearer(req);
	if (!token || token.startsWith("eedisp_")) return null;
	try {
		const decod = await adminAuth.verifyIdToken(token);
		const admin = await adminDb.collection("Admins").doc(decod.uid).get();
		const d = admin.data();
		if (!admin.exists || !d || d.esDirector !== true || d.activo === false) return null;
		return { uid: decod.uid, email: decod.email ?? null };
	} catch {
		return null;
	}
}

/** Auditoría desde el servidor (misma colección que la de la web) */
export async function auditarServidor(a: {
	accion: string;
	docId: string;
	coleccion?: string;
	porUid: string;
	porEmail: string | null;
	detalle?: Record<string, string | number | boolean | null>;
}) {
	await adminDb.collection("AuditoriaAsistencia").add({
		accion: a.accion,
		coleccion: a.coleccion ?? COL_DISPOSITIVOS,
		docId: a.docId,
		motivo: null,
		detalle: a.detalle ?? null,
		porUid: a.porUid,
		porEmail: a.porEmail,
		en: FieldValue.serverTimestamp(),
	});
}
