/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
	ArrowLeft,
	Loader2,
	Save,
	UserCheck,
	Clock,
	UserX,
	CalendarDays,
	BookOpen,
	CheckCircle2,
	Trash2,
	AlertTriangle,
	FileText,
	X,
	UserPlus,
	Search,
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

import { auth, db } from "@/lib/firebaseConfig";
import { onAuthStateChanged, User } from "firebase/auth";
import {
	doc,
	getDoc,
	collection,
	query,
	where,
	getDocs,
	updateDoc,
	deleteDoc,
	serverTimestamp,
	orderBy,
	limit,
} from "firebase/firestore";

import AvisoInasistenciasModal, {
	AlumnoRiesgo,
} from "@/components/teachers/AvisoInasistenciaModal";

// ─── INTERFACES ───────────────────────────────────────────────────────────────
type EstadoAsistencia = "Presente" | "Tarde" | "Ausente";

interface AsistenciaRecord {
	alumnoId: string;
	nombre: string;
	dni: string;
	tipo: string;
	estado: EstadoAsistencia;
	emailDestino?: string;
}

interface ClaseMetadata {
	cursoId: string;
	cursoNombre: string;
	fechaFormateada: string;
	fechaIso: string;
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function TomarAsistenciaPage() {
	const params = useParams();
	const router = useRouter();
	const claseId = params.id as string;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [currentUser, setCurrentUser] = useState<User | null>(null);
	const [metadata, setMetadata] = useState<ClaseMetadata | null>(null);

	const [hora, setHora] = useState("");
	const [descripcion, setDescripcion] = useState("");

	const [asistencia, setAsistencia] = useState<AsistenciaRecord[]>([]);

	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [showSuccess, setShowSuccess] = useState(false);

	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	// Estados para el Modal Extraído
	const [isAbsenceAlertOpen, setIsAbsenceAlertOpen] = useState(false);
	const [alumnosEnRiesgo, setAlumnosEnRiesgo] = useState<AlumnoRiesgo[]>([]);

	// ── Estados para eliminar alumno ─────────────────────────────────────────
	const [alumnoAEliminar, setAlumnoAEliminar] = useState<AsistenciaRecord | null>(null);

	// ── Estados para agregar alumno por DNI ──────────────────────────────────
	const [dniAgregar, setDniAgregar] = useState("");
	const [isAddingAlumno, setIsAddingAlumno] = useState(false);
	const [errorAgregar, setErrorAgregar] = useState<string | null>(null);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, async (user) => {
			if (user) {
				setCurrentUser(user);
				await fetchData(user.uid);
			} else {
				router.push("/teachers");
			}
		});
		return () => unsubscribe();
	}, [claseId]);

	const fetchData = async (profesorId: string) => {
		setIsLoading(true);
		try {
			const claseRef = doc(db, "Clases", claseId);
			const claseSnap = await getDoc(claseRef);

			if (!claseSnap.exists() || claseSnap.data().profesorId !== profesorId) {
				alert("Clase no encontrada o acceso denegado.");
				router.push("/teachers");
				return;
			}

			const dataClase = claseSnap.data();
			const cursoId = dataClase.cursoId;
			const asistenciaGuardada: AsistenciaRecord[] = dataClase.asistencia || [];
			const alumnoIdsSnapshot: string[] | undefined = dataClase.alumnoIdsSnapshot;

			const dbHora =
				dataClase.horaFormateada ||
				new Date(dataClase.fechaIso || new Date()).toLocaleTimeString("es-AR", {
					hour: "2-digit",
					minute: "2-digit",
					hour12: false,
				});
			setHora(dbHora);
			setDescripcion(dataClase.descripcion || "");

			const cursoRef = doc(db, "Cursos", cursoId);
			const cursoSnap = await getDoc(cursoRef);
			const cursoNombre = cursoSnap.exists()
				? cursoSnap.data().nombre
				: "Curso Desconocido";

			setMetadata({
				cursoId,
				cursoNombre,
				fechaFormateada: dataClase.fechaFormateada,
				fechaIso: dataClase.fechaIso || new Date().toISOString(),
			});

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let activeStudents: any[] = [];

			if (alumnoIdsSnapshot && alumnoIdsSnapshot.length > 0) {
				// ── NUEVO: usar el snapshot guardado al crear la clase ────────────
				const userFetches = alumnoIdsSnapshot.map(async (id) => {
					// Intentamos primero en Users, luego en Hijos
					const userSnap = await getDoc(doc(db, "Users", id));
					if (userSnap.exists()) {
						return { id, tipo: "Titular", ...userSnap.data() };
					}
					const hijoSnap = await getDoc(doc(db, "Hijos", id));
					if (hijoSnap.exists()) {
						return { id, tipo: "Menor", ...hijoSnap.data() };
					}
					return null;
				});
				const results = await Promise.all(userFetches);
				activeStudents = results.filter(Boolean);
				// ─────────────────────────────────────────────────────────────────
			} else {
				// ── FALLBACK: comportamiento anterior para clases sin snapshot ────
				const qUsers = query(
					collection(db, "Users"),
					where("cursos", "array-contains", cursoId),
				);
				const qHijos = query(
					collection(db, "Hijos"),
					where("cursos", "array-contains", cursoId),
				);
				const [usersSnap, hijosSnap] = await Promise.all([
					getDocs(qUsers),
					getDocs(qHijos),
				]);
				usersSnap.forEach((d) =>
					activeStudents.push({ id: d.id, tipo: "Titular", ...d.data() }),
				);
				hijosSnap.forEach((d) =>
					activeStudents.push({ id: d.id, tipo: "Menor", ...d.data() }),
				);
				// ─────────────────────────────────────────────────────────────────
			}

			const currentRecords: AsistenciaRecord[] = activeStudents.map(
				(student) => {
					const registroPrevio = asistenciaGuardada.find(
						(a) => a.alumnoId === student.id,
					);

					const mailParaAviso =
						student.tipo === "Titular"
							? student.email
							: student.datosTutor?.email;

					return {
						alumnoId: student.id,
						nombre: `${student.nombre} ${student.apellido}`.trim(),
						dni: student.dni || "Sin DNI",
						tipo: student.tipo,
						estado: registroPrevio ? registroPrevio.estado : "Presente",
						emailDestino: mailParaAviso, // Se lo guardamos
					};
				},
			);

			const droppedRecords = asistenciaGuardada.filter(
				(a) => !activeStudents.some((s) => s.id === a.alumnoId),
			);

			const asistenciaFinal = [...currentRecords, ...droppedRecords].sort(
				(a, b) => a.nombre.localeCompare(b.nombre),
			);

			setAsistencia(asistenciaFinal);
		} catch (error) {
			console.error("Error cargando la asistencia:", error);
			alert("Hubo un problema al cargar la lista de alumnos.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleToggleEstado = (
		alumnoId: string,
		nuevoEstado: EstadoAsistencia,
	) => {
		setAsistencia((prev) =>
			prev.map((alumno) =>
				alumno.alumnoId === alumnoId
					? { ...alumno, estado: nuevoEstado }
					: alumno,
			),
		);
		setShowSuccess(false);
	};

	const handleConfirmarEliminar = () => {
		if (!alumnoAEliminar) return;
		setAsistencia((prev) =>
			prev.filter((a) => a.alumnoId !== alumnoAEliminar.alumnoId),
		);
		setAlumnoAEliminar(null);
		setShowSuccess(false);
	};

	const handleAgregarPorDni = async () => {
		const dni = dniAgregar.trim();
		if (!dni) return;
		if (asistencia.some((a) => a.dni === dni)) {
			setErrorAgregar("El alumno con ese DNI ya está en la lista.");
			return;
		}
		setIsAddingAlumno(true);
		setErrorAgregar(null);
		try {
			// Buscar en Users
			const qUsers = query(collection(db, "Users"), where("dni", "==", dni));
			const qHijos = query(collection(db, "Hijos"), where("dni", "==", dni));
			const [usersSnap, hijosSnap] = await Promise.all([getDocs(qUsers), getDocs(qHijos)]);

			let found: AsistenciaRecord | null = null;
			if (!usersSnap.empty) {
				const d = usersSnap.docs[0];
				const data = d.data();
				found = {
					alumnoId: d.id,
					nombre: `${data.nombre} ${data.apellido}`.trim(),
					dni: data.dni || dni,
					tipo: "Titular",
					estado: "Presente",
					emailDestino: data.email,
				};
			} else if (!hijosSnap.empty) {
				const d = hijosSnap.docs[0];
				const data = d.data();
				found = {
					alumnoId: d.id,
					nombre: `${data.nombre} ${data.apellido}`.trim(),
					dni: data.dni || dni,
					tipo: "Menor",
					estado: "Presente",
					emailDestino: data.datosTutor?.email,
				};
			}

			if (!found) {
				setErrorAgregar("No se encontró ningún alumno con ese DNI.");
				return;
			}

			setAsistencia((prev) =>
				[...prev, found!].sort((a, b) => a.nombre.localeCompare(b.nombre)),
			);
			setDniAgregar("");
			setShowSuccess(false);
		} catch (err) {
			console.error(err);
			setErrorAgregar("Error al buscar el alumno.");
		} finally {
			setIsAddingAlumno(false);
		}
	};

	const handleGuardar = async () => {
		if (!metadata) return;
		setIsSaving(true);
		setShowSuccess(false);

		try {
			const claseRef = doc(db, "Clases", claseId);
			await updateDoc(claseRef, {
				asistencia: asistencia,
				alumnoIds: asistencia.map((a) => a.alumnoId),
				horaFormateada: hora,
				descripcion: descripcion.trim(),
				actualizadoEn: serverTimestamp(),
			});

			const ausentesHoy = asistencia.filter((a) => a.estado === "Ausente");

			if (ausentesHoy.length > 0) {
				const qPrevClass = query(
					collection(db, "Clases"),
					where("cursoId", "==", metadata.cursoId),
					where("fechaIso", "<", metadata.fechaIso),
					orderBy("fechaIso", "desc"),
					limit(1),
				);

				const prevClassSnap = await getDocs(qPrevClass);

				if (!prevClassSnap.empty) {
					const prevClassData = prevClassSnap.docs[0].data();
					const asistenciaAnterior: AsistenciaRecord[] =
						prevClassData.asistencia || [];

					const ausenciasConsecutivas = ausentesHoy.filter((ausenteHoy) =>
						asistenciaAnterior.some(
							(registroAnterior) =>
								registroAnterior.alumnoId === ausenteHoy.alumnoId &&
								registroAnterior.estado === "Ausente",
						),
					);

					if (ausenciasConsecutivas.length > 0) {
						// Mapeamos al tipo que requiere el nuevo componente
						const alumnosMapeados: AlumnoRiesgo[] = ausenciasConsecutivas.map(
							(a) => ({
								alumnoId: a.alumnoId,
								nombre: a.nombre,
								dni: a.dni,
								emailDestino: a.emailDestino,
							}),
						);

						setAlumnosEnRiesgo(alumnosMapeados);
						setIsAbsenceAlertOpen(true);
						setIsSaving(false);
						return;
					}
				}
			}

			setShowSuccess(true);
			setTimeout(() => setShowSuccess(false), 3000);
		} catch (error) {
			console.error("Error al guardar asistencia:", error);
			alert("Error al guardar. Por favor, intentá de nuevo.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleAlertSuccess = () => {
		setShowSuccess(true);
		setTimeout(() => setShowSuccess(false), 3000);
	};

	const handleDeleteClase = async () => {
		setIsDeleting(true);
		try {
			await deleteDoc(doc(db, "Clases", claseId));
			router.push(`/teachers/curso/${metadata?.cursoId}`);
		} catch (error) {
			console.error("Error al eliminar clase:", error);
			alert("Hubo un error al intentar eliminar esta clase.");
			setIsDeleting(false);
			setIsDeleteDialogOpen(false);
		}
	};

	if (isLoading || !metadata) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
				<Loader2 className="w-10 h-10 animate-spin text-[#4338ca] mb-4" />
				<p className="text-gray-500 font-medium animate-pulse">
					Preparando registro de clase...
				</p>
			</div>
		);
	}

	const presentes = asistencia.filter((a) => a.estado === "Presente").length;
	const tardes = asistencia.filter((a) => a.estado === "Tarde").length;
	const ausentes = asistencia.filter((a) => a.estado === "Ausente").length;

	return (
		<>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				className="space-y-6 pb-24"
			>
				<button
					onClick={() => router.push(`/teachers/curso/${metadata.cursoId}`)}
					className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#4338ca] transition-colors"
				>
					<ArrowLeft className="w-4 h-4" /> Volver al historial
				</button>

				<div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
					<div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
						<div className="flex-1 w-full max-w-xl">
							<div className="flex flex-wrap items-center gap-3 mb-1">
								<h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
									<CalendarDays className="w-5 h-5 text-[#4338ca]" />{" "}
									{metadata.fechaFormateada}
								</h2>

								<div className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1.5 rounded-lg border border-gray-200">
									<Clock className="w-4 h-4 text-gray-500" />
									<input
										type="time"
										value={hora}
										onChange={(e) => {
											setHora(e.target.value);
											setShowSuccess(false);
										}}
										className="bg-transparent text-sm font-bold text-[#4338ca] outline-none w-[70px]"
									/>
								</div>
							</div>
							<p className="text-gray-500 text-sm flex items-center gap-1.5 font-medium mb-4">
								<BookOpen className="w-4 h-4" /> {metadata.cursoNombre}
							</p>

							<div className="w-full mt-2">
								<label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
									<FileText className="w-3.5 h-3.5" /> Tema / Descripción de la
									clase (Opcional)
								</label>
								<input
									type="text"
									value={descripcion}
									onChange={(e) => {
										setDescripcion(e.target.value);
										setShowSuccess(false);
									}}
									placeholder="Ej: Unidad 4, Examen parcial, Actividad especial..."
									className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4338ca]/20 focus:border-[#4338ca] transition-all text-gray-700"
								/>
							</div>
						</div>

						<div className="flex flex-col sm:flex-row items-center gap-3 pt-1 lg:pt-0">
							<div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100 w-full sm:w-auto justify-center">
								<div className="flex flex-col items-center px-2">
									<span className="text-xs font-bold text-gray-400 uppercase">
										Presentes
									</span>
									<span className="text-lg font-black text-green-600">
										{presentes}
									</span>
								</div>
								<div className="w-px h-8 bg-gray-200"></div>
								<div className="flex flex-col items-center px-2">
									<span className="text-xs font-bold text-gray-400 uppercase">
										Tarde
									</span>
									<span className="text-lg font-black text-amber-500">
										{tardes}
									</span>
								</div>
								<div className="w-px h-8 bg-gray-200"></div>
								<div className="flex flex-col items-center px-2">
									<span className="text-xs font-bold text-gray-400 uppercase">
										Ausentes
									</span>
									<span className="text-lg font-black text-red-500">
										{ausentes}
									</span>
								</div>
							</div>

							<Button
								variant="outline"
								onClick={() => setIsDeleteDialogOpen(true)}
								className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-[60px] rounded-xl font-bold"
							>
								<Trash2 className="w-4 h-4 mr-2" /> Eliminar
							</Button>
						</div>
					</div>
				</div>

				{/* Agregar alumno por DNI */}
				<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
					<p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
						<UserPlus className="w-3.5 h-3.5" /> Agregar alumno a la planilla
					</p>
					<div className="flex gap-2">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
							<input
								type="text"
								value={dniAgregar}
								onChange={(e) => { setDniAgregar(e.target.value); setErrorAgregar(null); }}
								onKeyDown={(e) => e.key === "Enter" && handleAgregarPorDni()}
								placeholder="Buscar por DNI..."
								className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338ca]/20 focus:border-[#4338ca] transition-all"
							/>
						</div>
						<Button
							onClick={handleAgregarPorDni}
							disabled={!dniAgregar.trim() || isAddingAlumno}
							className="bg-[#4338ca] hover:bg-[#3730a3] text-white font-bold px-4 rounded-lg disabled:opacity-50"
						>
							{isAddingAlumno ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
						</Button>
					</div>
					{errorAgregar && (
						<p className="text-xs text-red-600 font-semibold mt-2 flex items-center gap-1">
							<AlertTriangle className="w-3.5 h-3.5" /> {errorAgregar}
						</p>
					)}
				</div>

				{/* Lista de Alumnos */}
				<div className="space-y-3">
					{asistencia.length === 0 ? (
						<div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
							<p className="text-gray-500 font-medium">
								No hay alumnos en la planilla. Agregá uno por DNI.
							</p>
						</div>
					) : (
						asistencia.map((alumno) => (
							<div
								key={alumno.alumnoId}
								className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
							>
								<div className="flex items-center gap-3 flex-1 min-w-0">
									<div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-[#4338ca] font-bold shrink-0">
										{alumno.nombre.charAt(0).toUpperCase()}
									</div>
									<div className="min-w-0">
										<p className="font-bold text-gray-900 leading-tight truncate">
											{alumno.nombre}
										</p>
										<p className="text-xs text-gray-500 mt-0.5">
											DNI: {alumno.dni}
										</p>
									</div>
								</div>

								<div className="flex items-center gap-2 w-full md:w-auto">
									<div className="flex items-center flex-1 md:flex-none bg-gray-100 p-1 rounded-lg">
										<button
											onClick={() =>
												handleToggleEstado(alumno.alumnoId, "Presente")
											}
											className={`flex-1 md:w-28 flex justify-center items-center gap-1.5 py-2 px-2 text-xs font-bold rounded-md transition-all ${
												alumno.estado === "Presente"
													? "bg-white text-green-700 shadow-sm ring-1 ring-green-500/50"
													: "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
											}`}
										>
											<UserCheck className="w-3.5 h-3.5" /> Presente
										</button>
										<button
											onClick={() => handleToggleEstado(alumno.alumnoId, "Tarde")}
											className={`flex-1 md:w-24 flex justify-center items-center gap-1.5 py-2 px-2 text-xs font-bold rounded-md transition-all ${
												alumno.estado === "Tarde"
													? "bg-white text-amber-600 shadow-sm ring-1 ring-amber-500/50"
													: "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
											}`}
										>
											<Clock className="w-3.5 h-3.5" /> Tarde
										</button>
										<button
											onClick={() =>
												handleToggleEstado(alumno.alumnoId, "Ausente")
											}
											className={`flex-1 md:w-28 flex justify-center items-center gap-1.5 py-2 px-2 text-xs font-bold rounded-md transition-all ${
												alumno.estado === "Ausente"
													? "bg-white text-red-600 shadow-sm ring-1 ring-red-500/50"
													: "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
											}`}
										>
											<UserX className="w-3.5 h-3.5" /> Ausente
										</button>
									</div>

									{/* Botón eliminar alumno */}
									<button
										onClick={() => setAlumnoAEliminar(alumno)}
										className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
										title="Quitar de la planilla"
									>
										<X className="w-4 h-4" />
									</button>
								</div>
							</div>
						))
					)}
				</div>

				{/* Barra fija inferior para Guardar */}
				{asistencia.length > 0 && (
					<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40">
						<div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
							{showSuccess ? (
								<motion.div
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									className="flex items-center gap-2 text-green-600 font-bold text-sm"
								>
									<CheckCircle2 className="w-5 h-5" /> ¡Guardado!
								</motion.div>
							) : (
								<p className="text-xs text-gray-500 hidden sm:block">
									No olvides guardar los cambios antes de salir.
								</p>
							)}

							<Button
								onClick={handleGuardar}
								disabled={isSaving}
								className="w-full sm:w-auto bg-[#4338ca] hover:bg-[#3730a3] text-white py-6 px-8 rounded-xl font-bold shadow-lg shadow-indigo-200/50 transition-all text-md ml-auto"
							>
								{isSaving ? (
									<Loader2 className="w-5 h-5 animate-spin" />
								) : (
									<>
										<Save className="w-5 h-5 mr-2" /> Guardar Cambios
									</>
								)}
							</Button>
						</div>
					</div>
				)}
			</motion.div>

			<AvisoInasistenciasModal
				isOpen={isAbsenceAlertOpen}
				onOpenChange={setIsAbsenceAlertOpen}
				alumnosEnRiesgo={alumnosEnRiesgo}
				cursoNombre={metadata.cursoNombre}
				onSuccess={handleAlertSuccess}
			/>

			{/* Modal: Confirmar eliminar alumno de la planilla */}
			<Dialog open={!!alumnoAEliminar} onOpenChange={(open) => !open && setAlumnoAEliminar(null)}>
				<DialogContent className="sm:max-w-[420px] rounded-xl z-50">
					<DialogHeader>
						<div className="flex items-center gap-3 mb-2">
							<div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
								<AlertTriangle className="w-5 h-5 text-orange-600" />
							</div>
							<DialogTitle className="text-lg text-gray-900">
								Quitar alumno de la planilla
							</DialogTitle>
						</div>
						<DialogDescription className="text-gray-600 text-sm mt-2">
							¿Segús que querés eliminar a{" "}
							<strong className="text-gray-900">{alumnoAEliminar?.nombre}</strong>
							{" "}de la planilla de asistencia?
							<br /><br />
							Esto no elimina al alumno del curso, solo lo quita de este registro.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="mt-4 gap-2 sm:gap-0">
						<Button
							variant="outline"
							onClick={() => setAlumnoAEliminar(null)}
							className="border-gray-300 text-gray-700 hover:bg-gray-50"
						>
							Cancelar
						</Button>
						<Button
							onClick={handleConfirmarEliminar}
							className="bg-orange-600 hover:bg-orange-700 text-white"
						>
							Sí, quitar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Modal de Confirmación de Borrado */}
			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogContent className="sm:max-w-[425px] rounded-xl z-50">
					<DialogHeader>
						<div className="flex items-center gap-3 mb-2">
							<div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
								<AlertTriangle className="w-5 h-5 text-red-600" />
							</div>
							<DialogTitle className="text-lg text-gray-900">
								Eliminar Clase
							</DialogTitle>
						</div>
						<DialogDescription className="text-gray-600 text-sm mt-2">
							¿Estás seguro de que deseas eliminar esta clase y todo su registro
							de asistencia?
							<br />
							<br />
							<strong className="text-red-600">
								Esta acción es irreversible.
							</strong>
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="mt-4 gap-2 sm:gap-0">
						<Button
							variant="outline"
							onClick={() => setIsDeleteDialogOpen(false)}
							disabled={isDeleting}
							className="border-gray-300 text-gray-700 hover:bg-gray-50"
						>
							Cancelar
						</Button>
						<Button
							onClick={handleDeleteClase}
							disabled={isDeleting}
							className="bg-red-600 hover:bg-red-700 text-white"
						>
							{isDeleting ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								"Sí, eliminar clase"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
