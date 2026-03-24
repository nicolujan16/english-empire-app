import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Descuento {
	porcentaje: number;
	detalle: string;
}

interface AlumnoConCursos {
	alumnoId: string;
	alumnoNombre: string;
	alumnoDni: string;
	alumnoTipo: "adulto" | "menor";
	tutorId: string;
	cursoIds: string[];
	etiquetaIds: string[]; // ← IDs de etiquetas asignadas al alumno
}

interface CuotaACrear {
	ref: FirebaseFirestore.DocumentReference;
	data: Record<string, unknown>;
	tutorId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lógica central
// ─────────────────────────────────────────────────────────────────────────────

async function generarCuotasMensuales(
	mesOverride?: number,
	anioOverride?: number,
): Promise<{ creadas: number; omitidas: number; errores: number }> {
	const hoy = new Date();

	let mesNormalizado: number;
	let anioSiguiente: number;

	if (mesOverride && anioOverride) {
		mesNormalizado = mesOverride;
		anioSiguiente = anioOverride;
		logger.info(
			`🧪 MODO TEST — Generando cuotas para ${mesNormalizado}/${anioSiguiente}`,
		);
	} else {
		const mesSiguiente = hoy.getMonth() + 2;
		anioSiguiente =
			mesSiguiente > 12 ? hoy.getFullYear() + 1 : hoy.getFullYear();
		mesNormalizado = mesSiguiente > 12 ? 1 : mesSiguiente;
		logger.info(
			`🗓️ Iniciando creación de cuotas para ${mesNormalizado}/${anioSiguiente}`,
		);
	}

	let omitidas = 0;
	let errores = 0;

	// ── FASE 1: Recolectar todos los alumnos con cursos activos ──────────────
	// También leemos "etiquetas" de cada doc.

	const alumnosConCursos: AlumnoConCursos[] = [];

	const usersSnap = await db.collection("Users").get();
	for (const userDoc of usersSnap.docs) {
		const data = userDoc.data();
		const cursoIds: string[] = data.cursos ?? [];
		if (cursoIds.length === 0) continue;

		alumnosConCursos.push({
			alumnoId: userDoc.id,
			alumnoNombre: `${data.nombre} ${data.apellido}`,
			alumnoDni: data.dni ?? "",
			alumnoTipo: "adulto",
			tutorId: userDoc.id,
			cursoIds,
			etiquetaIds: data.etiquetas ?? [],
		});
	}

	const hijosSnap = await db.collection("Hijos").get();
	for (const hijoDoc of hijosSnap.docs) {
		const data = hijoDoc.data();
		const cursoIds: string[] = data.cursos ?? [];
		if (cursoIds.length === 0) continue;

		alumnosConCursos.push({
			alumnoId: hijoDoc.id,
			alumnoNombre: `${data.nombre} ${data.apellido}`,
			alumnoDni: data.dni ?? "",
			alumnoTipo: "menor",
			tutorId: data.tutorId ?? hijoDoc.id,
			cursoIds,
			etiquetaIds: data.etiquetas ?? [],
		});
	}

	if (alumnosConCursos.length === 0) {
		logger.info("ℹ️ No hay alumnos con cursos activos. Nada que hacer.");
		return { creadas: 0, omitidas: 0, errores: 0 };
	}

	logger.info(`👥 Alumnos con cursos activos: ${alumnosConCursos.length}`);

	// ── FASE 2: Detectar grupos familiares ────────────────────────────────────

	const miembrosPorTutor = new Map<string, number>();
	for (const alumno of alumnosConCursos) {
		miembrosPorTutor.set(
			alumno.tutorId,
			(miembrosPorTutor.get(alumno.tutorId) ?? 0) + 1,
		);
	}

	const descuentoGrupoFamiliar: Descuento = {
		porcentaje: 10,
		detalle: "Grupo Familiar",
	};

	const gruposFamiliaresConDescuento = [...miembrosPorTutor.entries()]
		.filter(([, count]) => count >= 2)
		.map(([tutorId]) => tutorId);

	if (gruposFamiliaresConDescuento.length > 0) {
		logger.info(
			`👨‍👩‍👧 Grupos familiares con descuento (${gruposFamiliaresConDescuento.length}): ${gruposFamiliaresConDescuento.join(", ")}`,
		);
	}

	// ── FASE 2b: Cargar etiquetas activas con descuentoCuota ─────────────────
	// Una sola lectura para toda la ejecución — se cachea en un Map.

	const etiquetasMap = new Map<
		string,
		{ nombre: string; descuentoCuota: number }
	>();

	const etiquetasSnap = await db
		.collection("EtiquetasDescuento")
		.where("activa", "==", true)
		.get();

	for (const etDoc of etiquetasSnap.docs) {
		const data = etDoc.data();
		const descuentoCuota: number = data.descuentoCuota ?? 0;
		// Solo nos interesan etiquetas que tengan descuento en cuota
		if (descuentoCuota > 0) {
			etiquetasMap.set(etDoc.id, {
				nombre: data.nombre ?? etDoc.id,
				descuentoCuota,
			});
		}
	}

	logger.info(
		`🏷️ Etiquetas activas con descuento en cuota: ${etiquetasMap.size}`,
	);

	// ── FASE 3: Armar cuotas a crear ──────────────────────────────────────────

	const cursosCache = new Map<string, FirebaseFirestore.DocumentData>();
	const cuotasACrear: CuotaACrear[] = [];

	for (const alumno of alumnosConCursos) {
		// Descuentos por etiquetas del alumno
		// Schema: { detalle: nombre de la etiqueta, porcentaje: descuentoCuota }
		const descuentosPorEtiqueta: Descuento[] = alumno.etiquetaIds
			.filter((id) => etiquetasMap.has(id))
			.map((id) => {
				const et = etiquetasMap.get(id)!;
				return {
					detalle: et.nombre,
					porcentaje: et.descuentoCuota,
				};
			});

		// Descuento Grupo Familiar (si aplica)
		const tieneDescuentoGF = (miembrosPorTutor.get(alumno.tutorId) ?? 0) >= 2;

		// Array final: todos los descuentos que aplican al alumno.
		// Al momento de cobrar, el frontend y la API eligen el de mayor porcentaje.
		const descuentosDelAlumno: Descuento[] = [
			...descuentosPorEtiqueta,
			...(tieneDescuentoGF ? [descuentoGrupoFamiliar] : []),
		];

		for (const cursoId of alumno.cursoIds) {
			try {
				// Idempotencia: alumnoId + cursoId + mes + anio
				const cuotaExistente = await db
					.collection("Cuotas")
					.where("alumnoId", "==", alumno.alumnoId)
					.where("cursoId", "==", cursoId)
					.where("mes", "==", mesNormalizado)
					.where("anio", "==", anioSiguiente)
					.limit(1)
					.get();

				if (!cuotaExistente.empty) {
					omitidas++;
					continue;
				}

				// Caché de cursos
				let cursoData: FirebaseFirestore.DocumentData;
				if (cursosCache.has(cursoId)) {
					cursoData = cursosCache.get(cursoId)!;
				} else {
					const cursoSnap = await db.collection("Cursos").doc(cursoId).get();
					if (!cursoSnap.exists) {
						logger.warn(`⚠️ Curso ${cursoId} no encontrado. Omitida.`);
						omitidas++;
						continue;
					}
					cursoData = cursoSnap.data()!;
					cursosCache.set(cursoId, cursoData);
				}

				if (!cursoData.active) {
					omitidas++;
					continue;
				}

				const finMes: number = cursoData.finMes ?? 12;
				const mesInicioCobro: number =
					cursoData.mesInicioCobro ?? cursoData.inicioMes ?? 3;

				if (mesNormalizado > finMes || mesNormalizado < mesInicioCobro) {
					logger.info(
						`⏭️ Mes ${mesNormalizado} fuera del rango (${mesInicioCobro}-${finMes}) para curso ${cursoId}. Omitida.`,
					);
					omitidas++;
					continue;
				}

				const cuota1a10: number = cursoData.cuota1a10 ?? 0;
				const cuota11enAdelante: number = cursoData.cuota11enAdelante ?? 0;

				cuotasACrear.push({
					ref: db.collection("Cuotas").doc(),
					tutorId: alumno.tutorId,
					data: {
						alumnoId: alumno.alumnoId,
						alumnoTipo: alumno.alumnoTipo,
						alumnoNombre: alumno.alumnoNombre,
						alumnoDni: alumno.alumnoDni,
						cursoId,
						cursoNombre: cursoData.nombre ?? cursoId,
						mes: mesNormalizado,
						anio: anioSiguiente,
						cuota1a10,
						cuota11enAdelante,
						esPrimerMes: false,
						montoPrimerMes: null,
						estado: "Pendiente",
						fechaPago: null,
						montoPagado: null,
						metodoPago: null,
						descuentos: descuentosDelAlumno,
						creadoEn: admin.firestore.FieldValue.serverTimestamp(),
						actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
					},
				});
			} catch (error) {
				logger.error(
					`❌ Error procesando alumno ${alumno.alumnoId} / curso ${cursoId}:`,
					error,
				);
				errores++;
			}
		}
	}

	// ── FASE 4: Escribir en batch ─────────────────────────────────────────────

	let batch = db.batch();
	let operacionesEnBatch = 0;
	let creadas = 0;

	for (const { ref, data } of cuotasACrear) {
		batch.set(ref, data);
		operacionesEnBatch++;
		creadas++;

		if (operacionesEnBatch === 490) {
			await batch.commit();
			batch = db.batch();
			operacionesEnBatch = 0;
		}
	}

	if (operacionesEnBatch > 0) {
		await batch.commit();
	}

	logger.info(
		`📊 Resumen: ${creadas} creadas | ${omitidas} omitidas | ${errores} errores`,
	);
	return { creadas, omitidas, errores };
}

// ─── Trigger programado (producción) ─────────────────────────────────────────

export const crearCuotasMensuales = onSchedule(
	{
		schedule: "0 8 20 * *",
		timeZone: "America/Argentina/Buenos_Aires",
		region: "southamerica-east1",
	},
	async () => {
		await generarCuotasMensuales();
	},
);

// ─── Trigger HTTP (testing) ───────────────────────────────────────────────────

export const testCrearCuotas = onRequest(
	{ region: "southamerica-east1" },
	async (req, res) => {
		const mesParam = req.query.mes
			? parseInt(req.query.mes as string)
			: undefined;
		const anioParam = req.query.anio
			? parseInt(req.query.anio as string)
			: undefined;

		if (mesParam && (mesParam < 1 || mesParam > 12)) {
			res
				.status(400)
				.json({ error: "El parámetro 'mes' debe ser entre 1 y 12." });
			return;
		}

		try {
			const resultado = await generarCuotasMensuales(mesParam, anioParam);
			res.status(200).json({
				ok: true,
				mes: mesParam ?? "calculado automáticamente",
				anio: anioParam ?? "calculado automáticamente",
				...resultado,
			});
		} catch (error) {
			logger.error("❌ Error en testCrearCuotas:", error);
			res.status(500).json({ ok: false, error: String(error) });
		}
	},
);
