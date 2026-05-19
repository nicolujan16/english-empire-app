import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

// ─── Rate Limiter en memoria ─────────────────────────────────────────────────
// Límite: 5 intentos por IP cada 60 segundos.
// El Map vive a nivel de módulo, persiste entre requests en el mismo proceso.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000; // 60 segundos

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = rateLimitMap.get(ip);

	// Si no hay entrada o ya expiró la ventana, reiniciamos el contador
	if (!entry || now > entry.resetTime) {
		rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
		return true; // permitido
	}

	// Si ya superó el límite, rechazamos
	if (entry.count >= RATE_LIMIT_MAX) {
		return false; // bloqueado
	}

	// Incrementamos el contador y permitimos
	entry.count++;
	return true; // permitido
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
	// Extraemos la IP del request (funciona en Vercel y servidores estándar)
	const ip =
		req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
		req.headers.get("x-real-ip") ??
		"unknown";

	if (!checkRateLimit(ip)) {
		return NextResponse.json(
			{
				error: "Demasiados intentos. Por favor, esperá un momento antes de intentar de nuevo.",
			},
			{ status: 429 },
		);
	}

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

