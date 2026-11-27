/**
 * Acceso a Firestore para el calendario: lecturas del mes y confirmación.
 * Personal y Cursos se leen con `repositorioFirestore` (repositorio.ts).
 * Los recibos (`RecibosPersonal`) solo los lee el director.
 */
import {
	collection,
	doc,
	getDoc,
	onSnapshot,
	query,
	runTransaction,
	serverTimestamp,
	where,
	writeBatch,
	type DocumentData,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebaseConfig";
import { RESULTADOS_PENDIENTES, rangoDelMes } from "./calendario";
import { fechaAR } from "./fechas";
import type { Liquidacion } from "./liquidacion";
import { formatearNumero, nombreParaRecibo } from "./reciboImpreso";
import { COL, aClase, aDate, aDiaEspecial, aJornada } from "./repositorio";
import {
	totalDelRecibo,
	type ClaseDictada,
	type DiaEspecial,
	type EdicionRecibo,
	type Fichada,
	type Jornada,
	type Persona,
	type Recibo,
	type ResultadoFichada,
} from "./tipos";

export interface DatosDelMes {
	periodo: string;
	jornadas: Jornada[];
	dictadas: ClaseDictada[];
	/** Los guardados en Firestore (del año). armarCalendario los combina con los predeterminados */
	diasEspeciales: DiaEspecial[];
	fichadas: Fichada[];
	recibos: Recibo[];
}

const textoONull = (v: unknown) => (typeof v === "string" && v ? v : null);

export const aFichada = (id: string, d: DocumentData): Fichada => ({
	id,
	llaveroUid: d.llaveroUid ?? "",
	llaveroNumero: textoONull(d.llaveroNumero),
	personalId: d.personalId ?? null,
	personalNombre: d.personalNombre ?? null,
	resultado: d.resultado as ResultadoFichada,
	fecha: d.fecha,
	horaEfectiva: aDate(d.horaEfectiva) ?? new Date(0),
	fueOffline: d.fueOffline === true,
	resuelta: d.resuelta === true,
	jornadaId: textoONull(d.jornadaId),
	claseDictadaId: textoONull(d.claseDictadaId),
	detalle: textoONull(d.detalle),
});

const numeroONull = (v: unknown) => (typeof v === "number" ? v : null);

const aEdicion = (e: unknown): EdicionRecibo | null => {
	if (!e || typeof e !== "object") return null;
	const d = e as DocumentData;
	if (!Array.isArray(d.lineas)) return null;
	return {
		nombreRecibo: String(d.nombreRecibo ?? ""),
		dni: typeof d.dni === "string" && d.dni ? d.dni : null,
		fechaEmision: String(d.fechaEmision ?? ""),
		lineas: d.lineas.map((l: DocumentData) => ({
			concepto: String(l.concepto ?? ""),
			cantidad: String(l.cantidad ?? ""),
			precio: numeroONull(l.precio) ?? 0,
			total: numeroONull(l.total) ?? 0,
		})),
		total: numeroONull(d.total) ?? 0,
		editadoEn: aDate(d.editadoEn),
	};
};

export const aRecibo = (id: string, d: DocumentData): Recibo => ({
	id,
	personalId: d.personalId,
	email: typeof d.email === "string" && d.email ? d.email : null,
	nombre: d.nombre ?? "",
	rol: d.rol === "profesora" ? "profesora" : "secretaria",
	periodo: d.periodo,
	numero: numeroONull(d.numero),
	numeroTexto: typeof d.numeroTexto === "string" ? d.numeroTexto : null,
	fechaEmision: typeof d.fechaEmision === "string" ? d.fechaEmision : null,
	nombreRecibo: d.nombreRecibo ?? d.nombre ?? "",
	dni: typeof d.dni === "string" && d.dni ? d.dni : null,
	totalMinutos: numeroONull(d.totalMinutos),
	minutosEnClase: numeroONull(d.minutosEnClase),
	precioHora: numeroONull(d.precioHora),
	totalClases: numeroONull(d.totalClases),
	clases: Array.isArray(d.clases) ? d.clases : [],
	cursos: Array.isArray(d.cursos) ? d.cursos : [],
	reemplazos: Array.isArray(d.reemplazos) ? d.reemplazos : [],
	totalAPagar: numeroONull(d.totalAPagar) ?? 0,
	edicion: aEdicion(d.edicion),
	version: numeroONull(d.version) ?? 0,
	imagenVersion: numeroONull(d.imagenVersion),
	generadoEn: aDate(d.generadoEn),
	enviadoEn: aDate(d.enviadoEn),
});

/**
 * Escucha todo lo del mes. Llama a `cb` recién cuando llegaron todas las partes,
 * y de nuevo con cada cambio.
 * Si falla solo la lectura de fichadas, se sigue sin pendientes y se avisa con
 * `onErrorPendientes` (por ejemplo, si todavía no está creado el índice).
 * Los recibos se leen solo con `conRecibos` (director): si no, llegan vacíos.
 */
export function suscribirMes(
	periodo: string,
	cb: (datos: DatosDelMes) => void,
	onError: (e: Error) => void,
	onErrorPendientes: (e: Error) => void,
	{ conRecibos = false }: { conRecibos?: boolean } = {},
): () => void {
	const { desde, hasta } = rangoDelMes(periodo);
	const enRango = (col: string) =>
		query(
			collection(db, col),
			where("fecha", ">=", desde),
			where("fecha", "<=", hasta),
		);

	const datos: Omit<DatosDelMes, "periodo"> = {
		jornadas: [],
		dictadas: [],
		diasEspeciales: [],
		fichadas: [],
		recibos: [],
	};
	const listas = new Set<string>();
	const PARTES = conRecibos ? 5 : 4;
	const listo = (parte: string) => {
		listas.add(parte);
		if (listas.size === PARTES) cb({ periodo, ...datos });
	};

	const unsubs = [
		onSnapshot(
			enRango(COL.jornadas),
			(snap) => {
				datos.jornadas = snap.docs.map((d) => aJornada(d.id, d.data()));
				listo("jornadas");
			},
			onError,
		),
		onSnapshot(
			enRango(COL.clasesDictadas),
			(snap) => {
				datos.dictadas = snap.docs.map((d) => aClase(d.id, d.data()));
				listo("dictadas");
			},
			onError,
		),
		onSnapshot(
			// Todo el año: son pocos y así se ven las decisiones sobre los feriados
			// predeterminados aunque el doc haya quedado con otra fecha
			query(
				collection(db, COL.diasEspeciales),
				where("fecha", ">=", `${periodo.slice(0, 4)}-01-01`),
				where("fecha", "<=", `${periodo.slice(0, 4)}-12-31`),
			),
			(snap) => {
				datos.diasEspeciales = snap.docs.map((d) => aDiaEspecial(d.id, d.data()));
				listo("diasEspeciales");
			},
			onError,
		),
		onSnapshot(
			query(
				collection(db, COL.fichadas),
				where("resultado", "in", [...RESULTADOS_PENDIENTES]),
				where("fecha", ">=", desde),
				where("fecha", "<=", hasta),
			),
			(snap) => {
				datos.fichadas = snap.docs.map((d) => aFichada(d.id, d.data()));
				listo("fichadas");
			},
			(e) => {
				onErrorPendientes(e);
				datos.fichadas = [];
				listo("fichadas");
			},
		),
	];
	if (conRecibos) {
		unsubs.push(
			onSnapshot(
				query(collection(db, COL.recibos), where("periodo", "==", periodo)),
				(snap) => {
					datos.recibos = snap.docs.map((d) => aRecibo(d.id, d.data()));
					listo("recibos");
				},
				onError,
			),
		);
	}

	return () => unsubs.forEach((u) => u());
}

/**
 * Genera (o regenera) los datos del recibo de una persona:
 * `RecibosPersonal/{personalId}_{periodo}`.
 * - La primera vez le asigna el número correlativo del año (`Contadores/recibos-YYYY`).
 *   Si se regenera, conserva el número y sube la `version`.
 * - Se pisa entero: una versión nueva todavía no tiene imagen ni fue enviada.
 * - `edicion`: los cambios a mano del director. Si viene, el recibo se imprime con
 *   eso; si no, se imprime lo calculado (y se descarta una edición anterior).
 *   Lo calculado se guarda siempre, para saber si el registro cambió después.
 * Devuelve el recibo tal como quedó, para dibujar y guardar su imagen.
 */
export async function generarRecibo(
	periodo: string,
	l: Liquidacion,
	persona: Persona | undefined,
	edicion: Omit<EdicionRecibo, "editadoEn"> | null = null,
): Promise<Recibo> {
	const id = `${l.personalId}_${periodo}`;
	const ref = doc(db, COL.recibos, id);
	const fechaEmision = edicion?.fechaEmision || fechaAR(new Date());
	// El número correlativo es del año en que se genera, aunque se edite la fecha
	const anio = Number(fechaAR(new Date()).slice(0, 4));
	const refContador = doc(db, COL.contadores, `recibos-${anio}`);
	const nombreRecibo = persona ? nombreParaRecibo(persona) : l.nombre;
	const dni = persona?.dni ?? null;
	// El recibo lo ve la dueña por su uid (personalId): una secretaria que también es
	// profesora ve el mismo en el panel y en el portal docente. El email queda por los
	// recibos viejos (ver puedeVerRecibo en firestore.rules)
	const email = persona?.email ? persona.email.trim().toLowerCase() : null;

	return runTransaction(db, async (tx) => {
		const actual = await tx.get(ref);
		const contador = await tx.get(refContador);
		const previo = actual.exists() ? actual.data() : null;
		const version = (Number(previo?.version) || 0) + 1;

		// Número: se conserva si ya tenía; si no, el siguiente del año
		let numero: number;
		let numeroTexto: string;
		if (typeof previo?.numero === "number" && typeof previo?.numeroTexto === "string") {
			numero = previo.numero;
			numeroTexto = previo.numeroTexto;
		} else {
			numero = (contador.exists() ? Number(contador.data().ultimo) || 0 : 0) + 1;
			numeroTexto = formatearNumero(numero, anio);
			tx.set(refContador, { ultimo: numero, actualizadoEn: serverTimestamp() });
		}

		const datos = {
			personalId: l.personalId,
			email,
			nombre: l.nombre,
			nombreRecibo,
			dni,
			rol: l.rol,
			periodo,
			numero,
			numeroTexto,
			fechaEmision,
			// Todas las partes: horas (secretarias), clases, cursos y reemplazos
			totalMinutos: l.totalMinutos,
			minutosEnClase: l.totalMinutos === null ? null : l.minutosEnClase,
			precioHora: l.precioHora,
			totalClases: l.totalClases,
			clases: l.clases,
			cursos: l.cursos,
			reemplazos: l.reemplazos,
			totalAPagar: l.totalAPagar,
			version,
			imagenVersion: null,
			generadoEn: serverTimestamp(),
			generadoPor: auth.currentUser?.uid ?? "desconocido",
		};
		tx.set(ref, {
			...datos,
			edicion: edicion
				? {
						...edicion,
						editadoEn: serverTimestamp(),
						editadoPor: auth.currentUser?.uid ?? "desconocido",
					}
				: null,
		});

		return {
			id,
			...datos,
			edicion: edicion ? { ...edicion, editadoEn: new Date() } : null,
			generadoEn: new Date(),
			enviadoEn: null,
		};
	});
}

/**
 * Guarda la imagen del recibo en `RecibosPersonalImagenes/{id}` (aparte, para que el
 * listado de recibos no descargue las imágenes), marca qué versión tiene imagen y
 * publica el resumen que ve la dueña en "Mis recibos" (`RecibosPersonalPublicados`),
 * todo junto: la dueña nunca ve un resumen de una versión y la imagen de otra.
 */
export async function guardarImagenRecibo(recibo: Recibo, imagen: string): Promise<void> {
	// Lo que pueden leer la profesora o la secretaria (ver puedeVerRecibo en firestore.rules)
	const propietaria = { personalId: recibo.personalId, email: recibo.email };
	const batch = writeBatch(db);
	batch.set(doc(db, COL.recibosImagenes, recibo.id), {
		...propietaria,
		periodo: recibo.periodo,
		version: recibo.version,
		imagen, // data URL JPG
		generadaEn: serverTimestamp(),
	});
	batch.set(doc(db, COL.recibosPublicados, recibo.id), {
		...propietaria,
		periodo: recibo.periodo,
		numeroTexto: recibo.numeroTexto,
		fechaEmision: recibo.edicion?.fechaEmision ?? recibo.fechaEmision,
		nombreRecibo: recibo.edicion?.nombreRecibo ?? (recibo.nombreRecibo || recibo.nombre),
		total: totalDelRecibo(recibo),
		version: recibo.version,
		publicadoEn: serverTimestamp(),
	});
	batch.update(doc(db, COL.recibos, recibo.id), {
		imagenVersion: recibo.version,
	});
	await batch.commit();
}

/** La imagen guardada de un recibo (data URL), o null si no hay */
export async function leerImagenRecibo(
	reciboId: string,
): Promise<{ imagen: string; version: number } | null> {
	const snap = await getDoc(doc(db, COL.recibosImagenes, reciboId));
	if (!snap.exists()) return null;
	const d = snap.data();
	return typeof d.imagen === "string"
		? { imagen: d.imagen, version: Number(d.version) || 0 }
		: null;
}
