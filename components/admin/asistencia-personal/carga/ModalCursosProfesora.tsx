"use client";

/**
 * Cursos de una profesora (solo director), desde Carga de personal.
 *
 * Funciona igual que Configuración → Gestionar profesores: los cambios se guardan
 * al instante en `Teachers.cursosAsignados`, que es lo que usan el portal docente
 * y la Liquidación de cursos (titulares). La lista se actualiza sola (onSnapshot).
 */
import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
	AlertCircle,
	BookOpen,
	Clock,
	Loader2,
	PlusCircle,
	X,
	XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { DIAS_SEMANA } from "@/lib/asistencia/fechas";
import type { RepositorioCarga } from "@/lib/asistencia/repositorio";
import { nombreCompleto, type Curso, type Persona } from "@/lib/asistencia/tipos";
import { mensajeDeError, type Notificar } from "./ui";

const diaCorto = (d: number) => DIAS_SEMANA.find((x) => x.valor === d)?.corto ?? "?";

const horariosTexto = (c: Curso) =>
	c.horarios.length === 0
		? "Sin horarios definidos"
		: c.horarios.map((h) => `${diaCorto(h.dia)} ${h.inicio}–${h.fin}`).join(" · ");

export default function ModalCursosProfesora({
	profesora,
	cursos,
	repo,
	notificar,
	onCerrar,
}: {
	/** null = cerrado */
	profesora: Persona | null;
	cursos: Curso[];
	repo: RepositorioCarga;
	notificar: Notificar;
	onCerrar: () => void;
}) {
	const [eligiendo, setEligiendo] = useState(false);
	const [asignando, setAsignando] = useState(false);
	const [quitandoId, setQuitandoId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const cerrar = () => {
		if (asignando || quitandoId) return;
		setEligiendo(false);
		setError(null);
		onCerrar();
	};

	if (!profesora) return null;

	const porId = new Map(cursos.map((c) => [c.id, c]));
	// Tal cual está en Teachers.cursosAsignados (como en Configuración), incluso cursos borrados
	const asignados = (profesora.cursoIds ?? []).map((id) => ({ id, curso: porId.get(id) }));
	// Para elegir: activos primero, después los inactivos
	const opciones = [...cursos].sort((a, b) =>
		a.activo === b.activo ? a.nombre.localeCompare(b.nombre) : a.activo ? -1 : 1,
	);

	const asignar = async (cursoId: string) => {
		if (!cursoId) return;
		setAsignando(true);
		setError(null);
		try {
			await repo.asignarCursoAProfesora(profesora.id, cursoId);
			notificar(`${porId.get(cursoId)?.nombre ?? "Curso"} asignado a ${profesora.nombre}.`);
			setEligiendo(false);
		} catch (e) {
			setError(mensajeDeError(e));
		} finally {
			setAsignando(false);
		}
	};

	const quitar = async (cursoId: string) => {
		setQuitandoId(cursoId);
		setError(null);
		try {
			await repo.quitarCursoAProfesora(profesora.id, cursoId);
			notificar(
				`${porId.get(cursoId)?.nombre ?? "El curso"} ya no está asignado a ${profesora.nombre}.`,
			);
		} catch (e) {
			setError(mensajeDeError(e));
		} finally {
			setQuitandoId(null);
		}
	};

	return (
		<Dialog open onOpenChange={(o) => !o && cerrar()}>
			<DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col">
				{/* Encabezado */}
				<div className="flex items-center gap-3 p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
					<div className="bg-[#252d62] p-2 rounded-lg">
						<BookOpen className="w-4 h-4 text-white" />
					</div>
					<div className="min-w-0">
						<DialogTitle className="text-lg font-bold text-[#252d62] truncate">
							Cursos de {nombreCompleto(profesora)}
						</DialogTitle>
						<DialogDescription className="text-xs text-gray-500 mt-0.5">
							Los cambios se guardan al instante y se ven también en Configuración
							y en el portal docente
						</DialogDescription>
					</div>
				</div>

				{/* Cuerpo */}
				<div className="p-6 space-y-4 overflow-y-auto">
					<div className="flex items-center justify-between">
						<p className="text-sm font-semibold text-gray-700">
							Cursos asignados{" "}
							<span className="text-gray-400 font-normal">({asignados.length})</span>
						</p>
						{!eligiendo && (
							<button
								type="button"
								onClick={() => setEligiendo(true)}
								className="text-xs font-bold text-[#252d62] hover:text-[#4338ca] flex items-center gap-1 transition-colors"
							>
								<PlusCircle className="w-4 h-4" /> Asignar curso
							</button>
						)}
					</div>

					{/* Selector para agregar */}
					<AnimatePresence>
						{eligiendo && (
							<motion.div
								initial={{ opacity: 0, y: -4 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -4 }}
								className="flex gap-2"
							>
								<select
									value=""
									disabled={asignando}
									onChange={(e) => asignar(e.target.value)}
									aria-label="Elegir un curso para asignar"
									className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] outline-none transition-all disabled:opacity-60"
								>
									<option value="">
										{asignando ? "Asignando…" : "— Elegir un curso —"}
									</option>
									{opciones.map((c) => {
										const yaLoTiene = profesora.cursoIds?.includes(c.id) ?? false;
										return (
											<option key={c.id} value={c.id} disabled={yaLoTiene}>
												{c.nombre}
												{!c.activo ? " (inactivo)" : ""}
												{yaLoTiene ? " ✓ ya lo tiene" : ""}
											</option>
										);
									})}
								</select>
								<button
									type="button"
									onClick={() => setEligiendo(false)}
									disabled={asignando}
									className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 transition-colors shrink-0 disabled:opacity-50"
									aria-label="Cancelar"
								>
									{asignando ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : (
										<XCircle className="w-4 h-4" />
									)}
								</button>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Lista de asignados */}
					{asignados.length === 0 ? (
						<p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
							Todavía no tiene cursos asignados. Sin cursos no espera clases ni cobra
							pago mensual.
						</p>
					) : (
						<ul className="space-y-2">
							{asignados.map(({ id, curso }) => (
								<li
									key={id}
									className="flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-xl px-4 py-2.5"
								>
									<div className="min-w-0">
										<p
											className={`text-sm font-semibold truncate ${curso ? "text-gray-800" : "text-gray-400 italic"}`}
										>
											{curso?.nombre ?? "Curso eliminado"}
											{curso && !curso.activo && (
												<span className="ml-1.5 text-[10px] font-bold uppercase text-gray-400">
													Inactivo
												</span>
											)}
										</p>
										{curso && (
											<p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate">
												<Clock className="w-3 h-3 shrink-0" />
												{horariosTexto(curso)}
											</p>
										)}
									</div>
									<button
										type="button"
										onClick={() => quitar(id)}
										disabled={quitandoId !== null}
										title="Quitar curso"
										aria-label={`Quitar ${curso?.nombre ?? "curso"}`}
										className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0"
									>
										{quitandoId === id ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											<X className="w-4 h-4" />
										)}
									</button>
								</li>
							))}
						</ul>
					)}

					<p className="text-xs text-gray-400">
						Lo que cobra en cada curso (porcentaje) se carga en Carga de datos →
						Liquidación de cursos.
					</p>

					{error && (
						<div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
							<AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
							<p className="text-sm text-red-700">{error}</p>
						</div>
					)}
				</div>

				{/* Pie */}
				<div className="p-4 border-t border-gray-100 bg-white flex justify-end shrink-0">
					<Button
						type="button"
						variant="outline"
						onClick={cerrar}
						disabled={asignando || quitandoId !== null}
						className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl"
					>
						Cerrar
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
