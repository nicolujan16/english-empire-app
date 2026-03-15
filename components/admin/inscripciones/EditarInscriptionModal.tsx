"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Loader2, AlertCircle, CalendarClock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
	collection,
	addDoc,
	getDocs,
	query,
	where,
	serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

export type InscriptionStatus =
	| "Confirmado"
	| "Pendiente"
	| "Cancelado"
	| string;

export interface Inscription {
	id: string;
	fecha: string;
	alumnoNombre: string;
	alumnoDni: string;
	// ── Campos necesarios para crear la cuota ──────────────────────────────
	alumnoId: string;
	alumnoTipo: "adulto" | "menor";
	cursoId: string;
	cursoNombre: string;
	// Snapshot de precios del curso (guardados al crear la inscripción)
	cuota1a10: number;
	cuota11enAdelante: number;
	// ───────────────────────────────────────────────────────────────────────
	cursoInscripcion: number;
	status: InscriptionStatus;
	metodoPago?: string | null;
	fechaPromesaPago?: string | null;
}

interface EditInscriptionModalProps {
	isOpen: boolean;
	onClose: () => void;
	inscriptionToEdit: Inscription | null;
	onSave: (
		id: string,
		nuevoEstado: InscriptionStatus,
		nuevoMonto: number,
		nuevoMetodoPago?: string | null,
		nuevaFechaPromesa?: string | null,
	) => Promise<void>;
}

const getTomorrow = () => {
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	return tomorrow.toISOString().split("T")[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// Misma lógica que en ManualInscriptionModal:
//   · Día < 15  → cuota completa (cuota1a10)
//   · Día >= 15 → 50% de cuota1a10
// ─────────────────────────────────────────────────────────────────────────────
const calcularMontoPrimerMes = (
	fechaConfirmacion: Date,
	cuota1a10: number,
): number => {
	const dia = fechaConfirmacion.getDate();
	return dia >= 15 ? cuota1a10 * 0.5 : cuota1a10;
};

export default function EditInscriptionModal({
	isOpen,
	onClose,
	inscriptionToEdit,
	onSave,
}: EditInscriptionModalProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");

	const [formData, setFormData] = useState<{
		status: InscriptionStatus;
		monto: string;
		metodoPago: string;
		fechaPromesaPago: string;
	}>({
		status: "Pendiente",
		monto: "",
		metodoPago: "",
		fechaPromesaPago: "",
	});

	useEffect(() => {
		if (inscriptionToEdit && isOpen) {
			setFormData({
				status: inscriptionToEdit.status,
				monto: inscriptionToEdit.cursoInscripcion.toString(),
				metodoPago: inscriptionToEdit.metodoPago || "",
				fechaPromesaPago: inscriptionToEdit.fechaPromesaPago || "",
			});
			setErrorMsg("");
		}
	}, [inscriptionToEdit, isOpen]);

	// ─────────────────────────────────────────────────────────────────────────
	// Crea la primera cuota cuando una inscripción pasa de Pendiente a
	// Confirmado. Incluye una verificación de idempotencia: si ya existe
	// una cuota con esPrimerMes=true para esta inscripción (ej: el secretario
	// guardó dos veces por error), no se crea un duplicado.
	// ─────────────────────────────────────────────────────────────────────────
	const crearPrimeraCuota = async (inscripcion: Inscription) => {
		// Verificación de idempotencia: no crear si ya existe
		const cuotasRef = collection(db, "Cuotas");
		const qExistente = query(
			cuotasRef,
			where("inscripcionId", "==", inscripcion.id),
			where("esPrimerMes", "==", true),
		);
		const snap = await getDocs(qExistente);

		if (!snap.empty) {
			// Ya existe la primera cuota, no hacemos nada
			console.warn(
				`Primera cuota ya existente para inscripción ${inscripcion.id}. Se omite la creación.`,
			);
			return;
		}

		const hoy = new Date();
		const montoPrimerMes = calcularMontoPrimerMes(hoy, inscripcion.cuota1a10);

		const cuotaData = {
			// Referencias
			inscripcionId: inscripcion.id,
			alumnoId: inscripcion.alumnoId,
			alumnoTipo: inscripcion.alumnoTipo,
			alumnoNombre: inscripcion.alumnoNombre,
			alumnoDni: inscripcion.alumnoDni,
			cursoId: inscripcion.cursoId,
			cursoNombre: inscripcion.cursoNombre,

			// Período
			mes: hoy.getMonth() + 1,
			anio: hoy.getFullYear(),

			// Snapshot de precios al momento de confirmación
			cuota1a10: inscripcion.cuota1a10,
			cuota11enAdelante: inscripcion.cuota11enAdelante,

			// Primer mes con monto pre-calculado
			esPrimerMes: true,
			montoPrimerMes,

			// Estado inicial
			estado: "Pendiente",
			fechaPago: null,
			montoPagado: null,
			metodoPago: null,

			creadoEn: serverTimestamp(),
			actualizadoEn: serverTimestamp(),
		};

		await addDoc(cuotasRef, cuotaData);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!inscriptionToEdit) return;
		setErrorMsg("");

		// Validación: si es confirmado, exige método de pago
		if (formData.status === "Confirmado" && !formData.metodoPago) {
			setErrorMsg(
				"Debes seleccionar un método de pago para confirmar la inscripción.",
			);
			return;
		}

		// Validación: si es pendiente, exige promesa de pago
		if (formData.status === "Pendiente" && !formData.fechaPromesaPago) {
			setErrorMsg(
				"Debes ingresar una fecha de promesa de pago para inscripciones pendientes.",
			);
			return;
		}

		// Validación: la fecha promesa no puede ser anterior a mañana
		if (
			formData.status === "Pendiente" &&
			formData.fechaPromesaPago < getTomorrow()
		) {
			setErrorMsg("La fecha de promesa de pago debe ser a partir de mañana.");
			return;
		}

		setIsSubmitting(true);
		try {
			let finalmetodoPago = null;
			let finalFechaPromesa = null;

			if (formData.status === "Confirmado") {
				finalmetodoPago = formData.metodoPago;
				finalFechaPromesa = null;
			} else if (formData.status === "Pendiente") {
				finalmetodoPago = null;
				finalFechaPromesa = formData.fechaPromesaPago;
			}

			// 1️⃣ Guardamos los cambios en la inscripción
			await onSave(
				inscriptionToEdit.id,
				formData.status,
				parseFloat(formData.monto) || 0,
				finalmetodoPago,
				finalFechaPromesa,
			);

			// 2️⃣ Si la inscripción acaba de pasar a Confirmado desde otro estado,
			//    creamos la primera cuota. La verificación de idempotencia dentro
			//    de crearPrimeraCuota evita duplicados si ya existía.
			const estaConfirmandoAhora =
				inscriptionToEdit.status !== "Confirmado" &&
				formData.status === "Confirmado";

			if (estaConfirmandoAhora) {
				await crearPrimeraCuota(inscriptionToEdit);
			}

			onClose();
		} catch (error) {
			console.error("Error al actualizar inscripción:", error);
			setErrorMsg("Hubo un error al guardar los cambios en la base de datos.");
		} finally {
			setIsSubmitting(false);
		}
	};

	// Calculamos el preview del monto para mostrárselo al secretario antes de guardar
	const previewMontoPrimerMes =
		inscriptionToEdit &&
		inscriptionToEdit.status !== "Confirmado" &&
		formData.status === "Confirmado" &&
		inscriptionToEdit.cuota1a10 > 0
			? calcularMontoPrimerMes(new Date(), inscriptionToEdit.cuota1a10)
			: null;

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
												{inscriptionToEdit.metodoPago || "No especificado"}
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

								{/* Mensaje de Error */}
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
												<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
													$
												</span>
												<input
													type="number"
													disabled
													value={formData.monto}
													className="block w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-500 cursor-not-allowed focus:outline-none"
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

										{/* MÉTODO DE PAGO (solo si Confirmado) */}
										{formData.status === "Confirmado" && (
											<div className="col-span-1 sm:col-span-2 mt-2 animate-in fade-in slide-in-from-top-2 duration-300 space-y-3">
												<div>
													<label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
														Método de Pago Utilizado
													</label>
													<select
														required
														disabled={isSubmitting}
														value={formData.metodoPago}
														onChange={(e) =>
															setFormData({
																...formData,
																metodoPago: e.target.value,
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

												{/* Preview de primera cuota (solo si está CONFIRMANDO AHORA) */}
												{previewMontoPrimerMes !== null && (
													<motion.div
														initial={{ opacity: 0, height: 0 }}
														animate={{ opacity: 1, height: "auto" }}
														className="bg-blue-50 border border-blue-200 p-3 rounded-lg overflow-hidden"
													>
														<p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1.5">
															Primera Cuota a Generar
														</p>
														<div className="flex justify-between items-center text-sm">
															<span className="text-blue-600">
																{new Date().getDate() >= 15
																	? "Inscripción desde el día 15 → 50%"
																	: "Inscripción antes del día 15 → 100%"}
															</span>
															<span className="font-bold text-blue-800 text-base">
																${previewMontoPrimerMes.toLocaleString("es-AR")}
															</span>
														</div>
														<p className="text-[11px] text-blue-400 mt-1">
															Se generará automáticamente al guardar.
														</p>
													</motion.div>
												)}
											</div>
										)}

										{/* FECHA PROMESA DE PAGO (solo si Pendiente) */}
										{formData.status === "Pendiente" && (
											<div className="col-span-1 sm:col-span-2 mt-2 animate-in fade-in slide-in-from-top-2 duration-300 bg-yellow-50/50 p-4 border border-yellow-200 rounded-xl">
												<label className="block text-xs font-bold text-yellow-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
													<CalendarClock className="w-4 h-4" />
													Fecha Promesa de Pago
												</label>
												<input
													type="date"
													required
													disabled={isSubmitting}
													min={getTomorrow()}
													value={formData.fechaPromesaPago}
													onChange={(e) =>
														setFormData({
															...formData,
															fechaPromesaPago: e.target.value,
														})
													}
													className="block w-full px-3 py-2.5 border border-yellow-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 bg-white transition-colors"
												/>
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
