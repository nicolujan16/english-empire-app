import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

/**
 * POST /api/verificar-hijo
 *
 * Verifica que un alumno (hijo) identificado por DNI pertenece
 * al usuario autenticado (tutor). Si la verificación pasa, devuelve
 * los datos del hijo necesarios para el frontend.
 *
 * Reemplaza los getDocs(query(Hijos, where("dni", "==",...))) del cliente,
 * eliminando la necesidad de que usuarios normales tengan `allow list` en Hijos.
 *
 * Body esperado: { alumnoDni: string }
 * Headers: Authorization: Bearer {idToken}
 */
export async function POST(request: Request) {
	// ── 1. Verificar el token JWT ────────────────────────────────────────────
	const authHeader = request.headers.get("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return NextResponse.json(
			{ error: "No autorizado. Token faltante." },
			{ status: 401 },
		);
	}

	const idToken = authHeader.split("Bearer ")[1];
	let userId: string;

	try {
		const decodedToken = await adminAuth.verifyIdToken(idToken);
		userId = decodedToken.uid;
	} catch {
		return NextResponse.json(
			{ error: "No autorizado. Token inválido o expirado." },
			{ status: 401 },
		);
	}

	// ── 2. Leer y validar el body ────────────────────────────────────────────
	const body = await request.json();
	const { alumnoDni } = body;

	if (!alumnoDni) {
		return NextResponse.json(
			{ error: "Falta el DNI del alumno." },
			{ status: 400 },
		);
	}

	// ── 3. Buscar el hijo por DNI (usando Admin SDK, bypasea las reglas) ─────
	const hijosSnap = await adminDb
		.collection("Hijos")
		.where("dni", "==", alumnoDni)
		.limit(1)
		.get();

	if (hijosSnap.empty) {
		return NextResponse.json(
			{ error: "No se encontró ningún alumno registrado con ese DNI." },
			{ status: 404 },
		);
	}

	const hijoDoc = hijosSnap.docs[0];
	const hijoData = hijoDoc.data();

	// ── 4. Verificar que el hijo le pertenece al usuario autenticado ─────────
	if (hijoData.tutorId !== userId) {
		return NextResponse.json(
			{
				error: "Acceso denegado: este alumno no está asociado a tu cuenta.",
			},
			{ status: 403 },
		);
	}

	// ── 5. Devolver los datos del hijo que necesita el frontend ──────────────
	return NextResponse.json({
		id: hijoDoc.id,
		nombre: hijoData.nombre,
		apellido: hijoData.apellido,
		dni: hijoData.dni,
		fechaNacimiento: hijoData.fechaNacimiento,
		cursos: hijoData.cursos ?? [],
		etiquetas: hijoData.etiquetas ?? [],
	});
}
