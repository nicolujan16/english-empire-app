import { render } from "@react-email/render";
import InscripcionConfirmada from "@/components/email/InscripcionConfirmada";
import CuotaPagada from "@/components/email/CuotaPagada";
import Bienvenida from "@/components/email/Bienvenida";
import BienvenidaConLink from "@/components/email/BienvenidaConLink";
import AusenciaInjustificada from "@/components/email/AusenciaInjustificada";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// ----------- Fetch nativo a la API de Resend -----------
// Usamos fetch en lugar del SDK para poder leer los headers crudos
// de la respuesta (en particular x-resend-daily-quota).

interface ResendPayload {
	from: string;
	to: string[];
	subject: string;
	html: string;
}

interface ResendResult {
	data: { id: string } | null;
	/** Correos restantes del día según el header x-resend-daily-quota.
	 *  Es null si el header no viene (ej. plan de pago sin límite diario). */
	restantes: number | null;
}

async function sendEmailViaResend(payload: ResendPayload): Promise<ResendResult> {
	const apiKey = process.env.RESEND_API_KEY;

	const res = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!res.ok) {
		const errorBody = await res.json().catch(() => ({}));
		throw new Error(
			`Resend API error ${res.status}: ${JSON.stringify(errorBody)}`,
		);
	}

	const data = await res.json();

	// Leer el header de cuota diaria
	let restantes: number | null = null;
	const quotaHeader = res.headers.get("x-resend-daily-quota");
	if (quotaHeader !== null) {
		const usado = parseInt(quotaHeader, 10);
		if (!isNaN(usado)) {
			restantes = 100 - usado;
		}
	}

	return { data, restantes };
}

// ----------- Registro de envíos en Firestore -----------

type TipoMail =
	| "inscripcion"
	| "cuota"
	| "bienvenida"
	| "bienvenida-con-link"
	| "ausencia";

async function registrarEnvioMail(
	destino: string,
	tipo: TipoMail,
	restantes: number | null,
): Promise<void> {
	try {
		const docRef = adminDb.collection("Mails").doc("MailsEnviados");

		// Siempre agregamos el mail al array
		const updateData: Record<string, unknown> = {
			enviados: FieldValue.arrayUnion({
				destino,
				tipo,
				fechaHora: new Date(),
			}),
		};

		// Solo actualizamos "restantes" si el header estuvo presente en la respuesta
		if (restantes !== null) {
			updateData.restantes = restantes;
		}

		await docRef.set(updateData, { merge: true });
	} catch (err) {
		// El registro no debe interrumpir el flujo principal
		console.error("⚠️ Error registrando envío de mail en Firestore:", err);
	}
}

// ----------- Inscripciones -----------

interface SendInscripcionParams {
	emailDestino: string;
	nombreAlumno: string;
	cursoNombre: string;
	montoAbonado: number;
	metodoPago: string;
	nroComprobante: string;
}

export async function enviarCorreoInscripcion({
	emailDestino,
	nombreAlumno,
	cursoNombre,
	montoAbonado,
	metodoPago,
	nroComprobante,
}: SendInscripcionParams) {
	try {
		const html = await render(
			InscripcionConfirmada({
				nombreAlumno,
				cursoNombre,
				montoAbonado,
				metodoPago,
				nroComprobante,
				fecha: new Date().toLocaleDateString("es-AR"),
			}),
		);

		const { data, restantes } = await sendEmailViaResend({
			from: "English Empire Institute <pagos@englishempire.com.ar>",
			to: [emailDestino],
			subject: "¡Inscripción Confirmada! 🎉",
			html,
		});

		await registrarEnvioMail(emailDestino, "inscripcion", restantes);
		return { success: true, data };
	} catch (error) {
		console.error("Error en emailService (Inscripcion):", error);
		return { success: false, error };
	}
}

// ----------- Cuotas Pagas -----------

interface SendCuotaParams {
	emailDestino: string;
	nombreAlumno: string;
	cursoNombre: string;
	mes: number;
	anio: number;
	montoAbonado: number;
	metodoPago: string;
	nroComprobante: string;
}

export async function enviarCorreoCuota({
	emailDestino,
	nombreAlumno,
	cursoNombre,
	mes,
	anio,
	montoAbonado,
	metodoPago,
	nroComprobante,
}: SendCuotaParams) {
	try {
		const html = await render(
			CuotaPagada({
				nombreAlumno,
				cursoNombre,
				mes,
				anio,
				montoAbonado,
				metodoPago,
				nroComprobante,
				fecha: new Date().toLocaleDateString("es-AR"),
			}),
		);

		const { data, restantes } = await sendEmailViaResend({
			from: "English Empire Institute <pagos@englishempire.com.ar>",
			to: [emailDestino],
			subject: "¡Pago de Cuota Recibido! ✅",
			html,
		});

		await registrarEnvioMail(emailDestino, "cuota", restantes);
		return { success: true, data };
	} catch (error) {
		console.error("Error en emailService (Cuota):", error);
		return { success: false, error };
	}
}

// ----------- Bienvenida -----------

export async function enviarCorreoBienvenida({
	emailDestino,
	nombreUsuario,
}: {
	emailDestino: string;
	nombreUsuario: string;
}) {
	try {
		const html = await render(Bienvenida({ nombreUsuario }));

		const { data, restantes } = await sendEmailViaResend({
			from: "English Empire <hola@englishempire.com.ar>",
			to: [emailDestino],
			subject: "¡Te damos la bienvenida a English Empire! 🎉",
			html,
		});

		await registrarEnvioMail(emailDestino, "bienvenida", restantes);
		return { success: true, data };
	} catch (error) {
		console.error("Error en emailService (Bienvenida):", error);
		return { success: false, error };
	}
}

// ----------- Ausencias -----------

interface SendAusenciaParams {
	emailDestino: string;
	nombreAlumno: string;
	cursoNombre: string;
}

export async function enviarCorreoAusencia({
	emailDestino,
	nombreAlumno,
	cursoNombre,
}: SendAusenciaParams) {
	try {
		const html = await render(
			AusenciaInjustificada({
				nombreAlumno,
				cursoNombre,
				fecha: new Date().toLocaleDateString("es-AR"),
			}),
		);

		const { data, restantes } = await sendEmailViaResend({
			from: "English Empire Institute <secretaria@englishempire.com.ar>",
			to: [emailDestino],
			subject: `Aviso de inasistencia - ${nombreAlumno}`,
			html,
		});

		await registrarEnvioMail(emailDestino, "ausencia", restantes);
		return { success: true, data };
	} catch (error) {
		console.error("Error en emailService (Ausencia):", error);
		return { success: false, error };
	}
}

// ----------- Bienvenida con link de creación de contraseña -----------

interface SendBienvenidaConLinkParams {
	emailDestino: string;
	nombreUsuario: string;
	resetLink: string;
}

export async function enviarCorreoBienvenidaConLink({
	emailDestino,
	nombreUsuario,
	resetLink,
}: SendBienvenidaConLinkParams) {
	try {
		const html = await render(BienvenidaConLink({ nombreUsuario, resetLink }));

		const { data, restantes } = await sendEmailViaResend({
			from: "English Empire <hola@englishempire.com.ar>",
			to: [emailDestino],
			subject: "¡Te damos la bienvenida a English Empire! Creá tu contraseña 🔑",
			html,
		});

		await registrarEnvioMail(emailDestino, "bienvenida-con-link", restantes);
		return { success: true, data };
	} catch (error) {
		console.error("Error en emailService (BienvenidaConLink):", error);
		return { success: false, error };
	}
}
