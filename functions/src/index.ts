import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

// ─────────────────────────────────────────────────────────────────────────────
// Lógica central extraída en una función reutilizable.
// Tanto el trigger programado como el HTTP de prueba la llaman.
//
// Parámetros opcionales para testing:
//   - mesOverride:  forzar un mes específico (1-12)
//   - anioOverride: forzar un año específico
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

	const inscripcionesSnap = await db
		.collection("Inscripciones")
		.where("status", "==", "Confirmado")
		.get();

	if (inscripcionesSnap.empty) {
		logger.info("ℹ️ No hay inscripciones confirmadas. Nada que hacer.");
		return { creadas: 0, omitidas: 0, errores: 0 };
	}

	logger.info(
		`📋 Inscripciones confirmadas encontradas: ${inscripcionesSnap.size}`,
	);

	let creadas = 0;
	let omitidas = 0;
	let errores = 0;

	// MEJORA 1: Diccionario (Caché) para no leer el mismo curso 50 veces
	const cursosCache = new Map<string, any>();

	// MEJORA 2: Inicializamos un Batch para escribir en lotes
	let batch = db.batch();
	let operacionesEnBatch = 0;

	for (const inscripcionDoc of inscripcionesSnap.docs) {
		const inscripcion = inscripcionDoc.data();
		const inscripcionId = inscripcionDoc.id;

		try {
			// Idempotencia: saltar si ya existe cuota
			const cuotaExistente = await db
				.collection("Cuotas")
				.where("inscripcionId", "==", inscripcionId)
				.where("mes", "==", mesNormalizado)
				.where("anio", "==", anioSiguiente)
				.limit(1)
				.get();

			if (!cuotaExistente.empty) {
				omitidas++;
				continue;
			}

			// --- SISTEMA DE CACHÉ DE CURSOS ---
			let cursoData;
			if (cursosCache.has(inscripcion.cursoId)) {
				cursoData = cursosCache.get(inscripcion.cursoId); // Lo sacamos de la memoria (Costo $0)
			} else {
				const cursoSnap = await db
					.collection("Cursos")
					.doc(inscripcion.cursoId)
					.get();
				if (!cursoSnap.exists) {
					logger.warn(
						`⚠️ Curso ${inscripcion.cursoId} no encontrado. Omitida.`,
					);
					omitidas++;
					continue;
				}
				cursoData = cursoSnap.data()!;
				cursosCache.set(inscripcion.cursoId, cursoData); // Lo guardamos en memoria para el próximo
			}

			if (!cursoData.active) {
				omitidas++;
				continue;
			}

			const finMes: number = cursoData.finMes ?? 12;
			// MEJORA 3: Verificar también el mesInicioCobro
			const mesInicioCobro: number =
				cursoData.mesInicioCobro ?? cursoData.inicioMes ?? 3;

			if (mesNormalizado > finMes || mesNormalizado < mesInicioCobro) {
				logger.info(
					`⏭️ Mes ${mesNormalizado} está fuera del rango de cobro (${mesInicioCobro} a ${finMes}). Omitida.`,
				);
				omitidas++;
				continue;
			}

			const cuota1a10: number = cursoData.cuota1a10 ?? 0;
			const cuota11enAdelante: number = cursoData.cuota11enAdelante ?? 0;

			const nuevaCuota = {
				inscripcionId,
				alumnoId: inscripcion.alumnoId,
				alumnoTipo: inscripcion.tipoAlumno === "Titular" ? "adulto" : "menor",
				alumnoNombre: inscripcion.alumnoNombre,
				alumnoDni: inscripcion.alumnoDni,
				cursoId: inscripcion.cursoId,
				cursoNombre: inscripcion.cursoNombre,
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
				creadoEn: admin.firestore.FieldValue.serverTimestamp(),
				actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
			};

			// Agregamos la operación al lote en lugar de escribirla directo
			const nuevaCuotaRef = db.collection("Cuotas").doc();
			batch.set(nuevaCuotaRef, nuevaCuota);
			operacionesEnBatch++;
			creadas++;

			// Firebase permite máximo 500 operaciones por batch. Si llegamos, commiteamos y abrimos otro.
			if (operacionesEnBatch === 490) {
				await batch.commit();
				batch = db.batch(); // Reiniciamos el batch
				operacionesEnBatch = 0;
			}
		} catch (error) {
			logger.error(`❌ Error procesando inscripción ${inscripcionId}:`, error);
			errores++;
		}
	}

	// Commiteamos cualquier operación restante en el último batch
	if (operacionesEnBatch > 0) {
		await batch.commit();
	}

	logger.info(
		`📊 Resumen: ${creadas} creadas | ${omitidas} omitidas | ${errores} errores`,
	);
	return { creadas, omitidas, errores };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCCIÓN — Se ejecuta el día 20 de cada mes a las 08:00 AR
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// TESTING — Trigger HTTP para disparar manualmente desde el navegador o Postman
//
// ⚠️  BORRAR ANTES DE IR A PRODUCCIÓN REAL (o proteger con autenticación)
//
// Uso:
//   GET  /testCrearCuotas              → genera para el mes siguiente real
//   GET  /testCrearCuotas?mes=4&anio=2026  → genera para el mes/año que quieras
//
// Ejemplo en navegador:
//   https://southamerica-east1-TU_PROJECT_ID.cloudfunctions.net/testCrearCuotas?mes=4&anio=2026
// ─────────────────────────────────────────────────────────────────────────────
export const testCrearCuotas = onRequest(
	{ region: "southamerica-east1" },
	async (req, res) => {
		// Parámetros opcionales por query string: ?mes=4&anio=2026
		const mesParam = req.query.mes
			? parseInt(req.query.mes as string)
			: undefined;
		const anioParam = req.query.anio
			? parseInt(req.query.anio as string)
			: undefined;

		// Validación básica
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
