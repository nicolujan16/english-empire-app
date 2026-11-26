/**
 * Computadoras vinculadas (solo director, con su ID token de Firebase Auth).
 *
 * GET  → lista de computadoras (sin tokens: solo se guarda su huella).
 * POST { nombre } → vincula una computadora nueva y devuelve su token UNA sola vez.
 *   Lo llama la aplicación de escritorio cuando el director toca "Vincular esta computadora".
 */
import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import {
	COL_DISPOSITIVOS,
	auditarServidor,
	autenticarDirector,
	generarToken,
	huellaToken,
} from "@/lib/asistencia/servidor/autenticacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noAutorizado = () =>
	NextResponse.json(
		{ ok: false, mensaje: "Solo el director puede administrar las computadoras." },
		{ status: 403 },
	);

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : null);

export async function GET(req: Request) {
	const director = await autenticarDirector(req);
	if (!director) return noAutorizado();
	const snap = await adminDb.collection(COL_DISPOSITIVOS).get();
	const dispositivos = snap.docs
		.map((d) => {
			const x = d.data();
			return {
				id: d.id,
				nombre: String(x.nombre ?? ""),
				activo: x.activo === true,
				creadoEn: iso(x.creadoEn),
				ultimoContactoEn: iso(x.ultimoContactoEn),
			};
		})
		.sort((a, b) => (b.creadoEn ?? "").localeCompare(a.creadoEn ?? ""));
	return NextResponse.json({ ok: true, dispositivos });
}

export async function POST(req: Request) {
	const director = await autenticarDirector(req);
	if (!director) return noAutorizado();
	let nombre = "";
	try {
		const body = await req.json();
		nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";
	} catch {
		/* nombre vacío */
	}
	if (!nombre || nombre.length > 40)
		return NextResponse.json(
			{ ok: false, mensaje: "Poné un nombre para la computadora (hasta 40 letras)." },
			{ status: 400 },
		);

	const token = generarToken();
	const ref = adminDb.collection(COL_DISPOSITIVOS).doc();
	await ref.set({
		nombre,
		tokenHash: huellaToken(token), // nunca se guarda el token
		activo: true,
		creadoEn: FieldValue.serverTimestamp(),
		creadoPor: director.uid,
		ultimoContactoEn: null,
	});
	await auditarServidor({
		accion: "vincular_computadora",
		docId: ref.id,
		porUid: director.uid,
		porEmail: director.email,
		detalle: { nombre },
	});
	// El token se devuelve esta única vez: la aplicación lo guarda cifrado en la computadora
	return NextResponse.json({ ok: true, id: ref.id, nombre, token });
}
