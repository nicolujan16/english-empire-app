/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
	ArrowLeft,
	Loader2,
	PlusCircle,
	CalendarDays,
	Users,
	BookOpen,
	ChevronRight,
	History,
	X,
	CalendarPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { auth, db } from "@/lib/firebaseConfig";
import { onAuthStateChanged, User } from "firebase/auth";
import {
	doc,
	getDoc,
	setDoc,
	collection,
	query,
	where,
	getDocs,
	serverTimestamp,
	orderBy,
} from "firebase/firestore";

interface ClaseData {
	id: string;
	fecha: string;
	asistentesCount: number;
}

export default function CursoDetallePage() {
	const params = useParams();
	const router = useRouter();
	const cursoId = params.id as string;

	const [currentUser, setCurrentUser] = useState<User | null>(null);
	const [cursoNombre, setCursoNombre] = useState<string>("");
	const [clases, setClases] = useState<ClaseData[]>([]);

	const [isLoading, setIsLoading] = useState(true);
	const [isCreating, setIsCreating] = useState(false);

	// ─── Estado para el modal de fecha pasada ────────────────────────────────
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [fechaPasadaSeleccionada, setFechaPasadaSeleccionada] = useState("");

	// ─── Helpers ──────────────────────────────────────────────────────────────

	/** Devuelve "YYYY-MM-DD" para una fecha dada */
	const toFechaCorta = (date: Date): string => {
		const yyyy = date.getFullYear();
		const mm = String(date.getMonth() + 1).padStart(2, "0");
		const dd = String(date.getDate()).padStart(2, "0");
		return `${yyyy}-${mm}-${dd}`;
	};

	/**
	 * Genera el próximo ID disponible para una fecha dada.
	 *
	 * Lógica de IDs (backward-compatible con clases ya creadas sin sufijo):
	 *   1ª clase del día  →  cursoId_YYYY-MM-DD          (sin sufijo)
	 *   2ª clase del día  →  cursoId_YYYY-MM-DD_2
	 *   3ª clase del día  →  cursoId_YYYY-MM-DD_3
	 *   …y así sucesivamente
	 */
	const getNextClaseId = async (fechaCorta: string): Promise<string> => {
		const baseId = `${cursoId}_${fechaCorta}`;

		// Primero intentamos el ID base (sin sufijo)
		const baseSnap = await getDoc(doc(db, "Clases", baseId));
		if (!baseSnap.exists()) return baseId;

		// Ya existe una clase ese día → buscamos sufijo libre desde _2
		let suffix = 2;
		while (true) {
			const candidateId = `${baseId}_${suffix}`;
			const snap = await getDoc(doc(db, "Clases", candidateId));
			if (!snap.exists()) return candidateId;
			suffix++;
		}
	};

	/** Crea el documento de la clase y redirige */
	const crearClase = async (date: Date) => {
		if (!currentUser) return;
		setIsCreating(true);

		try {
			const fechaCorta = toFechaCorta(date);
			const claseId = await getNextClaseId(fechaCorta);

			const fechaFormateada = date.toLocaleDateString("es-AR", {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
			});

			await setDoc(doc(db, "Clases", claseId), {
				cursoId,
				profesorId: currentUser.uid,
				fechaIso: date.toISOString(),
				fechaCorta,
				fechaFormateada:
					fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1),
				asistencia: [],
				creadoEn: serverTimestamp(),
			});

			router.push(`/teachers/clase/${claseId}`);
		} catch (error) {
			console.error("Error creando clase:", error);
			alert("Hubo un error al iniciar la clase.");
			setIsCreating(false);
		}
	};

	// ─── Handlers públicos ────────────────────────────────────────────────────

	/** Botón "Iniciar Clase Hoy" */
	const handleCrearClaseHoy = async () => {
		await crearClase(new Date());
	};

	/** Botón "Confirmar" en el modal de fecha pasada */
	const handleCrearClasePasada = async () => {
		if (!fechaPasadaSeleccionada) return;
		// Parseamos la fecha sin problema de timezone: YYYY-MM-DD → new Date(year, month-1, day)
		const [yyyy, mm, dd] = fechaPasadaSeleccionada.split("-").map(Number);
		const date = new Date(yyyy, mm - 1, dd);
		setShowDatePicker(false);
		await crearClase(date);
	};

	// ─── Carga de datos ───────────────────────────────────────────────────────

	const fetchCursoData = async (profesorId: string) => {
		setIsLoading(true);
		try {
			const cursoRef = doc(db, "Cursos", cursoId);
			const cursoSnap = await getDoc(cursoRef);

			if (!cursoSnap.exists() || cursoSnap.data().profesorId !== profesorId) {
				alert("Acceso denegado o curso no encontrado.");
				router.push("/teachers");
				return;
			}
			setCursoNombre(cursoSnap.data().nombre);

			const clasesQuery = query(
				collection(db, "Clases"),
				where("cursoId", "==", cursoId),
				orderBy("fechaIso", "desc"),
			);

			const clasesSnap = await getDocs(clasesQuery);
			const clasesHistorial: ClaseData[] = clasesSnap.docs.map((d) => {
				const data = d.data();
				return {
					id: d.id,
					fecha: data.fechaFormateada || "Fecha desconocida",
					// > 0 significa que la lista fue tomada al menos parcialmente
					asistentesCount: data.asistencia ? data.asistencia.length : 0,
				};
			});

			setClases(clasesHistorial);
		} catch (error) {
			console.error("Error cargando el curso:", error);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, async (user) => {
			if (user) {
				setCurrentUser(user);
				await fetchCursoData(user.uid);
			} else {
				router.push("/teachers");
			}
		});
		return () => unsubscribe();
	}, [cursoId]);

	// ─── RENDER ───────────────────────────────────────────────────────────────
	if (isLoading) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
				<Loader2 className="w-10 h-10 animate-spin text-[#4338ca] mb-4" />
				<p className="text-gray-500 font-medium animate-pulse">
					Cargando curso...
				</p>
			</div>
		);
	}

	// Fecha máxima para el date picker = ayer (no queremos que creen una "clase pasada" de hoy)
	const ayerISO = toFechaCorta(new Date(Date.now() - 86400000));

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="space-y-6"
		>
			{/* Botón Volver */}
			<button
				onClick={() => router.push("/teachers")}
				className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#4338ca] transition-colors"
			>
				<ArrowLeft className="w-4 h-4" /> Volver al Dashboard
			</button>

			{/* Header del Curso */}
			<div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
				<div>
					<div className="flex items-center gap-3 mb-2">
						<div className="bg-indigo-50 p-2 rounded-lg">
							<BookOpen className="w-5 h-5 text-[#4338ca]" />
						</div>
						<h2 className="text-2xl font-black text-gray-900">{cursoNombre}</h2>
					</div>
					<p className="text-gray-500 text-sm ml-12">
						Gestión de clases y asistencia
					</p>
				</div>

				{/* Botones de acción */}
				<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
					{/* Botón fecha pasada */}
					<Button
						variant="outline"
						onClick={() => {
							setFechaPasadaSeleccionada(ayerISO);
							setShowDatePicker(true);
						}}
						disabled={isCreating}
						className="border-indigo-200 text-[#4338ca] hover:bg-indigo-50 rounded-xl font-bold py-6"
					>
						<History className="w-4 h-4 mr-2" /> Clase de fecha pasada
					</Button>

					{/* Botón clase de hoy */}
					<Button
						onClick={handleCrearClaseHoy}
						disabled={isCreating}
						className="bg-[#4338ca] hover:bg-[#3730a3] text-white py-6 px-6 rounded-xl font-bold shadow-md transition-all text-md"
					>
						{isCreating ? (
							<Loader2 className="w-5 h-5 animate-spin" />
						) : (
							<>
								<PlusCircle className="w-5 h-5 mr-2" /> Iniciar Clase Hoy
							</>
						)}
					</Button>
				</div>
			</div>

			{/* ── Modal de fecha pasada ── */}
			<AnimatePresence>
				{showDatePicker && (
					<motion.div
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						className="bg-white border border-indigo-100 shadow-lg rounded-2xl p-6"
					>
						<div className="flex items-start justify-between mb-4">
							<div>
								<h3 className="font-bold text-gray-900 flex items-center gap-2">
									<CalendarPlus className="w-5 h-5 text-[#4338ca]" />
									Registrar clase de fecha pasada
								</h3>
								<p className="text-sm text-gray-500 mt-0.5">
									Si el día ya tiene una clase registrada, se creará una segunda
									para ese día.
								</p>
							</div>
							<button
								onClick={() => setShowDatePicker(false)}
								className="text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
							<input
								type="date"
								value={fechaPasadaSeleccionada}
								max={ayerISO} // No permite seleccionar hoy ni el futuro
								onChange={(e) => setFechaPasadaSeleccionada(e.target.value)}
								className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#4338ca]/20 focus:border-[#4338ca] outline-none transition-all text-gray-800 font-medium"
							/>
							<Button
								onClick={handleCrearClasePasada}
								disabled={!fechaPasadaSeleccionada || isCreating}
								className="bg-[#4338ca] hover:bg-[#3730a3] text-white py-3 px-6 rounded-xl font-bold shadow-md transition-all"
							>
								{isCreating ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									"Crear clase"
								)}
							</Button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Historial de Clases */}
			<div>
				<h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 px-1">
					<CalendarDays className="w-5 h-5 text-[#4338ca]" /> Historial de
					Clases
				</h3>

				{clases.length === 0 ? (
					<div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
						<p className="text-gray-500 font-medium">
							Aún no has registrado ninguna clase.
						</p>
						<p className="text-sm text-gray-400 mt-1">
							Hacé clic en el botón de arriba para iniciar tu primera clase.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{clases.map((clase, idx) => (
							<motion.div
								key={clase.id}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: idx * 0.05 }}
								onClick={() => router.push(`/teachers/clase/${clase.id}`)}
								className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all p-5 flex items-center justify-between cursor-pointer group"
							>
								<div>
									<p className="font-bold text-gray-900 text-md mb-1 group-hover:text-[#4338ca] transition-colors">
										{clase.fecha}
									</p>
									<p className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
										<Users className="w-3.5 h-3.5" />
										{clase.asistentesCount === 0
											? "Lista sin tomar"
											: `${clase.asistentesCount} alumnos en el registro`}
									</p>
								</div>
								<div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
									<ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#4338ca]" />
								</div>
							</motion.div>
						))}
					</div>
				)}
			</div>
		</motion.div>
	);
}
