"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
	Search,
	Filter,
	Pencil,
	Loader2,
	ChevronDown,
	X,
	Mail,
	Phone,
	GraduationCap,
	UserCheck,
	BookUser,
} from "lucide-react";
import { motion } from "framer-motion";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import UserInfoModal from "./UserInfoModal"; // 👈 Ajusta el path según tu estructura
import EditUserInfoModal from "./EditUserInfoModal"; // 👈 Ajusta el path según tu estructura

// --- INTERFACES ---
interface StudentRow {
	id: string;
	nombre: string;
	apellido: string;
	dni: string;
	email?: string;
	telefono?: string;
	fechaNacimiento: string;
	edad: number;
	cursos: string[];
	tipo: "Titular" | "Menor";
	isTutor: boolean;
	nombreTutor?: string;
}

interface CourseMap {
	[key: string]: string;
}

export default function AlumnosTable() {
	// --- ESTADOS ---
	const [students, setStudents] = useState<StudentRow[]>([]);
	const [coursesMap, setCoursesMap] = useState<CourseMap>({});
	const [isLoading, setIsLoading] = useState(true);

	// Filtros
	const [searchTerm, setSearchTerm] = useState("");
	const [courseFilter, setCourseFilter] = useState("Todos");
	const [typeFilter, setTypeFilter] = useState("Todos");

	// Modal Ver Info
	const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(
		null,
	);
	const [isModalOpen, setIsModalOpen] = useState(false);

	// Modal Editar
	const [editStudent, setEditStudent] = useState<StudentRow | null>(null);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);

	// --- FUNCIONES AUXILIARES ---
	const calcularEdad = (fecha: string) => {
		if (!fecha) return 0;
		const hoy = new Date();
		const cumple = new Date(fecha);
		let edad = hoy.getFullYear() - cumple.getFullYear();
		const m = hoy.getMonth() - cumple.getMonth();
		if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) {
			edad--;
		}
		return Math.max(0, edad);
	};

	const handleOpenModal = (student: StudentRow) => {
		setSelectedStudent(student);
		setIsModalOpen(true);
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
		setTimeout(() => setSelectedStudent(null), 300);
	};

	const handleOpenEditModal = (student: StudentRow) => {
		setEditStudent(student);
		setIsEditModalOpen(true);
	};

	const handleCloseEditModal = () => {
		setIsEditModalOpen(false);
		setTimeout(() => setEditStudent(null), 300);
	};

	// Actualiza el estudiante en la lista local sin refetch
	const handleEditSuccess = (updatedStudent: StudentRow) => {
		setStudents((prev) =>
			prev.map((s) => (s.id === updatedStudent.id ? updatedStudent : s)),
		);
	};

	// --- CARGA DE DATOS ---
	const fetchData = async () => {
		setIsLoading(true);
		try {
			const cursosRef = collection(db, "Cursos");
			const cursosSnap = await getDocs(cursosRef);
			const cMap: CourseMap = {};
			cursosSnap.forEach((doc) => {
				cMap[doc.id] = doc.data().nombre;
			});
			setCoursesMap(cMap);

			const usersRef = collection(db, "Users");
			const usersSnap = await getDocs(usersRef);
			const usersData: StudentRow[] = usersSnap.docs.map((doc) => {
				const data = doc.data();
				return {
					id: doc.id,
					nombre: data.nombre || "",
					apellido: data.apellido || "",
					dni: data.dni || "",
					email: data.email || "",
					telefono: data.telefono || "",
					fechaNacimiento: data.fechaNacimiento || "",
					edad: calcularEdad(data.fechaNacimiento),
					cursos: data.cursos || [],
					tipo: "Titular",
					isTutor: data.isTutor || false,
				};
			});

			const hijosRef = collection(db, "Hijos");
			const hijosSnap = await getDocs(hijosRef);
			const hijosData: StudentRow[] = hijosSnap.docs.map((doc) => {
				const data = doc.data();

				const tutor = usersData.find((u) => u.id === data.tutorId);
				const nombreTutor = tutor
					? `${tutor.nombre} ${tutor.apellido}`
					: "Tutor Desconocido";

				return {
					id: doc.id,
					nombre: data.nombre || "",
					apellido: data.apellido || "",
					dni: data.dni || "",
					email: "Menor",
					telefono: "",
					fechaNacimiento: data.fechaNacimiento || "",
					edad: calcularEdad(data.fechaNacimiento),
					cursos: data.cursos || [],
					tipo: "Menor",
					isTutor: false,
					nombreTutor: nombreTutor,
				};
			});

			const allStudents = [...usersData, ...hijosData].sort((a, b) =>
				a.nombre.localeCompare(b.nombre),
			);

			setStudents(allStudents);
		} catch (error) {
			console.error("Error cargando datos de alumnos:", error);
			alert("Hubo un error al cargar los alumnos.");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// --- LÓGICA DE FILTRADO ---
	const filteredStudents = useMemo(() => {
		return students.filter((student) => {
			const searchLower = searchTerm.toLowerCase();
			const matchesSearch =
				student.nombre.toLowerCase().includes(searchLower) ||
				student.apellido.toLowerCase().includes(searchLower) ||
				student.dni.includes(searchLower);

			let matchesType = true;
			if (typeFilter === "Titular") matchesType = student.tipo === "Titular";
			if (typeFilter === "Menor") matchesType = student.tipo === "Menor";
			if (typeFilter === "Tutor") matchesType = student.isTutor === true;

			let matchesCourse = true;
			if (courseFilter === "Sin Curso") {
				matchesCourse = student.cursos.length === 0;
			} else if (courseFilter !== "Todos") {
				matchesCourse = student.cursos.includes(courseFilter);
			}

			return matchesSearch && matchesType && matchesCourse;
		});
	}, [students, searchTerm, typeFilter, courseFilter]);

	return (
		<>
			{/* ===== MODAL VER INFO ===== */}
			<UserInfoModal
				student={selectedStudent}
				isOpen={isModalOpen}
				onClose={handleCloseModal}
				coursesMap={coursesMap}
			/>

			{/* ===== MODAL EDITAR ===== */}
			<EditUserInfoModal
				student={editStudent}
				isOpen={isEditModalOpen}
				onClose={handleCloseEditModal}
				onSuccess={handleEditSuccess}
				coursesMap={coursesMap}
			/>

			<div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[600px]">
				{/* BARRA DE FILTROS */}
				<div className="p-4 border-b border-gray-100 bg-gray-50/50">
					<div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
						{/* Buscador */}
						<div className="relative w-full xl:w-96 group">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<Search className="h-4 w-4 text-gray-400 group-focus-within:text-[#252d62] transition-colors" />
							</div>
							<input
								type="text"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="text-black block w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] sm:text-sm transition-all"
								placeholder="Buscar por nombre, apellido o DNI..."
							/>
							{searchTerm && (
								<button
									onClick={() => setSearchTerm("")}
									className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
								>
									<X className="h-4 w-4" />
								</button>
							)}
						</div>

						{/* Selects de Filtros */}
						<div className="grid grid-cols-1 sm:grid-cols-2 xl:flex gap-3 w-full xl:w-auto">
							<div className="relative w-full">
								<select
									value={typeFilter}
									onChange={(e) => setTypeFilter(e.target.value)}
									className="appearance-none w-full bg-white border border-gray-200 text-gray-700 py-2 pl-9 pr-8 rounded-md focus:outline-none focus:border-[#252d62] focus:ring-2 focus:ring-[#252d62]/20 text-sm font-medium cursor-pointer hover:border-[#252d62] transition-colors"
								>
									<option value="Todos">Todos los Perfiles</option>
									<option value="Titular">Solo Titulares</option>
									<option value="Menor">Solo Menores</option>
									<option value="Tutor">Solo Tutores (A cargo)</option>
								</select>
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
									<Filter className="h-3.5 w-3.5" />
								</div>
								<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
									<ChevronDown className="h-4 w-4" />
								</div>
							</div>

							<div className="relative w-full">
								<select
									value={courseFilter}
									onChange={(e) => setCourseFilter(e.target.value)}
									className="appearance-none w-full bg-white border border-gray-200 text-gray-700 py-2 pl-9 pr-8 rounded-md focus:outline-none focus:border-[#252d62] focus:ring-2 focus:ring-[#252d62]/20 text-sm font-medium cursor-pointer hover:border-[#252d62] transition-colors"
								>
									<option value="Todos">Todos los Cursos</option>
									<option value="Sin Curso">Sin Curso Asignado</option>
									{Object.entries(coursesMap).map(([id, nombre]) => (
										<option key={id} value={id}>
											{nombre}
										</option>
									))}
								</select>
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
									<GraduationCap className="h-3.5 w-3.5" />
								</div>
								<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
									<ChevronDown className="h-4 w-4" />
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* TABLA Y TARJETAS */}
				<div className="flex-1 overflow-auto bg-white">
					{isLoading ? (
						<div className="flex flex-col justify-center items-center h-64 gap-4">
							<Loader2 className="w-10 h-10 animate-spin text-[#EE1120]" />
							<p className="text-gray-500 font-medium">Cargando alumnos...</p>
						</div>
					) : (
						<>
							{/* --- VISTA MÓVIL (Tarjetas) --- */}
							<div className="md:hidden flex flex-col p-4 gap-4 bg-gray-50/30">
								{filteredStudents.map((student, index) => (
									<motion.div
										key={`mobile-${student.id}`}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.2, delay: index * 0.05 }}
										className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 relative"
									>
										<div className="absolute top-4 right-4 flex items-center gap-1">
											{/* Botón Ver Info */}
											<button
												onClick={() => handleOpenModal(student)}
												className="p-2 text-gray-400 hover:text-[#252d62] hover:bg-blue-50 rounded-full transition-colors"
												title="Ver información del alumno"
											>
												<BookUser className="w-4 h-4" />
											</button>
											{/* Botón Editar */}
											<button
												onClick={() => handleOpenEditModal(student)}
												className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
											>
												<Pencil className="w-4 h-4" />
											</button>
										</div>

										<div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-3 pr-12">
											<div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-[#252d62] font-bold text-lg shrink-0">
												{student.nombre.charAt(0).toUpperCase()}
											</div>
											<div>
												<h3 className="font-bold text-[#252d62] text-lg leading-tight">
													{student.nombre} {student.apellido}
												</h3>
												<div className="flex items-center gap-2 mt-1 flex-wrap">
													<span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase font-bold tracking-wide">
														{student.tipo}
													</span>
													{student.isTutor && (
														<span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded uppercase font-bold tracking-wide">
															Tutor
														</span>
													)}
												</div>
											</div>
										</div>

										<div className="grid grid-cols-1 gap-y-3 text-sm">
											<div className="flex items-center justify-between">
												<span className="text-gray-500">DNI:</span>
												<span className="font-mono font-medium">
													{student.dni}
												</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-gray-500">Edad:</span>
												<span className="font-medium">{student.edad} años</span>
											</div>

											{student.tipo === "Titular" ? (
												<div className="flex flex-col gap-1">
													<div className="flex items-center justify-between">
														<span className="text-gray-500">Email:</span>
														<span className="font-medium text-blue-600 truncate max-w-[200px]">
															{student.email}
														</span>
													</div>
													{student.telefono && (
														<div className="flex items-center justify-between">
															<span className="text-gray-500">Teléfono:</span>
															<span className="font-medium">
																{student.telefono}
															</span>
														</div>
													)}
												</div>
											) : (
												<div className="flex flex-col gap-1 border-t border-gray-100 pt-2 mt-1">
													<span className="flex items-center gap-1.5 text-gray-500 font-medium">
														<UserCheck className="w-4 h-4 text-[#252d62]" />
														Tutor:{" "}
														<span className="font-bold text-[#252d62]">
															{student.nombreTutor}
														</span>
													</span>
												</div>
											)}

											<div className="mt-2 pt-3 border-t border-gray-100">
												<span className="text-xs text-gray-400 block mb-2 font-bold uppercase tracking-wider">
													Cursos Asignados
												</span>
												<div className="flex flex-wrap gap-1.5">
													{student.cursos.length > 0 ? (
														student.cursos.map((cursoId) => (
															<span
																key={cursoId}
																className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-[#252d62]/10 text-[#252d62]"
															>
																{coursesMap[cursoId] || "Curso Desconocido"}
															</span>
														))
													) : (
														<span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-1 rounded-md border border-red-100">
															Sin cursos
														</span>
													)}
												</div>
											</div>
										</div>
									</motion.div>
								))}
							</div>

							{/* --- VISTA DESKTOP (Tabla Clásica) --- */}
							<div className="hidden md:block w-full">
								<table className="min-w-full divide-y divide-gray-200">
									<thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
										<tr>
											<th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Alumno
											</th>
											<th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												DNI
											</th>
											<th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Edad
											</th>
											<th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Contacto
											</th>
											<th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Cursos
											</th>
											<th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
												Acciones
											</th>
										</tr>
									</thead>
									<tbody className="bg-white divide-y divide-gray-100">
										{filteredStudents.map((student, index) => (
											<motion.tr
												key={student.id}
												initial={{ opacity: 0, y: 10 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{ duration: 0.2, delay: index * 0.02 }}
												className="hover:bg-blue-50/50 transition-colors"
											>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="flex items-center">
														<div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-[#252d62] font-bold mr-3 shrink-0">
															{student.nombre.charAt(0).toUpperCase()}
														</div>
														<div className="flex flex-col">
															<span className="text-sm font-bold text-[#252d62]">
																{student.nombre} {student.apellido}
															</span>
															<div className="flex gap-1 mt-0.5">
																<span className="text-[10px] text-gray-500 uppercase font-semibold">
																	{student.tipo}
																</span>
																{student.isTutor && (
																	<span className="text-[10px] text-purple-600 uppercase font-bold ml-1">
																		• Tutor
																	</span>
																)}
															</div>
														</div>
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
													{student.dni}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
													{student.edad} años
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="flex flex-col text-xs text-gray-500">
														{student.tipo === "Titular" ? (
															<>
																<span className="flex items-center gap-1">
																	<Mail className="w-3 h-3" /> {student.email}
																</span>
																{student.telefono && (
																	<span className="flex items-center gap-1 mt-1">
																		<Phone className="w-3 h-3" />{" "}
																		{student.telefono}
																	</span>
																)}
															</>
														) : (
															<span className="flex items-center gap-1.5 font-medium">
																<UserCheck className="w-3.5 h-3.5" />
																Tutor: {student.nombreTutor}
															</span>
														)}
													</div>
												</td>
												<td className="px-6 py-4">
													<div className="flex flex-wrap gap-1.5">
														{student.cursos.length > 0 ? (
															student.cursos.map((cursoId) => (
																<span
																	key={cursoId}
																	className="inline-flex items-center px-2 py-1 rounded text-[11px] font-bold bg-[#252d62]/10 text-[#252d62] whitespace-nowrap"
																>
																	{coursesMap[cursoId] || "Curso Desconocido"}
																</span>
															))
														) : (
															<span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-bold bg-gray-50 text-gray-900 border border-gray-100">
																Sin cursos
															</span>
														)}
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-right">
													<div className="flex items-center justify-end gap-2">
														{/* Botón Ver Info */}
														<button
															onClick={() => handleOpenModal(student)}
															className="p-1.5 text-gray-400 hover:text-[#252d62] hover:bg-blue-50 rounded-lg transition-colors"
															title="Ver información del alumno"
														>
															<BookUser className="w-4 h-4" />
														</button>
														{/* Botón Editar */}
														<button
															onClick={() => handleOpenEditModal(student)}
															className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
															title="Editar alumno"
														>
															<Pencil className="w-4 h-4" />
														</button>
													</div>
												</td>
											</motion.tr>
										))}
									</tbody>
								</table>
							</div>
						</>
					)}

					{!isLoading && filteredStudents.length === 0 && (
						<div className="p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
							<Search className="h-12 w-12 text-gray-300 mb-4" />
							<p className="text-xl font-bold text-[#252d62]">
								No se encontraron alumnos
							</p>
							<p className="text-gray-500 mt-2 max-w-md">
								No hay resultados que coincidan con los filtros actuales.
								Intenta cambiar tu búsqueda o los parámetros.
							</p>
						</div>
					)}
				</div>
			</div>
		</>
	);
}
