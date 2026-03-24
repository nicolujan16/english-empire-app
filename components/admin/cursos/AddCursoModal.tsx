/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, ChangeEvent, SyntheticEvent, useEffect } from "react";
import {
	X,
	Save,
	Upload,
	Loader2,
	CalendarClock,
	Plus,
	Trash2,
	CircleDollarSign,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import cursoDefaultIMG from "@/assets/cursoDetails/cursoDefaultImg.jpg";

import {
	doc,
	updateDoc,
	setDoc,
	query,
	collection,
	where,
	getDocs,
	writeBatch,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebaseConfig";

// --- TIPAMOS LA INTERFAZ CON EL ESQUEMA ESTRICTO ---
export interface AdminCourse {
	id: string;
	nombre: string;
	categoria: string;
	descripcion: string;
	edades: number[]; // 🚀 Restaurado a number[] (Usaremos 999 como comodín)
	horarios: Record<string, string>;
	imgURL: string;

	// Esquema viejo
	cuota?: number;

	// NUEVO ESQUEMA FINANCIERO
	cuota1a10: number;
	cuota11enAdelante: number;
	inscripcion: number;
	mesInicioCobro: number;

	active: boolean;
	inicioMes?: number;
	finMes?: number;
	inicio?: string;
	fin?: string;
}

interface AddCursoModalProps {
	isOpen: boolean;
	onClose: () => void;
	courseToEdit: AdminCourse | null;
}

const MESES = [
	{ nombre: "Enero", valor: 1 },
	{ nombre: "Febrero", valor: 2 },
	{ nombre: "Marzo", valor: 3 },
	{ nombre: "Abril", valor: 4 },
	{ nombre: "Mayo", valor: 5 },
	{ nombre: "Junio", valor: 6 },
	{ nombre: "Julio", valor: 7 },
	{ nombre: "Agosto", valor: 8 },
	{ nombre: "Septiembre", valor: 9 },
	{ nombre: "Octubre", valor: 10 },
	{ nombre: "Noviembre", valor: 11 },
	{ nombre: "Diciembre", valor: 12 },
];

const DIAS_SEMANA = [
	"Lunes",
	"Martes",
	"Miércoles",
	"Jueves",
	"Viernes",
	"Sábado",
	"Domingo",
];

interface HorarioItem {
	dia: string;
	horaInicio: string;
	horaFin: string;
}

export default function AddCursoModal({
	isOpen,
	onClose,
	courseToEdit,
}: AddCursoModalProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [uploadProgress, setUploadProgress] = useState<number>(0);
	const [isScheduleTBD, setIsScheduleTBD] = useState(false);

	const [horariosList, setHorariosList] = useState<HorarioItem[]>([
		{ dia: "Lunes", horaInicio: "18:00", horaFin: "19:30" },
	]);

	const [formData, setFormData] = useState({
		nombre: "",
		categoria: "",
		descripcion: "",
		cuota1a10: "",
		cuota11enAdelante: "",
		inscripcion: "",
		mesInicioCobro: "3",
		edadMin: "",
		edadMax: "",
		mesInicio: "3",
		mesFin: "12",
		active: true,
	});

	useEffect(() => {
		if (courseToEdit && isOpen) {
			const parsedHorarios: HorarioItem[] = [];
			const isTBD = Object.keys(courseToEdit.horarios).includes("A definir");

			setIsScheduleTBD(isTBD);

			if (!isTBD && Object.keys(courseToEdit.horarios).length > 0) {
				Object.entries(courseToEdit.horarios).forEach(([dia, horas]) => {
					const partesHora = horas.split("-").map((p) => p.trim());
					parsedHorarios.push({
						dia: dia,
						horaInicio: partesHora[0] || "",
						horaFin: partesHora[1] || "",
					});
				});
				setHorariosList(parsedHorarios);
			} else {
				setHorariosList([{ dia: "Lunes", horaInicio: "", horaFin: "" }]);
			}

			const getMonthValue = (
				val: string | number | undefined,
				defaultVal: string,
			) => {
				if (typeof val === "number") return val.toString();
				if (typeof val === "string") {
					const found = MESES.find((m) => m.nombre === val);
					if (found) return found.valor.toString();
					return val;
				}
				return defaultVal;
			};

			// 🚀 Lógica Inversa: Si en Firebase dice 999, mostramos vacío ("Sin límite") en el modal
			const readEdadMax = courseToEdit.edades?.[1];
			const parsedEdadMax =
				readEdadMax === 999 ? "" : readEdadMax?.toString() || "";

			setFormData({
				nombre: courseToEdit.nombre || "",
				categoria: courseToEdit.categoria || "",
				descripcion: courseToEdit.descripcion || "",
				cuota1a10:
					courseToEdit.cuota1a10?.toString() ||
					courseToEdit.cuota?.toString() ||
					"",
				cuota11enAdelante:
					courseToEdit.cuota11enAdelante?.toString() ||
					courseToEdit.cuota?.toString() ||
					"",
				inscripcion: courseToEdit.inscripcion?.toString() || "",
				mesInicioCobro: getMonthValue(
					courseToEdit.mesInicioCobro ||
						courseToEdit.inicioMes ||
						courseToEdit.inicio,
					"3",
				),
				edadMin: courseToEdit.edades?.[0]?.toString() || "",
				edadMax: parsedEdadMax,
				mesInicio: getMonthValue(
					courseToEdit.inicioMes || courseToEdit.inicio,
					"3",
				),
				mesFin: getMonthValue(courseToEdit.finMes || courseToEdit.fin, "12"),
				active: courseToEdit.active ?? true,
			});
		} else if (isOpen) {
			setFormData({
				nombre: "",
				categoria: "",
				descripcion: "",
				cuota1a10: "",
				cuota11enAdelante: "",
				inscripcion: "",
				mesInicioCobro: "3",
				edadMin: "",
				edadMax: "",
				mesInicio: "3",
				mesFin: "12",
				active: true,
			});
			setIsScheduleTBD(false);
			setHorariosList([{ dia: "Lunes", horaInicio: "", horaFin: "" }]);
		}
		setSelectedFile(null);
		setUploadProgress(0);
	}, [courseToEdit, isOpen]);

	const handleModalChange = (
		e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
	) => {
		const { name, value, type } = e.target;
		if (type === "checkbox") {
			const checked = (e.target as HTMLInputElement).checked;
			setFormData((prev) => ({ ...prev, [name]: checked }));
		} else {
			setFormData((prev) => ({ ...prev, [name]: value }));
		}
	};

	const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			const file = e.target.files[0];
			if (file.size > 5 * 1024 * 1024) {
				alert("El archivo es demasiado grande. Máximo 5MB.");
				e.target.value = "";
				return;
			}
			setSelectedFile(file);
		}
	};

	const addHorarioFila = () => {
		setHorariosList([
			...horariosList,
			{ dia: "Lunes", horaInicio: "", horaFin: "" },
		]);
	};

	const removeHorarioFila = (indexToRemove: number) => {
		setHorariosList(horariosList.filter((_, idx) => idx !== indexToRemove));
	};

	const handleHorarioChange = (
		index: number,
		field: keyof HorarioItem,
		value: string,
	) => {
		const updatedList = [...horariosList];
		updatedList[index][field] = value;
		setHorariosList(updatedList);
	};

	const toggleScheduleTBD = () => setIsScheduleTBD((prev) => !prev);

	const handleSubmit = async (e: SyntheticEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			let finalImageUrl: string | undefined = undefined;

			if (selectedFile) {
				const storageRef = ref(
					storage,
					`cursos/${Date.now()}_${selectedFile.name}`,
				);
				const uploadTask = uploadBytesResumable(storageRef, selectedFile);

				finalImageUrl = await new Promise((resolve, reject) => {
					uploadTask.on(
						"state_changed",
						(snapshot) => {
							const progress =
								(snapshot.bytesTransferred / snapshot.totalBytes) * 100;
							setUploadProgress(Math.round(progress));
						},
						(error) => {
							console.error("Error subiendo imagen:", error);
							reject("Error al subir la imagen");
						},
						async () => {
							const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
							resolve(downloadURL);
						},
					);
				});
			}

			const horariosObj: Record<string, string> = {};
			if (isScheduleTBD) {
				horariosObj["A definir"] = "";
			} else {
				horariosList.forEach((item) => {
					if (item.dia) {
						const horaTexto = item.horaFin
							? `${item.horaInicio} - ${item.horaFin}`
							: item.horaInicio;
						if (horariosObj[item.dia]) {
							horariosObj[item.dia] += `, ${horaTexto}`;
						} else {
							horariosObj[item.dia] = horaTexto;
						}
					}
				});
			}

			// 🚀 REGLA: Si edadMax está vacío, guardamos 999 en la base de datos
			const finalEdadMax =
				formData.edadMax.trim() === "" ? 999 : parseInt(formData.edadMax);

			const courseData: any = {
				nombre: formData.nombre,
				categoria: formData.categoria,
				descripcion: formData.descripcion,
				cuota1a10: parseFloat(formData.cuota1a10) || 0,
				cuota11enAdelante: parseFloat(formData.cuota11enAdelante) || 0,
				inscripcion: parseFloat(formData.inscripcion) || 0,
				mesInicioCobro: parseInt(formData.mesInicioCobro),
				edades: [
					parseInt(formData.edadMin) || 0,
					finalEdadMax, // <-- Acá inyectamos el 999
				],
				horarios: horariosObj,
				inicioMes: parseInt(formData.mesInicio),
				finMes: parseInt(formData.mesFin),
				active: formData.active,
			};

			if (courseToEdit) {
				if (finalImageUrl) courseData.imgURL = finalImageUrl;
				const courseRef = doc(db, "Cursos", courseToEdit.id);
				await updateDoc(courseRef, courseData);

				const newCuota1a10 = parseFloat(formData.cuota1a10) || 0;
				const newCuota11 = parseFloat(formData.cuota11enAdelante) || 0;
				const oldCuota1a10 = courseToEdit.cuota1a10 || 0;
				const oldCuota11 = courseToEdit.cuota11enAdelante || 0;

				if (newCuota1a10 !== oldCuota1a10 || newCuota11 !== oldCuota11) {
					const q = query(
						collection(db, "Cuotas"),
						where("cursoId", "==", courseToEdit.id),
						where("estado", "==", "Pendiente"),
					);
					const snapshot = await getDocs(q);

					if (!snapshot.empty) {
						const batch = writeBatch(db);
						snapshot.forEach((cuotaDoc) => {
							const data = cuotaDoc.data();
							const updates: Record<string, any> = {
								cuota1a10: newCuota1a10,
								cuota11enAdelante: newCuota11,
								actualizadoEn: new Date(),
							};

							if (
								data.esPrimerMes &&
								data.montoPrimerMes !== null &&
								oldCuota1a10 > 0
							) {
								const ratio = data.montoPrimerMes / oldCuota1a10;
								updates.montoPrimerMes = Math.round(newCuota1a10 * ratio);
							}

							batch.update(cuotaDoc.ref, updates);
						});
						await batch.commit();
					}
				}
			} else {
				courseData.imgURL = finalImageUrl || cursoDefaultIMG.src;
				const customId = formData.nombre
					.normalize("NFD")
					.replace(/[\u0300-\u036f]/g, "")
					.replace(/[^a-zA-Z0-9]/g, "");

				await updateDoc(doc(db, "Cursos", customId), courseData).catch(
					async () => {
						await setDoc(doc(db, "Cursos", customId), courseData);
					},
				);
			}

			onClose();
		} catch (error) {
			console.error(error);
			alert("Hubo un error al guardar los datos.");
		} finally {
			setIsSubmitting(false);
			setUploadProgress(0);
		}
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={!isSubmitting ? onClose : undefined}
						className="fixed inset-0 bg-[#252d62]/80 backdrop-blur-sm z-50 transition-opacity"
					/>

					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 20 }}
							className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
						>
							<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
								<h2 className="text-xl font-bold text-[#252d62]">
									{courseToEdit ? "Editar Curso" : "Nuevo Curso"}
								</h2>
								<button
									onClick={!isSubmitting ? onClose : undefined}
									disabled={isSubmitting}
									className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
								>
									<X className="w-5 h-5" />
								</button>
							</div>

							<div className="p-6 overflow-y-auto">
								<form
									id="course-form"
									onSubmit={handleSubmit}
									className="space-y-6"
								>
									{/* Nombre y Categoría */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
												Nombre del Curso
											</label>
											<input
												type="text"
												name="nombre"
												required
												disabled={isSubmitting || !!courseToEdit}
												value={formData.nombre}
												onChange={handleModalChange}
												placeholder="Ej: Kínder A"
												className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white disabled:opacity-50"
											/>
										</div>
										<div>
											<label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
												Categoría
											</label>
											<select
												name="categoria"
												required
												disabled={isSubmitting}
												value={formData.categoria}
												onChange={handleModalChange}
												className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white"
											>
												<option value="">Seleccionar...</option>
												<option value="Kinder">Kinder</option>
												<option value="Junior">Junior</option>
												<option value="Teens">Teens</option>
												<option value="Adultos">Adultos</option>
												<option value="Empresas">Empresas</option>
											</select>
										</div>
									</div>

									{/* Descripción */}
									<div>
										<label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
											Descripción
										</label>
										<textarea
											name="descripcion"
											required
											disabled={isSubmitting}
											value={formData.descripcion}
											onChange={handleModalChange}
											rows={3}
											placeholder="Descripción detallada del curso..."
											className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white resize-none"
										/>
									</div>

									{/* Edades y Fechas Académicas */}
									<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
										<div>
											<label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
												Edad Mín
											</label>
											<input
												type="number"
												name="edadMin"
												min="0"
												required
												disabled={isSubmitting}
												value={formData.edadMin}
												onChange={handleModalChange}
												className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white"
											/>
										</div>
										<div>
											<label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
												Edad Máx{" "}
												<span className="font-normal normal-case">
													(Opcional)
												</span>
											</label>
											<input
												type="number"
												name="edadMax"
												min="0"
												disabled={isSubmitting}
												value={formData.edadMax}
												onChange={handleModalChange}
												placeholder="Sin límite"
												className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white"
											/>
										</div>
										<div>
											<label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
												Clases desde
											</label>
											<select
												name="mesInicio"
												required
												disabled={isSubmitting}
												value={formData.mesInicio}
												onChange={handleModalChange}
												className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white"
											>
												{MESES.map((mes) => (
													<option key={`inicio-${mes.valor}`} value={mes.valor}>
														{mes.nombre}
													</option>
												))}
											</select>
										</div>
										<div>
											<label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
												Clases hasta
											</label>
											<select
												name="mesFin"
												required
												disabled={isSubmitting}
												value={formData.mesFin}
												onChange={handleModalChange}
												className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white"
											>
												{MESES.map((mes) => (
													<option key={`fin-${mes.valor}`} value={mes.valor}>
														{mes.nombre}
													</option>
												))}
											</select>
										</div>
									</div>

									{/* Horarios Dinámicos */}
									<div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
										<div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-3">
											<label className="block text-sm font-bold text-[#252d62]">
												Horarios de Cursada
											</label>
											<button
												type="button"
												onClick={toggleScheduleTBD}
												className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 shadow-sm ${
													isScheduleTBD
														? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300"
														: "bg-white text-gray-600 hover:bg-gray-100 border border-gray-300"
												}`}
											>
												<CalendarClock className="w-3.5 h-3.5" />
												{isScheduleTBD
													? "Quitar 'A definir'"
													: "Marcar como 'A definir'"}
											</button>
										</div>

										{!isScheduleTBD ? (
											<div className="space-y-3">
												{horariosList.map((item, index) => (
													<div
														key={index}
														className="flex flex-col sm:flex-row items-end sm:items-center gap-3 bg-white p-3 rounded-lg border border-gray-200 shadow-sm relative"
													>
														<div className="w-full sm:w-[40%]">
															<label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
																Día
															</label>
															<select
																value={item.dia}
																onChange={(e) =>
																	handleHorarioChange(
																		index,
																		"dia",
																		e.target.value,
																	)
																}
																disabled={isSubmitting}
																className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#252d62]/20 outline-none"
															>
																{DIAS_SEMANA.map((d) => (
																	<option key={d} value={d}>
																		{d}
																	</option>
																))}
															</select>
														</div>
														<div className="w-full sm:w-[25%]">
															<label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
																Inicio
															</label>
															<input
																type="time"
																value={item.horaInicio}
																onChange={(e) =>
																	handleHorarioChange(
																		index,
																		"horaInicio",
																		e.target.value,
																	)
																}
																disabled={isSubmitting}
																required
																className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#252d62]/20 outline-none"
															/>
														</div>
														<div className="w-full sm:w-[25%]">
															<label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
																Fin
															</label>
															<input
																type="time"
																value={item.horaFin}
																onChange={(e) =>
																	handleHorarioChange(
																		index,
																		"horaFin",
																		e.target.value,
																	)
																}
																disabled={isSubmitting}
																required
																className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#252d62]/20 outline-none"
															/>
														</div>
														{horariosList.length > 1 && (
															<button
																type="button"
																onClick={() => removeHorarioFila(index)}
																className="absolute -top-2 -right-2 sm:static sm:top-auto sm:right-auto p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-full transition-colors"
																title="Eliminar horario"
															>
																<Trash2 className="w-4 h-4" />
															</button>
														)}
													</div>
												))}
												<button
													type="button"
													onClick={addHorarioFila}
													disabled={isSubmitting}
													className="w-full mt-2 py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg text-sm font-bold hover:bg-gray-100 hover:text-[#252d62] transition-colors flex items-center justify-center gap-2"
												>
													<Plus className="w-4 h-4" /> Añadir otro día/horario
												</button>
											</div>
										) : (
											<div className="text-center py-6 text-yellow-700 bg-yellow-50 rounded-lg border border-yellow-200">
												<p className="font-medium text-sm">
													Los horarios se definirán más adelante.
												</p>
											</div>
										)}
									</div>

									{/* SECCIÓN FINANCIERA */}
									<div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 space-y-4">
										<h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-2 border-b border-emerald-200/60 pb-2">
											<CircleDollarSign className="w-4 h-4" /> Esquema de Cobros
											y Cuotas
										</h3>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div>
												<label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
													Cuota (Días 1 al 10) ($)
												</label>
												<input
													type="number"
													name="cuota1a10"
													min="0"
													required
													disabled={isSubmitting}
													value={formData.cuota1a10}
													onChange={handleModalChange}
													placeholder="Ej: 35000"
													className="block w-full px-3 py-2.5 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
												/>
											</div>
											<div>
												<label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
													Cuota (Día 11 en adelante) ($)
												</label>
												<input
													type="number"
													name="cuota11enAdelante"
													min="0"
													required
													disabled={isSubmitting}
													value={formData.cuota11enAdelante}
													onChange={handleModalChange}
													placeholder="Ej: 40000"
													className="block w-full px-3 py-2.5 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
												/>
											</div>
											<div>
												<label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
													Inscripción / Matrícula ($)
												</label>
												<input
													type="number"
													name="inscripcion"
													min="0"
													required
													disabled={isSubmitting}
													value={formData.inscripcion}
													onChange={handleModalChange}
													placeholder="Ej: 15000"
													className="block w-full px-3 py-2.5 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
												/>
											</div>
											<div>
												<label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
													Mes inicio de cobro
												</label>
												<select
													name="mesInicioCobro"
													required
													disabled={isSubmitting}
													value={formData.mesInicioCobro}
													onChange={handleModalChange}
													className="block w-full px-3 py-2.5 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
												>
													{MESES.map((mes) => (
														<option
															key={`cobro-${mes.valor}`}
															value={mes.valor}
														>
															{mes.nombre}
														</option>
													))}
												</select>
											</div>
										</div>
									</div>

									{/* Estado del curso */}
									<div className="flex items-center gap-2">
										<input
											type="checkbox"
											id="active"
											name="active"
											checked={formData.active}
											onChange={handleModalChange}
											disabled={isSubmitting}
											className="w-5 h-5 rounded border-gray-300 text-[#252d62] focus:ring-[#252d62]"
										/>
										<label
											htmlFor="active"
											className="text-sm font-medium text-gray-700 cursor-pointer"
										>
											Curso Activo (Visible para inscripciones)
										</label>
									</div>

									{/* Foto */}
									<div>
										<label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
											Imagen del Curso
										</label>
										<div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors relative">
											<div className="space-y-1 text-center">
												<Upload className="mx-auto h-8 w-8 text-gray-400" />
												<div className="flex text-sm text-gray-600 justify-center">
													<span className="relative font-medium text-[#252d62]">
														{selectedFile
															? selectedFile.name
															: courseToEdit
																? "Subir nueva imagen (opcional)"
																: "Seleccionar archivo"}
													</span>
												</div>
												{!selectedFile && (
													<p className="text-xs text-gray-500">
														PNG o JPG hasta 5MB
													</p>
												)}
											</div>
											<input
												type="file"
												accept="image/png, image/jpeg, image/jpg"
												onChange={handleFileChange}
												disabled={isSubmitting}
												className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
											/>
										</div>
										{isSubmitting &&
											uploadProgress > 0 &&
											uploadProgress < 100 && (
												<div className="w-full bg-gray-200 rounded-full h-1.5 mt-3 overflow-hidden">
													<div
														className="bg-[#252d62] h-1.5 rounded-full transition-all duration-300"
														style={{ width: `${uploadProgress}%` }}
													></div>
													<p className="text-[10px] text-right text-gray-500 mt-1">
														Subiendo imagen... {uploadProgress}%
													</p>
												</div>
											)}
									</div>
								</form>
							</div>

							<div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
								<Button
									type="button"
									variant="outline"
									onClick={onClose}
									disabled={isSubmitting}
									className="border-gray-300 text-gray-700 hover:bg-gray-100"
								>
									Cancelar
								</Button>
								<Button
									type="submit"
									form="course-form"
									disabled={isSubmitting || !formData.nombre}
									className="bg-[#EE1120] hover:bg-[#c4000e] text-white shadow-md min-w-[140px]"
								>
									{isSubmitting ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : (
										<>
											<Save className="w-4 h-4 mr-2" />{" "}
											{courseToEdit ? "Actualizar" : "Guardar"}
										</>
									)}
								</Button>
							</div>
						</motion.div>
					</div>
				</>
			)}
		</AnimatePresence>
	);
}
