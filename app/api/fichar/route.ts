/**
 * POST /api/fichar — un toque de llavero desde la aplicación de escritorio.
 *
 * Auth: `Authorization: Bearer <token de la computadora>` (ver autenticacion.ts).
 * Body: { idLocal: string, uid: string, numero?: string|null, horaDispositivo: ISO, offline: boolean }
 * Respuesta: RespuestaFichada (lib/asistencia/servidor/fichar.ts). Los resultados de
 * negocio (llavero desconocido, ya registrado…) vuelven con 200; 401 = computadora no
 * vinculada o desactivada; 400 = pedido mal formado; 503 = reintentar.
 */
import { NextResponse } from "next/server";
import { autenticarDispositivo } from "@/lib/asistencia/servidor/autenticacion";
import { ErrorReintentable, procesarFichada } from "@/lib/asistencia/servidor/fichar";
import { normalizarUid } from "@/lib/asistencia/uid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const invalido = (mensaje: string) =>
	NextResponse.json({ ok: false, motivo: "solicitud_invalida", mensaje }, { status: 400 });

export async function POST(req: Request) {
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

	let body: Record<string, unknown>;
	try {
		body = await req.json();
	} catch {
		return invalido("El pedido no es un JSON válido.");
	}

	const { idLocal, uid, numero, horaDispositivo, offline } = body ?? {};
	if (typeof idLocal !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(idLocal))
		return invalido("Falta idLocal o no es válido.");
	if (typeof uid !== "string") return invalido("Falta el UID del llavero.");
	try {
		normalizarUid(uid);
	} catch {
		return invalido("El UID del llavero no es válido.");
	}
	if (numero != null && (typeof numero !== "string" || numero.length > 16))
		return invalido("El número del llavero no es válido.");
	if (typeof offline !== "boolean") return invalido("Falta indicar si fue sin conexión.");
	let hora: Date | null = null;
	if (horaDispositivo != null) {
		hora = typeof horaDispositivo === "string" ? new Date(horaDispositivo) : null;
		if (!hora || Number.isNaN(hora.getTime())) return invalido("La hora de la computadora no es válida.");
	}

	try {
		const respuesta = await procesarFichada(
			{ idLocal, uid, numero: (numero as string | null) ?? null, horaDispositivo: hora, offline },
			dispositivo,
		);
		return NextResponse.json(respuesta);
	} catch (e) {
		if (e instanceof ErrorReintentable)
			return NextResponse.json(
				{ ok: false, motivo: "error", mensaje: "No se pudo registrar. Volvé a apoyar el llavero." },
				{ status: 503 },
			);
		console.error("[api/fichar]", e);
		return NextResponse.json(
			{ ok: false, motivo: "error", mensaje: "No se pudo registrar. Volvé a apoyar el llavero." },
			{ status: 500 },
		);
	}
}
