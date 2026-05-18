import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { enviarCorreoBienvenidaConLink } from "@/lib/services/emailServices";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://englishempire.com.ar";

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

		// 1. Generar el link de Firebase (contiene oobCode y otros params)
		const firebaseLink = await adminAuth.generatePasswordResetLink(
			emailDestino,
			{
				url: `${APP_URL}/crear-contrasena`,
			},
		);

		// 2. Extraer los parámetros del link de Firebase y reconstruir con nuestro dominio
		const firebaseUrl = new URL(firebaseLink);
		const oobCode = firebaseUrl.searchParams.get("oobCode");
		const apiKey = firebaseUrl.searchParams.get("apiKey");
		const mode = firebaseUrl.searchParams.get("mode") || "resetPassword";
		const lang = firebaseUrl.searchParams.get("lang") || "es";

		if (!oobCode || !apiKey) {
			throw new Error("No se pudieron extraer los parámetros del link de Firebase");
		}

		// 3. Armar la URL personalizada apuntando a nuestro dominio
		const customResetLink = `${APP_URL}/crear-contrasena?mode=${mode}&oobCode=${oobCode}&apiKey=${apiKey}&lang=${lang}`;

		// 4. Enviar el correo de bienvenida con el link personalizado
		const result = await enviarCorreoBienvenidaConLink({
			emailDestino,
			nombreUsuario,
			resetLink: customResetLink,
		});

		if (!result.success) {
			throw new Error("Fallo al enviar en Resend");
		}

		return NextResponse.json({
			success: true,
			message: "Correo de bienvenida con link enviado",
		});
	} catch (error) {
		console.error("❌ Error en endpoint de bienvenida-con-link:", error);
		return NextResponse.json(
			{ error: "Error al generar el enlace o enviar el correo" },
			{ status: 500 },
		);
	}
}
