/**
 * GET /api/asistencia/escritorio/datos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 * Lo que muestran las pantallas de la aplicación de escritorio: personal, llaveros,
 * cursos vigentes con sus horarios, y las jornadas, clases y fichadas del rango.
 * Auth: cuenta del panel (Admins) activa. Rango máximo: 62 días.
 */
import { NextResponse } from "next/server";
import { autenticarAdmin } from "@/lib/asistencia/servidor/autenticacion";
import { MAX_DIAS_RANGO, leerDatos } from "@/lib/asistencia/servidor/escritorio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
	const admin = await autenticarAdmin(req);
	if (!admin)
		return NextResponse.json(
			{ ok: false, mensaje: "Tu sesión venció o no tenés acceso." },
			{ status: 403 },
		);
	const url = new URL(req.url);
	const desde = url.searchParams.get("desde") ?? "";
	const hasta = url.searchParams.get("hasta") ?? "";
	const dias = (Date.parse(hasta) - Date.parse(desde)) / 86_400_000;
	if (!FECHA.test(desde) || !FECHA.test(hasta) || !(dias >= 0) || dias > MAX_DIAS_RANGO)
		return NextResponse.json(
			{ ok: false, mensaje: `Pedí un rango de fechas válido (hasta ${MAX_DIAS_RANGO} días).` },
			{ status: 400 },
		);
	try {
		return NextResponse.json({ ok: true, ...(await leerDatos(desde, hasta)) });
	} catch (e) {
		console.error("[api/asistencia/escritorio/datos]", e);
		return NextResponse.json({ ok: false, mensaje: "No se pudieron leer los datos." }, { status: 500 });
	}
}
