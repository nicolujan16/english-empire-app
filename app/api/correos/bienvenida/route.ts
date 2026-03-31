import { NextResponse } from "next/server";
import { enviarCorreoBienvenida } from "@/lib/services/emailServices";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { emailDestino, nombreUsuario } = body;

		if (!emailDestino || !nombreUsuario) {
			return NextResponse.json(
				{ error: "Faltan datos requeridos" },
				{ status: 400 },
			);
		}

		const result = await enviarCorreoBienvenida({
			emailDestino,
			nombreUsuario,
		});

		if (!result.success) {
			throw new Error("Fallo al enviar en Resend");
		}

		return NextResponse.json({
			success: true,
			message: "Correo de bienvenida enviado",
		});
	} catch (error) {
		console.error("❌ Error en endpoint de bienvenida:", error);
		return NextResponse.json(
			{ error: "Error enviando correo" },
			{ status: 500 },
		);
	}
}
