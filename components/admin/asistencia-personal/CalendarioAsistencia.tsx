"use client";

/**
 * CalendarioAsistencia
 * ─────────────────────────────────────────────────────────────────────────────
 * Vista mensual para que Juan revise la asistencia del personal, corrija lo que
 * haga falta y confirme el mes para generar los recibos.
 *
 * El componente es "presentacional": no lee ni escribe Firebase. El padre le pasa
 * los datos del período y recibe los eventos (cambiar mes, editar, confirmar).
 *
 * Reglas que aplica (ver SISTEMA_ASISTENCIA.md §7.3 y §8.5):
 * - Secretarias: suman las jornadas Activas con salida. Los días especiales NO las afectan.
 * - Profesoras: suman las clases dictadas Activas, salvo las que caen en un día
 *   especial (completo o parcial, para todos o algunos cursos), a menos que Juan
 *   haya marcado `contarIgual`.
 * - Las exclusiones se calculan acá, en el momento: si Juan carga un día especial
 *   después, los totales se recalculan solos.
 *
 * Dependencias: framer-motion, lucide-react y los componentes de shadcn
 * `@/components/ui/button` y `@/components/ui/dialog`.
 */

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
	AlertTriangle,
	Ban,
	Briefcase,
	CalendarDays,
	CalendarOff,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock,
	FileCheck2,
	GraduationCap,
	Loader2,
	Lock,
	Pencil,
	Plus,
	Repeat,
	UserCheck,
	UserPlus,
	Users,
	WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { formatPesos } from "@/lib/asistencia/dinero";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type TipoEmpleado = "secretaria" | "profesora";

export interface EmpleadoCalendario {
	id: string; // id de Personal
	nombreCompleto: string;
	tipo: TipoEmpleado; // = Personal.rol
}

export interface JornadaCalendario {
	id: string;
	empleadoId: string;
	empleadoNombre: string;
	fecha: string; // "YYYY-MM-DD" (hora AR)
	entrada: Date;
	salida: Date | null;
	minutos: number | null;
	incompleta: boolean;
	estado: "Activa" | "Anulada";
	fueOffline?: boolean;
}

export interface ClaseCalendario {
	/** `${cursoId}_${fecha}_${HHMM}`: el mismo id que ClasesDictadas */
	id: string;
	fecha: string;
	cursoId: string;
	cursoNombre: string;
	horaInicio: string; // "18:00"
	horaFin: string; // "19:30"
	titularIds: string[]; // titulares de ese día del curso (titularesDelDia)
	titularNombres: string[];
	/** null = la clase estaba programada y no tiene registro */
	dictada: {
		profesoraId: string;
		profesoraNombre: string;
		esReemplazo: boolean;
		minutosTarde: number | null;
		estado: "Activa" | "Anulada";
		contarIgual: boolean; // override de Juan sobre un día especial
		fueOffline?: boolean;
	} | null;
}

export interface DiaEspecialCalendario {
	id: string;
	fecha: string;
	descripcion: string;
	todoElDia: boolean;
	desde: string | null; // "14:00" si es parcial
	hasta: string | null; // "18:00" si es parcial
	cursoIds: string[]; // [] = todos los cursos
	tipo: "feriado" | "instituto"; // nacional/provincial o propio del instituto
	cerrado: boolean; // el instituto no abre (no afecta a las jornadas)
	sinClases: boolean; // las clases alcanzadas no cuentan
}

export interface PendienteCalendario {
	id: string;
	fecha: string;
	tipo: "sin_clase" | "llavero_desconocido";
	empleadoNombre: string | null;
	hora: string; // "18:05"
	descripcion: string;
}

export interface ResumenEmpleado {
	empleadoId: string;
	nombreCompleto: string;
	tipo: TipoEmpleado;
	totalMinutos: number; // secretarias
	totalClases: number; // profesoras (ya sin las excluidas)
	clasesExcluidas: number; // profesoras: dictadas en día especial que no cuentan
	jornadasIncompletas: number;
	clasesSinRegistro: number;
}

/** Lo que cobra cada persona en el mes (lo calcula el padre con la liquidación) */
export interface MontoEmpleado {
	/** Secretarias: precio por hora. Profesoras: null (cobran un monto mensual por curso) */
	precio: number | null;
	precioEsPromedio: boolean;
	/** Profesoras: cursos que cobra en el mes */
	cantidadCursos?: number;
	totalAPagar: number;
	faltaPrecio: boolean;
}

export interface EstadoRecibosMes {
	generados: number;
	desactualizados: number;
	total: number;
}

interface CalendarioAsistenciaProps {
	periodo: string; // "YYYY-MM"
	onCambiarPeriodo: (periodo: string) => void;
	empleados: EmpleadoCalendario[];
	jornadas: JornadaCalendario[];
	clases: ClaseCalendario[];
	diasEspeciales?: DiaEspecialCalendario[];
	pendientes?: PendienteCalendario[];
	isLoading?: boolean;
	/** Por id de empleado */
	montos?: Record<string, MontoEmpleado>;
	recibos?: EstadoRecibosMes;
	onAgregarJornada?: (fecha: string) => void;
	onEditarJornada?: (jornada: JornadaCalendario) => void;
	onEditarClase?: (clase: ClaseCalendario) => void;
	onAgregarDiaEspecial?: (fecha: string) => void;
	onEditarDiaEspecial?: (dia: DiaEspecialCalendario) => void;
	onResolverPendiente?: (pendiente: PendienteCalendario) => void;
	/** Botón de abajo del calendario: lleva a la vista previa de recibos */
	onGenerarRecibos?: () => void;
	/**
	 * false = vista de secretaria: sin métricas de arriba, sin precios ni totales
	 * a cobrar y sin la parte de recibos. Por defecto true (director).
	 */
	verMontos?: boolean;
	/**
	 * "YYYY-MM-DD" desde que cuenta el registro: no se puede ir a meses anteriores
	 * y los días previos se muestran deshabilitados.
	 */
	fechaInicio?: string;
}

// ─── Helpers de fecha (todo en hora argentina) ────────────────────────────────

const TZ = "America/Argentina/Buenos_Aires";
const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
	"Enero",
	"Febrero",
	"Marzo",
	"Abril",
	"Mayo",
	"Junio",
	"Julio",
	"Agosto",
	"Septiembre",
	"Octubre",
	"Noviembre",
	"Diciembre",
];

const fechaAR = (d: Date) =>
	new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD

const horaAR = (d: Date) =>
	new Intl.DateTimeFormat("es-AR", {
		timeZone: TZ,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(d);

const nombrePeriodo = (periodo: string) => {
	const [anio, mes] = periodo.split("-").map(Number);
	return `${MESES[mes - 1]} ${anio}`;
};

const sumarMeses = (periodo: string, delta: number) => {
	const [anio, mes] = periodo.split("-").map(Number);
	const total = anio * 12 + (mes - 1) + delta;
	const nuevoAnio = Math.floor(total / 12);
	const nuevoMes = (total % 12) + 1;
	return `${nuevoAnio}-${String(nuevoMes).padStart(2, "0")}`;
};

const fechaLarga = (fecha: string) => {
	const [anio, mes, dia] = fecha.split("-").map(Number);
	const d = new Date(Date.UTC(anio, mes - 1, dia, 12));
	const texto = new Intl.DateTimeFormat("es-AR", {
		timeZone: "UTC",
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(d);
	return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/** Celdas del mes empezando en lunes; null = relleno */
const celdasDelMes = (periodo: string): (string | null)[] => {
	const [anio, mes] = periodo.split("-").map(Number);
	const primerDia = new Date(Date.UTC(anio, mes - 1, 1));
	const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
	const offset = (primerDia.getUTCDay() + 6) % 7; // lunes = 0
	const celdas: (string | null)[] = Array(offset).fill(null);
	for (let d = 1; d <= diasEnMes; d++) {
		celdas.push(`${periodo}-${String(d).padStart(2, "0")}`);
	}
	while (celdas.length % 7 !== 0) celdas.push(null);
	return celdas;
};

const minutosDeJornada = (j: JornadaCalendario): number | null => {
	if (j.estado === "Anulada" || j.incompleta || !j.salida) return null;
	if (j.minutos != null) return j.minutos;
	return Math.max(
		0,
		Math.round((j.salida.getTime() - j.entrada.getTime()) / 60000),
	);
};

export const formatMinutos = (min: number) => {
	const h = Math.floor(min / 60);
	const m = min % 60;
	if (h === 0) return `${m} min`;
	return `${h} h ${String(m).padStart(2, "0")} min`;
};

const iniciales = (nombre: string) => {
	const partes = nombre.trim().split(/\s+/);
	if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
	return (
		partes[0].charAt(0) + partes[partes.length - 1].charAt(0)
	).toUpperCase();
};

const rangoDiaEspecial = (d: DiaEspecialCalendario) =>
	d.todoElDia ? "Todo el día" : `${d.desde ?? "?"}–${d.hasta ?? "?"}`;

/**
 * Devuelve el día especial que excluye a la clase, o null.
 * Excluye si: el día es "sin clases", misma fecha, el curso está alcanzado
 * (cursoIds vacío o lo incluye) y es todo el día o el turno se superpone con [desde, hasta).
 * Las horas "HH:MM" se comparan como string (funciona con formato de 24 h y 2 dígitos).
 */
export const diaEspecialQueExcluye = (
	clase: Pick<ClaseCalendario, "fecha" | "cursoId" | "horaInicio" | "horaFin">,
	dias: DiaEspecialCalendario[],
): DiaEspecialCalendario | null =>
	dias.find((d) => {
		if (d.fecha !== clase.fecha || !d.sinClases) return false;
		if (d.cursoIds.length > 0 && !d.cursoIds.includes(clase.cursoId))
			return false;
		if (d.todoElDia) return true;
		if (!d.desde || !d.hasta) return false;
		return clase.horaInicio < d.hasta && clase.horaFin > d.desde;
	}) ?? null;

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function Badge({
	className,
	icon: Icon,
	children,
}: {
	className: string;
	icon?: React.ComponentType<{ className?: string }>;
	children: React.ReactNode;
}) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${className}`}
		>
			{Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
			{children}
		</span>
	);
}

function KpiCard({
	label,
	value,
	hint,
	icon: Icon,
	iconBox,
	valueClass = "text-[#252d62]",
}: {
	label: string;
	value: string | number;
	hint: string;
	icon: React.ComponentType<{ className?: string }>;
	iconBox: string;
	valueClass?: string;
}) {
	return (
		<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
			<div className="flex items-center justify-between mb-3">
				<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
					{label}
				</p>
				<div className={`p-2 rounded-lg ${iconBox}`}>
					<Icon className="w-4 h-4" />
				</div>
			</div>
			<p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
			<p className="text-xs text-gray-400 mt-1">{hint}</p>
		</div>
	);
}

const ESTILO_DIA_ESPECIAL = "bg-sky-50 text-sky-700 border-sky-100";

/** Feriados (nacionales/provinciales) en celeste; días del instituto en turquesa */
const COLORES_DIA = {
	feriado: {
		celda: "bg-sky-50/50",
		chip: "text-sky-700 bg-sky-100/70",
		punto: "bg-sky-500",
		tarjeta: "bg-sky-50 border-sky-200",
		icono: "text-sky-600",
		titulo: "text-sky-900",
		texto: "text-sky-700",
		boton: "text-sky-500 hover:text-sky-800 hover:bg-sky-100",
	},
	instituto: {
		celda: "bg-teal-50/50",
		chip: "text-teal-700 bg-teal-100/70",
		punto: "bg-teal-500",
		tarjeta: "bg-teal-50 border-teal-200",
		icono: "text-teal-600",
		titulo: "text-teal-900",
		texto: "text-teal-700",
		boton: "text-teal-500 hover:text-teal-800 hover:bg-teal-100",
	},
} as const;

const efectoDiaEspecial = (d: DiaEspecialCalendario) =>
	d.cerrado && d.sinClases
		? "Instituto cerrado · sin clases"
		: d.sinClases
			? "Sin clases"
			: d.cerrado
				? "Instituto cerrado · las clases se dictan"
				: "Día normal";

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CalendarioAsistencia({
	periodo,
	onCambiarPeriodo,
	empleados,
	jornadas,
	clases,
	diasEspeciales = [],
	pendientes = [],
	isLoading = false,
	montos = {},
	recibos,
	onAgregarJornada,
	onEditarJornada,
	onEditarClase,
	onAgregarDiaEspecial,
	onEditarDiaEspecial,
	onResolverPendiente,
	onGenerarRecibos,
	verMontos = true,
	fechaInicio = "",
}: CalendarioAsistenciaProps) {
	const periodoMinimo = fechaInicio.slice(0, 7);
	const enPrimerMes = !!fechaInicio && periodo === periodoMinimo;
	const antesDelInicio = (fecha: string) => !!fechaInicio && fecha < fechaInicio;
	const [filtroTipo, setFiltroTipo] = useState<"todos" | TipoEmpleado>(
		"todos",
	);
	const [filtroEmpleado, setFiltroEmpleado] = useState<string>("todos");
	const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

	const hoy = fechaAR(new Date());
	const celdas = useMemo(() => celdasDelMes(periodo), [periodo]);

	// ── Exclusión por días especiales (precalculada por clase) ─────────────────
	const exclusionPorClase = useMemo(() => {
		const mapa = new Map<string, DiaEspecialCalendario | null>();
		clases.forEach((c) =>
			mapa.set(c.id, diaEspecialQueExcluye(c, diasEspeciales)),
		);
		return mapa;
	}, [clases, diasEspeciales]);

	/** El día especial que la excluye, salvo que Juan haya marcado "contar igual" */
	const excluidaPor = (c: ClaseCalendario) =>
		c.dictada?.contarIgual ? null : (exclusionPorClase.get(c.id) ?? null);

	const cuentaParaRecibo = (c: ClaseCalendario) =>
		c.dictada?.estado === "Activa" && !excluidaPor(c);

	const esSinRegistro = (c: ClaseCalendario) =>
		!c.dictada && c.fecha < hoy && !exclusionPorClase.get(c.id);

	const diasEspecialesPorFecha = useMemo(() => {
		const mapa: Record<string, DiaEspecialCalendario[]> = {};
		diasEspeciales.forEach((d) => (mapa[d.fecha] ??= []).push(d));
		return mapa;
	}, [diasEspeciales]);

	// ── Filtros ────────────────────────────────────────────────────────────────
	const empleadosVisibles = useMemo(
		() =>
			empleados
				.filter((e) => filtroTipo === "todos" || e.tipo === filtroTipo)
				.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto)),
		[empleados, filtroTipo],
	);

	const verSecretarias = filtroTipo !== "profesora";
	const verProfesoras = filtroTipo !== "secretaria";

	const jornadasFiltradas = useMemo(
		() =>
			verSecretarias
				? jornadas.filter(
						(j) =>
							filtroEmpleado === "todos" || j.empleadoId === filtroEmpleado,
					)
				: [],
		[jornadas, filtroEmpleado, verSecretarias],
	);

	const clasesFiltradas = useMemo(
		() =>
			verProfesoras
				? clases.filter(
						(c) =>
							filtroEmpleado === "todos" ||
							c.titularIds.includes(filtroEmpleado) ||
							c.dictada?.profesoraId === filtroEmpleado,
					)
				: [],
		[clases, filtroEmpleado, verProfesoras],
	);

	const pendientesFiltrados = useMemo(
		() => (filtroEmpleado === "todos" ? pendientes : []),
		[pendientes, filtroEmpleado],
	);

	// ── Agrupado por día ───────────────────────────────────────────────────────
	const porDia = useMemo(() => {
		const mapa: Record<
			string,
			{
				jornadas: JornadaCalendario[];
				clases: ClaseCalendario[];
				pendientes: PendienteCalendario[];
			}
		> = {};
		const get = (f: string) =>
			(mapa[f] ??= { jornadas: [], clases: [], pendientes: [] });
		jornadasFiltradas.forEach((j) => get(j.fecha).jornadas.push(j));
		clasesFiltradas.forEach((c) => get(c.fecha).clases.push(c));
		pendientesFiltrados.forEach((p) => get(p.fecha).pendientes.push(p));
		Object.values(mapa).forEach((d) => {
			d.jornadas.sort((a, b) => a.entrada.getTime() - b.entrada.getTime());
			d.clases.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
		});
		return mapa;
	}, [jornadasFiltradas, clasesFiltradas, pendientesFiltrados]);

	const alertasDelDia = (fecha: string) => {
		const d = porDia[fecha];
		if (!d) return 0;
		return (
			d.jornadas.filter((j) => j.estado === "Activa" && j.incompleta).length +
			d.clases.filter(esSinRegistro).length +
			d.pendientes.length
		);
	};

	// ── Resumen del mes (siempre sobre TODOS los datos, sin filtros) ───────────
	const resumen: ResumenEmpleado[] = useMemo(() => {
		return empleados
			.map((e) => {
				const r: ResumenEmpleado = {
					empleadoId: e.id,
					nombreCompleto: e.nombreCompleto,
					tipo: e.tipo,
					totalMinutos: 0,
					totalClases: 0,
					clasesExcluidas: 0,
					jornadasIncompletas: 0,
					clasesSinRegistro: 0,
				};
				if (e.tipo === "secretaria") {
					jornadas
						.filter((j) => j.empleadoId === e.id && j.estado === "Activa")
						.forEach((j) => {
							if (j.incompleta || !j.salida) r.jornadasIncompletas++;
							r.totalMinutos += minutosDeJornada(j) ?? 0;
						});
				} else {
					clases.forEach((c) => {
						if (
							c.dictada?.estado === "Activa" &&
							c.dictada.profesoraId === e.id
						) {
							if (excluidaPor(c)) r.clasesExcluidas++;
							else r.totalClases++;
						}
						if (c.titularIds.includes(e.id) && esSinRegistro(c))
							r.clasesSinRegistro++;
					});
				}
				return r;
			})
			.sort((a, b) =>
				a.tipo === b.tipo
					? a.nombreCompleto.localeCompare(b.nombreCompleto)
					: a.tipo === "secretaria"
						? -1
						: 1,
			);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [empleados, jornadas, clases, exclusionPorClase, hoy]);

	const totales = useMemo(() => {
		const minutos = resumen.reduce((acc, r) => acc + r.totalMinutos, 0);
		const clasesDadas = resumen.reduce((acc, r) => acc + r.totalClases, 0);
		const excluidas = resumen.reduce((acc, r) => acc + r.clasesExcluidas, 0);
		const incompletas = resumen.reduce(
			(acc, r) => acc + r.jornadasIncompletas,
			0,
		);
		const sinRegistro = clases.filter(esSinRegistro).length;
		return {
			minutos,
			clasesDadas,
			excluidas,
			incompletas,
			sinRegistro,
			pendientes: pendientes.length,
			aRevisar: incompletas + sinRegistro + pendientes.length,
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [resumen, clases, pendientes, exclusionPorClase, hoy]);

	const totalAPagar = resumen.reduce(
		(acc, r) => acc + (montos[r.empleadoId]?.totalAPagar ?? 0),
		0,
	);

	const detalleDia = diaSeleccionado ? porDia[diaSeleccionado] : undefined;
	const especialesDelDia = diaSeleccionado
		? (diasEspecialesPorFecha[diaSeleccionado] ?? [])
		: [];

	// ── Render ─────────────────────────────────────────────────────────────────
	return (
		<div className="p-6 space-y-6 max-w-7xl mx-auto">
			{/* Encabezado */}
			<motion.div
				initial={{ opacity: 0, x: -20 }}
				animate={{ opacity: 1, x: 0 }}
				className="flex flex-col md:flex-row md:items-center justify-between gap-4"
			>
				<div className="flex items-center gap-3">
					<div className="bg-[#252d62] p-2.5 rounded-lg">
						<CalendarDays className="w-5 h-5 text-white" />
					</div>
					<div>
						<h1 className="text-2xl font-bold text-[#252d62]">
							Asistencia del personal
						</h1>
						<p className="text-sm text-gray-500">
							{verMontos
								? "Revisá el registro del mes y confirmalo para generar los recibos"
								: "Revisá y corregí el registro de asistencia del mes"}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 self-start md:self-auto">
					<Button
						variant="outline"
						size="icon"
						onClick={() => onCambiarPeriodo(sumarMeses(periodo, -1))}
						disabled={!!periodoMinimo && periodo <= periodoMinimo}
						title={
							!!periodoMinimo && periodo <= periodoMinimo
								? "El registro de asistencia empieza este mes"
								: undefined
						}
						className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl"
						aria-label="Mes anterior"
					>
						<ChevronLeft className="w-4 h-4" />
					</Button>
					<div className="min-w-[170px] text-center bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
						<p className="text-sm font-bold text-[#252d62]">
							{nombrePeriodo(periodo)}
						</p>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() => onCambiarPeriodo(sumarMeses(periodo, 1))}
						className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl"
						aria-label="Mes siguiente"
					>
						<ChevronRight className="w-4 h-4" />
					</Button>
					{periodo !== hoy.slice(0, 7) && (
						<Button
							variant="ghost"
							onClick={() => onCambiarPeriodo(hoy.slice(0, 7))}
							className="font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
						>
							Hoy
						</Button>
					)}
				</div>
			</motion.div>

			{/* Inicio del registro: los días anteriores no cuentan */}
			{enPrimerMes && fechaInicio > `${periodoMinimo}-01` && (
				<div className="p-3 bg-gray-50 border border-gray-200 text-gray-600 rounded-xl text-sm flex items-center gap-2">
					<CalendarDays className="w-4 h-4 shrink-0 text-gray-400" />
					<span>
						El registro de asistencia empieza el{" "}
						<strong>{Number(fechaInicio.slice(8))}/{fechaInicio.slice(5, 7)}</strong>: los
						días anteriores no se tienen en cuenta.
					</span>
				</div>
			)}

			{/* Banner de recibos generados */}
			{verMontos &&
				recibos &&
				recibos.generados + recibos.desactualizados > 0 &&
				(recibos.desactualizados > 0 ? (
					<div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-sm flex items-center gap-2">
						<AlertTriangle className="w-4 h-4 shrink-0" />
						<span>
							{recibos.desactualizados === 1
								? "1 recibo de "
								: `${recibos.desactualizados} recibos de `}
							<strong>{nombrePeriodo(periodo)}</strong>
							{recibos.desactualizados === 1
								? " quedó desactualizado por cambios en el registro. Volvé a generarlo."
								: " quedaron desactualizados por cambios en el registro. Volvé a generarlos."}
						</span>
					</div>
				) : (
					<div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm flex items-center gap-2">
						<Lock className="w-4 h-4 shrink-0" />
						<span>
							{recibos.generados === recibos.total ? (
								<>
									Los recibos de <strong>{nombrePeriodo(periodo)}</strong> están
									todos generados. Si corregís algo, podés volver a generarlos.
								</>
							) : (
								<>
									{recibos.generados} de {recibos.total} recibos de{" "}
									<strong>{nombrePeriodo(periodo)}</strong> generados.
								</>
							)}
						</span>
					</div>
				))}

			{isLoading ? (
				<div className="flex items-center justify-center h-96">
					<Loader2 className="w-10 h-10 animate-spin text-[#252d62]" />
				</div>
			) : (
				<>
					{/* KPIs (solo director) */}
					{verMontos && (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
						<KpiCard
							label="Horas secretarias"
							value={formatMinutos(totales.minutos)}
							hint="Jornadas completas del mes"
							icon={Briefcase}
							iconBox="bg-[#252d62]/10 text-[#252d62]"
						/>
						<KpiCard
							label="Clases dadas"
							value={totales.clasesDadas}
							hint={
								totales.excluidas > 0
									? `Incluye reemplazos · ${totales.excluidas} excluida${totales.excluidas === 1 ? "" : "s"} por día especial`
									: "Incluye reemplazos"
							}
							icon={GraduationCap}
							iconBox="bg-purple-50 text-purple-600"
							valueClass="text-gray-900"
						/>
						<KpiCard
							label="A revisar"
							value={totales.aRevisar}
							hint={
								totales.aRevisar === 0
									? "Todo en orden"
									: "Sin salida, sin registro o sin clase"
							}
							icon={AlertTriangle}
							iconBox={
								totales.aRevisar === 0
									? "bg-green-50 text-green-600"
									: "bg-amber-50 text-amber-600"
							}
							valueClass={
								totales.aRevisar === 0 ? "text-green-700" : "text-amber-700"
							}
						/>
						<KpiCard
							label="Personal"
							value={empleados.length}
							hint={`${empleados.filter((e) => e.tipo === "secretaria").length} secretarias · ${empleados.filter((e) => e.tipo === "profesora").length} profesoras`}
							icon={Users}
							iconBox="bg-blue-50 text-blue-600"
							valueClass="text-gray-900"
						/>
					</div>
					)}

					{/* Filtros */}
					<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row gap-3 md:items-center">
						<div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
							{(
								[
									["todos", "Todos"],
									["secretaria", "Secretarias"],
									["profesora", "Profesoras"],
								] as const
							).map(([valor, label]) => (
								<button
									key={valor}
									onClick={() => {
										setFiltroTipo(valor);
										setFiltroEmpleado("todos");
									}}
									className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-all ${
										filtroTipo === valor
											? "bg-white shadow-sm text-[#252d62] font-semibold"
											: "text-gray-500 hover:text-gray-700"
									}`}
								>
									{label}
								</button>
							))}
						</div>
						<select
							value={filtroEmpleado}
							onChange={(e) => setFiltroEmpleado(e.target.value)}
							className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] md:w-64"
						>
							<option value="todos">Todas las personas</option>
							{empleadosVisibles.map((e) => (
								<option key={e.id} value={e.id}>
									{e.nombreCompleto}
								</option>
							))}
						</select>
						<div className="md:ml-auto flex flex-wrap items-center gap-3 text-xs text-gray-500">
							<span className="flex items-center gap-1.5">
								<span className="w-2.5 h-2.5 rounded-full bg-[#252d62]" />{" "}
								Jornadas
							</span>
							<span className="flex items-center gap-1.5">
								<span className="w-2.5 h-2.5 rounded-full bg-purple-500" />{" "}
								Clases
							</span>
							<span className="flex items-center gap-1.5">
								<span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Día
								especial
							</span>
							<span className="flex items-center gap-1.5">
								<span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> A
								revisar
							</span>
						</div>
					</div>

					{/* Calendario */}
					<div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
						<div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
							{DIAS_CORTOS.map((d) => (
								<div
									key={d}
									className="px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider"
								>
									{d}
								</div>
							))}
						</div>
						<div className="grid grid-cols-7">
							{celdas.map((fecha, idx) => {
								if (!fecha) {
									return (
										<div
											key={`vacio-${idx}`}
											className="min-h-[72px] sm:min-h-[118px] border-b border-r border-gray-50 bg-gray-50/40"
										/>
									);
								}
								// Antes del inicio del registro: día deshabilitado, sin datos ni alertas
								if (antesDelInicio(fecha)) {
									return (
										<div
											key={fecha}
											title="Antes del inicio del registro"
											className="min-h-[72px] sm:min-h-[118px] border-b border-r border-gray-50 p-1.5 sm:p-2 bg-gray-50/60"
										>
											<span className="inline-flex items-center justify-center w-7 h-7 text-sm font-bold text-gray-300">
												{Number(fecha.slice(8))}
											</span>
										</div>
									);
								}
								const d = porDia[fecha];
								const especiales = diasEspecialesPorFecha[fecha] ?? [];
								const especialCompleto = especiales.find(
									(e) => e.todoElDia && e.cursoIds.length === 0,
								);
								// Si hay un feriado y un día del instituto, manda el feriado
								const colorDia =
									COLORES_DIA[
										especiales.some((e) => e.tipo === "feriado")
											? "feriado"
											: (especiales[0]?.tipo ?? "feriado")
									];
								const jornadasActivas =
									d?.jornadas.filter((j) => j.estado === "Activa") ?? [];
								const minutosDia = jornadasActivas.reduce(
									(acc, j) => acc + (minutosDeJornada(j) ?? 0),
									0,
								);
								// Solo las clases que cuentan (no anuladas ni excluidas)
								const clasesComputables =
									d?.clases.filter(
										(c) => c.dictada?.estado !== "Anulada" && !excluidaPor(c),
									) ?? [];
								const clasesDadas =
									clasesComputables.filter(cuentaParaRecibo).length;
								const clasesTotal = clasesComputables.length;
								const alertas = alertasDelDia(fecha);
								const esHoy = fecha === hoy;
								const esFuturo = fecha > hoy;
								const vacio =
									jornadasActivas.length === 0 &&
									clasesTotal === 0 &&
									especiales.length === 0;
								const soloProgramadas =
									esFuturo || (esHoy && clasesDadas === 0);
								const faltanClases =
									!soloProgramadas && clasesDadas < clasesTotal;

								return (
									<button
										key={fecha}
										onClick={() => setDiaSeleccionado(fecha)}
										className={`group relative flex flex-col justify-start min-h-[72px] sm:min-h-[118px] border-b border-r border-gray-50 p-1.5 sm:p-2 text-left transition-colors hover:bg-indigo-50/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#252d62]/20 ${
											especialCompleto
												? COLORES_DIA[especialCompleto.tipo].celda
												: esFuturo
													? "bg-gray-50/30"
													: "bg-white"
										}`}
									>
										<div className="flex items-start justify-between">
											<span
												className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
													esHoy
														? "bg-[#252d62] text-white"
														: esFuturo
															? "text-gray-400"
															: "text-gray-700 group-hover:text-[#4338ca]"
												}`}
											>
												{Number(fecha.slice(8))}
											</span>
											{alertas > 0 && (
												<span className="hidden sm:inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
													{alertas}
												</span>
											)}
										</div>

										{/* Mobile: puntos */}
										<div className="flex gap-1 mt-1 sm:hidden">
											{jornadasActivas.length > 0 && (
												<span className="w-2 h-2 rounded-full bg-[#252d62]" />
											)}
											{clasesTotal > 0 && (
												<span className="w-2 h-2 rounded-full bg-purple-500" />
											)}
											{especiales.length > 0 && (
												<span className={`w-2 h-2 rounded-full ${colorDia.punto}`} />
											)}
											{alertas > 0 && (
												<span className="w-2 h-2 rounded-full bg-amber-500" />
											)}
										</div>

										{/* Desktop: chips */}
										<div className="hidden sm:flex flex-col gap-1 mt-1.5 w-full">
											{especiales.length > 0 && (
												<span
													className={`flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md truncate ${colorDia.chip}`}
													title={especiales
														.map(
															(e) => `${e.descripcion} (${rangoDiaEspecial(e)})`,
														)
														.join(" · ")}
												>
													<CalendarOff className="w-3 h-3 shrink-0" />
													<span className="truncate">
														{especiales.length === 1
															? especiales[0].todoElDia
																? especiales[0].descripcion
																: `${especiales[0].desde}–${especiales[0].hasta}`
															: `${especiales.length} días especiales`}
													</span>
												</span>
											)}
											{jornadasActivas.length > 0 && (
												<span className="flex items-center gap-1 text-[11px] font-semibold text-[#252d62] bg-indigo-50 px-1.5 py-0.5 rounded-md truncate">
													<Briefcase className="w-3 h-3 shrink-0" />
													{minutosDia > 0
														? formatMinutos(minutosDia)
														: `${jornadasActivas.length} jornada${jornadasActivas.length > 1 ? "s" : ""}`}
												</span>
											)}
											{clasesTotal > 0 && (
												<span
													className={`flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md truncate ${
														soloProgramadas
															? "text-gray-500 bg-gray-100"
															: faltanClases
																? "text-amber-700 bg-amber-50"
																: "text-purple-700 bg-purple-50"
													}`}
												>
													<GraduationCap className="w-3 h-3 shrink-0" />
													{soloProgramadas
														? `${clasesTotal} programada${clasesTotal > 1 ? "s" : ""}`
														: `${clasesDadas}/${clasesTotal} clases`}
												</span>
											)}
											{vacio && !esFuturo && (
												<span className="text-[11px] text-gray-300">—</span>
											)}
										</div>
									</button>
								);
							})}
						</div>
					</div>

					{/* Resumen por persona */}
					<div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
						<div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
							<p className="text-sm text-gray-500">
								Resumen de {nombrePeriodo(periodo)} · {resumen.length} personas
							</p>
							<p className="text-sm font-bold text-[#252d62] text-right">
								{formatMinutos(totales.minutos)} · {totales.clasesDadas} clases
								{verMontos && <> · {formatPesos(totalAPagar)}</>}
							</p>
						</div>
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead className="bg-white">
									<tr className="border-b border-gray-100">
										<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
											Nombre
										</th>
										<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
											Cargo
										</th>
										<th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
											Total del mes
										</th>
										{verMontos && (
											<>
												<th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
													Precio
												</th>
												<th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
													Total a cobrar
												</th>
											</>
										)}
										<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
											Estado
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-50">
									{resumen.length === 0 && (
										<tr>
											<td
												colSpan={verMontos ? 6 : 4}
												className="px-6 py-12 text-center text-gray-400"
											>
												No hay personal cargado.
											</td>
										</tr>
									)}
									{resumen.map((r) => {
										const revisar =
											r.tipo === "secretaria"
												? r.jornadasIncompletas
												: r.clasesSinRegistro;
										const monto = montos[r.empleadoId];
										return (
											<tr
												key={r.empleadoId}
												onClick={() => {
													setFiltroTipo("todos");
													setFiltroEmpleado(r.empleadoId);
												}}
												className={`hover:bg-gray-50 transition-colors cursor-pointer ${
													filtroEmpleado === r.empleadoId
														? "bg-indigo-50/40"
														: ""
												}`}
											>
												<td className="px-6 py-4">
													<div className="flex items-center gap-3">
														<div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs shrink-0">
															{iniciales(r.nombreCompleto)}
														</div>
														<span className="font-medium text-gray-900 whitespace-nowrap">
															{r.nombreCompleto}
														</span>
													</div>
												</td>
												<td className="px-6 py-4">
													{r.tipo === "secretaria" ? (
														<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-[#252d62]">
															<Briefcase className="w-3 h-3" /> Secretaria
														</span>
													) : (
														<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
															<GraduationCap className="w-3 h-3" /> Profesora
														</span>
													)}
												</td>
												<td className="px-6 py-4 text-right whitespace-nowrap">
													<p className="font-bold text-[#252d62]">
														{r.tipo === "secretaria"
															? formatMinutos(r.totalMinutos)
															: `${r.totalClases} clase${r.totalClases === 1 ? "" : "s"}`}
													</p>
													{r.clasesExcluidas > 0 && (
														<p className="text-xs text-sky-700">
															+{r.clasesExcluidas} en día especial (no cuentan)
														</p>
													)}
												</td>
												{verMontos && (
												<>
												<td className="px-6 py-4 text-right whitespace-nowrap">
													{r.tipo === "profesora" ? (
														<>
															<p className="text-gray-900 font-medium">
																{monto?.cantidadCursos ?? 0} curso
																{monto?.cantidadCursos === 1 ? "" : "s"}
															</p>
															<p className="text-xs text-gray-400">pago mensual</p>
														</>
													) : monto?.precio != null ? (
														<>
															<p className="text-gray-900 font-medium">
																{formatPesos(monto.precio)}
															</p>
															<p className="text-xs text-gray-400">
																{r.tipo === "secretaria"
																	? "por hora"
																	: monto.precioEsPromedio
																		? "promedio por clase"
																		: "por clase"}
															</p>
														</>
													) : (
														<p className="text-xs font-semibold text-amber-600">
															Sin precio
														</p>
													)}
												</td>
												<td className="px-6 py-4 text-right whitespace-nowrap">
													<p className="font-bold text-[#252d62]">
														{formatPesos(monto?.totalAPagar ?? 0)}
													</p>
													{monto?.faltaPrecio && (
														<p className="text-xs text-amber-600">Falta precio</p>
													)}
												</td>
												</>
												)}
												<td className="px-6 py-4">
													{revisar === 0 ? (
														<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">
															<CheckCircle2 className="w-3 h-3" /> En orden
														</span>
													) : (
														<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 whitespace-nowrap">
															<AlertTriangle className="w-3 h-3" />
															{r.tipo === "secretaria"
																? `${revisar} sin salida`
																: `${revisar} sin registro`}
														</span>
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
						{filtroEmpleado !== "todos" && (
							<div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
								<button
									onClick={() => setFiltroEmpleado("todos")}
									className="text-sm font-semibold text-gray-500 hover:text-[#252d62] transition-colors"
								>
									Quitar filtro de persona
								</button>
							</div>
						)}
					</div>

					{/* Recibos (solo director) */}
					{verMontos && onGenerarRecibos && (
					<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
						<div className="flex items-start gap-3">
							<div className="w-12 h-12 bg-indigo-50 text-[#252d62] rounded-xl flex items-center justify-center shrink-0">
								<FileCheck2 className="w-6 h-6" />
							</div>
							<div>
								<h3 className="text-lg font-bold text-gray-900">
									Recibos de {nombrePeriodo(periodo)}
								</h3>
								<p className="text-sm text-gray-500">
									{totales.aRevisar === 0
										? "Todo está en orden. Revisá la vista previa y generá el recibo de cada persona."
										: `Hay ${totales.aRevisar} registro${totales.aRevisar === 1 ? "" : "s"} para revisar antes de generar los recibos. Igual podés seguir si ya lo verificaste.`}
								</p>
							</div>
						</div>
						<Button
							onClick={onGenerarRecibos}
							disabled={resumen.length === 0}
							className="bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold py-5 px-6 rounded-xl flex items-center gap-2 shadow-md transition-all shrink-0"
						>
							<FileCheck2 className="w-5 h-5" />
							Generar recibos
						</Button>
					</div>
					)}
				</>
			)}

			{/* ══ MODAL: DETALLE DEL DÍA ══ */}
			<Dialog
				open={!!diaSeleccionado}
				onOpenChange={(open) => !open && setDiaSeleccionado(null)}
			>
				<DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-2xl [&>button]:text-white [&>button]:opacity-80">
					{diaSeleccionado && (
						<>
							<div className="bg-[#252d62] p-6 text-white">
								<DialogTitle className="text-xl font-black mb-1 flex items-center gap-2">
									<CalendarDays className="w-5 h-5 text-indigo-300" />
									{fechaLarga(diaSeleccionado)}
								</DialogTitle>
								<DialogDescription className="text-indigo-200 text-sm font-medium">
									{detalleDia
										? `${detalleDia.jornadas.length} jornada${detalleDia.jornadas.length === 1 ? "" : "s"} · ${detalleDia.clases.length} clase${detalleDia.clases.length === 1 ? "" : "s"}`
										: "Sin actividad registrada"}
									{especialesDelDia.length > 0 && " · Día especial"}
								</DialogDescription>
							</div>

							<div className="p-3 bg-gray-50 max-h-[60vh] overflow-y-auto space-y-4">
								{/* Días especiales */}
								{(especialesDelDia.length > 0 || onAgregarDiaEspecial) && (
									<section className="space-y-2">
										<div className="flex items-center justify-between px-1">
											<p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
												Día especial
											</p>
											{onAgregarDiaEspecial && (
												<button
													onClick={() => onAgregarDiaEspecial(diaSeleccionado)}
													className="flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-900 transition-colors"
												>
													<Plus className="w-3.5 h-3.5" />
													{especialesDelDia.length > 0
														? "Agregar otro"
														: "Marcar como día especial"}
												</button>
											)}
										</div>
										{especialesDelDia.map((e) => {
											const color = COLORES_DIA[e.tipo];
											return (
											<div
												key={e.id}
												className={`p-3 border rounded-xl flex items-start justify-between gap-3 ${color.tarjeta}`}
											>
												<div className="flex items-start gap-2 min-w-0">
													<CalendarOff className={`w-4 h-4 mt-0.5 shrink-0 ${color.icono}`} />
													<div className="min-w-0">
														<p className={`text-sm font-bold truncate ${color.titulo}`}>
															{e.descripcion}
														</p>
														<p className={`text-xs ${color.texto}`}>
															{e.tipo === "feriado" ? "Feriado" : "Día del instituto"} ·{" "}
															{efectoDiaEspecial(e)}
															{e.sinClases && (
																<>
																	{" "}· {rangoDiaEspecial(e)} ·{" "}
																	{e.cursoIds.length === 0
																		? "Todos los cursos"
																		: `${e.cursoIds.length} curso${e.cursoIds.length === 1 ? "" : "s"}`}{" "}
																	· Las clases alcanzadas no cuentan
																</>
															)}
														</p>
													</div>
												</div>
												{onEditarDiaEspecial && (
													<button
														onClick={() => onEditarDiaEspecial(e)}
														className={`p-1.5 rounded-lg transition-colors shrink-0 ${color.boton}`}
														aria-label="Editar día especial"
													>
														<Pencil className="w-4 h-4" />
													</button>
												)}
											</div>
											);
										})}
									</section>
								)}

								{/* Pendientes */}
								{detalleDia && detalleDia.pendientes.length > 0 && (
									<section className="space-y-2">
										<p className="px-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
											Para revisar
										</p>
										{detalleDia.pendientes.map((p) => (
											<div
												key={p.id}
												className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between gap-3"
											>
												<div className="flex items-start gap-2 min-w-0">
													<AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
													<div className="min-w-0">
														<p className="text-sm font-bold text-amber-800 truncate">
															{p.empleadoNombre ?? "Llavero no asignado"} ·{" "}
															{p.hora}
														</p>
														<p className="text-xs text-amber-700">
															{p.descripcion}
														</p>
													</div>
												</div>
												{onResolverPendiente && (
													<Button
														size="sm"
														onClick={() => onResolverPendiente(p)}
														className="bg-[#252d62] hover:bg-[#1a2046] text-white rounded-lg shrink-0"
													>
														Resolver
													</Button>
												)}
											</div>
										))}
									</section>
								)}

								{/* Jornadas */}
								{verSecretarias && (
									<section className="space-y-2">
										<div className="flex items-center justify-between px-1">
											<p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
												Secretarias
											</p>
											{onAgregarJornada && (
												<button
													onClick={() => onAgregarJornada(diaSeleccionado)}
													className="flex items-center gap-1 text-xs font-bold text-[#252d62] hover:text-[#4338ca] transition-colors"
												>
													<Plus className="w-3.5 h-3.5" /> Agregar jornada
												</button>
											)}
										</div>
										{!detalleDia || detalleDia.jornadas.length === 0 ? (
											<p className="px-3 py-4 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-100">
												Sin jornadas registradas
											</p>
										) : (
											detalleDia.jornadas.map((j) => {
												const anulada = j.estado === "Anulada";
												const minutos = minutosDeJornada(j);
												return (
													<div
														key={j.id}
														className={`flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm ${anulada ? "opacity-60" : ""}`}
													>
														<div className="flex items-center gap-3 min-w-0">
															<div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs shrink-0">
																{iniciales(j.empleadoNombre)}
															</div>
															<div className="min-w-0">
																<p
																	className={`font-bold text-gray-900 text-sm truncate ${anulada ? "line-through" : ""}`}
																>
																	{j.empleadoNombre}
																</p>
																<p className="text-xs text-gray-500 flex items-center gap-1">
																	<Clock className="w-3 h-3" />
																	{horaAR(j.entrada)} →{" "}
																	{j.salida ? horaAR(j.salida) : "—"}
																	{j.fueOffline && (
																		<WifiOff
																			className="w-3 h-3 text-gray-400 ml-1"
																			aria-label="Fichada sin conexión"
																		/>
																	)}
																</p>
															</div>
														</div>
														<div className="flex items-center gap-2 shrink-0">
															{anulada ? (
																<Badge
																	icon={Ban}
																	className="bg-gray-100 text-gray-400 border-gray-200"
																>
																	Anulada
																</Badge>
															) : minutos != null ? (
																<Badge
																	icon={CheckCircle2}
																	className="bg-green-50 text-green-700 border-green-100"
																>
																	{formatMinutos(minutos)}
																</Badge>
															) : (
																<Badge
																	icon={AlertTriangle}
																	className="bg-amber-50 text-amber-700 border-amber-100"
																>
																	Sin salida
																</Badge>
															)}
															{onEditarJornada && (
																<button
																	onClick={() => onEditarJornada(j)}
																	className="p-1.5 rounded-lg text-gray-400 hover:text-[#252d62] hover:bg-indigo-50 transition-colors"
																	aria-label="Editar jornada"
																>
																	<Pencil className="w-4 h-4" />
																</button>
															)}
														</div>
													</div>
												);
											})
										)}
									</section>
								)}

								{/* Clases */}
								{verProfesoras && (
									<section className="space-y-2">
										<p className="px-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
											Clases
										</p>
										{!detalleDia || detalleDia.clases.length === 0 ? (
											<p className="px-3 py-4 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-100">
												No hay clases programadas
											</p>
										) : (
											detalleDia.clases.map((c) => {
												const d = c.dictada;
												const anulada = d?.estado === "Anulada";
												const excluyente = exclusionPorClase.get(c.id) ?? null;
												const excluida = !!excluyente && !d?.contarIgual;
												const futura = !d && c.fecha >= hoy;
												const titulares =
													c.titularNombres.length > 0
														? c.titularNombres.join(", ")
														: "Sin profesora asignada";
												return (
													<div
														key={c.id}
														className={`flex items-center justify-between gap-3 p-3 bg-white rounded-xl border shadow-sm ${
															excluida ? "border-sky-100" : "border-gray-100"
														} ${anulada ? "opacity-60" : ""}`}
													>
														<div className="min-w-0">
															<div className="flex items-center gap-2 mb-1">
																<span className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 shrink-0">
																	<Clock className="w-3 h-3" />
																	{c.horaInicio}–{c.horaFin}
																</span>
																<p
																	className={`font-bold text-gray-900 text-sm truncate ${anulada ? "line-through" : ""}`}
																>
																	{c.cursoNombre}
																</p>
															</div>
															<p className="text-xs text-gray-500 truncate">
																{d
																	? d.esReemplazo
																		? `Dio: ${d.profesoraNombre} · titular ${titulares}`
																		: d.profesoraNombre
																	: titulares}
																{d?.fueOffline && " · sin conexión"}
															</p>
															{excluyente && (
																<p
																	className={`text-xs mt-0.5 ${d?.contarIgual ? "text-indigo-600" : "text-sky-700"}`}
																>
																	{d?.contarIgual
																		? `Cuenta igual (Juan) · ${excluyente.descripcion}`
																		: `${excluyente.descripcion}: no cuenta para el recibo`}
																</p>
															)}
														</div>
														<div className="flex items-center gap-2 shrink-0">
															{anulada ? (
																<Badge
																	icon={Ban}
																	className="bg-gray-100 text-gray-400 border-gray-200"
																>
																	Anulada
																</Badge>
															) : excluida ? (
																<Badge
																	icon={CalendarOff}
																	className={ESTILO_DIA_ESPECIAL}
																>
																	{d ? "Dada · excluida" : "Excluida"}
																</Badge>
															) : d?.esReemplazo ? (
																<Badge
																	icon={Repeat}
																	className="bg-indigo-50 text-indigo-700 border-indigo-100"
																>
																	Reemplazo
																</Badge>
															) : d ? (
																d.minutosTarde && d.minutosTarde > 0 ? (
																	<Badge
																		icon={Clock}
																		className="bg-amber-50 text-amber-700 border-amber-100"
																	>
																		{d.minutosTarde} min tarde
																	</Badge>
																) : (
																	<Badge
																		icon={UserCheck}
																		className="bg-green-50 text-green-700 border-green-100"
																	>
																		Dada
																	</Badge>
																)
															) : futura ? (
																<Badge
																	icon={CalendarDays}
																	className="bg-gray-100 text-gray-500 border-gray-200"
																>
																	Programada
																</Badge>
															) : (
																<Badge
																	icon={AlertTriangle}
																	className="bg-amber-50 text-amber-700 border-amber-100"
																>
																	Sin registro
																</Badge>
															)}
															{/* Clase pasada sin registro (o anulada): se puede asignar quién la dio */}
															{onEditarClase &&
																(!d || anulada) &&
																c.fecha <= hoy && (
																	<button
																		onClick={() => onEditarClase(c)}
																		className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#252d62] text-white hover:bg-[#1a2046] transition-colors"
																	>
																		<UserPlus className="w-3.5 h-3.5" /> Asignar
																	</button>
																)}
															{onEditarClase && d && !anulada && (
																<button
																	onClick={() => onEditarClase(c)}
																	className="p-1.5 rounded-lg text-gray-400 hover:text-[#252d62] hover:bg-indigo-50 transition-colors"
																	aria-label="Editar clase"
																>
																	<Pencil className="w-4 h-4" />
																</button>
															)}
														</div>
													</div>
												);
											})
										)}
									</section>
								)}
							</div>

							<div className="p-4 border-t border-gray-100 bg-white flex justify-end">
								<Button
									variant="ghost"
									onClick={() => setDiaSeleccionado(null)}
									className="font-bold text-gray-500 hover:bg-gray-100"
								>
									Cerrar
								</Button>
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>

		</div>
	);
}