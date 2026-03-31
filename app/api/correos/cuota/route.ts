import { NextResponse } from "next/server";
import { enviarCorreoCuota } from "@/lib/services/emailServices";

export async function POST(request: Request) {
	try {
		const body = await request.json();

		// Extraemos todos los datos que nos va a mandar el RegistrarCuotaModal
		const {
			emailDestino,
			nombreAlumno,
			cursoNombre,
			mes,
			anio,
			montoAbonado,
			metodoPago,
			nroComprobante,
		} = body;

		if (!emailDestino || !nombreAlumno || !cursoNombre) {
			return NextResponse.json(
				{ error: "Faltan datos requeridos para enviar correo" },
				{ status: 400 },
			);
		}

		const result = await enviarCorreoCuota({
			emailDestino,
			nombreAlumno,
			cursoNombre,
			mes: Number(mes),
			anio: Number(anio),
			montoAbonado: Number(montoAbonado),
			metodoPago,
			nroComprobante,
		});

		if (!result.success) {
			throw new Error("Fallo al enviar en Resend");
		}

		return NextResponse.json({
			success: true,
			message: "Correo de cuota enviado",
		});
	} catch (error) {
		console.error("❌ Error en endpoint de correos (Cuota):", error);
		return NextResponse.json(
			{ error: "Error enviando correo de cuota" },
			{ status: 500 },
		);
	}
}
