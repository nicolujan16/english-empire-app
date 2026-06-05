import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { enviarCorreoBienvenidaConLink } from "@/lib/services/emailServices";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://englishempire.com.ar";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { emailDestino } = body;

		if (!emailDestino) {
			return NextResponse.json(
				{ error: "Faltan datos requeridos: emailDestino" },
				{ status: 400 },
			);
		}

		// 1. Verificar si el usuario existe en Firebase Auth
		let userRecord;
		try {
			userRecord = await adminAuth.getUserByEmail(emailDestino);
		} catch (error: any) {
			if (error.code === "auth/user-not-found") {
				return NextResponse.json(
					{ error: "No se encontró ningún usuario con este correo." },
					{ status: 404 },
				);
			}
			throw error;
		}

		// 2. Buscar datos adicionales en Firestore para obtener el nombre
		let nombreUsuario = "Alumno";
		try {
			const userDoc = await adminDb.collection("Users").doc(userRecord.uid).get();
			if (userDoc.exists) {
				const userData = userDoc.data();
				if (userData?.nombre) {
					nombreUsuario = userData.nombre;
				}
			}
		} catch (dbError) {
			console.error("Error al buscar usuario en Firestore:", dbError);
			// Continuamos de todos modos, usando el nombre por defecto
		}

		// 3. Generar el link de Firebase (contiene oobCode y otros params)
		const firebaseLink = await adminAuth.generatePasswordResetLink(
			emailDestino,
			{
				url: `${APP_URL}/crear-contrasena`,
			},
		);

		// 4. Extraer los parámetros del link de Firebase y reconstruir con nuestro dominio
		const firebaseUrl = new URL(firebaseLink);
		const oobCode = firebaseUrl.searchParams.get("oobCode");
		const apiKey = firebaseUrl.searchParams.get("apiKey");
		const mode = firebaseUrl.searchParams.get("mode") || "resetPassword";
		const lang = firebaseUrl.searchParams.get("lang") || "es";

		if (!oobCode || !apiKey) {
			throw new Error("No se pudieron extraer los parámetros del link de Firebase");
		}

		// 5. Armar la URL personalizada apuntando a nuestro dominio
		const customResetLink = `${APP_URL}/crear-contrasena?mode=${mode}&oobCode=${oobCode}&apiKey=${apiKey}&lang=${lang}`;

		// 6. Enviar el correo de bienvenida con el link personalizado
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
		console.error("❌ Error en endpoint de reenviar-bienvenida:", error);
		return NextResponse.json(
			{ error: "Error al generar el enlace o enviar el correo" },
			{ status: 500 },
		);
	}
}
