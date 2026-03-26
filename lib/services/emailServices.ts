import { Resend } from "resend";
import InscripcionConfirmada from "@/components/email/InscripcionConfirmada";

const resend = new Resend(process.env.RESEND_API_KEY);

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
			from: "English Empire <pagos@englishempire.com.ar>",
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
