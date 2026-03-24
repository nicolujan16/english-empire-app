"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	X,
	Tag,
	Percent,
	GraduationCap,
	Save,
	Loader2,
	AlertCircle,
	CheckCircle2,
	Layers,
} from "lucide-react";
import {
	doc,
	updateDoc,
	serverTimestamp,
	setDoc,
	getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";

// ─── Helpers ────────────────────────────────────────────────────────────────────

const slugify = (text: string): string =>
	text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "") // elimina tildes
		.replace(/[^a-z0-9\s-]/g, "") // solo letras, números, espacios y guiones
		.trim()
		.replace(/\s+/g, "-"); // espacios → guiones

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface EtiquetaDescuento {
	id: string;
	nombre: string;
	descripcion?: string;
	color: string;
	descuentoInscripcion: number | null;
	descuentoCuota: number | null;
	acumulableConGrupoFamiliar: boolean;
	activa: boolean;
	creadoEn?: unknown;
}

interface EtiquetaModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	etiquetaToEdit?: EtiquetaDescuento | null; // null/undefined = crear, valor = editar
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLORES = [
	{
		id: "emerald",
		label: "Verde",
		dot: "bg-emerald-400",
		ring: "ring-emerald-400",
	},
	{ id: "blue", label: "Azul", dot: "bg-blue-400", ring: "ring-blue-400" },
	{
		id: "violet",
		label: "Violeta",
		dot: "bg-violet-400",
		ring: "ring-violet-400",
	},
	{
		id: "amber",
		label: "Amarillo",
		dot: "bg-amber-400",
		ring: "ring-amber-400",
	},
	{ id: "rose", label: "Rosa", dot: "bg-rose-400", ring: "ring-rose-400" },
	{ id: "cyan", label: "Celeste", dot: "bg-cyan-400", ring: "ring-cyan-400" },
	{ id: "gray", label: "Gris", dot: "bg-gray-400", ring: "ring-gray-400" },
] as const;

const COLORES_PREVIEW: Record<string, string> = {
	emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
	blue: "bg-blue-100 text-blue-700 border-blue-200",
	violet: "bg-violet-100 text-violet-700 border-violet-200",
	amber: "bg-amber-100 text-amber-700 border-amber-200",
	rose: "bg-rose-100 text-rose-700 border-rose-200",
	cyan: "bg-cyan-100 text-cyan-700 border-cyan-200",
	gray: "bg-gray-100 text-gray-700 border-gray-200",
};

const ESTADO_INICIAL = {
	nombre: "",
	descripcion: "",
	color: "emerald",
	descuentoInscripcion: "",
	descuentoCuota: "",
	activa: true,
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function EtiquetaModal({
	isOpen,
	onClose,
	onSuccess,
	etiquetaToEdit,
}: EtiquetaModalProps) {
	const isEditing = !!etiquetaToEdit;

	const [form, setForm] = useState(ESTADO_INICIAL);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");

	// Inicializar con datos al editar
	useEffect(() => {
		if (isOpen) {
			if (etiquetaToEdit) {
				setForm({
					nombre: etiquetaToEdit.nombre,
					descripcion: etiquetaToEdit.descripcion ?? "",
					color: etiquetaToEdit.color,
					descuentoInscripcion:
						etiquetaToEdit.descuentoInscripcion !== null
							? String(etiquetaToEdit.descuentoInscripcion)
							: "",
					descuentoCuota:
						etiquetaToEdit.descuentoCuota !== null
							? String(etiquetaToEdit.descuentoCuota)
							: "",
					activa: etiquetaToEdit.activa,
				});
			} else {
				setForm(ESTADO_INICIAL);
			}
			setErrorMsg("");
		}
	}, [isOpen, etiquetaToEdit]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setErrorMsg("");

		if (!form.nombre.trim()) {
			setErrorMsg("El nombre de la etiqueta es obligatorio.");
			return;
		}
		if (!form.descuentoInscripcion && !form.descuentoCuota) {
			setErrorMsg(
				"Debés ingresar al menos un descuento (inscripción o cuota).",
			);
			return;
		}

		const descuentoInscripcion = form.descuentoInscripcion
			? Number(form.descuentoInscripcion)
			: null;
		const descuentoCuota = form.descuentoCuota
			? Number(form.descuentoCuota)
			: null;

		if (
			descuentoInscripcion !== null &&
			(descuentoInscripcion <= 0 || descuentoInscripcion > 100)
		) {
			setErrorMsg("El descuento de inscripción debe ser entre 1 y 100.");
			return;
		}
		if (
			descuentoCuota !== null &&
			(descuentoCuota <= 0 || descuentoCuota > 100)
		) {
			setErrorMsg("El descuento de cuota debe ser entre 1 y 100.");
			return;
		}

		setIsSubmitting(true);
		try {
			const payload = {
				nombre: form.nombre.trim(),
				descripcion: form.descripcion.trim() || null,
				color: form.color,
				descuentoInscripcion,
				descuentoCuota,
				acumulableConGrupoFamiliar: false, // 🚀 FORZADO A FALSE SIEMPRE
				activa: form.activa,
				actualizadoEn: serverTimestamp(),
			};

			if (isEditing && etiquetaToEdit) {
				await updateDoc(
					doc(db, "EtiquetasDescuento", etiquetaToEdit.id),
					payload,
				);
			} else {
				const slug = slugify(form.nombre.trim());
				const etiquetaRef = doc(db, "EtiquetasDescuento", slug);

				const existing = await getDoc(etiquetaRef);
				if (existing.exists()) {
					setErrorMsg(
						"Ya existe una etiqueta con un nombre muy similar. Usá un nombre diferente.",
					);
					return;
				}

				await setDoc(etiquetaRef, {
					...payload,
					creadoEn: serverTimestamp(),
				});
			}

			onSuccess();
			onClose();
		} catch (error) {
			console.error("Error guardando etiqueta:", error);
			setErrorMsg(
				"Hubo un error al guardar. Revisá la conexión e intentá de nuevo.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	// ── Preview de la etiqueta en tiempo real ─────────────────────────────────
	const previewClass = COLORES_PREVIEW[form.color] ?? COLORES_PREVIEW.gray;

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
							className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
						>
							{/* Header */}
							<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
								<div className="flex items-center gap-3">
									<div className="w-9 h-9 rounded-xl bg-[#252d62] flex items-center justify-center">
										<Tag className="w-4 h-4 text-white" />
									</div>
									<div>
										<h2 className="text-lg font-bold text-[#252d62]">
											{isEditing ? "Editar Etiqueta" : "Nueva Etiqueta"}
										</h2>
										<p className="text-xs text-gray-500">
											{isEditing
												? `Editando: ${etiquetaToEdit!.nombre}`
												: "Completá los datos para crear la etiqueta"}
										</p>
									</div>
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
								<form
									id="etiqueta-form"
									onSubmit={handleSubmit}
									className="space-y-5"
								>
									{/* Nombre */}
									<div>
										<label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
											Nombre de la etiqueta{" "}
											<span className="text-red-500">*</span>
										</label>
										<input
											type="text"
											required
											disabled={isSubmitting}
											value={form.nombre}
											onChange={(e) =>
												setForm({ ...form, nombre: e.target.value })
											}
											placeholder="Ej: Consejo de Ciencias Económicas"
											className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62]"
										/>
									</div>

									{/* Descripción */}
									<div>
										<label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
											Descripción{" "}
											<span className="text-gray-400 font-normal">
												(opcional)
											</span>
										</label>
										<textarea
											disabled={isSubmitting}
											value={form.descripcion}
											onChange={(e) =>
												setForm({ ...form, descripcion: e.target.value })
											}
											placeholder="Ej: Alumnos referidos por el Consejo de Ciencias Económicas"
											rows={2}
											className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] resize-none"
										/>
									</div>

									{/* Color */}
									<div>
										<label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
											Color del badge
										</label>
										<div className="flex flex-wrap gap-2">
											{COLORES.map((c) => (
												<button
													key={c.id}
													type="button"
													onClick={() => setForm({ ...form, color: c.id })}
													className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
														form.color === c.id
															? "border-[#252d62] bg-[#252d62]/5 text-[#252d62] ring-2 ring-[#252d62]/20"
															: "border-gray-200 text-gray-600 hover:border-gray-300"
													}`}
												>
													<span
														className={`w-2.5 h-2.5 rounded-full ${c.dot}`}
													/>
													{c.label}
												</button>
											))}
										</div>
										{/* Preview badge */}
										{form.nombre && (
											<div className="mt-2.5 flex items-center gap-2">
												<span className="text-[10px] text-gray-400 font-medium">
													Preview:
												</span>
												<span
													className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${previewClass}`}
												>
													<Tag className="w-3 h-3" />
													{form.nombre}
												</span>
											</div>
										)}
									</div>

									{/* Descuentos */}
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
												<GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
												Desc. Inscripción (%)
											</label>
											<div className="relative">
												<input
													type="number"
													min={1}
													max={100}
													disabled={isSubmitting}
													value={form.descuentoInscripcion}
													onChange={(e) =>
														setForm({
															...form,
															descuentoInscripcion: e.target.value,
														})
													}
													placeholder="Ej: 15"
													className="w-full px-3 py-2.5 pr-8 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
												/>
												<Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
											</div>
											<p className="text-[10px] text-gray-400 mt-1">
												Dejá vacío si no aplica
											</p>
										</div>

										<div>
											<label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
												<Layers className="w-3.5 h-3.5 text-blue-600" />
												Desc. Cuotas (%)
											</label>
											<div className="relative">
												<input
													type="number"
													min={1}
													max={100}
													disabled={isSubmitting}
													value={form.descuentoCuota}
													onChange={(e) =>
														setForm({ ...form, descuentoCuota: e.target.value })
													}
													placeholder="Ej: 10"
													className="w-full px-3 py-2.5 pr-8 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
												/>
												<Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
											</div>
											<p className="text-[10px] text-gray-400 mt-1">
												Dejá vacío si no aplica
											</p>
										</div>
									</div>

									{/* Estado activa/inactiva (solo en edición) */}
									{isEditing && (
										<div
											onClick={() => setForm({ ...form, activa: !form.activa })}
											className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all select-none ${
												form.activa
													? "bg-emerald-50 border-emerald-200"
													: "bg-red-50 border-red-200"
											}`}
										>
											<div
												className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
													form.activa
														? "bg-emerald-500 border-emerald-500"
														: "bg-red-400 border-red-400"
												}`}
											>
												{form.activa ? (
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
												) : (
													<X className="w-3 h-3 text-white" />
												)}
											</div>
											<div>
												<p
													className={`text-sm font-bold ${form.activa ? "text-emerald-800" : "text-red-700"}`}
												>
													Etiqueta {form.activa ? "activa" : "inactiva"}
												</p>
												<p
													className={`text-xs mt-0.5 ${form.activa ? "text-emerald-600" : "text-red-500"}`}
												>
													{form.activa
														? "Puede asignarse a alumnos y aplica descuentos."
														: "No puede asignarse a nuevos alumnos ni aplicar descuentos."}
												</p>
											</div>
										</div>
									)}
								</form>

								{/* Resumen de lo que se va a guardar */}
								{(form.descuentoInscripcion || form.descuentoCuota) && (
									<motion.div
										initial={{ opacity: 0, y: 4 }}
										animate={{ opacity: 1, y: 0 }}
										className="bg-[#252d62]/5 border border-[#252d62]/15 rounded-xl p-4"
									>
										<p className="text-[10px] font-black text-[#252d62]/60 uppercase tracking-widest mb-2.5">
											Resumen de descuentos
										</p>
										<div className="space-y-1.5">
											{form.descuentoInscripcion && (
												<div className="flex items-center gap-2 text-sm">
													<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
													<span className="text-gray-700">
														Inscripción:{" "}
														<strong className="text-emerald-600">
															{form.descuentoInscripcion}% off
														</strong>
													</span>
												</div>
											)}
											{form.descuentoCuota && (
												<div className="flex items-center gap-2 text-sm">
													<CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
													<span className="text-gray-700">
														Cuotas:{" "}
														<strong className="text-blue-600">
															{form.descuentoCuota}% off
														</strong>
														<span className="text-gray-400 text-xs ml-1">
															(no acumulable con GF)
														</span>
													</span>
												</div>
											)}
										</div>
									</motion.div>
								)}

								{/* Error */}
								{errorMsg && (
									<div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-xl text-sm font-medium">
										<AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
										{errorMsg}
									</div>
								)}
							</div>

							{/* Footer */}
							<div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 shrink-0">
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
									type="submit"
									form="etiqueta-form"
									disabled={isSubmitting}
									className="bg-[#252d62] hover:bg-[#1a2046] text-white rounded-xl font-bold min-w-[140px]"
								>
									{isSubmitting ? (
										<>
											<Loader2 className="w-4 h-4 animate-spin mr-2" />
											Guardando...
										</>
									) : (
										<>
											<Save className="w-4 h-4 mr-2" />
											{isEditing ? "Guardar cambios" : "Crear etiqueta"}
										</>
									)}
								</Button>
							</div>
						</motion.div>
					</div>
				</>
			)}
		</AnimatePresence>
	);
}
