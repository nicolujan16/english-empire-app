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
	Users,
	Tag,
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
	getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { type Descuento } from "@/lib/cuotas";

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
	tutorId?: string;
}

interface CourseData {
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

interface AlertState {
	isOpen: boolean;
	title: string;
	message: string;
	type: "error" | "success" | "warning";
}

interface GrupoFamiliarInfo {
	aplica: boolean;
	miembrosActivos: { nombre: string; cursoNombre: string }[];
	tutorId: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

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

const DESCUENTO_GRUPO_FAMILIAR: Descuento[] = [
	{ porcentaje: 10, detalle: "Grupo Familiar" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTomorrow = () => {
	const t = new Date();
	t.setDate(t.getDate() + 1);
	return t.toISOString().split("T")[0];
};

const calcularMontoPrimerMes = (fecha: Date, curso: CourseData): number =>
	fecha.getDate() >= 15 ? curso.cuota1a10 * 0.5 : curso.cuota1a10;

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

// ─── Componente ───────────────────────────────────────────────────────────────

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

	// Paso 1
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

	// Paso 2
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

	// ── Reset ─────────────────────────────────────────────────────────────────

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
		onClose();
	};

	const showAlert = (
		title: string,
		message: string,
		type: AlertState["type"] = "error",
	) => setAlertDialog({ isOpen: true, title, message, type });

	// ── Detección de grupo familiar ───────────────────────────────────────────

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

	// ── Búsqueda de alumno ────────────────────────────────────────────────────

	const handleSearchStudent = async (e: SyntheticEvent) => {
		e.preventDefault();
		if (!searchDni.trim()) return;
		setIsSearching(true);
		setSearchError("");
		setFoundStudent(null);
		setGrupoFamiliar({ aplica: false, miembrosActivos: [], tutorId: "" });

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
				const student: StudentData = {
					id: d.id,
					nombre: data.nombre,
					apellido: data.apellido,
					dni: data.dni,
					tipo: "Titular",
					edad: calcularEdad(data.fechaNacimiento),
				};
				setFoundStudent(student);
				setIsSearching(false);
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
				const student: StudentData = {
					id: d.id,
					nombre: data.nombre,
					apellido: data.apellido,
					dni: data.dni,
					tipo: "Menor",
					edad: calcularEdad(data.fechaNacimiento),
					tutorId: data.tutorId,
				};
				setFoundStudent(student);
				setIsSearching(false);
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

	// ── Carga de cursos ───────────────────────────────────────────────────────

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

	// ── Crear cuotas (solo Confirmado) ────────────────────────────────────────

	const crearPrimeraCuota = async (
		inscripcionId: string,
		curso: CourseData,
		descuentos: Descuento[],
	) => {
		if (!foundStudent) return;
		const hoy = new Date();
		const montoPrimerMes = calcularMontoPrimerMes(hoy, curso);

		const datosBase = {
			inscripcionId,
			alumnoId: foundStudent.id,
			alumnoTipo: foundStudent.tipo === "Titular" ? "adulto" : "menor",
			alumnoNombre: `${foundStudent.nombre} ${foundStudent.apellido}`,
			alumnoDni: foundStudent.dni,
			cursoId: curso.id,
			cursoNombre: curso.nombre,
			cuota1a10: curso.cuota1a10,
			cuota11enAdelante: curso.cuota11enAdelante,
			estado: "Pendiente",
			fechaPago: null,
			montoPagado: null,
			metodoPago: null,
			descuentos,
		};

		await addDoc(collection(db, "Cuotas"), {
			...datosBase,
			mes: hoy.getMonth() + 1,
			anio: hoy.getFullYear(),
			esPrimerMes: true,
			montoPrimerMes,
			creadoEn: serverTimestamp(),
			actualizadoEn: serverTimestamp(),
		});

		if (hoy.getDate() >= 20) {
			const sig = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
			const mesSig = sig.getMonth() + 1;
			const anioSig = sig.getFullYear();
			if (mesSig <= curso.finMes) {
				await addDoc(collection(db, "Cuotas"), {
					...datosBase,
					mes: mesSig,
					anio: anioSig,
					esPrimerMes: false,
					montoPrimerMes: null,
					creadoEn: serverTimestamp(),
					actualizadoEn: serverTimestamp(),
				});
			}
		}
	};

	// ── Aplicar descuento a cuotas existentes del resto del grupo ─────────────

	const aplicarDescuentoAlGrupo = async () => {
		const hoy = new Date();
		const mesActual = hoy.getMonth() + 1;
		const anioActual = hoy.getFullYear();
		const mesSiguiente = hoy.getMonth() + 2 > 12 ? 1 : hoy.getMonth() + 2;
		const anioSiguiente =
			hoy.getMonth() + 2 > 12 ? hoy.getFullYear() + 1 : hoy.getFullYear();

		const mesesAProcesar = [
			{ mes: mesSiguiente, anio: anioSiguiente },
			...(aplicarDescuentoMesActual
				? [{ mes: mesActual, anio: anioActual }]
				: []),
		];

		const alumnoIdsGrupo: string[] = [];

		if (foundStudent!.tipo === "Titular") {
			const snap = await getDocs(
				query(
					collection(db, "Hijos"),
					where("tutorId", "==", foundStudent!.id),
				),
			);
			for (const h of snap.docs)
				if ((h.data().cursos ?? []).length > 0) alumnoIdsGrupo.push(h.id);
		} else {
			const tutorId = grupoFamiliar.tutorId;
			const tutorSnap = await getDoc(doc(db, "Users", tutorId));
			if (tutorSnap.exists() && (tutorSnap.data().cursos ?? []).length > 0)
				alumnoIdsGrupo.push(tutorId);
			const hSnap = await getDocs(
				query(collection(db, "Hijos"), where("tutorId", "==", tutorId)),
			);
			for (const h of hSnap.docs) {
				if (h.id !== foundStudent!.id && (h.data().cursos ?? []).length > 0)
					alumnoIdsGrupo.push(h.id);
			}
		}

		for (const alumnoId of alumnoIdsGrupo) {
			for (const { mes, anio } of mesesAProcesar) {
				const cuotasSnap = await getDocs(
					query(
						collection(db, "Cuotas"),
						where("alumnoId", "==", alumnoId),
						where("mes", "==", mes),
						where("anio", "==", anio),
						where("estado", "==", "Pendiente"),
					),
				);
				for (const cuotaDoc of cuotasSnap.docs) {
					const descActuales: Descuento[] = cuotaDoc.data().descuentos ?? [];
					if (descActuales.some((d) => d.detalle === "Grupo Familiar"))
						continue;
					await updateDoc(doc(db, "Cuotas", cuotaDoc.id), {
						descuentos: [...descActuales, ...DESCUENTO_GRUPO_FAMILIAR],
						actualizadoEn: serverTimestamp(),
					});
				}
			}
		}
	};

	// ── Proceso de inscripción ────────────────────────────────────────────────

	const processInscription = async () => {
		setIsSubmitting(true);
		try {
			const cursoSeleccionado = courses.find((c) => c.id === selectedCourseId);

			const inscriptionData: any = {
				alumnoId: foundStudent!.id,
				alumnoNombre: `${foundStudent!.nombre} ${foundStudent!.apellido}`,
				alumnoDni: foundStudent!.dni,
				tipoAlumno: foundStudent!.tipo,
				alumnoTipo: foundStudent!.tipo === "Titular" ? "adulto" : "menor",
				cuota1a10: cursoSeleccionado?.cuota1a10 || 0,
				cuota11enAdelante: cursoSeleccionado?.cuota11enAdelante || 0,
				cursoId: selectedCourseId,
				cursoNombre: cursoSeleccionado?.nombre || "Desconocido",
				cursoInscripcion: cursoSeleccionado?.inscripcion || 0,
				metodoPago,
				status: paymentStatus,
				fecha: serverTimestamp(),
				excepcionEdad: overrideAgeWarning,
			};

			if (paymentStatus === "Pendiente")
				inscriptionData.fechaPromesaPago = promiseDate;

			// 1. Guardar inscripción
			const inscripcionRef = await addDoc(
				collection(db, "Inscripciones"),
				inscriptionData,
			);

			// 2. Actualizar cursos del alumno (siempre)
			await updateDoc(
				doc(
					db,
					foundStudent!.tipo === "Menor" ? "Hijos" : "Users",
					foundStudent!.id,
				),
				{
					cursos: arrayUnion(selectedCourseId),
				},
			);

			// 3. Solo si CONFIRMADO: crear cuotas + aplicar descuentos
			if (paymentStatus === "Confirmado" && cursoSeleccionado) {
				const descuentos = grupoFamiliar.aplica ? DESCUENTO_GRUPO_FAMILIAR : [];
				await crearPrimeraCuota(
					inscripcionRef.id,
					cursoSeleccionado,
					descuentos,
				);
				if (grupoFamiliar.aplica) await aplicarDescuentoAlGrupo();
			}
			// Si PENDIENTE: solo queda la inscripción, sin cuotas ni descuentos

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
				"Hubo un error al intentar guardar la inscripción. Revisa tu conexión e inténtalo de nuevo.",
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
		if (!foundStudent || !selectedCourseId || !metodoPago) return;
		processInscription();
	};

	const selectedCourse = courses.find((c) => c.id === selectedCourseId);
	const isAgeWarning =
		selectedCourse &&
		foundStudent &&
		(foundStudent.edad < selectedCourse.edadMinima ||
			foundStudent.edad > selectedCourse.edadMaxima);

	// ─── Render ───────────────────────────────────────────────────────────────

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
										className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
									>
										<X className="w-5 h-5" />
									</button>
								</div>

								{/* Body */}
								<div className="p-6 overflow-y-auto">
									{/* ═══ PASO 1: Búsqueda de alumno ═══ */}
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
														className="space-y-3"
													>
														{/* Card alumno */}
														<div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-start gap-3">
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

														{/* Verificando grupo */}
														{isCheckingGrupo && (
															<div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 p-3 rounded-lg">
																<Loader2 className="w-4 h-4 animate-spin text-[#252d62]" />
																Verificando beneficios del grupo familiar...
															</div>
														)}

														{/* Banner grupo familiar */}
														{!isCheckingGrupo && grupoFamiliar.aplica && (
															<motion.div
																initial={{ opacity: 0, y: 6 }}
																animate={{ opacity: 1, y: 0 }}
																className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg space-y-3"
															>
																<div className="flex items-start gap-2">
																	<Users className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
																	<div>
																		<p className="text-sm font-bold text-emerald-800">
																			¡Descuento por Grupo Familiar disponible!
																		</p>
																		<p className="text-xs text-emerald-700 mt-0.5">
																			Al inscribir y <strong>confirmar</strong>{" "}
																			el pago de este alumno, todos los miembros
																			recibirán un{" "}
																			<span className="font-bold">
																				10% de descuento
																			</span>{" "}
																			en sus cuotas mensuales.
																		</p>
																	</div>
																</div>

																<div className="space-y-1.5">
																	<p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
																		Miembros activos del grupo
																	</p>
																	{grupoFamiliar.miembrosActivos.map((m, i) => (
																		<div
																			key={i}
																			className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-emerald-100"
																		>
																			<Tag className="w-3 h-3 text-emerald-500 shrink-0" />
																			<span className="text-xs font-semibold text-emerald-800">
																				{m.nombre}
																			</span>
																			<span className="text-xs text-emerald-600 ml-auto">
																				{m.cursoNombre}
																			</span>
																		</div>
																	))}
																</div>

																{/* Checkbox mes actual */}
																<label className="flex items-center gap-2.5 cursor-pointer select-none border-t border-emerald-200 pt-2">
																	<input
																		type="checkbox"
																		checked={aplicarDescuentoMesActual}
																		onChange={(e) =>
																			setAplicarDescuentoMesActual(
																				e.target.checked,
																			)
																		}
																		className="w-4 h-4 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500 cursor-pointer"
																	/>
																	<span className="text-xs font-semibold text-emerald-800">
																		Aplicar descuento en cuotas de{" "}
																		{MESES_NOMBRES[new Date().getMonth()]} (mes
																		actual)
																	</span>
																</label>
																<p className="text-[11px] text-emerald-600">
																	⚡ Las cuotas del mes siguiente ya generadas
																	también serán actualizadas (solo si se
																	confirma el pago).
																</p>
															</motion.div>
														)}
													</motion.div>
												)}
											</div>

											<div className="pt-4 border-t border-gray-100 flex justify-end">
												<Button
													type="button"
													onClick={() => setStep(2)}
													disabled={!foundStudent || isCheckingGrupo}
													className="bg-[#EE1120] hover:bg-[#c4000e] text-white"
												>
													Confirmar y Continuar{" "}
													<ArrowRight className="w-4 h-4 ml-2" />
												</Button>
											</div>
										</form>
									)}

									{/* ═══ PASO 2: Curso y pago ═══ */}
									{step === 2 && (
										<form
											id="inscription-form"
											onSubmit={handleSubmitInscription}
											className="space-y-6"
										>
											<div className="space-y-4">
												{/* Resumen alumno */}
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

												{/* Badge descuento — solo si Confirmado */}
												{grupoFamiliar.aplica &&
													paymentStatus === "Confirmado" && (
														<div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
															<Tag className="w-4 h-4 text-emerald-600 shrink-0" />
															<p className="text-xs font-bold text-emerald-700">
																Descuento por Grupo Familiar (10%) será aplicado
																a las cuotas
															</p>
														</div>
													)}

												<label className="block text-sm font-bold text-[#252d62]">
													2. Detalles de Cursada
												</label>

												<div className="grid grid-cols-1 gap-4">
													{/* Select curso */}
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
															{courses.map((c) => (
																<option key={c.id} value={c.id}>
																	{c.nombre} - ${c.inscripcion}
																</option>
															))}
														</select>
													</div>

													{/* Preview cuota */}
													<AnimatePresence>
														{selectedCourse && selectedCourse.cuota1a10 > 0 && (
															<motion.div
																initial={{ opacity: 0, height: 0 }}
																animate={{ opacity: 1, height: "auto" }}
																exit={{ opacity: 0, height: 0 }}
																className="overflow-hidden"
															>
																<div className="bg-blue-50 border border-blue-200 p-3 rounded-lg space-y-2">
																	<p className="text-xs font-bold text-blue-700 uppercase tracking-wider">
																		Cálculo de 1era Cuota
																	</p>

																	{/* Si promesa de pago: aviso genérico */}
																	{paymentStatus === "Pendiente" ? (
																		<div className="flex items-center gap-2">
																			<AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
																			<p className="text-xs text-amber-700 font-medium">
																				Las cuotas se generarán cuando la
																				inscripción sea confirmada y el pago sea
																				efectivo.
																			</p>
																		</div>
																	) : grupoFamiliar.aplica ? (
																		<>
																			<div className="flex justify-between items-center text-sm">
																				<span className="text-blue-600">
																					{new Date().getDate() >= 15
																						? "Inscripción desde el día 15 → 50%"
																						: "Inscripción antes del día 15 → 100%"}
																				</span>
																				<div className="flex flex-col items-end">
																					<span className="font-bold text-blue-800 text-base">
																						$
																						{Math.round(
																							calcularMontoPrimerMes(
																								new Date(),
																								selectedCourse,
																							) * 0.9,
																						).toLocaleString("es-AR")}
																					</span>
																					<span className="text-[10px] text-blue-400 line-through">
																						$
																						{calcularMontoPrimerMes(
																							new Date(),
																							selectedCourse,
																						).toLocaleString("es-AR")}
																					</span>
																				</div>
																			</div>
																			<p className="text-[11px] text-blue-400">
																				Cuota con descuento GF (10%): $
																				{Math.round(
																					selectedCourse.cuota1a10 * 0.9,
																				).toLocaleString("es-AR")}{" "}
																				(1-10) / $
																				{Math.round(
																					selectedCourse.cuota11enAdelante *
																						0.9,
																				).toLocaleString("es-AR")}{" "}
																				(11+)
																			</p>
																		</>
																	) : (
																		<>
																			<div className="flex justify-between items-center text-sm">
																				<span className="text-blue-600">
																					{new Date().getDate() >= 15
																						? "Inscripción desde el día 15 → 50%"
																						: "Inscripción antes del día 15 → 100%"}
																				</span>
																				<span className="font-bold text-blue-800 text-base">
																					$
																					{calcularMontoPrimerMes(
																						new Date(),
																						selectedCourse,
																					).toLocaleString("es-AR")}
																				</span>
																			</div>
																			<p className="text-[11px] text-blue-400">
																				Cuota regular: $
																				{selectedCourse.cuota1a10.toLocaleString(
																					"es-AR",
																				)}{" "}
																				(1-10) / $
																				{selectedCourse.cuota11enAdelante.toLocaleString(
																					"es-AR",
																				)}{" "}
																				(11+)
																			</p>
																		</>
																	)}

																	{paymentStatus === "Confirmado" &&
																		new Date().getDate() >= 20 && (
																			<p className="text-[11px] text-blue-500 font-medium border-t border-blue-200 pt-1.5">
																				⚡ Se generará también la cuota del mes
																				siguiente
																			</p>
																		)}
																</div>
															</motion.div>
														)}
													</AnimatePresence>

													{/* Alerta de edad */}
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
																			años. El alumno tiene{" "}
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
													{/* Select estado */}
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

													{/* Método de pago (solo Confirmado) */}
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
																	value={metodoPago}
																	onChange={(e) =>
																		setmetodoPago(e.target.value)
																	}
																	className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white appearance-none cursor-pointer disabled:opacity-50"
																>
																	<option value="">
																		Seleccionar Medio de Pago Recibido
																	</option>
																	<option value="Efectivo">
																		Efectivo en Sede
																	</option>
																	<option value="Transferencia Bancaria (Verificada)">
																		Transferencia Bancaria (Verificada)
																	</option>
																	<option value="Tarjeta">
																		Tarjeta (Posnet)
																	</option>
																</select>
															</div>
														</motion.div>
													)}

													{/* Fecha promesa (solo Pendiente) */}
													{paymentStatus === "Pendiente" && (
														<motion.div
															initial={{ opacity: 0, height: 0 }}
															animate={{ opacity: 1, height: "auto" }}
														>
															<div className="space-y-2">
																<div className="relative">
																	<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
																		<CalendarClock className="h-4 w-4 text-gray-400" />
																	</div>
																	<input
																		type="date"
																		required
																		disabled={isSubmitting}
																		value={promiseDate}
																		min={getTomorrow()}
																		onChange={(e) => {
																			setPromiseDate(e.target.value);
																			setmetodoPago("A confirmar");
																		}}
																		className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white disabled:opacity-50"
																	/>
																</div>
																<p className="text-xs text-gray-500 ml-1">
																	Ingresa la fecha límite en la que el tutor se
																	comprometió a abonar.
																</p>

																{/* Aviso grupo familiar + promesa */}
																{grupoFamiliar.aplica && (
																	<div className="flex items-start gap-2 bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-lg">
																		<AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
																		<p className="text-xs text-amber-700 font-medium">
																			El descuento por Grupo Familiar y la
																			generación de cuotas quedarán pendientes
																			hasta que la inscripción sea confirmada
																			con el pago efectivo.
																		</p>
																	</div>
																)}
															</div>
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
													<ArrowLeft className="w-4 h-4 mr-2" /> Atrás
												</Button>
												<Button
													type="submit"
													disabled={
														isSubmitting ||
														!selectedCourseId ||
														(paymentStatus === "Confirmado" && !metodoPago) ||
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

			{/* Dialog alertas */}
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
