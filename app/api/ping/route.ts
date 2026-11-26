/**
 * GET /api/ping — la aplicación de escritorio comprueba la conexión y que su token
 * siga vigente. De paso actualiza el "último contacto" de la computadora.
 */
import { NextResponse } from "next/server";
import { autenticarDispositivo } from "@/lib/asistencia/servidor/autenticacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const dispositivo = await autenticarDispositivo(req);
	if (!dispositivo)
		return NextResponse.json(
			{
				ok: false,
				motivo: "dispositivo_invalido",
				mensaje: "Esta computadora no está vinculada o fue desactivada.",
			},
			{ status: 401 },
		);
	return NextResponse.json({
		ok: true,
		horaServidor: new Date().toISOString(),
		dispositivo: dispositivo.nombre,
	});
}
