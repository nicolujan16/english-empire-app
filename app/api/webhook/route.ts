import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "@/lib/firebaseConfig";
import {
	doc,
	getDoc,
	setDoc,
	addDoc,
	updateDoc,
	arrayUnion,
	collection,
	serverTimestamp,
} from "firebase/firestore";

const client = new MercadoPagoConfig({
	accessToken: process.env.MP_ACCESS_TOKEN || "",
});

function calcularMontoPrimerMes(
	fechaInscripcion: Date,
	cuota1a10: number,
): number {
	const dia = fechaInscripcion.getDate();
	return dia >= 15 ? cuota1a10 * 0.5 : cuota1a10;
}

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
						// ── 1. Guardar la inscripción ─────────────────────────────────
						const nuevaInscripcion = {
							alumnoDni: metadata.alumno_dni,
							alumnoId: metadata.alumno_id,
							alumnoNombre: metadata.alumno_nombre,
							cursoId: metadata.curso_id,
							cursoNombre: metadata.curso_nombre,
							cursoInscripcion: paymentInfo.transaction_amount,
							fecha: new Date(),
							metodoPago: "Mercado Pago",
							status: "Confirmado",
							tipoAlumno: metadata.tipo_alumno || "Desconocido",
							paymentId: paymentId,
						};

						const inscripcionId = `MP_${paymentId}`;
						const inscripcionRef = doc(db, "Inscripciones", inscripcionId);
						await setDoc(inscripcionRef, nuevaInscripcion);
						console.log("✅ INSCRIPCIÓN GUARDADA:", inscripcionId);

						// ── 2. Agregar el curso al array del alumno ───────────────────
						try {
							if (metadata.tipo_alumno === "Titular") {
								const userRef = doc(db, "Users", metadata.user_id);
								await updateDoc(userRef, {
									cursos: arrayUnion(metadata.curso_id),
								});
								console.log(
									`✅ CURSO ${metadata.curso_id} AGREGADO AL TITULAR`,
								);
							} else {
								const hijoRef = doc(db, "Hijos", metadata.alumno_id);
								await updateDoc(hijoRef, {
									cursos: arrayUnion(metadata.curso_id),
								});
								console.log(`✅ CURSO ${metadata.curso_id} AGREGADO AL HIJO`);
							}
						} catch (updateError) {
							console.error(
								"❌ Error al actualizar los cursos del alumno:",
								updateError,
							);
						}

						// ── 3. Crear cuotas ───────────────────────────────────────────
						try {
							const cursoSnap = await getDoc(
								doc(db, "Cursos", metadata.curso_id),
							);

							if (!cursoSnap.exists()) {
								console.error(
									`❌ No se encontró el curso ${metadata.curso_id} para crear la cuota.`,
								);
							} else {
								const cursoData = cursoSnap.data();
								const cuota1a10: number = cursoData.cuota1a10 ?? 0;
								const cuota11enAdelante: number =
									cursoData.cuota11enAdelante ?? 0;
								const finMes: number = cursoData.finMes ?? 12;

								const hoy = new Date();
								const dia = hoy.getDate();
								const montoPrimerMes = calcularMontoPrimerMes(hoy, cuota1a10);
								const alumnoTipo =
									metadata.tipo_alumno === "Titular" ? "adulto" : "menor";

								const datosComunesAlumno = {
									inscripcionId,
									alumnoId: metadata.alumno_id,
									alumnoTipo,
									alumnoNombre: metadata.alumno_nombre,
									alumnoDni: metadata.alumno_dni,
									cursoId: metadata.curso_id,
									cursoNombre: metadata.curso_nombre,
									cuota1a10,
									cuota11enAdelante,
									estado: "Pendiente",
									fechaPago: null,
									montoPagado: null,
									metodoPago: null,
								};

								// ── 3a. Cuota del mes actual ──────────────────────────────
								await addDoc(collection(db, "Cuotas"), {
									...datosComunesAlumno,
									mes: hoy.getMonth() + 1,
									anio: hoy.getFullYear(),
									esPrimerMes: true,
									montoPrimerMes,
									creadoEn: serverTimestamp(),
									actualizadoEn: serverTimestamp(),
								});
								console.log(
									`✅ PRIMERA CUOTA CREADA — ${metadata.alumno_nombre} | ${metadata.curso_nombre} | Monto: $${montoPrimerMes}`,
								);

								// ── 3b. Si día >= 20, la CF ya corrió → crear mes siguiente
								if (dia >= 20) {
									const fechaSiguiente = new Date(
										hoy.getFullYear(),
										hoy.getMonth() + 1,
										1,
									);
									const mesSiguiente = fechaSiguiente.getMonth() + 1;
									const anioSiguiente = fechaSiguiente.getFullYear();

									if (mesSiguiente <= finMes) {
										await addDoc(collection(db, "Cuotas"), {
											...datosComunesAlumno,
											mes: mesSiguiente,
											anio: anioSiguiente,
											esPrimerMes: false,
											montoPrimerMes: null,
											creadoEn: serverTimestamp(),
											actualizadoEn: serverTimestamp(),
										});
										console.log(
											`✅ CUOTA ADICIONAL CREADA — ${mesSiguiente}/${anioSiguiente} (inscripción post-CF)`,
										);
									}
								}
							}
						} catch (cuotaError) {
							console.error("❌ Error al crear las cuotas:", cuotaError);
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
