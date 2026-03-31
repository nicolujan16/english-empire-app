/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import {
	Loader2,
	ChevronLeft,
	CalendarDays,
	UserCheck,
	UserX,
	Clock,
	BookOpen,
	FileText,
	Bell,
	AlertTriangle,
	CheckCircle2,
} from "lucide-react";
import { StudentDetails } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

// ─── Tipos e Interfaces ───────────────────────────────────────────────────────

type EstadoAsistencia = "Presente" | "Tarde" | "Ausente";

interface AsistenciaEvento {
	idUnico: string;
	claseId: string;
	cursoId: string;
	cursoNombre: string;
	fechaIso: string;
	fechaFormateada: string;
	horaFormateada: string;
	alumnoId: string;
	alumnoNombre: string;
	estado: EstadoAsistencia;
	descripcion?: string;
}

type FiltroEstado = "todas" | "Presente" | "Tarde" | "Ausente";

interface AlertaDesercionUsuario {
	idUnico: string;
	cursoNombre: string;
	alumnoNombre: string;
	isRead: boolean;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function AsistenciasPage() {
	const router = useRouter();
	const { user, userData, isLoading: authLoading } = useAuth();

	const [eventos, setEventos] = useState<AsistenciaEvento[]>([]);
	const [cursosMap, setCursosMap] = useState<Record<string, string>>({});
	const [isLoading, setIsLoading] = useState(true);

	const [filtroAlumnoId, setFiltroAlumnoId] = useState<string>("todos");
	const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todas");

	const [alertas, setAlertas] = useState<AlertaDesercionUsuario[]>([]);
	const [isAlertsOpen, setIsAlertsOpen] = useState(false);

	// ─── Seguridad y Redirección ───
	useEffect(() => {
		if (!authLoading && !user) router.push("/iniciar-sesion");
	}, [user, authLoading, router]);

	// ─── Carga de Datos ───
	useEffect(() => {
		const fetchData = async () => {
			if (!user || !userData) return;
			setIsLoading(true);

			try {
				const alumnoIds: string[] = [user.uid];
				userData.hijos?.forEach((hijo: StudentDetails) => {
					if (hijo.id) alumnoIds.push(String(hijo.id));
				});

				const cursosSnap = await getDocs(collection(db, "Cursos"));
				const mapCursos: Record<string, string> = {};
				cursosSnap.forEach((doc) => {
					mapCursos[doc.id] = doc.data().nombre;
				});
				setCursosMap(mapCursos);

				const promesasClases = alumnoIds.map((alumnoId) => {
					const q = query(
						collection(db, "Clases"),
						where("alumnoIds", "array-contains", alumnoId),
					);
					return getDocs(q);
				});

				const snapsClases = await Promise.all(promesasClases);
				const eventosAplanados: AsistenciaEvento[] = [];

				snapsClases.forEach((snap, index) => {
					const alumnoIdActual = alumnoIds[index];

					snap.forEach((docClase) => {
						const dataClase = docClase.data();
						const registrosAsistencia: any[] = dataClase.asistencia || [];

						const registroAlumno = registrosAsistencia.find(
							(r) => r.alumnoId === alumnoIdActual,
						);

						if (registroAlumno) {
							const fallbackHora = new Date(
								dataClase.fechaIso || new Date(),
							).toLocaleTimeString("es-AR", {
								hour: "2-digit",
								minute: "2-digit",
								hour12: false,
							});

							eventosAplanados.push({
								idUnico: `${docClase.id}-${alumnoIdActual}`,
								claseId: docClase.id,
								cursoId: dataClase.cursoId,
								cursoNombre: mapCursos[dataClase.cursoId] || dataClase.cursoId,
								fechaIso: dataClase.fechaIso || new Date().toISOString(),
								fechaFormateada:
									dataClase.fechaFormateada || dataClase.fechaCorta,
								horaFormateada: dataClase.horaFormateada || fallbackHora,
								alumnoId: alumnoIdActual,
								alumnoNombre: registroAlumno.nombre,
								estado: registroAlumno.estado as EstadoAsistencia,
								descripcion: dataClase.descripcion || "",
							});
						}
					});
				});

				eventosAplanados.sort((a, b) => {
					const dateA = new Date(a.fechaIso).getTime();
					const dateB = new Date(b.fechaIso).getTime();
					return dateB - dateA;
				});

				setEventos(eventosAplanados);

				const alertasTemp: AlertaDesercionUsuario[] = [];
				const fechaLimite = new Date();
				fechaLimite.setDate(fechaLimite.getDate() - 45);
				const limiteIso = fechaLimite.toISOString();

				const agrupados: Record<string, AsistenciaEvento[]> = {};
				eventosAplanados.forEach((e) => {
					const key = `${e.cursoId}_${e.alumnoId}`;
					if (!agrupados[key]) agrupados[key] = [];
					agrupados[key].push(e);
				});

				Object.values(agrupados).forEach((eventosDelGrupo) => {
					if (eventosDelGrupo.length >= 2) {
						const ultimaClase = eventosDelGrupo[0];
						const penultimaClase = eventosDelGrupo[1];

						if (ultimaClase.fechaIso >= limiteIso) {
							if (
								ultimaClase.estado === "Ausente" &&
								penultimaClase.estado === "Ausente"
							) {
								const alertId = `user_read_alert_${ultimaClase.cursoId}_${ultimaClase.alumnoId}_${ultimaClase.claseId}`;
								const isRead = localStorage.getItem(alertId) === "true";

								alertasTemp.push({
									idUnico: alertId,
									cursoNombre: ultimaClase.cursoNombre,
									alumnoNombre: ultimaClase.alumnoNombre,
									isRead,
								});
							}
						}
					}
				});

				alertasTemp.sort((a, b) =>
					a.isRead === b.isRead ? 0 : a.isRead ? 1 : -1,
				);
				setAlertas(alertasTemp);
			} catch (error) {
				console.error("Error al cargar asistencias:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, [user, userData]);

	// ─── Handlers Notificaciones ───
	const unreadCount = alertas.filter((a) => !a.isRead).length;

	const handleMarkAsRead = (idUnico: string) => {
		localStorage.setItem(idUnico, "true");
		setAlertas((prev) =>
			prev.map((alerta) =>
				alerta.idUnico === idUnico ? { ...alerta, isRead: true } : alerta,
			),
		);
	};

	const handleMarkAllAsRead = () => {
		alertas.forEach((alerta) => {
			if (!alerta.isRead) {
				localStorage.setItem(alerta.idUnico, "true");
			}
		});
		setAlertas((prev) => prev.map((a) => ({ ...a, isRead: true })));
	};

	// ─── Filtros ───
	const listaAlumnos = useMemo(() => {
		if (!user || !userData) return [];
		const alumnos = [
			{ id: user.uid, nombre: `Mis clases (${userData.nombre})` },
		];
		userData.hijos?.forEach((hijo: StudentDetails) => {
			if (hijo.id) alumnos.push({ id: String(hijo.id), nombre: hijo.nombre });
		});
		return alumnos;
	}, [user, userData]);

	const eventosFiltrados = eventos.filter((e) => {
		const pasaFiltroAlumno =
			filtroAlumnoId === "todos" || e.alumnoId === filtroAlumnoId;
		const pasaFiltroEstado =
			filtroEstado === "todas" || e.estado === filtroEstado;
		return pasaFiltroAlumno && pasaFiltroEstado;
	});

	const eventosAgrupados = useMemo(() => {
		const grupos: Record<string, AsistenciaEvento[]> = {};
		const ordenFechas: string[] = [];

		eventosFiltrados.forEach((evento) => {
			if (!grupos[evento.fechaFormateada]) {
				grupos[evento.fechaFormateada] = [];
				ordenFechas.push(evento.fechaFormateada);
			}
			grupos[evento.fechaFormateada].push(evento);
		});

		return ordenFechas.map((fecha) => ({
			fechaFormateada: fecha,
			eventos: grupos[fecha],
		}));
	}, [eventosFiltrados]);

	// ─── Render ───
	if (authLoading || isLoading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
				<Loader2 className="w-10 h-10 animate-spin text-[#252d62]" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8">
			<div className="max-w-7xl mx-auto px-4 md:px-6 space-y-6">
				{/* Header y Notificaciones */}
				<div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
					<div>
						<button
							onClick={() => router.push("/mi-cuenta")}
							className="flex items-center gap-1.5 text-sm text-[#252d62] transition-colors mb-3 group cursor-pointer"
						>
							<ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
							Volver al panel de usuario
						</button>
						<h1 className="text-3xl md:text-4xl font-bold text-[#1a237e] mb-1">
							Mis Asistencias
						</h1>
						<p className="text-gray-600">
							Revisá el registro de presentes y ausentes a las clases.
						</p>
					</div>

					{/* 🚀 BOTÓN DE CAMPANITA Y DROPDOWN */}
					<div className="relative z-50">
						<button
							onClick={() => setIsAlertsOpen(!isAlertsOpen)}
							className={`relative p-3 rounded-xl border transition-all ${
								isAlertsOpen
									? "bg-indigo-50 border-indigo-200 text-indigo-600"
									: unreadCount > 0
										? "bg-white border-gray-200 hover:bg-gray-50 text-[#252d62] shadow-sm"
										: "bg-white border-gray-200 text-gray-400 hover:bg-gray-50 shadow-sm"
							}`}
						>
							<Bell className="w-5 h-5" />
							{unreadCount > 0 && (
								<span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
									{unreadCount}
								</span>
							)}
						</button>

						{/* Overlay invisible */}
						{isAlertsOpen && (
							<div
								className="fixed inset-0 z-40"
								onClick={() => setIsAlertsOpen(false)}
							></div>
						)}

						{/* 🚀 CAJA DE NOTIFICACIONES */}
						<AnimatePresence>
							{isAlertsOpen && (
								<motion.div
									initial={{ opacity: 0, y: 10, scale: 0.95 }}
									animate={{ opacity: 1, y: 0, scale: 1 }}
									exit={{ opacity: 0, y: 10, scale: 0.95 }}
									transition={{ duration: 0.15 }}
									className="absolute right-0 top-full mt-2 w-[320px] sm:w-[380px] max-w-[calc(100vw-2rem)] bg-white shadow-2xl shadow-gray-900/10 border border-gray-200 rounded-2xl overflow-hidden z-50 flex flex-col"
								>
									<div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
										<h3 className="font-bold text-gray-900">
											Avisos del Instituto
										</h3>
										{unreadCount > 0 && (
											<span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
												{unreadCount} nuevos
											</span>
										)}
									</div>

									<div className="max-h-[380px] overflow-y-auto">
										{alertas.length === 0 ? (
											<div className="p-8 text-center text-gray-500">
												<CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
												<p className="text-sm">
													Todo en orden. No tenés avisos de inasistencia.
												</p>
											</div>
										) : (
											<div className="flex flex-col divide-y divide-gray-100">
												{alertas.map((alerta) => (
													<div
														key={alerta.idUnico}
														className={`p-4 transition-colors ${
															alerta.isRead
																? "bg-white border-l-4 border-l-gray-200 opacity-70"
																: "bg-red-50/40 border-l-4 border-l-red-500"
														}`}
													>
														<div className="flex justify-between items-start gap-2 mb-1">
															<h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
																{!alerta.isRead && (
																	<AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
																)}
																Alerta de Inasistencias
															</h4>
															{!alerta.isRead && (
																<button
																	onClick={() =>
																		handleMarkAsRead(alerta.idUnico)
																	}
																	className="text-[10px] font-bold text-gray-400 hover:text-[#252d62] uppercase tracking-wider shrink-0 transition-colors bg-white border border-gray-200 px-2 py-1 rounded"
																>
																	Marcar leído
																</button>
															)}
														</div>
														<p className="text-sm text-gray-600 mt-2 leading-relaxed">
															El alumno/a <strong>{alerta.alumnoNombre}</strong>{" "}
															ha estado ausente en las últimas 2 clases del
															curso <strong>{alerta.cursoNombre}</strong>.
														</p>
														<p className="text-xs text-gray-500 mt-2 italic">
															Por favor, comuníquese con secretaría en caso de
															tener algun inconveniente.
														</p>
													</div>
												))}
											</div>
										)}
									</div>

									{unreadCount > 0 && (
										<div className="p-3 border-t border-gray-100 bg-white">
											<button
												onClick={handleMarkAllAsRead}
												className="w-full py-2 text-xs font-bold text-gray-600 hover:text-[#252d62] hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center gap-2"
											>
												<CheckCircle2 className="w-4 h-4" />
												Marcar todo como leído
											</button>
										</div>
									)}
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>

				{/* Botones de Filtro (Alumnos) */}
				{listaAlumnos.length > 1 && (
					<div className="flex flex-wrap gap-2 pt-2">
						<button
							onClick={() => setFiltroAlumnoId("todos")}
							className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
								filtroAlumnoId === "todos"
									? "bg-[#252d62] text-white shadow-md border border-[#252d62]"
									: "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
							}`}
						>
							Todos los alumnos
						</button>
						{listaAlumnos.map((al) => (
							<button
								key={al.id}
								onClick={() => setFiltroAlumnoId(al.id)}
								className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
									filtroAlumnoId === al.id
										? "bg-[#252d62] text-white shadow-md border border-[#252d62]"
										: "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
								}`}
							>
								{al.nombre}
							</button>
						))}
					</div>
				)}

				{/* ─── Filtros de Estado ─── */}
				<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 flex flex-wrap md:flex-nowrap gap-1 w-full md:w-fit">
					{(["todas", "Presente", "Tarde", "Ausente"] as FiltroEstado[]).map(
						(f) => (
							<button
								key={f}
								onClick={() => setFiltroEstado(f)}
								className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
									filtroEstado === f
										? "bg-[#252d62] text-white shadow-sm"
										: "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
								}`}
							>
								{f}
							</button>
						),
					)}
				</div>

				{/* ─── Grid de Eventos Agrupados por Fecha ─── */}
				{eventosAgrupados.length === 0 ? (
					<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 flex flex-col items-center justify-center text-center">
						<div className="bg-gray-100 p-4 rounded-full mb-4">
							<CalendarDays className="w-8 h-8 text-gray-400" />
						</div>
						<h3 className="text-lg font-bold text-gray-900 mb-1">
							No hay asistencias registradas
						</h3>
						<p className="text-gray-500 text-sm">
							{filtroEstado !== "todas" || filtroAlumnoId !== "todos"
								? "No se encontraron registros para los filtros seleccionados."
								: "Todavía no se ha tomado lista en los cursos asignados."}
						</p>
					</div>
				) : (
					<div className="space-y-8">
						{eventosAgrupados.map((grupo, gIdx) => (
							<div key={grupo.fechaFormateada} className="space-y-4">
								{/* Cabecera de la Fecha */}
								<div className="flex items-center gap-4">
									<div className="h-px bg-gray-200 flex-1"></div>
									<span className="text-sm font-bold text-[#252d62] uppercase tracking-wider flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-gray-100 shadow-sm">
										<CalendarDays className="w-4 h-4" />
										{grupo.fechaFormateada}
									</span>
									<div className="h-px bg-gray-200 flex-1"></div>
								</div>

								{/* Grilla de las Tarjetas de ese día */}
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
									{grupo.eventos.map((evento, idx) => (
										<motion.div
											key={evento.idUnico}
											initial={{ opacity: 0, y: 10 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{
												duration: 0.2,
												delay: gIdx * 0.1 + idx * 0.05,
											}}
											className="h-full flex flex-col justify-between bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow relative"
										>
											<div
												className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-xl ${
													evento.estado === "Presente"
														? "bg-green-500"
														: evento.estado === "Tarde"
															? "bg-amber-500"
															: "bg-red-500"
												}`}
											/>

											<div>
												<div className="flex flex-wrap justify-between items-start gap-2 mb-3 mt-1">
													<div className="flex flex-wrap items-center gap-1.5">
														<span className="text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-100 px-2 py-1 rounded-md flex items-center gap-1.5">
															<BookOpen className="w-3.5 h-3.5" />
															{evento.cursoNombre}
														</span>

														<span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md flex items-center gap-1.5">
															<Clock className="w-3.5 h-3.5" />
															{evento.horaFormateada} hs
														</span>

														{evento.descripcion && (
															<div className="relative group/tooltip flex items-center justify-center cursor-help z-30">
																<FileText className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 transition-colors" />

																<div className="absolute bottom-full left-0 md:left-1/2 md:-translate-x-1/2 mb-2 w-56 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none shadow-xl">
																	<p className="font-bold text-indigo-300 mb-1">
																		Tema de la clase:
																	</p>
																	<p className="leading-snug whitespace-normal">
																		{evento.descripcion}
																	</p>
																	<div className="absolute top-full left-4 md:left-1/2 md:-translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
																</div>
															</div>
														)}
													</div>

													{evento.estado === "Presente" && (
														<span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shrink-0">
															<UserCheck className="w-3 h-3" /> Presente
														</span>
													)}
													{evento.estado === "Tarde" && (
														<span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shrink-0">
															<Clock className="w-3 h-3" /> Tarde
														</span>
													)}
													{evento.estado === "Ausente" && (
														<span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shrink-0">
															<UserX className="w-3 h-3" /> Ausente
														</span>
													)}
												</div>

												<div className="mt-4 flex items-center gap-2.5">
													<div className="w-8 h-8 rounded-full bg-indigo-50 text-[#252d62] flex items-center justify-center text-sm font-black border border-indigo-100 shrink-0">
														{evento.alumnoNombre.charAt(0)}
													</div>
													<span className="text-base font-bold text-gray-800 leading-tight">
														{evento.alumnoNombre}
													</span>
												</div>
											</div>
										</motion.div>
									))}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
