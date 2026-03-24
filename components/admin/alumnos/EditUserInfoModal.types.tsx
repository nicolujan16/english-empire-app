import React from "react";
import { UserCheck } from "lucide-react";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface StudentRow {
	id: string;
	nombre: string;
	apellido: string;
	dni: string;
	email?: string;
	telefono?: string;
	fechaNacimiento: string;
	edad: number;
	cursos: string[];
	tipo: "Titular" | "Menor";
	isTutor: boolean;
	nombreTutor?: string;
}

export interface CourseMap {
	[key: string]: string;
}

export interface CourseDetails {
	id: string;
	nombre: string;
	cuota1a10: number;
	cuota11enAdelante: number;
	inscripcion: number;
}

export interface TitularForm {
	nombre: string;
	apellido: string;
	dni: string;
	fechaNacimiento: string;
	email: string;
	telefono: string;
}

export interface MenorForm {
	nombre: string;
	apellido: string;
	dni: string;
	fechaNacimiento: string;
}

export interface EtiquetaDisponible {
	id: string;
	nombre: string;
	descripcion?: string;
	color: string;
	descuentoInscripcion: number | null;
	descuentoCuota: number | null;
}

export type ReassignmentMap = Record<string, string>;
export type BajaMap = Record<string, boolean>;

// ─── Constantes de color ──────────────────────────────────────────────────────

export const COLORES_BADGE: Record<string, string> = {
	emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
	blue:    "bg-blue-100 text-blue-700 border-blue-200",
	violet:  "bg-violet-100 text-violet-700 border-violet-200",
	amber:   "bg-amber-100 text-amber-700 border-amber-200",
	rose:    "bg-rose-100 text-rose-700 border-rose-200",
	cyan:    "bg-cyan-100 text-cyan-700 border-cyan-200",
	gray:    "bg-gray-100 text-gray-700 border-gray-200",
};

export const COLORES_SELECTED: Record<string, string> = {
	emerald: "ring-2 ring-emerald-400 bg-emerald-50 border-transparent",
	blue:    "ring-2 ring-blue-400 bg-blue-50 border-transparent",
	violet:  "ring-2 ring-violet-400 bg-violet-50 border-transparent",
	amber:   "ring-2 ring-amber-400 bg-amber-50 border-transparent",
	rose:    "ring-2 ring-rose-400 bg-rose-50 border-transparent",
	cyan:    "ring-2 ring-cyan-400 bg-cyan-50 border-transparent",
	gray:    "ring-2 ring-gray-400 bg-gray-50 border-transparent",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const calcularEdad = (fecha: string): number | string => {
	if (!fecha) return "";
	const birthDate = new Date(fecha);
	const today = new Date();
	let age = today.getFullYear() - birthDate.getFullYear();
	const m = today.getMonth() - birthDate.getMonth();
	if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
	return age;
};

export const esCuotaFutura = (mes: number, anio: number): boolean => {
	const hoy = new Date();
	const mesActual = hoy.getMonth() + 1;
	const anioActual = hoy.getFullYear();
	return anio > anioActual || (anio === anioActual && mes > mesActual);
};

// ─── Sub-componentes de UI simples ────────────────────────────────────────────

export const inputBase =
	"w-full h-11 px-4 text-sm text-gray-900 placeholder:text-gray-400 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#252d62] focus:bg-white focus:ring-2 focus:ring-[#252d62]/20 outline-none transition-all font-medium";

export const FieldGroup = ({
	label,
	icon: Icon,
	children,
}: {
	label: string;
	icon: React.ElementType;
	children: React.ReactNode;
}) => (
	<div className="flex flex-col gap-1.5">
		<label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
			<Icon className="w-3.5 h-3.5" />
			{label}
		</label>
		{children}
	</div>
);

export const SectionDivider = ({ label }: { label: string }) => (
	<div className="flex items-center gap-2 my-1">
		<div className="h-px bg-gray-200 flex-grow" />
		<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
			{label}
		</span>
		<div className="h-px bg-gray-200 flex-grow" />
	</div>
);

export const TipoBadge = ({
	tipo,
	isTutor,
}: {
	tipo: string;
	isTutor: boolean;
}) => (
	<div className="flex items-center gap-2 mt-1.5 flex-wrap">
		<span className="text-[11px] font-bold bg-white/15 text-white/90 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
			{tipo}
		</span>
		{isTutor && (
			<span className="text-[11px] font-bold bg-[#EE1120]/80 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1">
				<UserCheck className="w-3 h-3" /> Tutor
			</span>
		)}
	</div>
);

export const ReadOnlyField = ({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: string;
	icon: React.ElementType;
}) => (
	<div className="flex items-center gap-3 bg-gray-100/80 rounded-lg px-4 py-2.5 border border-gray-200/60">
		<Icon className="w-4 h-4 text-gray-400 shrink-0" />
		<div className="flex flex-col min-w-0">
			<span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-tight">
				{label}
			</span>
			<span className="text-sm font-semibold text-gray-500 truncate">
				{value}
			</span>
		</div>
		<span className="ml-auto text-[9px] font-bold text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">
			No editable
		</span>
	</div>
);