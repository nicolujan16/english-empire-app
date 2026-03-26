import { NextResponse } from "next/server";
import { enviarCorreoInscripcion } from "@/lib/services/emailServices";

export async function POST(request: Request) {
	try {
		const body = await request.json();

		const {
			emailDestino,
			nombreAlumno,
			cursoNombre,
			montoAbonado,
			metodoPago,
			nroComprobante,
		} = body;

		if (!emailDestino || !nombreAlumno || !cursoNombre) {
			return NextResponse.json(
				{ error: "Faltan datos requeridos" },
				{ status: 400 },
			);
		}

		// Le pasamos TODOS los datos a nuestra función centralizada
		const result = await enviarCorreoInscripcion({
			emailDestino,
			nombreAlumno,
			cursoNombre,
			montoAbonado,
			metodoPago,
			nroComprobante,
		});

		if (!result.success) {
			throw new Error("Fallo al enviar en Resend");
		}

		return NextResponse.json({ success: true, message: "Correo enviado" });
	} catch (error) {
		console.error("Error en endpoint de correos:", error);
		return NextResponse.json(
			{ error: "Error enviando correo" },
			{ status: 500 },
		);
	}
}
