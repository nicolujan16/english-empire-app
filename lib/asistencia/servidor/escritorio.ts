/**
 * Datos y acciones para la aplicación de escritorio (solo servidor).
 *
 * La aplicación no lee ni escribe Firestore directamente: pide todo acá con la sesión
 * de quien está logueado (Admins activo), y el servidor arma lo que necesitan sus
 * pantallas (Presentes, Itinerario, Historial, Llaveros).
 *
 * Las clases de una secretaria que también es profesora no se fichan: cuentan como
 * dadas si estaba en su turno (turnos.ts). La web las calcula, y acá se agregan a las
 * clases (`enSuTurno: true`) para que el itinerario de la aplicación las muestre igual
 * que el calendario, sin cambiar la aplicación.
 */
import { FieldValue, Timestamp, type DocumentData, type DocumentReference } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { interpretarHorarios, vigenciaDelCurso } from "../cursosInstituto";
import { diaSemanaDeFecha, fechaAR, fechaHoraAR, minutosEntre, sumarDias } from "../fechas";
import { leerDiasAsignados } from "../titulares";
import { idClaseDictada, idLlaveroPendiente } from "../tipos";
import { turnoQueCubre } from "../turnos";
import { diaQueExcluye, diasEspecialesEntre } from "./fichar";
import { normalizarUid } from "../uid";
import { auditarServidor, type AdminAutenticado } from "./autenticacion";

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : null);
const texto = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Máximo de días que se pueden pedir de una vez (el historial) */
export const MAX_DIAS_RANGO = 62;

export async function leerDatos(desde: string, hasta: string) {
	const hoy = fechaAR(new Date());
	const enRango = (col: string) =>
		adminDb.collection(col).where("fecha", ">=", desde).where("fecha", "<=", hasta).get();

	const [personalSnap, teachersSnap, llaverosSnap, cursosSnap, jornadasSnap, clasesSnap, fichadasSnap] =
		await Promise.all([
			adminDb.collection("Personal").get(),
			adminDb.collection("Teachers").get(),
			adminDb.collection("Llaveros").get(),
			adminDb.collection("Cursos").get(),
			enRango("Jornadas"),
			enRango("ClasesDictadas"),
			enRango("Fichadas"),
		]);

	const persona = (id: string, d: DocumentData, rol: "secretaria" | "profesora") => ({
		id,
		nombre: String(d.nombre ?? ""),
		apellido: String(d.apellido ?? ""),
		email: String(d.email ?? ""),
		rol,
		activo: d.activo !== false,
		llaveroUid: texto(d.llaveroUid),
	});
	// Una secretaria que también es profesora (mismo id en Personal y Teachers) va una
	// sola vez, como secretaria: así ficha (su turno) y así tiene su llavero
	const idsSecretarias = new Set(personalSnap.docs.map((d) => d.id));
	const personal = [
		...personalSnap.docs.map((d) => persona(d.id, d.data(), "secretaria")),
		...teachersSnap.docs
			.filter((d) => !idsSecretarias.has(d.id))
			.map((d) => persona(d.id, d.data(), "profesora")),
	];

	// Profesoras de cada curso (Teachers.cursosAsignados) con sus días (null = todos)
	const titulares = new Map<string, { id: string; dias: number[] | null }[]>();
	teachersSnap.docs.forEach((t) =>
		(Array.isArray(t.data().cursosAsignados) ? t.data().cursosAsignados : []).forEach((c: string) =>
			titulares.set(c, [
				...(titulares.get(c) ?? []),
				{ id: t.id, dias: leerDiasAsignados(t.data().diasAsignados, c) },
			]),
		),
	);
	const anio = Number(hoy.slice(0, 4));
	const cursos = cursosSnap.docs.flatMap((s) => {
		const d = s.data();
		if ((d.active ?? d.activo) === false) return [];
		const vigente = [anio, anio - 1].some((a) => {
			const v = vigenciaDelCurso(d, a);
			return v.fechaInicio <= hoy && hoy <= v.fechaFin;
		});
		if (!vigente) return [];
		const delCurso = titulares.get(s.id) ?? [];
		return [
			{
				id: s.id,
				nombre: String(d.nombre ?? ""),
				// Cada horario con las titulares de ese día de la semana
				horarios: interpretarHorarios(d.horarios).horarios.map((h) => ({
					...h,
					profesoraIds: delCurso
						.filter((t) => t.dias === null || t.dias.includes(h.dia))
						.map((t) => t.id),
				})),
				// Todas las profesoras del curso (las versiones viejas de la aplicación usan esto)
				profesoraIds: delCurso.map((t) => t.id),
			},
		];
	});

	// Secretarias que también son profesoras (activas en Teachers)
	const docentesActivas = new Set(
		teachersSnap.docs.filter((t) => t.data().activo !== false).map((t) => t.id),
	);
	const duales = personalSnap.docs
		.filter((d) => docentesActivas.has(d.id))
		.map((d) => ({ id: d.id, rol: "secretaria" as const, tambienProfesora: true as const }));
	const clasesEnSuTurno =
		duales.length === 0
			? []
			: await clasesDadasEnSuTurno({
					desde,
					hasta: hasta < hoy ? hasta : hoy,
					cursos,
					duales,
					nombres: new Map(personalSnap.docs.map((d) => [d.id, d.data()])),
					jornadas: jornadasSnap.docs.map((j) => j.data()),
					registradas: new Set(clasesSnap.docs.map((c) => c.id)),
				});

	return {
		hoy,
		desde,
		hasta,
		personal,
		llaveros: llaverosSnap.docs.map((s) => {
			const d = s.data();
			return {
				uid: s.id,
				numero: texto(d.numero),
				personalId: texto(d.personalId),
				estado: (["SinAsignar", "Asignado", "Baja"].includes(d.estado) ? d.estado : "SinAsignar") as string,
				pendienteDeLectura: d.pendienteDeLectura === true,
				creadoEn: iso(d.creadoEn),
				ultimoUsoEn: iso(d.ultimoUsoEn),
			};
		}),
		cursos,
		jornadas: jornadasSnap.docs.map((s) => {
			const d = s.data();
			return {
				id: s.id,
				personalId: String(d.personalId ?? ""),
				personalNombre: String(d.personalNombre ?? ""),
				fecha: String(d.fecha ?? ""),
				entrada: iso(d.entrada),
				salida: iso(d.salida),
				minutos: typeof d.minutos === "number" ? d.minutos : null,
				incompleta: d.incompleta === true,
				estado: d.estado === "Anulada" ? "Anulada" : "Activa",
				origen: d.origen === "manual" ? "manual" : "fichada",
			};
		}),
		clases: clasesSnap.docs.map((s) => {
			const d = s.data();
			return {
				id: s.id,
				cursoId: String(d.cursoId ?? ""),
				cursoNombre: String(d.cursoNombre ?? ""),
				fecha: String(d.fecha ?? ""),
				horaInicio: String(d.horaInicio ?? ""),
				horaFin: String(d.horaFin ?? ""),
				profesoraDictoId: String(d.profesoraDictoId ?? ""),
				profesoraDictoNombre: String(d.profesoraDictoNombre ?? ""),
				llegada: iso(d.llegada),
				minutosTarde: typeof d.minutosTarde === "number" ? d.minutosTarde : null,
				estado: d.estado === "Anulada" ? "Anulada" : "Activa",
				esReemplazo: d.esReemplazo === true,
				fichadaId: texto(d.fichadaId),
			};
		}).concat(clasesEnSuTurno),
		fichadas: fichadasSnap.docs.map((s) => {
			const d = s.data();
			return {
				id: s.id,
				llaveroUid: String(d.llaveroUid ?? ""),
				llaveroNumero: texto(d.llaveroNumero),
				personalId: texto(d.personalId),
				personalNombre: texto(d.personalNombre),
				personalRol: texto(d.personalRol),
				resultado: String(d.resultado ?? ""),
				fecha: String(d.fecha ?? ""),
				horaEfectiva: iso(d.horaEfectiva),
				detalle: texto(d.detalle),
				fueOffline: d.fueOffline === true,
			};
		}),
	};
}

/**
 * Clases sin registro guardado de las secretarias que también son profesoras, que
 * estaban en su turno a esa hora (misma regla que el calendario, sin las que caen en
 * un día especial). Con la forma de las clases registradas: la llegada es la entrada
 * de su turno.
 */
async function clasesDadasEnSuTurno(input: {
	desde: string;
	hasta: string;
	cursos: { id: string; nombre: string; horarios: { dia: number; inicio: string; fin: string; profesoraIds: string[] }[] }[];
	duales: { id: string; rol: "secretaria"; tambienProfesora: true }[];
	nombres: Map<string, DocumentData>;
	jornadas: DocumentData[];
	registradas: Set<string>;
}) {
	if (input.hasta < input.desde) return [];
	const ids = new Set(input.duales.map((d) => d.id));
	const jornadas = input.jornadas
		.filter((j) => ids.has(j.personalId) && j.entrada instanceof Timestamp)
		.map((j) => ({
			personalId: String(j.personalId),
			fecha: String(j.fecha ?? ""),
			entrada: (j.entrada as Timestamp).toDate(),
			salida: j.salida instanceof Timestamp ? j.salida.toDate() : null,
			estado: (j.estado === "Anulada" ? "Anulada" : "Activa") as "Activa" | "Anulada",
		}));
	if (jornadas.length === 0) return [];
	const dias = await diasEspecialesEntre(input.desde, input.hasta);

	const res = [];
	for (let fecha = input.desde; fecha <= input.hasta; fecha = sumarDias(fecha, 1)) {
		const dia = diaSemanaDeFecha(fecha);
		for (const c of input.cursos) {
			for (const h of c.horarios) {
				const id = idClaseDictada(c.id, fecha, h.inicio);
				if (h.dia !== dia || input.registradas.has(id)) continue;
				if (diaQueExcluye({ cursoId: c.id, inicio: h.inicio, fin: h.fin }, fecha, dias)) continue;
				const t = turnoQueCubre(
					{ fecha, horaInicio: h.inicio, horaFin: h.fin, titularIds: h.profesoraIds },
					input.duales,
					jornadas,
				);
				if (!t) continue;
				const n = input.nombres.get(t.personaId);
				const inicio = fechaHoraAR(fecha, h.inicio);
				res.push({
					id,
					cursoId: c.id,
					cursoNombre: c.nombre,
					fecha,
					horaInicio: h.inicio,
					horaFin: h.fin,
					profesoraDictoId: t.personaId,
					profesoraDictoNombre: `${n?.nombre ?? ""} ${n?.apellido ?? ""}`.trim(),
					llegada: t.jornada.entrada.toISOString(),
					minutosTarde:
						t.jornada.entrada > inicio ? minutosEntre(inicio, t.jornada.entrada) : 0,
					estado: "Activa",
					esReemplazo: false,
					fichadaId: null,
					enSuTurno: true,
				});
			}
		}
	}
	return res;
}

// ─── Llaveros (solo director) ─────────────────────────────────────────────────

export type AccionLlavero = "registrar" | "asignar" | "quitar";

export class ErrorLlavero extends Error {}

/**
 * Registra (si es nuevo), asigna o quita la asignación de un llavero apoyado en la
 * aplicación de escritorio. Un llavero nuevo con un número cargado de antemano
 * (num-101…) se vincula igual que al fichar.
 */
export async function gestionarLlavero(
	director: AdminAutenticado,
	pedido: { accion: AccionLlavero; uid: string; numero: string | null; personalId: string | null },
) {
	const uid = normalizarUid(pedido.uid);
	const numero = pedido.numero?.trim() || null;
	const llaveros = adminDb.collection("Llaveros");

	const resultado = await adminDb.runTransaction(async (tx) => {
		// ── Lecturas ──
		const llRef = llaveros.doc(uid);
		const llSnap = await tx.get(llRef);
		let phRef: DocumentReference | null = null;
		let pendiente: DocumentData | null = null;
		if (!llSnap.exists && numero) {
			phRef = llaveros.doc(idLlaveroPendiente(numero));
			const ph = await tx.get(phRef);
			if (ph.exists && ph.data()?.pendienteDeLectura === true) pendiente = ph.data()!;
		}
		const actual: DocumentData = llSnap.exists
			? llSnap.data()!
			: (pendiente ?? { numero, personalId: null, estado: "SinAsignar" });

		/** Persona por id: secretaria (Personal) o profesora (Teachers) */
		const buscarPersona = async (id: string | null) => {
			if (!id) return null;
			for (const col of ["Personal", "Teachers"]) {
				const ref = adminDb.collection(col).doc(id);
				const s = await tx.get(ref);
				if (s.exists) return { ref, data: s.data()! };
			}
			return null;
		};
		const duenoActual = await buscarPersona(texto(actual.personalId));
		const nueva = pedido.accion === "asignar" ? await buscarPersona(pedido.personalId) : null;
		if (pedido.accion === "asignar" && !nueva) throw new ErrorLlavero("No se encontró a esa persona.");
		if (pedido.accion === "asignar" && nueva!.data.activo === false)
			throw new ErrorLlavero("Esa persona está dada de baja.");
		// El llavero que tenía antes la persona nueva (queda libre)
		const viejoId = nueva ? texto(nueva.data.llaveroUid) : null;
		const viejoRef = viejoId && viejoId !== uid && viejoId !== phRef?.id ? llaveros.doc(viejoId) : null;
		const viejoSnap = viejoRef ? await tx.get(viejoRef) : null;

		if (pedido.accion === "asignar" && actual.estado === "Baja")
			throw new ErrorLlavero("El llavero está dado de baja: reactivalo desde la web antes de asignarlo.");

		// ── Escrituras ──
		const ahora = FieldValue.serverTimestamp();
		let datos: DocumentData = {
			numero: actual.numero ?? numero,
			personalId: texto(actual.personalId),
			estado: actual.estado ?? "SinAsignar",
		};
		const actualizarPersona = new Map<string, { ref: DocumentReference; upd: Record<string, unknown> }>();
		const marcar = (p: { ref: DocumentReference }, upd: Record<string, unknown>) => {
			const previo = actualizarPersona.get(p.ref.path);
			actualizarPersona.set(p.ref.path, { ref: p.ref, upd: { ...(previo?.upd ?? {}), ...upd } });
		};

		// Vincular el pendiente al llavero real (la persona que lo tenía apunta al UID)
		if (!llSnap.exists && pendiente && phRef) {
			tx.delete(phRef);
			if (duenoActual && duenoActual.data.llaveroUid === phRef.id) marcar(duenoActual, { llaveroUid: uid });
		}

		if (pedido.accion === "asignar" && nueva) {
			if (duenoActual && duenoActual.ref.path !== nueva.ref.path) marcar(duenoActual, { llaveroUid: null });
			if (viejoRef && viejoSnap?.exists) tx.update(viejoRef, { personalId: null, estado: "SinAsignar" });
			marcar(nueva, { llaveroUid: uid });
			datos = { ...datos, personalId: pedido.personalId, estado: "Asignado" };
		} else if (pedido.accion === "quitar") {
			if (duenoActual) marcar(duenoActual, { llaveroUid: null });
			datos = { ...datos, personalId: null, estado: datos.estado === "Baja" ? "Baja" : "SinAsignar" };
		}

		if (llSnap.exists) tx.update(llRef, datos);
		else
			tx.set(llRef, {
				...datos,
				creadoEn: pendiente?.creadoEn ?? ahora,
				ultimoUsoEn: null,
				...(pendiente && phRef ? { vinculadoEn: ahora, vinculadoDesde: phRef.id } : {}),
			});
		actualizarPersona.forEach(({ ref, upd }) => tx.update(ref, { ...upd, actualizadoEn: ahora }));
		return {
			uid,
			numero: texto(datos.numero),
			personalId: texto(datos.personalId),
			estado: String(datos.estado ?? "SinAsignar"),
		};
	});

	if (pedido.accion !== "registrar")
		await auditarServidor({
			accion: pedido.accion === "asignar" ? "asignar_llavero" : "quitar_llavero",
			coleccion: "Llaveros",
			docId: uid,
			porUid: director.uid,
			porEmail: director.email,
			detalle: { numero: resultado.numero ?? null, personalId: pedido.personalId ?? null, desde: "aplicacion-escritorio" },
		});
	return resultado;
}
