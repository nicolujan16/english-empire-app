import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
	const { dni, telefono, hijosData } = await req.json();

	const usersRef = adminDb.collection("Users");
	const hijosRef = adminDb.collection("Hijos");

	const [dniUsers, dniHijos] = await Promise.all([
		usersRef.where("dni", "==", dni).limit(1).get(),
		hijosRef.where("dni", "==", dni).limit(1).get(),
	]);

	if (!dniUsers.empty || !dniHijos.empty) {
		return NextResponse.json(
			{ error: "Ya existe una cuenta registrada con el DNI del titular." },
			{ status: 400 },
		);
	}

	// Chequeo teléfono
	const phoneSnap = await usersRef
		.where("telefono", "==", telefono)
		.limit(1)
		.get();
	if (!phoneSnap.empty) {
		return NextResponse.json(
			{ error: "Este número de teléfono ya está asociado a otra cuenta." },
			{ status: 400 },
		);
	}

	// Chequeo DNIs de hijos
	if (hijosData?.length > 0) {
		for (const hijo of hijosData) {
			if (hijo.dni === dni) {
				return NextResponse.json(
					{
						error:
							"El DNI del alumno a cargo no puede ser igual al del titular.",
					},
					{ status: 400 },
				);
			}

			const hijoDniSnap = await hijosRef
				.where("dni", "==", hijo.dni)
				.limit(1)
				.get();
			if (!hijoDniSnap.empty) {
				return NextResponse.json(
					{ error: `El DNI ${hijo.dni} ya se encuentra registrado.` },
					{ status: 400 },
				);
			}
		}
	}

	return NextResponse.json({ ok: true });
}
