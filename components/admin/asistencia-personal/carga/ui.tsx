"use client";

/**
 * Piezas de UI compartidas por las tabs de carga (estilo: STYLE.md §6).
 */
import React from "react";
import { AlertCircle, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { fechaHoraCorta } from "@/lib/asistencia/fechas";
import type { CambioHistorial } from "@/lib/asistencia/tipos";

export const inputClase =
	"w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] disabled:bg-gray-50 disabled:text-gray-400";

export const inputFiltroClase =
	"text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62]";

export type Notificar = (mensaje: string, tipo?: "ok" | "error") => void;

export const mensajeDeError = (e: unknown) => {
	const code =
		typeof e === "object" && e !== null && "code" in e
			? String((e as { code: unknown }).code)
			: null;
	if (code === "permission-denied" || code === "firestore/permission-denied")
		return "No tenés permisos para hacer esto";
	if (code === "auth/email-already-in-use")
		return "Ya existe una cuenta con ese email.";
	if (code === "auth/invalid-email") return "El email no es válido.";
	if (code === "unavailable") return "No hay conexión. Probá de nuevo.";
	return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
};

// ── Campo de formulario ───────────────────────────────────────────────────────

export function Campo({
	label,
	hint,
	children,
	className = "",
}: {
	label: string;
	hint?: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={`space-y-1.5 ${className}`}>
			<label className="text-sm font-semibold text-gray-700">{label}</label>
			{children}
			{hint && <p className="text-xs text-gray-400">{hint}</p>}
		</div>
	);
}

export function CampoMotivo({
	value,
	onChange,
	placeholder = "Ej.: se olvidó de fichar la salida",
	label = "Motivo del cambio",
}: {
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	/** "Motivo del registro manual" cuando se carga algo que no fichó, sin cambiar a nadie */
	label?: string;
}) {
	return (
		<Campo
			label={label}
			hint="Obligatorio. Queda guardado en el historial."
		>
			<textarea
				value={value}
				onChange={(e) => onChange(e.target.value)}
				rows={2}
				placeholder={placeholder}
				className={`${inputClase} resize-none`}
			/>
		</Campo>
	);
}

// ── Selector segmentado ───────────────────────────────────────────────────────

export function Segmentado<T extends string>({
	opciones,
	valor,
	onChange,
	disabled,
}: {
	opciones: readonly (readonly [T, string])[];
	valor: T;
	onChange: (v: T) => void;
	disabled?: boolean;
}) {
	return (
		<div className="inline-flex items-center gap-1 bg-gray-50 rounded-lg p-1">
			{opciones.map(([v, label]) => (
				<button
					key={v}
					type="button"
					disabled={disabled}
					onClick={() => onChange(v)}
					className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-all disabled:cursor-not-allowed ${
						valor === v
							? "bg-white shadow-sm text-[#252d62] font-semibold"
							: "text-gray-500 hover:text-gray-700"
					}`}
				>
					{label}
				</button>
			))}
		</div>
	);
}

// ── Interruptor ───────────────────────────────────────────────────────────────

export function Interruptor({
	activo,
	onChange,
	label,
}: {
	activo: boolean;
	onChange: (v: boolean) => void;
	label: string;
}) {
	return (
		<label className="flex items-center gap-3 cursor-pointer select-none">
			<button
				type="button"
				role="switch"
				aria-checked={activo}
				onClick={() => onChange(!activo)}
				className={`relative w-10 h-6 rounded-full transition-colors ${
					activo ? "bg-[#252d62]" : "bg-gray-200"
				}`}
			>
				<span
					className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
						activo ? "translate-x-4" : ""
					}`}
				/>
			</button>
			<span className="text-sm font-medium text-gray-700">{label}</span>
		</label>
	);
}

// ── Modal de formulario ───────────────────────────────────────────────────────

export function ModalFormulario({
	abierto,
	onCerrar,
	titulo,
	subtitulo,
	icono: Icono,
	children,
	error,
	guardando,
	textoGuardar = "Guardar",
	onGuardar,
	puedeGuardar = true,
	ancho = "sm:max-w-lg",
	variante = "navy",
}: {
	abierto: boolean;
	onCerrar: () => void;
	titulo: string;
	subtitulo?: string;
	icono: React.ComponentType<{ className?: string }>;
	children: React.ReactNode;
	error?: string | null;
	guardando?: boolean;
	textoGuardar?: string;
	onGuardar: () => void;
	puedeGuardar?: boolean;
	ancho?: string;
	variante?: "navy" | "rojo";
}) {
	return (
		<Dialog open={abierto} onOpenChange={(o) => !o && !guardando && onCerrar()}>
			<DialogContent
				className={`${ancho} p-0 gap-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col`}
			>
				<div className="flex items-center gap-3 p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
					<div className="bg-[#252d62] p-2 rounded-lg">
						<Icono className="w-4 h-4 text-white" />
					</div>
					<div className="min-w-0">
						<DialogTitle className="text-lg font-bold text-[#252d62]">
							{titulo}
						</DialogTitle>
						<DialogDescription className="text-xs text-gray-500 mt-0.5">
							{subtitulo ?? " "}
						</DialogDescription>
					</div>
				</div>

				<form
					className="flex flex-col min-h-0"
					onSubmit={(e) => {
						e.preventDefault();
						if (puedeGuardar && !guardando) onGuardar();
					}}
				>
					<div className="p-6 space-y-5 overflow-y-auto">
						{children}
						{error && (
							<div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
								<AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
								<p className="text-sm text-red-700">{error}</p>
							</div>
						)}
					</div>

					<div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-2 shrink-0">
						<Button
							type="button"
							variant="outline"
							onClick={onCerrar}
							disabled={guardando}
							className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl"
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							disabled={!puedeGuardar || guardando}
							className={`text-white font-bold rounded-xl ${
								variante === "rojo"
									? "bg-[#EE1120] hover:bg-[#c4000e]"
									: "bg-[#252d62] hover:bg-[#1a2046]"
							}`}
						>
							{guardando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
							{textoGuardar}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ── Historial de cambios ──────────────────────────────────────────────────────

const ETIQUETAS_CAMPO: Record<string, string> = {
	creacion: "Carga manual",
	entrada: "Entrada",
	salida: "Salida",
	estado: "Estado",
	profesoraDicto: "Dio la clase",
	contarIgual: "Contar igual",
};

const mostrarValor = (v: unknown) =>
	v === null || v === undefined || v === ""
		? "—"
		: typeof v === "boolean"
			? v
				? "Sí"
				: "No"
			: String(v);

export function Historial({ items }: { items: CambioHistorial[] }) {
	if (items.length === 0) return null;
	const ordenados = [...items].sort((a, b) => b.en.getTime() - a.en.getTime());
	return (
		<div className="space-y-2">
			<p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
				<History className="w-4 h-4 text-gray-400" /> Historial de cambios
			</p>
			<div className="bg-gray-50 border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto">
				{ordenados.map((h, i) => (
					<div key={i} className="px-3 py-2 text-xs">
						<div className="flex justify-between gap-2">
							<span className="font-bold text-gray-700">
								{ETIQUETAS_CAMPO[h.campo] ?? h.campo}
							</span>
							<span className="text-gray-400 shrink-0">
								{fechaHoraCorta(h.en)}
							</span>
						</div>
						{h.campo !== "creacion" ? (
							<p className="text-gray-600">
								{mostrarValor(h.antes)} → {mostrarValor(h.despues)}
							</p>
						) : (
							<p className="text-gray-600">{mostrarValor(h.despues)}</p>
						)}
						<p className="text-gray-400 italic">“{h.motivo}”</p>
					</div>
				))}
			</div>
		</div>
	);
}

// ── Estado vacío ──────────────────────────────────────────────────────────────

export function Vacio({
	icono: Icono,
	titulo,
	texto,
}: {
	icono: React.ComponentType<{ className?: string }>;
	titulo: string;
	texto?: string;
}) {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<div className="bg-gray-100 p-4 rounded-full mb-4">
				<Icono className="w-8 h-8 text-gray-400" />
			</div>
			<p className="text-gray-500 font-medium">{titulo}</p>
			{texto && <p className="text-gray-400 text-sm mt-1">{texto}</p>}
		</div>
	);
}
