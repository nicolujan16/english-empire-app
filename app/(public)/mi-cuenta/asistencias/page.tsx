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
	Filter,
} from "lucide-react";
import { StudentDetails } from "@/types";
import { motion } from "framer-motion";

// ─── Tipos e Interfaces ───────────────────────────────────────────────────────

type EstadoAsistencia = "Presente" | "Tarde" | "Ausente";

interface AsistenciaEvento {
	idUnico: string; // claseId + alumnoId
	claseId: string;
	cursoId: string;
	cursoNombre: string;
	fechaIso: string;
	fechaFormateada: string;
	alumnoId: string;
	alumnoNombre: string;
	estado: EstadoAsistencia;
}

type FiltroEstado = "todas" | "Presente" | "Tarde" | "Ausente";

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function AsistenciasPage() {
	const router = useRouter();
	const { user, userData, isLoading: authLoading } = useAuth();

	const [eventos, setEventos] = useState<AsistenciaEvento[]>([]);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [cursosMap, setCursosMap] = useState<Record<string, string>>({});
	const [isLoading, setIsLoading] = useState(true);

	const [filtroAlumnoId, setFiltroAlumnoId] = useState<string>("todos");
	const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todas");

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
				// 1. Obtener todos los IDs de los alumnos (Titular + Hijos)
				const alumnoIds: string[] = [user.uid];
				userData.hijos?.forEach((hijo: StudentDetails) => {
					if (hijo.id) alumnoIds.push(String(hijo.id));
				});

				// 2. Obtener el mapa de Cursos para traducir ID -> Nombre
				const cursosSnap = await getDocs(collection(db, "Cursos"));
				const mapCursos: Record<string, string> = {};
				cursosSnap.forEach((doc) => {
					mapCursos[doc.id] = doc.data().nombre;
				});
				setCursosMap(mapCursos);

				// 3. Buscar las clases en las que participó cada alumno
				const promesasClases = alumnoIds.map((alumnoId) => {
					// 🚀 EL FIX ESTÁ ACÁ: "alumnoIds" (como está en tu base de datos)
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

						// Buscamos el registro específico de este alumno dentro de la clase
						const registroAlumno = registrosAsistencia.find(
							(r) => r.alumnoId === alumnoIdActual,
						);

						if (registroAlumno) {
							eventosAplanados.push({
								idUnico: `${docClase.id}-${alumnoIdActual}`,
								claseId: docClase.id,
								cursoId: dataClase.cursoId,
								cursoNombre: mapCursos[dataClase.cursoId] || dataClase.cursoId,
								fechaIso: dataClase.fechaIso || new Date().toISOString(),
								fechaFormateada:
									dataClase.fechaFormateada || dataClase.fechaCorta,
								alumnoId: alumnoIdActual,
								alumnoNombre: registroAlumno.nombre,
								estado: registroAlumno.estado as EstadoAsistencia,
							});
						}
					});
				});

				// 4. Ordenar desde la clase más reciente a la más antigua
				eventosAplanados.sort((a, b) => {
					const dateA = new Date(a.fechaIso).getTime();
					const dateB = new Date(b.fechaIso).getTime();
					return dateB - dateA; // Descendente
				});

				setEventos(eventosAplanados);
			} catch (error) {
				console.error("Error al cargar asistencias:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, [user, userData]);

	// ─── Lógica de Filtros ───
	const listaAlumnos = useMemo(() => {
		if (!user || !userData) return [];
		const alumnos = [{ id: user.uid, nombre: "Mis clases (Titular)" }];
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

	// ─── Estadísticas para las cards ───
	const countPresentes = eventosFiltrados.filter(
		(e) => e.estado === "Presente",
	).length;
	const countTardes = eventosFiltrados.filter(
		(e) => e.estado === "Tarde",
	).length;
	const countAusentes = eventosFiltrados.filter(
		(e) => e.estado === "Ausente",
	).length;

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
				{/* Header y Selector de Alumnos */}
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
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

					{listaAlumnos.length > 1 && (
						<div className="bg-white border border-gray-200 rounded-lg p-1.5 shadow-sm flex items-center gap-2 px-3">
							<Filter className="w-4 h-4 text-gray-400" />
							<select
								value={filtroAlumnoId}
								onChange={(e) => setFiltroAlumnoId(e.target.value)}
								className="text-sm font-semibold text-[#252d62] bg-transparent outline-none cursor-pointer py-1.5"
							>
								<option value="todos">Todos los alumnos</option>
								{listaAlumnos.map((al) => (
									<option key={al.id} value={al.id}>
										{al.nombre}
									</option>
								))}
							</select>
						</div>
					)}
				</div>

				{/* ─── Kpi Cards (Estadísticas Rápidas) ─── */}
				<div className="grid grid-cols-3 gap-3 md:gap-6">
					<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col items-center justify-center text-center">
						<div className="bg-green-100 p-2.5 rounded-full mb-2 text-green-600">
							<UserCheck className="w-5 h-5" />
						</div>
						<p className="text-2xl font-black text-gray-900">
							{countPresentes}
						</p>
						<p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
							Presentes
						</p>
					</div>

					<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col items-center justify-center text-center">
						<div className="bg-amber-100 p-2.5 rounded-full mb-2 text-amber-600">
							<Clock className="w-5 h-5" />
						</div>
						<p className="text-2xl font-black text-gray-900">{countTardes}</p>
						<p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
							Tardes
						</p>
					</div>

					<div className="bg-white rounded-xl border border-red-100 shadow-sm p-4 flex flex-col items-center justify-center text-center">
						<div className="bg-red-100 p-2.5 rounded-full mb-2 text-red-600">
							<UserX className="w-5 h-5" />
						</div>
						<p className="text-2xl font-black text-gray-900">{countAusentes}</p>
						<p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
							Ausentes
						</p>
					</div>
				</div>

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

				{/* ─── Grid de Eventos ─── */}
				{eventosFiltrados.length === 0 ? (
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
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
						{eventosFiltrados.map((evento, idx) => (
							<motion.div
								key={evento.idUnico}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.2, delay: idx * 0.05 }}
								className="h-full flex flex-col justify-between bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow"
							>
								<div>
									<div className="flex justify-between items-start gap-2 mb-3">
										<span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
											<CalendarDays className="w-3.5 h-3.5" />
											{evento.fechaFormateada}
										</span>

										{/* Badge de Estado Dinámico */}
										{evento.estado === "Presente" && (
											<span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
												<UserCheck className="w-3 h-3" /> Presente
											</span>
										)}
										{evento.estado === "Tarde" && (
											<span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
												<Clock className="w-3 h-3" /> Tarde
											</span>
										)}
										{evento.estado === "Ausente" && (
											<span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
												<UserX className="w-3 h-3" /> Ausente
											</span>
										)}
									</div>

									<h3 className="font-bold text-[#252d62] text-lg leading-tight mb-1">
										{evento.cursoNombre}
									</h3>
								</div>

								<div className="mt-4 pt-3 border-t border-gray-50 flex items-center gap-2">
									<div className="w-6 h-6 rounded-full bg-indigo-50 text-[#252d62] flex items-center justify-center text-xs font-bold">
										{evento.alumnoNombre.charAt(0)}
									</div>
									<span className="text-sm font-medium text-gray-700">
										{evento.alumnoNombre}
									</span>
								</div>
							</motion.div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
