/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { app } from "@/lib/firebaseConfig";

export async function POST(request: Request) {
	const { alumnoId, email } = await request.json();

	try {
		await adminAuth.createUser({
			uid: alumnoId,
			email: email,
			password: Math.random().toString(36).slice(-10) + "A1!",
		});

		const userRef = adminDb.collection("Users").doc(alumnoId);
		const userDoc = await userRef.get();

		await userRef.update({
			email: email,
			sinAccesoWeb: false,
		});

		if (userDoc.exists) {
			const userData = userDoc.data();
			const hijosIds = userData?.hijos || [];

			if (Array.isArray(hijosIds) && hijosIds.length > 0) {
				const batch = adminDb.batch();

				hijosIds.forEach((hijoId: string) => {
					const hijoRef = adminDb.collection("Hijos").doc(hijoId);
					batch.update(hijoRef, {
						"datosTutor.email": email,
					});
				});

				await batch.commit();
			}
		}

		const clientAuth = getAuth(app);
		await sendPasswordResetEmail(clientAuth, email);

		return NextResponse.json({
			success: true,
			message: "Email asociado y correo de recuperación enviado correctamente",
		});
	} catch (error: any) {
		console.error("Error en asociar-email:", error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
