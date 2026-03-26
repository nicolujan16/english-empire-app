"use client";

import React, { useState, useEffect } from "react";
import {
	X,
	Save,
	Loader2,
	AlertCircle,
	CalendarClock,
	ShieldAlert,
	Trash2,
	Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
	collection,
	query,
	where,
	getDocs,
	doc,
	getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

// ─── IMPORTAMOS EL SERVICIO DE CUOTAS ─────────────────────────────────────────
import {
	crearPrimeraCuota,
	aplicarDescuentoAlGrupo,
	calcularMontoPrimerMes,
} from "@/lib/services/cuotasServices";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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
	alumnoId: string;
	alumnoTipo: "adulto" | "menor" | string;
	cursoId: string;
	cursoNombre: string;
	cuota1a10: number;
	cuota11enAdelante: number;
	cursoInscripcion: number;
	status: InscriptionStatus;
	metodoPago?: string | null;
	fechaPromesaPago?: string | null;
	etiquetas?: string[];
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

interface GrupoFamiliarInfo {
	aplica: boolean;
	miembrosActivos: { nombre: string; cursoNombre: string }[];
	tutorId: string;
}

const MESES_NOMBRES = [
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

// ─── Helpers Locales ──────────────────────────────────────────────────────────

const getTomorrow = () => {
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	return tomorrow.toISOString().split("T")[0];
};

async function getCursoNombre(cursoId: string): Promise<string> {
	try {
		const snap = await getDoc(doc(db, "Cursos", cursoId));
		return snap.exists() ? (snap.data().nombre ?? cursoId) : cursoId;
	} catch {
		return cursoId;
	}
}

// ─── Aviso de acción irreversible ─────────────────────────────────────────────

function IrreversibleWarning({
	type,
	alumnoNombre,
	cursoNombre,
}: {
	type: "confirmar" | "cancelar";
	alumnoNombre: string;
	cursoNombre: string;
}) {
	const isConfirm = type === "confirmar";
	return (
		<motion.div
			initial={{ opacity: 0, y: -6 }}
			animate={{ opacity: 1, y: 0 }}
			className={`rounded-xl border p-4 mb-4 ${isConfirm ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
		>
			<div className="flex items-start gap-3">
				<div
					className={`shrink-0 mt-0.5 ${isConfirm ? "text-green-600" : "text-red-600"}`}
				>
					{isConfirm ? (
						<ShieldAlert className="w-5 h-5" />
					) : (
						<Trash2 className="w-5 h-5" />
					)}
				</div>
				<div>
					<p
						className={`text-sm font-bold mb-1 ${isConfirm ? "text-green-800" : "text-red-800"}`}
					>
						{isConfirm
							? "⚠️ Esta acción no se puede deshacer"
							: "🗑️ Esta inscripción se eliminará"}
					</p>
					<p
						className={`text-xs leading-relaxed ${isConfirm ? "text-green-700" : "text-red-700"}`}
					>
						{isConfirm ? (
							<>
								Estás por <strong>confirmar</strong> la inscripción de{" "}
								<strong>{alumnoNombre}</strong> al curso{" "}
								<strong>{cursoNombre}</strong>. Una vez confirmada, la
								inscripción quedará bloqueada y{" "}
								<strong>no podrá modificarse ni eliminarse</strong>. Verificá el
								método de pago y los datos antes de continuar.
							</>
						) : (
							<>
								Estás por <strong>cancelar</strong> la inscripción de{" "}
								<strong>{alumnoNombre}</strong> al curso{" "}
								<strong>{cursoNombre}</strong>. Esta acción{" "}
								<strong>eliminará permanentemente</strong> el registro del
								sistema y quitará el curso del perfil del alumno. No hay forma
								de recuperarlo.
							</>
						)}
					</p>
				</div>
			</div>
		</motion.div>
	);
}

// ─── Componente principal ─────────────────────────────────────────────────────

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

	const [grupoFamiliar, setGrupoFamiliar] = useState<GrupoFamiliarInfo>({
		aplica: false,
		miembrosActivos: [],
		tutorId: "",
	});
	const [isCheckingGrupo, setIsCheckingGrupo] = useState(false);
	const [aplicarDescuentoMesActual, setAplicarDescuentoMesActual] =
		useState(true);

	// Variable de estado para guardar la información del curso desde Firebase (necesaria para `finMes`)
	const [cursoDetails, setCursoDetails] = useState<{ finMes: number } | null>(
		null,
	);

	useEffect(() => {
		if (inscriptionToEdit && isOpen) {
			setFormData({
				status: inscriptionToEdit.status,
				monto: inscriptionToEdit.cursoInscripcion.toString(),
				metodoPago: inscriptionToEdit.metodoPago || "",
				fechaPromesaPago: inscriptionToEdit.fechaPromesaPago || "",
			});
			setErrorMsg("");
			setGrupoFamiliar({ aplica: false, miembrosActivos: [], tutorId: "" });
			setAplicarDescuentoMesActual(true);

			// Vamos a buscar los detalles del curso (como el `finMes`) a Firebase
			const fetchCursoDetails = async () => {
				try {
					const snap = await getDoc(
						doc(db, "Cursos", inscriptionToEdit.cursoId),
					);
					if (snap.exists())
						setCursoDetails({ finMes: snap.data().finMes ?? 12 });
				} catch (e) {
					console.error("Error fetching curso:", e);
				}
			};
			fetchCursoDetails();
		}
	}, [inscriptionToEdit, isOpen]);

	const detectarGrupoFamiliar = async (inscripcion: Inscription) => {
		setIsCheckingGrupo(true);
		try {
			const miembrosActivos: { nombre: string; cursoNombre: string }[] = [];
			let tutorId = inscripcion.alumnoId;
			const esMenor =
				inscripcion.alumnoTipo === "menor" ||
				(inscripcion.alumnoTipo as string) === "Menor";

			if (!esMenor) {
				const hijosSnap = await getDocs(
					query(
						collection(db, "Hijos"),
						where("tutorId", "==", inscripcion.alumnoId),
					),
				);
				for (const h of hijosSnap.docs) {
					const data = h.data();
					if ((data.cursos ?? []).length > 0)
						miembrosActivos.push({
							nombre: `${data.nombre} ${data.apellido}`,
							cursoNombre: await getCursoNombre(data.cursos[0]),
						});
				}
			} else {
				const hijoSnap = await getDoc(doc(db, "Hijos", inscripcion.alumnoId));
				if (hijoSnap.exists())
					tutorId = hijoSnap.data().tutorId ?? inscripcion.alumnoId;

				const tutorSnap = await getDoc(doc(db, "Users", tutorId));
				if (tutorSnap.exists() && (tutorSnap.data().cursos ?? []).length > 0) {
					const td = tutorSnap.data();
					miembrosActivos.push({
						nombre: `${td.nombre} ${td.apellido}`,
						cursoNombre: await getCursoNombre(td.cursos[0]),
					});
				}

				const hermanosSnap = await getDocs(
					query(collection(db, "Hijos"), where("tutorId", "==", tutorId)),
				);
				for (const h of hermanosSnap.docs) {
					if (h.id === inscripcion.alumnoId) continue;
					const data = h.data();
					if ((data.cursos ?? []).length > 0)
						miembrosActivos.push({
							nombre: `${data.nombre} ${data.apellido}`,
							cursoNombre: await getCursoNombre(data.cursos[0]),
						});
				}
			}

			setGrupoFamiliar({
				aplica: miembrosActivos.length > 0,
				miembrosActivos,
				tutorId,
			});
		} catch (error) {
			console.error("Error:", error);
			setGrupoFamiliar({
				aplica: false,
				miembrosActivos: [],
				tutorId: inscripcion.alumnoId,
			});
		} finally {
			setIsCheckingGrupo(false);
		}
	};

	useEffect(() => {
		if (!inscriptionToEdit) return;
		const vaAConfirmar =
			inscriptionToEdit.status !== "Confirmado" &&
			formData.status === "Confirmado";

		if (vaAConfirmar) {
			detectarGrupoFamiliar(inscriptionToEdit);
		} else {
			setGrupoFamiliar({ aplica: false, miembrosActivos: [], tutorId: "" });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [formData.status]);

	const handleSubmit = async (e: React.SyntheticEvent) => {
		e.preventDefault();
		if (!inscriptionToEdit) return;
		setErrorMsg("");

		if (formData.status === "Confirmado" && !formData.metodoPago) {
			setErrorMsg("Debes seleccionar un método de pago.");
			return;
		}
		if (formData.status === "Pendiente" && !formData.fechaPromesaPago) {
			setErrorMsg("Debes ingresar una fecha de promesa.");
			return;
		}
		if (
			formData.status === "Pendiente" &&
			formData.fechaPromesaPago < getTomorrow()
		) {
			setErrorMsg("La fecha debe ser a partir de mañana.");
			return;
		}

		setIsSubmitting(true);
		try {
			let finalmetodoPago = null;
			let finalFechaPromesa = null;

			if (formData.status === "Confirmado")
				finalmetodoPago = formData.metodoPago;
			else if (formData.status === "Pendiente")
				finalFechaPromesa = formData.fechaPromesaPago;

			await onSave(
				inscriptionToEdit.id,
				formData.status,
				parseFloat(formData.monto) || 0,
				finalmetodoPago,
				finalFechaPromesa,
			);

			const estaConfirmandoAhora =
				inscriptionToEdit.status !== "Confirmado" &&
				formData.status === "Confirmado";

			if (estaConfirmandoAhora) {
				const descuentos = grupoFamiliar.aplica
					? [{ porcentaje: 10, detalle: "Grupo Familiar" }]
					: [];

				// ─── LLAMAMOS A LOS SERVICIOS CENTRALIZADOS ───

				// Adaptamos los objetos para el servicio
				const alumnoSrv = {
					id: inscriptionToEdit.alumnoId,
					dni: inscriptionToEdit.alumnoDni,
					nombre: inscriptionToEdit.alumnoNombre,
					apellido: "",
					tipo: inscriptionToEdit.alumnoTipo,
					etiquetas: inscriptionToEdit?.etiquetas,
				};

				const cursoSrv = {
					id: inscriptionToEdit.cursoId,
					nombre: inscriptionToEdit.cursoNombre,
					cuota1a10: inscriptionToEdit.cuota1a10,
					cuota11enAdelante: inscriptionToEdit.cuota11enAdelante,
					finMes: cursoDetails?.finMes || 12, // Usamos el finMes recuperado
				};

				// 1. Creamos la cuota
				await crearPrimeraCuota(
					inscriptionToEdit.id,
					alumnoSrv,
					cursoSrv,
					descuentos,
				);

				// 2. Aplicamos el descuento al grupo
				if (grupoFamiliar.aplica) {
					await aplicarDescuentoAlGrupo(
						inscriptionToEdit.alumnoId,
						inscriptionToEdit.alumnoTipo,
						grupoFamiliar.tutorId,
						aplicarDescuentoMesActual,
					);
				}

				// 🚀 PASO 3: ENVIAR CORREO DE COMPROBANTE
				let emailDestino = "";

				try {
					// Buscamos el mail dependiendo de si es Menor o Titular
					const esMenor =
						inscriptionToEdit.alumnoTipo.toLowerCase() === "menor";

					if (esMenor) {
						const hijoSnap = await getDoc(
							doc(db, "Hijos", inscriptionToEdit.alumnoId),
						);
						if (hijoSnap.exists()) {
							const data = hijoSnap.data();
							// Priorizamos datosTutor.email, sino buscamos el doc del tutor
							emailDestino = data.datosTutor?.email || "";
							if (!emailDestino && data.tutorId) {
								const tutorSnap = await getDoc(doc(db, "Users", data.tutorId));
								if (tutorSnap.exists())
									emailDestino = tutorSnap.data().email || "";
							}
						}
					} else {
						const userSnap = await getDoc(
							doc(db, "Users", inscriptionToEdit.alumnoId),
						);
						if (userSnap.exists()) {
							emailDestino = userSnap.data().email || "";
						}
					}
				} catch (e) {
					console.error("Error buscando el email del alumno/tutor:", e);
				}

				// Si encontramos un email válido, disparamos a la API
				if (emailDestino !== "") {
					try {
						await fetch("/api/correos/inscripcion", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								emailDestino: emailDestino,
								nombreAlumno: inscriptionToEdit.alumnoNombre,
								cursoNombre: inscriptionToEdit.cursoNombre,
								montoAbonado:
									parseFloat(formData.monto) ||
									inscriptionToEdit.cursoInscripcion,
								metodoPago: formData.metodoPago,
								nroComprobante: `TXN-${inscriptionToEdit.id.slice(-8).toUpperCase()}`,
							}),
						});
						console.log("✉️ Comprobante enviado por correo a:", emailDestino);
					} catch (emailError) {
						console.error(
							"❌ Error enviando el comprobante por mail:",
							emailError,
						);
					}
				}
			}

			onClose();
		} catch (error) {
			console.error("Error al actualizar:", error);
			setErrorMsg("Hubo un error al guardar los cambios en la base de datos.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const previewMontoPrimerMes =
		inscriptionToEdit &&
		inscriptionToEdit.status !== "Confirmado" &&
		formData.status === "Confirmado" &&
		inscriptionToEdit.cuota1a10 > 0
			? calcularMontoPrimerMes(new Date(), inscriptionToEdit.cuota1a10)
			: null;

	const isConfirming =
		inscriptionToEdit?.status !== "Confirmado" &&
		formData.status === "Confirmado";
	const isCancelling =
		inscriptionToEdit?.status !== "Cancelado" &&
		formData.status === "Cancelado";

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

							<div className="p-6 overflow-y-auto max-h-[70vh]">
								<div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-5">
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
									</div>
								</div>

								{isConfirming && (
									<IrreversibleWarning
										type="confirmar"
										alumnoNombre={inscriptionToEdit.alumnoNombre}
										cursoNombre={inscriptionToEdit.cursoNombre}
									/>
								)}
								{isCancelling && (
									<IrreversibleWarning
										type="cancelar"
										alumnoNombre={inscriptionToEdit.alumnoNombre}
										cursoNombre={inscriptionToEdit.cursoNombre}
									/>
								)}

								{isConfirming && (
									<>
										{isCheckingGrupo && (
											<div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 p-3 rounded-lg mb-4">
												<Loader2 className="w-4 h-4 animate-spin text-[#252d62]" />{" "}
												Verificando beneficios del grupo familiar...
											</div>
										)}

										{!isCheckingGrupo && grupoFamiliar.aplica && (
											<motion.div
												initial={{ opacity: 0, y: -6 }}
												animate={{ opacity: 1, y: 0 }}
												className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-3 mb-4"
											>
												<div className="flex items-start gap-2">
													<Users className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
													<div>
														<p className="text-sm font-bold text-emerald-800">
															¡Descuento por Grupo Familiar disponible!
														</p>
														<p className="text-xs text-emerald-700 mt-0.5">
															Al confirmar, todos recibirán un{" "}
															<span className="font-bold">
																10% de descuento
															</span>{" "}
															en sus cuotas.
														</p>
													</div>
												</div>
												<label className="flex items-center gap-2.5 cursor-pointer select-none border-t border-emerald-200 pt-2">
													<input
														type="checkbox"
														checked={aplicarDescuentoMesActual}
														onChange={(e) =>
															setAplicarDescuentoMesActual(e.target.checked)
														}
														className="w-4 h-4 text-emerald-600 rounded border-emerald-300"
													/>
													<span className="text-xs font-semibold text-emerald-800">
														Aplicar descuento en cuotas de{" "}
														{MESES_NOMBRES[new Date().getMonth()]} (mes actual)
													</span>
												</label>
											</motion.div>
										)}
									</>
								)}

								{errorMsg && (
									<div className="mb-4 bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2 font-medium">
										<AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
										<p>{errorMsg}</p>
									</div>
								)}

								<form
									id="edit-inscription-form"
									onSubmit={handleSubmit}
									className="space-y-5"
								>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
														metodoPago:
															e.target.value !== "Confirmado"
																? ""
																: formData.metodoPago,
														fechaPromesaPago:
															e.target.value !== "Pendiente"
																? ""
																: formData.fechaPromesaPago,
													})
												}
												className={`block w-full px-3 py-2.5 border rounded-lg text-sm font-bold ${formData.status === "Confirmado" ? "border-green-200 bg-green-50 text-green-700" : ""} ${formData.status === "Pendiente" ? "border-yellow-200 bg-yellow-50 text-yellow-700" : ""} ${formData.status === "Cancelado" ? "border-red-200 bg-red-100 text-red-700" : ""}`}
											>
												<option value="Pendiente">🟡 Pendiente</option>
												<option value="Confirmado">🟢 Confirmado</option>
												<option value="Cancelado">
													🔴 Cancelar y eliminar
												</option>
											</select>
										</div>

										{formData.status === "Confirmado" && (
											<div className="col-span-1 sm:col-span-2 mt-2 animate-in fade-in space-y-3">
												<div>
													<label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
														Método de Pago
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
														className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
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
												{previewMontoPrimerMes !== null && (
													<div className="bg-blue-50 border border-blue-200 p-3 rounded-lg mt-3">
														<p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1.5">
															Primera Cuota a Generar
														</p>
														<div className="flex justify-between items-center text-sm">
															<span className="text-blue-600">
																{new Date().getDate() >= 15
																	? "Inscripción desde el día 15 → 50%"
																	: "Inscripción antes del día 15 → 100%"}
															</span>
															{grupoFamiliar.aplica ? (
																<div className="flex flex-col items-end">
																	<span className="font-bold text-blue-800 text-base">
																		$
																		{Math.round(
																			previewMontoPrimerMes * 0.9,
																		).toLocaleString("es-AR")}
																	</span>
																	<span className="text-[10px] text-blue-400 line-through">
																		$
																		{previewMontoPrimerMes.toLocaleString(
																			"es-AR",
																		)}
																	</span>
																</div>
															) : (
																<span className="font-bold text-blue-800 text-base">
																	$
																	{previewMontoPrimerMes.toLocaleString(
																		"es-AR",
																	)}
																</span>
															)}
														</div>
													</div>
												)}
											</div>
										)}

										{formData.status === "Pendiente" && (
											<div className="col-span-1 sm:col-span-2 mt-2 bg-yellow-50/50 p-4 border border-yellow-200 rounded-xl">
												<label className="block text-xs font-bold text-yellow-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
													<CalendarClock className="w-4 h-4" /> Fecha Promesa de
													Pago
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
													className="block w-full px-3 py-2.5 border border-yellow-300 rounded-lg text-sm bg-white"
												/>
											</div>
										)}
									</div>
								</form>
							</div>

							<div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
								<Button
									type="button"
									variant="outline"
									onClick={onClose}
									disabled={isSubmitting}
									className="border-gray-300 text-gray-700"
								>
									Cancelar
								</Button>
								<Button
									type="submit"
									form="edit-inscription-form"
									disabled={isSubmitting || (isConfirming && isCheckingGrupo)}
									className={`shadow-md min-w-[160px] text-white ${isCancelling ? "bg-red-600" : isConfirming ? "bg-green-600" : "bg-[#252d62]"}`}
								>
									{isSubmitting || (isCheckingGrupo && isConfirming) ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : isCancelling ? (
										<>
											<Trash2 className="w-4 h-4 mr-2" /> Eliminar
										</>
									) : isConfirming ? (
										<>
											<ShieldAlert className="w-4 h-4 mr-2" /> Confirmar
										</>
									) : (
										<>
											<Save className="w-4 h-4 mr-2" /> Guardar
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
