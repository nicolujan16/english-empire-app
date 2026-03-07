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
} from "lucide-react";
import { Button } from "@/components/ui/button"; // Asegúrate de que apunte a tu componente

// --- FIRESTORE IMPORTS ---
import {
	collection,
	query,
	where,
	getDocs,
	addDoc,
	serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

interface ManualInscriptionModalProps {
	isOpen: boolean;
	onClose: () => void;
}

// Interfaces
interface StudentData {
	id: string;
	nombre: string;
	apellido: string;
	dni: string;
	tipo: "Titular" | "Menor";
}

interface CourseData {
	id: string;
	nombre: string;
	inscripcion: number;
	cuota: number;
}

export default function ManualInscriptionModal({
	isOpen,
	onClose,
}: ManualInscriptionModalProps) {
	const [step, setStep] = useState<1 | 2>(1);

	// Paso 1
	const [searchDni, setSearchDni] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const [searchError, setSearchError] = useState("");
	const [foundStudent, setFoundStudent] = useState<StudentData | null>(null);

	// Paso 2
	const [courses, setCourses] = useState<CourseData[]>([]);
	const [isLoadingCourses, setIsLoadingCourses] = useState(false);
	const [selectedCourseId, setSelectedCourseId] = useState("");
	const [paymentMethod, setPaymentMethod] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Estados para pagos pendientes
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
		onClose();
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
				const doc = userSnap.docs[0];
				const data = doc.data();
				setFoundStudent({
					id: doc.id,
					nombre: data.nombre,
					apellido: data.apellido,
					dni: data.dni,
					tipo: "Titular",
				});
				setIsSearching(false);
				return;
			}

			const hijosRef = collection(db, "Hijos");
			const qHijo = query(hijosRef, where("dni", "==", searchDni));
			const hijoSnap = await getDocs(qHijo);

			if (!hijoSnap.empty) {
				const doc = hijoSnap.docs[0];
				const data = doc.data();
				setFoundStudent({
					id: doc.id,
					nombre: data.nombre,
					apellido: data.apellido,
					dni: data.dni,
					tipo: "Menor",
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

				const fetchedCourses: CourseData[] = cursosSnap.docs.map((doc) => ({
					id: doc.id,
					nombre: doc.data().nombre,
					inscripcion: doc.data().inscripcion || 0,
					cuota: doc.data().cuota || 0,
				}));

				setCourses(fetchedCourses);
			} catch (error) {
				console.error("Error trayendo cursos:", error);
				alert("Error al cargar la lista de cursos disponibles.");
			} finally {
				setIsLoadingCourses(false);
			}
		};

		fetchCourses();
	}, [step]);

	const handleSubmitInscription = async (e: SyntheticEvent) => {
		e.preventDefault();

		if (paymentStatus === "Pendiente" && !promiseDate) {
			alert(
				"Debes indicar la fecha en la que el tutor prometió realizar el pago.",
			);
			return;
		}

		if (!foundStudent || !selectedCourseId || !paymentMethod) return;

		setIsSubmitting(true);
		try {
			const cursoSeleccionado = courses.find((c) => c.id === selectedCourseId);

			const inscripcionesRef = collection(db, "Inscripciones");

			// --- OBJETO DE DATOS EXTENDIDO CON PRECIO ---
			const inscriptionData: any = {
				alumnoId: foundStudent.id,
				alumnoNombre: `${foundStudent.nombre} ${foundStudent.apellido}`,
				alumnoDni: foundStudent.dni,
				tipoAlumno: foundStudent.tipo,
				cursoId: selectedCourseId,
				cursoNombre: cursoSeleccionado?.nombre || "Desconocido",
				cursoInscripcion: cursoSeleccionado?.inscripcion || 0,
				paymentMethod: paymentMethod,
				status: paymentStatus,
				fecha: serverTimestamp(),
			};

			if (paymentStatus === "Pendiente") {
				inscriptionData.fechaPromesaPago = promiseDate;
			}

			await addDoc(inscripcionesRef, inscriptionData);

			alert(
				`¡Inscripción registrada! ${
					paymentStatus === "Pendiente"
						? "Recordá cobrar la inscripción antes de la fecha límite."
						: "El pago fue asentado correctamente."
				}`,
			);
			handleClose();
		} catch (error) {
			console.error("Error al inscribir:", error);
			alert("Hubo un error al guardar la inscripción. Inténtalo de nuevo.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={!isSubmitting && !isSearching ? handleClose : undefined}
						className="fixed inset-0 bg-[#252d62]/80 backdrop-blur-sm z-50 transition-opacity"
					/>

					<div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 20 }}
							transition={{ duration: 0.2 }}
							className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
						>
							{/* Header */}
							<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
								<div>
									<h2 className="text-xl font-bold text-[#252d62]">
										Nueva Inscripción Manual
									</h2>
									<div className="flex items-center gap-2 mt-1">
										<span
											className={`h-2 w-2 rounded-full ${step === 1 ? "bg-[#EE1120]" : "bg-gray-300"}`}
										></span>
										<span
											className={`h-2 w-2 rounded-full ${step === 2 ? "bg-[#EE1120]" : "bg-gray-300"}`}
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
												Ingresa el DNI para buscar si el alumno ya se encuentra
												en nuestra base de datos.
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
													<Link
														href="/admin/alumnos/crear-alumno"
														onClick={handleClose}
													>
														<Button
															variant="outline"
															className="w-full text-sm border-red-200 text-[#EE1120] hover:bg-red-100"
														>
															Ir a Crear Nuevo Alumno
														</Button>
													</Link>
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
															<span className="inline-block mt-2 px-2 py-0.5 bg-green-200 text-green-800 text-xs font-bold rounded">
																Perfil: {foundStudent.tipo}
															</span>
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
															({foundStudent?.dni})
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

										<div className="pt-4 border-t border-gray-100 flex justify-between">
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
													(paymentStatus === "Confirmado" && !paymentMethod) ||
													(paymentStatus === "Pendiente" && !promiseDate)
												}
												className="bg-[#EE1120] hover:bg-[#c4000e] text-white shadow-md"
											>
												{isSubmitting ? (
													"Inscribiendo..."
												) : (
													<>
														<Save className="w-4 h-4 mr-2" />
														Finalizar Inscripción
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
	);
}
