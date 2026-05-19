import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

/**
 * GET /api/verificar-dni?dni=12345678
 *
 * Verifica si un DNI ya existe en la base de datos (sea en Users o en Hijos).
 * Utilizado por AddStudentModal para validar antes de crear un nuevo hijo,
 * bypaseando las Firebase Rules que restringen el `list` a los clientes.
 */
export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const dni = searchParams.get("dni");

	if (!dni) {
		return NextResponse.json(
			{ error: "El parámetro DNI es requerido." },
			{ status: 400 },
		);
	}

	try {
		const [usersSnap, hijosSnap] = await Promise.all([
			adminDb.collection("Users").where("dni", "==", dni).limit(1).get(),
			adminDb.collection("Hijos").where("dni", "==", dni).limit(1).get(),
		]);

		const existe = !usersSnap.empty || !hijosSnap.empty;

		return NextResponse.json({ existe });
	} catch (error) {
		console.error("Error al verificar DNI:", error);
		return NextResponse.json(
			{ error: "Error al verificar el DNI." },
			{ status: 500 },
		);
	}
}
