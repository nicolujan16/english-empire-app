"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

export type InscriptionStatus =
	| "Confirmado"
	| "Pendiente"
	| "Cancelado"
	| string;

export interface Inscription {
	id: string; // ID del documento en Firebase
	fecha: string;
	alumnoNombre: string;
	alumnoDni: string;
	cursoNombre: string;
	cursoInscripcion: number;
	status: InscriptionStatus;
	paymentMethod?: string;
}

interface EditInscriptionModalProps {
	isOpen: boolean;
	onClose: () => void;
	inscriptionToEdit: Inscription | null;
	// NUEVO: Agregamos nuevoMetodoPago como parámetro a la función onSave
	onSave: (
		id: string,
		nuevoEstado: InscriptionStatus,
		nuevoMonto: number,
		nuevoMetodoPago?: string,
	) => Promise<void>;
}

export default function EditInscriptionModal({
	isOpen,
	onClose,
	inscriptionToEdit,
	onSave,
}: EditInscriptionModalProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMsg, setErrorMsg] = useState(""); // NUEVO: Estado para errores de validación

	// NUEVO: Agregamos paymentMethod al estado
	const [formData, setFormData] = useState<{
		status: InscriptionStatus;
		monto: string;
		paymentMethod: string;
	}>({
		status: "Pendiente",
		monto: "",
		paymentMethod: "",
	});

	useEffect(() => {
		if (inscriptionToEdit && isOpen) {
			setFormData({
				status: inscriptionToEdit.status,
				monto: inscriptionToEdit.cursoInscripcion.toString(),
				paymentMethod: inscriptionToEdit.paymentMethod || "", // Cargamos el dato si ya existía
			});
			setErrorMsg(""); // Limpiamos errores al abrir
		}
	}, [inscriptionToEdit, isOpen]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!inscriptionToEdit) return;
		setErrorMsg("");

		// VALIDACIÓN CRÍTICA CONTABLE
		if (formData.status === "Confirmado" && !formData.paymentMethod) {
			setErrorMsg(
				"Debes seleccionar un método de pago para confirmar la inscripción.",
			);
			return;
		}

		setIsSubmitting(true);
		try {
			// Pasamos los 4 parámetros al padre
			await onSave(
				inscriptionToEdit.id,
				formData.status,
				parseFloat(formData.monto) || 0,
				formData.status === "Confirmado" ? formData.paymentMethod : undefined,
			);
			onClose();
		} catch (error) {
			console.error("Error al actualizar inscripción:", error);
			setErrorMsg("Hubo un error al guardar los cambios en la base de datos.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<AnimatePresence>
			{isOpen && inscriptionToEdit && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={!isSubmitting ? onClose : undefined}
						className="fixed inset-0 bg-[#252d62]/80 backdrop-blur-sm z-50 transition-opacity"
					/>

					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 20 }}
							className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col"
						>
							{/* HEADER MODAL */}
							<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
								<div>
									<h2 className="text-xl font-bold text-[#252d62]">
										Editar Inscripción
									</h2>
									<p className="text-xs text-gray-500 font-mono mt-0.5">
										ID: {inscriptionToEdit.id}
									</p>
								</div>
								<button
									onClick={!isSubmitting ? onClose : undefined}
									disabled={isSubmitting}
									className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
								>
									<X className="w-5 h-5" />
								</button>
							</div>

							{/* BODY MODAL */}
							<div className="p-6">
								{/* Datos de solo lectura */}
								<div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-6">
									<div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
										<div>
											<p className="text-gray-500 text-[11px] font-bold uppercase tracking-wider mb-0.5">
												Alumno
											</p>
											<p className="font-semibold text-[#252d62]">
												{inscriptionToEdit.alumnoNombre}
											</p>
										</div>

										<div>
											<p className="text-gray-500 text-[11px] font-bold uppercase tracking-wider mb-0.5">
												DNI
											</p>
											<p className="font-semibold text-gray-700">
												{inscriptionToEdit.alumnoDni}
											</p>
										</div>

										<div>
											<p className="text-gray-500 text-[11px] font-bold uppercase tracking-wider mb-0.5">
												Curso
											</p>
											<p className="font-bold text-[#EE1120]">
												{inscriptionToEdit.cursoNombre}
											</p>
										</div>

										<div>
											<p className="text-gray-500 text-[11px] font-bold uppercase tracking-wider mb-0.5">
												Método Actual
											</p>
											<p className="font-semibold text-[#252d62]">
												{inscriptionToEdit.paymentMethod || "No especificado"}
											</p>
										</div>

										<div className="col-span-2 pt-3 mt-1 border-t border-blue-200/60">
											<p className="text-gray-400 text-[11px] flex items-center gap-1.5">
												<AlertCircle className="w-3.5 h-3.5" /> Estos datos no
												pueden modificarse desde aquí.
											</p>
										</div>
									</div>
								</div>

								{/* Mensaje de Error (Si lo hay) */}
								{errorMsg && (
									<div className="mb-4 bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2 font-medium">
										<AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
										<p>{errorMsg}</p>
									</div>
								)}

								{/* Formulario Editable */}
								<form
									id="edit-inscription-form"
									onSubmit={handleSubmit}
									className="space-y-5"
								>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
										{/* Monto */}
										<div>
											<label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
												Monto Abonado / A Pagar
											</label>
											<div className="relative">
												<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
													$
												</span>
												<input
													type="number"
													required
													disabled={isSubmitting}
													value={formData.monto}
													onChange={(e) =>
														setFormData({ ...formData, monto: e.target.value })
													}
													className="block w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-white transition-colors"
												/>
											</div>
										</div>

										{/* Estado */}
										<div>
											<label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
												Estado de Inscripción
											</label>
											<select
												required
												disabled={isSubmitting}
												value={formData.status}
												onChange={(e) =>
													setFormData({
														...formData,
														status: e.target.value as InscriptionStatus,
													})
												}
												className={`block w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors font-bold
                          ${formData.status === "Confirmado" ? "border-green-200 bg-green-50 text-green-700 focus:ring-green-500/20 focus:border-green-500" : ""}
                          ${formData.status === "Pendiente" ? "border-yellow-200 bg-yellow-50 text-yellow-700 focus:ring-yellow-500/20 focus:border-yellow-500" : ""}
                          ${formData.status === "Cancelado" ? "border-red-200 bg-red-100 text-red-700 focus:ring-red-500/20 focus:border-red-500" : ""}
                        `}
											>
												<option value="Pendiente">🟡 Pendiente</option>
												<option value="Confirmado">🟢 Confirmado</option>
												<option value="Cancelado">🔴 Cancelado</option>
											</select>
										</div>

										{/* NUEVO: Selector de Método de Pago Condicional */}
										{formData.status === "Confirmado" && (
											<div className="col-span-1 sm:col-span-2 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
												<label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
													Método de Pago Utilizado
												</label>
												<select
													required
													disabled={isSubmitting}
													value={formData.paymentMethod}
													onChange={(e) =>
														setFormData({
															...formData,
															paymentMethod: e.target.value,
														})
													}
													className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-white transition-colors"
												>
													<option value="" disabled>
														-- Seleccione un método --
													</option>
													<option value="Efectivo">Efectivo</option>
													<option value="Transferencia Bancaria (Verificada)">
														Transferencia Bancaria (Verificada)
													</option>
													<option value="Tarjeta (Posnet)">
														Tarjeta (Posnet)
													</option>
												</select>
											</div>
										)}
									</div>
								</form>
							</div>

							{/* FOOTER MODAL */}
							<div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
								<Button
									type="button"
									variant="outline"
									onClick={onClose}
									disabled={isSubmitting}
									className="border-gray-300 text-gray-700 hover:bg-gray-100"
								>
									Cancelar
								</Button>
								<Button
									type="submit"
									form="edit-inscription-form"
									disabled={isSubmitting}
									className="bg-[#252d62] hover:bg-[#1d2355] text-white shadow-md min-w-[140px] flex items-center justify-center"
								>
									{isSubmitting ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : (
										<>
											<Save className="w-4 h-4 mr-2" />
											Guardar
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
