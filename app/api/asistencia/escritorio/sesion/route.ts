/**
 * GET /api/asistencia/escritorio/sesion — confirma que quien inició sesión en la
 * aplicación de escritorio es una cuenta del panel (Admins) activa, y devuelve su rol.
 * Auth: `Authorization: Bearer <ID token de Firebase Auth>`.
 */
import { NextResponse } from "next/server";
import { autenticarAdmin } from "@/lib/asistencia/servidor/autenticacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const admin = await autenticarAdmin(req);
	if (!admin)
		return NextResponse.json(
			{ ok: false, mensaje: "Esta cuenta no tiene acceso a la aplicación." },
			{ status: 403 },
		);
	return NextResponse.json({ ok: true, ...admin });
}
