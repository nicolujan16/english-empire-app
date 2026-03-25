"use client";

import React, {
	useState,
	useEffect,
	useMemo,
	useRef,
	useCallback,
} from "react";
import {
	Search,
	Filter,
	Pencil,
	Loader2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	X,
	Mail,
	Phone,
	GraduationCap,
	UserCheck,
	BookUser,
	Printer,
	Percent,
	AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import UserInfoModal from "./UserInfoModal";
import EditUserInfoModal from "./EditUserInfoModal";

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
	telefonoTutor?: string;
	emailTutor?: string;
	etiquetas?: string[];
	dniTutor?: string;
}

interface CourseMap {
	[key: string]: string;
}

interface EtiquetaInfo {
	id: string;
	nombre: string;
	color: string;
	descuentoInscripcion: number | null;
	descuentoCuota: number | null;
	acumulableConGrupoFamiliar: boolean;
}

type EtiquetasMap = Record<string, EtiquetaInfo>;

interface AlumnosTableProps {
	newStudent?: StudentRow | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

const COLORES_BADGE: Record<string, string> = {
	emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
	blue: "bg-blue-100 text-blue-700 border-blue-200",
	violet: "bg-violet-100 text-violet-700 border-violet-200",
	amber: "bg-amber-100 text-amber-700 border-amber-200",
	rose: "bg-rose-100 text-rose-700 border-rose-200",
	cyan: "bg-cyan-100 text-cyan-700 border-cyan-200",
	gray: "bg-gray-100 text-gray-700 border-gray-200",
};

const COLORES_DOT: Record<string, string> = {
	emerald: "bg-emerald-400",
	blue: "bg-blue-400",
	violet: "bg-violet-400",
	amber: "bg-amber-400",
	rose: "bg-rose-400",
	cyan: "bg-cyan-400",
	gray: "bg-gray-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcularEdad = (fecha: string) => {
	if (!fecha) return 0;
	const hoy = new Date();
	const cumple = new Date(fecha);
	let edad = hoy.getFullYear() - cumple.getFullYear();
	const m = hoy.getMonth() - cumple.getMonth();
	if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) edad--;
	return Math.max(0, edad);
};

// "Consejo de Ciencias Económicas" → "CCE" | "Referidos" → "Referidos"
const getIniciales = (nombre: string): string => {
	const palabras = nombre.trim().split(/\s+/);
	if (palabras.length === 1) return palabras[0].slice(0, 7);
	return palabras.map((p) => p[0].toUpperCase()).join("");
};

// ─── EtiquetaBadge ────────────────────────────────────────────────────────────

const TOOLTIP_WIDTH = 208;
const TOOLTIP_HEIGHT = 130;

function EtiquetaBadge({ etiqueta }: { etiqueta: EtiquetaInfo }) {
	const badgeClass = COLORES_BADGE[etiqueta.color] ?? COLORES_BADGE.gray;
	const dotClass = COLORES_DOT[etiqueta.color] ?? COLORES_DOT.gray;
	const iniciales = getIniciales(etiqueta.nombre);

	const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
		null,
	);
	const badgeRef = useRef<HTMLSpanElement>(null);

	const showTooltip = useCallback(() => {
		if (!badgeRef.current) return;
		const rect = badgeRef.current.getBoundingClientRect();

		let x = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
		let y = rect.top - TOOLTIP_HEIGHT - 10; // 10px de margen

		if (x + TOOLTIP_WIDTH > window.innerWidth - 8) {
			x = window.innerWidth - TOOLTIP_WIDTH - 8;
		}
		if (x < 8) x = 8;

		if (y < 8) y = rect.bottom + 10;

		setTooltipPos({ x, y });
	}, []);

	const hideTooltip = useCallback(() => setTooltipPos(null), []);

	return (
		<>
			<span
				ref={badgeRef}
				onMouseEnter={showTooltip}
				onMouseLeave={hideTooltip}
				className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-full border cursor-default select-none ${badgeClass}`}
			>
				{iniciales}
			</span>

			{/* Tooltip renderizado en posición fixed — escapa del overflow */}
			{tooltipPos && (
				<div
					className="fixed z-[9999] pointer-events-none"
					style={{
						left: tooltipPos.x,
						top: tooltipPos.y,
						width: "auto",
					}}
				>
					<div className="bg-[#1a2248] text-white rounded-xl shadow-xl p-2">
						{/* Título */}
						<div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
							<span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
							<p className="text-xs font-bold leading-tight">
								{etiqueta.nombre}
							</p>
						</div>
						{/* Descuentos */}
						<div className="space-y-1">
							{etiqueta.descuentoInscripcion && (
								<div className="flex items-center justify-between text-[11px]">
									<span className="text-white/60">Inscripción</span>
									<span className="font-bold text-emerald-400">
										{etiqueta.descuentoInscripcion}% off
									</span>
								</div>
							)}
							{etiqueta.descuentoCuota && (
								<div className="flex items-center justify-between text-[11px]">
									<span className="text-white/60">Cuotas</span>
									<span className="font-bold text-blue-300">
										{etiqueta.descuentoCuota}% off
									</span>
								</div>
							)}
						</div>
						{/* Acumulación */}
						<div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5 text-[10px]">
							<Percent className="w-2.5 h-2.5 text-white/40 shrink-0" />
							<span className="text-white/50">
								{etiqueta.acumulableConGrupoFamiliar
									? "Acumulable con Grupo Familiar"
									: "No acumulable con Grupo Familiar"}
							</span>
						</div>
					</div>
					{/* Flecha apuntando hacia abajo (hacia el badge) */}
					<div className="flex justify-center -mt-1">
						<div className="w-2 h-2 bg-[#1a2248] rotate-45" />
					</div>
				</div>
			)}
		</>
	);
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AlumnosTable({ newStudent }: AlumnosTableProps = {}) {
	const [students, setStudents] = useState<StudentRow[]>([]);
	const [coursesMap, setCoursesMap] = useState<CourseMap>({});
	const [etiquetasMap, setEtiquetasMap] = useState<EtiquetasMap>({});
	const [isLoading, setIsLoading] = useState(true);

	const [searchTerm, setSearchTerm] = useState("");
	const [courseFilter, setCourseFilter] = useState("Todos");
	const [typeFilter, setTypeFilter] = useState("Todos");
	const [etiquetaFilter, setEtiquetaFilter] = useState("Todas");
	// 🚀 NUEVO: Estado para el filtro de mail pendiente
	const [pendingEmailFilter, setPendingEmailFilter] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);

	const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(
		null,
	);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editStudent, setEditStudent] = useState<StudentRow | null>(null);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);

	const handleOpenModal = (s: StudentRow) => {
		setSelectedStudent(s);
		setIsModalOpen(true);
	};
	const handleCloseModal = () => {
		setIsModalOpen(false);
		setTimeout(() => setSelectedStudent(null), 300);
	};
	const handleOpenEditModal = (s: StudentRow) => {
		setEditStudent(s);
		setIsEditModalOpen(true);
	};
	const handleCloseEditModal = () => {
		setIsEditModalOpen(false);
		setTimeout(() => setEditStudent(null), 300);
	};
	const handleEditSuccess = (updated: StudentRow) => {
		setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
	};

	// ── Carga de datos ────────────────────────────────────────────────────────

	const fetchData = async () => {
		setIsLoading(true);
		try {
			const [cursosSnap, etiquetasSnap, usersSnap, hijosSnap] =
				await Promise.all([
					getDocs(collection(db, "Cursos")),
					getDocs(collection(db, "EtiquetasDescuento")),
					getDocs(collection(db, "Users")),
					getDocs(collection(db, "Hijos")),
				]);

			const cMap: CourseMap = {};
			cursosSnap.forEach((d) => {
				cMap[d.id] = d.data().nombre;
			});
			setCoursesMap(cMap);

			const eMap: EtiquetasMap = {};
			etiquetasSnap.forEach((d) => {
				const data = d.data();
				eMap[d.id] = {
					id: d.id,
					nombre: data.nombre || d.id,
					color: data.color ?? "gray",
					descuentoInscripcion: data.descuentoInscripcion ?? null,
					descuentoCuota: data.descuentoCuota ?? null,
					acumulableConGrupoFamiliar: data.acumulableConGrupoFamiliar ?? false,
				};
			});
			setEtiquetasMap(eMap);

			const usersData: StudentRow[] = usersSnap.docs.map((d) => {
				const data = d.data();
				return {
					id: d.id,
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
					etiquetas: data.etiquetas || [],
				};
			});

			const hijosData: StudentRow[] = hijosSnap.docs.map((d) => {
				const data = d.data();
				const dt = data.datosTutor || {};
				return {
					id: d.id,
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
					nombreTutor:
						dt.nombre && dt.apellido
							? `${dt.nombre} ${dt.apellido}`
							: "Tutor Desconocido",
					telefonoTutor: dt.telefono || "Sin teléfono",
					emailTutor: dt.email || "",
					dniTutor: dt.dni || "",
					etiquetas: data.etiquetas || [],
				};
			});

			setStudents(
				[...usersData, ...hijosData].sort((a, b) =>
					a.nombre.localeCompare(b.nombre),
				),
			);
		} catch (error) {
			console.error("Error cargando datos de alumnos:", error);
			alert("Hubo un error al cargar los alumnos.");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchData();
	}, []);

	useEffect(() => {
		if (newStudent) {
			setStudents((prev) => {
				if (prev.some((s) => s.id === newStudent.id)) return prev;
				const updatedList = [...prev, newStudent];
				return updatedList.sort((a, b) => a.nombre.localeCompare(b.nombre));
			});
		}
	}, [newStudent]);

	useEffect(() => {
		setCurrentPage(1);
	}, [
		searchTerm,
		typeFilter,
		courseFilter,
		etiquetaFilter,
		pendingEmailFilter,
	]);

	// ── Filtrado ──────────────────────────────────────────────────────────────

	const filteredStudents = useMemo(
		() =>
			students.filter((s) => {
				const sl = searchTerm.toLowerCase();
				const matchesSearch =
					s.nombre.toLowerCase().includes(sl) ||
					s.apellido.toLowerCase().includes(sl) ||
					s.dni.includes(sl) ||
					(s.dniTutor && s.dniTutor.includes(sl));
				const matchesType =
					typeFilter === "Todos"
						? true
						: typeFilter === "Titular"
							? s.tipo === "Titular"
							: typeFilter === "Menor"
								? s.tipo === "Menor"
								: typeFilter === "Tutor"
									? s.isTutor === true
									: true;
				const matchesCourse =
					courseFilter === "Todos"
						? true
						: courseFilter === "Sin Curso"
							? s.cursos.length === 0
							: s.cursos.includes(courseFilter);
				const matchesEtiqueta =
					etiquetaFilter === "Todas"
						? true
						: etiquetaFilter === "Sin Etiqueta"
							? !s.etiquetas?.length
							: (s.etiquetas ?? []).includes(etiquetaFilter);

				// 🚀 NUEVA LÓGICA: Filtro de mail pendiente
				const matchesPendingEmail = pendingEmailFilter
					? s.tipo === "Titular"
						? !s.email
						: !s.emailTutor
					: true;

				return (
					matchesSearch &&
					matchesType &&
					matchesCourse &&
					matchesEtiqueta &&
					matchesPendingEmail
				);
			}),
		[
			students,
			searchTerm,
			typeFilter,
			courseFilter,
			etiquetaFilter,
			pendingEmailFilter,
		],
	);

	const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
	const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
	const paginatedStudents = filteredStudents.slice(
		startIndex,
		startIndex + ITEMS_PER_PAGE,
	);

	// ── Helper: render badges ─────────────────────────────────────────────────

	const renderEtiquetas = (ids: string[] = []) => {
		const validas = ids.filter((id) => etiquetasMap[id]);
		if (!validas.length) return null;
		return (
			<span className="inline-flex items-center gap-1 flex-wrap">
				{validas.map((id) => (
					<EtiquetaBadge key={id} etiqueta={etiquetasMap[id]} />
				))}
			</span>
		);
	};

	return (
		<>
			{/* ══ VISTA IMPRESIÓN ══ */}
			<div className="hidden print:block w-full bg-white text-black p-8 font-sans">
				<div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
					<div>
						<h1 className="text-2xl font-bold uppercase tracking-wider">
							Planilla de Alumnos
						</h1>
						<p className="text-sm font-medium mt-1">English Empire Institute</p>
					</div>
					<div className="text-right text-sm space-y-0.5">
						<p>
							<strong>Fecha:</strong> {new Date().toLocaleDateString("es-AR")}
						</p>
						<p>
							<strong>Total alumnos:</strong> {filteredStudents.length}
						</p>
						<p>
							<strong>Perfil:</strong>{" "}
							{typeFilter === "Todos" ? "Todos" : typeFilter}
						</p>
						<p>
							<strong>Curso:</strong>{" "}
							{courseFilter === "Todos"
								? "Todos"
								: courseFilter === "Sin Curso"
									? "Sin Curso"
									: (coursesMap[courseFilter] ?? courseFilter)}
						</p>
						<p>
							<strong>Etiqueta:</strong>{" "}
							{etiquetaFilter === "Todas"
								? "Todas"
								: etiquetaFilter === "Sin Etiqueta"
									? "Sin Etiqueta"
									: (etiquetasMap[etiquetaFilter]?.nombre ?? etiquetaFilter)}
						</p>
					</div>
				</div>
				<table className="w-full text-left border-collapse text-sm">
					<thead>
						<tr className="border-b-2 border-black bg-gray-100">
							<th className="py-2 pr-4 pl-1 font-bold">#</th>
							<th className="py-2 pr-4 font-bold">Nombre y Apellido</th>
							<th className="py-2 pr-4 font-bold">DNI</th>
							<th className="py-2 pr-4 font-bold">Edad</th>
							<th className="py-2 pr-4 font-bold">Tipo</th>
							<th className="py-2 pr-4 font-bold">Contacto / Tutor</th>
						</tr>
					</thead>
					<tbody>
						{filteredStudents.map((s, idx) => (
							<tr
								key={`print-${s.id}`}
								className={`border-b border-gray-200 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
							>
								<td className="py-2 pr-4 pl-1 text-gray-400 text-xs">
									{idx + 1}
								</td>
								<td className="py-2 pr-4 font-semibold uppercase">
									{s.apellido}, {s.nombre}
								</td>
								<td className="py-2 pr-4 font-mono">{s.dni}</td>
								<td className="py-2 pr-4">{s.edad}</td>
								<td className="py-2 pr-4 font-bold uppercase text-xs">
									{s.tipo}
									{s.isTutor ? " · Tutor" : ""}
								</td>
								<td className="py-2 pr-4 text-xs text-gray-600">
									{s.tipo === "Titular" ? (
										<span>
											{s.email ? s.email : "Sin correo asignado"}
											{s.telefono ? ` · ${s.telefono}` : ""}
										</span>
									) : (
										<span>
											<strong>{s.nombreTutor}</strong>
											{s.telefonoTutor ? ` · ${s.telefonoTutor}` : ""}
										</span>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				<p className="text-xs text-gray-400 mt-8 text-center border-t border-gray-200 pt-4">
					Documento generado automáticamente por el sistema de gestión.
				</p>
			</div>

			{/* ══ VISTA WEB ══ */}
			<div className="print:hidden">
				<UserInfoModal
					student={selectedStudent}
					isOpen={isModalOpen}
					onClose={handleCloseModal}
					coursesMap={coursesMap}
				/>
				<EditUserInfoModal
					student={editStudent}
					isOpen={isEditModalOpen}
					onClose={handleCloseEditModal}
					onSuccess={handleEditSuccess}
					coursesMap={coursesMap}
				/>

				<div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[600px]">
					{/* ── Filtros ── */}
					<div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
						{/* Fila principal de filtros */}
						<div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
							<div className="relative w-full xl:w-96 group">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<Search className="h-4 w-4 text-gray-400 group-focus-within:text-[#252d62] transition-colors" />
								</div>
								<input
									type="text"
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="text-black block w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] sm:text-sm transition-all"
									placeholder="Nombre, apellido, DNI o DNI de tutor... "
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

							<div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-center">
								<div className="relative w-full sm:w-auto">
									<select
										value={typeFilter}
										onChange={(e) => setTypeFilter(e.target.value)}
										className="appearance-none w-full sm:w-48 bg-white border border-gray-200 text-gray-700 py-2 pl-9 pr-8 rounded-md focus:outline-none focus:border-[#252d62] focus:ring-2 focus:ring-[#252d62]/20 text-sm font-medium cursor-pointer hover:border-[#252d62] transition-colors"
									>
										<option value="Todos">Todos los Perfiles</option>
										<option value="Titular">Solo Titulares</option>
										<option value="Menor">Solo Menores</option>
										<option value="Tutor">Solo Tutores</option>
									</select>
									<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
										<Filter className="h-3.5 w-3.5" />
									</div>
									<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
										<ChevronDown className="h-4 w-4" />
									</div>
								</div>

								<div className="relative w-full sm:w-auto">
									<select
										value={courseFilter}
										onChange={(e) => setCourseFilter(e.target.value)}
										className="appearance-none w-full sm:w-56 bg-white border border-gray-200 text-gray-700 py-2 pl-9 pr-8 rounded-md focus:outline-none focus:border-[#252d62] focus:ring-2 focus:ring-[#252d62]/20 text-sm font-medium cursor-pointer hover:border-[#252d62] transition-colors"
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

								<div className="relative w-full sm:w-auto">
									<select
										value={etiquetaFilter}
										onChange={(e) => setEtiquetaFilter(e.target.value)}
										className={`appearance-none w-full sm:w-48 bg-white border py-2 pl-9 pr-8 rounded-md focus:outline-none focus:ring-2 text-sm font-medium cursor-pointer transition-colors ${
											etiquetaFilter !== "Todas"
												? "border-emerald-300 text-emerald-700 focus:border-emerald-500 focus:ring-emerald-500/20 hover:border-emerald-400"
												: "border-gray-200 text-gray-700 focus:border-[#252d62] focus:ring-[#252d62]/20 hover:border-[#252d62]"
										}`}
									>
										<option value="Todas">Todas las Etiquetas</option>
										<option value="Sin Etiqueta">Sin Etiqueta</option>
										{Object.values(etiquetasMap).map((e) => (
											<option key={e.id} value={e.id}>
												{e.nombre}
											</option>
										))}
									</select>
									<div
										className={`pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 ${etiquetaFilter !== "Todas" ? "text-emerald-500" : "text-gray-500"}`}
									>
										<Percent className="h-3.5 w-3.5" />
									</div>
									<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
										<ChevronDown className="h-4 w-4" />
									</div>
								</div>

								<button
									onClick={() => window.print()}
									disabled={isLoading || filteredStudents.length === 0}
									className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 py-2 px-4 rounded-md text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
								>
									<Printer className="w-4 h-4" />
									<span className="hidden sm:inline">Imprimir</span>
								</button>
							</div>
						</div>

						{/* 🚀 NUEVA FILA: Checkbox de correos pendientes */}
						<div className="flex items-center gap-2 px-1">
							<label className="flex items-center gap-2 cursor-pointer group">
								<input
									type="checkbox"
									checked={pendingEmailFilter}
									onChange={(e) => setPendingEmailFilter(e.target.checked)}
									className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-600 cursor-pointer"
								/>
								<span className="text-sm font-semibold text-gray-600 group-hover:text-gray-900 transition-colors flex items-center gap-1.5">
									<AlertCircle className="w-3.5 h-3.5 text-amber-500" />
									Ver únicamente usuarios con mail pendiente (Sin acceso web)
								</span>
							</label>
						</div>
					</div>

					{/* ── Contenido ── */}
					<div className="flex-1 overflow-auto bg-white flex flex-col">
						{isLoading ? (
							<div className="flex flex-col justify-center items-center h-64 gap-4 flex-1">
								<Loader2 className="w-10 h-10 animate-spin text-[#EE1120]" />
								<p className="text-gray-500 font-medium">Cargando alumnos...</p>
							</div>
						) : (
							<>
								{/* ── Mobile ── */}
								<div className="md:hidden flex flex-col p-4 gap-4 bg-gray-50/30 flex-1">
									{paginatedStudents.map((student, index) => (
										<motion.div
											key={`mobile-${student.id}`}
											initial={{ opacity: 0, y: 10 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.2, delay: index * 0.05 }}
											className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 relative"
										>
											<div className="absolute top-4 right-4 flex items-center gap-1">
												<button
													onClick={() => handleOpenModal(student)}
													className="p-2 text-gray-400 hover:text-[#252d62] hover:bg-blue-50 rounded-full transition-colors"
												>
													<BookUser className="w-4 h-4" />
												</button>
												<button
													onClick={() => handleOpenEditModal(student)}
													className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
												>
													<Pencil className="w-4 h-4" />
												</button>
											</div>

											<div className="flex items-start gap-3 mb-4 border-b border-gray-100 pb-3 pr-12">
												<div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-[#252d62] font-bold text-lg shrink-0">
													{student.nombre.charAt(0).toUpperCase()}
												</div>
												<div className="min-w-0">
													{/* Nombre + etiquetas */}
													<div className="flex items-center gap-1.5 flex-wrap">
														<h3 className="font-bold text-[#252d62] text-base leading-tight">
															{student.nombre} {student.apellido}
														</h3>
														{renderEtiquetas(student.etiquetas)}
													</div>
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
													<span className="font-medium">
														{student.edad} años
													</span>
												</div>
												{student.tipo === "Titular" ? (
													<div className="flex flex-col gap-1">
														<div className="flex items-center justify-between">
															<span className="text-gray-500">Email:</span>
															<span
																className={`font-medium truncate max-w-[200px] ${student.email ? "text-blue-600" : "text-amber-600 italic"}`}
															>
																{student.email
																	? student.email
																	: "Sin correo asignado"}
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
														<span className="flex items-center gap-1.5 text-gray-500 font-medium ml-5">
															<Phone className="w-3.5 h-3.5 text-gray-400" />
															{student.telefonoTutor}
														</span>
														<span className="flex items-center gap-1.5 text-gray-500 font-medium ml-5">
															<Mail className="w-3.5 h-3.5 text-gray-400" />
															<span
																className={
																	student.emailTutor
																		? ""
																		: "text-amber-600 italic"
																}
															>
																{student.emailTutor
																	? student.emailTutor
																	: "Sin correo asignado"}
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
															student.cursos.map((id) => (
																<span
																	key={id}
																	className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-[#252d62]/10 text-[#252d62]"
																>
																	{coursesMap[id] || "Curso Desconocido"}
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

								{/* ── Desktop ── */}
								<div className="hidden md:block w-full flex-1">
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
											{paginatedStudents.map((student, index) => (
												<motion.tr
													key={student.id}
													initial={{ opacity: 0, y: 10 }}
													animate={{ opacity: 1, y: 0 }}
													transition={{ duration: 0.2, delay: index * 0.02 }}
													className="hover:bg-blue-50/50 transition-colors"
												>
													<td className="px-6 py-4 whitespace-nowrap">
														<div className="flex items-center gap-3">
															<div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-[#252d62] font-bold shrink-0">
																{student.nombre.charAt(0).toUpperCase()}
															</div>
															<div className="flex flex-col min-w-0">
																{/* Nombre + badges en la misma línea */}
																<div className="flex items-center gap-1.5 flex-wrap">
																	<span className="text-sm font-bold text-[#252d62]">
																		{student.nombre} {student.apellido}
																	</span>
																	{renderEtiquetas(student.etiquetas)}
																</div>
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
																		<Mail className="w-3 h-3" />{" "}
																		<span
																			className={
																				student.email
																					? ""
																					: "text-amber-600 italic font-semibold"
																			}
																		>
																			{student.email
																				? student.email
																				: "Sin correo asignado"}
																		</span>
																	</span>
																	{student.telefono && (
																		<span className="flex items-center gap-1 mt-1">
																			<Phone className="w-3 h-3" />{" "}
																			{student.telefono}
																		</span>
																	)}
																</>
															) : (
																<>
																	<span className="flex items-center gap-1.5 font-medium">
																		<UserCheck className="w-3.5 h-3.5" /> Tutor:{" "}
																		{student.nombreTutor}
																	</span>
																	<span className="flex items-center gap-1 mt-1">
																		<Phone className="w-3 h-3" />{" "}
																		{student.telefonoTutor}
																	</span>
																	<span className="flex items-center gap-1 mt-1">
																		<Mail className="w-3 h-3" />{" "}
																		<span
																			className={
																				student.emailTutor
																					? ""
																					: "text-amber-600 italic font-semibold"
																			}
																		>
																			{student.emailTutor
																				? student.emailTutor
																				: "Sin correo asignado"}
																		</span>
																	</span>
																</>
															)}
														</div>
													</td>
													<td className="px-6 py-4">
														<div className="flex flex-wrap gap-1.5">
															{student.cursos.length > 0 ? (
																student.cursos.map((id) => (
																	<span
																		key={id}
																		className="inline-flex items-center px-2 py-1 rounded text-[11px] font-bold bg-[#252d62]/10 text-[#252d62] whitespace-nowrap"
																	>
																		{coursesMap[id] || "Curso Desconocido"}
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
															<button
																onClick={() => handleOpenModal(student)}
																className="p-1.5 text-gray-400 hover:text-[#252d62] hover:bg-blue-50 rounded-lg transition-colors"
															>
																<BookUser className="w-4 h-4" />
															</button>
															<button
																onClick={() => handleOpenEditModal(student)}
																className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
								</p>
							</div>
						)}
					</div>

					{/* ── Paginación ── */}
					{!isLoading && filteredStudents.length > 0 && (
						<div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
							<p className="text-sm text-gray-500 font-medium">
								Mostrando{" "}
								<span className="font-bold text-gray-900">
									{startIndex + 1}
								</span>{" "}
								a{" "}
								<span className="font-bold text-gray-900">
									{Math.min(
										startIndex + ITEMS_PER_PAGE,
										filteredStudents.length,
									)}
								</span>{" "}
								de{" "}
								<span className="font-bold text-gray-900">
									{filteredStudents.length}
								</span>{" "}
								alumnos
							</p>
							<div className="flex items-center gap-2">
								<button
									onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
									disabled={currentPage === 1}
									className="p-2 rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									<ChevronLeft className="w-4 h-4" />
								</button>
								<span className="text-sm font-medium text-gray-700 px-2">
									Página {currentPage} de {totalPages}
								</span>
								<button
									onClick={() =>
										setCurrentPage((p) => Math.min(p + 1, totalPages))
									}
									disabled={currentPage === totalPages}
									className="p-2 rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									<ChevronRight className="w-4 h-4" />
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</>
	);
}
