import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

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
			const userSnap = await adminDb.collection("Users").doc(alumnoId).get();
			if (userSnap.exists && (userSnap.data()?.cursos ?? []).length > 0) {
				miembrosConCurso++;
			}

			const hijosSnap = await adminDb
				.collection("Hijos")
				.where("tutorId", "==", alumnoId)
				.get();

			for (const h of hijosSnap.docs) {
				if ((h.data().cursos ?? []).length > 0) miembrosConCurso++;
			}
		} else {
			const hijoSnap = await adminDb.collection("Hijos").doc(alumnoId).get();
			if (hijoSnap.exists) {
				tutorId = hijoSnap.data()?.tutorId ?? alumnoId;
			}

			const tutorSnap = await adminDb.collection("Users").doc(tutorId).get();
			if (tutorSnap.exists && (tutorSnap.data()?.cursos ?? []).length > 0) {
				miembrosConCurso++;
			}

			const hijosSnap = await adminDb
				.collection("Hijos")
				.where("tutorId", "==", tutorId)
				.get();

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
		const hijosSnap = await adminDb
			.collection("Hijos")
			.where("tutorId", "==", alumnoId)
			.get();

		for (const h of hijosSnap.docs) {
			if ((h.data().cursos ?? []).length > 0) alumnoIdsGrupo.push(h.id);
		}
	} else {
		const tutorSnap = await adminDb.collection("Users").doc(tutorId).get();
		if (tutorSnap.exists && (tutorSnap.data()?.cursos ?? []).length > 0) {
			alumnoIdsGrupo.push(tutorId);
		}
		const hijosSnap = await adminDb
			.collection("Hijos")
			.where("tutorId", "==", tutorId)
			.get();

		for (const h of hijosSnap.docs) {
			if (h.id !== alumnoId && (h.data().cursos ?? []).length > 0) {
				alumnoIdsGrupo.push(h.id);
			}
		}
	}

	if (alumnoIdsGrupo.length === 0) return;

	const DESCUENTO_GF = [{ porcentaje: 10, detalle: "Grupo Familiar" }];

	for (const miembroId of alumnoIdsGrupo) {
		const cuotaMesActualSnap = await adminDb
			.collection("Cuotas")
			.where("alumnoId", "==", miembroId)
			.where("mes", "==", mesActual)
			.where("anio", "==", anioActual)
			.where("estado", "==", "Pendiente")
			.get();

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

			await adminDb
				.collection("Cuotas")
				.doc(cuotaDoc.id)
				.update({
					descuentos: [...descActuales, ...DESCUENTO_GF],
					actualizadoEn: FieldValue.serverTimestamp(),
				});
			console.log(
				`✅ Descuento GF aplicado a cuota primer mes — alumno: ${miembroId} | ${mesActual}/${anioActual}`,
			);
		}

		const cuotasFuturasSnap = await adminDb
			.collection("Cuotas")
			.where("alumnoId", "==", miembroId)
			.where("estado", "==", "Pendiente")
			.get();

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

			await adminDb
				.collection("Cuotas")
				.doc(cuotaDoc.id)
				.update({
					descuentos: [...descActuales, ...DESCUENTO_GF],
					actualizadoEn: FieldValue.serverTimestamp(),
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
						const inscripcionId = `MP_${paymentId}`;

						// ── 0. Idempotencia: Si la inscripción ya existe, ignorar el webhook duplicado ──
						const inscripcionExistente = await adminDb
							.collection("Inscripciones")
							.doc(inscripcionId)
							.get();

						if (inscripcionExistente.exists) {
							console.log(
								`⚠️ WEBHOOK DUPLICADO IGNORADO: La inscripción ${inscripcionId} ya existe. Saltando procesamiento.`,
							);
							return NextResponse.json({ success: true, skipped: true }, { status: 200 });
						}

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

						await adminDb
							.collection("Inscripciones")
							.doc(inscripcionId)
							.set(nuevaInscripcion);

						console.log("✅ INSCRIPCIÓN GUARDADA:", inscripcionId);

						// ── 2. Agregar el curso al array del alumno ───────────────────
						const alumnoTipo: "adulto" | "menor" =
							metadata.tipo_alumno === "Titular" ? "adulto" : "menor";

						try {
							if (alumnoTipo === "adulto") {
								await adminDb
									.collection("Users")
									.doc(metadata.user_id)
									.update({
										cursos: FieldValue.arrayUnion(metadata.curso_id),
									});
								console.log(
									`✅ CURSO ${metadata.curso_id} AGREGADO AL TITULAR`,
								);
							} else {
								await adminDb
									.collection("Hijos")
									.doc(metadata.alumno_id)
									.update({
										cursos: FieldValue.arrayUnion(metadata.curso_id),
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
							const cursoSnap = await adminDb
								.collection("Cursos")
								.doc(metadata.curso_id)
								.get();

							if (!cursoSnap.exists) {
								console.error(
									`❌ No se encontró el curso ${metadata.curso_id} para crear la cuota.`,
								);
							} else {
								const cursoData = cursoSnap.data();
								const cuota1a10: number = cursoData?.cuota1a10 ?? 0;
								const cuota11enAdelante: number =
									cursoData?.cuota11enAdelante ?? 0;
								const finMes: number = cursoData?.finMes ?? 12;

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

								// ── 4a. Cuota del mes actual (ID determinista para evitar duplicados)
								const cuotaMes1Id = `CUOTA_${inscripcionId}_MES1`;
								await adminDb.collection("Cuotas").doc(cuotaMes1Id).set({
									...datosComunesAlumno,
									mes: hoy.getMonth() + 1,
									anio: hoy.getFullYear(),
									esPrimerMes: true,
									montoPrimerMes,
									creadoEn: FieldValue.serverTimestamp(),
									actualizadoEn: FieldValue.serverTimestamp(),
								});
								console.log(
									`✅ PRIMERA CUOTA CREADA — ${metadata.alumno_nombre} | ${metadata.curso_nombre} | Monto: $${montoPrimerMes}${grupoFamiliarAplica ? " (con 10% Grupo Familiar)" : ""}`,
								);

								// ── 4b. Mes siguiente si dia >= 20 (ID determinista para evitar duplicados)
								if (dia >= 20) {
									const fechaSiguiente = new Date(
										hoy.getFullYear(),
										hoy.getMonth() + 1,
										1,
									);
									const mesSiguiente = fechaSiguiente.getMonth() + 1;
									const anioSiguiente = fechaSiguiente.getFullYear();

									if (mesSiguiente <= finMes) {
										const cuotaMes2Id = `CUOTA_${inscripcionId}_MES2`;
										await adminDb.collection("Cuotas").doc(cuotaMes2Id).set({
											...datosComunesAlumno,
											mes: mesSiguiente,
											anio: anioSiguiente,
											esPrimerMes: false,
											montoPrimerMes: null,
											creadoEn: FieldValue.serverTimestamp(),
											actualizadoEn: FieldValue.serverTimestamp(),
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
							const userSnap = await adminDb
								.collection("Users")
								.doc(metadata.user_id)
								.get();

							if (userSnap.exists && userSnap.data()?.email) {
								emailDestino = userSnap.data()?.email;
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
