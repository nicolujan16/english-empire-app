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
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
	serverTimestamp,
} from "firebase/firestore";

// ─── INTERFACES ───────────────────────────────────────────────────────────────
type EstadoAsistencia = "Presente" | "Tarde" | "Ausente";

interface AsistenciaRecord {
	alumnoId: string;
	nombre: string;
	dni: string;
	tipo: string;
	estado: EstadoAsistencia;
}

interface ClaseMetadata {
	cursoId: string;
	cursoNombre: string;
	fechaFormateada: string;
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function TomarAsistenciaPage() {
	const params = useParams();
	const router = useRouter();
	const claseId = params.id as string;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [currentUser, setCurrentUser] = useState<User | null>(null);
	const [metadata, setMetadata] = useState<ClaseMetadata | null>(null);

	// El Estado Maestro de Asistencia
	const [asistencia, setAsistencia] = useState<AsistenciaRecord[]>([]);

	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [showSuccess, setShowSuccess] = useState(false);

	// ─── 1. CARGA INICIAL Y CRUCE DE DATOS ────────────────────────────────────
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [claseId]);

	const fetchData = async (profesorId: string) => {
		setIsLoading(true);
		try {
			// 1. Traer la Clase
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

			// 2. Traer el nombre del curso
			const cursoRef = doc(db, "Cursos", cursoId);
			const cursoSnap = await getDoc(cursoRef);
			const cursoNombre = cursoSnap.exists()
				? cursoSnap.data().nombre
				: "Curso Desconocido";

			setMetadata({
				cursoId,
				cursoNombre,
				fechaFormateada: dataClase.fechaFormateada,
			});

			// 3. Traer alumnos activos actualmente en el curso (Titulares y Menores)
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

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const activeStudents: any[] = [];
			usersSnap.forEach((d) =>
				activeStudents.push({ id: d.id, tipo: "Titular", ...d.data() }),
			);
			hijosSnap.forEach((d) =>
				activeStudents.push({ id: d.id, tipo: "Menor", ...d.data() }),
			);

			// 4. CRUCE DE DATOS (La magia Senior)
			// Mapeamos los alumnos activos. Si ya estaban en la asistencia guardada, respetamos su estado. Si no, "Presente".
			const currentRecords: AsistenciaRecord[] = activeStudents.map(
				(student) => {
					const registroPrevio = asistenciaGuardada.find(
						(a) => a.alumnoId === student.id,
					);
					return {
						alumnoId: student.id,
						nombre: `${student.nombre} ${student.apellido}`.trim(),
						dni: student.dni || "Sin DNI",
						tipo: student.tipo,
						estado: registroPrevio ? registroPrevio.estado : "Presente",
					};
				},
			);

			// Buscamos alumnos que estén en la asistencia guardada pero YA NO estén activos (se dieron de baja)
			const droppedRecords = asistenciaGuardada.filter(
				(a) => !activeStudents.some((s) => s.id === a.alumnoId),
			);

			// Combinamos y ordenamos alfabéticamente
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

	// ─── 2. MANEJADORES DE ESTADO ─────────────────────────────────────────────
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
		setShowSuccess(false); // Ocultar mensaje de éxito si cambian algo nuevo
	};

	const handleGuardar = async () => {
		setIsSaving(true);
		setShowSuccess(false);
		try {
			const claseRef = doc(db, "Clases", claseId);

			// Una sola escritura atómica en Firebase
			await updateDoc(claseRef, {
				asistencia: asistencia,
				alumnoIds: asistencia.map((a) => a.alumnoId),
				actualizadoEn: serverTimestamp(),
			});

			setShowSuccess(true);
			// Ocultar el mensaje de éxito después de 3 segundos
			setTimeout(() => setShowSuccess(false), 3000);
		} catch (error) {
			console.error("Error al guardar asistencia:", error);
			alert("Error al guardar. Por favor, intentá de nuevo.");
		} finally {
			setIsSaving(false);
		}
	};

	// ─── RENDER ───────────────────────────────────────────────────────────────
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

	// Contadores para UI
	const presentes = asistencia.filter((a) => a.estado === "Presente").length;
	const tardes = asistencia.filter((a) => a.estado === "Tarde").length;
	const ausentes = asistencia.filter((a) => a.estado === "Ausente").length;

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="space-y-6 pb-24"
		>
			{/* Navegación y Header */}
			<button
				onClick={() => router.push(`/teachers/curso/${metadata.cursoId}`)}
				className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#4338ca] transition-colors"
			>
				<ArrowLeft className="w-4 h-4" /> Volver al historial
			</button>

			<div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<h2 className="text-xl font-black text-gray-900 flex items-center gap-2 mb-1">
							<CalendarDays className="w-5 h-5 text-[#4338ca]" />{" "}
							{metadata.fechaFormateada}
						</h2>
						<p className="text-gray-500 text-sm flex items-center gap-1.5 font-medium">
							<BookOpen className="w-4 h-4" /> {metadata.cursoNombre}
						</p>
					</div>

					{/* Minibar de estadísticas */}
					<div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
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
				</div>
			</div>

			{/* Lista de Alumnos */}
			<div className="space-y-3">
				{asistencia.length === 0 ? (
					<div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
						<p className="text-gray-500 font-medium">
							No hay alumnos inscritos en este curso.
						</p>
					</div>
				) : (
					asistencia.map((alumno) => (
						<div
							key={alumno.alumnoId}
							className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
						>
							{/* Info Alumno */}
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-[#4338ca] font-bold shrink-0">
									{alumno.nombre.charAt(0).toUpperCase()}
								</div>
								<div>
									<p className="font-bold text-gray-900 leading-tight">
										{alumno.nombre}
									</p>
									<p className="text-xs text-gray-500 mt-0.5">
										DNI: {alumno.dni}
									</p>
								</div>
							</div>

							{/* Segmented Control (Botones de Asistencia) */}
							<div className="flex items-center w-full md:w-auto bg-gray-100 p-1 rounded-lg">
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
									onClick={() => handleToggleEstado(alumno.alumnoId, "Ausente")}
									className={`flex-1 md:w-28 flex justify-center items-center gap-1.5 py-2 px-2 text-xs font-bold rounded-md transition-all ${
										alumno.estado === "Ausente"
											? "bg-white text-red-600 shadow-sm ring-1 ring-red-500/50"
											: "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
									}`}
								>
									<UserX className="w-3.5 h-3.5" /> Ausente
								</button>
							</div>
						</div>
					))
				)}
			</div>

			{/* Barra fija inferior para Guardar */}
			{asistencia.length > 0 && (
				<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
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
									<Save className="w-5 h-5 mr-2" /> Guardar Registro
								</>
							)}
						</Button>
					</div>
				</div>
			)}
		</motion.div>
	);
}
