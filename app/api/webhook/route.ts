import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "@/lib/firebaseConfig";
import {
	doc,
	setDoc,
	updateDoc,
	arrayUnion,
	collection,
	query,
	where,
	getDocs,
} from "firebase/firestore";

const client = new MercadoPagoConfig({
	accessToken: process.env.MP_ACCESS_TOKEN || "",
});

export async function POST(request: Request) {
	try {
		const body = await request.json();
		console.log(
			"🔔 WEBHOOK RECIBIDO DE MERCADO PAGO:",
			body.action || body.type,
		);

		const paymentId = body?.data?.id;

		if (
			body.type === "payment" ||
			body.action === "payment.created" ||
			body.action === "payment.updated"
		) {
			if (paymentId) {
				const payment = new Payment(client);
				const paymentInfo = await payment.get({ id: paymentId });

				console.log(`💰 Estado del pago ${paymentId}:`, paymentInfo.status);

				if (paymentInfo.status === "approved") {
					const metadata = paymentInfo.metadata;

					if (metadata) {
						const nuevaInscripcion = {
							alumnoDni: metadata.alumno_dni,
							alumnoId: metadata.user_id,
							alumnoNombre: metadata.alumno_nombre,
							cursoId: metadata.curso_id,
							cursoNombre: metadata.curso_nombre,
							cursoInscripcion: paymentInfo.transaction_amount,
							fecha: new Date(),
							paymentMethod: "Mercado Pago",
							status: "Confirmado",
							tipoAlumno: metadata.tipo_alumno || "Desconocido",
							paymentId: paymentId,
						};

						const inscripcionRef = doc(db, "Inscripciones", `MP_${paymentId}`);
						await setDoc(inscripcionRef, nuevaInscripcion);
						console.log("✅ INSCRIPCIÓN GUARDADA EN FIREBASE CON ÉXITO");

						try {
							if (metadata.tipo_alumno === "Titular") {
								const userRef = doc(db, "Users", metadata.user_id);

								await updateDoc(userRef, {
									cursos: arrayUnion(metadata.curso_id),
									[`cuotasPagadas.${metadata.curso_id}`]: [],
								});

								console.log(
									`✅ CURSO ${metadata.curso_id} AGREGADO AL TITULAR`,
								);
							} else {
								const hijosRef = collection(db, "Hijos");
								const qHijos = query(
									hijosRef,
									where("tutorId", "==", metadata.user_id),
									where("dni", "==", metadata.alumno_dni),
								);
								const hijosSnap = await getDocs(qHijos);

								if (!hijosSnap.empty) {
									const hijoId = hijosSnap.docs[0].id;
									const hijoRef = doc(db, "Hijos", hijoId);

									await updateDoc(hijoRef, {
										cursos: arrayUnion(metadata.curso_id),
										[`cuotasPagadas.${metadata.curso_id}`]: [],
									});

									console.log(`✅ CURSO ${metadata.curso_id} AGREGADO AL HIJO`);
								} else {
									console.warn(
										"⚠️ No se encontró al hijo para actualizar sus cursos.",
									);
								}
							}
						} catch (updateError) {
							console.error(
								"❌ Error al actualizar los cursos del alumno:",
								updateError,
							);
						}
					}
				}
			}
		}
		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.error("❌ Error en el Webhook:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
