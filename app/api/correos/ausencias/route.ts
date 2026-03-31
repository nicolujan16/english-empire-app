import { NextResponse } from "next/server";
import { enviarCorreoAusencia } from "@/lib/services/emailServices";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { alumnos } = body;

		if (!alumnos || !Array.isArray(alumnos)) {
			return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
		}

		const promesas = alumnos.map((al) =>
			enviarCorreoAusencia({
				emailDestino: al.emailDestino,
				nombreAlumno: al.nombreAlumno,
				cursoNombre: al.cursoNombre,
			}),
		);

		await Promise.all(promesas);

		return NextResponse.json({ success: true, message: "Correos enviados" });
	} catch (error) {
		console.error("Error en API de correos de ausencia:", error);
		return NextResponse.json(
			{ error: "Hubo un problema al enviar los correos" },
			{ status: 500 },
		);
	}
}
