/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, SyntheticEvent, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
	X,
	Save,
	Search,
	User,
	ArrowRight,
	ArrowLeft,
	BookOpen,
	CreditCard,
	AlertCircle,
	CheckCircle2,
	Loader2,
	CalendarClock,
	Wallet,
	AlertTriangle,
} from "lucide-react";
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
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

interface ManualInscriptionModalProps {
	isOpen: boolean;
	onClose: () => void;
}

interface StudentData {
	id: string;
	nombre: string;
	apellido: string;
	dni: string;
	tipo: "Titular" | "Menor";
	edad: number;
}

interface CourseData {
	id: string;
	nombre: string;
	inscripcion: number;
	cuota: number;
	edadMinima: number;
	edadMaxima: number;
}

interface ErrorDialogState {
	isOpen: boolean;
	title: string;
	message: string;
	type: "error" | "success" | "warning";
}

export default function ManualInscriptionModal({
	isOpen,
	onClose,
}: ManualInscriptionModalProps) {
	const [step, setStep] = useState<1 | 2>(1);

	const [alertDialog, setAlertDialog] = useState<ErrorDialogState>({
		isOpen: false,
		title: "",
		message: "",
		type: "error",
	});

	const [searchDni, setSearchDni] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const [searchError, setSearchError] = useState("");
	const [foundStudent, setFoundStudent] = useState<StudentData | null>(null);

	const [courses, setCourses] = useState<CourseData[]>([]);
	const [isLoadingCourses, setIsLoadingCourses] = useState(false);
	const [selectedCourseId, setSelectedCourseId] = useState("");
	const [paymentMethod, setPaymentMethod] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [overrideAgeWarning, setOverrideAgeWarning] = useState(false);

	const [paymentStatus, setPaymentStatus] = useState<
		"Confirmado" | "Pendiente"
	>("Confirmado");
	const [promiseDate, setPromiseDate] = useState("");

	const handleClose = () => {
		setStep(1);
		setSearchDni("");
		setSearchError("");
		setFoundStudent(null);
		setSelectedCourseId("");
		setPaymentMethod("");
		setPaymentStatus("Confirmado");
		setPromiseDate("");
		setOverrideAgeWarning(false);
		onClose();
	};

	const showAlert = (
		title: string,
		message: string,
		type: "error" | "success" | "warning" = "error",
	) => {
		setAlertDialog({ isOpen: true, title, message, type });
	};

	const calcularEdad = (fechaNacimiento: string) => {
		if (!fechaNacimiento) return 0;
		const hoy = new Date();
		const cumple = new Date(fechaNacimiento);
		let edad = hoy.getFullYear() - cumple.getFullYear();
		const m = hoy.getMonth() - cumple.getMonth();
		if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) {
			edad--;
		}
		return Math.max(0, edad);
	};

	const handleSearchStudent = async (e: SyntheticEvent) => {
		e.preventDefault();
		if (!searchDni.trim()) return;

		setIsSearching(true);
		setSearchError("");
		setFoundStudent(null);

		try {
			const usersRef = collection(db, "Users");
			const qUser = query(usersRef, where("dni", "==", searchDni));
			const userSnap = await getDocs(qUser);

			if (!userSnap.empty) {
				const documento = userSnap.docs[0];
				const data = documento.data();

				if (data.cursos && data.cursos.length > 0) {
					setSearchError(
						"Este alumno ya se encuentra inscripto en un curso. El sistema solo permite una inscripción activa por alumno.",
					);
					setIsSearching(false);
					return;
				}

				setFoundStudent({
					id: documento.id,
					nombre: data.nombre,
					apellido: data.apellido,
					dni: data.dni,
					tipo: "Titular",
					edad: calcularEdad(data.fechaNacimiento),
				});
				setIsSearching(false);
				return;
			}

			const hijosRef = collection(db, "Hijos");
			const qHijo = query(hijosRef, where("dni", "==", searchDni));
			const hijoSnap = await getDocs(qHijo);

			if (!hijoSnap.empty) {
				const documento = hijoSnap.docs[0];
				const data = documento.data();

				if (data.cursos && data.cursos.length > 0) {
					setSearchError(
						"Este alumno ya se encuentra inscripto en un curso. El sistema solo permite una inscripción activa por alumno.",
					);
					setIsSearching(false);
					return;
				}

				setFoundStudent({
					id: documento.id,
					nombre: data.nombre,
					apellido: data.apellido,
					dni: data.dni,
					tipo: "Menor",
					edad: calcularEdad(data.fechaNacimiento),
				});
				setIsSearching(false);
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

	useEffect(() => {
		const fetchCourses = async () => {
			if (step !== 2) return;

			setIsLoadingCourses(true);
			try {
				const cursosRef = collection(db, "Cursos");
				const qCursos = query(cursosRef, where("active", "==", true));
				const cursosSnap = await getDocs(qCursos);

				const fetchedCourses: CourseData[] = cursosSnap.docs.map((doc) => {
					const data = doc.data();
					const min =
						data.edades && data.edades.length > 0 ? data.edades[0] : 0;
					const max =
						data.edades && data.edades.length > 1 ? data.edades[1] : 99;

					return {
						id: doc.id,
						nombre: data.nombre,
						inscripcion: data.inscripcion || 0,
						cuota: data.cuota || 0,
						edadMinima: min,
						edadMaxima: max,
					};
				});

				setCourses(fetchedCourses);
			} catch (error) {
				console.error("Error trayendo cursos:", error);
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

	const processInscription = async () => {
		setIsSubmitting(true);
		try {
			const cursoSeleccionado = courses.find((c) => c.id === selectedCourseId);
			const inscripcionesRef = collection(db, "Inscripciones");

			const inscriptionData: any = {
				alumnoId: foundStudent!.id,
				alumnoNombre: `${foundStudent!.nombre} ${foundStudent!.apellido}`,
				alumnoDni: foundStudent!.dni,
				tipoAlumno: foundStudent!.tipo,
				cursoId: selectedCourseId,
				cursoNombre: cursoSeleccionado?.nombre || "Desconocido",
				cursoInscripcion: cursoSeleccionado?.inscripcion || 0,
				paymentMethod: paymentMethod,
				status: paymentStatus,
				fecha: serverTimestamp(),
				excepcionEdad: overrideAgeWarning,
			};

			if (paymentStatus === "Pendiente") {
				inscriptionData.fechaPromesaPago = promiseDate;
			}

			await addDoc(inscripcionesRef, inscriptionData);

			const collectionName =
				foundStudent!.tipo === "Titular" ? "Users" : "Hijos";
			const studentRef = doc(db, collectionName, foundStudent!.id);

			await updateDoc(studentRef, {
				cursos: arrayUnion(selectedCourseId),
				[`cuotasPagadas.${selectedCourseId}`]: [],
			});

			const successMessage =
				paymentStatus === "Pendiente"
					? "La inscripción fue registrada correctamente.\n\nRecordá cobrar la inscripción antes de la fecha límite establecida."
					: "La inscripción y el pago fueron asentados correctamente en el sistema.";

			showAlert("¡Inscripción Exitosa!", successMessage, "success");
		} catch (error) {
			console.error("Error al inscribir:", error);
			showAlert(
				"Error al Guardar",
				"Hubo un error al intentar guardar la inscripción. Revisa tu conexión a internet e inténtalo de nuevo.",
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
				"Has indicado que el pago está pendiente. Debes ingresar la fecha límite en la que el tutor prometió realizar el abono.",
				"warning",
			);
			return;
		}

		if (!foundStudent || !selectedCourseId || !paymentMethod) return;

		processInscription();
	};

	const selectedCourse = courses.find((c) => c.id === selectedCourseId);
	const isAgeWarning =
		selectedCourse &&
		foundStudent &&
		(foundStudent.edad < selectedCourse.edadMinima ||
			foundStudent.edad > selectedCourse.edadMaxima);

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
							className="fixed inset-0 bg-[#252d62]/80 backdrop-blur-sm z-40 transition-opacity"
						/>

						<div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6">
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
										<h2 className="text-xl font-bold text-[#252d62]">
											Nueva Inscripción Manual
										</h2>
										<div className="flex items-center gap-2 mt-1">
											<span
												className={`h-2 w-2 rounded-full ${
													step === 1 ? "bg-[#EE1120]" : "bg-gray-300"
												}`}
											></span>
											<span
												className={`h-2 w-2 rounded-full ${
													step === 2 ? "bg-[#EE1120]" : "bg-gray-300"
												}`}
											></span>
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
										className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
									>
										<X className="w-5 h-5" />
									</button>
								</div>

								{/* Body */}
								<div className="p-6 overflow-y-auto">
									{/* ================= PASO 1 ================= */}
									{step === 1 && (
										<form onSubmit={handleSearchStudent} className="space-y-6">
											<div className="space-y-4">
												<label className="block text-sm font-bold text-[#252d62]">
													1. Identificación del Alumno
												</label>
												<p className="text-sm text-gray-500">
													Ingresa el DNI para buscar si el alumno ya se
													encuentra en nuestra base de datos.
												</p>

												<div className="flex gap-3">
													<div className="relative flex-1">
														<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
															<Search className="h-4 w-4 text-gray-400" />
														</div>
														<input
															type="text"
															value={searchDni}
															onChange={(e) => setSearchDni(e.target.value)}
															placeholder="Número de DNI"
															className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white"
															required
														/>
													</div>
													<Button
														type="submit"
														disabled={isSearching || !searchDni}
														className="bg-[#252d62] hover:bg-[#1d2355] text-white"
													>
														{isSearching ? (
															<Loader2 className="w-4 h-4 animate-spin" />
														) : (
															"Buscar"
														)}
													</Button>
												</div>

												{searchError && (
													<div className="bg-red-50 border border-red-100 p-4 rounded-lg flex flex-col gap-3">
														<div className="flex items-start gap-2">
															<AlertCircle className="w-5 h-5 text-[#EE1120] shrink-0 mt-0.5" />
															<p className="text-sm text-red-800 font-medium">
																{searchError}
															</p>
														</div>
														{searchError.includes("No se encontró") && (
															<Link href="/admin/alumnos" onClick={handleClose}>
																<Button
																	variant="outline"
																	className="w-full text-sm border-red-200 text-[#EE1120] hover:bg-red-100"
																>
																	Ir a Crear Nuevo Alumno
																</Button>
															</Link>
														)}
													</div>
												)}

												{foundStudent && (
													<motion.div
														initial={{ opacity: 0, y: 10 }}
														animate={{ opacity: 1, y: 0 }}
														className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-start justify-between"
													>
														<div className="flex items-start gap-3">
															<div className="bg-white p-2 rounded-full shrink-0">
																<CheckCircle2 className="w-6 h-6 text-green-600" />
															</div>
															<div>
																<h4 className="font-bold text-green-900">
																	{foundStudent.nombre} {foundStudent.apellido}
																</h4>
																<p className="text-sm text-green-700 font-mono mt-1">
																	DNI: {foundStudent.dni}
																</p>
																<div className="flex gap-2 mt-2">
																	<span className="inline-block px-2 py-0.5 bg-green-200 text-green-800 text-xs font-bold rounded">
																		Perfil: {foundStudent.tipo}
																	</span>
																	<span className="inline-block px-2 py-0.5 bg-green-200 text-green-800 text-xs font-bold rounded">
																		Edad: {foundStudent.edad} años
																	</span>
																</div>
															</div>
														</div>
													</motion.div>
												)}
											</div>

											<div className="pt-4 border-t border-gray-100 flex justify-end">
												<Button
													type="button"
													onClick={() => setStep(2)}
													disabled={!foundStudent}
													className="bg-[#EE1120] hover:bg-[#c4000e] text-white"
												>
													Confirmar y Continuar
													<ArrowRight className="w-4 h-4 ml-2" />
												</Button>
											</div>
										</form>
									)}

									{/* ================= PASO 2 ================= */}
									{step === 2 && (
										<form
											id="inscription-form"
											onSubmit={handleSubmitInscription}
											className="space-y-6"
										>
											<div className="space-y-4">
												<div className="bg-gray-50 p-3 rounded-lg flex items-center gap-3 border border-gray-100">
													<User className="w-5 h-5 text-gray-400" />
													<div>
														<p className="text-xs text-gray-500 font-medium">
															Inscribiendo a:
														</p>
														<p className="text-sm font-bold text-[#252d62]">
															{foundStudent?.nombre} {foundStudent?.apellido}{" "}
															<span className="text-gray-400 font-normal">
																({foundStudent?.dni}) - {foundStudent?.edad}{" "}
																años
															</span>
														</p>
													</div>
												</div>

												<label className="block text-sm font-bold text-[#252d62]">
													2. Detalles de Cursada
												</label>

												<div className="grid grid-cols-1 gap-4">
													<div className="relative">
														<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
															<BookOpen className="h-4 w-4 text-gray-400" />
														</div>
														<select
															required
															disabled={isLoadingCourses || isSubmitting}
															value={selectedCourseId}
															onChange={(e) =>
																setSelectedCourseId(e.target.value)
															}
															className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white appearance-none cursor-pointer disabled:opacity-50"
														>
															<option value="">
																{isLoadingCourses
																	? "Cargando cursos..."
																	: "Seleccionar Curso Activo"}
															</option>
															{courses.map((curso) => (
																<option key={curso.id} value={curso.id}>
																	{curso.nombre} - ${curso.inscripcion}
																</option>
															))}
														</select>
													</div>

													{/* --- ALERTA DE EDAD (Si aplica) --- */}
													<AnimatePresence>
														{isAgeWarning && selectedCourse && (
															<motion.div
																initial={{ opacity: 0, height: 0 }}
																animate={{ opacity: 1, height: "auto" }}
																exit={{ opacity: 0, height: 0 }}
																className="bg-orange-50 border border-orange-200 p-4 rounded-lg flex flex-col gap-3 overflow-hidden"
															>
																<div className="flex items-start gap-2">
																	<AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
																	<div>
																		<p className="text-sm text-orange-800 font-bold">
																			Advertencia de Edad
																		</p>
																		<p className="text-sm text-orange-700 mt-1">
																			Este curso es para alumnos de{" "}
																			<span className="font-bold">
																				{selectedCourse.edadMinima}
																			</span>{" "}
																			a{" "}
																			<span className="font-bold">
																				{selectedCourse.edadMaxima}
																			</span>{" "}
																			años. El alumno actual tiene{" "}
																			<span className="font-bold">
																				{foundStudent?.edad}
																			</span>{" "}
																			años.
																		</p>
																	</div>
																</div>
																<div className="flex items-center gap-2 mt-1 ml-7">
																	<input
																		type="checkbox"
																		id="override-age"
																		checked={overrideAgeWarning}
																		onChange={(e) =>
																			setOverrideAgeWarning(e.target.checked)
																		}
																		className="w-4 h-4 text-[#EE1120] rounded border-orange-300 focus:ring-[#EE1120] cursor-pointer"
																	/>
																	<label
																		htmlFor="override-age"
																		className="text-sm text-orange-800 font-medium cursor-pointer"
																	>
																		Inscribir de todas formas (Excepción
																		autorizada)
																	</label>
																</div>
															</motion.div>
														)}
													</AnimatePresence>
												</div>

												<label className="block text-sm font-bold text-[#252d62] mt-6">
													3. Estado del Pago
												</label>

												<div className="grid grid-cols-1 gap-4">
													<div className="relative">
														<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
															<Wallet className="h-4 w-4 text-gray-400" />
														</div>
														<select
															required
															disabled={isSubmitting}
															value={paymentStatus}
															onChange={(e) =>
																setPaymentStatus(
																	e.target.value as "Confirmado" | "Pendiente",
																)
															}
															className={`block w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer ${
																paymentStatus === "Confirmado"
																	? "bg-green-50 border-green-200 text-green-800 focus:ring-green-500/20 focus:border-green-500"
																	: "bg-yellow-50 border-yellow-200 text-yellow-800 focus:ring-yellow-500/20 focus:border-yellow-500"
															}`}
														>
															<option value="Confirmado">
																El tutor abona en este momento (Confirmado)
															</option>
															<option value="Pendiente">
																El tutor pagará otro día (Promesa de Pago)
															</option>
														</select>
													</div>

													{paymentStatus === "Confirmado" && (
														<motion.div
															initial={{ opacity: 0, height: 0 }}
															animate={{ opacity: 1, height: "auto" }}
														>
															<div className="relative">
																<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
																	<CreditCard className="h-4 w-4 text-gray-400" />
																</div>
																<select
																	required
																	disabled={isSubmitting}
																	value={paymentMethod}
																	onChange={(e) =>
																		setPaymentMethod(e.target.value)
																	}
																	className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white appearance-none cursor-pointer disabled:opacity-50"
																>
																	<option value="">
																		Seleccionar Medio de Pago Recibido
																	</option>
																	<option value="Efectivo">
																		Efectivo en Sede
																	</option>
																	<option value="Transferencia">
																		Transferencia Bancaria (Verificada)
																	</option>
																	<option value="Tarjeta">
																		Tarjeta (Posnet)
																	</option>
																</select>
															</div>
														</motion.div>
													)}

													{paymentStatus === "Pendiente" && (
														<motion.div
															initial={{ opacity: 0, height: 0 }}
															animate={{ opacity: 1, height: "auto" }}
														>
															<div className="relative">
																<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
																	<CalendarClock className="h-4 w-4 text-gray-400" />
																</div>
																<input
																	type="date"
																	required
																	disabled={isSubmitting}
																	value={promiseDate}
																	onChange={(e) => {
																		setPromiseDate(e.target.value);
																		setPaymentMethod("A confirmar");
																	}}
																	className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white disabled:opacity-50"
																/>
															</div>
															<p className="text-xs text-gray-500 mt-1 ml-1">
																Ingresa la fecha límite en la que el tutor se
																comprometió a abonar.
															</p>
														</motion.div>
													)}
												</div>
											</div>

											<div className="pt-4 border-t border-gray-100 flex justify-between mt-8">
												<Button
													type="button"
													variant="outline"
													onClick={() => setStep(1)}
													disabled={isSubmitting}
													className="text-gray-600"
												>
													<ArrowLeft className="w-4 h-4 mr-2" />
													Atrás
												</Button>
												<Button
													type="submit"
													disabled={
														isSubmitting ||
														!selectedCourseId ||
														(paymentStatus === "Confirmado" &&
															!paymentMethod) ||
														(paymentStatus === "Pendiente" && !promiseDate) ||
														(isAgeWarning && !overrideAgeWarning) ||
														false
													}
													className="bg-[#EE1120] hover:bg-[#c4000e] text-white shadow-md disabled:bg-gray-300 disabled:text-gray-500"
												>
													{isSubmitting ? (
														"Inscribiendo..."
													) : (
														<>
															<Save className="w-4 h-4 mr-2" />
															{isAgeWarning && overrideAgeWarning
																? "Inscribir de todas formas"
																: "Finalizar Inscripción"}
														</>
													)}
												</Button>
											</div>
										</form>
									)}
								</div>
							</motion.div>
						</div>
					</>
				)}
			</AnimatePresence>

			{/* =========================================
          DIALOG DE ALERTAS (ERRORES O ÉXITO)
      ========================================= */}
			<Dialog
				open={alertDialog.isOpen}
				onOpenChange={(isOpen) => {
					if (!isOpen) {
						setAlertDialog({ ...alertDialog, isOpen: false });
						if (alertDialog.type === "success") {
							handleClose();
						}
					}
				}}
			>
				<DialogContent className="max-w-[90%] sm:max-w-[425px] rounded-xl z-50">
					<DialogHeader>
						<div className="flex items-center gap-3 mb-2">
							<div
								className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
									alertDialog.type === "error"
										? "bg-red-100"
										: alertDialog.type === "warning"
											? "bg-orange-100"
											: "bg-green-100"
								}`}
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
							className={`${
								alertDialog.type === "error"
									? "bg-red-600 hover:bg-red-700"
									: alertDialog.type === "warning"
										? "bg-orange-600 hover:bg-orange-700"
										: "bg-green-600 hover:bg-green-700"
							} text-white w-full sm:w-auto`}
						>
							Entendido
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
