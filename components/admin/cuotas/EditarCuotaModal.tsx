"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	X,
	Save,
	Loader2,
	AlertCircle,
	Tag,
	GraduationCap,
	ShieldOff,
	RotateCcw,
	AlertOctagon,
	MessageSquare, // NUEVO ÍCONO
} from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";
import { type Cuota, type Descuento } from "@/lib/cuotas";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CuotaDoc extends Cuota {
	estado: "Pendiente" | "Pagado" | "Incobrable";
	montoAjustado?: number | null;
	motivoAjuste?: string | null;
}

interface EditarCuotaModalProps {
	isOpen: boolean;
	onClose: () => void;
	cuota: CuotaDoc | null;
	onSuccess: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputBase =
	"w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white transition-all font-medium";

function obtenerMejorDescuento(descuentos?: Descuento[]): Descuento | null {
	if (!descuentos || descuentos.length === 0) return null;
	return descuentos.reduce((max, obj) =>
		obj.porcentaje > max.porcentaje ? obj : max,
	);
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function EditarCuotaModal({
	isOpen,
	onClose,
	cuota,
	onSuccess,
}: EditarCuotaModalProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");

	// Campos editables
	const [cuota1a10, setCuota1a10] = useState("");
	const [cuota11enAdelante, setCuota11enAdelante] = useState("");
	const [montoPrimerMes, setMontoPrimerMes] = useState("");
	const [estado, setEstado] = useState<"Pendiente" | "Incobrable">("Pendiente");

	// 🚀 NUEVO: Campo de motivo
	const [motivoAjuste, setMotivoAjuste] = useState("");

	const [tieneDescuento, setTieneDescuento] = useState(false);
	const [descuentoDetalle, setDescuentoDetalle] = useState("");
	const [descuentoPorcentaje, setDescuentoPorcentaje] = useState("");

	// 🚀 LÓGICA REACTIVA: ¿Cambiaron los números base?
	const isMontoModificado = cuota
		? Number(cuota1a10) !== cuota.cuota1a10 ||
			Number(cuota11enAdelante) !== cuota.cuota11enAdelante ||
			(cuota.esPrimerMes && Number(montoPrimerMes) !== cuota.montoPrimerMes)
		: false;

	// ── Init ──────────────────────────────────────────────────────────────────

	useEffect(() => {
		if (!cuota || !isOpen) return;
		setCuota1a10(String(cuota.cuota1a10));
		setCuota11enAdelante(String(cuota.cuota11enAdelante));
		setMontoPrimerMes(
			cuota.montoPrimerMes != null ? String(cuota.montoPrimerMes) : "",
		);

		setEstado(
			cuota.estado === "Incobrable" || (cuota.estado as string) === "Incobrable"
				? "Incobrable"
				: "Pendiente",
		);

		// Si ya tenía un motivo guardado, lo cargamos
		setMotivoAjuste(cuota.motivoAjuste || "");

		const mejor = obtenerMejorDescuento(cuota.descuentos);
		if (mejor) {
			setTieneDescuento(true);
			setDescuentoDetalle(mejor.detalle);
			setDescuentoPorcentaje(String(mejor.porcentaje));
		} else {
			setTieneDescuento(false);
			setDescuentoDetalle("");
			setDescuentoPorcentaje("");
		}

		setErrorMsg("");
	}, [cuota, isOpen]);

	// ── Guardar ───────────────────────────────────────────────────────────────

	const handleSave = async () => {
		if (!cuota) return;
		setErrorMsg("");

		const c1 = Number(cuota1a10);
		const c11 = Number(cuota11enAdelante);
		const mpm = montoPrimerMes !== "" ? Number(montoPrimerMes) : null;

		if (!c1 || c1 <= 0) {
			setErrorMsg("Cuota 1-10 debe ser mayor a 0.");
			return;
		}
		if (!c11 || c11 <= 0) {
			setErrorMsg("Cuota 11+ debe ser mayor a 0.");
			return;
		}
		if (cuota.esPrimerMes && (mpm === null || mpm <= 0)) {
			setErrorMsg("Monto primer mes debe ser mayor a 0.");
			return;
		}

		// 🚀 VALIDACIÓN: Obligamos a poner motivo si los montos difieren del original
		if (isMontoModificado && !motivoAjuste.trim()) {
			setErrorMsg(
				"Al alterar los montos originales, debes ingresar un motivo.",
			);
			return;
		}

		let arrayDescuentosFinal: Descuento[] = [];
		if (tieneDescuento) {
			const pct = Number(descuentoPorcentaje);
			if (!descuentoDetalle.trim()) {
				setErrorMsg("Debes ingresar el motivo del descuento.");
				return;
			}
			if (!pct || pct <= 0 || pct > 100) {
				setErrorMsg("El porcentaje de descuento debe estar entre 1 y 100.");
				return;
			}
			arrayDescuentosFinal = [
				{ detalle: descuentoDetalle.trim(), porcentaje: pct },
			];
		}

		setIsSubmitting(true);
		try {
			await updateDoc(doc(db, "Cuotas", cuota.id), {
				cuota1a10: c1,
				cuota11enAdelante: c11,
				...(cuota.esPrimerMes ? { montoPrimerMes: mpm } : {}),
				estado,
				descuentos: arrayDescuentosFinal,
				// Si hay modificación, guardamos el motivo. Si lo devuelven a la normalidad, lo limpiamos (null).
				motivoAjuste: isMontoModificado ? motivoAjuste.trim() : null,
				actualizadoEn: serverTimestamp(),
			});
			onSuccess();
			onClose();
		} catch (error) {
			console.error("Error editando cuota:", error);
			setErrorMsg(
				"Hubo un error al guardar. Revisá la conexión e intentá de nuevo.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleReset = () => {
		if (!cuota) return;
		setCuota1a10(String(cuota.cuota1a10));
		setCuota11enAdelante(String(cuota.cuota11enAdelante));
		setMontoPrimerMes(
			cuota.montoPrimerMes != null ? String(cuota.montoPrimerMes) : "",
		);
		setEstado(
			cuota.estado === "Incobrable" || (cuota.estado as string) === "Incobrable"
				? "Incobrable"
				: "Pendiente",
		);
		setMotivoAjuste(cuota.motivoAjuste || "");

		const mejor = obtenerMejorDescuento(cuota.descuentos);
		if (mejor) {
			setTieneDescuento(true);
			setDescuentoDetalle(mejor.detalle);
			setDescuentoPorcentaje(String(mejor.porcentaje));
		} else {
			setTieneDescuento(false);
			setDescuentoDetalle("");
			setDescuentoPorcentaje("");
		}
		setErrorMsg("");
	};

	if (!cuota) return null;

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

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={!isSubmitting ? onClose : undefined}
						className="fixed inset-0 bg-[#252d62]/80 backdrop-blur-sm z-50"
					/>

					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 20 }}
							transition={{ duration: 0.2 }}
							className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
						>
							{/* Header */}
							<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
								<div>
									<h2 className="text-lg font-bold text-[#252d62]">
										Editar Cuota
									</h2>
									<p className="text-xs text-gray-500 mt-0.5">
										{cuota.alumnoNombre} — {MESES[cuota.mes - 1]} {cuota.anio} —{" "}
										{cuota.cursoNombre}
									</p>
								</div>
								<button
									onClick={!isSubmitting ? onClose : undefined}
									disabled={isSubmitting}
									className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
								>
									<X className="w-5 h-5" />
								</button>
							</div>

							{/* Body */}
							<div className="p-6 overflow-y-auto space-y-6">
								{/* ── Precios base ── */}
								<div>
									<p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
										<GraduationCap className="w-3.5 h-3.5" /> Precios base del
										curso
									</p>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
												Cuota 1-10
											</label>
											<div className="relative">
												<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
													$
												</span>
												<input
													type="number"
													min={1}
													value={cuota1a10}
													onChange={(e) => setCuota1a10(e.target.value)}
													disabled={isSubmitting}
													className={`${inputBase} pl-7`}
												/>
											</div>
										</div>
										<div>
											<label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
												Cuota 11+
											</label>
											<div className="relative">
												<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
													$
												</span>
												<input
													type="number"
													min={1}
													value={cuota11enAdelante}
													onChange={(e) => setCuota11enAdelante(e.target.value)}
													disabled={isSubmitting}
													className={`${inputBase} pl-7`}
												/>
											</div>
										</div>

										{cuota.esPrimerMes && (
											<div className="col-span-2">
												<label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
													Monto Primer Mes
												</label>
												<div className="relative">
													<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
														$
													</span>
													<input
														type="number"
														min={1}
														value={montoPrimerMes}
														onChange={(e) => setMontoPrimerMes(e.target.value)}
														disabled={isSubmitting}
														className={`${inputBase} pl-7`}
													/>
												</div>
												<p className="text-[10px] text-gray-400 mt-1">
													Esta es la cuota del mes de inscripción del alumno.
												</p>
											</div>
										)}
									</div>

									{/* 🚀 Animación Condicional del Motivo */}
									<AnimatePresence>
										{isMontoModificado && (
											<motion.div
												initial={{ opacity: 0, height: 0 }}
												animate={{ opacity: 1, height: "auto" }}
												exit={{ opacity: 0, height: 0 }}
												className="overflow-hidden"
											>
												<div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
													<label className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
														<MessageSquare className="w-3.5 h-3.5" /> Motivo de
														la modificación{" "}
														<span className="text-red-500">*</span>
													</label>
													<textarea
														value={motivoAjuste}
														onChange={(e) => setMotivoAjuste(e.target.value)}
														disabled={isSubmitting}
														placeholder="Ej: Ajuste pactado por ingreso tardío..."
														rows={2}
														className={`${inputBase} border-amber-200 focus:border-amber-500 focus:ring-amber-500/20 resize-none`}
													/>
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</div>

								{/* ── Estado ── */}
								<div>
									<p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
										<ShieldOff className="w-3.5 h-3.5" /> Estado
									</p>
									<div className="grid grid-cols-2 gap-3">
										{(["Pendiente", "Incobrable"] as const).map((e) => (
											<button
												key={e}
												type="button"
												onClick={() => setEstado(e)}
												className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all ${
													estado === e
														? e === "Incobrable"
															? "bg-red-50 border-red-400 text-red-700 ring-2 ring-red-400/20"
															: "bg-amber-50 border-amber-400 text-amber-700 ring-2 ring-amber-400/20"
														: "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500"
												}`}
											>
												{e === "Pendiente" ? (
													"🟡"
												) : (
													<AlertOctagon className="w-4 h-4" />
												)}{" "}
												{e}
											</button>
										))}
									</div>
									{estado === "Incobrable" && (
										<motion.p
											initial={{ opacity: 0, y: -4 }}
											animate={{ opacity: 1, y: 0 }}
											className="text-xs text-red-600 font-medium mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
										>
											La cuota será marcada como pérdida financiera
											(Incobrable). El alumno dejará de verla como deuda activa.
										</motion.p>
									)}
								</div>

								{/* ── Descuento Único ── */}
								<div>
									<div className="flex items-center justify-between mb-3">
										<p className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
											<Tag className="w-3.5 h-3.5" /> Beneficio Aplicado
										</p>

										<label className="flex items-center gap-2 cursor-pointer">
											<span className="text-xs font-bold text-emerald-700">
												Activar descuento
											</span>
											<input
												type="checkbox"
												checked={tieneDescuento}
												onChange={(e) => {
													setTieneDescuento(e.target.checked);
													if (!e.target.checked) {
														setDescuentoDetalle("");
														setDescuentoPorcentaje("");
													}
												}}
												className="w-4 h-4 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500 cursor-pointer"
											/>
										</label>
									</div>

									{tieneDescuento ? (
										<motion.div
											initial={{ opacity: 0, height: 0 }}
											animate={{ opacity: 1, height: "auto" }}
											className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2"
										>
											<div className="grid grid-cols-3 gap-2">
												<div className="col-span-2">
													<label className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
														Motivo (Ej: Beca / Hermano)
													</label>
													<input
														type="text"
														value={descuentoDetalle}
														onChange={(e) =>
															setDescuentoDetalle(e.target.value)
														}
														disabled={isSubmitting}
														className={`${inputBase} border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20`}
													/>
												</div>
												<div>
													<label className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
														Porcentaje
													</label>
													<div className="relative">
														<input
															type="number"
															min={1}
															max={100}
															value={descuentoPorcentaje}
															onChange={(e) =>
																setDescuentoPorcentaje(e.target.value)
															}
															disabled={isSubmitting}
															className={`${inputBase} border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20 pr-7`}
														/>
														<span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-sm">
															%
														</span>
													</div>
												</div>
											</div>
											<p className="text-[10px] text-emerald-700 mt-1">
												El sistema solo permite aplicar 1 beneficio a la vez
												para evitar acumulación excesiva de descuentos.
											</p>
										</motion.div>
									) : (
										<div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
											<p className="text-xs text-gray-500 font-medium">
												Esta cuota no tiene descuentos aplicados.
											</p>
										</div>
									)}
								</div>

								{/* Error */}
								{errorMsg && (
									<div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-xl text-sm font-medium">
										<AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
										{errorMsg}
									</div>
								)}
							</div>

							{/* Footer */}
							<div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3 shrink-0">
								<button
									type="button"
									onClick={handleReset}
									disabled={isSubmitting}
									className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-700 px-3 py-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
								>
									<RotateCcw className="w-3.5 h-3.5" /> Restaurar
								</button>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={onClose}
										disabled={isSubmitting}
										className="rounded-xl border-gray-300 text-gray-700"
									>
										Cancelar
									</Button>
									<Button
										type="button"
										onClick={handleSave}
										disabled={isSubmitting}
										className="bg-[#252d62] hover:bg-[#1a2046] text-white rounded-xl font-bold min-w-[140px]"
									>
										{isSubmitting ? (
											<>
												<Loader2 className="w-4 h-4 animate-spin mr-2" />{" "}
												Guardando...
											</>
										) : (
											<>
												<Save className="w-4 h-4 mr-2" /> Guardar cambios
											</>
										)}
									</Button>
								</div>
							</div>
						</motion.div>
					</div>
				</>
			)}
		</AnimatePresence>
	);
}
