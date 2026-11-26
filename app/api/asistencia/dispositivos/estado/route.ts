/**
 * POST /api/asistencia/dispositivos/estado { id, activo } — desactivar (o reactivar)
 * una computadora vinculada. Solo director. Una computadora desactivada no puede fichar.
 */
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import {
	COL_DISPOSITIVOS,
	auditarServidor,
	autenticarDirector,
} from "@/lib/asistencia/servidor/autenticacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	const director = await autenticarDirector(req);
	if (!director)
		return NextResponse.json(
			{ ok: false, mensaje: "Solo el director puede administrar las computadoras." },
			{ status: 403 },
		);
	let id = "";
	let activo: boolean | null = null;
	try {
		const body = await req.json();
		id = typeof body?.id === "string" ? body.id : "";
		activo = typeof body?.activo === "boolean" ? body.activo : null;
	} catch {
		/* inválido */
	}
	if (!id || activo === null)
		return NextResponse.json({ ok: false, mensaje: "Pedido inválido." }, { status: 400 });

	const ref = adminDb.collection(COL_DISPOSITIVOS).doc(id);
	const snap = await ref.get();
	if (!snap.exists)
		return NextResponse.json({ ok: false, mensaje: "No existe esa computadora." }, { status: 404 });
	await ref.update({ activo, actualizadoEn: FieldValue.serverTimestamp() });
	await auditarServidor({
		accion: activo ? "reactivar_computadora" : "desactivar_computadora",
		docId: id,
		porUid: director.uid,
		porEmail: director.email,
		detalle: { nombre: String(snap.data()?.nombre ?? "") },
	});
	return NextResponse.json({ ok: true });
}
