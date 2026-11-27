/**
 * Fichaje de un toque de llavero (solo servidor, lo usa POST /api/fichar).
 *
 * Toda lectura de un llavero deja una `Fichada` (Fichadas/{idLocal}), sin
 * excepción. El idLocal lo genera la aplicación de escritorio: si reenvía el mismo
 * toque (por ejemplo, después de estar sin conexión) se devuelve la misma respuesta
 * sin registrar nada dos veces.
 *
 * - Llavero desconocido: se registra solo (Llaveros/{UID}, sin asignar). Si tiene
 *   grabado un número cargado de antemano (Llaveros/num-101…), se vincula: pasa a
 *   Llaveros/{UID} con su asignación y se borra el pendiente.
 * - Secretaria: un toque alterna entrada y salida (Jornadas). Si quedó abierta una
 *   entrada de otro día, esa queda "sin salida" y el toque es una entrada nueva.
 *   Una secretaria que también es profesora (mismo id en Teachers) ficha como
 *   secretaria: sus clases cuentan como dadas si estaba en su turno (calendario.ts).
 * - Profesora: un toque registra todas las clases de su bloque (ClasesDictadas, ver
 *   bloques.ts). Solo cuentan las clases de los días que da ella (titulares.ts): la
 *   clase de un día de otra profesora queda "sin clase" y el director la asigna como
 *   reemplazo. Si la clase cae en un día especial se registra igual y se avisa.
 * - Antirrebote: toques de la misma persona dentro de los 60 s no cuentan.
 */
import { FieldValue, Timestamp, type DocumentData, type DocumentReference, type DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { REGLAS_FICHADA, aHHMM, aMinutos, agruparBloques, decidirToque, type Bloque, type ClaseProgramada } from "../bloques";
import { interpretarHorarios, vigenciaDelCurso } from "../cursosInstituto";
import { fechaAR, formatMinutos, horaAR, minutosEntre, diaSemanaDeFecha } from "../fechas";
import { combinarDiasEspeciales, diasQueAplican } from "../feriados";
import { idClaseDictada, idLlaveroPendiente, type DiaEspecial } from "../tipos";
import { leerDiasAsignados } from "../titulares";
import { normalizarUid } from "../uid";
import type { DispositivoAutenticado } from "./autenticacion";

// ─── Tipos del pedido y la respuesta (los usa también la aplicación de escritorio) ──

export interface PedidoFichada {
	/** uuid que genera la computadora para este toque (hace el pedido idempotente) */
	idLocal: string;
	/** UID de fábrica del llavero, en cualquier formato ("04:A2:3B…") */
	uid: string;
	/** Número grabado en el llavero ("101"), si se pudo leer */
	numero: string | null;
	/** Hora de la computadora al leer el llavero */
	horaDispositivo: Date | null;
	/** true si el toque se guardó sin conexión y se envía después */
	offline: boolean;
}

type Cargo = "Secretaria" | "Profesora";
interface Base {
	nombre: string;
	cargo: Cargo;
	hora: string; // "HH:MM"
	llavero: string | null; // número del llavero
}

export type RespuestaFichada =
	| (Base & { ok: true; tipo: "entrada"; mensaje: string | null })
	| (Base & { ok: true; tipo: "salida"; duracion: string })
	| (Base & {
			ok: true;
			tipo: "clase";
			clases: { curso: string; inicio: string; fin: string }[];
			/** Hasta cuándo está (la salida es automática al terminar el bloque) */
			hasta: string;
			minutosTarde: number;
			diaEspecial: string | null;
	  })
	| (Base & { ok: true; tipo: "sin_clase"; mensaje: string })
	| (Base & { ok: true; tipo: "ya_registrado"; mensaje: string })
	| {
			ok: false;
			motivo: "llavero_desconocido" | "llavero_baja" | "personal_inactivo";
			mensaje: string;
			hora: string;
			llavero: string | null;
			nombre: string | null;
	  };

// ─── Datos de apoyo (fuera de la transacción) ─────────────────────────────────

const COL = {
	fichadas: "Fichadas",
	llaveros: "Llaveros",
	personal: "Personal",
	teachers: "Teachers",
	jornadas: "Jornadas",
	clases: "ClasesDictadas",
	cursos: "Cursos",
	diasEspeciales: "DiasEspeciales",
};

const nombreDe = (d: DocumentData) => `${d.nombre ?? ""} ${d.apellido ?? ""}`.trim();

/**
 * Clases de hoy de los cursos de la profesora (activos y vigentes) que da ella ese
 * día de la semana, en bloques. `titularIds` son las titulares de ese día.
 */
async function bloquesDelDia(profesoraId: string, cursoIds: string[], fecha: string): Promise<Bloque[]> {
	if (cursoIds.length === 0) return [];
	const dia = diaSemanaDeFecha(fecha);
	const anio = Number(fecha.slice(0, 4));
	const snaps = await adminDb.getAll(...cursoIds.map((id) => adminDb.collection(COL.cursos).doc(id)));
	const clases: ClaseProgramada[] = [];
	for (const s of snaps) {
		const d = s.data();
		if (!s.exists || !d || (d.active ?? d.activo) === false) continue;
		// Vigencia por meses: se prueba el año del toque y el anterior (cursos que cruzan de año)
		const vigente = [anio, anio - 1].some((a) => {
			const v = vigenciaDelCurso(d, a);
			return v.fechaInicio <= fecha && fecha <= v.fechaFin;
		});
		if (!vigente) continue;
		const deHoy = interpretarHorarios(d.horarios).horarios.filter((h) => h.dia === dia);
		if (deHoy.length === 0) continue;
		const profesoras = await adminDb
			.collection(COL.teachers)
			.where("cursosAsignados", "array-contains", s.id)
			.get();
		// Titulares de hoy: sin días cargados para el curso (null) = todos los días
		const titularIds = profesoras.docs
			.filter((t) => {
				const dias = leerDiasAsignados(t.data().diasAsignados, s.id);
				return dias === null || dias.includes(dia);
			})
			.map((t) => t.id);
		if (!titularIds.includes(profesoraId)) continue;
		deHoy.forEach((h) =>
			clases.push({
				cursoId: s.id,
				cursoNombre: String(d.nombre ?? ""),
				inicio: h.inicio,
				fin: h.fin,
				titularIds,
			}),
		);
	}
	return agruparBloques(clases);
}

/** Días especiales que aplican entre dos fechas (guardados + feriados predeterminados) */
export async function diasEspecialesEntre(desde: string, hasta: string): Promise<DiaEspecial[]> {
	const snap = await adminDb
		.collection(COL.diasEspeciales)
		.where("fecha", ">=", desde)
		.where("fecha", "<=", hasta)
		.get();
	const guardados: DiaEspecial[] = snap.docs.map((doc) => {
		const d = doc.data();
		return {
			id: doc.id,
			fecha: d.fecha,
			descripcion: d.descripcion ?? "",
			todoElDia: d.todoElDia !== false,
			desde: d.desde ?? null,
			hasta: d.hasta ?? null,
			cursoIds: d.cursoIds ?? [],
			tipo: d.tipo === "feriado" ? "feriado" : "instituto",
			cerrado: d.cerrado === true,
			sinClases: d.sinClases !== false,
			adherido: d.adherido !== false,
			predeterminado: d.predeterminado === true,
		};
	});
	return diasQueAplican(combinarDiasEspeciales(guardados, desde, hasta));
}

const diasEspecialesDe = (fecha: string) => diasEspecialesEntre(fecha, fecha);

/** Misma regla que el calendario (diaEspecialQueExcluye): la clase no cuenta ese día */
export const diaQueExcluye = (
	c: Pick<ClaseProgramada, "cursoId" | "inicio" | "fin">,
	fecha: string,
	dias: DiaEspecial[],
) =>
	dias.find(
		(d) =>
			d.fecha === fecha &&
			d.sinClases &&
			(d.cursoIds.length === 0 || d.cursoIds.includes(c.cursoId)) &&
			(d.todoElDia || (!!d.desde && !!d.hasta && c.inicio < d.hasta && c.fin > d.desde)),
	) ?? null;

// ─── Fichaje ──────────────────────────────────────────────────────────────────

export class ErrorReintentable extends Error {}

export async function procesarFichada(
	p: PedidoFichada,
	dispositivo: DispositivoAutenticado,
): Promise<RespuestaFichada> {
	const uid = normalizarUid(p.uid);
	const numero = p.numero?.trim() || null;
	const fRef = adminDb.collection(COL.fichadas).doc(p.idLocal);

	// Reenvío del mismo toque: misma respuesta, sin registrar nada de nuevo
	const previa = await fRef.get();
	if (previa.exists && previa.data()?.respuesta) return previa.data()!.respuesta as RespuestaFichada;

	const horaServidor = new Date();
	const horaEfectiva = p.offline && p.horaDispositivo ? p.horaDispositivo : horaServidor;
	const revisarHora =
		p.offline &&
		!!p.horaDispositivo &&
		(horaServidor.getTime() - p.horaDispositivo.getTime() > REGLAS_FICHADA.offlineMaxHoras * 3_600_000 ||
			p.horaDispositivo.getTime() - horaServidor.getTime() > 5 * 60_000);
	const fecha = fechaAR(horaEfectiva);
	const hora = horaAR(horaEfectiva);
	const minutos = aMinutos(hora);

	// De quién es el llavero (antes de la transacción, para preparar las clases si es profesora)
	const llPrevio = await adminDb.collection(COL.llaveros).doc(uid).get();
	let personalIdPrevio: string | null = llPrevio.exists ? (llPrevio.data()?.personalId ?? null) : null;
	if (!llPrevio.exists && numero) {
		const ph = await adminDb.collection(COL.llaveros).doc(idLlaveroPendiente(numero)).get();
		if (ph.exists && ph.data()?.pendienteDeLectura === true) personalIdPrevio = ph.data()?.personalId ?? null;
	}
	let bloques: Bloque[] = [];
	let diasEspeciales: DiaEspecial[] = [];
	if (personalIdPrevio) {
		const teacher = await adminDb.collection(COL.teachers).doc(personalIdPrevio).get();
		if (teacher.exists) {
			const cursos: string[] = Array.isArray(teacher.data()?.cursosAsignados) ? teacher.data()!.cursosAsignados : [];
			[bloques, diasEspeciales] = await Promise.all([
				bloquesDelDia(personalIdPrevio, cursos, fecha),
				diasEspecialesDe(fecha),
			]);
		}
	}

	return adminDb.runTransaction(async (tx) => {
		// ── Lecturas (todas antes de escribir) ──
		const fSnap = await tx.get(fRef);
		if (fSnap.exists && fSnap.data()?.respuesta) return fSnap.data()!.respuesta as RespuestaFichada;

		const llRef = adminDb.collection(COL.llaveros).doc(uid);
		const llSnap = await tx.get(llRef);
		let phRef: DocumentReference | null = null;
		let pendiente: DocumentSnapshot | null = null;
		if (!llSnap.exists && numero) {
			phRef = adminDb.collection(COL.llaveros).doc(idLlaveroPendiente(numero));
			const ph = await tx.get(phRef);
			if (ph.exists && ph.data()?.pendienteDeLectura === true) pendiente = ph;
		}
		const llData = llSnap.exists ? llSnap.data()! : (pendiente?.data() ?? null);
		const estadoLlavero: string = llData?.estado ?? "SinAsignar";
		const personalId: string | null = estadoLlavero === "Baja" ? null : (llData?.personalId ?? null);

		let personaRef: DocumentReference | null = null;
		let persona: DocumentData | null = null;
		let rol: "secretaria" | "profesora" | null = null;
		if (personalId) {
			const pRef = adminDb.collection(COL.personal).doc(personalId);
			const pSnap = await tx.get(pRef);
			if (pSnap.exists) {
				personaRef = pRef;
				persona = pSnap.data()!;
				rol = "secretaria";
			} else {
				const tRef = adminDb.collection(COL.teachers).doc(personalId);
				const tSnap = await tx.get(tRef);
				if (tSnap.exists) {
					personaRef = tRef;
					persona = tSnap.data()!;
					rol = "profesora";
				}
			}
		}

		let abiertaRef: DocumentReference | null = null;
		let abierta: DocumentData | null = null;
		if (rol === "secretaria" && persona?.jornadaAbiertaId) {
			abiertaRef = adminDb.collection(COL.jornadas).doc(String(persona.jornadaAbiertaId));
			const a = await tx.get(abiertaRef);
			abierta = a.exists ? a.data()! : null;
		}

		const dictadas = new Map<string, DocumentSnapshot>();
		if (rol === "profesora") {
			// El llavero cambió de dueña entre la preparación y la transacción: que reintente
			if (personalId !== personalIdPrevio) throw new ErrorReintentable("El llavero cambió de dueña");
			const refs = bloques.flatMap((b) =>
				b.clases.map((c) => adminDb.collection(COL.clases).doc(idClaseDictada(c.cursoId, fecha, c.inicio))),
			);
			if (refs.length > 0) (await tx.getAll(...refs)).forEach((s) => dictadas.set(s.id, s));
		}

		// ── Escrituras ──
		const ahora = FieldValue.serverTimestamp();
		const ts = Timestamp.fromDate(horaEfectiva);
		const llaveroNumero: string | null = numero ?? llData?.numero ?? null;
		const personaUpd: Record<string, unknown> = {};

		// Llavero: vincular el pendiente, registrar uno nuevo o anotar el uso
		if (!llSnap.exists) {
			if (pendiente && phRef) {
				const pd = pendiente.data()!;
				tx.set(llRef, {
					numero: pd.numero ?? numero,
					personalId: pd.personalId ?? null,
					estado: pd.estado ?? "SinAsignar",
					creadoEn: pd.creadoEn ?? ahora,
					ultimoUsoEn: ts,
					vinculadoEn: ahora,
					vinculadoDesde: phRef.id,
				});
				tx.delete(phRef);
				if (persona && persona.llaveroUid === phRef.id) personaUpd.llaveroUid = uid;
			} else {
				tx.set(llRef, {
					numero,
					personalId: null,
					estado: "SinAsignar",
					creadoEn: ahora,
					ultimoUsoEn: ts,
				});
			}
		} else {
			tx.update(llRef, {
				ultimoUsoEn: ts,
				...(numero && llData?.numero !== numero ? { numero } : {}),
			});
		}

		const nombre = persona ? nombreDe(persona) : null;
		const cargo: Cargo = rol === "profesora" ? "Profesora" : "Secretaria";
		const base = { nombre: nombre ?? "", cargo, hora, llavero: llaveroNumero };
		let respuesta: RespuestaFichada;
		let resultado: string;
		let jornadaId: string | null = null;
		let claseDictadaId: string | null = null;

		const rechazo = (
			motivo: "llavero_desconocido" | "llavero_baja" | "personal_inactivo",
			mensaje: string,
		): RespuestaFichada => ({ ok: false, motivo, mensaje, hora, llavero: llaveroNumero, nombre });

		const ultima: Date | null = persona?.ultimaFichadaEn?.toDate?.() ?? null;
		const rebote =
			!!ultima &&
			horaEfectiva.getTime() - ultima.getTime() >= 0 &&
			horaEfectiva.getTime() - ultima.getTime() < REGLAS_FICHADA.antirreboteSegundos * 1000;

		if (estadoLlavero === "Baja") {
			resultado = "llavero_baja";
			respuesta = rechazo("llavero_baja", "Este llavero está dado de baja. Avisale al director.");
		} else if (!personalId || !persona || !rol) {
			resultado = "llavero_desconocido";
			respuesta = rechazo("llavero_desconocido", "Este llavero todavía no está asignado a nadie.");
		} else if (persona.activo === false) {
			resultado = "personal_inactivo";
			respuesta = rechazo("personal_inactivo", "Esta persona está dada de baja en el sistema.");
		} else if (rebote) {
			resultado = "ya_registrado";
			respuesta = { ...base, ok: true, tipo: "ya_registrado", mensaje: "Ya registramos tu toque hace un momento." };
		} else if (rol === "secretaria") {
			// ── Secretaria: entrada / salida ──
			const abiertaValida = !!abierta && abierta.estado === "Activa" && !abierta.salida;
			const entradaAbierta: Date | null = abiertaValida ? abierta!.entrada.toDate() : null;
			if (abiertaValida && abierta!.fecha === fecha && entradaAbierta! < horaEfectiva) {
				const mins = minutosEntre(entradaAbierta!, horaEfectiva);
				tx.update(abiertaRef!, {
					salida: ts,
					minutos: mins,
					incompleta: false,
					fichadaSalidaId: p.idLocal,
					actualizadoEn: ahora,
				});
				jornadaId = abiertaRef!.id;
				personaUpd.jornadaAbiertaId = null;
				resultado = "salida";
				respuesta = { ...base, ok: true, tipo: "salida", duracion: formatMinutos(mins) };
			} else {
				// Una entrada de otro día sin salida queda para revisar
				if (abiertaValida) tx.update(abiertaRef!, { incompleta: true, actualizadoEn: ahora });
				const nueva = adminDb.collection(COL.jornadas).doc();
				tx.set(nueva, {
					personalId,
					personalNombre: nombre,
					fecha,
					entrada: ts,
					salida: null,
					minutos: null,
					incompleta: false,
					estado: "Activa",
					origen: "fichada",
					fueOffline: p.offline,
					fichadaEntradaId: p.idLocal,
					fichadaSalidaId: null,
					historial: [],
					creadoEn: ahora,
					actualizadoEn: ahora,
				});
				jornadaId = nueva.id;
				personaUpd.jornadaAbiertaId = nueva.id;
				resultado = "entrada";
				respuesta = {
					...base,
					ok: true,
					tipo: "entrada",
					mensaje: abiertaValida
						? "La jornada anterior quedó sin salida: el director la va a revisar."
						: null,
				};
			}
			personaUpd.ultimaFichadaEn = ts;
		} else {
			// ── Profesora: bloque de clases ──
			const registrado = (b: Bloque) =>
				b.clases.some((c) => {
					const s = dictadas.get(idClaseDictada(c.cursoId, fecha, c.inicio));
					return !!s?.exists && s.data()?.estado === "Activa";
				});
			const dec = decidirToque(bloques, registrado, minutos);
			if (dec.accion === "entrada") {
				const b = dec.bloque;
				const tarde = Math.max(0, minutos - b.inicio);
				b.clases.forEach((c, i) => {
					const id = idClaseDictada(c.cursoId, fecha, c.inicio);
					const ref = adminDb.collection(COL.clases).doc(id);
					const datos = {
						cursoId: c.cursoId,
						cursoNombre: c.cursoNombre,
						fecha,
						horaInicio: c.inicio,
						horaFin: c.fin,
						profesoraDictoId: personalId,
						profesoraDictoNombre: nombre,
						esReemplazo: !c.titularIds.includes(personalId),
						titularIds: c.titularIds,
						llegada: ts,
						minutosTarde: i === 0 ? tarde : 0,
						estado: "Activa",
						contarIgual: false,
						origen: "fichada",
						fueOffline: p.offline,
						fichadaId: p.idLocal,
						actualizadoEn: ahora,
					};
					if (dictadas.get(id)?.exists) {
						// Estaba anulada: se reactiva conservando su historial
						tx.update(ref, {
							...datos,
							historial: FieldValue.arrayUnion({
								campo: "estado",
								antes: "Anulada",
								despues: "Activa",
								motivo: "Fichó con su llavero",
								por: "aplicacion-escritorio",
								en: Timestamp.now(),
							}),
						});
					} else tx.set(ref, { ...datos, historial: [], creadoEn: ahora });
				});
				claseDictadaId = idClaseDictada(b.clases[0].cursoId, fecha, b.clases[0].inicio);
				personaUpd.ultimaFichadaEn = ts;
				const excluida = b.clases.map((c) => diaQueExcluye(c, fecha, diasEspeciales)).find(Boolean);
				resultado = "clase";
				respuesta = {
					...base,
					ok: true,
					tipo: "clase",
					clases: b.clases.map((c) => ({ curso: c.cursoNombre, inicio: c.inicio, fin: c.fin })),
					hasta: aHHMM(b.fin),
					minutosTarde: tarde,
					diaEspecial: excluida ? excluida.descripcion : null,
				};
			} else if (dec.accion === "ya_registrado") {
				resultado = "ya_registrado";
				respuesta = {
					...base,
					ok: true,
					tipo: "ya_registrado",
					mensaje: dec.terminado
						? `Tu salida ya se registró sola a las ${aHHMM(dec.bloque.fin)}. No hace falta fichar al irte.`
						: `Ya registraste tu entrada. La salida se registra sola a las ${aHHMM(dec.bloque.fin)}.`,
				};
			} else {
				resultado = "sin_clase";
				respuesta = {
					...base,
					ok: true,
					tipo: "sin_clase",
					mensaje: dec.proximo
						? `Tu próxima clase es a las ${aHHMM(dec.proximo.inicio)}. Podés fichar desde las ${aHHMM(
								dec.proximo.inicio - REGLAS_FICHADA.anticipoMinutos,
							)}.`
						: "No tenés clases en este horario. Quedó registrado para que el director lo revise.",
				};
			}
		}

		if (personaRef && Object.keys(personaUpd).length > 0)
			tx.update(personaRef, { ...personaUpd, actualizadoEn: ahora });

		// La fichada: siempre, con la respuesta para poder repetirla si se reenvía
		tx.set(fRef, {
			llaveroUid: uid,
			llaveroNumero,
			personalId,
			personalNombre: nombre,
			personalRol: rol,
			resultado,
			fecha,
			horaEfectiva: ts,
			horaServidor: Timestamp.fromDate(horaServidor),
			horaDispositivo: p.horaDispositivo ? Timestamp.fromDate(p.horaDispositivo) : null,
			fueOffline: p.offline,
			revisarHora,
			dispositivoId: dispositivo.id,
			dispositivoNombre: dispositivo.nombre,
			jornadaId,
			claseDictadaId,
			detalle:
				(revisarHora ? "Hora de la computadora fuera de rango: revisar. " : "") +
				("mensaje" in respuesta && respuesta.mensaje ? respuesta.mensaje : ""),
			resuelta: false,
			respuesta,
			creadoEn: ahora,
		});
		return respuesta;
	});
}
