/**
 * "Lector y llaveros": llaveros, historial del kiosco y correcciones de Juan.
 *
 * Movimientos de secretarias (entradas y salidas): viven en `Jornadas`
 * (entrada + salida). Juan los corrige de a uno:
 * - Agregar una entrada → jornada nueva sin salida.
 * - Agregar una salida → cierra la última jornada de ese día que no tiene salida.
 * - Corregir la hora de una entrada o de una salida.
 * - Anular una entrada → se anula la jornada entera.
 * - Anular una salida → la jornada queda sin salida (no suma horas hasta corregirla).
 * Todo con motivo (historial de la jornada) y en la auditoría.
 *
 * Las Fichadas (registro crudo del kiosco) no se tocan, salvo marcarlas como revisadas.
 */
import {
	Timestamp,
	arrayUnion,
	collection,
	doc,
	getDoc,
	getDocs,
	onSnapshot,
	query,
	serverTimestamp,
	where,
	writeBatch,
	type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { fechaAR, fechaHoraAR, horaAR, minutosEntre } from "./fechas";
import { COL, aClase, aDate, aJornada, auditar, cambio } from "./repositorio";
import { aFichada } from "./repositorioCalendario";
import {
	idLlaveroPendiente,
	nombreCompleto,
	type ClaseDictada,
	type EstadoLlavero,
	type Fichada,
	type Jornada,
	type Llavero,
	type Persona,
} from "./tipos";

// ─── Llaveros ─────────────────────────────────────────────────────────────────

const aLlavero = (uid: string, d: DocumentData): Llavero => ({
	uid,
	numero: typeof d.numero === "string" && d.numero ? d.numero : null,
	personalId: typeof d.personalId === "string" && d.personalId ? d.personalId : null,
	estado: (["SinAsignar", "Asignado", "Baja"] as const).includes(d.estado)
		? (d.estado as EstadoLlavero)
		: "SinAsignar",
	creadoEn: aDate(d.creadoEn),
	ultimoUsoEn: aDate(d.ultimoUsoEn),
	pendienteDeLectura: d.pendienteDeLectura === true,
});

/**
 * TEMPORAL: carga de antemano los llaveros con esos números, sin asignar y
 * pendientes de leer (`Llaveros/num-101`…). Saltea los números que ya existen
 * (pendientes o ya leídos por el lector). Devuelve cuántos creó.
 */
export async function crearLlaverosPendientes(
	numeros: string[],
	existentes: Llavero[],
): Promise<number> {
	const ya = new Set(existentes.map((l) => l.numero).filter(Boolean));
	const nuevos = numeros.filter((n) => !ya.has(n));
	if (nuevos.length === 0) return 0;
	const batch = writeBatch(db);
	nuevos.forEach((numero) =>
		batch.set(doc(db, COL.llaveros, idLlaveroPendiente(numero)), {
			numero,
			personalId: null,
			estado: "SinAsignar",
			pendienteDeLectura: true,
			creadoEn: serverTimestamp(),
			ultimoUsoEn: null,
		}),
	);
	auditar(batch, {
		accion: "crear_llaveros_pendientes",
		coleccion: COL.llaveros,
		docId: nuevos.map(idLlaveroPendiente).join(","),
		detalle: { numeros: nuevos.join(", ") },
	});
	await batch.commit();
	return nuevos.length;
}

/** Por número ("101", "102"…); los sin número al final */
const ordenLlaveros = (a: Llavero, b: Llavero) =>
	a.numero === b.numero
		? a.uid.localeCompare(b.uid)
		: a.numero === null
			? 1
			: b.numero === null
				? -1
				: a.numero.localeCompare(b.numero, "es", { numeric: true });

export function suscribirLlaveros(
	cb: (l: Llavero[]) => void,
	onError: (e: Error) => void,
): () => void {
	return onSnapshot(
		collection(db, COL.llaveros),
		(snap) => cb(snap.docs.map((d) => aLlavero(d.id, d.data())).sort(ordenLlaveros)),
		onError,
	);
}

/** Colección donde vive la persona: secretarias en Personal, profesoras en Teachers */
const colDe = (p: Pick<Persona, "rol">) => (p.rol === "profesora" ? COL.teachers : COL.personal);

/**
 * Asigna el llavero a la persona. Si el llavero era de otra, se le quita; si la
 * persona tenía otro llavero, ese queda libre. Todo junto, en un batch.
 */
export async function asignarLlavero(
	llavero: Llavero,
	persona: Persona,
	personal: Persona[],
): Promise<void> {
	if (llavero.estado === "Baja")
		throw new Error("El llavero está dado de baja: reactivalo antes de asignarlo.");
	if (llavero.personalId === persona.id) return;
	const batch = writeBatch(db);
	const ahora = serverTimestamp();

	// El dueño anterior del llavero se queda sin llavero
	const anterior = llavero.personalId ? personal.find((p) => p.id === llavero.personalId) : null;
	if (anterior)
		batch.update(doc(db, colDe(anterior), anterior.id), { llaveroUid: null, actualizadoEn: ahora });

	// El llavero que tenía la persona queda libre
	if (persona.llaveroUid && persona.llaveroUid !== llavero.uid)
		batch.update(doc(db, COL.llaveros, persona.llaveroUid), {
			personalId: null,
			estado: "SinAsignar",
		});

	batch.update(doc(db, COL.llaveros, llavero.uid), { personalId: persona.id, estado: "Asignado" });
	batch.update(doc(db, colDe(persona), persona.id), { llaveroUid: llavero.uid, actualizadoEn: ahora });
	auditar(batch, {
		accion: "asignar_llavero",
		coleccion: COL.llaveros,
		docId: llavero.uid,
		detalle: {
			numero: llavero.numero,
			personalId: persona.id,
			anteriorPersonalId: anterior?.id ?? null,
		},
	});
	await batch.commit();
}

/** Quita la asignación (y si `baja`, además lo da de baja: sus toques no registran nada) */
export async function liberarLlavero(
	llavero: Llavero,
	personal: Persona[],
	{ baja = false }: { baja?: boolean } = {},
): Promise<void> {
	const batch = writeBatch(db);
	const duenio = llavero.personalId ? personal.find((p) => p.id === llavero.personalId) : null;
	if (duenio && duenio.llaveroUid === llavero.uid)
		batch.update(doc(db, colDe(duenio), duenio.id), {
			llaveroUid: null,
			actualizadoEn: serverTimestamp(),
		});
	batch.update(doc(db, COL.llaveros, llavero.uid), {
		personalId: null,
		estado: baja ? "Baja" : "SinAsignar",
	});
	auditar(batch, {
		accion: baja ? "baja_llavero" : "quitar_llavero",
		coleccion: COL.llaveros,
		docId: llavero.uid,
		detalle: { numero: llavero.numero, personalId: llavero.personalId },
	});
	await batch.commit();
}

export async function reactivarLlavero(llavero: Llavero): Promise<void> {
	const batch = writeBatch(db);
	batch.update(doc(db, COL.llaveros, llavero.uid), { estado: "SinAsignar", personalId: null });
	auditar(batch, {
		accion: "reactivar_llavero",
		coleccion: COL.llaveros,
		docId: llavero.uid,
		detalle: { numero: llavero.numero },
	});
	await batch.commit();
}

// ─── Historial ────────────────────────────────────────────────────────────────

export interface DatosHistorial {
	jornadas: Jornada[];
	clases: ClaseDictada[];
	fichadas: Fichada[];
}

/** Jornadas, clases y fichadas entre dos fechas "YYYY-MM-DD" (inclusive), en vivo */
export function suscribirHistorial(
	desde: string,
	hasta: string,
	cb: (d: DatosHistorial) => void,
	onError: (e: Error) => void,
): () => void {
	const enRango = (col: string) =>
		query(collection(db, col), where("fecha", ">=", desde), where("fecha", "<=", hasta));
	const datos: DatosHistorial = { jornadas: [], clases: [], fichadas: [] };
	const listas = new Set<string>();
	const listo = (parte: string) => {
		listas.add(parte);
		if (listas.size === 3) cb({ ...datos });
	};
	const unsubs = [
		onSnapshot(
			enRango(COL.jornadas),
			(s) => {
				datos.jornadas = s.docs.map((d) => aJornada(d.id, d.data()));
				listo("jornadas");
			},
			onError,
		),
		onSnapshot(
			enRango(COL.clasesDictadas),
			(s) => {
				datos.clases = s.docs.map((d) => aClase(d.id, d.data()));
				listo("clases");
			},
			onError,
		),
		onSnapshot(
			enRango(COL.fichadas),
			(s) => {
				datos.fichadas = s.docs.map((d) => aFichada(d.id, d.data()));
				listo("fichadas");
			},
			onError,
		),
	];
	return () => unsubs.forEach((u) => u());
}

/** Marcar un aviso del kiosco (sin clase, llavero desconocido…) como revisado o no */
export async function marcarFichadaRevisada(fichada: Fichada, resuelta: boolean) {
	const batch = writeBatch(db);
	batch.update(doc(db, COL.fichadas, fichada.id), { resuelta });
	auditar(batch, {
		accion: resuelta ? "fichada_revisada" : "fichada_pendiente",
		coleccion: COL.fichadas,
		docId: fichada.id,
	});
	await batch.commit();
}

// ─── Movimientos de secretarias ──────────────────────────────────────────────

export type TipoMovimiento = "entrada" | "salida";

const minutosDe = (entrada: Date, salida: Date | null) =>
	salida ? minutosEntre(entrada, salida) : null;

/** Agrega una entrada o una salida que el kiosco no registró */
export async function agregarMovimiento(input: {
	persona: Persona;
	tipo: TipoMovimiento;
	fecha: string;
	hora: string; // "HH:MM"
	motivo: string;
}): Promise<void> {
	const { persona, tipo, fecha, hora, motivo } = input;
	if (persona.rol !== "secretaria")
		throw new Error("Las entradas y salidas son de las secretarias.");
	const momento = fechaHoraAR(fecha, hora);
	if (momento > new Date()) throw new Error("No se puede cargar un movimiento en el futuro.");

	// Jornadas de ese día de la persona (pocas: se filtra en el cliente)
	const snap = await getDocs(
		query(collection(db, COL.jornadas), where("personalId", "==", persona.id), where("fecha", "==", fecha)),
	);
	const delDia = snap.docs
		.map((d) => aJornada(d.id, d.data()))
		.filter((j) => j.estado === "Activa");
	const sinSalida = delDia
		.filter((j) => j.salida === null)
		.sort((a, b) => b.entrada.getTime() - a.entrada.getTime());

	const personaRef = doc(db, COL.personal, persona.id);
	const personaSnap = await getDoc(personaRef);
	const abiertaId: string | null = personaSnap.exists()
		? (personaSnap.data().jornadaAbiertaId ?? null)
		: null;
	const esHoy = fecha === fechaAR(new Date());
	const batch = writeBatch(db);

	if (tipo === "entrada") {
		if (sinSalida.length > 0)
			throw new Error(
				`Ese día ya tiene una entrada sin salida (a las ${horaAR(sinSalida[0].entrada)}). Agregá primero esa salida.`,
			);
		const solapada = delDia.find(
			(j) => j.salida !== null && j.entrada <= momento && momento < j.salida,
		);
		if (solapada)
			throw new Error(
				`Esa hora cae dentro de otra jornada (${horaAR(solapada.entrada)}–${horaAR(solapada.salida!)}).`,
			);
		const ref = doc(collection(db, COL.jornadas));
		batch.set(ref, {
			personalId: persona.id,
			personalNombre: nombreCompleto(persona),
			fecha,
			entrada: Timestamp.fromDate(momento),
			salida: null,
			minutos: null,
			// Hoy queda abierta (el próximo toque del llavero es su salida); otro día, a revisar
			incompleta: !esHoy,
			estado: "Activa",
			origen: "manual",
			fueOffline: false,
			historial: [cambio("creacion", null, `Entrada ${hora}`, motivo)],
			creadoEn: serverTimestamp(),
			actualizadoEn: serverTimestamp(),
		});
		if (esHoy && !abiertaId)
			batch.update(personaRef, { jornadaAbiertaId: ref.id, actualizadoEn: serverTimestamp() });
		auditar(batch, {
			accion: "agregar_entrada",
			coleccion: COL.jornadas,
			docId: ref.id,
			motivo,
			detalle: { personalId: persona.id, fecha, hora },
		});
	} else {
		// La salida cierra la última entrada sin salida anterior a esa hora
		const jornada = sinSalida.find((j) => j.entrada < momento);
		if (!jornada)
			throw new Error(
				"No hay una entrada sin salida antes de esa hora. Agregá primero la entrada.",
			);
		batch.update(doc(db, COL.jornadas, jornada.id), {
			salida: Timestamp.fromDate(momento),
			minutos: minutosDe(jornada.entrada, momento),
			incompleta: false,
			historial: arrayUnion(cambio("salida", null, hora, motivo)),
			actualizadoEn: serverTimestamp(),
		});
		if (abiertaId === jornada.id)
			batch.update(personaRef, { jornadaAbiertaId: null, actualizadoEn: serverTimestamp() });
		auditar(batch, {
			accion: "agregar_salida",
			coleccion: COL.jornadas,
			docId: jornada.id,
			motivo,
			detalle: { personalId: persona.id, fecha, hora },
		});
	}
	await batch.commit();
}

/** Corrige la hora de una entrada o de una salida */
export async function corregirMovimiento(
	jornada: Jornada,
	tipo: TipoMovimiento,
	hora: string,
	motivo: string,
): Promise<void> {
	if (jornada.estado !== "Activa") throw new Error("Esta jornada está anulada.");
	const momento = fechaHoraAR(jornada.fecha, hora);
	if (momento > new Date()) throw new Error("No se puede poner una hora en el futuro.");
	const entrada = tipo === "entrada" ? momento : jornada.entrada;
	const salida = tipo === "salida" ? momento : jornada.salida;
	if (tipo === "salida" && !jornada.salida)
		throw new Error("Esta entrada no tiene salida: usá “Agregar salida”.");
	if (salida && salida <= entrada)
		throw new Error("La salida tiene que ser posterior a la entrada.");
	const antes = horaAR(tipo === "entrada" ? jornada.entrada : jornada.salida!);
	if (antes === hora) throw new Error("Es la misma hora que ya tenía.");

	const batch = writeBatch(db);
	batch.update(doc(db, COL.jornadas, jornada.id), {
		[tipo]: Timestamp.fromDate(momento),
		minutos: minutosDe(entrada, salida),
		historial: arrayUnion(cambio(tipo, antes, hora, motivo)),
		actualizadoEn: serverTimestamp(),
	});
	auditar(batch, {
		accion: `corregir_${tipo}`,
		coleccion: COL.jornadas,
		docId: jornada.id,
		motivo,
		detalle: { personalId: jornada.personalId, fecha: jornada.fecha, antes, despues: hora },
	});
	await batch.commit();
}

/**
 * Anula una entrada (se anula la jornada entera) o una salida (la jornada queda
 * sin salida: si es de hoy vuelve a quedar abierta, si es de otro día queda a revisar).
 */
export async function anularMovimiento(
	jornada: Jornada,
	tipo: TipoMovimiento,
	motivo: string,
): Promise<void> {
	if (jornada.estado !== "Activa") throw new Error("Esta jornada ya está anulada.");
	const personaRef = doc(db, COL.personal, jornada.personalId);
	const personaSnap = await getDoc(personaRef);
	const abiertaId: string | null = personaSnap.exists()
		? (personaSnap.data().jornadaAbiertaId ?? null)
		: null;
	const batch = writeBatch(db);

	if (tipo === "entrada") {
		batch.update(doc(db, COL.jornadas, jornada.id), {
			estado: "Anulada",
			historial: arrayUnion(cambio("estado", "Activa", "Anulada", motivo)),
			actualizadoEn: serverTimestamp(),
		});
		if (abiertaId === jornada.id)
			batch.update(personaRef, { jornadaAbiertaId: null, actualizadoEn: serverTimestamp() });
	} else {
		if (!jornada.salida) throw new Error("Esta jornada no tiene salida.");
		const esHoy = jornada.fecha === fechaAR(new Date());
		const reabrir = esHoy && personaSnap.exists() && !abiertaId;
		batch.update(doc(db, COL.jornadas, jornada.id), {
			salida: null,
			minutos: null,
			incompleta: !reabrir,
			historial: arrayUnion(cambio("salida", horaAR(jornada.salida), null, motivo)),
			actualizadoEn: serverTimestamp(),
		});
		if (reabrir)
			batch.update(personaRef, { jornadaAbiertaId: jornada.id, actualizadoEn: serverTimestamp() });
	}
	auditar(batch, {
		accion: `anular_${tipo}`,
		coleccion: COL.jornadas,
		docId: jornada.id,
		motivo,
		detalle: { personalId: jornada.personalId, fecha: jornada.fecha },
	});
	await batch.commit();
}
