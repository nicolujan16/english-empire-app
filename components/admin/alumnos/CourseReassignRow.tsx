"use client";

import React from "react";
import { motion } from "framer-motion";
import {
	ArrowRightLeft,
	ChevronDown,
	RotateCcw,
	UserMinus,
} from "lucide-react";
import { CourseDetails } from "./EditUserInfoModal.types";

interface CourseReassignRowProps {
	cursoActualId: string;
	cursoActualNombre: string;
	nuevoCursoId: string;
	esBaja: boolean;
	allCourses: CourseDetails[];
	onChange: (nuevoCursoId: string) => void;
	onToggleBaja: () => void;
}

export default function CourseReassignRow({
	cursoActualId,
	cursoActualNombre,
	nuevoCursoId,
	esBaja,
	allCourses,
	onChange,
	onToggleBaja,
}: CourseReassignRowProps) {
	const hasChange = nuevoCursoId !== "" && nuevoCursoId !== cursoActualId;
	const nuevoCurso = allCourses.find((c) => c.id === nuevoCursoId);

	return (
		<div
			className={`rounded-xl border p-3 transition-all ${
				esBaja
					? "border-red-200 bg-red-50/40 opacity-80"
					: hasChange
						? "border-indigo-200 bg-indigo-50/40"
						: "border-gray-200 bg-gray-50/50"
			}`}
		>
			<div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
				{/* Curso actual */}
				<div className="flex-1 min-w-0">
					<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
						Actual
					</p>
					<p
						className={`text-sm font-bold truncate ${
							esBaja ? "line-through text-red-400" : "text-[#252d62]"
						}`}
					>
						{cursoActualNombre}
					</p>
				</div>

				{/* Botón dar de baja */}
				<button
					type="button"
					onClick={onToggleBaja}
					className={`shrink-0 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-bold flex items-center gap-1 ${
						esBaja
							? "bg-red-100 border-red-300 text-red-600 hover:bg-red-200"
							: "bg-white border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 hover:bg-red-50"
					}`}
				>
					{esBaja ? (
						<>
							<RotateCcw className="w-3.5 h-3.5" /> Deshacer
						</>
					) : (
						<>
							<UserMinus className="w-3.5 h-3.5" /> Dar de baja
						</>
					)}
				</button>

				{/* Flecha + select de reasignación */}
				{!esBaja && (
					<>
						<ArrowRightLeft
							className={`w-4 h-4 shrink-0 transition-colors ${
								hasChange ? "text-indigo-500" : "text-gray-300"
							}`}
						/>
						<div className="flex-1 min-w-0 relative">
							<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
								Reasignar a
							</p>
							<div className="relative">
								<select
									value={nuevoCursoId}
									onChange={(e) => onChange(e.target.value)}
									className={`w-full appearance-none pr-7 pl-3 py-1.5 text-sm font-semibold rounded-lg border outline-none transition-all cursor-pointer ${
										hasChange
											? "border-indigo-300 bg-white text-indigo-700 focus:ring-2 focus:ring-indigo-400/20"
											: "border-gray-200 bg-white text-gray-600 focus:ring-2 focus:ring-[#252d62]/20"
									}`}
								>
									<option value="">— Sin cambio —</option>
									{allCourses
										.filter((c) => c.id !== cursoActualId)
										.map((c) => (
											<option key={c.id} value={c.id}>
												{c.nombre}
											</option>
										))}
								</select>
								<ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
							</div>
						</div>
					</>
				)}

				{/* Aviso de baja */}
				{esBaja && (
					<p className="text-xs text-red-500 font-medium flex-1 min-w-0">
						Las cuotas futuras pendientes serán <strong>eliminadas</strong>.
					</p>
				)}
			</div>

			{/* Preview precios nuevo curso */}
			{!esBaja && hasChange && nuevoCurso && (
				<motion.div
					initial={{ opacity: 0, height: 0 }}
					animate={{ opacity: 1, height: "auto" }}
					className="mt-3 pt-3 border-t border-indigo-200 grid grid-cols-2 gap-2 text-xs overflow-hidden"
				>
					<div className="bg-white rounded-lg px-3 py-1.5 border border-indigo-100">
						<p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">
							Cuota 1-10
						</p>
						<p className="font-black text-indigo-700 mt-0.5">
							${nuevoCurso.cuota1a10.toLocaleString("es-AR")}
						</p>
					</div>
					<div className="bg-white rounded-lg px-3 py-1.5 border border-indigo-100">
						<p className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">
							Cuota 11+
						</p>
						<p className="font-black text-indigo-700 mt-0.5">
							${nuevoCurso.cuota11enAdelante.toLocaleString("es-AR")}
						</p>
					</div>
					<p className="col-span-2 text-indigo-500 font-medium mt-0.5">
						⚡ Las cuotas futuras pendientes se actualizarán con estos montos.
					</p>
				</motion.div>
			)}
		</div>
	);
}
