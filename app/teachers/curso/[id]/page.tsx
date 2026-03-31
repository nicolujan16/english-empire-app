/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect, useMemo } from "react";
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
	Clock,
	FileText,
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
	fechaIso: string;
	horaFormateada: string;
	asistentesCount: number;
	descripcion?: string;
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

	const [showDatePicker, setShowDatePicker] = useState(false);
	const [fechaPasadaSeleccionada, setFechaPasadaSeleccionada] = useState("");
	const [horaPasadaSeleccionada, setHoraPasadaSeleccionada] = useState("12:00");

	// ─── LÓGICA DE CARGA Y AUTORIZACIÓN (ACTUALIZADA) ──────────────────────────

	const fetchCursoData = async (profesorId: string) => {
		setIsLoading(true);
		try {
			const teacherRef = doc(db, "Teachers", profesorId);
			const teacherSnap = await getDoc(teacherRef);

			if (!teacherSnap.exists()) {
				alert("Perfil de profesor no encontrado.");
				router.push("/teachers");
				return;
			}

			const teacherData = teacherSnap.data();
			const tieneAcceso = (teacherData.cursosAsignados || []).includes(cursoId);

			if (!tieneAcceso || teacherData.activo === false) {
				alert("No tienes autorización para acceder a este curso.");
				router.push("/teachers");
				return;
			}

			const cursoRef = doc(db, "Cursos", cursoId);
			const cursoSnap = await getDoc(cursoRef);

			if (!cursoSnap.exists()) {
				alert("El curso no existe.");
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
				const fallbackHora = new Date(
					data.fechaIso || new Date(),
				).toLocaleTimeString("es-AR", {
					hour: "2-digit",
					minute: "2-digit",
					hour12: false,
				});

				return {
					id: d.id,
					fecha: data.fechaFormateada || "Fecha desconocida",
					fechaIso: data.fechaIso || new Date().toISOString(),
					horaFormateada: data.horaFormateada || fallbackHora,
					asistentesCount: data.asistencia ? data.asistencia.length : 0,
					descripcion: data.descripcion || "",
				};
			});

			setClases(clasesHistorial);
		} catch (error) {
			console.error("Error cargando el curso:", error);
			alert("Error al cargar los datos.");
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

	// ─── EL RESTO DE TUS HELPERS Y LOGICA (INALTERADOS) ────────────────────────

	const toFechaCorta = (date: Date): string => {
		const yyyy = date.getFullYear();
		const mm = String(date.getMonth() + 1).padStart(2, "0");
		const dd = String(date.getDate()).padStart(2, "0");
		return `${yyyy}-${mm}-${dd}`;
	};

	const getNextClaseId = async (fechaCorta: string): Promise<string> => {
		const baseId = `${cursoId}_${fechaCorta}`;
		const baseSnap = await getDoc(doc(db, "Clases", baseId));
		if (!baseSnap.exists()) return baseId;
		let suffix = 2;
		while (true) {
			const candidateId = `${baseId}_${suffix}`;
			const snap = await getDoc(doc(db, "Clases", candidateId));
			if (!snap.exists()) return candidateId;
			suffix++;
		}
	};

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
			const horaFormateada = date.toLocaleTimeString("es-AR", {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			});
			await setDoc(doc(db, "Clases", claseId), {
				cursoId,
				profesorId: currentUser.uid,
				fechaIso: date.toISOString(),
				fechaCorta,
				fechaFormateada:
					fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1),
				horaFormateada,
				descripcion: "",
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

	const handleCrearClaseHoy = async () => await crearClase(new Date());

	const handleCrearClasePasada = async () => {
		if (!fechaPasadaSeleccionada || !horaPasadaSeleccionada) return;
		const [yyyy, mm, dd] = fechaPasadaSeleccionada.split("-").map(Number);
		const [hh, min] = horaPasadaSeleccionada.split(":").map(Number);
		const date = new Date(yyyy, mm - 1, dd, hh, min);
		setShowDatePicker(false);
		await crearClase(date);
	};

	const timelineData = useMemo(() => {
		const mesesMap: Record<
			string,
			{ ordenDias: string[]; diasMap: Record<string, ClaseData[]> }
		> = {};
		const ordenMeses: string[] = [];
		clases.forEach((clase) => {
			const date = new Date(clase.fechaIso);
			const mesAnio = date.toLocaleDateString("es-AR", {
				month: "long",
				year: "numeric",
			});
			const mesAnioCapitalized =
				mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1);
			const diaExacto = clase.fecha;
			if (!mesesMap[mesAnioCapitalized]) {
				mesesMap[mesAnioCapitalized] = { ordenDias: [], diasMap: {} };
				ordenMeses.push(mesAnioCapitalized);
			}
			if (!mesesMap[mesAnioCapitalized].diasMap[diaExacto]) {
				mesesMap[mesAnioCapitalized].diasMap[diaExacto] = [];
				mesesMap[mesAnioCapitalized].ordenDias.push(diaExacto);
			}
			mesesMap[mesAnioCapitalized].diasMap[diaExacto].push(clase);
		});
		return ordenMeses.map((mes) => ({
			mes,
			dias: mesesMap[mes].ordenDias.map((dia) => ({
				fecha: dia,
				clases: mesesMap[mes].diasMap[dia],
			})),
		}));
	}, [clases]);

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

	const ayerISO = toFechaCorta(new Date(Date.now() - 86400000));

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="space-y-6"
		>
			<button
				onClick={() => router.push("/teachers")}
				className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#4338ca] transition-colors"
			>
				<ArrowLeft className="w-4 h-4" /> Volver al Dashboard
			</button>

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

				<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
					<Button
						variant="outline"
						onClick={() => {
							setFechaPasadaSeleccionada(ayerISO);
							setHoraPasadaSeleccionada("12:00");
							setShowDatePicker(true);
						}}
						disabled={isCreating}
						className="border-indigo-200 text-[#4338ca] hover:bg-indigo-50 rounded-xl font-bold py-6"
					>
						<History className="w-4 h-4 mr-2" /> Clase de fecha pasada
					</Button>

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
									<CalendarPlus className="w-5 h-5 text-[#4338ca]" /> Registrar
									clase pasada
								</h3>
								<p className="text-sm text-gray-500 mt-0.5">
									Seleccioná el día y la hora aproximada de inicio de la clase.
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
							<div className="flex flex-1 gap-2 flex-wrap">
								<input
									type="date"
									value={fechaPasadaSeleccionada}
									max={ayerISO}
									onChange={(e) => setFechaPasadaSeleccionada(e.target.value)}
									className="w-2/3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none transition-all text-gray-800 font-medium"
								/>
								<input
									type="time"
									value={horaPasadaSeleccionada}
									onChange={(e) => setHoraPasadaSeleccionada(e.target.value)}
									className="w-1/3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none transition-all text-gray-800 font-medium"
								/>
							</div>
							<Button
								onClick={handleCrearClasePasada}
								disabled={
									!fechaPasadaSeleccionada ||
									!horaPasadaSeleccionada ||
									isCreating
								}
								className="bg-[#4338ca] hover:bg-[#3730a3] text-white py-3 px-6 rounded-xl font-bold shadow-md transition-all h-auto"
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

			<div>
				<h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 px-1">
					<CalendarDays className="w-5 h-5 text-[#4338ca]" /> Historial de
					Clases
				</h3>
				{timelineData.length === 0 ? (
					<div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
						<p className="text-gray-500 font-medium">
							Aún no has registrado ninguna clase.
						</p>
						<p className="text-sm text-gray-400 mt-1">
							Hacé clic en el botón de arriba para iniciar tu primera clase.
						</p>
					</div>
				) : (
					<div className="space-y-10">
						{timelineData.map((grupoMes, mIdx) => (
							<div key={grupoMes.mes} className="space-y-6">
								<div className="flex items-center gap-4">
									<div className="h-px bg-indigo-200 flex-1"></div>
									<span className="text-xs font-black text-indigo-800 uppercase tracking-widest bg-indigo-50 px-5 py-2 rounded-full border border-indigo-100 shadow-sm">
										{grupoMes.mes}
									</span>
									<div className="h-px bg-indigo-200 flex-1"></div>
								</div>
								<div className="relative border-l-2 border-gray-200 ml-4 sm:ml-8 pl-6 sm:pl-8 space-y-8 pb-4">
									{grupoMes.dias.map((grupoDia, dIdx) => (
										<div key={grupoDia.fecha} className="relative">
											<div className="absolute -left-[31px] sm:-left-[39px] top-1 w-3.5 h-3.5 bg-gray-300 rounded-full border-2 border-white ring-4 ring-gray-50/50"></div>
											<h4 className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
												{grupoDia.fecha}
											</h4>
											<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
												{grupoDia.clases.map((clase, cIdx) => (
													<motion.div
														key={clase.id}
														initial={{ opacity: 0, y: 10 }}
														animate={{ opacity: 1, y: 0 }}
														transition={{
															delay: mIdx * 0.1 + dIdx * 0.05 + cIdx * 0.02,
														}}
														onClick={() =>
															router.push(`/teachers/clase/${clase.id}`)
														}
														className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-300 hover:ring-2 hover:ring-indigo-50 transition-all p-4 flex flex-col justify-between cursor-pointer group h-full relative"
													>
														<div className="flex justify-between items-start gap-2 mb-2">
															<div className="flex items-center gap-2">
																<p className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
																	<Clock className="w-3.5 h-3.5" />
																	{clase.horaFormateada} hs
																</p>
																<p className="flex items-center gap-1.5 text-xs text-gray-500 font-medium bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
																	<Users className="w-3.5 h-3.5 text-gray-400" />
																	{clase.asistentesCount} pres.
																</p>
															</div>
															<div className="w-6 h-6 rounded-full bg-gray-50 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
																<ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#4338ca]" />
															</div>
														</div>
														<div>
															<p className="font-bold text-[#252d62] text-sm mt-1">
																Ver registro de asistencia
															</p>
															<div className="flex items-center justify-between mt-1">
																<p className="text-[10px] text-gray-400 font-mono uppercase">
																	ID: {clase.id.split("_").pop()}
																</p>
																{clase.descripcion && (
																	<div className="relative group/tooltip flex items-center justify-center cursor-help">
																		<FileText className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
																		<div className="absolute bottom-full right-0 md:left-1/2 md:-translate-x-1/2 mb-2 w-48 sm:w-56 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-20 pointer-events-none shadow-xl">
																			<p className="font-bold text-indigo-300 mb-1">
																				Tema de la clase:
																			</p>
																			<p className="leading-snug">
																				{clase.descripcion}
																			</p>
																			<div className="absolute top-full right-2 md:left-1/2 md:-translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
																		</div>
																	</div>
																)}
															</div>
														</div>
													</motion.div>
												))}
											</div>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</motion.div>
	);
}
