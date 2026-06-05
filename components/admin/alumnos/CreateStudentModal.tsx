/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	X,
	User,
	Baby,
	Search,
	CheckCircle2,
	AlertCircle,
	Loader2,
	Save,
	Mail,
	AlertTriangle,
	Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";

import {
	collection,
	query,
	where,
	getDocs,
	doc,
	setDoc,
	addDoc,
	serverTimestamp,
	arrayUnion,
} from "firebase/firestore";
import {
	getAuth,
	createUserWithEmailAndPassword,
} from "firebase/auth";
import { initializeApp } from "firebase/app";
import { app, db } from "@/lib/firebaseConfig";

import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

interface CreateStudentModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: (newStudent?: any) => void;
}

interface ErrorDialogState {
	isOpen: boolean;
	title: string;
	message: string;
	type: "error" | "success" | "warning";
}

export default function CreateStudentModal({
	isOpen,
	onClose,
	onSuccess,
}: CreateStudentModalProps) {
	const [tipoAlumno, setTipoAlumno] = useState<"Titular" | "Menor">("Titular");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [alertDialog, setAlertDialog] = useState<ErrorDialogState>({
		isOpen: false,
		title: "",
		message: "",
		type: "error",
	});

	const [confirmDialog, setConfirmDialog] = useState({
		isOpen: false,
		title: "",
		message: "",
		onConfirm: () => {},
	});

	// --- ESTADOS PARA TITULAR ---
	const [formData, setFormData] = useState({
		nombre: "",
		apellido: "",
		dni: "",
		email: "",
		telefono: "",
		fechaNacimiento: "",
	});

	const [sinEmail, setSinEmail] = useState(false);

	// --- ESTADOS PARA MENOR ---
	const [tutorDni, setTutorDni] = useState("");
	const [isSearchingTutor, setIsSearchingTutor] = useState(false);
	const [foundTutor, setFoundTutor] = useState<any | null>(null);
	const [tutorError, setTutorError] = useState("");

	const [menoresData, setMenoresData] = useState([
		{ nombre: "", apellido: "", dni: "", fechaNacimiento: "" },
	]);

	const resetForm = () => {
		setTipoAlumno("Titular");
		setFormData({
			nombre: "",
			apellido: "",
			dni: "",
			email: "",
			telefono: "",
			fechaNacimiento: "",
		});
		setSinEmail(false);
		setMenoresData([{ nombre: "", apellido: "", dni: "", fechaNacimiento: "" }]);
		setTutorDni("");
		setFoundTutor(null);
		setTutorError("");
		setIsSubmitting(false);
	};

	const handleClose = () => {
		resetForm();
		onClose();
	};

	const showAlert = (
		title: string,
		message: string,
		type: "error" | "success" | "warning" = "error",
	) => {
		setAlertDialog({ isOpen: true, title, message, type });
	};

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

	const checkDniInUse = async (dni: string) => {
		const qUsers = query(collection(db, "Users"), where("dni", "==", dni));
		const snapUsers = await getDocs(qUsers);
		if (!snapUsers.empty) return true;

		const qHijos = query(collection(db, "Hijos"), where("dni", "==", dni));
		const snapHijos = await getDocs(qHijos);
		return !snapHijos.empty;
	};

	const checkPhoneInUse = async (telefono: string) => {
		const qUsers = query(
			collection(db, "Users"),
			where("telefono", "==", telefono),
		);
		const snapUsers = await getDocs(qUsers);
		return !snapUsers.empty;
	};

	const handleSearchTutor = async (e: React.SyntheticEvent) => {
		e.preventDefault();
		if (!tutorDni) return;

		setIsSearchingTutor(true);
		setTutorError("");
		setFoundTutor(null);

		try {
			const usersRef = collection(db, "Users");
			const qUser = query(usersRef, where("dni", "==", tutorDni));
			const snap = await getDocs(qUser);

			if (!snap.empty) {
				const tutorDoc = snap.docs[0];
				setFoundTutor({ id: tutorDoc.id, ...tutorDoc.data() });
			} else {
				setTutorError("No se encontró ningún Titular con este DNI.");
			}
		} catch (error) {
			console.error("Error buscando tutor:", error);
			setTutorError("Error al conectar con la base de datos.");
		} finally {
			setIsSearchingTutor(false);
		}
	};

	const processCreation = async (isForcedMinor = false) => {
		setIsSubmitting(true);
		try {
			if (tipoAlumno === "Titular") {
				let newUserId = "";

				if (!sinEmail) {
					const secondaryApp = initializeApp(app.options, "SecondaryApp");
					const secondaryAuth = getAuth(secondaryApp);
					const randomPassword = Math.random().toString(36).slice(-10) + "A1!";

					const userCredential = await createUserWithEmailAndPassword(
						secondaryAuth,
						formData.email,
						randomPassword,
					);
					await secondaryAuth.signOut();
					newUserId = userCredential.user.uid;
				} else {
					newUserId = doc(collection(db, "Users")).id;
				}

				// Armamos el objeto base que guardaremos en Firebase y enviaremos al frontend
				const nuevoTitularData = {
					nombre: formData.nombre,
					apellido: formData.apellido,
					dni: formData.dni,
					email: sinEmail ? "" : formData.email,
					telefono: formData.telefono,
					fechaNacimiento: formData.fechaNacimiento,
					isTutor: false,
					rol: "alumno",
					cursos: [],
					sinAccesoWeb: sinEmail,
				};

				await setDoc(doc(db, "Users", newUserId), {
					...nuevoTitularData,
					fechaRegistro: serverTimestamp(),
				});

				// 🚀 ACTUALIZADO: Disparamos onSuccess enviando los datos para que la tabla se actualice
				if (onSuccess) {
					onSuccess({
						id: newUserId,
						...nuevoTitularData,
						tipo: "Titular",
						edad: calcularEdad(formData.fechaNacimiento),
						etiquetas: [],
					});
				}

				if (!sinEmail) {
					// Enviar correo de bienvenida con link de creación de contraseña
					try {
						const emailRes = await fetch("/api/correos/bienvenida-con-link", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								emailDestino: formData.email,
								nombreUsuario: formData.nombre,
							}),
						});

						if (!emailRes.ok) {
							const emailData = await emailRes.json().catch(() => ({}));
							console.error("Error enviando correo de bienvenida:", emailData.error || emailRes.statusText);
						}
					} catch (emailErr) {
						console.error("Error de red enviando correo de bienvenida:", emailErr);
					}

					showAlert(
						"¡Alumno Creado!",
						`El alumno titular se ha registrado exitosamente.\nSe envió un correo a ${formData.email} con el enlace para crear su contraseña.`,
						"success",
					);
				} else {
					showAlert(
						"¡Alumno Creado!",
						"El alumno titular se ha registrado en el sistema administrativo.\nAl no proporcionar un email, este alumno no tendrá acceso al portal web de usuarios.",
						"success",
					);
				}
			} else {
				const hijosRef = collection(db, "Hijos");
				const nuevosHijosIds: string[] = [];

				for (const menor of menoresData) {
					const nuevoMenorData = {
						nombre: menor.nombre,
						apellido: menor.apellido,
						dni: menor.dni,
						fechaNacimiento: menor.fechaNacimiento,
						tutorId: foundTutor.id,
						cursos: [],
						datosTutor: {
							nombre: foundTutor.nombre,
							apellido: foundTutor.apellido,
							dni: foundTutor.dni,
							email: foundTutor.email,
							telefono: foundTutor.telefono,
						},
					};

					const nuevoHijoRef = await addDoc(hijosRef, nuevoMenorData);
					nuevosHijosIds.push(nuevoHijoRef.id);

					// 🚀 ACTUALIZADO: Disparamos onSuccess enviando los datos
					if (onSuccess) {
						onSuccess({
							id: nuevoHijoRef.id,
							nombre: menor.nombre,
							apellido: menor.apellido,
							dni: menor.dni,
							email: "Menor",
							telefono: "",
							fechaNacimiento: menor.fechaNacimiento,
							edad: calcularEdad(menor.fechaNacimiento),
							cursos: [],
							tipo: "Menor",
							isTutor: false,
							nombreTutor: `${foundTutor.nombre} ${foundTutor.apellido}`,
							telefonoTutor: foundTutor.telefono || "Sin teléfono",
							emailTutor: foundTutor.email || "",
							dniTutor: foundTutor.dni || "",
							etiquetas: [],
						});
					}
				}

				const tutorRef = doc(db, "Users", foundTutor.id);
				await setDoc(
					tutorRef,
					{
						isTutor: true,
						hijos: arrayUnion(...nuevosHijosIds),
					},
					{ merge: true },
				);

				showAlert(
					"¡Alumnos Creados!",
					"Los alumnos menores han sido registrados y vinculados a su tutor exitosamente.",
					"success",
				);
			}
		} catch (error: any) {
			console.error("Error creando alumno:", error);
			if (error.code === "auth/email-already-in-use") {
				showAlert(
					"Email en uso",
					"El correo electrónico ingresado ya se encuentra registrado en el sistema. Por favor, utiliza otro.",
					"error",
				);
			} else {
				showAlert(
					"Error del servidor",
					"Ocurrió un error inesperado al intentar crear el alumno. Por favor, revisa la conexión y vuelve a intentarlo.",
					"error",
				);
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (isSubmitting) return;

		if (tipoAlumno === "Titular") {
			if (calcularEdad(formData.fechaNacimiento) < 18) {
				showAlert(
					"Edad Incorrecta",
					"El alumno Titular debe ser mayor de edad (18+). Si es menor, por favor regístralo en la pestaña 'Alumno Menor' y vincúlalo a un tutor responsable.",
					"warning",
				);
				return;
			}

			const dniExists = await checkDniInUse(formData.dni);
			if (dniExists) {
				showAlert(
					"DNI Duplicado",
					`El DNI ${formData.dni} ya se encuentra registrado en el sistema. Verifica que no estés duplicando un alumno.`,
					"error",
				);
				return;
			}

			if (formData.telefono) {
				const phoneExists = await checkPhoneInUse(formData.telefono);
				if (phoneExists) {
					showAlert(
						"Teléfono en uso",
						`El teléfono ${formData.telefono} ya está asociado a otra cuenta de titular.`,
						"warning",
					);
					return;
				}
			}

			await processCreation();
		} else {
			if (!foundTutor) {
				showAlert(
					"Falta el Tutor",
					"Debes buscar y seleccionar un tutor válido antes de registrar a un alumno menor.",
					"warning",
				);
				return;
			}

			const dnisInForm = menoresData.map((m) => m.dni);
			const uniqueDnis = new Set(dnisInForm);
			if (uniqueDnis.size !== dnisInForm.length) {
				showAlert(
					"DNI Duplicado",
					"Has ingresado DNIs duplicados para los menores en el formulario.",
					"error",
				);
				return;
			}

			for (const menor of menoresData) {
				const dniExists = await checkDniInUse(menor.dni);
				if (dniExists) {
					showAlert(
						"DNI Duplicado",
						`El DNI ${menor.dni} ya se encuentra registrado en el sistema.`,
						"error",
					);
					return;
				}
			}

			const menoresMayores = menoresData.filter(
				(menor) => calcularEdad(menor.fechaNacimiento) >= 18,
			);
			if (menoresMayores.length > 0) {
				setConfirmDialog({
					isOpen: true,
					title: "Alumno Mayor de Edad",
					message:
						"Al menos uno de los alumnos que intentas registrar ya es mayor de edad (18+).\n\nTe recomendamos crearle una cuenta como 'Alumno Titular' para que tenga su propio acceso y gestión.\n\n¿Estás seguro de que deseas continuar y registrarlo como menor a cargo de todas formas?",
					onConfirm: () => {
						setConfirmDialog({ ...confirmDialog, isOpen: false });
						processCreation(true);
					},
				});
				return;
			}

			await processCreation();
		}
	};

	return (
		<>
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-[#252d62]/80 backdrop-blur-sm z-40 flex items-center justify-center p-4 sm:p-6"
					>
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 20 }}
							className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
						>
							<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
								<div>
									<h2 className="text-xl font-bold text-[#252d62]">
										Registrar Nuevo Alumno
									</h2>
									<p className="text-xs text-gray-500 mt-1">
										Completa los datos para dar de alta en el sistema.
									</p>
								</div>
								<button
									onClick={handleClose}
									disabled={isSubmitting}
									className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
								>
									<X className="w-5 h-5" />
								</button>
							</div>

							<div className="p-6 overflow-y-auto">
								<div className="flex bg-gray-100 p-1 rounded-xl mb-6">
									<button
										type="button"
										onClick={() => setTipoAlumno("Titular")}
										className={`flex-1 py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
											tipoAlumno === "Titular"
												? "bg-white text-[#252d62] shadow-sm"
												: "text-gray-500 hover:text-gray-700"
										}`}
									>
										<User className="w-4 h-4" /> Alumno Titular (Mayor)
									</button>
									<button
										type="button"
										onClick={() => setTipoAlumno("Menor")}
										className={`flex-1 py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
											tipoAlumno === "Menor"
												? "bg-white text-[#252d62] shadow-sm"
												: "text-gray-500 hover:text-gray-700"
										}`}
									>
										<Baby className="w-4 h-4" /> Alumno Menor
									</button>
								</div>

								<form onSubmit={handleSubmit} className="space-y-6">
									{tipoAlumno === "Titular" && (
										<motion.div
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											className="space-y-4"
										>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
												<div>
													<label className="block text-xs font-bold text-gray-700 mb-1">
														Nombre
													</label>
													<input
														required
														type="text"
														value={formData.nombre}
														onChange={(e) =>
															setFormData({
																...formData,
																nombre: e.target.value,
															})
														}
														className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#252d62]/20 outline-none"
													/>
												</div>
												<div>
													<label className="block text-xs font-bold text-gray-700 mb-1">
														Apellido
													</label>
													<input
														required
														type="text"
														value={formData.apellido}
														onChange={(e) =>
															setFormData({
																...formData,
																apellido: e.target.value,
															})
														}
														className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#252d62]/20 outline-none"
													/>
												</div>
												<div>
													<label className="block text-xs font-bold text-gray-700 mb-1">
														DNI
													</label>
													<input
														required
														type="text"
														value={formData.dni}
														onChange={(e) =>
															setFormData({ ...formData, dni: e.target.value })
														}
														className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#252d62]/20 outline-none"
													/>
												</div>
												<div>
													<label className="block text-xs font-bold text-gray-700 mb-1">
														Fecha de Nacimiento
													</label>
													<input
														required
														type="date"
														value={formData.fechaNacimiento}
														onChange={(e) =>
															setFormData({
																...formData,
																fechaNacimiento: e.target.value,
															})
														}
														className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#252d62]/20 outline-none"
													/>
												</div>

												{/* 🚀 ACÁ IMPLEMENTAMOS EL PHONE INPUT */}
												<div>
													<label className="block text-xs font-bold text-gray-700 mb-1">
														Teléfono
													</label>
													<div className="w-full">
														<PhoneInput
															international
															defaultCountry="AR"
															value={formData.telefono}
															onChange={(value) =>
																setFormData({
																	...formData,
																	telefono: value ? String(value) : "",
																})
															}
															className="flex w-full px-3 py-2 border rounded-lg text-sm focus-within:ring-2 focus-within:ring-[#252d62]/20 focus-within:border-[#252d62] outline-none bg-white transition-all"
														/>
													</div>
												</div>

												<div>
													<label className="block text-xs font-bold text-gray-700 mb-1">
														Correo Electrónico
													</label>
													<input
														required={!sinEmail}
														disabled={sinEmail || isSubmitting}
														type="email"
														value={sinEmail ? "" : formData.email}
														onChange={(e) =>
															setFormData({
																...formData,
																email: e.target.value,
															})
														}
														className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#252d62]/20 outline-none disabled:bg-gray-100 disabled:text-gray-400"
													/>
													<div className="mt-2 flex items-center gap-2">
														<input
															type="checkbox"
															id="sinEmail"
															checked={sinEmail}
															onChange={(e) => {
																setSinEmail(e.target.checked);
																if (e.target.checked) {
																	setFormData((prev) => ({
																		...prev,
																		email: "",
																	}));
																}
															}}
															disabled={isSubmitting}
															className="w-4 h-4 rounded border-gray-300 text-[#252d62] focus:ring-[#252d62]"
														/>
														<label
															htmlFor="sinEmail"
															className="text-xs text-gray-600 cursor-pointer select-none"
														>
															No asociar a un correo por el momento
														</label>
													</div>
												</div>
											</div>

											{!sinEmail ? (
												<div className="bg-blue-50 text-blue-800 p-3 rounded-lg flex items-start gap-3 mt-4 border border-blue-100">
													<Mail className="w-5 h-5 shrink-0 mt-0.5" />
													<p className="text-xs font-medium">
														Al guardar, se enviará automáticamente un correo de
														bienvenida a{" "}
														<strong>{formData.email || "este email"}</strong>{" "}
														con un enlace para que el alumno cree su contraseña
														personal.
													</p>
												</div>
											) : (
												<div className="bg-amber-50 text-amber-800 p-3 rounded-lg flex items-start gap-3 mt-4 border border-amber-100">
													<AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
													<p className="text-xs font-medium">
														El alumno será registrado para el control
														administrativo, pero{" "}
														<strong>
															no podrá acceder al portal web de usuarios
														</strong>{" "}
														hasta que se le asigne un correo.
													</p>
												</div>
											)}
										</motion.div>
									)}

									{tipoAlumno === "Menor" && (
										<motion.div
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											className="space-y-6"
										>
											<div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
												<label className="block text-sm font-bold text-[#252d62] mb-2">
													1. Buscar Tutor (Titular)
												</label>
												<div className="flex gap-2">
													<div className="relative flex-1">
														<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
														<input
															type="text"
															placeholder="DNI del Titular responsable..."
															value={tutorDni}
															onChange={(e) => setTutorDni(e.target.value)}
															className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#252d62]/20 outline-none"
														/>
													</div>
													<Button
														type="button"
														variant="outline"
														onClick={handleSearchTutor}
														disabled={isSearchingTutor || !tutorDni}
													>
														{isSearchingTutor ? (
															<Loader2 className="w-4 h-4 animate-spin" />
														) : (
															"Buscar"
														)}
													</Button>
												</div>

												{tutorError && (
													<div className="flex items-center gap-2 mt-3 text-red-600 text-sm font-medium">
														<AlertCircle className="w-4 h-4" /> {tutorError}
													</div>
												)}

												{foundTutor && (
													<div className="mt-3 bg-green-50 border border-green-200 p-3 rounded-lg flex items-center gap-3">
														<CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
														<div>
															<p className="text-sm font-bold text-green-900">
																Tutor encontrado: {foundTutor.nombre}{" "}
																{foundTutor.apellido}
															</p>
															<p className="text-xs text-green-700">
																DNI: {foundTutor.dni}
															</p>
														</div>
													</div>
												)}
											</div>

											<div
												className={`space-y-4 transition-opacity ${!foundTutor ? "opacity-50 pointer-events-none" : ""}`}
											>
												<label className="block text-sm font-bold text-[#252d62]">
													2. Datos del Menor
												</label>
												
												{menoresData.map((menor, index) => (
													<div key={index} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
														{menoresData.length > 1 && (
															<button
																type="button"
																onClick={() => {
																	const nuevos = [...menoresData];
																	nuevos.splice(index, 1);
																	setMenoresData(nuevos);
																}}
																className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-100 transition-colors"
															>
																<X className="w-4 h-4" />
															</button>
														)}
														<h4 className="text-xs font-bold text-[#EE1120] uppercase tracking-wider mb-3">
															Datos del Alumno {menoresData.length > 1 ? `#${index + 1}` : ""}
														</h4>
														<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
															<div>
																<label className="block text-xs font-bold text-gray-700 mb-1">
																	Nombre
																</label>
																<input
																	required={tipoAlumno === "Menor"}
																	type="text"
																	value={menor.nombre}
																	onChange={(e) => {
																		const nuevos = [...menoresData];
																		nuevos[index].nombre = e.target.value;
																		setMenoresData(nuevos);
																	}}
																	className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
																/>
															</div>
															<div>
																<label className="block text-xs font-bold text-gray-700 mb-1">
																	Apellido
																</label>
																<input
																	required={tipoAlumno === "Menor"}
																	type="text"
																	value={menor.apellido}
																	onChange={(e) => {
																		const nuevos = [...menoresData];
																		nuevos[index].apellido = e.target.value;
																		setMenoresData(nuevos);
																	}}
																	className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
																/>
															</div>
															<div>
																<label className="block text-xs font-bold text-gray-700 mb-1">
																	DNI
																</label>
																<input
																	required={tipoAlumno === "Menor"}
																	type="text"
																	value={menor.dni}
																	onChange={(e) => {
																		const nuevos = [...menoresData];
																		nuevos[index].dni = e.target.value;
																		setMenoresData(nuevos);
																	}}
																	className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
																/>
															</div>
															<div>
																<label className="block text-xs font-bold text-gray-700 mb-1">
																	Fecha de Nacimiento
																</label>
																<input
																	required={tipoAlumno === "Menor"}
																	type="date"
																	value={menor.fechaNacimiento}
																	onChange={(e) => {
																		const nuevos = [...menoresData];
																		nuevos[index].fechaNacimiento = e.target.value;
																		setMenoresData(nuevos);
																	}}
																	className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
																/>
															</div>
														</div>
													</div>
												))}

												<button
													type="button"
													onClick={() => setMenoresData([...menoresData, { nombre: "", apellido: "", dni: "", fechaNacimiento: "" }])}
													className="text-sm font-bold text-[#252d62] hover:text-[#EE1120] mt-1 transition-colors flex items-center gap-1"
												>
													+ Agregar otro alumno
												</button>
											</div>
										</motion.div>
									)}

									<div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={handleClose}
											disabled={isSubmitting}
										>
											Cancelar
										</Button>
										<Button
											type="submit"
											disabled={
												isSubmitting || (tipoAlumno === "Menor" && !foundTutor)
											}
											className="bg-[#EE1120] hover:bg-[#c4000e] text-white"
										>
											{isSubmitting ? (
												<>
													<Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
													Guardando...
												</>
											) : (
												<>
													<Save className="w-4 h-4 mr-2" /> Crear Alumno
												</>
											)}
										</Button>
									</div>
								</form>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			<Dialog
				open={alertDialog.isOpen}
				onOpenChange={(isOpen) => {
					if (!isOpen) {
						setAlertDialog({ ...alertDialog, isOpen: false });
						if (alertDialog.type === "success") {
							handleClose();
						}
					}
				}}
			>
				<DialogContent className="max-w-[90%] sm:max-w-[425px] rounded-xl z-50">
					<DialogHeader>
						<div className="flex items-center gap-3 mb-2">
							<div
								className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
									alertDialog.type === "error"
										? "bg-red-100"
										: alertDialog.type === "warning"
											? "bg-orange-100"
											: "bg-green-100"
								}`}
							>
								{alertDialog.type === "error" && (
									<AlertCircle className="w-5 h-5 text-red-600" />
								)}
								{alertDialog.type === "warning" && (
									<AlertTriangle className="w-5 h-5 text-orange-600" />
								)}
								{alertDialog.type === "success" && (
									<CheckCircle2 className="w-5 h-5 text-green-600" />
								)}
							</div>
							<DialogTitle className="text-lg text-gray-900">
								{alertDialog.title}
							</DialogTitle>
						</div>
						<DialogDescription className="text-gray-600 whitespace-pre-line text-sm">
							{alertDialog.message}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="mt-4">
						<Button
							onClick={() => {
								setAlertDialog({ ...alertDialog, isOpen: false });
								if (alertDialog.type === "success") handleClose();
							}}
							className={`${
								alertDialog.type === "error"
									? "bg-red-600 hover:bg-red-700"
									: alertDialog.type === "warning"
										? "bg-orange-600 hover:bg-orange-700"
										: "bg-green-600 hover:bg-green-700"
							} text-white w-full sm:w-auto`}
						>
							Entendido
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={confirmDialog.isOpen}
				onOpenChange={(isOpen) =>
					setConfirmDialog({ ...confirmDialog, isOpen })
				}
			>
				<DialogContent className="max-w-[90%] sm:max-w-[425px] rounded-xl z-50">
					<DialogHeader>
						<div className="flex items-center gap-3 mb-2">
							<div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
								<Info className="w-5 h-5 text-orange-600" />
							</div>
							<DialogTitle className="text-lg text-gray-900">
								{confirmDialog.title}
							</DialogTitle>
						</div>
						<DialogDescription className="text-gray-600 whitespace-pre-line text-sm">
							{confirmDialog.message}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="mt-4 gap-2 sm:gap-0">
						<Button
							variant="outline"
							onClick={() =>
								setConfirmDialog({ ...confirmDialog, isOpen: false })
							}
							className="border-gray-300 text-gray-700 hover:bg-gray-50"
						>
							Cancelar
						</Button>
						<Button
							onClick={confirmDialog.onConfirm}
							className="bg-orange-600 hover:bg-orange-700 text-white"
						>
							Sí, continuar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
