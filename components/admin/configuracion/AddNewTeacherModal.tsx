"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	X,
	GraduationCap,
	Mail,
	User,
	Phone,
	CreditCard,
	BookMarked,
	Loader2,
	CheckCircle2,
	AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { initializeApp } from "firebase/app";
import {
	getAuth,
	createUserWithEmailAndPassword,
	sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { app, db } from "@/lib/firebaseConfig";

interface Props {
	isOpen: boolean;
	onClose: () => void;
}

const EMPTY_FORM = {
	nombre: "",
	apellido: "",
	email: "",
	dni: "",
	telefono: "",
	titulo: "",
};

export default function AddNewTeacherModal({ isOpen, onClose }: Props) {
	const [form, setForm] = useState(EMPTY_FORM);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [exito, setExito] = useState(false);

	const handleChange = (field: keyof typeof EMPTY_FORM, value: string) => {
		setForm((prev) => ({ ...prev, [field]: value }));
		if (error) setError(null);
	};

	const handleClose = () => {
		if (isLoading) return;
		setForm(EMPTY_FORM);
		setError(null);
		setExito(false);
		onClose();
	};

	const handleSubmit = async () => {
		setError(null);

		if (!form.nombre.trim() || !form.apellido.trim() || !form.email.trim()) {
			setError("Nombre, apellido y email son obligatorios.");
			return;
		}

		setIsLoading(true);
		try {
			// 1. App secundaria para no desloguear al admin actual
			const secondaryApp = initializeApp(
				app.options,
				`TeacherCreation_${Date.now()}`,
			);
			const secondaryAuth = getAuth(secondaryApp);

			const randomPassword =
				Math.random().toString(36).slice(-8) +
				Math.random().toString(36).slice(-4).toUpperCase() +
				"@1!";

			const userCredential = await createUserWithEmailAndPassword(
				secondaryAuth,
				form.email.trim(),
				randomPassword,
			);
			await secondaryAuth.signOut();

			// 2. Crear doc en Teachers
			await setDoc(doc(db, "Teachers", userCredential.user.uid), {
				email: form.email.trim(),
				nombre: form.nombre.trim(),
				apellido: form.apellido.trim(),
				dni: form.dni.replace(/[\s.]/g, ""),
				telefono: form.telefono.trim(),
				titulo: form.titulo.trim(),
				activo: true,
				creadoEn: serverTimestamp(),
			});

			// 3. Enviar mail de restablecimiento para que el profe elija su contraseña
			const primaryAuth = getAuth(app);
			await sendPasswordResetEmail(primaryAuth, form.email.trim());

			setExito(true);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: any) {
			console.error(err);
			if (err.code === "auth/email-already-in-use") {
				setError("Ya existe una cuenta con ese email.");
			} else {
				setError("Error al crear la cuenta. Intentá de nuevo.");
			}
		} finally {
			setIsLoading(false);
		}
	};

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
						onClick={handleClose}
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
						<div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 overflow-hidden">
							{/* Header */}
							<div className="flex items-center justify-between p-6 border-b border-gray-100">
								<div className="flex items-center gap-3">
									<div className="p-2 bg-indigo-50 rounded-xl">
										<GraduationCap className="w-5 h-5 text-[#4338ca]" />
									</div>
									<div>
										<h2 className="font-bold text-gray-900 text-lg">
											Nuevo Profesor
										</h2>
										<p className="text-xs text-gray-500 mt-0.5">
											Se le enviará un email para establecer su contraseña
										</p>
									</div>
								</div>
								<button
									onClick={handleClose}
									disabled={isLoading}
									className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
								>
									<X className="w-5 h-5" />
								</button>
							</div>

							{/* Contenido */}
							<div className="p-6">
								{exito ? (
									<motion.div
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										className="text-center py-6"
									>
										<div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
											<CheckCircle2 className="w-8 h-8 text-green-500" />
										</div>
										<h3 className="font-bold text-gray-900 text-lg mb-2">
											¡Profesor creado!
										</h3>
										<p className="text-gray-500 text-sm mb-1">
											<span className="font-semibold text-gray-700">
												{form.nombre} {form.apellido}
											</span>{" "}
											ya tiene acceso al portal docente.
										</p>
										<p className="text-gray-400 text-xs">
											Se envió un email a{" "}
											<span className="font-medium">{form.email}</span> para que
											establezca su contraseña.
										</p>
										<div className="flex gap-3 mt-8 justify-center">
											<Button
												onClick={() => {
													setForm(EMPTY_FORM);
													setExito(false);
													setError(null);
												}}
												variant="outline"
												className="rounded-xl border-indigo-200 text-[#4338ca] hover:bg-indigo-50"
											>
												Agregar otro
											</Button>
											<Button
												onClick={handleClose}
												className="bg-[#4338ca] hover:bg-[#3730a3] text-white rounded-xl"
											>
												Cerrar
											</Button>
										</div>
									</motion.div>
								) : (
									<div className="space-y-4">
										{error && (
											<div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
												<AlertCircle className="w-4 h-4 shrink-0" />
												{error}
											</div>
										)}

										{/* Nombre + Apellido */}
										<div className="grid grid-cols-2 gap-3">
											<div>
												<label className="block text-xs font-bold text-gray-600 mb-1.5">
													Nombre <span className="text-red-500">*</span>
												</label>
												<div className="relative">
													<User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
													<input
														type="text"
														value={form.nombre}
														onChange={(e) =>
															handleChange("nombre", e.target.value)
														}
														className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4338ca]/20 focus:border-[#4338ca] outline-none bg-gray-50 focus:bg-white transition-all"
														placeholder="Martha"
													/>
												</div>
											</div>
											<div>
												<label className="block text-xs font-bold text-gray-600 mb-1.5">
													Apellido <span className="text-red-500">*</span>
												</label>
												<div className="relative">
													<User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
													<input
														type="text"
														value={form.apellido}
														onChange={(e) =>
															handleChange("apellido", e.target.value)
														}
														className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4338ca]/20 focus:border-[#4338ca] outline-none bg-gray-50 focus:bg-white transition-all"
														placeholder="Gómez"
													/>
												</div>
											</div>
										</div>

										{/* Email */}
										<div>
											<label className="block text-xs font-bold text-gray-600 mb-1.5">
												Email <span className="text-red-500">*</span>
											</label>
											<div className="relative">
												<Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
												<input
													type="email"
													value={form.email}
													onChange={(e) =>
														handleChange("email", e.target.value)
													}
													className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4338ca]/20 focus:border-[#4338ca] outline-none bg-gray-50 focus:bg-white transition-all"
													placeholder="martha.gomez@englishempire.com"
												/>
											</div>
										</div>

										{/* DNI + Teléfono */}
										<div className="grid grid-cols-2 gap-3">
											<div>
												<label className="block text-xs font-bold text-gray-600 mb-1.5">
													DNI
												</label>
												<div className="relative">
													<CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
													<input
														type="text"
														value={form.dni}
														onChange={(e) =>
															handleChange("dni", e.target.value)
														}
														className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4338ca]/20 focus:border-[#4338ca] outline-none bg-gray-50 focus:bg-white transition-all"
														placeholder="20.123.456"
													/>
												</div>
											</div>
											<div>
												<label className="block text-xs font-bold text-gray-600 mb-1.5">
													Teléfono
												</label>
												<div className="relative">
													<Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
													<input
														type="tel"
														value={form.telefono}
														onChange={(e) =>
															handleChange("telefono", e.target.value)
														}
														className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4338ca]/20 focus:border-[#4338ca] outline-none bg-gray-50 focus:bg-white transition-all"
														placeholder="+549 11 2345 6789"
													/>
												</div>
											</div>
										</div>

										{/* Título */}
										<div>
											<label className="block text-xs font-bold text-gray-600 mb-1.5">
												Título / Especialidad
											</label>
											<div className="relative">
												<BookMarked className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
												<input
													type="text"
													value={form.titulo}
													onChange={(e) =>
														handleChange("titulo", e.target.value)
													}
													className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#4338ca]/20 focus:border-[#4338ca] outline-none bg-gray-50 focus:bg-white transition-all"
													placeholder="Profesora Nacional de Inglés"
												/>
											</div>
										</div>

										{/* Info */}
										<p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 border border-gray-100">
											💡 La asignación de cursos se hace desde la lista de
											profesores una vez creada la cuenta.
										</p>
									</div>
								)}
							</div>

							{/* Footer */}
							{!exito && (
								<div className="flex justify-end gap-3 px-6 pb-6">
									<Button
										variant="outline"
										onClick={handleClose}
										disabled={isLoading}
										className="rounded-xl text-gray-600"
									>
										Cancelar
									</Button>
									<Button
										onClick={handleSubmit}
										disabled={
											isLoading ||
											!form.nombre.trim() ||
											!form.apellido.trim() ||
											!form.email.trim()
										}
										className="bg-[#4338ca] hover:bg-[#3730a3] text-white rounded-xl font-bold shadow-md shadow-indigo-200/50 min-w-[140px]"
									>
										{isLoading ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											<>
												<GraduationCap className="w-4 h-4 mr-2" />
												Crear Profesor
											</>
										)}
									</Button>
								</div>
							)}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
