/**
 * Tipos de dominio del registro de asistencia del personal.
 * La UI trabaja con `Date`: el repositorio convierte desde/hacia Timestamp.
 *
 * De dónde sale cada cosa en la base del instituto (english-empire-2026):
 * - Persona secretaria → `Personal/{id}` (+ `PersonalLiquidacion/{id}` con el precio por hora)
 * - Persona profesora  → `Teachers/{uid}` (la misma cuenta del portal docente)
 * - Curso              → `Cursos/{id}` (nombre, horarios, vigencia)
 *                        + titulares desde `Teachers.cursosAsignados` (y los días de cada
 *                          una en `Teachers.diasAsignados`, ver titulares.ts)
 *                        + `CursosLiquidacion/{id}` (monto fijo, porcentajes, alumnos corregidos)
 */

export type Rol = "secretaria" | "profesora";
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = lunes … 7 = domingo
export type EstadoRegistro = "Activa" | "Anulada";
export type OrigenRegistro = "fichada" | "manual";

export interface CambioHistorial {
	campo: string;
	antes: unknown;
	despues: unknown;
	motivo: string;
	por: string;
	en: Date;
}

export interface Persona {
	id: string;
	nombre: string;
	apellido: string;
	email: string;
	dni: string | null; // solo dígitos: "43552355"
	rol: Rol;
	activo: boolean;
	llaveroUid: string | null;
	jornadaAbiertaId: string | null;
	precioHora: number | null; // solo secretarias: se carga en Carga de datos → Precio/hora - Secretarias
	/** Solo profesoras (vienen de Teachers) */
	telefono?: string;
	titulo?: string;
	/** Solo profesoras: Teachers.cursosAsignados, tal cual está guardado (puede tener cursos borrados) */
	cursoIds?: string[];
}

export type PersonaInput = Pick<
	Persona,
	"nombre" | "apellido" | "email" | "dni" | "rol" | "activo" | "telefono" | "titulo"
>;

export interface HorarioCurso {
	dia: DiaSemana;
	inicio: string; // "18:00"
	fin: string; // "19:30"
}

export interface Curso {
	id: string;
	nombre: string;
	activo: boolean;
	/** Profesoras del curso (Teachers.cursosAsignados): cobran su pago mensual */
	profesoraIds: string[];
	profesoraNombres: string[];
	/**
	 * Días que da cada profesora del curso (por id). null = todos los días.
	 * Las titulares de cada clase salen de acá: ver titularesDelDia (titulares.ts).
	 */
	diasPorProfesora: Record<string, DiaSemana[] | null>;
	horarios: HorarioCurso[];
	fechaInicio: string; // "YYYY-MM-DD"
	fechaFin: string;
	/** Pago mensual de cada profesora = montoFijo × cantidadAlumnos × porcentaje / 100 */
	cantidadAlumnos: number | null; // la que se usa: la corregida si hay, si no la de inscriptos
	montoFijo: number | null; // monto fijo por alumno, por mes
	porcentajes: Record<string, number>; // por id de profesora: 0 a 100
	/** Inscriptos según Users + Hijos (`cursos` array-contains). null si no se contó */
	alumnosInscriptos: number | null;
	/** true si Juan corrigió la cantidad de alumnos a mano */
	alumnosCorregidos: boolean;
	/** Horarios del curso que no se pudieron usar (sin hora de fin, "A definir"…) */
	horariosSinInterpretar: string[];
	/**
	 * Días de la semana con clase (sin repetir, aunque el horario no tenga hora de fin).
	 * Con esto se cuentan las clases del mes para el pago por clase estimado.
	 */
	diasDeClase: DiaSemana[];
}

/** Lo que se edita en Carga de datos → Liquidación de cursos */
export interface LiquidacionCursoInput {
	profesoraIds: string[];
	/** Días que da cada profesora (solo si el curso tiene días de clase) */
	diasPorProfesora: Record<string, DiaSemana[]>;
	/** null = usar la cantidad de inscriptos */
	cantidadAlumnosManual: number | null;
	montoFijo: number | null;
	porcentajes: Record<string, number>;
}

export interface Jornada {
	id: string;
	personalId: string;
	personalNombre: string;
	fecha: string;
	entrada: Date;
	salida: Date | null;
	minutos: number | null;
	incompleta: boolean;
	estado: EstadoRegistro;
	origen: OrigenRegistro;
	fueOffline: boolean;
	historial: CambioHistorial[];
	/** Fichadas del kiosco que generaron la entrada y la salida (null = cargada a mano) */
	fichadaEntradaId: string | null;
	fichadaSalidaId: string | null;
}

export interface ClaseDictada {
	id: string; // `${cursoId}_${fecha}_${HHMM}`
	cursoId: string;
	cursoNombre: string;
	fecha: string;
	horaInicio: string;
	horaFin: string;
	profesoraDictoId: string;
	profesoraDictoNombre: string;
	esReemplazo: boolean;
	titularIds: string[];
	llegada: Date | null;
	minutosTarde: number | null;
	estado: EstadoRegistro;
	contarIgual: boolean;
	origen: OrigenRegistro;
	fueOffline: boolean;
	historial: CambioHistorial[];
}

/** "feriado" = nacional o provincial · "instituto" = día especial propio del instituto */
export type TipoDiaEspecial = "feriado" | "instituto";

export interface DiaEspecial {
	id: string;
	fecha: string;
	descripcion: string;
	todoElDia: boolean;
	desde: string | null; // "14:00" si es parcial
	hasta: string | null;
	cursoIds: string[]; // [] = todos los cursos
	tipo: TipoDiaEspecial;
	/** El instituto permanece cerrado (informativo: las jornadas de secretarias cuentan siempre) */
	cerrado: boolean;
	/** No se dictan clases: las clases alcanzadas no cuentan para el recibo */
	sinClases: boolean;
	/** false = el instituto no se adhiere: el día se ignora en el calendario y los recibos */
	adherido: boolean;
	/** Viene del calendario oficial (lib/asistencia/feriados.ts), no lo cargó Juan */
	predeterminado: boolean;
}

/** Lo que se carga desde el formulario de "Agregar día especial" */
export type DiaEspecialInput = Pick<
	DiaEspecial,
	"fecha" | "descripcion" | "tipo" | "cerrado" | "sinClases"
>;

export type ResultadoFichada =
	| "entrada"
	| "salida"
	| "clase"
	| "sin_clase"
	| "ya_registrado"
	| "llavero_desconocido"
	| "llavero_baja"
	| "personal_inactivo";

export interface Fichada {
	id: string;
	llaveroUid: string;
	/** Número grabado en el llavero ("101"), si el lector lo pudo leer */
	llaveroNumero: string | null;
	personalId: string | null;
	personalNombre: string | null;
	resultado: ResultadoFichada;
	fecha: string;
	horaEfectiva: Date;
	fueOffline: boolean;
	resuelta: boolean;
	jornadaId: string | null;
	claseDictadaId: string | null;
	/** Texto que dejó el kiosco (ej.: "Tu próxima clase es a las 18:00") */
	detalle: string | null;
}

export type EstadoLlavero = "SinAsignar" | "Asignado" | "Baja";

/**
 * Llaveros/{id}. El id es el UID de fábrica (hexa en mayúsculas sin separadores):
 * el doc se crea solo la primera vez que se apoya en el lector.
 * Excepción: los cargados de antemano por número (`num-101`…), con
 * `pendienteDeLectura: true`. Cuando el lector lee por primera vez un llavero
 * con ese número grabado, el kiosco lo vincula: crea `Llaveros/{UID}` con los
 * mismos datos (y la asignación), y borra el pendiente.
 */
export interface Llavero {
	uid: string; // id del doc: el UID de fábrica, o "num-101" si todavía no se leyó
	numero: string | null; // el grabado en el llavero ("101")
	personalId: string | null;
	estado: EstadoLlavero;
	creadoEn: Date | null;
	ultimoUsoEn: Date | null;
	/** Cargado de antemano: todavía no se apoyó en el lector (no se sabe su UID) */
	pendienteDeLectura: boolean;
}

/** Id del llavero cargado de antemano por su número */
export const idLlaveroPendiente = (numero: string) => `num-${numero}`;

export interface Cierre {
	periodo: string; // "YYYY-MM"
	confirmado: boolean;
	confirmadoEn: Date | null;
	bloqueado: boolean;
}

/**
 * Lo que cobra una profesora por un curso en el mes (pago mensual fijo):
 * va en el array `cursos` del recibo.
 */
export interface CursoLiquidado {
	cursoId: string;
	cursoNombre: string;
	cantidadAlumnos: number | null;
	montoFijo: number | null;
	porcentaje: number | null;
	total: number; // 0 si falta algún dato
}

/**
 * Un reemplazo del mes en el recibo de una profesora. El valor de la clase es
 * el pago mensual de la titular en ese curso ÷ las clases del curso en el mes
 * según sus horarios (feriados incluidos). Se le resta a la titular y se le suma
 * a la que dio la clase. Si el curso tiene varias titulares, cada una pierde su
 * parte y la reemplazante cobra la suma (un renglón por titular).
 */
export interface ReemplazoLiquidado {
	claseId: string; // = id de ClasesDictadas
	fecha: string;
	cursoId: string;
	cursoNombre: string;
	/** "dio": dio la clase en lugar de la titular (suma) · "recibio": la reemplazaron (resta) */
	tipo: "dio" | "recibio";
	/** La titular (si tipo = "dio") o la reemplazante (si tipo = "recibio") */
	otraId: string;
	otraNombre: string;
	clasesDelMes: number; // divisor usado
	/** Valor de la clase, siempre positivo (0 si faltan datos del curso) */
	monto: number;
}

/**
 * Una clase que dio la profesora en el mes: va en el array `clases` del recibo
 * como control de asistencia (no define el monto, que es mensual fijo).
 */
export interface ClaseLiquidada {
	claseId: string; // = id de ClasesDictadas
	fecha: string;
	cursoId: string;
	cursoNombre: string;
	horaInicio: string;
	horaFin: string;
	esReemplazo: boolean;
	/** Solo en recibos viejos, de cuando se cobraba por clase dada */
	precio?: number;
}

/** Un renglón del recibo impreso: Concepto / Cantidad / Precio / Total */
export interface LineaRecibo {
	concepto: string;
	cantidad: string;
	precio: number;
	total: number;
}

/**
 * Lo que el director cambió a mano en el recibo. Si existe, el recibo se imprime
 * con estos datos en lugar de los calculados (que se guardan igual, para saber si
 * el registro cambió después). "Volver a generar" la descarta.
 */
export interface EdicionRecibo {
	nombreRecibo: string;
	dni: string | null;
	fechaEmision: string; // "YYYY-MM-DD"
	lineas: LineaRecibo[];
	total: number;
	editadoEn: Date | null;
}

/**
 * Lo que ve la dueña del recibo ("Mis recibos"): RecibosPersonalPublicados/{id}.
 * Se publica al guardar la imagen. No tiene el detalle del cálculo (porcentajes,
 * monto fijo), que queda solo para el director en RecibosPersonal.
 */
export interface ReciboPublicado {
	id: string; // = id del recibo y de su imagen
	personalId: string;
	periodo: string;
	numeroTexto: string | null;
	fechaEmision: string | null;
	nombreRecibo: string;
	total: number;
	version: number;
}

/** RecibosPersonal/{personalId}_{YYYY-MM}: se genera de a una persona (solo director) */
export interface Recibo {
	id: string;
	personalId: string;
	/**
	 * Email de la persona (en minúsculas) al generar el recibo. Las secretarias ven
	 * sus recibos en el panel por este email; las profesoras, por su uid (= personalId).
	 */
	email: string | null;
	nombre: string;
	rol: Rol;
	periodo: string;
	numero: number | null; // correlativo del año de emisión
	numeroTexto: string | null; // "050/26"
	fechaEmision: string | null; // "YYYY-MM-DD"
	nombreRecibo: string; // "Apellido, Nombre", como va impreso
	dni: string | null;
	totalMinutos: number | null; // secretarias
	precioHora: number | null; // secretarias
	totalClases: number | null; // profesoras
	clases: ClaseLiquidada[]; // profesoras: control de asistencia
	cursos: CursoLiquidado[]; // profesoras: lo que cobra (recibos viejos: [])
	reemplazos: ReemplazoLiquidado[]; // profesoras: lo que suma o resta por reemplazos
	/** Lo calculado al generar. Si hay edición, lo que se paga es `edicion.total` (ver totalDelRecibo) */
	totalAPagar: number;
	/** Cambios a mano del director (null = se imprime lo calculado) */
	edicion: EdicionRecibo | null;
	version: number;
	/** Versión del recibo que tiene guardada la imagen (RecibosImagenes) */
	imagenVersion: number | null;
	generadoEn: Date | null;
	enviadoEn: Date | null;
}

/** Lo que se paga según el recibo: lo editado a mano si hay, si no lo calculado */
export const totalDelRecibo = (r: Pick<Recibo, "edicion" | "totalAPagar">) =>
	r.edicion ? r.edicion.total : r.totalAPagar;

export const nombreCompleto = (p: Pick<Persona, "nombre" | "apellido">) =>
	`${p.nombre} ${p.apellido}`.trim();

export const idClaseDictada = (
	cursoId: string,
	fecha: string,
	horaInicio: string,
) => `${cursoId}_${fecha}_${horaInicio.replace(":", "")}`;
