import { Resend } from "resend";
import InscripcionConfirmada from "@/components/email/InscripcionConfirmada";
import CuotaPagada from "@/components/email/CuotaPagada";
import Bienvenida from "@/components/email/Bienvenida";
import AusenciaInjustificada from "@/components/email/AusenciaInjustificada";

const resend = new Resend(process.env.RESEND_API_KEY);

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
		const data = await resend.emails.send({
			from: "English Empire Institute <pagos@englishempire.com.ar>",
			to: [emailDestino],
			subject: "¡Inscripción Confirmada! 🎉",
			react: InscripcionConfirmada({
				nombreAlumno,
				cursoNombre,
				montoAbonado,
				metodoPago,
				nroComprobante,
				fecha: new Date().toLocaleDateString("es-AR"),
			}),
		});
		return { success: true, data };
	} catch (error) {
		console.error("Error en emailService:", error);
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
		const data = await resend.emails.send({
			from: "English Empire Institute <pagos@englishempire.com.ar>",
			to: [emailDestino],
			subject: "¡Pago de Cuota Recibido! ✅",
			react: CuotaPagada({
				nombreAlumno,
				cursoNombre,
				mes,
				anio,
				montoAbonado,
				metodoPago,
				nroComprobante,
				fecha: new Date().toLocaleDateString("es-AR"),
			}),
		});
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
		const data = await resend.emails.send({
			from: "English Empire <hola@englishempire.com.ar>", // Podés usar hola@ o info@
			to: [emailDestino],
			subject: "¡Te damos la bienvenida a English Empire! 🎉",
			react: Bienvenida({ nombreUsuario }),
		});
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
		const data = await resend.emails.send({
			from: "English Empire Institute <secretaria@englishempire.com.ar>",
			to: [emailDestino],
			subject: `Aviso de inasistencia - ${nombreAlumno}`,
			react: AusenciaInjustificada({
				nombreAlumno,
				cursoNombre,
				fecha: new Date().toLocaleDateString("es-AR"),
			}),
		});
		return { success: true, data };
	} catch (error) {
		console.error("Error en emailService (Ausencia):", error);
		return { success: false, error };
	}
}
