import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "@/lib/firebaseConfig";
import {
	doc,
	getDoc,
	getDocs,
	setDoc,
	addDoc,
	updateDoc,
	arrayUnion,
	collection,
	query,
	where,
	serverTimestamp,
} from "firebase/firestore";

import { enviarCorreoInscripcion } from "@/lib/services/emailServices";

const client = new MercadoPagoConfig({
	accessToken: process.env.MP_ACCESS_TOKEN || "",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcularMontoPrimerMes(
	fechaInscripcion: Date,
	cuota1a10: number,
): number {
	const dia = fechaInscripcion.getDate();
	return dia >= 15 ? cuota1a10 * 0.5 : cuota1a10;
}

async function detectarDescuentoGrupoFamiliar(
	alumnoId: string,
	tipoAlumno: "adulto" | "menor",
): Promise<{ aplica: boolean; tutorId: string }> {
	try {
		let tutorId = alumnoId;
		let miembrosConCurso = 0;

		if (tipoAlumno === "adulto") {
			const userSnap = await getDoc(doc(db, "Users", alumnoId));
			if (userSnap.exists() && (userSnap.data().cursos ?? []).length > 0) {
				miembrosConCurso++;
			}

			const hijosSnap = await getDocs(
				query(collection(db, "Hijos"), where("tutorId", "==", alumnoId)),
			);
			for (const h of hijosSnap.docs) {
				if ((h.data().cursos ?? []).length > 0) miembrosConCurso++;
			}
		} else {
			const hijoSnap = await getDoc(doc(db, "Hijos", alumnoId));
			if (hijoSnap.exists()) tutorId = hijoSnap.data().tutorId ?? alumnoId;

			const tutorSnap = await getDoc(doc(db, "Users", tutorId));
			if (tutorSnap.exists() && (tutorSnap.data().cursos ?? []).length > 0) {
				miembrosConCurso++;
			}

			const hijosSnap = await getDocs(
				query(collection(db, "Hijos"), where("tutorId", "==", tutorId)),
			);
			for (const h of hijosSnap.docs) {
				if ((h.data().cursos ?? []).length > 0) miembrosConCurso++;
			}
		}

		console.log(
			`👨‍👩‍👧 Tutor ${tutorId}: ${miembrosConCurso} miembro(s) con cursos activos`,
		);

		return { aplica: miembrosConCurso >= 2, tutorId };
	} catch (error) {
		console.error("❌ Error al detectar grupo familiar:", error);
		return { aplica: false, tutorId: alumnoId };
	}
}

async function aplicarDescuentoAlRestoDeLaFamilia(
	alumnoId: string,
	tipoAlumno: "adulto" | "menor",
	tutorId: string,
): Promise<void> {
	const hoy = new Date();
	const mesActual = hoy.getMonth() + 1;
	const anioActual = hoy.getFullYear();

	const alumnoIdsGrupo: string[] = [];

	if (tipoAlumno === "adulto") {
		const hijosSnap = await getDocs(
			query(collection(db, "Hijos"), where("tutorId", "==", alumnoId)),
		);
		for (const h of hijosSnap.docs) {
			if ((h.data().cursos ?? []).length > 0) alumnoIdsGrupo.push(h.id);
		}
	} else {
		const tutorSnap = await getDoc(doc(db, "Users", tutorId));
		if (tutorSnap.exists() && (tutorSnap.data().cursos ?? []).length > 0) {
			alumnoIdsGrupo.push(tutorId);
		}
		const hijosSnap = await getDocs(
			query(collection(db, "Hijos"), where("tutorId", "==", tutorId)),
		);
		for (const h of hijosSnap.docs) {
			if (h.id !== alumnoId && (h.data().cursos ?? []).length > 0) {
				alumnoIdsGrupo.push(h.id);
			}
		}
	}

	if (alumnoIdsGrupo.length === 0) return;

	const DESCUENTO_GF = [{ porcentaje: 10, detalle: "Grupo Familiar" }];

	for (const miembroId of alumnoIdsGrupo) {
		const cuotaMesActualSnap = await getDocs(
			query(
				collection(db, "Cuotas"),
				where("alumnoId", "==", miembroId),
				where("mes", "==", mesActual),
				where("anio", "==", anioActual),
				where("estado", "==", "Pendiente"),
			),
		);

		for (const cuotaDoc of cuotaMesActualSnap.docs) {
			const data = cuotaDoc.data();
			if (!data.esPrimerMes) continue;

			const descActuales = data.descuentos ?? [];
			if (
				descActuales.some(
					(d: { detalle: string }) => d.detalle === "Grupo Familiar",
				)
			)
				continue;

			await updateDoc(doc(db, "Cuotas", cuotaDoc.id), {
				descuentos: [...descActuales, ...DESCUENTO_GF],
				actualizadoEn: serverTimestamp(),
			});
			console.log(
				`✅ Descuento GF aplicado a cuota primer mes — alumno: ${miembroId} | ${mesActual}/${anioActual}`,
			);
		}

		const cuotasFuturasSnap = await getDocs(
			query(
				collection(db, "Cuotas"),
				where("alumnoId", "==", miembroId),
				where("estado", "==", "Pendiente"),
			),
		);

		for (const cuotaDoc of cuotasFuturasSnap.docs) {
			const data = cuotaDoc.data();

			if (data.mes === mesActual && data.anio === anioActual) continue;

			const esFuturo =
				data.anio > anioActual ||
				(data.anio === anioActual && data.mes > mesActual);
			if (!esFuturo) continue;

			const descActuales = data.descuentos ?? [];
			if (
				descActuales.some(
					(d: { detalle: string }) => d.detalle === "Grupo Familiar",
				)
			)
				continue;

			await updateDoc(doc(db, "Cuotas", cuotaDoc.id), {
				descuentos: [...descActuales, ...DESCUENTO_GF],
				actualizadoEn: serverTimestamp(),
			});
			console.log(
				`✅ Descuento GF aplicado a cuota futura — alumno: ${miembroId} | ${data.mes}/${data.anio}`,
			);
		}
	}
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

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
							descuentoPorEtiqueta: metadata.descuento_aplicado || null,
							descuentoPorcentaje: metadata.descuento_porcentaje || null,
						};

						const inscripcionId = `MP_${paymentId}`;
						const inscripcionRef = doc(db, "Inscripciones", inscripcionId);
						await setDoc(inscripcionRef, nuevaInscripcion);
						console.log("✅ INSCRIPCIÓN GUARDADA:", inscripcionId);

						// ── 2. Agregar el curso al array del alumno ───────────────────
						const alumnoTipo: "adulto" | "menor" =
							metadata.tipo_alumno === "Titular" ? "adulto" : "menor";

						try {
							if (alumnoTipo === "adulto") {
								await updateDoc(doc(db, "Users", metadata.user_id), {
									cursos: arrayUnion(metadata.curso_id),
								});
								console.log(
									`✅ CURSO ${metadata.curso_id} AGREGADO AL TITULAR`,
								);
							} else {
								await updateDoc(doc(db, "Hijos", metadata.alumno_id), {
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

						// ── 3. Detectar descuento por Grupo Familiar ──────────────────
						const alumnoIdParaGrupo =
							alumnoTipo === "adulto" ? metadata.user_id : metadata.alumno_id;

						const { aplica: grupoFamiliarAplica, tutorId } =
							await detectarDescuentoGrupoFamiliar(
								alumnoIdParaGrupo,
								alumnoTipo,
							);

						const descuentos = grupoFamiliarAplica
							? [{ porcentaje: 10, detalle: "Grupo Familiar" }]
							: [];

						if (grupoFamiliarAplica) {
							console.log(
								`🎉 Descuento Grupo Familiar aplicado — tutor: ${tutorId}`,
							);
							try {
								await aplicarDescuentoAlRestoDeLaFamilia(
									alumnoIdParaGrupo,
									alumnoTipo,
									tutorId,
								);
							} catch (descuentoError) {
								console.error(
									"❌ Error al aplicar descuento al grupo familiar:",
									descuentoError,
								);
							}
						}

						// ── 4. Crear cuotas ───────────────────────────────────────────
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
									descuentos,
								};

								// ── 4a. Cuota del mes actual
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
									`✅ PRIMERA CUOTA CREADA — ${metadata.alumno_nombre} | ${metadata.curso_nombre} | Monto: $${montoPrimerMes}${grupoFamiliarAplica ? " (con 10% Grupo Familiar)" : ""}`,
								);

								// ── 4b. Mes siguiente si dia >= 20
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

						// ── 5. ENVIAR CORREO DE CONFIRMACIÓN ────────────────────
						try {
							let emailDestino = "";
							const userSnap = await getDoc(doc(db, "Users", metadata.user_id));

							if (userSnap.exists() && userSnap.data().email) {
								emailDestino = userSnap.data().email;
							}

							if (emailDestino) {
								await enviarCorreoInscripcion({
									emailDestino,
									nombreAlumno: metadata.alumno_nombre,
									cursoNombre: metadata.curso_nombre,
									montoAbonado: paymentInfo.transaction_amount || 0,
									metodoPago: "Mercado Pago",
									nroComprobante: `TXN-${paymentId.toString().slice(-8).toUpperCase()}`,
								});
								console.log(
									`✉️ Correo de inscripción enviado a ${emailDestino}`,
								);
							}
						} catch (emailError) {
							console.error(
								"❌ Error al enviar correo de confirmación:",
								emailError,
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
