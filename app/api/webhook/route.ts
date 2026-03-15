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
	query,
	where,
	getDocs,
	serverTimestamp,
} from "firebase/firestore";

const client = new MercadoPagoConfig({
	accessToken: process.env.MP_ACCESS_TOKEN || "",
});

// ─────────────────────────────────────────────────────────────────────────────
// Calcula el monto de la primera cuota según la fecha de inscripción:
//   · Día < 15  → cuota completa (cuota1a10)
//   · Día >= 15 → 50% de cuota1a10
// ─────────────────────────────────────────────────────────────────────────────
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
						// ── 1. Guardar la inscripción ──────────────────────────────────
						const nuevaInscripcion = {
							alumnoDni: metadata.alumno_dni,
							alumnoId: metadata.user_id,
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

						// ── 2. Agregar el curso al array del alumno (se mantiene) ──────
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
								const hijosRef = collection(db, "Hijos");
								const qHijos = query(
									hijosRef,
									where("tutorId", "==", metadata.user_id),
									where("dni", "==", metadata.alumno_dni),
								);
								const hijosSnap = await getDocs(qHijos);

								if (!hijosSnap.empty) {
									const hijoRef = doc(db, "Hijos", hijosSnap.docs[0].id);
									await updateDoc(hijoRef, {
										cursos: arrayUnion(metadata.curso_id),
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

						// ── 3. Crear la primera cuota ──────────────────────────────────
						try {
							// Necesitamos cuota1a10 y cuota11enAdelante del curso
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

								const hoy = new Date();
								const montoPrimerMes = calcularMontoPrimerMes(hoy, cuota1a10);

								// Determinamos el tipo normalizado
								const alumnoTipo =
									metadata.tipo_alumno === "Titular" ? "adulto" : "menor";

								const cuotaData = {
									// Referencias
									inscripcionId,
									alumnoId: metadata.user_id,
									alumnoTipo,
									alumnoNombre: metadata.alumno_nombre,
									alumnoDni: metadata.alumno_dni,
									cursoId: metadata.curso_id,
									cursoNombre: metadata.curso_nombre,

									// Período
									mes: hoy.getMonth() + 1, // 1-indexed
									anio: hoy.getFullYear(),

									// Snapshot de precios del curso al momento de la inscripción
									cuota1a10,
									cuota11enAdelante,

									// Primer mes: monto pre-calculado según reglas de negocio
									esPrimerMes: true,
									montoPrimerMes,

									// Estado inicial — el alumno ya pagó la inscripción,
									// pero la CUOTA mensual arranca pendiente de cobro
									estado: "Pendiente",
									fechaPago: null,
									montoPagado: null,
									metodoPago: null,

									creadoEn: serverTimestamp(),
									actualizadoEn: serverTimestamp(),
								};

								await addDoc(collection(db, "Cuotas"), cuotaData);
								console.log(
									`✅ PRIMERA CUOTA CREADA — Alumno: ${metadata.alumno_nombre} | Curso: ${metadata.curso_nombre} | Monto: $${montoPrimerMes}`,
								);
							}
						} catch (cuotaError) {
							console.error("❌ Error al crear la primera cuota:", cuotaError);
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
