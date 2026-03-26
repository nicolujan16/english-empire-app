/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, SyntheticEvent, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	collection,
	query,
	where,
	getDocs,
	addDoc,
	serverTimestamp,
	doc,
	updateDoc,
	arrayUnion,
	getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { type Descuento } from "@/lib/cuotas";

// ─── IMPORTAMOS EL SERVICIO DE CUOTAS ─────────────────────────────────────────
import {
	crearPrimeraCuota,
	aplicarDescuentoAlGrupo,
	calcularMontoPrimerMes,
} from "@/lib/services/cuotasServices";

import Step1SearchStudent from "./Step1SearchStudent";
import Step2CoursePayment from "./Step2CoursePayment";

export interface TagDiscount {
	id: string;
	nombre: string;
	descuentoInscripcion: number;
}

export interface StudentData {
	id: string;
	nombre: string;
	apellido: string;
	dni: string;
	tipo: "Titular" | "Menor";
	edad: number;
	tutorId?: string;
	etiquetas?: any[];
	email?: string;
}

export interface CourseData {
	id: string;
	nombre: string;
	inscripcion: number;
	cuota: number;
	cuota1a10: number;
	cuota11enAdelante: number;
	finMes: number;
	edadMinima: number;
	edadMaxima: number;
}

export interface GrupoFamiliarInfo {
	aplica: boolean;
	miembrosActivos: { nombre: string; cursoNombre: string }[];
	tutorId: string;
}

interface AlertState {
	isOpen: boolean;
	title: string;
	message: string;
	type: "error" | "success" | "warning";
}

interface ManualInscriptionModalProps {
	isOpen: boolean;
	onClose: () => void;
}

const DESCUENTO_GRUPO_FAMILIAR: Descuento[] = [
	{ porcentaje: 10, detalle: "Grupo Familiar" },
];

export const getTomorrow = () => {
	const t = new Date();
	t.setDate(t.getDate() + 1);
	return t.toISOString().split("T")[0];
};

const calcularEdad = (fechaNacimiento: string): number => {
	if (!fechaNacimiento) return 0;
	const hoy = new Date();
	const cumple = new Date(fechaNacimiento);
	let edad = hoy.getFullYear() - cumple.getFullYear();
	const m = hoy.getMonth() - cumple.getMonth();
	if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) edad--;
	return Math.max(0, edad);
};

async function getCursoNombre(cursoId: string): Promise<string> {
	try {
		const snap = await getDoc(doc(db, "Cursos", cursoId));
		return snap.exists() ? (snap.data().nombre ?? cursoId) : cursoId;
	} catch {
		return cursoId;
	}
}

export default function ManualInscriptionModal({
	isOpen,
	onClose,
}: ManualInscriptionModalProps) {
	const [step, setStep] = useState<1 | 2>(1);
	const [alertDialog, setAlertDialog] = useState<AlertState>({
		isOpen: false,
		title: "",
		message: "",
		type: "error",
	});

	const [searchDni, setSearchDni] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const [searchError, setSearchError] = useState("");
	const [foundStudent, setFoundStudent] = useState<StudentData | null>(null);
	const [grupoFamiliar, setGrupoFamiliar] = useState<GrupoFamiliarInfo>({
		aplica: false,
		miembrosActivos: [],
		tutorId: "",
	});
	const [isCheckingGrupo, setIsCheckingGrupo] = useState(false);
	const [aplicarDescuentoMesActual, setAplicarDescuentoMesActual] =
		useState(true);

	const [courses, setCourses] = useState<CourseData[]>([]);
	const [isLoadingCourses, setIsLoadingCourses] = useState(false);
	const [selectedCourseId, setSelectedCourseId] = useState("");
	const [metodoPago, setmetodoPago] = useState("");
	const [paymentStatus, setPaymentStatus] = useState<
		"Confirmado" | "Pendiente"
	>("Confirmado");
	const [promiseDate, setPromiseDate] = useState("");
	const [overrideAgeWarning, setOverrideAgeWarning] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [bestTag, setBestTag] = useState<TagDiscount | null>(null);
	const [applyTagDiscount, setApplyTagDiscount] = useState(true);

	useEffect(() => {
		if (step !== 2) return;
		const fetchCourses = async () => {
			setIsLoadingCourses(true);
			try {
				const snap = await getDocs(
					query(collection(db, "Cursos"), where("active", "==", true)),
				);
				setCourses(
					snap.docs.map((d) => {
						const data = d.data();
						return {
							id: d.id,
							nombre: data.nombre,
							inscripcion: data.inscripcion || 0,
							cuota: data.cuota || 0,
							cuota1a10: data.cuota1a10 || 0,
							cuota11enAdelante: data.cuota11enAdelante || 0,
							finMes: data.finMes ?? 12,
							edadMinima: data.edades?.[0] ?? 0,
							edadMaxima: data.edades?.[1] ?? 99,
						};
					}),
				);
			} catch {
				showAlert(
					"Error",
					"Error al cargar la lista de cursos disponibles.",
					"error",
				);
			} finally {
				setIsLoadingCourses(false);
			}
		};
		fetchCourses();
	}, [step]);

	useEffect(() => {
		setOverrideAgeWarning(false);
	}, [selectedCourseId]);

	const handleClose = () => {
		setStep(1);
		setSearchDni("");
		setSearchError("");
		setFoundStudent(null);
		setGrupoFamiliar({ aplica: false, miembrosActivos: [], tutorId: "" });
		setAplicarDescuentoMesActual(true);
		setSelectedCourseId("");
		setmetodoPago("");
		setPaymentStatus("Confirmado");
		setPromiseDate("");
		setOverrideAgeWarning(false);
		setBestTag(null);
		setApplyTagDiscount(true);
		onClose();
	};

	const showAlert = (
		title: string,
		message: string,
		type: AlertState["type"] = "error",
	) => setAlertDialog({ isOpen: true, title, message, type });

	const detectarGrupoFamiliar = async (student: StudentData) => {
		setIsCheckingGrupo(true);
		try {
			const miembrosActivos: { nombre: string; cursoNombre: string }[] = [];
			let tutorId = student.id;

			if (student.tipo === "Titular") {
				const hijosSnap = await getDocs(
					query(collection(db, "Hijos"), where("tutorId", "==", student.id)),
				);
				for (const h of hijosSnap.docs) {
					const data = h.data();
					if ((data.cursos ?? []).length > 0) {
						miembrosActivos.push({
							nombre: `${data.nombre} ${data.apellido}`,
							cursoNombre: await getCursoNombre(data.cursos[0]),
						});
					}
				}
			} else {
				const hijoSnap = await getDoc(doc(db, "Hijos", student.id));
				if (hijoSnap.exists()) tutorId = hijoSnap.data().tutorId ?? student.id;

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
					if (h.id === student.id) continue;
					const data = h.data();
					if ((data.cursos ?? []).length > 0) {
						miembrosActivos.push({
							nombre: `${data.nombre} ${data.apellido}`,
							cursoNombre: await getCursoNombre(data.cursos[0]),
						});
					}
				}
			}

			setGrupoFamiliar({
				aplica: miembrosActivos.length > 0,
				miembrosActivos,
				tutorId,
			});
		} catch (error) {
			console.error("Error detectando grupo familiar:", error);
			setGrupoFamiliar({
				aplica: false,
				miembrosActivos: [],
				tutorId: student.id,
			});
		} finally {
			setIsCheckingGrupo(false);
		}
	};

	const detectarMejorEtiqueta = async (etiquetasRaw: any[] | undefined) => {
		if (
			!etiquetasRaw ||
			!Array.isArray(etiquetasRaw) ||
			etiquetasRaw.length === 0
		) {
			setBestTag(null);
			return;
		}

		try {
			const promesas = etiquetasRaw
				.map((item: any) => {
					if (typeof item === "string")
						return getDoc(doc(db, "EtiquetasDescuento", item.trim()));
					if (item && item.path) return getDoc(item);
					if (item && item.id)
						return getDoc(doc(db, "EtiquetasDescuento", item.id.trim()));
					return null;
				})
				.filter(Boolean);

			const snaps = await Promise.all(promesas);
			let maxDescuento = 0;
			let mejorEtiqueta: TagDiscount | null = null;

			snaps.forEach((snap: any) => {
				if (snap && snap.exists && snap.exists()) {
					const data = snap.data();
					const desc = Number(data.descuentoInscripcion) || 0;

					if (desc > maxDescuento) {
						maxDescuento = desc;
						mejorEtiqueta = {
							id: snap.id,
							nombre: data.nombre || "Etiqueta Especial",
							descuentoInscripcion: desc,
						};
					}
				}
			});

			setBestTag(mejorEtiqueta);
			setApplyTagDiscount(!!mejorEtiqueta);
		} catch (error) {
			console.error("Error buscando etiquetas", error);
			setBestTag(null);
		}
	};

	const handleSearchStudent = async (e: SyntheticEvent) => {
		e.preventDefault();
		if (!searchDni.trim()) return;
		setIsSearching(true);
		setSearchError("");
		setFoundStudent(null);
		setGrupoFamiliar({ aplica: false, miembrosActivos: [], tutorId: "" });
		setBestTag(null);

		try {
			const userSnap = await getDocs(
				query(collection(db, "Users"), where("dni", "==", searchDni)),
			);
			if (!userSnap.empty) {
				const d = userSnap.docs[0];
				const data = d.data();
				if (data.cursos?.length > 0) {
					setSearchError(
						"Este alumno ya se encuentra inscripto en un curso. El sistema solo permite una inscripción activa por alumno.",
					);
					setIsSearching(false);
					return;
				}

				const tagsGuardadas = data.etiquetas || data.Etiquetas || [];

				const student: StudentData = {
					id: d.id,
					nombre: data.nombre,
					apellido: data.apellido,
					dni: data.dni,
					tipo: "Titular",
					edad: calcularEdad(data.fechaNacimiento),
					etiquetas: tagsGuardadas,
					email: data.email || "",
				};
				setFoundStudent(student);
				setIsSearching(false);
				await detectarMejorEtiqueta(tagsGuardadas);
				await detectarGrupoFamiliar(student);
				return;
			}

			const hijoSnap = await getDocs(
				query(collection(db, "Hijos"), where("dni", "==", searchDni)),
			);
			if (!hijoSnap.empty) {
				const d = hijoSnap.docs[0];
				const data = d.data();
				if (data.cursos?.length > 0) {
					setSearchError(
						"Este alumno ya se encuentra inscripto en un curso. El sistema solo permite una inscripción activa por alumno.",
					);
					setIsSearching(false);
					return;
				}

				const tagsGuardadas = data.etiquetas || data.Etiquetas || [];

				const student: StudentData = {
					id: d.id,
					nombre: data.nombre,
					apellido: data.apellido,
					dni: data.dni,
					tipo: "Menor",
					edad: calcularEdad(data.fechaNacimiento),
					tutorId: data.tutorId,
					etiquetas: tagsGuardadas,
					email: data.datosTutor?.email || "",
				};
				setFoundStudent(student);
				setIsSearching(false);
				await detectarMejorEtiqueta(tagsGuardadas);
				await detectarGrupoFamiliar(student);
				return;
			}

			setSearchError("No se encontró ningún alumno registrado con este DNI.");
		} catch (error) {
			console.error("Error buscando alumno:", error);
			setSearchError("Hubo un error al buscar en la base de datos.");
		} finally {
			setIsSearching(false);
		}
	};

	const processInscription = async () => {
		setIsSubmitting(true);
		try {
			const cursoSeleccionado = courses.find((c) => c.id === selectedCourseId);
			if (!cursoSeleccionado) throw new Error("Curso no encontrado");

			let montoInscripcionFinal = cursoSeleccionado.inscripcion || 0;
			if (bestTag && applyTagDiscount) {
				montoInscripcionFinal = Math.round(
					montoInscripcionFinal * (1 - bestTag.descuentoInscripcion / 100),
				);
			}

			const inscriptionData: any = {
				alumnoId: foundStudent!.id,
				alumnoNombre: `${foundStudent!.nombre} ${foundStudent!.apellido}`,
				alumnoDni: foundStudent!.dni,
				tipoAlumno: foundStudent!.tipo,
				alumnoTipo: foundStudent!.tipo === "Titular" ? "adulto" : "menor",
				cuota1a10: cursoSeleccionado.cuota1a10 || 0,
				cuota11enAdelante: cursoSeleccionado.cuota11enAdelante || 0,
				cursoId: selectedCourseId,
				cursoNombre: cursoSeleccionado.nombre || "Desconocido",
				cursoInscripcion: montoInscripcionFinal,
				metodoPago,
				status: paymentStatus,
				fecha: serverTimestamp(),
				excepcionEdad: overrideAgeWarning,
			};

			if (bestTag && applyTagDiscount) {
				inscriptionData.descuentoPorEtiqueta = bestTag.nombre;
				inscriptionData.descuentoPorcentaje = bestTag.descuentoInscripcion;
			} else {
				inscriptionData.descuentoPorEtiqueta = null;
			}

			if (paymentStatus === "Pendiente")
				inscriptionData.fechaPromesaPago = promiseDate;

			const inscripcionRef = await addDoc(
				collection(db, "Inscripciones"),
				inscriptionData,
			);

			await updateDoc(
				doc(
					db,
					foundStudent!.tipo === "Menor" ? "Hijos" : "Users",
					foundStudent!.id,
				),
				{ cursos: arrayUnion(selectedCourseId) },
			);

			if (paymentStatus === "Confirmado") {
				const descuentos = grupoFamiliar.aplica ? DESCUENTO_GRUPO_FAMILIAR : [];

				// ─── USAMOS EL SERVICIO CENTRALIZADO ───
				const alumnoParaCuota = {
					id: foundStudent!.id,
					dni: foundStudent!.dni,
					nombre: foundStudent!.nombre,
					apellido: foundStudent!.apellido,
					tipo: foundStudent!.tipo,
					etiquetas: foundStudent!.etiquetas,
				};

				const cursoParaCuota = {
					id: cursoSeleccionado.id,
					nombre: cursoSeleccionado.nombre,
					cuota1a10: cursoSeleccionado.cuota1a10,
					cuota11enAdelante: cursoSeleccionado.cuota11enAdelante,
					finMes: cursoSeleccionado.finMes,
				};

				// 1. Crear la primera cuota (y el mes siguiente si es post-20)
				await crearPrimeraCuota(
					inscripcionRef.id,
					alumnoParaCuota,
					cursoParaCuota,
					descuentos,
				);

				// 2. Aplicar descuento al grupo si corresponde
				if (grupoFamiliar.aplica) {
					await aplicarDescuentoAlGrupo(
						foundStudent!.id,
						foundStudent!.tipo,
						grupoFamiliar.tutorId,
						aplicarDescuentoMesActual,
					);
				}

				// 3. Enviamos corre de confirmación de inscripción.
				if (foundStudent!.email !== "") {
					try {
						await fetch("/api/correos/inscripcion", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								emailDestino: foundStudent!.email,
								nombreAlumno: `${foundStudent!.nombre} ${foundStudent!.apellido}`,
								cursoNombre: cursoSeleccionado.nombre,
								montoAbonado: montoInscripcionFinal,
								metodoPago: metodoPago,
								nroComprobante: `TXN-${inscripcionRef.id.slice(-8).toUpperCase()}`,
							}),
						});
						console.log(
							"✉️ Comprobante enviado por correo a:",
							foundStudent!.email,
						);
					} catch (emailError) {
						console.error(
							"❌ Error enviando el comprobante por mail:",
							emailError,
						);
					}
				}
			}

			const successMessage =
				paymentStatus === "Pendiente"
					? grupoFamiliar.aplica
						? "La inscripción fue registrada correctamente.\n\nEl descuento por Grupo Familiar y las cuotas se generarán cuando la inscripción sea confirmada con el pago efectivo."
						: "La inscripción fue registrada correctamente.\n\nRecordá cobrar la inscripción antes de la fecha límite establecida."
					: grupoFamiliar.aplica
						? "La inscripción y el pago fueron asentados correctamente.\n\nSe aplicó el Descuento por Grupo Familiar (10%) a las cuotas de este alumno y a las cuotas del resto del grupo."
						: "La inscripción y el pago fueron asentados correctamente.\n\nLa primera cuota fue generada y quedó registrada como pendiente de cobro.";

			showAlert("¡Inscripción Exitosa!", successMessage, "success");
		} catch (error) {
			console.error("Error al inscribir:", error);
			showAlert(
				"Error al Guardar",
				"Hubo un error al intentar guardar la inscripción.",
				"error",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSubmitInscription = async (e: SyntheticEvent) => {
		e.preventDefault();
		if (paymentStatus === "Pendiente" && !promiseDate) {
			showAlert(
				"Falta Fecha de Pago",
				"Has indicado que el pago está pendiente...",
				"warning",
			);
			return;
		}
		if (!foundStudent || !selectedCourseId || !metodoPago) return;
		processInscription();
	};

	return (
		<>
			<AnimatePresence>
				{isOpen && (
					<>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={!isSubmitting && !isSearching ? handleClose : undefined}
							className="fixed inset-0 bg-[#252d62]/80 backdrop-blur-sm z-40"
						/>
						<div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6">
							<motion.div
								initial={{ opacity: 0, scale: 0.95, y: 20 }}
								animate={{ opacity: 1, scale: 1, y: 0 }}
								exit={{ opacity: 0, scale: 0.95, y: 20 }}
								className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
							>
								<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
									<div>
										<h2 className="text-xl font-bold text-[#252d62]">
											Nueva Inscripción Manual
										</h2>
										<div className="flex items-center gap-2 mt-1">
											<span
												className={`h-2 w-2 rounded-full ${step === 1 ? "bg-[#EE1120]" : "bg-gray-300"}`}
											/>
											<span
												className={`h-2 w-2 rounded-full ${step === 2 ? "bg-[#EE1120]" : "bg-gray-300"}`}
											/>
											<span className="text-xs text-gray-500 font-medium ml-1">
												Paso {step} de 2
											</span>
										</div>
									</div>
									<button
										onClick={
											!isSubmitting && !isSearching ? handleClose : undefined
										}
										disabled={isSubmitting || isSearching}
										className="text-gray-400 hover:bg-gray-200 p-1 rounded-full transition-colors"
									>
										<X className="w-5 h-5" />
									</button>
								</div>

								<div className="p-6 overflow-y-auto">
									{step === 1 ? (
										<Step1SearchStudent
											searchDni={searchDni}
											setSearchDni={setSearchDni}
											isSearching={isSearching}
											searchError={searchError}
											foundStudent={foundStudent}
											grupoFamiliar={grupoFamiliar}
											isCheckingGrupo={isCheckingGrupo}
											aplicarDescuentoMesActual={aplicarDescuentoMesActual}
											setAplicarDescuentoMesActual={
												setAplicarDescuentoMesActual
											}
											handleSearchStudent={handleSearchStudent}
											onNext={() => setStep(2)}
											onClose={handleClose}
										/>
									) : (
										<Step2CoursePayment
											foundStudent={foundStudent}
											grupoFamiliar={grupoFamiliar}
											courses={courses}
											isLoadingCourses={isLoadingCourses}
											selectedCourseId={selectedCourseId}
											setSelectedCourseId={setSelectedCourseId}
											metodoPago={metodoPago}
											setMetodoPago={setmetodoPago}
											paymentStatus={paymentStatus}
											setPaymentStatus={setPaymentStatus}
											promiseDate={promiseDate}
											setPromiseDate={setPromiseDate}
											overrideAgeWarning={overrideAgeWarning}
											setOverrideAgeWarning={setOverrideAgeWarning}
											isSubmitting={isSubmitting}
											bestTag={bestTag}
											applyTagDiscount={applyTagDiscount}
											setApplyTagDiscount={setApplyTagDiscount}
											onBack={() => setStep(1)}
											onSubmit={handleSubmitInscription}
											getTomorrow={getTomorrow}
											calcularMontoPrimerMes={calcularMontoPrimerMes}
										/>
									)}
								</div>
							</motion.div>
						</div>
					</>
				)}
			</AnimatePresence>

			<Dialog
				open={alertDialog.isOpen}
				onOpenChange={(open) => {
					if (!open) {
						setAlertDialog({ ...alertDialog, isOpen: false });
						if (alertDialog.type === "success") handleClose();
					}
				}}
			>
				<DialogContent className="max-w-[90%] sm:max-w-[425px] rounded-xl z-50">
					<DialogHeader>
						<div className="flex items-center gap-3 mb-2">
							<div
								className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${alertDialog.type === "error" ? "bg-red-100" : alertDialog.type === "warning" ? "bg-orange-100" : "bg-green-100"}`}
							>
								{alertDialog.type === "error" && (
									<AlertCircle className="w-5 h-5 text-red-600" />
								)}
								{alertDialog.type === "warning" && (
									<AlertTriangle className="w-5 h-5 text-orange-600" />
								)}
								{alertDialog.type === "success" && (
									<CheckCircle2 className="w-5 h-5 text-green-600" />
								)}
							</div>
							<DialogTitle className="text-lg text-gray-900">
								{alertDialog.title}
							</DialogTitle>
						</div>
						<DialogDescription className="text-gray-600 whitespace-pre-line text-sm">
							{alertDialog.message}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="mt-4">
						<Button
							onClick={() => {
								setAlertDialog({ ...alertDialog, isOpen: false });
								if (alertDialog.type === "success") handleClose();
							}}
							className={`${alertDialog.type === "error" ? "bg-red-600 hover:bg-red-700" : alertDialog.type === "warning" ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"} text-white w-full sm:w-auto`}
						>
							Entendido
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
