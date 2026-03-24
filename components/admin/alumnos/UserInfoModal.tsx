"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	X,
	User,
	Mail,
	Phone,
	CreditCard,
	Calendar,
	GraduationCap,
	UserCheck,
	Users,
	CheckCircle2,
	XCircle,
	Clock,
	Loader2,
	BadgeCheck,
	// Hash,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

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

interface HijoDetalle {
	id: string;
	nombre: string;
	apellido: string;
	dni: string;
	fechaNacimiento: string;
	edad: number;
	cursos: string[];
	cuotasPagadas?: Record<string, Record<string, boolean>>;
}

interface CourseDetail {
	nombre: string;
	mesInicio: number; // 1 = Enero ... 12 = Diciembre
	mesFin: number;
}

interface CourseMap {
	[key: string]: string;
}

interface CourseDetailsMap {
	[key: string]: CourseDetail;
}

interface CuotasPagadas {
	[cursoId: string]: {
		[mes: string]: boolean;
	};
}

interface UserInfoModalProps {
	student: StudentRow | null;
	isOpen: boolean;
	onClose: () => void;
	coursesMap: CourseMap;
}

// --- HELPERS ---
const calcularEdad = (fecha: string): number => {
	if (!fecha) return 0;
	const hoy = new Date();
	const cumple = new Date(fecha);
	let edad = hoy.getFullYear() - cumple.getFullYear();
	const m = hoy.getMonth() - cumple.getMonth();
	if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) edad--;
	return Math.max(0, edad);
};

const formatDate = (fecha: string): string => {
	if (!fecha) return "—";
	const [year, month, day] = fecha.split("-");
	return `${day}/${month}/${year}`;
};

const MESES = [
	"Enero",
	"Febrero",
	"Marzo",
	"Abril",
	"Mayo",
	"Junio",
	"Julio",
	"Agosto",
	"Septiembre",
	"Octubre",
	"Noviembre",
	"Diciembre",
];

const InfoRow = ({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ElementType;
	label: string;
	value: string | React.ReactNode;
}) => (
	<div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
		<div className="w-8 h-8 rounded-lg bg-[#252d62]/8 flex items-center justify-center shrink-0 mt-0.5">
			<Icon className="w-4 h-4 text-[#252d62]" />
		</div>
		<div className="flex flex-col min-w-0">
			<span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
				{label}
			</span>
			<span className="text-sm font-semibold text-gray-800 mt-0.5 break-all">
				{value}
			</span>
		</div>
	</div>
);

const CuotasGrid = ({
	cuotasPagadas,
	cursoId,
	coursesMap,
	courseDetails,
}: {
	cuotasPagadas: CuotasPagadas | undefined;
	cursoId: string;
	coursesMap: CourseMap;
	courseDetails?: CourseDetailsMap;
}) => {
	const cuotas = cuotasPagadas?.[cursoId] || {};
	const nombreCurso = coursesMap[cursoId] || cursoId;
	const detail = courseDetails?.[cursoId];

	// Solo mostrar los meses dentro del rango del curso
	const mesesDelCurso = detail
		? MESES.filter((_, i) => {
				const mesNum = i + 1; // MESES es 0-indexed; mesInicio/mesFin son 1-12
				return mesNum >= detail.mesInicio && mesNum <= detail.mesFin;
			})
		: MESES;

	return (
		<div className="mb-4 last:mb-0">
			<div className="flex items-center gap-2 mb-2">
				<GraduationCap className="w-3.5 h-3.5 text-[#252d62]" />
				<span className="text-xs font-bold text-[#252d62]">{nombreCurso}</span>
				{detail && (
					<span className="text-[10px] text-gray-400 font-medium ml-auto">
						{MESES[detail.mesInicio - 1].slice(0, 3)} –{" "}
						{MESES[detail.mesFin - 1].slice(0, 3)}
					</span>
				)}
			</div>
			<div className="grid grid-cols-4 gap-1.5">
				{mesesDelCurso.map((mes) => {
					const pagado = cuotas[mes] === true;
					const pendiente = cuotas[mes] === false;
					return (
						<div
							key={mes}
							className={`rounded-lg px-1.5 py-1.5 text-center transition-all ${
								pagado
									? "bg-emerald-50 border border-emerald-200"
									: pendiente
										? "bg-red-50 border border-red-200"
										: "bg-gray-50 border border-gray-100"
							}`}
							title={`${mes}: ${pagado ? "Pagado" : pendiente ? "Pendiente" : "Sin datos"}`}
						>
							<div className="flex justify-center mb-0.5">
								{pagado ? (
									<CheckCircle2 className="w-3 h-3 text-emerald-500" />
								) : pendiente ? (
									<XCircle className="w-3 h-3 text-red-400" />
								) : (
									<Clock className="w-3 h-3 text-gray-300" />
								)}
							</div>
							<span
								className={`text-[9px] font-bold leading-tight block ${
									pagado
										? "text-emerald-600"
										: pendiente
											? "text-red-500"
											: "text-gray-400"
								}`}
							>
								{mes.slice(0, 3).toUpperCase()}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
};

const HijoCard = ({
	hijo,
	coursesMap,
	courseDetails,
	index,
}: {
	hijo: HijoDetalle;
	coursesMap: CourseMap;
	courseDetails?: CourseDetailsMap;
	index: number;
}) => (
	<motion.div
		initial={{ opacity: 0, y: 8 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ delay: index * 0.08 }}
		className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
	>
		{/* Header del hijo */}
		<div className="bg-gradient-to-r from-[#252d62]/5 to-[#EE1120]/5 px-4 py-3 flex items-center gap-3 border-b border-gray-100">
			<div className="w-9 h-9 rounded-full bg-[#EE1120]/10 flex items-center justify-center text-[#EE1120] font-bold text-base shrink-0">
				{hijo.nombre.charAt(0).toUpperCase()}
			</div>
			<div>
				<p className="text-sm font-bold text-[#252d62] leading-tight">
					{hijo.nombre} {hijo.apellido}
				</p>
				<p className="text-[11px] text-gray-500">
					DNI: <span className="font-mono font-semibold">{hijo.dni}</span> ·{" "}
					{calcularEdad(hijo.fechaNacimiento)} años
				</p>
			</div>
			<div className="ml-auto">
				<span className="text-[10px] font-bold bg-[#EE1120]/10 text-[#EE1120] px-2 py-1 rounded-full uppercase tracking-wide">
					Menor
				</span>
			</div>
		</div>

		<div className="p-4">
			{/* Nacimiento */}
			<div className="flex items-center gap-2 text-xs text-gray-500 mb-3 pb-3 border-b border-gray-100">
				<Calendar className="w-3.5 h-3.5" />
				<span>
					Nacimiento:{" "}
					<span className="font-semibold text-gray-700">
						{formatDate(hijo.fechaNacimiento)}
					</span>
				</span>
			</div>

			{/* Cursos del hijo */}
			<div className="mb-3">
				<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
					Cursos Asignados
				</p>
				<div className="flex flex-wrap gap-1.5">
					{hijo.cursos.length > 0 ? (
						hijo.cursos.map((cId) => (
							<span
								key={cId}
								className="text-[11px] font-bold bg-[#252d62]/10 text-[#252d62] px-2.5 py-1 rounded-md"
							>
								{coursesMap[cId] || "Curso Desconocido"}
							</span>
						))
					) : (
						<span className="text-[11px] text-gray-400 font-medium bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
							Sin cursos asignados
						</span>
					)}
				</div>
			</div>

			{/* Cuotas del hijo */}
			{hijo.cursos.length > 0 && (
				<div>
					<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
						Estado de Cuotas
					</p>
					{hijo.cursos.map((cId) => (
						<CuotasGrid
							key={cId}
							cuotasPagadas={hijo.cuotasPagadas}
							cursoId={cId}
							coursesMap={coursesMap}
							courseDetails={courseDetails}
						/>
					))}
				</div>
			)}
		</div>
	</motion.div>
);

// --- COMPONENTE PRINCIPAL ---
export default function UserInfoModal({
	student,
	isOpen,
	onClose,
	coursesMap,
}: UserInfoModalProps) {
	const [hijos, setHijos] = useState<HijoDetalle[]>([]);
	const [courseDetails, setCourseDetails] = useState<CourseDetailsMap>({});
	const [isLoadingHijos, setIsLoadingHijos] = useState(false);
	const [tutorInfo, setTutorInfo] = useState<{
		nombre: string;
		apellido: string;
		dni: number;
		email?: string;
		telefono?: string;
	} | null>(null);

	useEffect(() => {
		if (!isOpen || !student) {
			setHijos([]);
			setCourseDetails({});
			setTutorInfo(null);
			return;
		}

		const fetchExtraData = async () => {
			setIsLoadingHijos(true);
			try {
				const allCourseIds: string[] = [...student.cursos];

				const userDoc = await getDoc(
					doc(db, student.tipo === "Menor" ? "Hijos" : "Users", student.id),
				);
				if (userDoc.exists()) {
					const data = userDoc.data();
					if (student.tipo === "Menor" && data.datosTutor) {
						const t = data.datosTutor;
						setTutorInfo({
							nombre: t.nombre,
							apellido: t.apellido,
							email: t.email,
							telefono: t.telefono,
							dni: t.dni,
						});
					}

					if (student.isTutor && data.hijos?.length > 0) {
						const hijosPromises = data.hijos.map((hijoId: string) =>
							getDoc(doc(db, "Hijos", hijoId)),
						);
						const hijosDocs = await Promise.all(hijosPromises);
						const hijosData: HijoDetalle[] = hijosDocs
							.filter((d) => d.exists())
							.map((d) => {
								const h = d.data();
								(h.cursos || []).forEach((cId: string) => {
									if (!allCourseIds.includes(cId)) allCourseIds.push(cId);
								});
								return {
									id: d.id,
									nombre: h.nombre || "",
									apellido: h.apellido || "",
									dni: h.dni || "",
									fechaNacimiento: h.fechaNacimiento || "",
									edad: calcularEdad(h.fechaNacimiento),
									cursos: h.cursos || [],
									cuotasPagadas: h.cuotasPagadas || {},
								};
							});
						setHijos(hijosData);
					}

					if (allCourseIds.length > 0) {
						const courseDocs = await Promise.all(
							allCourseIds.map((cId) => getDoc(doc(db, "Cursos", cId))),
						);
						const detailsMap: CourseDetailsMap = {};
						courseDocs.forEach((cd) => {
							if (cd.exists()) {
								const d = cd.data();
								detailsMap[cd.id] = {
									nombre: d.nombre || "",
									mesInicio: d.inicioMes ?? 1,
									mesFin: d.finMes ?? 12,
								};
							}
						});
						setCourseDetails(detailsMap);
					}
				}
			} catch (err) {
				console.error("Error cargando datos del modal:", err);
			} finally {
				setIsLoadingHijos(false);
			}
		};

		fetchExtraData();
	}, [isOpen, student]);

	if (!student) return null;

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						key="backdrop"
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
						transition={{ type: "spring", stiffness: 300, damping: 28 }}
						className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
					>
						<div
							className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto"
							onClick={(e) => e.stopPropagation()}
						>
							{/* HEADER */}
							<div className="relative bg-gradient-to-br from-[#1a2248] to-[#252d62] px-6 py-5 shrink-0">
								{/* Decorative circles */}
								{/* <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
								<div className="absolute bottom-0 left-10 w-16 h-16 rounded-full bg-[#EE1120]/20 translate-y-1/2" /> */}

								<button
									onClick={onClose}
									className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-40"
								>
									<X className="w-4 h-4" />
								</button>

								<div className="flex items-center gap-4 relative z-10">
									<div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-white font-black text-2xl shadow-inner shrink-0">
										{student.nombre.charAt(0).toUpperCase()}
									</div>
									<div>
										<h2 className="text-xl font-black text-white leading-tight">
											{student.nombre} {student.apellido}
										</h2>
										<div className="flex items-center gap-2 mt-1.5 flex-wrap">
											<span className="text-[11px] font-bold bg-white/15 text-white/90 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
												{student.tipo}
											</span>
											{student.isTutor && (
												<span className="text-[11px] font-bold bg-[#EE1120]/80 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1">
													<UserCheck className="w-3 h-3" /> Tutor
												</span>
											)}
											<span className="text-[11px] text-white/60 font-mono">
												DNI: {student.dni}
											</span>
										</div>
									</div>
								</div>
							</div>

							{/* BODY */}
							<div className="overflow-y-auto flex-1 p-5 space-y-5">
								{/* DATOS PERSONALES */}
								<section>
									<h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
										<User className="w-3.5 h-3.5" /> Datos Personales
									</h3>
									<div className="bg-gray-50/70 rounded-xl px-4 py-1">
										<InfoRow
											icon={CreditCard}
											label="DNI"
											value={student.dni}
										/>
										<InfoRow
											icon={Calendar}
											label="Fecha de Nacimiento"
											value={`${formatDate(student.fechaNacimiento)} · ${student.edad} años`}
										/>
										{student.tipo === "Titular" && (
											<>
												<InfoRow
													icon={Mail}
													label="Email"
													value={student.email || "—"}
												/>
												{student.telefono && (
													<InfoRow
														icon={Phone}
														label="Teléfono"
														value={student.telefono}
													/>
												)}
											</>
										)}
										{student.tipo === "Menor" && tutorInfo && (
											<InfoRow
												icon={UserCheck}
												label="Tutor a Cargo"
												value={
													<span className="flex flex-col gap-0.5">
														<span className="font-bold text-[#252d62]">
															{tutorInfo.nombre} {tutorInfo.apellido}{" "}
														</span>
														<span className="text-gray-500 text-xs font-normal">
															DNI: {tutorInfo.dni}
														</span>
														{tutorInfo.email && (
															<span className="text-gray-500 text-xs font-normal">
																{tutorInfo.email}
															</span>
														)}
														{tutorInfo.telefono && (
															<span className="text-gray-500 text-xs font-normal">
																{tutorInfo.telefono}
															</span>
														)}
													</span>
												}
											/>
										)}
									</div>
								</section>

								{/* CURSOS Y CUOTAS DEL TITULAR */}
								<section>
									<h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
										<GraduationCap className="w-3.5 h-3.5" /> Cursos Asignados
									</h3>
									{student.cursos.length > 0 ? (
										<div className="space-y-1.5 mb-4">
											{student.cursos.map((cId) => (
												<div
													key={cId}
													className="flex items-center gap-2 bg-[#252d62]/5 rounded-lg px-3 py-2"
												>
													<BadgeCheck className="w-4 h-4 text-[#252d62] shrink-0" />
													<span className="text-sm font-bold text-[#252d62]">
														{coursesMap[cId] || "Curso Desconocido"}
													</span>
												</div>
											))}
										</div>
									) : (
										<div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center text-sm text-gray-400 font-medium mb-4">
											Sin cursos asignados
										</div>
									)}

									{/* CUOTAS */}
									{/* {student.cursos.length > 0 && (
										<>
											<h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
												<Hash className="w-3.5 h-3.5" /> Estado de Cuotas
											</h3>
											{isLoadingHijos ? (
												<div className="flex justify-center py-4">
													<Loader2 className="w-5 h-5 animate-spin text-[#252d62]" />
												</div>
											) : (
												<div className="bg-gray-50/70 rounded-xl p-4">
													{student.cursos.map((cId) => (
														<CuotasGrid
															key={cId}
															cuotasPagadas={cuotasPagadas}
															cursoId={cId}
															coursesMap={coursesMap}
															courseDetails={courseDetails}
														/>
													))}
												</div>
											)}
										</>
									)} */}
								</section>

								{/* ALUMNOS A CARGO (solo si es tutor) */}
								{student.isTutor && (
									<section>
										<h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
											<Users className="w-3.5 h-3.5" /> Alumnos a Cargo
										</h3>
										{isLoadingHijos ? (
											<div className="flex flex-col items-center justify-center py-8 gap-3">
												<Loader2 className="w-7 h-7 animate-spin text-[#EE1120]" />
												<p className="text-sm text-gray-400 font-medium">
													Cargando alumnos...
												</p>
											</div>
										) : hijos.length > 0 ? (
											<div className="space-y-3">
												{hijos.map((hijo, i) => (
													<HijoCard
														key={hijo.id}
														hijo={hijo}
														coursesMap={coursesMap}
														courseDetails={courseDetails}
														index={i}
													/>
												))}
											</div>
										) : (
											<div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center text-sm text-gray-400 font-medium">
												No se encontraron alumnos a cargo
											</div>
										)}
									</section>
								)}
							</div>

							{/* FOOTER */}
							<div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0 flex justify-end">
								<button
									onClick={onClose}
									className="px-5 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
								>
									Cerrar
								</button>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
