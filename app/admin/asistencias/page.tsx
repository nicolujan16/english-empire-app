"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	Loader2,
	CalendarDays,
	BookOpen,
	ChevronRight,
	ArrowLeft,
	Clock,
	UserCheck,
	UserX,
	FileText,
	Search,
	Printer,
	Download,
	AlertTriangle,
	Mail,
	Phone,
	UserMinus,
	Check,
	Bell,
	CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

// ─── Interfaces ───────────────────────────────────────────────────────────────

type EstadoAsistencia = "Presente" | "Tarde" | "Ausente";

interface AsistenciaDetalle {
	alumnoId: string;
	nombre: string;
	dni: string;
	tipo: string;
	estado: EstadoAsistencia;
}

interface ClaseData {
	id: string;
	cursoId: string;
	fechaIso: string;
	fechaFormateada: string;
	horaFormateada: string;
	descripcion: string;
	asistencia: AsistenciaDetalle[];
}

interface CursoData {
	id: string;
	nombre: string;
	categoria: string;
	cantidadClases: number;
}

interface AlertaDesercion {
	idUnico: string;
	cursoNombre: string;
	alumnoNombre: string;
	isRead: boolean; // 🚀 NUEVO: Propiedad para saber si fue leída
	contacto: {
		esTitular: boolean;
		email?: string;
		telefono?: string;
		tutorNombre?: string;
	} | null;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function AdminAsistenciasPage() {
	const [cursos, setCursos] = useState<CursoData[]>([]);
	const [clases, setClases] = useState<ClaseData[]>([]);

	const [alertas, setAlertas] = useState<AlertaDesercion[]>([]);
	const [isAlertsOpen, setIsAlertsOpen] = useState(false);

	const [isLoading, setIsLoading] = useState(true);

	const [searchTerm, setSearchTerm] = useState("");
	const [selectedCurso, setSelectedCurso] = useState<CursoData | null>(null);

	const [selectedClase, setSelectedClase] = useState<ClaseData | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);

	// ─── Carga de Datos ─────────────────────────────────────────────────────────
	useEffect(() => {
		const fetchData = async () => {
			setIsLoading(true);
			try {
				const [cursosSnap, clasesSnap, usersSnap, hijosSnap] =
					await Promise.all([
						getDocs(
							query(collection(db, "Cursos"), where("active", "==", true)),
						),
						getDocs(
							query(collection(db, "Clases"), orderBy("fechaIso", "desc")),
						),
						getDocs(collection(db, "Users")),
						getDocs(collection(db, "Hijos")),
					]);

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const studentMap: Record<string, any> = {};
				usersSnap.forEach(
					(d) => (studentMap[d.id] = { ...d.data(), tipo: "Titular" }),
				);
				hijosSnap.forEach(
					(d) => (studentMap[d.id] = { ...d.data(), tipo: "Menor" }),
				);

				const clasesList: ClaseData[] = clasesSnap.docs.map((doc) => {
					const data = doc.data();
					return {
						id: doc.id,
						cursoId: data.cursoId,
						fechaIso: data.fechaIso || new Date().toISOString(),
						fechaFormateada: data.fechaFormateada || "Fecha desconocida",
						horaFormateada: data.horaFormateada || "00:00",
						descripcion: data.descripcion || "",
						asistencia: data.asistencia || [],
					};
				});

				const cursosList: CursoData[] = cursosSnap.docs.map((doc) => {
					const data = doc.data();
					const clasesDelCurso = clasesList.filter((c) => c.cursoId === doc.id);

					return {
						id: doc.id,
						nombre: data.nombre || "Curso sin nombre",
						categoria: data.categoria || "General",
						cantidadClases: clasesDelCurso.length,
					};
				});
				cursosList.sort((a, b) => a.nombre.localeCompare(b.nombre));

				// LÓGICA DE ALERTA DE DESERCIÓN (ÚLTIMOS 45 DÍAS)
				const alertasTemp: AlertaDesercion[] = [];
				const fechaLimite = new Date();
				fechaLimite.setDate(fechaLimite.getDate() - 45);
				const limiteIso = fechaLimite.toISOString();

				cursosList.forEach((curso) => {
					const clasesDelCurso = clasesList.filter(
						(c) => c.cursoId === curso.id,
					);

					if (clasesDelCurso.length >= 2) {
						const ultimaClase = clasesDelCurso[0];
						const penultimaClase = clasesDelCurso[1];

						if (ultimaClase.fechaIso >= limiteIso) {
							const ausentesUltima = ultimaClase.asistencia.filter(
								(a) => a.estado === "Ausente",
							);
							const ausentesPenultima = penultimaClase.asistencia.filter(
								(a) => a.estado === "Ausente",
							);

							ausentesUltima.forEach((ausUltima) => {
								if (
									ausentesPenultima.some(
										(a) => a.alumnoId === ausUltima.alumnoId,
									)
								) {
									const alertId = `read_alert_${curso.id}_${ausUltima.alumnoId}_${ultimaClase.id}`;

									// 🚀 NUEVO: Verificamos si ya está marcada como leída
									const isRead = localStorage.getItem(alertId) === "true";

									const sInfo = studentMap[ausUltima.alumnoId];
									let contacto = null;

									if (sInfo) {
										contacto = {
											esTitular: sInfo.tipo === "Titular",
											email:
												sInfo.tipo === "Titular"
													? sInfo.email
													: sInfo.datosTutor?.email,
											telefono:
												sInfo.tipo === "Titular"
													? sInfo.telefono
													: sInfo.datosTutor?.telefono,
											tutorNombre:
												sInfo.tipo === "Menor"
													? `${sInfo.datosTutor?.nombre || ""} ${sInfo.datosTutor?.apellido || ""}`.trim()
													: undefined,
										};
									}

									alertasTemp.push({
										idUnico: alertId,
										cursoNombre: curso.nombre,
										alumnoNombre: ausUltima.nombre,
										contacto,
										isRead, // Lo guardamos en el estado
									});
								}
							});
						}
					}
				});

				// Ordenamos para que las no leídas queden arriba
				alertasTemp.sort((a, b) =>
					a.isRead === b.isRead ? 0 : a.isRead ? 1 : -1,
				);

				setCursos(cursosList);
				setClases(clasesList);
				setAlertas(alertasTemp);
			} catch (error) {
				console.error("Error al cargar datos:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, []);

	// ─── Handlers de Notificaciones ─────────────────────────────────────────────

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

	// ─── Otros Handlers ─────────────────────────────────────────────────────────

	const openModalAsistencia = (clase: ClaseData) => {
		setSelectedClase(clase);
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setTimeout(() => setSelectedClase(null), 300);
	};

	const cursosFiltrados = useMemo(() => {
		return cursos.filter((c) =>
			c.nombre.toLowerCase().includes(searchTerm.toLowerCase()),
		);
	}, [cursos, searchTerm]);

	const clasesDelCursoSeleccionado = useMemo(() => {
		if (!selectedCurso) return [];
		return clases.filter((c) => c.cursoId === selectedCurso.id);
	}, [clases, selectedCurso]);

	// ─── Exportación e Impresión ────────────────────────────────────────────────
	const handlePrintAsistencia = () => {
		if (!selectedClase || !selectedCurso) return;

		const filas = selectedClase.asistencia
			.sort((a, b) => a.nombre.localeCompare(b.nombre))
			.map(
				(a) => `
        <tr>
          <td>${a.nombre}</td>
          <td>${a.dni}</td>
          <td style="color: ${
						a.estado === "Presente"
							? "green"
							: a.estado === "Tarde"
								? "orange"
								: "red"
					}; font-weight: bold;">
            ${a.estado}
          </td>
        </tr>
      `,
			)
			.join("");

		const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Asistencia - ${selectedCurso.nombre}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
          h1 { font-size: 18px; color: #252d62; margin-bottom: 4px; }
          p { margin: 4px 0; color: #444; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #252d62; color: white; padding: 8px; text-align: left; }
          td { padding: 8px; border-bottom: 1px solid #ddd; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <h1>Registro de Asistencia</h1>
        <p><strong>Curso:</strong> ${selectedCurso.nombre}</p>
        <p><strong>Fecha y Hora:</strong> ${selectedClase.fechaFormateada} a las ${selectedClase.horaFormateada} hs</p>
        ${selectedClase.descripcion ? `<p><strong>Tema/Descripción:</strong> ${selectedClase.descripcion}</p>` : ""}
        <table>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>DNI</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </body>
      </html>
    `;

		const win = window.open("", "_blank");
		if (!win) return;
		win.document.write(html);
		win.document.close();
		win.focus();
		setTimeout(() => win.print(), 300);
	};

	const handleExportCSV = () => {
		if (!selectedClase || !selectedCurso) return;

		const headers = ["Alumno", "DNI", "Estado"];
		const rows = selectedClase.asistencia
			.sort((a, b) => a.nombre.localeCompare(b.nombre))
			.map((a) => `"${a.nombre}","${a.dni}","${a.estado}"`);

		const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;

		const fechaLimpia = selectedClase.fechaIso.split("T")[0];
		const cursoLimpio = selectedCurso.nombre
			.replace(/[^a-z0-9]/gi, "_")
			.toLowerCase();
		link.setAttribute(
			"download",
			`asistencia_${cursoLimpio}_${fechaLimpia}.csv`,
		);

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	// ─── RENDERIZADOS ───────────────────────────────────────────────────────────

	if (isLoading) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center min-h-[80vh]">
				<Loader2 className="w-10 h-10 animate-spin text-[#252d62] mb-4" />
				<p className="text-gray-500 font-medium animate-pulse">
					Cargando registros de asistencia...
				</p>
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6 max-w-7xl mx-auto">
			{/* ══ VISTA 1: LISTA DE CURSOS ══ */}
			{!selectedCurso && (
				<motion.div
					initial={{ opacity: 0, x: -20 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -20 }}
					className="space-y-6 relative"
				>
					{/* Header con Buscador y Campanita */}
					<div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
						<div>
							<div className="flex items-center gap-3 mb-2">
								<div className="bg-[#252d62] p-2.5 rounded-xl">
									<CalendarDays className="w-6 h-6 text-white" />
								</div>
								<h1 className="text-3xl font-black text-[#252d62]">
									Control de Asistencias
								</h1>
							</div>
							<p className="text-gray-500 ml-14">
								Seleccioná un curso para revisar su historial de clases.
							</p>
						</div>

						<div className="flex items-center gap-3 w-full md:w-auto relative z-50">
							<div className="relative flex-1 md:w-80">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
								<input
									type="text"
									placeholder="Buscar curso..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] outline-none transition-all"
								/>
							</div>

							{/* 🚀 BOTÓN DE CAMPANITA Y DROPDOWN */}
							<div className="relative">
								<button
									onClick={() => setIsAlertsOpen(!isAlertsOpen)}
									className={`relative p-3 rounded-xl border transition-all ${
										isAlertsOpen
											? "bg-indigo-50 border-indigo-200 text-indigo-600"
											: unreadCount > 0
												? "bg-white border-gray-200 hover:bg-gray-50 text-[#252d62]"
												: "bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100"
									}`}
								>
									<Bell className="w-5 h-5" />
									{unreadCount > 0 && (
										<span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
											{unreadCount}
										</span>
									)}
								</button>

								{/* Overlay invisible para cerrar al hacer click afuera */}
								{isAlertsOpen && (
									<div
										className="fixed inset-0 z-40"
										onClick={() => setIsAlertsOpen(false)}
									></div>
								)}

								{/* 🚀 CAJA DE NOTIFICACIONES (POSITION ABSOLUTE) */}
								<AnimatePresence>
									{isAlertsOpen && (
										<motion.div
											initial={{ opacity: 0, y: 10, scale: 0.95 }}
											animate={{ opacity: 1, y: 0, scale: 1 }}
											exit={{ opacity: 0, y: 10, scale: 0.95 }}
											transition={{ duration: 0.15 }}
											className="absolute right-0 top-full mt-2 w-[350px] sm:w-[420px] max-w-[calc(100vw-2rem)] bg-white shadow-2xl shadow-gray-900/10 border border-gray-200 rounded-2xl overflow-hidden z-50 flex flex-col"
										>
											{/* Header Dropdown */}
											<div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex items-center justify-between">
												<h3 className="font-bold text-gray-900">
													Notificaciones
												</h3>
												{unreadCount > 0 && (
													<span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
														{unreadCount} nuevas
													</span>
												)}
											</div>

											{/* Lista de Alertas */}
											<div className="max-h-[380px] overflow-y-auto">
												{alertas.length === 0 ? (
													<div className="p-8 text-center text-gray-500">
														<CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
														<p className="text-sm">
															No hay alertas recientes de deserción.
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
																		{alerta.alumnoNombre}
																	</h4>
																	{!alerta.isRead && (
																		<button
																			onClick={() =>
																				handleMarkAsRead(alerta.idUnico)
																			}
																			className="text-[10px] font-bold text-gray-400 hover:text-indigo-600 uppercase tracking-wider shrink-0 transition-colors"
																			title="Marcar como leído"
																		>
																			<Check className="w-4 h-4" />
																		</button>
																	)}
																</div>
																<p className="text-xs text-gray-600 mb-3">
																	2 faltas consecutivas en{" "}
																	<strong>{alerta.cursoNombre}</strong>.
																</p>

																<div
																	className={`text-xs p-2.5 rounded-lg border ${alerta.isRead ? "bg-gray-50 border-gray-200" : "bg-white border-red-100"}`}
																>
																	{alerta.contacto ? (
																		<div className="flex flex-col gap-1.5">
																			<p className="font-semibold text-gray-800">
																				{alerta.contacto.esTitular
																					? "Contacto Titular:"
																					: `Tutor: ${alerta.contacto.tutorNombre}`}
																			</p>
																			<p className="flex items-center gap-1.5 text-gray-600">
																				<Mail className="w-3 h-3 text-gray-400" />{" "}
																				{alerta.contacto.email || "Sin email"}
																			</p>
																			<p className="flex items-center gap-1.5 text-gray-600">
																				<Phone className="w-3 h-3 text-gray-400" />{" "}
																				{alerta.contacto.telefono ||
																					"Sin teléfono"}
																			</p>
																		</div>
																	) : (
																		<p className="flex items-center gap-1.5 text-gray-500 italic">
																			<UserMinus className="w-3 h-3" /> Sin
																			datos de contacto.
																		</p>
																	)}
																</div>
															</div>
														))}
													</div>
												)}
											</div>

											{/* Footer Dropdown (Botón Marcar Todo) */}
											{unreadCount > 0 && (
												<div className="p-3 border-t border-gray-100 bg-white">
													<button
														onClick={handleMarkAllAsRead}
														className="w-full py-2 text-xs font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center gap-2"
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
					</div>

					{/* Grilla de Cursos */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
						{cursosFiltrados.map((curso, idx) => {
							const hasClasses = curso.cantidadClases > 0;

							return (
								<motion.div
									key={curso.id}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: idx * 0.05 }}
									className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col h-full hover:shadow-md transition-shadow"
								>
									<div className="flex-1">
										<div className="flex justify-between items-start mb-4">
											<div className="w-12 h-12 bg-indigo-50 text-[#252d62] rounded-xl flex items-center justify-center">
												<BookOpen className="w-6 h-6" />
											</div>
											<span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-2 py-1 rounded-md">
												{curso.categoria}
											</span>
										</div>
										<h3 className="font-bold text-gray-900 text-xl leading-tight mb-2">
											{curso.nombre}
										</h3>
										<p className="flex items-center gap-1.5 text-sm text-gray-500 font-medium">
											<CalendarDays className="w-4 h-4 text-gray-400" />
											{hasClasses
												? `${curso.cantidadClases} clases registradas`
												: "Sin registros aún"}
										</p>
									</div>

									<div className="mt-6 pt-4 border-t border-gray-50">
										<button
											onClick={() => setSelectedCurso(curso)}
											disabled={!hasClasses}
											title={
												!hasClasses
													? "No se registran asistencias a este curso"
													: ""
											}
											className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all text-sm ${
												hasClasses
													? "bg-indigo-50 text-[#252d62] hover:bg-[#252d62] hover:text-white"
													: "bg-gray-50 text-gray-400 cursor-not-allowed"
											}`}
										>
											Ver Registro de Asistencias
											{hasClasses && <ChevronRight className="w-4 h-4" />}
										</button>
									</div>
								</motion.div>
							);
						})}
					</div>

					{cursosFiltrados.length === 0 && (
						<div className="py-20 text-center">
							<BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
							<h3 className="text-lg font-bold text-gray-900">
								No se encontraron cursos
							</h3>
							<p className="text-gray-500">Probá buscando con otro nombre.</p>
						</div>
					)}
				</motion.div>
			)}

			{/* ══ VISTA 2: HISTORIAL DE CLASES DEL CURSO ══ */}
			{selectedCurso && (
				<motion.div
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0 }}
					className="space-y-6"
				>
					{/* Header y Botón Volver */}
					<div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm">
						<button
							onClick={() => setSelectedCurso(null)}
							className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#252d62] transition-colors mb-4"
						>
							<ArrowLeft className="w-4 h-4" /> Volver a cursos
						</button>
						<div className="flex items-center gap-3">
							<div className="bg-indigo-50 p-3 rounded-xl">
								<BookOpen className="w-6 h-6 text-[#252d62]" />
							</div>
							<div>
								<h2 className="text-2xl font-black text-gray-900 leading-tight">
									{selectedCurso.nombre}
								</h2>
								<p className="text-gray-500 text-sm font-medium mt-0.5">
									Historial completo de clases y asistencias
								</p>
							</div>
						</div>
					</div>

					{/* Grilla de Clases */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
						{clasesDelCursoSeleccionado.map((clase, idx) => {
							const presentes = clase.asistencia.filter(
								(a) => a.estado === "Presente",
							).length;
							const ausentes = clase.asistencia.filter(
								(a) => a.estado === "Ausente",
							).length;

							return (
								<motion.div
									key={clase.id}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: idx * 0.05 }}
									onClick={() => openModalAsistencia(clase)}
									className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all p-5 flex flex-col justify-between cursor-pointer group"
								>
									<div>
										<div className="flex justify-between items-start gap-2 mb-3">
											<p className="font-bold text-[#252d62] text-lg leading-tight group-hover:text-[#4338ca] transition-colors">
												{clase.fechaFormateada}
											</p>
											<div className="w-7 h-7 rounded-full bg-gray-50 group-hover:bg-indigo-50 flex items-center justify-center transition-colors shrink-0">
												<ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#4338ca]" />
											</div>
										</div>

										<div className="flex items-center gap-2 mb-3">
											<span className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
												<Clock className="w-3 h-3" />
												{clase.horaFormateada} hs
											</span>
											{clase.descripcion && (
												<span className="flex items-center gap-1.5 text-xs text-gray-600 font-medium bg-gray-50 px-2 py-1 rounded-md border border-gray-200 truncate">
													<FileText className="w-3 h-3 shrink-0" />
													<span className="truncate max-w-[120px]">
														{clase.descripcion}
													</span>
												</span>
											)}
										</div>
									</div>

									<div className="flex items-center gap-3 pt-3 border-t border-gray-50">
										<span className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded">
											<UserCheck className="w-3.5 h-3.5" /> {presentes}
										</span>
										<span className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded">
											<UserX className="w-3.5 h-3.5" /> {ausentes}
										</span>
									</div>
								</motion.div>
							);
						})}
					</div>
				</motion.div>
			)}

			{/* ══ MODAL DE DETALLE DE ASISTENCIA ══ */}
			<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
				<DialogTitle className="sr-only">Detalles de Asistencia</DialogTitle>
				<DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl">
					{selectedClase && (
						<>
							<div className="bg-[#252d62] p-6 text-white">
								<h3 className="text-xl font-black mb-1 flex items-center gap-2">
									<CalendarDays className="w-5 h-5 text-indigo-300" />
									{selectedClase.fechaFormateada}
								</h3>
								<div className="flex flex-wrap items-center gap-3 text-indigo-200 text-sm font-medium">
									<span className="flex items-center gap-1">
										<Clock className="w-4 h-4" /> {selectedClase.horaFormateada}{" "}
										hs
									</span>
									{selectedClase.descripcion && (
										<>
											<span>•</span>
											<span className="flex items-center gap-1 truncate">
												<FileText className="w-4 h-4" />{" "}
												{selectedClase.descripcion}
											</span>
										</>
									)}
								</div>
							</div>

							<div className="p-2 bg-gray-50 max-h-[50vh] overflow-y-auto">
								{selectedClase.asistencia.length === 0 ? (
									<div className="p-8 text-center text-gray-500">
										No se registraron alumnos en esta clase.
									</div>
								) : (
									<div className="flex flex-col gap-1.5">
										{[...selectedClase.asistencia]
											.sort((a, b) => {
												if (a.estado === "Ausente" && b.estado !== "Ausente")
													return -1;
												if (a.estado !== "Ausente" && b.estado === "Ausente")
													return 1;
												return a.nombre.localeCompare(b.nombre);
											})
											.map((alumno) => (
												<div
													key={alumno.alumnoId}
													className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm"
												>
													<div className="flex items-center gap-3 min-w-0">
														<div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs shrink-0">
															{alumno.nombre.charAt(0).toUpperCase()}
														</div>
														<div className="truncate">
															<p className="font-bold text-gray-900 text-sm truncate">
																{alumno.nombre}
															</p>
															<p className="text-[10px] text-gray-400 font-mono">
																DNI: {alumno.dni}
															</p>
														</div>
													</div>

													<div className="shrink-0 ml-3">
														{alumno.estado === "Presente" && (
															<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-green-50 text-green-700 border border-green-100">
																<UserCheck className="w-3.5 h-3.5" /> Presente
															</span>
														)}
														{alumno.estado === "Tarde" && (
															<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
																<Clock className="w-3.5 h-3.5" /> Tarde
															</span>
														)}
														{alumno.estado === "Ausente" && (
															<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 text-red-700 border border-red-100">
																<UserX className="w-3.5 h-3.5" /> Ausente
															</span>
														)}
													</div>
												</div>
											))}
									</div>
								)}
							</div>

							<div className="p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-3">
								<div className="flex gap-2 w-full sm:w-auto">
									<Button
										onClick={handlePrintAsistencia}
										variant="outline"
										className="flex-1 sm:flex-none text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold"
									>
										<Printer className="w-4 h-4 mr-2" /> Imprimir
									</Button>
									<Button
										onClick={handleExportCSV}
										variant="outline"
										className="flex-1 sm:flex-none text-green-600 border-green-200 hover:bg-green-50 font-bold"
									>
										<Download className="w-4 h-4 mr-2" /> Excel (CSV)
									</Button>
								</div>
								<Button
									onClick={closeModal}
									variant="ghost"
									className="w-full sm:w-auto font-bold text-gray-500 hover:bg-gray-100"
								>
									Cerrar
								</Button>
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
