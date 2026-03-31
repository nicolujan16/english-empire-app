/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	X,
	Save,
	Loader2,
	AlertCircle,
	CheckCircle2,
	GraduationCap,
	UserCheck,
	Pencil,
	RotateCcw,
	ArrowRightLeft,
	UserMinus,
} from "lucide-react";
import {
	doc,
	updateDoc,
	collection,
	query,
	where,
	getDocs,
	arrayRemove,
	arrayUnion,
	addDoc,
	serverTimestamp,
	deleteDoc,
	getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import {
	StudentRow,
	CourseMap,
	CourseDetails,
	TitularForm,
	MenorForm,
	EtiquetaDisponible,
	ReassignmentMap,
	BajaMap,
	SectionDivider,
	ReadOnlyField,
	TipoBadge,
	calcularEdad,
	esCuotaFutura,
} from "./EditUserInfoModal.types";
import { TitularFormFields, MenorFormFields } from "./UserFormFields";
import CourseReassignRow from "./CourseReassignRow";
import EtiquetasSection from "./EtiquetasSection";

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditUserInfoModalProps {
	student: StudentRow | null;
	isOpen: boolean;
	onClose: () => void;
	onSuccess: (updatedStudent: StudentRow) => void;
	coursesMap: CourseMap;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EditUserInfoModal({
	student,
	isOpen,
	onClose,
	onSuccess,
	coursesMap,
}: EditUserInfoModalProps) {
	const [titularForm, setTitularForm] = useState<TitularForm>({
		nombre: "",
		apellido: "",
		dni: "",
		fechaNacimiento: "",
		email: "",
		telefono: "",
	});
	const [menorForm, setMenorForm] = useState<MenorForm>({
		nombre: "",
		apellido: "",
		dni: "",
		fechaNacimiento: "",
	});
	const [allCourses, setAllCourses] = useState<CourseDetails[]>([]);
	const [reassignments, setReassignments] = useState<ReassignmentMap>({});
	const [bajas, setBajas] = useState<BajaMap>({});

	// Etiquetas
	const [etiquetasDisponibles, setEtiquetasDisponibles] = useState<
		EtiquetaDisponible[]
	>([]);
	const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState<
		Set<string>
	>(new Set());
	const [aplicarAHijos, setAplicarAHijos] = useState(false);
	const [hijosIds, setHijosIds] = useState<string[]>([]);

	const [isLoading, setIsLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");
	const [successMsg, setSuccessMsg] = useState("");

	// ── Cargar cursos y etiquetas al abrir ────────────────────────────────────
	useEffect(() => {
		if (!isOpen) return;
		const fetchData = async () => {
			try {
				const [cursosSnap, etiquetasSnap] = await Promise.all([
					getDocs(collection(db, "Cursos")),
					getDocs(
						query(
							collection(db, "EtiquetasDescuento"),
							where("activa", "==", true),
						),
					),
				]);
				setAllCourses(
					cursosSnap.docs
						.map((d) => ({
							id: d.id,
							nombre: d.data().nombre || d.id,
							cuota1a10: d.data().cuota1a10 ?? 0,
							cuota11enAdelante: d.data().cuota11enAdelante ?? 0,
							inscripcion: d.data().inscripcion ?? 0,
						}))
						.sort((a, b) => a.nombre.localeCompare(b.nombre)),
				);
				setEtiquetasDisponibles(
					etiquetasSnap.docs.map((d) => ({
						id: d.id,
						nombre: d.data().nombre,
						descripcion: d.data().descripcion,
						color: d.data().color ?? "gray",
						descuentoInscripcion: d.data().descuentoInscripcion ?? null,
						descuentoCuota: d.data().descuentoCuota ?? null,
						acumulableConGrupoFamiliar:
							d.data().acumulableConGrupoFamiliar ?? false,
					})),
				);
			} catch (err) {
				console.error("Error cargando datos:", err);
			}
		};
		fetchData();
	}, [isOpen]);

	// ── Inicializar form ──────────────────────────────────────────────────────
	useEffect(() => {
		if (!student || !isOpen) {
			setErrorMsg("");
			setSuccessMsg("");
			setReassignments({});
			setBajas({});
			setEtiquetasSeleccionadas(new Set());
			setAplicarAHijos(false);
			setHijosIds([]);
			return;
		}
		const initMap: ReassignmentMap = {};
		const initBajas: BajaMap = {};
		student.cursos.forEach((id) => {
			initMap[id] = "";
			initBajas[id] = false;
		});
		setReassignments(initMap);
		setBajas(initBajas);

		if (student.tipo === "Titular") {
			setTitularForm({
				nombre: student.nombre,
				apellido: student.apellido,
				dni: student.dni,
				fechaNacimiento: student.fechaNacimiento,
				email: student.email || "",
				telefono: student.telefono || "",
			});
		} else {
			setMenorForm({
				nombre: student.nombre,
				apellido: student.apellido,
				dni: student.dni,
				fechaNacimiento: student.fechaNacimiento,
			});
		}

		const fetchStudentExtras = async () => {
			try {
				const colName = student.tipo === "Titular" ? "Users" : "Hijos";
				const studentDoc = await getDoc(doc(db, colName, student.id));
				if (studentDoc.exists()) {
					const data = studentDoc.data();
					setEtiquetasSeleccionadas(new Set(data.etiquetas ?? []));
					if (student.isTutor && (data.hijos ?? []).length > 0) {
						setHijosIds(data.hijos as string[]);
					}
				}
			} catch (err) {
				console.error("Error cargando etiquetas:", err);
			}
		};
		fetchStudentExtras();
	}, [student, isOpen]);

	// ── Handlers de form ──────────────────────────────────────────────────────
	const handleTitularChange = (e: ChangeEvent<HTMLInputElement>) => {
		setErrorMsg("");
		setTitularForm({ ...titularForm, [e.target.id]: e.target.value });
	};

	const handleMenorChange = (e: ChangeEvent<HTMLInputElement>) => {
		setErrorMsg("");
		setMenorForm({ ...menorForm, [e.target.id]: e.target.value });
	};

	const handlePhoneChange = (value?: string) => {
		setErrorMsg("");
		setTitularForm({ ...titularForm, telefono: value || "" });
	};

	const toggleEtiqueta = (id: string) => {
		setEtiquetasSeleccionadas((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleReset = () => {
		if (!student) return;
		setErrorMsg("");
		setSuccessMsg("");
		const initMap: ReassignmentMap = {};
		const initBajas: BajaMap = {};
		student.cursos.forEach((id) => {
			initMap[id] = "";
			initBajas[id] = false;
		});
		setReassignments(initMap);
		setBajas(initBajas);
		if (student.tipo === "Titular") {
			setTitularForm({
				nombre: student.nombre,
				apellido: student.apellido,
				dni: student.dni,
				fechaNacimiento: student.fechaNacimiento,
				email: student.email || "",
				telefono: student.telefono || "",
			});
		} else {
			setMenorForm({
				nombre: student.nombre,
				apellido: student.apellido,
				dni: student.dni,
				fechaNacimiento: student.fechaNacimiento,
			});
		}
	};

	// ── Procesar bajas ────────────────────────────────────────────────────────
	const procesarBajas = async () => {
		if (!student) return;
		const colName = student.tipo === "Titular" ? "Users" : "Hijos";
		const studentRef = doc(db, colName, student.id);
		for (const [cursoId, darDeBaja] of Object.entries(bajas)) {
			if (!darDeBaja) continue;
			await updateDoc(studentRef, { cursos: arrayRemove(cursoId) });
			const cuotasSnap = await getDocs(
				query(
					collection(db, "Cuotas"),
					where("alumnoId", "==", student.id),
					where("cursoId", "==", cursoId),
					where("estado", "==", "Pendiente"),
				),
			);
			for (const cuotaDoc of cuotasSnap.docs) {
				const data = cuotaDoc.data();
				if (!esCuotaFutura(data.mes, data.anio)) continue;
				await deleteDoc(doc(db, "Cuotas", cuotaDoc.id));
			}
			await addDoc(collection(db, "ReasignacionesCursos"), {
				alumnoId: student.id,
				alumnoNombre: `${student.nombre} ${student.apellido}`,
				alumnoDni: student.dni,
				alumnoTipo: student.tipo === "Titular" ? "adulto" : "menor",
				tipo: "baja",
				cursoAnteriorId: cursoId,
				cursoAnteriorNombre: coursesMap[cursoId] || cursoId,
				cursoNuevoId: null,
				cursoNuevoNombre: null,
				fecha: serverTimestamp(),
			});
		}
	};

	// ── Procesar reasignaciones ───────────────────────────────────────────────
	const procesarReasignaciones = async () => {
		if (!student) return;
		const colName = student.tipo === "Titular" ? "Users" : "Hijos";
		const studentRef = doc(db, colName, student.id);
		for (const [cursoActualId, nuevoCursoId] of Object.entries(reassignments)) {
			if (
				!nuevoCursoId ||
				nuevoCursoId === cursoActualId ||
				bajas[cursoActualId]
			)
				continue;
			const nuevoCurso = allCourses.find((c) => c.id === nuevoCursoId);
			if (!nuevoCurso) continue;
			await updateDoc(studentRef, { cursos: arrayRemove(cursoActualId) });
			await updateDoc(studentRef, { cursos: arrayUnion(nuevoCursoId) });
			const cuotasSnap = await getDocs(
				query(
					collection(db, "Cuotas"),
					where("alumnoId", "==", student.id),
					where("cursoId", "==", cursoActualId),
					where("estado", "==", "Pendiente"),
				),
			);
			for (const cuotaDoc of cuotasSnap.docs) {
				const data = cuotaDoc.data();
				if (!esCuotaFutura(data.mes, data.anio)) continue;
				await updateDoc(doc(db, "Cuotas", cuotaDoc.id), {
					cursoId: nuevoCursoId,
					cursoNombre: nuevoCurso.nombre,
					cuota1a10: nuevoCurso.cuota1a10,
					cuota11enAdelante: nuevoCurso.cuota11enAdelante,
				});
			}
			await addDoc(collection(db, "ReasignacionesCursos"), {
				alumnoId: student.id,
				alumnoNombre: `${student.nombre} ${student.apellido}`,
				alumnoDni: student.dni,
				alumnoTipo: student.tipo === "Titular" ? "adulto" : "menor",
				tipo: "reasignacion",
				cursoAnteriorId: cursoActualId,
				cursoAnteriorNombre: coursesMap[cursoActualId] || cursoActualId,
				cursoNuevoId: nuevoCursoId,
				cursoNuevoNombre: nuevoCurso.nombre,
				fecha: serverTimestamp(),
			});
		}
	};

	// ── Guardar etiquetas ─────────────────────────────────────────────────────
	const guardarEtiquetas = async () => {
		if (!student) return;
		const etiquetasArray = [...etiquetasSeleccionadas];
		const colName = student.tipo === "Titular" ? "Users" : "Hijos";
		await updateDoc(doc(db, colName, student.id), {
			etiquetas: etiquetasArray,
		});
		if (student.isTutor && aplicarAHijos && hijosIds.length > 0) {
			await Promise.all(
				hijosIds.map((hijoId) =>
					updateDoc(doc(db, "Hijos", hijoId), { etiquetas: etiquetasArray }),
				),
			);
		}
	};

	// ── Validaciones ──────────────────────────────────────────────────────────
	const validateCommonFields = async (
		nombre: string,
		apellido: string,
		dni: string,
		fechaNacimiento: string,
		currentId: string,
	): Promise<string> => {
		if (!nombre.trim() || !apellido.trim())
			return "El nombre y apellido son obligatorios.";
		if (!dni.trim()) return "El DNI es obligatorio.";
		if (!fechaNacimiento) return "La fecha de nacimiento es obligatoria.";
		if (dni !== student?.dni) {
			const [dniUsers, dniHijos] = await Promise.all([
				getDocs(query(collection(db, "Users"), where("dni", "==", dni))),
				getDocs(query(collection(db, "Hijos"), where("dni", "==", dni))),
			]);
			const taken =
				dniUsers.docs.some((d) => d.id !== currentId) ||
				dniHijos.docs.some((d) => d.id !== currentId);
			if (taken) return "El DNI ingresado ya está registrado en otra cuenta.";
		}
		return "";
	};

	// ── Limpiar Grupo Familiar (Efecto Dominó) ────────────────────────────────
	const limpiarGrupoFamiliarSiCorresponde = async () => {
		if (!student) return;

		try {
			// 1. Obtener tutorId
			let tutorId = student.id;
			if (student.tipo !== "Titular") {
				const hijoSnap = await getDoc(doc(db, "Hijos", student.id));
				if (hijoSnap.exists()) tutorId = hijoSnap.data().tutorId || student.id;
			}

			// 2. Buscar todos los miembros de la familia y ver quiénes tienen cursos ACTIVOS
			const miembrosActivosIds: string[] = [];

			// Revisamos al tutor
			const tutorSnap = await getDoc(doc(db, "Users", tutorId));
			if (tutorSnap.exists() && (tutorSnap.data().cursos?.length || 0) > 0) {
				miembrosActivosIds.push(tutorId);
			}

			// Revisamos a todos los hijos
			const hijosSnap = await getDocs(
				query(collection(db, "Hijos"), where("tutorId", "==", tutorId)),
			);
			hijosSnap.forEach((h) => {
				if ((h.data().cursos?.length || 0) > 0) {
					miembrosActivosIds.push(h.id);
				}
			});

			// 3. Validar si quedó 1 solo miembro activo
			if (miembrosActivosIds.length === 1) {
				const unicoMiembroId = miembrosActivosIds[0];
				console.log(
					`🧹 Grupo familiar roto. Removiendo descuento al alumno: ${unicoMiembroId}`,
				);

				// Buscar sus cuotas pendientes
				const cuotasSnap = await getDocs(
					query(
						collection(db, "Cuotas"),
						where("alumnoId", "==", unicoMiembroId),
						where("estado", "==", "Pendiente"),
					),
				);

				for (const cuotaDoc of cuotasSnap.docs) {
					const data = cuotaDoc.data();

					// Solo le quitamos el descuento a las cuotas FUTURAS (para no alterar deuda vieja que ya se facturó)
					if (esCuotaFutura(data.mes, data.anio)) {
						const descuentosActuales = data.descuentos || [];

						// Verificamos si tiene el descuento aplicado
						const tieneGrupoFamiliar = descuentosActuales.some(
							(d: any) => d.detalle === "Grupo Familiar",
						);

						if (tieneGrupoFamiliar) {
							// Filtramos el array para quitar SOLO el de Grupo Familiar (mantiene otros descuentos si tuviera)
							const nuevosDescuentos = descuentosActuales.filter(
								(d: any) => d.detalle !== "Grupo Familiar",
							);

							await updateDoc(doc(db, "Cuotas", cuotaDoc.id), {
								descuentos: nuevosDescuentos,
								actualizadoEn: serverTimestamp(),
							});
						}
					}
				}
			}
		} catch (error) {
			console.error("Error al limpiar el grupo familiar:", error);
		}
	};

	// ── Guardar ───────────────────────────────────────────────────────────────
	const handleSave = async () => {
		if (!student) return;
		setIsLoading(true);
		setErrorMsg("");
		setSuccessMsg("");
		try {
			if (student.tipo === "Titular") {
				const err = await validateCommonFields(
					titularForm.nombre,
					titularForm.apellido,
					titularForm.dni,
					titularForm.fechaNacimiento,
					student.id,
				);
				if (err) {
					setErrorMsg(err);
					setIsLoading(false);
					return;
				}
				const edad = calcularEdad(titularForm.fechaNacimiento);
				if (typeof edad === "number") {
					if (edad < 18) {
						setErrorMsg("El titular debe ser mayor de 18 años.");
						setIsLoading(false);
						return;
					}
					if (edad > 120) {
						setErrorMsg("Fecha de nacimiento inválida.");
						setIsLoading(false);
						return;
					}
				}
				if (titularForm.telefono && titularForm.telefono !== student.telefono) {
					const phoneSnap = await getDocs(
						query(
							collection(db, "Users"),
							where("telefono", "==", titularForm.telefono),
						),
					);
					if (phoneSnap.docs.some((d) => d.id !== student.id)) {
						setErrorMsg(
							"Este número de teléfono ya está asociado a otra cuenta.",
						);
						setIsLoading(false);
						return;
					}
				}

				const isAssigningNewEmail =
					!student.email && titularForm.email.trim() !== "";
				let finalEmail = student.email || ""; // Mantenemos el original si no se asignó nada

				if (isAssigningNewEmail) {
					try {
						const res = await fetch("/api/asociar-email", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								alumnoId: student.id,
								email: titularForm.email.trim(),
							}),
						});

						const data = await res.json();
						if (!res.ok) {
							setErrorMsg(
								data.error || "Error al registrar el correo electrónico.",
							);
							setIsLoading(false);
							return;
						}
						finalEmail = titularForm.email.trim();
					} catch (apiErr) {
						console.error("Error en la llamada a la API:", apiErr);
						setErrorMsg("Error de conexión al intentar asociar el correo.");
						setIsLoading(false);
						return;
					}
				}

				await updateDoc(doc(db, "Users", student.id), {
					nombre: titularForm.nombre.trim(),
					apellido: titularForm.apellido.trim(),
					dni: titularForm.dni.trim(),
					fechaNacimiento: titularForm.fechaNacimiento,
					edadTitular: calcularEdad(titularForm.fechaNacimiento),
					telefono: titularForm.telefono,
					...(isAssigningNewEmail
						? { email: finalEmail, sinAccesoWeb: false }
						: {}),
				});

				if (student.isTutor && hijosIds.length > 0) {
					const promesasHijos = hijosIds.map((hijoId) =>
						updateDoc(doc(db, "Hijos", hijoId), {
							"datosTutor.nombre": titularForm.nombre.trim(),
							"datosTutor.apellido": titularForm.apellido.trim(),
							"datosTutor.dni": titularForm.dni.trim(),
							"datosTutor.telefono": titularForm.telefono,
							"datosTutor.email": finalEmail,
						}),
					);
					await Promise.all(promesasHijos);
				}

				await procesarBajas();
				await procesarReasignaciones();
				await guardarEtiquetas();
				if (hayBajas) {
					await limpiarGrupoFamiliarSiCorresponde();
				}

				const cursosActualizados = student.cursos
					.filter((id) => !bajas[id])
					.map((id) => {
						const r = reassignments[id];
						return r && r !== id ? r : id;
					});

				onSuccess({
					...student,
					nombre: titularForm.nombre.trim(),
					apellido: titularForm.apellido.trim(),
					dni: titularForm.dni.trim(),
					fechaNacimiento: titularForm.fechaNacimiento,
					email: finalEmail, // Actualizamos el UI local con el nuevo correo
					edad: calcularEdad(titularForm.fechaNacimiento) as number,
					telefono: titularForm.telefono,
					cursos: cursosActualizados,
				});
			} else {
				const err = await validateCommonFields(
					menorForm.nombre,
					menorForm.apellido,
					menorForm.dni,
					menorForm.fechaNacimiento,
					student.id,
				);
				if (err) {
					setErrorMsg(err);
					setIsLoading(false);
					return;
				}
				await updateDoc(doc(db, "Hijos", student.id), {
					nombre: menorForm.nombre.trim(),
					apellido: menorForm.apellido.trim(),
					dni: menorForm.dni.trim(),
					fechaNacimiento: menorForm.fechaNacimiento,
				});

				await procesarBajas();
				await procesarReasignaciones();
				await guardarEtiquetas();

				if (hayBajas) {
					await limpiarGrupoFamiliarSiCorresponde();
				}

				const cursosActualizados = student.cursos
					.filter((id) => !bajas[id])
					.map((id) => {
						const r = reassignments[id];
						return r && r !== id ? r : id;
					});
				onSuccess({
					...student,
					nombre: menorForm.nombre.trim(),
					apellido: menorForm.apellido.trim(),
					dni: menorForm.dni.trim(),
					fechaNacimiento: menorForm.fechaNacimiento,
					edad: calcularEdad(menorForm.fechaNacimiento) as number,
					cursos: cursosActualizados,
				});
			}
			setSuccessMsg("¡Datos actualizados correctamente!");
			setTimeout(() => onClose(), 1200);
		} catch (err) {
			console.error("Error al actualizar:", err);
			setErrorMsg("Hubo un error al guardar los cambios. Intentá de nuevo.");
		} finally {
			setIsLoading(false);
		}
	};

	if (!student) return null;

	const isTitular = student.tipo === "Titular";
	const hayReasignaciones = Object.values(reassignments).some((v) => v !== "");
	const hayBajas = Object.values(bajas).some((v) => v === true);

	// ─── Render ───────────────────────────────────────────────────────────────

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<motion.div
						key="edit-backdrop"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
					/>
					<motion.div
						key="edit-modal"
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{ type: "spring", stiffness: 300, damping: 28 }}
						className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
					>
						<div
							className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto"
							onClick={(e) => e.stopPropagation()}
						>
							{/* HEADER */}
							<div className="relative bg-gradient-to-br from-[#1a2248] to-[#252d62] px-6 py-5 shrink-0">
								<button
									onClick={onClose}
									className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-40"
								>
									<X className="w-4 h-4" />
								</button>
								<div className="flex items-center gap-4 relative z-10">
									<div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-white font-black text-2xl shadow-inner shrink-0">
										{student.nombre.charAt(0).toUpperCase()}
									</div>
									<div>
										<div className="flex items-center gap-2">
											<Pencil className="w-3.5 h-3.5 text-white/60" />
											<span className="text-[11px] font-bold text-white/60 uppercase tracking-widest">
												Editando datos
											</span>
										</div>
										<h2 className="text-xl font-black text-white leading-tight mt-0.5">
											{student.nombre} {student.apellido}
										</h2>
										<TipoBadge tipo={student.tipo} isTutor={student.isTutor} />
									</div>
								</div>
							</div>

							{/* BODY */}
							<div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
								{/* ── Formulario según tipo ── */}
								{isTitular ? (
									<>
										<TitularFormFields
											form={titularForm}
											onChange={handleTitularChange}
											onPhoneChange={handlePhoneChange}
											isEmailEditable={!student.email}
										/>

										{/* 🚀 SI NO TIENE EMAIL: Mostramos el bloque de asignación explícito */}
										{!student.email && (
											<div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
												<label className="block text-xs font-bold text-amber-800 mb-1.5 flex items-center gap-1.5">
													<AlertCircle className="w-3.5 h-3.5" /> Asignar Acceso
													Web
												</label>
												<input
													type="email"
													id="email"
													value={titularForm.email}
													onChange={handleTitularChange}
													disabled={isLoading}
													placeholder="correo@ejemplo.com"
													className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 outline-none"
												/>
												<p className="text-[10px] text-amber-700 mt-1.5 leading-tight">
													Al guardar, se enviará un correo para que el alumno
													genere su contraseña.{" "}
													<strong>
														Dejar vacío si no se desea asignar aún.
													</strong>
												</p>
											</div>
										)}
									</>
								) : (
									<MenorFormFields
										form={menorForm}
										onChange={handleMenorChange}
										nombreTutor={student.nombreTutor}
									/>
								)}

								{/* ── Cursos ── */}
								{student.cursos.length > 0 ? (
									<>
										<SectionDivider label="Cursos" />
										{hayReasignaciones && !hayBajas && (
											<motion.div
												initial={{ opacity: 0, y: -4 }}
												animate={{ opacity: 1, y: 0 }}
												className="flex items-start gap-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 rounded-xl text-xs font-medium"
											>
												<ArrowRightLeft className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500" />
												<span>
													Las cuotas <strong>pasadas pendientes</strong>{" "}
													conservarán su monto. Las cuotas{" "}
													<strong>futuras pendientes</strong> se actualizarán
													con los precios del nuevo curso al guardar.
												</span>
											</motion.div>
										)}
										{hayBajas && (
											<motion.div
												initial={{ opacity: 0, y: -4 }}
												animate={{ opacity: 1, y: 0 }}
												className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-medium"
											>
												<UserMinus className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
												<span>
													Al dar de baja, el alumno será quitado del curso y las
													cuotas <strong>futuras pendientes</strong> serán{" "}
													<strong>eliminadas</strong>. Las cuotas de meses
													anteriores no se modifican.
												</span>
											</motion.div>
										)}
										<div className="space-y-2">
											{student.cursos.map((cursoId) => (
												<CourseReassignRow
													key={cursoId}
													cursoActualId={cursoId}
													cursoActualNombre={coursesMap[cursoId] || cursoId}
													nuevoCursoId={reassignments[cursoId] ?? ""}
													esBaja={bajas[cursoId] ?? false}
													allCourses={allCourses}
													onChange={(newId) =>
														setReassignments((prev) => ({
															...prev,
															[cursoId]: newId,
														}))
													}
													onToggleBaja={() =>
														setBajas((prev) => ({
															...prev,
															[cursoId]: !prev[cursoId],
														}))
													}
												/>
											))}
										</div>
									</>
								) : (
									<>
										<SectionDivider label="Cursos" />
										<ReadOnlyField
											icon={GraduationCap}
											label="Cursos asignados"
											value="Sin cursos"
										/>
									</>
								)}

								{/* ── Etiquetas ── */}
								<SectionDivider label="Etiquetas de Descuento" />
								<EtiquetasSection
									etiquetasDisponibles={etiquetasDisponibles}
									etiquetasSeleccionadas={etiquetasSeleccionadas}
									onToggle={toggleEtiqueta}
									isTutor={student.isTutor}
									hijosIds={hijosIds}
									aplicarAHijos={aplicarAHijos}
									onToggleAplicarAHijos={() => setAplicarAHijos((v) => !v)}
								/>

								{/* Rol solo lectura (titular) */}
								{isTitular && (
									<>
										<SectionDivider label="Información de Solo Lectura" />
										<ReadOnlyField
											icon={UserCheck}
											label="Rol"
											value={student.isTutor ? "Alumno · Tutor" : "Alumno"}
										/>
									</>
								)}

								{/* Mensajes de estado */}
								<AnimatePresence>
									{errorMsg && (
										<motion.div
											initial={{ opacity: 0, y: -6 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -6 }}
											className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium"
										>
											<AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
											<span>{errorMsg}</span>
										</motion.div>
									)}
									{successMsg && (
										<motion.div
											initial={{ opacity: 0, y: -6 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -6 }}
											className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-medium"
										>
											<CheckCircle2 className="w-4 h-4 shrink-0" />
											<span>{successMsg}</span>
										</motion.div>
									)}
								</AnimatePresence>
							</div>

							{/* FOOTER */}
							<div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0 flex items-center justify-between gap-3">
								<button
									type="button"
									onClick={handleReset}
									disabled={isLoading}
									className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
								>
									<RotateCcw className="w-3.5 h-3.5" /> Restaurar
								</button>
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={onClose}
										disabled={isLoading}
										className="px-5 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
									>
										Cancelar
									</button>
									<button
										type="button"
										onClick={handleSave}
										disabled={isLoading}
										className={`flex items-center gap-2 px-6 py-2 text-sm font-bold text-white rounded-full shadow-md transition-all duration-200 ${
											isLoading
												? "bg-[#252d62]/60 cursor-wait"
												: "bg-[#252d62] hover:bg-[#1a2248] hover:scale-105 active:scale-95"
										}`}
									>
										{isLoading ? (
											<>
												<Loader2 className="w-4 h-4 animate-spin" />
												Guardando...
											</>
										) : (
											<>
												<Save className="w-4 h-4" />
												Guardar Cambios
											</>
										)}
									</button>
								</div>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
