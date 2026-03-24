"use client";

import React from "react";
import { motion } from "framer-motion";
import { Tag, Tags, GraduationCap, Users } from "lucide-react";
import {
	EtiquetaDisponible,
	COLORES_BADGE,
	COLORES_SELECTED,
} from "./EditUserInfoModal.types";

interface EtiquetasSectionProps {
	etiquetasDisponibles: EtiquetaDisponible[];
	etiquetasSeleccionadas: Set<string>;
	onToggle: (id: string) => void;
	isTutor: boolean;
	hijosIds: string[];
	aplicarAHijos: boolean;
	onToggleAplicarAHijos: () => void;
}

export default function EtiquetasSection({
	etiquetasDisponibles,
	etiquetasSeleccionadas,
	onToggle,
	isTutor,
	hijosIds,
	aplicarAHijos,
	onToggleAplicarAHijos,
}: EtiquetasSectionProps) {
	if (etiquetasDisponibles.length === 0) {
		return (
			<div className="flex items-center gap-2.5 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-400 font-medium">
				<Tags className="w-4 h-4 shrink-0" />
				No hay etiquetas de descuento activas.
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{/* Lista de etiquetas */}
			{etiquetasDisponibles.map((etiqueta) => {
				const isSelected = etiquetasSeleccionadas.has(etiqueta.id);
				const badgeClass = COLORES_BADGE[etiqueta.color] ?? COLORES_BADGE.gray;
				const selectedClass =
					COLORES_SELECTED[etiqueta.color] ?? COLORES_SELECTED.gray;

				return (
					<button
						key={etiqueta.id}
						type="button"
						onClick={() => onToggle(etiqueta.id)}
						className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
							isSelected
								? selectedClass
								: "border-gray-200 bg-white hover:border-gray-300"
						}`}
					>
						{/* Checkbox visual */}
						<div
							className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
								isSelected
									? "bg-[#252d62] border-[#252d62]"
									: "border-gray-300 bg-white"
							}`}
						>
							{isSelected && (
								<svg
									className="w-3 h-3 text-white"
									viewBox="0 0 12 12"
									fill="none"
								>
									<path
										d="M2 6l3 3 5-5"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							)}
						</div>

						{/* Badge con nombre y color */}
						<span
							className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}
						>
							<Tag className="w-3 h-3" />
							{etiqueta.nombre}
						</span>

						{/* Chips de descuentos */}
						<div className="flex items-center gap-1.5 ml-auto shrink-0">
							{etiqueta.descuentoInscripcion && (
								<span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
									<GraduationCap className="w-2.5 h-2.5" />
									{etiqueta.descuentoInscripcion}% inscr.
								</span>
							)}
							{etiqueta.descuentoCuota && (
								<span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">
									{etiqueta.descuentoCuota}% cuota
								</span>
							)}
						</div>
					</button>
				);
			})}

			{/* Checkbox propagar a hijos — solo si es tutor con hijos */}
			{isTutor && hijosIds.length > 0 && (
				<motion.div
					initial={{ opacity: 0, y: 4 }}
					animate={{ opacity: 1, y: 0 }}
					onClick={onToggleAplicarAHijos}
					className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none mt-1 ${
						aplicarAHijos
							? "bg-violet-50 border-violet-200"
							: "bg-gray-50 border-gray-200 hover:border-gray-300"
					}`}
				>
					<div
						className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
							aplicarAHijos
								? "bg-violet-500 border-violet-500"
								: "border-gray-300 bg-white"
						}`}
					>
						{aplicarAHijos && (
							<svg
								className="w-3 h-3 text-white"
								viewBox="0 0 12 12"
								fill="none"
							>
								<path
									d="M2 6l3 3 5-5"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						)}
					</div>
					<div>
						<div className="flex items-center gap-1.5">
							<Users className="w-3.5 h-3.5 text-violet-500 shrink-0" />
							<p
								className={`text-sm font-bold ${
									aplicarAHijos ? "text-violet-800" : "text-gray-700"
								}`}
							>
								Aplicar estas etiquetas a los menores a cargo
							</p>
						</div>
						<p
							className={`text-xs mt-0.5 ${
								aplicarAHijos ? "text-violet-600" : "text-gray-500"
							}`}
						>
							{aplicarAHijos
								? `Las etiquetas seleccionadas se asignarán a ${hijosIds.length} menor${hijosIds.length > 1 ? "es" : ""} vinculado${hijosIds.length > 1 ? "s" : ""} a este tutor.`
								: `Este tutor tiene ${hijosIds.length} menor${hijosIds.length > 1 ? "es" : ""} a cargo. Podés sincronizar las mismas etiquetas a todos.`}
						</p>
					</div>
				</motion.div>
			)}
		</div>
	);
}
