/**
 * POST /api/asistencia/escritorio/llaveros — registrar, asignar o quitar un llavero
 * apoyado en la aplicación de escritorio. Solo director.
 * Body: { accion: "registrar" | "asignar" | "quitar", uid, numero?, personalId? }
 */
import { NextResponse } from "next/server";
import { autenticarAdmin } from "@/lib/asistencia/servidor/autenticacion";
import { ErrorLlavero, gestionarLlavero, type AccionLlavero } from "@/lib/asistencia/servidor/escritorio";
import { normalizarUid } from "@/lib/asistencia/uid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCIONES: AccionLlavero[] = ["registrar", "asignar", "quitar"];

export async function POST(req: Request) {
	const admin = await autenticarAdmin(req);
	if (!admin || !admin.esDirector)
		return NextResponse.json(
			{ ok: false, mensaje: "Solo el director puede asignar llaveros." },
			{ status: 403 },
		);
	let body: Record<string, unknown> = {};
	try {
		body = await req.json();
	} catch {
		/* inválido */
	}
	const accion = body.accion as AccionLlavero;
	const uid = typeof body.uid === "string" ? body.uid : "";
	const numero = typeof body.numero === "string" ? body.numero : null;
	const personalId = typeof body.personalId === "string" ? body.personalId : null;
	try {
		normalizarUid(uid);
	} catch {
		return NextResponse.json({ ok: false, mensaje: "El UID del llavero no es válido." }, { status: 400 });
	}
	if (!ACCIONES.includes(accion) || (accion === "asignar" && !personalId))
		return NextResponse.json({ ok: false, mensaje: "Pedido inválido." }, { status: 400 });

	try {
		const llavero = await gestionarLlavero(admin, { accion, uid, numero, personalId });
		return NextResponse.json({ ok: true, llavero });
	} catch (e) {
		if (e instanceof ErrorLlavero)
			return NextResponse.json({ ok: false, mensaje: e.message }, { status: 409 });
		console.error("[api/asistencia/escritorio/llaveros]", e);
		return NextResponse.json({ ok: false, mensaje: "No se pudo guardar el llavero." }, { status: 500 });
	}
}
