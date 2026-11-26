/**
 * Acceso a Firestore del registro de asistencia del personal.
 * Todo lo que lee o escribe la UI pasa por acá, así los componentes no
 * conocen Firebase y se pueden probar con un repositorio mock.
 *
 * Usa la base del instituto (english-empire-2026):
 * - Secretarias: `Personal` (+ `PersonalLiquidacion` con el precio por hora, solo director)
 * - Profesoras:  `Teachers` (las mismas cuentas del portal docente)
 * - Cursos:      `Cursos` (los de Admin → Cursos) + titulares desde `Teachers.cursosAsignados`
 *                + `CursosLiquidacion` (monto fijo, porcentajes, alumnos corregidos; solo director)
 * - Registros:   `Jornadas`, `ClasesDictadas`, `DiasEspeciales`
 */
import {
	Timestamp,
	arrayRemove,
	arrayUnion,
	collection,
	doc,
	getCountFromServer,
	getDoc,
	getDocs,
	onSnapshot,
	query,
	serverTimestamp,
	where,
	writeBatch,
	type DocumentData,
	type WriteBatch,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebaseConfig";
import { crearCuentaProfesor } from "@/lib/services/teachersServices";
import { interpretarHorarios, vigenciaDelCurso } from "./cursosInstituto";
import { fechaAR, fechaHoraAR, horaAR, minutosEntre } from "./fechas";
import {
	idClaseDictada,
	nombreCompleto,
	type CambioHistorial,
	type ClaseDictada,
	type Curso,
	type DiaEspecial,
	type DiaEspecialInput,
	type Jornada,
	type LiquidacionCursoInput,
	type Persona,
	type PersonaInput,
} from "./tipos";

// ─── Nombres de colecciones ───────────────────────────────────────────────────

export const COL = {
	personal: "Personal", // secretarias
	personalLiquidacion: "PersonalLiquidacion", // precio por hora (solo director)
	teachers: "Teachers", // profesoras
	cursos: "Cursos",
	cursosLiquidacion: "CursosLiquidacion", // pago de profesoras por curso (solo director)
	users: "Users",
	hijos: "Hijos",
	jornadas: "Jornadas",
	clasesDictadas: "ClasesDictadas",
	diasEspeciales: "DiasEspeciales",
	fichadas: "Fichadas",
	recibos: "RecibosPersonal",
	recibosImagenes: "RecibosPersonalImagenes",
	// Resumen que ve la dueña del recibo ("Mis recibos"), sin porcentajes ni montos fijos
	recibosPublicados: "RecibosPersonalPublicados",
	contadores: "Contadores",
	configuracion: "ConfiguracionAsistencia", // doc "general": fecha de inicio del registro
	llaveros: "Llaveros",
	// Quién hizo cada carga o corrección manual. Nadie la lee desde la app: solo el
	// desarrollador desde la consola de Firebase (reglas: create sí, read no).
	auditoria: "AuditoriaAsistencia",
} as const;

/**
 * Deja constancia de una carga o corrección manual en AuditoriaAsistencia, en el
 * mismo batch que el cambio (si el cambio falla, no queda registro y viceversa).
 */
export function auditar(
	batch: WriteBatch,
	a: {
		accion: string;
		coleccion: string;
		docId: string;
		motivo?: string | null;
		detalle?: Record<string, string | number | boolean | null>;
	},
) {
	batch.set(doc(collection(db, COL.auditoria)), {
		accion: a.accion,
		coleccion: a.coleccion,
		docId: a.docId,
		motivo: a.motivo ?? null,
		detalle: a.detalle ?? null,
		porUid: auth.currentUser?.uid ?? "desconocido",
		porEmail: auth.currentUser?.email ?? null,
		en: serverTimestamp(),
	});
}

/** Desde cuándo cuenta el registro si el director todavía no eligió una fecha */
export const FECHA_INICIO_POR_DEFECTO = "2026-11-01";

export interface ConfiguracionAsistencia {
	/** "YYYY-MM-DD": antes de esta fecha no se esperan clases ni hay pendientes */
	fechaInicio: string;
	/** false = no hay doc guardado y se está usando FECHA_INICIO_POR_DEFECTO */
	guardada: boolean;
}

// ─── Interfaz (lo que consume la UI) ──────────────────────────────────────────

export interface RegistrosDelDia {
	jornadas: Jornada[];
	clases: ClaseDictada[];
}

export interface OpcionesLectura {
	/**
	 * Solo para el director: suma precios por hora, datos de pago de los cursos
	 * y cantidad de inscriptos. Sin esto no se lee nada de dinero (las reglas
	 * se lo niegan a las secretarias).
	 */
	conLiquidacion?: boolean;
	/** Año de la vigencia de los cursos (los cursos del instituto no guardan año). Por defecto, el actual */
	anio?: number;
}

export interface RepositorioCarga {
	suscribirPersonal(
		cb: (p: Persona[]) => void,
		onError?: (e: Error) => void,
		opciones?: OpcionesLectura,
	): () => void;
	suscribirCursos(
		cb: (c: Curso[]) => void,
		onError?: (e: Error) => void,
		opciones?: OpcionesLectura,
	): () => void;
	/** Alta o edición. Una profesora nueva crea su cuenta del portal docente (Auth + Teachers) */
	guardarPersona(datos: PersonaInput, existente?: Persona): Promise<void>;
	cambiarActivoPersona(persona: Persona, activo: boolean): Promise<void>;
	/** Precio por hora de varias secretarias de una sola vez */
	guardarPreciosHora(
		cambios: { personalId: string; precioHora: number | null }[],
	): Promise<void>;
	/** Titulares (Teachers.cursosAsignados) y datos de pago (CursosLiquidacion) de un curso */
	guardarLiquidacionCurso(curso: Curso, datos: LiquidacionCursoInput): Promise<void>;
	/**
	 * Asigna o quita un curso a una profesora (Teachers.cursosAsignados): es la misma
	 * asignación que Configuración → Gestionar profesores y el portal docente.
	 */
	asignarCursoAProfesora(profesoraId: string, cursoId: string): Promise<void>;
	quitarCursoAProfesora(profesoraId: string, cursoId: string): Promise<void>;
	/** Configuración del registro (fecha de inicio). Si no hay doc, usa la de por defecto */
	suscribirConfiguracion(
		cb: (c: ConfiguracionAsistencia) => void,
		onError?: (e: Error) => void,
	): () => void;
	/** Solo director */
	guardarFechaInicio(fecha: string): Promise<void>;
	suscribirRegistrosDelDia(
		fecha: string,
		cb: (r: RegistrosDelDia) => void,
		onError?: (e: Error) => void,
	): () => void;
	crearJornadaManual(input: {
		persona: Persona;
		fecha: string;
		entrada: string; // "HH:MM"
		salida: string; // "HH:MM"
		motivo: string;
	}): Promise<void>;
	editarJornada(
		jornada: Jornada,
		cambios: { entrada: string; salida: string | null },
		motivo: string,
	): Promise<void>;
	anularJornada(jornada: Jornada, motivo: string): Promise<void>;
	crearClaseManual(input: {
		curso: Curso;
		fecha: string;
		horaInicio: string;
		horaFin: string;
		profesora: Persona;
		motivo: string;
	}): Promise<void>;
	editarClase(
		clase: ClaseDictada,
		cambios: { profesora: Persona; contarIgual: boolean },
		motivo: string,
	): Promise<void>;
	anularClase(clase: ClaseDictada, motivo: string): Promise<void>;
	/** Los días especiales guardados del año (sin los predeterminados: ver feriados.ts) */
	suscribirDiasEspeciales(
		anio: number,
		cb: (d: DiaEspecial[]) => void,
		onError?: (e: Error) => void,
	): () => void;
	guardarDiaEspecial(datos: DiaEspecialInput, id?: string): Promise<void>;
	/** Adherirse o no a un feriado (predeterminado o cargado a mano) */
	cambiarAdhesion(dia: DiaEspecial, adherido: boolean): Promise<void>;
	/** Solo para los cargados a mano: los predeterminados no se borran */
	eliminarDiaEspecial(id: string): Promise<void>;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

const uidActual = () => auth.currentUser?.uid ?? "desconocido";

const anioActual = () => Number(fechaAR(new Date()).slice(0, 4));

export const aDate = (v: unknown): Date | null =>
	v instanceof Timestamp ? v.toDate() : null;

const numeroONull = (v: unknown) =>
	typeof v === "number" && Number.isFinite(v) ? v : null;

/** Una entrada del historial de un registro: qué cambió, con motivo, quién y cuándo */
export const cambio = (
	campo: string,
	antes: unknown,
	despues: unknown,
	motivo: string,
) => ({
	campo,
	antes: antes ?? null,
	despues: despues ?? null,
	motivo,
	por: uidActual(),
	en: Timestamp.now(), // serverTimestamp() no funciona dentro de arrays
});

const historialDesde = (raw: unknown): CambioHistorial[] =>
	Array.isArray(raw)
		? raw.map((h: DocumentData) => ({
				campo: String(h.campo ?? ""),
				antes: h.antes ?? null,
				despues: h.despues ?? null,
				motivo: String(h.motivo ?? ""),
				por: String(h.por ?? ""),
				en: aDate(h.en) ?? new Date(0),
			}))
		: [];

const dniODigitos = (v: unknown) =>
	typeof v === "string" && v.replace(/\D/g, "") ? v.replace(/\D/g, "") : null;

/** Secretaria: doc de `Personal` (+ precio por hora de `PersonalLiquidacion`) */
export const aSecretaria = (
	id: string,
	d: DocumentData,
	precioHora: number | null = null,
): Persona => ({
	id,
	nombre: d.nombre ?? "",
	apellido: d.apellido ?? "",
	email: d.email ?? "",
	dni: dniODigitos(d.dni),
	rol: "secretaria",
	activo: d.activo !== false,
	llaveroUid: d.llaveroUid ?? null,
	jornadaAbiertaId: d.jornadaAbiertaId ?? null,
	precioHora,
});

/** Profesora: doc de `Teachers/{uid}` */
export const aProfesora = (id: string, d: DocumentData): Persona => ({
	id,
	nombre: d.nombre ?? "",
	apellido: d.apellido ?? "",
	email: d.email ?? "",
	dni: dniODigitos(d.dni),
	rol: "profesora",
	activo: d.activo !== false,
	llaveroUid: d.llaveroUid ?? null,
	jornadaAbiertaId: null,
	precioHora: null,
	telefono: d.telefono ?? "",
	titulo: d.titulo ?? "",
	cursoIds: Array.isArray(d.cursosAsignados) ? d.cursosAsignados : [],
});

/**
 * Curso del instituto + titulares + datos de pago.
 * `liq` e `inscriptos` solo llegan si se leyó con `conLiquidacion`.
 */
export const aCurso = (
	id: string,
	d: DocumentData,
	anio: number,
	titulares: Persona[],
	liq: DocumentData | null,
	inscriptos: number | null,
): Curso => {
	const { horarios, diasDeClase, sinInterpretar } = interpretarHorarios(d.horarios);
	const { fechaInicio, fechaFin } = vigenciaDelCurso(d, anio);
	const manual = numeroONull(liq?.cantidadAlumnosManual);
	const porcentajes: Record<string, number> =
		liq?.porcentajes && typeof liq.porcentajes === "object"
			? Object.fromEntries(
					Object.entries(liq.porcentajes as Record<string, unknown>).filter(
						(e): e is [string, number] => typeof e[1] === "number",
					),
				)
			: {};
	return {
		id,
		nombre: d.nombre ?? "",
		activo: (d.active ?? d.activo) !== false,
		profesoraIds: titulares.map((p) => p.id),
		profesoraNombres: titulares.map(nombreCompleto),
		horarios,
		fechaInicio,
		fechaFin,
		cantidadAlumnos: manual ?? inscriptos,
		montoFijo: numeroONull(liq?.montoFijo),
		porcentajes,
		alumnosInscriptos: inscriptos,
		alumnosCorregidos: manual !== null,
		horariosSinInterpretar: sinInterpretar,
		diasDeClase,
	};
};

export const aJornada = (id: string, d: DocumentData): Jornada => ({
	id,
	personalId: d.personalId,
	personalNombre: d.personalNombre ?? "",
	fecha: d.fecha,
	entrada: aDate(d.entrada) ?? new Date(0),
	salida: aDate(d.salida),
	minutos: d.minutos ?? null,
	incompleta: d.incompleta === true,
	estado: d.estado === "Anulada" ? "Anulada" : "Activa",
	origen: d.origen === "manual" ? "manual" : "fichada",
	fueOffline: d.fueOffline === true,
	historial: historialDesde(d.historial),
	fichadaEntradaId: typeof d.fichadaEntradaId === "string" ? d.fichadaEntradaId : null,
	fichadaSalidaId: typeof d.fichadaSalidaId === "string" ? d.fichadaSalidaId : null,
});

export const aClase = (id: string, d: DocumentData): ClaseDictada => ({
	id,
	cursoId: d.cursoId,
	cursoNombre: d.cursoNombre ?? "",
	fecha: d.fecha,
	horaInicio: d.horaInicio,
	horaFin: d.horaFin,
	profesoraDictoId: d.profesoraDictoId,
	profesoraDictoNombre: d.profesoraDictoNombre ?? "",
	esReemplazo: d.esReemplazo === true,
	titularIds: d.titularIds ?? [],
	llegada: aDate(d.llegada),
	minutosTarde: d.minutosTarde ?? null,
	estado: d.estado === "Anulada" ? "Anulada" : "Activa",
	contarIgual: d.contarIgual === true,
	origen: d.origen === "manual" ? "manual" : "fichada",
	fueOffline: d.fueOffline === true,
	historial: historialDesde(d.historial),
});

export const aDiaEspecial = (id: string, d: DocumentData): DiaEspecial => ({
	id,
	fecha: d.fecha,
	descripcion: d.descripcion ?? "",
	todoElDia: d.todoElDia !== false,
	desde: d.desde ?? null,
	hasta: d.hasta ?? null,
	cursoIds: d.cursoIds ?? [],
	// Docs anteriores a los feriados: eran días del instituto sin clases
	tipo: d.tipo === "feriado" ? "feriado" : "instituto",
	cerrado: d.cerrado === true,
	sinClases: d.sinClases !== false,
	adherido: d.adherido !== false,
	predeterminado: d.predeterminado === true,
});

const porNombre = (a: Persona, b: Persona) =>
	nombreCompleto(a).localeCompare(nombreCompleto(b));

/**
 * Combina varias suscripciones: llama a `emitir` recién cuando llegaron todas
 * las partes, y de nuevo con cada cambio.
 */
function combinar(partes: number, emitir: () => void) {
	const listas = new Set<string>();
	return (parte: string) => {
		listas.add(parte);
		if (listas.size >= partes) emitir();
	};
}

/** Inscriptos de un curso: alumnos adultos (Users) + menores (Hijos) con el curso en `cursos` */
async function contarInscriptos(cursoId: string): Promise<number | null> {
	try {
		const [u, h] = await Promise.all([
			getCountFromServer(
				query(collection(db, COL.users), where("cursos", "array-contains", cursoId)),
			),
			getCountFromServer(
				query(collection(db, COL.hijos), where("cursos", "array-contains", cursoId)),
			),
		]);
		return u.data().count + h.data().count;
	} catch {
		return null; // sin conteo: el panel lo avisa como dato faltante
	}
}

// ─── Implementación Firestore ─────────────────────────────────────────────────

export const repositorioFirestore: RepositorioCarga = {
	suscribirPersonal(cb, onError, opciones = {}) {
		const conLiq = opciones.conLiquidacion === true;
		let secretarias: { id: string; d: DocumentData }[] = [];
		let profesoras: Persona[] = [];
		let precios = new Map<string, number | null>();

		const emitir = () =>
			cb(
				[
					...secretarias.map(({ id, d }) =>
						aSecretaria(id, d, precios.get(id) ?? null),
					),
					...profesoras,
				].sort(porNombre),
			);
		const listo = combinar(conLiq ? 3 : 2, emitir);
		const fallo = (e: Error) => onError?.(e);

		const unsubs = [
			onSnapshot(
				collection(db, COL.personal),
				(snap) => {
					secretarias = snap.docs.map((d) => ({ id: d.id, d: d.data() }));
					listo("personal");
				},
				fallo,
			),
			onSnapshot(
				collection(db, COL.teachers),
				(snap) => {
					profesoras = snap.docs.map((d) => aProfesora(d.id, d.data()));
					listo("teachers");
				},
				fallo,
			),
		];
		if (conLiq) {
			unsubs.push(
				onSnapshot(
					collection(db, COL.personalLiquidacion),
					(snap) => {
						precios = new Map(
							snap.docs.map((d) => [d.id, numeroONull(d.data().precioHora)]),
						);
						listo("precios");
					},
					fallo,
				),
			);
		}
		return () => unsubs.forEach((u) => u());
	},

	suscribirCursos(cb, onError, opciones = {}) {
		const conLiq = opciones.conLiquidacion === true;
		const anio = opciones.anio ?? anioActual();
		let cursos: { id: string; d: DocumentData }[] = [];
		let teachers: { persona: Persona; cursos: string[] }[] = [];
		let liquidaciones = new Map<string, DocumentData>();
		const inscriptos = new Map<string, number | null>();
		let cancelado = false;

		const emitir = () => {
			const lista = cursos.map(({ id, d }) => {
				const titulares = teachers
					.filter((t) => t.cursos.includes(id))
					.map((t) => t.persona)
					.sort(porNombre);
				return aCurso(
					id,
					d,
					anio,
					titulares,
					conLiq ? (liquidaciones.get(id) ?? null) : null,
					conLiq ? (inscriptos.get(id) ?? null) : null,
				);
			});
			cb(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
		};
		const listo = combinar(conLiq ? 3 : 2, () => {
			if (!conLiq) return emitir();
			// Se cuentan los inscriptos de los cursos nuevos antes de mostrar
			const faltan = cursos.filter(({ id }) => !inscriptos.has(id));
			if (faltan.length === 0) return emitir();
			Promise.all(
				faltan.map(async ({ id }) => {
					inscriptos.set(id, await contarInscriptos(id));
				}),
			).then(() => !cancelado && emitir());
		});
		const fallo = (e: Error) => onError?.(e);

		const unsubs = [
			onSnapshot(
				collection(db, COL.cursos),
				(snap) => {
					cursos = snap.docs.map((d) => ({ id: d.id, d: d.data() }));
					listo("cursos");
				},
				fallo,
			),
			onSnapshot(
				collection(db, COL.teachers),
				(snap) => {
					teachers = snap.docs.map((d) => ({
						persona: aProfesora(d.id, d.data()),
						cursos: Array.isArray(d.data().cursosAsignados)
							? d.data().cursosAsignados
							: [],
					}));
					listo("teachers");
				},
				fallo,
			),
		];
		if (conLiq) {
			unsubs.push(
				onSnapshot(
					collection(db, COL.cursosLiquidacion),
					(snap) => {
						liquidaciones = new Map(snap.docs.map((d) => [d.id, d.data()]));
						listo("liquidaciones");
					},
					fallo,
				),
			);
		}
		return () => {
			cancelado = true;
			unsubs.forEach((u) => u());
		};
	},

	async guardarPersona(datos, existente) {
		const email = datos.email.trim().toLowerCase();
		const dni = (datos.dni ?? "").replace(/\D/g, "") || null;

		if (existente && existente.rol !== datos.rol) {
			throw new Error(
				"No se puede cambiar el rol de una persona ya cargada. Dala de baja y cargala de nuevo con el rol correcto.",
			);
		}

		// ── Profesoras: viven en Teachers (cuenta del portal docente) ──
		if (datos.rol === "profesora") {
			if (!existente) {
				await crearCuentaProfesor({
					nombre: datos.nombre,
					apellido: datos.apellido,
					email,
					dni,
					telefono: datos.telefono,
					titulo: datos.titulo,
				});
				return;
			}
			if (email !== existente.email.trim().toLowerCase()) {
				throw new Error(
					"El email de una profesora es el de su cuenta del portal docente: no se puede cambiar desde acá.",
				);
			}
			const batch = writeBatch(db);
			batch.update(doc(db, COL.teachers, existente.id), {
				nombre: datos.nombre.trim(),
				apellido: datos.apellido.trim(),
				dni: dni ?? "",
				telefono: (datos.telefono ?? "").trim(),
				titulo: (datos.titulo ?? "").trim(),
				activo: datos.activo,
				actualizadoEn: serverTimestamp(),
			});
			await batch.commit();
			return;
		}

		// ── Secretarias: viven en Personal ──
		const mismos = await getDocs(
			query(collection(db, COL.personal), where("email", "==", email)),
		);
		if (mismos.docs.some((d) => d.id !== existente?.id)) {
			throw new Error("Ya hay otra persona cargada con ese email.");
		}

		const base = {
			nombre: datos.nombre.trim(),
			apellido: datos.apellido.trim(),
			email,
			dni,
			rol: "secretaria",
			activo: datos.activo,
			actualizadoEn: serverTimestamp(),
		};
		const batch = writeBatch(db);
		if (!existente) {
			batch.set(doc(collection(db, COL.personal)), {
				...base,
				llaveroUid: null,
				jornadaAbiertaId: null,
				ultimaFichadaEn: null,
				creadoEn: serverTimestamp(),
			});
		} else {
			batch.update(doc(db, COL.personal, existente.id), base);
		}
		await batch.commit();
	},

	async cambiarActivoPersona(persona, activo) {
		const col = persona.rol === "profesora" ? COL.teachers : COL.personal;
		const batch = writeBatch(db);
		batch.update(doc(db, col, persona.id), {
			activo,
			actualizadoEn: serverTimestamp(),
		});
		await batch.commit();
	},

	async guardarPreciosHora(cambios) {
		if (cambios.length === 0) return;
		const batch = writeBatch(db);
		cambios.forEach(({ personalId, precioHora }) =>
			batch.set(
				doc(db, COL.personalLiquidacion, personalId),
				{ precioHora, actualizadoEn: serverTimestamp(), actualizadoPor: uidActual() },
				{ merge: true },
			),
		);
		await batch.commit();
	},

	async guardarLiquidacionCurso(curso, datos) {
		const batch = writeBatch(db);
		batch.set(doc(db, COL.cursosLiquidacion, curso.id), {
			montoFijo: datos.montoFijo,
			cantidadAlumnosManual: datos.cantidadAlumnosManual,
			// Solo de las profesoras que quedan como titulares
			porcentajes: Object.fromEntries(
				datos.profesoraIds.flatMap((pid) =>
					datos.porcentajes[pid] === undefined ? [] : [[pid, datos.porcentajes[pid]]],
				),
			),
			actualizadoEn: serverTimestamp(),
			actualizadoPor: uidActual(),
		});

		// Titulares: es la misma asignación que se ve en Configuración → Gestionar profesores
		const antes = new Set(curso.profesoraIds);
		const despues = new Set(datos.profesoraIds);
		despues.forEach((pid) => {
			if (!antes.has(pid))
				batch.update(doc(db, COL.teachers, pid), {
					cursosAsignados: arrayUnion(curso.id),
				});
		});
		antes.forEach((pid) => {
			if (!despues.has(pid))
				batch.update(doc(db, COL.teachers, pid), {
					cursosAsignados: arrayRemove(curso.id),
				});
		});
		await batch.commit();
	},

	async asignarCursoAProfesora(profesoraId, cursoId) {
		const batch = writeBatch(db);
		batch.update(doc(db, COL.teachers, profesoraId), {
			cursosAsignados: arrayUnion(cursoId),
		});
		await batch.commit();
	},

	async quitarCursoAProfesora(profesoraId, cursoId) {
		const batch = writeBatch(db);
		batch.update(doc(db, COL.teachers, profesoraId), {
			cursosAsignados: arrayRemove(cursoId),
		});
		await batch.commit();
	},

	suscribirConfiguracion(cb, onError) {
		const porDefecto = { fechaInicio: FECHA_INICIO_POR_DEFECTO, guardada: false };
		return onSnapshot(
			doc(db, COL.configuracion, "general"),
			(snap) => {
				const f = snap.exists() ? snap.data().fechaInicio : null;
				cb(
					typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f)
						? { fechaInicio: f, guardada: true }
						: porDefecto,
				);
			},
			(e) => {
				// Sin permiso (reglas viejas) o sin conexión: se sigue con la fecha por defecto
				cb(porDefecto);
				onError?.(e);
			},
		);
	},

	async guardarFechaInicio(fecha) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("Elegí una fecha válida.");
		const batch = writeBatch(db);
		batch.set(
			doc(db, COL.configuracion, "general"),
			{ fechaInicio: fecha, actualizadoEn: serverTimestamp(), actualizadoPor: uidActual() },
			{ merge: true },
		);
		await batch.commit();
	},

	suscribirRegistrosDelDia(fecha, cb, onError) {
		let jornadas: Jornada[] = [];
		let clases: ClaseDictada[] = [];
		const listo = combinar(2, () => cb({ jornadas, clases }));

		const unsubJ = onSnapshot(
			query(collection(db, COL.jornadas), where("fecha", "==", fecha)),
			(snap) => {
				jornadas = snap.docs
					.map((d) => aJornada(d.id, d.data()))
					.sort((a, b) => a.entrada.getTime() - b.entrada.getTime());
				listo("jornadas");
			},
			(e) => onError?.(e),
		);
		const unsubC = onSnapshot(
			query(collection(db, COL.clasesDictadas), where("fecha", "==", fecha)),
			(snap) => {
				clases = snap.docs
					.map((d) => aClase(d.id, d.data()))
					.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
				listo("clases");
			},
			(e) => onError?.(e),
		);
		return () => {
			unsubJ();
			unsubC();
		};
	},

	async crearJornadaManual({ persona, fecha, entrada, salida, motivo }) {
		const e = fechaHoraAR(fecha, entrada);
		const s = fechaHoraAR(fecha, salida);
		if (s <= e) throw new Error("La salida tiene que ser posterior a la entrada.");

		const batch = writeBatch(db);
		const ref = doc(collection(db, COL.jornadas));
		batch.set(ref, {
			personalId: persona.id,
			personalNombre: nombreCompleto(persona),
			fecha,
			entrada: Timestamp.fromDate(e),
			salida: Timestamp.fromDate(s),
			minutos: minutosEntre(e, s),
			incompleta: false,
			estado: "Activa",
			origen: "manual",
			fueOffline: false,
			historial: [cambio("creacion", null, `${entrada} – ${salida}`, motivo)],
			creadoEn: serverTimestamp(),
			actualizadoEn: serverTimestamp(),
		});
		auditar(batch, {
			accion: "crear_jornada",
			coleccion: COL.jornadas,
			docId: ref.id,
			motivo,
			detalle: { personalId: persona.id, fecha, entrada, salida },
		});
		await batch.commit();
	},

	async editarJornada(jornada, { entrada, salida }, motivo) {
		const e = fechaHoraAR(jornada.fecha, entrada);
		const s = salida ? fechaHoraAR(jornada.fecha, salida) : null;
		if (s && s <= e)
			throw new Error("La salida tiene que ser posterior a la entrada.");

		const cambios = [];
		const entradaAntes = horaAR(jornada.entrada);
		const salidaAntes = jornada.salida ? horaAR(jornada.salida) : null;
		if (entradaAntes !== entrada)
			cambios.push(cambio("entrada", entradaAntes, entrada, motivo));
		if (salidaAntes !== salida)
			cambios.push(cambio("salida", salidaAntes, salida, motivo));
		if (cambios.length === 0) throw new Error("No hay cambios para guardar.");

		const batch = writeBatch(db);
		batch.update(doc(db, COL.jornadas, jornada.id), {
			entrada: Timestamp.fromDate(e),
			salida: s ? Timestamp.fromDate(s) : null,
			minutos: s ? minutosEntre(e, s) : null,
			incompleta: false, // ya la revisaron
			historial: arrayUnion(...cambios),
			actualizadoEn: serverTimestamp(),
		});
		auditar(batch, {
			accion: "editar_jornada",
			coleccion: COL.jornadas,
			docId: jornada.id,
			motivo,
			detalle: {
				personalId: jornada.personalId,
				fecha: jornada.fecha,
				entradaAntes,
				entrada,
				salidaAntes,
				salida,
			},
		});

		// Si era la jornada abierta de la secretaria y ahora tiene salida, se cierra
		if (s) {
			const pRef = doc(db, COL.personal, jornada.personalId);
			const pSnap = await getDoc(pRef);
			if (pSnap.exists() && pSnap.data().jornadaAbiertaId === jornada.id) {
				batch.update(pRef, {
					jornadaAbiertaId: null,
					actualizadoEn: serverTimestamp(),
				});
			}
		}
		await batch.commit();
	},

	async anularJornada(jornada, motivo) {
		const batch = writeBatch(db);
		batch.update(doc(db, COL.jornadas, jornada.id), {
			estado: "Anulada",
			historial: arrayUnion(cambio("estado", "Activa", "Anulada", motivo)),
			actualizadoEn: serverTimestamp(),
		});
		auditar(batch, {
			accion: "anular_jornada",
			coleccion: COL.jornadas,
			docId: jornada.id,
			motivo,
			detalle: { personalId: jornada.personalId, fecha: jornada.fecha },
		});
		const pRef = doc(db, COL.personal, jornada.personalId);
		const pSnap = await getDoc(pRef);
		if (pSnap.exists() && pSnap.data().jornadaAbiertaId === jornada.id) {
			batch.update(pRef, {
				jornadaAbiertaId: null,
				actualizadoEn: serverTimestamp(),
			});
		}
		await batch.commit();
	},

	async crearClaseManual({ curso, fecha, horaInicio, horaFin, profesora, motivo }) {
		if (horaFin <= horaInicio)
			throw new Error("La hora de fin tiene que ser posterior al inicio.");

		const id = idClaseDictada(curso.id, fecha, horaInicio);
		const ref = doc(db, COL.clasesDictadas, id);
		const existente = await getDoc(ref);
		if (existente.exists() && existente.data().estado !== "Anulada") {
			throw new Error(
				"Ya hay una clase registrada en ese horario. Editala desde la lista.",
			);
		}

		const esReemplazo = !curso.profesoraIds.includes(profesora.id);
		const datos = {
			cursoId: curso.id,
			cursoNombre: curso.nombre,
			fecha,
			horaInicio,
			horaFin,
			profesoraDictoId: profesora.id,
			profesoraDictoNombre: nombreCompleto(profesora),
			esReemplazo,
			titularIds: curso.profesoraIds,
			llegada: null,
			minutosTarde: null,
			estado: "Activa",
			contarIgual: false,
			origen: "manual",
			fueOffline: false,
			actualizadoEn: serverTimestamp(),
		};

		const batch = writeBatch(db);
		if (existente.exists()) {
			// Estaba anulada: se reactiva conservando el historial
			batch.update(ref, {
				...datos,
				historial: arrayUnion(
					cambio("estado", "Anulada", "Activa", motivo),
					cambio(
						"profesoraDicto",
						existente.data().profesoraDictoNombre ?? null,
						datos.profesoraDictoNombre,
						motivo,
					),
				),
			});
		} else {
			batch.set(ref, {
				...datos,
				historial: [
					cambio("creacion", null, datos.profesoraDictoNombre, motivo),
				],
				creadoEn: serverTimestamp(),
			});
		}
		auditar(batch, {
			accion: "registrar_clase",
			coleccion: COL.clasesDictadas,
			docId: id,
			motivo,
			detalle: { profesoraId: profesora.id, esReemplazo, fecha, horaInicio },
		});
		await batch.commit();
	},

	async editarClase(clase, { profesora, contarIgual }, motivo) {
		const cambios = [];
		const update: Record<string, unknown> = {};
		if (profesora.id !== clase.profesoraDictoId) {
			const nombre = nombreCompleto(profesora);
			cambios.push(
				cambio("profesoraDicto", clase.profesoraDictoNombre, nombre, motivo),
			);
			update.profesoraDictoId = profesora.id;
			update.profesoraDictoNombre = nombre;
			update.esReemplazo = !clase.titularIds.includes(profesora.id);
		}
		if (contarIgual !== clase.contarIgual) {
			cambios.push(
				cambio("contarIgual", clase.contarIgual, contarIgual, motivo),
			);
			update.contarIgual = contarIgual;
		}
		if (cambios.length === 0) throw new Error("No hay cambios para guardar.");

		const batch = writeBatch(db);
		batch.update(doc(db, COL.clasesDictadas, clase.id), {
			...update,
			historial: arrayUnion(...cambios),
			actualizadoEn: serverTimestamp(),
		});
		auditar(batch, {
			accion: "editar_clase",
			coleccion: COL.clasesDictadas,
			docId: clase.id,
			motivo,
			detalle: {
				profesoraAntes: clase.profesoraDictoId,
				profesora: profesora.id,
				contarIgual,
			},
		});
		await batch.commit();
	},

	async anularClase(clase, motivo) {
		const batch = writeBatch(db);
		batch.update(doc(db, COL.clasesDictadas, clase.id), {
			estado: "Anulada",
			historial: arrayUnion(cambio("estado", "Activa", "Anulada", motivo)),
			actualizadoEn: serverTimestamp(),
		});
		auditar(batch, {
			accion: "anular_clase",
			coleccion: COL.clasesDictadas,
			docId: clase.id,
			motivo,
			detalle: { profesoraId: clase.profesoraDictoId, fecha: clase.fecha },
		});
		await batch.commit();
	},

	// ── Feriados y días especiales ─────────────────────────────────────────────

	suscribirDiasEspeciales(anio, cb, onError) {
		return onSnapshot(
			query(
				collection(db, COL.diasEspeciales),
				where("fecha", ">=", `${anio}-01-01`),
				where("fecha", "<=", `${anio}-12-31`),
			),
			(snap) => cb(snap.docs.map((d) => aDiaEspecial(d.id, d.data()))),
			(e) => onError?.(e),
		);
	},

	async guardarDiaEspecial(datos, id) {
		const base = {
			fecha: datos.fecha,
			descripcion: datos.descripcion.trim(),
			tipo: datos.tipo,
			cerrado: datos.cerrado,
			sinClases: datos.sinClases,
			actualizadoEn: serverTimestamp(),
		};
		const batch = writeBatch(db);
		const ref = id ? doc(db, COL.diasEspeciales, id) : doc(collection(db, COL.diasEspeciales));
		auditar(batch, {
			accion: id ? "editar_dia_especial" : "crear_dia_especial",
			coleccion: COL.diasEspeciales,
			docId: ref.id,
			detalle: { fecha: datos.fecha, descripcion: datos.descripcion.trim() },
		});
		if (id) {
			// update: conserva horario parcial y cursos si el doc los tenía
			batch.update(ref, base);
		} else {
			batch.set(ref, {
				...base,
				todoElDia: true,
				desde: null,
				hasta: null,
				cursoIds: [],
				adherido: true,
				predeterminado: false,
				creadoPor: uidActual(),
				creadoEn: serverTimestamp(),
			});
		}
		await batch.commit();
	},

	async cambiarAdhesion(dia, adherido) {
		const ref = doc(db, COL.diasEspeciales, dia.id);
		const batch = writeBatch(db);
		if (dia.predeterminado) {
			// El doc guarda la decisión sobre el feriado calculado en código
			batch.set(
				ref,
				{
					fecha: dia.fecha,
					descripcion: dia.descripcion,
					todoElDia: true,
					desde: null,
					hasta: null,
					cursoIds: [],
					tipo: "feriado",
					cerrado: dia.cerrado,
					sinClases: dia.sinClases,
					adherido,
					predeterminado: true,
					actualizadoPor: uidActual(),
					actualizadoEn: serverTimestamp(),
				},
				{ merge: true },
			);
		} else {
			batch.update(ref, { adherido, actualizadoEn: serverTimestamp() });
		}
		auditar(batch, {
			accion: adherido ? "adherir_feriado" : "no_adherir_feriado",
			coleccion: COL.diasEspeciales,
			docId: dia.id,
			detalle: { fecha: dia.fecha, descripcion: dia.descripcion },
		});
		await batch.commit();
	},

	async eliminarDiaEspecial(id) {
		const batch = writeBatch(db);
		batch.delete(doc(db, COL.diasEspeciales, id));
		auditar(batch, { accion: "eliminar_dia_especial", coleccion: COL.diasEspeciales, docId: id });
		await batch.commit();
	},
};
