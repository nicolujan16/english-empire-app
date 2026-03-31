/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	X,
	GraduationCap,
	Loader2,
	Search,
	BookOpen,
	Phone,
	Mail,
	ShieldOff,
	ShieldCheck,
	ChevronDown,
	ChevronUp,
	AlertCircle,
	PlusCircle,
	XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import {
	collection,
	getDocs,
	doc,
	updateDoc,
	arrayUnion,
	arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Teacher {
	id: string;
	nombre: string;
	apellido: string;
	email: string;
	dni?: string;
	telefono?: string;
	titulo?: string;
	activo: boolean;
	cursosAsignados: { id: string; nombre: string }[];
}

interface Curso {
	id: string;
	nombre: string;
}

interface Props {
	isOpen: boolean;
	onClose: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function TeacherListModal({ isOpen, onClose }: Props) {
	const [teachers, setTeachers] = useState<Teacher[]>([]);
	const [allCursos, setAllCursos] = useState<Curso[]>([]);

	const [isLoading, setIsLoading] = useState(false);
	const [search, setSearch] = useState("");
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [togglingId, setTogglingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Estado del flujo de asignación
	const [assigningTeacherId, setAssigningTeacherId] = useState<string | null>(
		null,
	);
	const [selectedCursoId, setSelectedCursoId] = useState<string>("");
	const [isAssigning, setIsAssigning] = useState(false);
	const [isRemoving, setIsRemoving] = useState<string | null>(null);

	// ── Fetch ────────────────────────────────────────────────────────────────

	const fetchData = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const [teachersSnap, cursosSnap] = await Promise.all([
				getDocs(collection(db, "Teachers")),
				getDocs(collection(db, "Cursos")),
			]);

			// 1. Armamos un diccionario/mapa de cursos para buscar rápido el nombre
			const cursosMap: Record<string, string> = {};
			const cursosList: Curso[] = cursosSnap.docs.map((d) => {
				cursosMap[d.id] = d.data().nombre;
				return {
					id: d.id,
					nombre: d.data().nombre,
				};
			});
			setAllCursos(cursosList);

			// 2. Mapeamos a los profesores y leemos su array "cursosAsignados"
			const list: Teacher[] = teachersSnap.docs.map((d) => {
				const data = d.data();

				// Asumimos que guardamos un array de strings (IDs) en Firebase
				const asignadosDB: string[] = data.cursosAsignados || [];

				const cursosAsignados = asignadosDB.map((cursoId) => ({
					id: cursoId,
					nombre: cursosMap[cursoId] || "Curso Desconocido",
				}));

				return {
					id: d.id,
					nombre: data.nombre,
					apellido: data.apellido,
					email: data.email,
					dni: data.dni,
					telefono: data.telefono,
					titulo: data.titulo,
					activo: data.activo !== false,
					cursosAsignados,
				};
			});

			list.sort((a, b) => {
				if (a.activo !== b.activo) return a.activo ? -1 : 1;
				return `${a.apellido} ${a.nombre}`.localeCompare(
					`${b.apellido} ${b.nombre}`,
				);
			});

			setTeachers(list);
		} catch (err) {
			console.error(err);
			setError("Error al cargar los datos.");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (isOpen) fetchData();
	}, [isOpen]);

	// ── Toggle activo / inactivo ─────────────────────────────────────────────

	const handleToggleActivo = async (teacher: Teacher) => {
		setTogglingId(teacher.id);
		try {
			await updateDoc(doc(db, "Teachers", teacher.id), {
				activo: !teacher.activo,
			});
			setTeachers((prev) =>
				prev.map((t) =>
					t.id === teacher.id ? { ...t, activo: !t.activo } : t,
				),
			);
		} catch (err) {
			console.error(err);
			setError("Error al actualizar el estado del profesor.");
		} finally {
			setTogglingId(null);
		}
	};

	// ── Asignación de curso ──────────────────────────────────────────────────

	const handleSelectCurso = (teacherId: string, cursoId: string) => {
		setSelectedCursoId(cursoId);
		if (!cursoId) return;
		// 🚀 Ya no hay conflictos, asignamos directo
		doAsignarCurso(teacherId, cursoId);
	};

	const doAsignarCurso = async (teacherId: string, cursoId: string) => {
		setIsAssigning(true);
		try {
			// 🚀 NUEVA LÓGICA: Guardamos en el array del Profesor usando arrayUnion
			await updateDoc(doc(db, "Teachers", teacherId), {
				cursosAsignados: arrayUnion(cursoId),
			});

			const cursoNombre =
				allCursos.find((c) => c.id === cursoId)?.nombre || cursoId;

			setTeachers((prev) =>
				prev.map((t) => {
					if (t.id === teacherId) {
						const yaTiene = t.cursosAsignados.some((c) => c.id === cursoId);
						if (yaTiene) return t;
						return {
							...t,
							cursosAsignados: [
								...t.cursosAsignados,
								{ id: cursoId, nombre: cursoNombre },
							],
						};
					}
					return t;
				}),
			);

			setSelectedCursoId("");
			setAssigningTeacherId(null);
		} catch (err) {
			console.error(err);
			setError("Error al asignar el curso.");
		} finally {
			setIsAssigning(false);
		}
	};

	// 🚀 DESASIGNAR CURSO
	const doQuitarCurso = async (teacherId: string, cursoId: string) => {
		setIsRemoving(cursoId);
		try {
			// 🚀 NUEVA LÓGICA: Quitamos del array del Profesor usando arrayRemove
			await updateDoc(doc(db, "Teachers", teacherId), {
				cursosAsignados: arrayRemove(cursoId),
			});

			setTeachers((prev) =>
				prev.map((t) => {
					if (t.id === teacherId) {
						return {
							...t,
							cursosAsignados: t.cursosAsignados.filter(
								(c) => c.id !== cursoId,
							),
						};
					}
					return t;
				}),
			);
		} catch (err) {
			console.error(err);
			setError("Error al quitar el curso.");
		} finally {
			setIsRemoving(null);
		}
	};

	const closeAssignMode = () => {
		setAssigningTeacherId(null);
		setSelectedCursoId("");
	};

	// ── Filtro ───────────────────────────────────────────────────────────────

	const filtered = teachers.filter((t) => {
		const q = search.toLowerCase();
		return (
			t.nombre.toLowerCase().includes(q) ||
			t.apellido.toLowerCase().includes(q) ||
			t.email.toLowerCase().includes(q) ||
			(t.titulo || "").toLowerCase().includes(q)
		);
	});

	// ─── RENDER ───────────────────────────────────────────────────────────────

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Overlay */}
					<motion.div
						key="overlay"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
					/>

					{/* Modal */}
					<motion.div
						key="modal"
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{ type: "spring", duration: 0.3 }}
						className="fixed inset-0 z-50 flex items-center justify-center p-4"
					>
						<div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-100 flex flex-col max-h-[85vh]">
							{/* Header */}
							<div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
								<div className="flex items-center gap-3">
									<div className="p-2 bg-indigo-50 rounded-xl">
										<GraduationCap className="w-5 h-5 text-[#4338ca]" />
									</div>
									<div>
										<h2 className="font-bold text-gray-900 text-lg">
											Profesores
										</h2>
										<p className="text-xs text-gray-500 mt-0.5">
											{teachers.filter((t) => t.activo).length} activos ·{" "}
											{teachers.filter((t) => !t.activo).length} inactivos
										</p>
									</div>
								</div>
								<button
									onClick={onClose}
									className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
								>
									<X className="w-5 h-5" />
								</button>
							</div>

							{/* Buscador */}
							<div className="px-6 py-4 border-b border-gray-100 shrink-0">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
									<input
										type="text"
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										placeholder="Buscar por nombre, email o especialidad..."
										className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4338ca]/20 focus:border-[#4338ca] outline-none transition-all"
									/>
								</div>
							</div>

							{/* Lista */}
							<div className="overflow-y-auto flex-1 p-4 space-y-2">
								{isLoading ? (
									<div className="flex flex-col items-center justify-center py-16">
										<Loader2 className="w-8 h-8 animate-spin text-[#4338ca] mb-3" />
										<p className="text-sm text-gray-500">
											Cargando profesores...
										</p>
									</div>
								) : error ? (
									<div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-4">
										<AlertCircle className="w-4 h-4 shrink-0" />
										{error}
									</div>
								) : filtered.length === 0 ? (
									<div className="text-center py-16 text-gray-400">
										<GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
										<p className="font-medium text-sm">
											{search
												? "No se encontraron profesores."
												: "Todavía no hay profesores registrados."}
										</p>
									</div>
								) : (
									filtered.map((teacher) => {
										const isExpanded = expandedId === teacher.id;
										const isToggling = togglingId === teacher.id;
										const isAssigningThis = assigningTeacherId === teacher.id;

										return (
											<div
												key={teacher.id}
												className={`rounded-xl border transition-all ${
													teacher.activo
														? "border-gray-100 bg-white"
														: "border-gray-100 bg-gray-50 opacity-70"
												}`}
											>
												{/* ── Fila principal ── */}
												<div className="flex items-center gap-3 p-4">
													{/* Avatar */}
													<div
														className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
															teacher.activo
																? "bg-indigo-50 text-[#4338ca]"
																: "bg-gray-100 text-gray-400"
														}`}
													>
														{teacher.nombre.charAt(0)}
														{teacher.apellido.charAt(0)}
													</div>

													{/* Info */}
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2 flex-wrap">
															<p className="font-bold text-gray-900 text-sm leading-tight">
																{teacher.nombre} {teacher.apellido}
															</p>
															{!teacher.activo && (
																<span className="text-[10px] bg-gray-200 text-gray-500 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
																	Inactivo
																</span>
															)}
														</div>
														{teacher.titulo && (
															<p className="text-xs text-gray-500 mt-0.5 truncate">
																{teacher.titulo}
															</p>
														)}
														{/* Mostrar badges chiquitos solo si NO está expandido */}
														{!isExpanded &&
															teacher.cursosAsignados.length > 0 && (
																<div className="flex flex-wrap gap-1 mt-1.5">
																	{teacher.cursosAsignados.map((c) => (
																		<span
																			key={c.id}
																			className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-[#4338ca] font-semibold px-2 py-0.5 rounded-full"
																		>
																			<BookOpen className="w-2.5 h-2.5" />
																			{c.nombre}
																		</span>
																	))}
																</div>
															)}
													</div>

													{/* Acciones */}
													<div className="flex items-center gap-2 shrink-0">
														<Button
															variant="outline"
															size="sm"
															onClick={() => handleToggleActivo(teacher)}
															disabled={isToggling}
															className={`rounded-lg text-xs font-bold h-8 px-3 transition-all ${
																teacher.activo
																	? "border-red-200 text-red-600 hover:bg-red-50"
																	: "border-green-200 text-green-600 hover:bg-green-50"
															}`}
														>
															{isToggling ? (
																<Loader2 className="w-3.5 h-3.5 animate-spin" />
															) : teacher.activo ? (
																<>
																	<ShieldOff className="w-3.5 h-3.5 mr-1" />
																	Desactivar
																</>
															) : (
																<>
																	<ShieldCheck className="w-3.5 h-3.5 mr-1" />
																	Activar
																</>
															)}
														</Button>

														<button
															onClick={() => {
																const next = isExpanded ? null : teacher.id;
																setExpandedId(next);
																if (!next) closeAssignMode();
															}}
															className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors"
														>
															{isExpanded ? (
																<ChevronUp className="w-4 h-4" />
															) : (
																<ChevronDown className="w-4 h-4" />
															)}
														</button>
													</div>
												</div>

												{/* ── Panel expandible ── */}
												<AnimatePresence>
													{isExpanded && (
														<motion.div
															initial={{ height: 0, opacity: 0 }}
															animate={{ height: "auto", opacity: 1 }}
															exit={{ height: 0, opacity: 0 }}
															transition={{ duration: 0.2 }}
															className="overflow-hidden"
														>
															<div className="px-4 pb-4 border-t border-gray-100">
																{/* Datos de contacto */}
																<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
																	<div className="flex items-center gap-2 text-xs text-gray-600">
																		<Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
																		<span className="truncate">
																			{teacher.email}
																		</span>
																	</div>
																	{teacher.telefono && (
																		<div className="flex items-center gap-2 text-xs text-gray-600">
																			<Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
																			<span>{teacher.telefono}</span>
																		</div>
																	)}
																	{teacher.dni && (
																		<div className="flex items-center gap-2 text-xs text-gray-600">
																			<span className="text-gray-400 font-mono text-[10px]">
																				DNI
																			</span>
																			<span>{teacher.dni}</span>
																		</div>
																	)}
																</div>

																{/* ── Asignación de cursos ── */}
																<div className="mt-4 pt-3 border-t border-gray-100">
																	<div className="flex items-center justify-between mb-2">
																		<p className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
																			<BookOpen className="w-3.5 h-3.5 text-[#4338ca]" />
																			Cursos asignados
																		</p>
																		{!isAssigningThis && (
																			<button
																				onClick={() => {
																					setAssigningTeacherId(teacher.id);
																					setSelectedCursoId("");
																				}}
																				className="text-[10px] font-bold text-[#4338ca] hover:text-[#3730a3] flex items-center gap-1 transition-colors"
																			>
																				<PlusCircle className="w-3.5 h-3.5" />
																				Asignar curso
																			</button>
																		)}
																	</div>

																	{/* Listado de cursos con opción a eliminar */}
																	{teacher.cursosAsignados.length > 0 &&
																		!isAssigningThis && (
																			<div className="flex flex-col gap-1.5 mb-3">
																				{teacher.cursosAsignados.map((c) => (
																					<div
																						key={c.id}
																						className="flex items-center justify-between bg-white border border-gray-100 px-3 py-1.5 rounded-lg"
																					>
																						<span className="text-xs font-semibold text-gray-700">
																							{c.nombre}
																						</span>
																						<button
																							onClick={() =>
																								doQuitarCurso(teacher.id, c.id)
																							}
																							disabled={isRemoving === c.id}
																							className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors disabled:opacity-50"
																							title="Quitar curso"
																						>
																							{isRemoving === c.id ? (
																								<Loader2 className="w-3 h-3 animate-spin" />
																							) : (
																								<X className="w-3 h-3" />
																							)}
																						</button>
																					</div>
																				))}
																			</div>
																		)}

																	{/* Selector inline para agregar curso */}
																	<AnimatePresence>
																		{isAssigningThis && (
																			<motion.div
																				initial={{ opacity: 0, y: -4 }}
																				animate={{ opacity: 1, y: 0 }}
																				exit={{ opacity: 0, y: -4 }}
																				className="space-y-2 mt-2"
																			>
																				<div className="flex gap-2">
																					<select
																						value={selectedCursoId}
																						onChange={(e) =>
																							handleSelectCurso(
																								teacher.id,
																								e.target.value,
																							)
																						}
																						className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 focus:ring-2 focus:ring-[#4338ca]/20 focus:border-[#4338ca] outline-none transition-all"
																					>
																						<option value="">
																							— Elegir un curso —
																						</option>
																						{allCursos.map((c) => {
																							// Deshabilitamos el curso si el profesor YA LO TIENE asignado
																							const yaTieneElCurso =
																								teacher.cursosAsignados.some(
																									(asig) => asig.id === c.id,
																								);
																							return (
																								<option
																									key={c.id}
																									value={c.id}
																									disabled={yaTieneElCurso}
																								>
																									{c.nombre}
																									{yaTieneElCurso
																										? " ✓ ya lo tiene"
																										: ""}
																								</option>
																							);
																						})}
																					</select>
																					<button
																						onClick={closeAssignMode}
																						className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 transition-colors shrink-0"
																					>
																						<XCircle className="w-3.5 h-3.5" />
																					</button>
																				</div>
																			</motion.div>
																		)}
																	</AnimatePresence>

																	{/* Mensaje sin cursos */}
																	{teacher.cursosAsignados.length === 0 &&
																		!isAssigningThis && (
																			<p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
																				⚠️ Sin cursos asignados todavía.
																			</p>
																		)}
																</div>
															</div>
														</motion.div>
													)}
												</AnimatePresence>
											</div>
										);
									})
								)}
							</div>

							{/* Footer */}
							<div className="px-6 py-4 border-t border-gray-100 shrink-0 flex justify-end">
								<Button
									onClick={onClose}
									variant="outline"
									className="rounded-xl text-gray-600"
								>
									Cerrar
								</Button>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
