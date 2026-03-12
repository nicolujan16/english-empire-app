"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	X,
	User,
	Mail,
	Phone,
	CreditCard,
	Calendar,
	Save,
	Loader2,
	AlertCircle,
	CheckCircle2,
	GraduationCap,
	UserCheck,
	Pencil,
	RotateCcw,
} from "lucide-react";
import {
	doc,
	updateDoc,
	collection,
	query,
	where,
	getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

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

// Campos editables de un Titular (Users)
interface TitularForm {
	nombre: string;
	apellido: string;
	dni: string;
	fechaNacimiento: string;
	email: string;
	telefono: string;
}

// Campos editables de un Menor (Hijos)
interface MenorForm {
	nombre: string;
	apellido: string;
	dni: string;
	fechaNacimiento: string;
}

interface EditUserInfoModalProps {
	student: StudentRow | null;
	isOpen: boolean;
	onClose: () => void;
	onSuccess: (updatedStudent: StudentRow) => void;
	coursesMap: CourseMap;
}

// --- HELPERS ---
const calcularEdad = (fecha: string): number | string => {
	if (!fecha) return "";
	const birthDate = new Date(fecha);
	const today = new Date();
	let age = today.getFullYear() - birthDate.getFullYear();
	const m = today.getMonth() - birthDate.getMonth();
	if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
	return age;
};

// --- SUB-COMPONENTES DE UI ---
const inputBase =
	"w-full h-11 px-4 text-sm text-gray-900 placeholder:text-gray-400 bg-gray-50 rounded-lg border border-gray-200 focus:border-[#252d62] focus:bg-white focus:ring-2 focus:ring-[#252d62]/20 outline-none transition-all font-medium";

const FieldGroup = ({
	label,
	icon: Icon,
	children,
}: {
	label: string;
	icon: React.ElementType;
	children: React.ReactNode;
}) => (
	<div className="flex flex-col gap-1.5">
		<label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
			<Icon className="w-3.5 h-3.5" />
			{label}
		</label>
		{children}
	</div>
);

const SectionDivider = ({ label }: { label: string }) => (
	<div className="flex items-center gap-2 my-1">
		<div className="h-px bg-gray-200 flex-grow" />
		<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
			{label}
		</span>
		<div className="h-px bg-gray-200 flex-grow" />
	</div>
);

// Badge de tipo de usuario en el header
const TipoBadge = ({ tipo, isTutor }: { tipo: string; isTutor: boolean }) => (
	<div className="flex items-center gap-2 mt-1.5 flex-wrap">
		<span className="text-[11px] font-bold bg-white/15 text-white/90 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
			{tipo}
		</span>
		{isTutor && (
			<span className="text-[11px] font-bold bg-[#EE1120]/80 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1">
				<UserCheck className="w-3 h-3" /> Tutor
			</span>
		)}
	</div>
);

// Panel de campo no editable (informativo)
const ReadOnlyField = ({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: string;
	icon: React.ElementType;
}) => (
	<div className="flex items-center gap-3 bg-gray-100/80 rounded-lg px-4 py-2.5 border border-gray-200/60">
		<Icon className="w-4 h-4 text-gray-400 shrink-0" />
		<div className="flex flex-col min-w-0">
			<span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-tight">
				{label}
			</span>
			<span className="text-sm font-semibold text-gray-500 truncate">
				{value}
			</span>
		</div>
		<span className="ml-auto text-[9px] font-bold text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">
			No editable
		</span>
	</div>
);

// --- COMPONENTE PRINCIPAL ---
export default function EditUserInfoModal({
	student,
	isOpen,
	onClose,
	onSuccess,
	coursesMap,
}: EditUserInfoModalProps) {
	const [titularForm, setTitularForm] = useState<TitularForm>({
		nombre: "",
		apellido: "",
		dni: "",
		fechaNacimiento: "",
		email: "",
		telefono: "",
	});

	const [menorForm, setMenorForm] = useState<MenorForm>({
		nombre: "",
		apellido: "",
		dni: "",
		fechaNacimiento: "",
	});

	const [isLoading, setIsLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");
	const [successMsg, setSuccessMsg] = useState("");

	// Inicializar el form con los datos actuales del alumno
	useEffect(() => {
		if (!student || !isOpen) {
			setErrorMsg("");
			setSuccessMsg("");
			return;
		}

		if (student.tipo === "Titular") {
			setTitularForm({
				nombre: student.nombre,
				apellido: student.apellido,
				dni: student.dni,
				fechaNacimiento: student.fechaNacimiento,
				email: student.email || "",
				telefono: student.telefono || "",
			});
		} else {
			setMenorForm({
				nombre: student.nombre,
				apellido: student.apellido,
				dni: student.dni,
				fechaNacimiento: student.fechaNacimiento,
			});
		}
	}, [student, isOpen]);

	const handleTitularChange = (e: ChangeEvent<HTMLInputElement>) => {
		setErrorMsg("");
		setTitularForm({ ...titularForm, [e.target.id]: e.target.value });
	};

	const handleMenorChange = (e: ChangeEvent<HTMLInputElement>) => {
		setErrorMsg("");
		setMenorForm({ ...menorForm, [e.target.id]: e.target.value });
	};

	const handlePhoneChange = (value?: string) => {
		setErrorMsg("");
		setTitularForm({ ...titularForm, telefono: value || "" });
	};

	const handleReset = () => {
		if (!student) return;
		setErrorMsg("");
		setSuccessMsg("");
		if (student.tipo === "Titular") {
			setTitularForm({
				nombre: student.nombre,
				apellido: student.apellido,
				dni: student.dni,
				fechaNacimiento: student.fechaNacimiento,
				email: student.email || "",
				telefono: student.telefono || "",
			});
		} else {
			setMenorForm({
				nombre: student.nombre,
				apellido: student.apellido,
				dni: student.dni,
				fechaNacimiento: student.fechaNacimiento,
			});
		}
	};

	// --- VALIDACIONES COMPARTIDAS ---
	const validateCommonFields = async (
		nombre: string,
		apellido: string,
		dni: string,
		fechaNacimiento: string,
		currentId: string,
		tipo: "Titular" | "Menor",
	): Promise<string> => {
		if (!nombre.trim() || !apellido.trim())
			return "El nombre y apellido son obligatorios.";
		if (!dni.trim()) return "El DNI es obligatorio.";
		if (!fechaNacimiento) return "La fecha de nacimiento es obligatoria.";

		// Verificar DNI duplicado (excluir el propio documento)
		if (dni !== student?.dni) {
			const usersRef = collection(db, "Users");
			const hijosRef = collection(db, "Hijos");

			const [dniUsers, dniHijos] = await Promise.all([
				getDocs(query(usersRef, where("dni", "==", dni))),
				getDocs(query(hijosRef, where("dni", "==", dni))),
			]);

			const dniTakenByOther =
				dniUsers.docs.some((d) => d.id !== currentId) ||
				dniHijos.docs.some((d) => d.id !== currentId);

			if (dniTakenByOther)
				return "El DNI ingresado ya está registrado en otra cuenta.";
		}

		return "";
	};

	const handleSave = async () => {
		if (!student) return;
		setIsLoading(true);
		setErrorMsg("");
		setSuccessMsg("");

		try {
			if (student.tipo === "Titular") {
				// --- VALIDACIONES TITULAR ---
				const commonError = await validateCommonFields(
					titularForm.nombre,
					titularForm.apellido,
					titularForm.dni,
					titularForm.fechaNacimiento,
					student.id,
					"Titular",
				);
				if (commonError) {
					setErrorMsg(commonError);
					setIsLoading(false);
					return;
				}

				const edad = calcularEdad(titularForm.fechaNacimiento);
				if (typeof edad === "number") {
					if (edad < 18) {
						setErrorMsg("El titular debe ser mayor de 18 años.");
						setIsLoading(false);
						return;
					}
					if (edad > 120) {
						setErrorMsg("Fecha de nacimiento inválida.");
						setIsLoading(false);
						return;
					}
				}

				// Verificar teléfono duplicado (si cambió)
				if (titularForm.telefono && titularForm.telefono !== student.telefono) {
					const usersRef = collection(db, "Users");
					const phoneSnap = await getDocs(
						query(usersRef, where("telefono", "==", titularForm.telefono)),
					);
					if (phoneSnap.docs.some((d) => d.id !== student.id)) {
						setErrorMsg(
							"Este número de teléfono ya está asociado a otra cuenta.",
						);
						setIsLoading(false);
						return;
					}
				}

				// Actualizar en Firestore
				const userRef = doc(db, "Users", student.id);
				await updateDoc(userRef, {
					nombre: titularForm.nombre.trim(),
					apellido: titularForm.apellido.trim(),
					dni: titularForm.dni.trim(),
					fechaNacimiento: titularForm.fechaNacimiento,
					edadTitular: calcularEdad(titularForm.fechaNacimiento),
					telefono: titularForm.telefono,
				});

				// Devolver el estudiante actualizado al padre
				onSuccess({
					...student,
					nombre: titularForm.nombre.trim(),
					apellido: titularForm.apellido.trim(),
					dni: titularForm.dni.trim(),
					fechaNacimiento: titularForm.fechaNacimiento,
					edad: calcularEdad(titularForm.fechaNacimiento) as number,
					telefono: titularForm.telefono,
				});
			} else {
				// --- VALIDACIONES MENOR ---
				const commonError = await validateCommonFields(
					menorForm.nombre,
					menorForm.apellido,
					menorForm.dni,
					menorForm.fechaNacimiento,
					student.id,
					"Menor",
				);
				if (commonError) {
					setErrorMsg(commonError);
					setIsLoading(false);
					return;
				}

				// Actualizar en Firestore
				const hijoRef = doc(db, "Hijos", student.id);
				await updateDoc(hijoRef, {
					nombre: menorForm.nombre.trim(),
					apellido: menorForm.apellido.trim(),
					dni: menorForm.dni.trim(),
					fechaNacimiento: menorForm.fechaNacimiento,
				});

				onSuccess({
					...student,
					nombre: menorForm.nombre.trim(),
					apellido: menorForm.apellido.trim(),
					dni: menorForm.dni.trim(),
					fechaNacimiento: menorForm.fechaNacimiento,
					edad: calcularEdad(menorForm.fechaNacimiento) as number,
				});
			}

			setSuccessMsg("¡Datos actualizados correctamente!");
			setTimeout(() => {
				onClose();
			}, 1200);
		} catch (err) {
			console.error("Error al actualizar:", err);
			setErrorMsg("Hubo un error al guardar los cambios. Intentá de nuevo.");
		} finally {
			setIsLoading(false);
		}
	};

	if (!student) return null;

	const edadActual =
		student.tipo === "Titular"
			? calcularEdad(titularForm.fechaNacimiento)
			: calcularEdad(menorForm.fechaNacimiento);

	const isTitular = student.tipo === "Titular";

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						key="edit-backdrop"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
					/>

					{/* Modal */}
					<motion.div
						key="edit-modal"
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{ type: "spring", stiffness: 300, damping: 28 }}
						className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
					>
						<div
							className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto"
							onClick={(e) => e.stopPropagation()}
						>
							{/* ===== HEADER ===== */}
							<div className="relative bg-gradient-to-br from-[#1a2248] to-[#252d62] px-6 py-5 shrink-0">
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
										<div className="flex items-center gap-2">
											<Pencil className="w-3.5 h-3.5 text-white/60" />
											<span className="text-[11px] font-bold text-white/60 uppercase tracking-widest">
												Editando datos
											</span>
										</div>
										<h2 className="text-xl font-black text-white leading-tight mt-0.5">
											{student.nombre} {student.apellido}
										</h2>
										<TipoBadge tipo={student.tipo} isTutor={student.isTutor} />
									</div>
								</div>
							</div>

							{/* ===== BODY ===== */}
							<div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
								{/* ---- TITULAR (Users) ---- */}
								{isTitular && (
									<>
										<SectionDivider label="Datos Personales" />

										<div className="grid grid-cols-2 gap-3">
											<FieldGroup label="Nombre" icon={User}>
												<input
													type="text"
													id="nombre"
													value={titularForm.nombre}
													onChange={handleTitularChange}
													className={inputBase}
													placeholder="Nombre"
												/>
											</FieldGroup>
											<FieldGroup label="Apellido" icon={User}>
												<input
													type="text"
													id="apellido"
													value={titularForm.apellido}
													onChange={handleTitularChange}
													className={inputBase}
													placeholder="Apellido"
												/>
											</FieldGroup>
										</div>

										<FieldGroup label="DNI" icon={CreditCard}>
											<input
												type="number"
												id="dni"
												value={titularForm.dni}
												onChange={handleTitularChange}
												className={`${inputBase} font-mono`}
												placeholder="Número de documento"
											/>
										</FieldGroup>

										<div className="grid grid-cols-8 gap-3">
											<div className="col-span-5">
												<FieldGroup label="Fecha de Nacimiento" icon={Calendar}>
													<input
														type="date"
														id="fechaNacimiento"
														value={titularForm.fechaNacimiento}
														onChange={handleTitularChange}
														className={`${inputBase} px-3`}
													/>
												</FieldGroup>
											</div>
											<div className="col-span-3 flex flex-col gap-1.5">
												<label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
													Edad
												</label>
												<div className="w-full h-11 px-2 flex items-center justify-center text-sm font-black bg-gray-100 text-gray-600 rounded-lg border border-gray-200 cursor-not-allowed">
													{edadActual !== "" ? `${edadActual} años` : "—"}
												</div>
											</div>
										</div>

										<SectionDivider label="Datos de Contacto" />

										<ReadOnlyField
											icon={Mail}
											label="Email (credencial de acceso)"
											value={titularForm.email || "—"}
										/>

										<FieldGroup label="Teléfono" icon={Phone}>
											<div className="w-full h-11 px-4 bg-gray-50 rounded-lg border border-gray-200 focus-within:border-[#252d62] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#252d62]/20 transition-all flex items-center phone-edit-container">
												<PhoneInput
													placeholder="Ingresa el número"
													value={titularForm.telefono}
													onChange={handlePhoneChange}
													defaultCountry="AR"
													international
													className="w-full"
												/>
											</div>
										</FieldGroup>

										<SectionDivider label="Información de Solo Lectura" />

										{/* Campos no editables del titular */}
										<div className="space-y-2">
											<ReadOnlyField
												icon={GraduationCap}
												label="Cursos asignados"
												value={
													student.cursos.length > 0
														? student.cursos
																.map((id) => coursesMap[id] || id)
																.join(", ")
														: "Sin cursos"
												}
											/>
											<ReadOnlyField
												icon={UserCheck}
												label="Rol"
												value={student.isTutor ? "Alumno · Tutor" : "Alumno"}
											/>
										</div>
									</>
								)}

								{/* ---- MENOR (Hijos) ---- */}
								{!isTitular && (
									<>
										<SectionDivider label="Datos del Alumno Menor" />

										{/* Info del tutor - solo lectura */}
										<ReadOnlyField
											icon={UserCheck}
											label="Tutor a cargo"
											value={student.nombreTutor || "—"}
										/>

										<div className="grid grid-cols-2 gap-3">
											<FieldGroup label="Nombre" icon={User}>
												<input
													type="text"
													id="nombre"
													value={menorForm.nombre}
													onChange={handleMenorChange}
													className={inputBase}
													placeholder="Nombre"
												/>
											</FieldGroup>
											<FieldGroup label="Apellido" icon={User}>
												<input
													type="text"
													id="apellido"
													value={menorForm.apellido}
													onChange={handleMenorChange}
													className={inputBase}
													placeholder="Apellido"
												/>
											</FieldGroup>
										</div>

										<FieldGroup label="DNI" icon={CreditCard}>
											<input
												type="number"
												id="dni"
												value={menorForm.dni}
												onChange={handleMenorChange}
												className={`${inputBase} font-mono`}
												placeholder="Número de documento"
											/>
										</FieldGroup>

										<div className="grid grid-cols-8 gap-3">
											<div className="col-span-5">
												<FieldGroup label="Fecha de Nacimiento" icon={Calendar}>
													<input
														type="date"
														id="fechaNacimiento"
														value={menorForm.fechaNacimiento}
														onChange={handleMenorChange}
														className={`${inputBase} px-3`}
													/>
												</FieldGroup>
											</div>
											<div className="col-span-3 flex flex-col gap-1.5">
												<label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
													Edad
												</label>
												<div className="w-full h-11 px-2 flex items-center justify-center text-sm font-black bg-gray-100 text-gray-600 rounded-lg border border-gray-200 cursor-not-allowed">
													{edadActual !== "" ? `${edadActual} años` : "—"}
												</div>
											</div>
										</div>

										<SectionDivider label="Información de Solo Lectura" />

										<div className="space-y-2">
											<ReadOnlyField
												icon={GraduationCap}
												label="Cursos asignados"
												value={
													student.cursos.length > 0
														? student.cursos
																.map((id) => coursesMap[id] || id)
																.join(", ")
														: "Sin cursos"
												}
											/>
										</div>
									</>
								)}

								{/* ===== MENSAJES DE ESTADO ===== */}
								<AnimatePresence>
									{errorMsg && (
										<motion.div
											initial={{ opacity: 0, y: -6 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -6 }}
											className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium"
										>
											<AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
											<span>{errorMsg}</span>
										</motion.div>
									)}
									{successMsg && (
										<motion.div
											initial={{ opacity: 0, y: -6 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -6 }}
											className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-medium"
										>
											<CheckCircle2 className="w-4 h-4 shrink-0" />
											<span>{successMsg}</span>
										</motion.div>
									)}
								</AnimatePresence>
							</div>

							{/* ===== FOOTER ===== */}
							<div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0 flex items-center justify-between gap-3">
								{/* Botón reset */}
								<button
									type="button"
									onClick={handleReset}
									disabled={isLoading}
									className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
									title="Restaurar valores originales"
								>
									<RotateCcw className="w-3.5 h-3.5" />
									Restaurar
								</button>

								<div className="flex items-center gap-2">
									{/* Botón cancelar */}
									<button
										type="button"
										onClick={onClose}
										disabled={isLoading}
										className="px-5 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
									>
										Cancelar
									</button>

									{/* Botón guardar */}
									<button
										type="button"
										onClick={handleSave}
										disabled={isLoading}
										className={`flex items-center gap-2 px-6 py-2 text-sm font-bold text-white rounded-full shadow-md transition-all duration-200 ${
											isLoading
												? "bg-[#252d62]/60 cursor-wait"
												: "bg-[#252d62] hover:bg-[#1a2248] hover:scale-105 active:scale-95"
										}`}
									>
										{isLoading ? (
											<>
												<Loader2 className="w-4 h-4 animate-spin" />
												Guardando...
											</>
										) : (
											<>
												<Save className="w-4 h-4" />
												Guardar Cambios
											</>
										)}
									</button>
								</div>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
