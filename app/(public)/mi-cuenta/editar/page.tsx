"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { ArrowLeft, Save, Loader2, UserCircle, Lock } from "lucide-react";
import Link from "next/link";

export default function EditProfilePage() {
	const router = useRouter();
	const { user, userData, isLoading: isAuthLoading } = useAuth();

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [successMessage, setSuccessMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState("");

	const [formData, setFormData] = useState({
		nombre: "",
		apellido: "",
		dni: "",
		telefono: "",
		fechaNacimiento: "",
	});

	useEffect(() => {
		if (userData) {
			setFormData({
				nombre: userData.nombre || "",
				apellido: userData.apellido || "",
				dni: userData.dni || "",
				telefono: String(userData.telefono || ""),
				fechaNacimiento: userData.fechaNacimiento || "",
			});
		}
	}, [userData]);

	if (isAuthLoading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<Loader2 className="w-10 h-10 animate-spin text-[#252d62]" />
			</div>
		);
	}

	if (!user || !userData) {
		router.push("/iniciar-sesion");
		return null;
	}

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
		setSuccessMessage("");
		setErrorMessage("");
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setErrorMessage("");
		setSuccessMessage("");

		try {
			const userRef = doc(db, "Users", user.uid);

			// NOTA DEL TECH LEAD: Eliminamos el DNI de la actualización.
			// Solo actualizamos los campos seguros.
			await updateDoc(userRef, {
				nombre: formData.nombre.trim(),
				apellido: formData.apellido.trim(),
				telefono: formData.telefono.trim(),
				fechaNacimiento: formData.fechaNacimiento,
			});

			setSuccessMessage("¡Perfil actualizado con éxito!");

			setTimeout(() => {
				router.push("/mi-cuenta");
			}, 1500);
		} catch (error) {
			console.error("Error actualizando perfil:", error);
			setErrorMessage(
				"Hubo un error al intentar guardar los cambios. Inténtalo de nuevo.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 py-6 sm:py-12 px-3 sm:px-6 lg:px-8">
			<div className="max-w-3xl mx-auto">
				{/* HEADER DE LA PÁGINA */}
				<div className="mb-6 sm:mb-8 flex items-center gap-3 sm:gap-4 px-1 sm:px-0">
					<Link
						href="/mi-cuenta"
						className="p-1.5 sm:p-2 bg-white rounded-full text-gray-500 hover:text-[#252d62] hover:shadow-md transition-all border border-gray-200"
						title="Volver a mi cuenta"
					>
						<ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
					</Link>
					<div>
						<h1 className="text-2xl sm:text-3xl font-bold text-[#252d62]">
							Editar Perfil
						</h1>
						<p className="text-sm sm:text-base text-gray-500 mt-0.5 sm:mt-1">
							Actualiza tu información personal
						</p>
					</div>
				</div>

				{/* TARJETA DEL FORMULARIO */}
				<div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
					{/* Banner de Usuario */}
					<div className="bg-gradient-to-r from-[#252d62] to-[#1d2355] px-5 sm:px-8 py-5 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
						<div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30 shrink-0">
							<UserCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
						</div>
						<div className="w-full">
							<p className="text-blue-100 text-xs sm:text-sm font-medium uppercase tracking-wider">
								Cuenta Asociada a
							</p>
							<p className="text-white text-lg sm:text-xl font-bold break-all leading-tight">
								{user.email}
							</p>
							<p className="text-blue-200 text-[11px] sm:text-xs mt-1">
								El email no se puede modificar por razones de seguridad.
							</p>
						</div>
					</div>

					<form
						onSubmit={handleSubmit}
						className="p-5 sm:p-8 space-y-5 sm:space-y-6"
					>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
							{/* Nombre */}
							<div>
								<label
									htmlFor="nombre"
									className="block text-xs sm:text-sm font-bold text-gray-700 mb-1"
								>
									Nombre
								</label>
								<input
									type="text"
									id="nombre"
									name="nombre"
									required
									value={formData.nombre}
									onChange={handleChange}
									disabled={isSubmitting}
									className="w-full px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] transition-colors outline-none text-gray-900 bg-gray-50 focus:bg-white text-sm sm:text-base"
									placeholder="Ej: Nicolás"
								/>
							</div>

							{/* Apellido */}
							<div>
								<label
									htmlFor="apellido"
									className="block text-xs sm:text-sm font-bold text-gray-700 mb-1"
								>
									Apellido
								</label>
								<input
									type="text"
									id="apellido"
									name="apellido"
									required
									value={formData.apellido}
									onChange={handleChange}
									disabled={isSubmitting}
									className="w-full px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] transition-colors outline-none text-gray-900 bg-gray-50 focus:bg-white text-sm sm:text-base"
									placeholder="Ej: Lujan"
								/>
							</div>

							{/* DNI (Bloqueado) */}
							<div>
								<label
									htmlFor="dni"
									className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-gray-700 mb-1"
								>
									DNI <Lock className="w-3.5 h-3.5 text-gray-400" />
								</label>
								<input
									type="text"
									id="dni"
									name="dni"
									value={formData.dni}
									disabled
									className="w-full px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed outline-none text-sm sm:text-base font-medium"
								/>
								<p className="text-[10px] sm:text-[11px] text-gray-500 mt-1.5 leading-tight">
									Por seguridad y consistencia de datos, el DNI no puede
									modificarse desde aquí. Contacta a administración si hay un
									error.
								</p>
							</div>

							{/* Teléfono */}
							<div>
								<label
									htmlFor="telefono"
									className="block text-xs sm:text-sm font-bold text-gray-700 mb-1"
								>
									Teléfono
								</label>
								<input
									type="tel"
									id="telefono"
									name="telefono"
									required
									value={formData.telefono}
									onChange={handleChange}
									disabled={isSubmitting}
									className="w-full px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] transition-colors outline-none text-gray-900 bg-gray-50 focus:bg-white text-sm sm:text-base"
									placeholder="Ej: +543804252712"
								/>
							</div>

							{/* Fecha de Nacimiento */}
							<div className="md:col-span-2 md:max-w-sm">
								<label
									htmlFor="fechaNacimiento"
									className="block text-xs sm:text-sm font-bold text-gray-700 mb-1"
								>
									Fecha de Nacimiento
								</label>
								<input
									type="date"
									id="fechaNacimiento"
									name="fechaNacimiento"
									required
									value={formData.fechaNacimiento}
									onChange={handleChange}
									disabled={isSubmitting}
									className="w-full px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] transition-colors outline-none text-gray-900 bg-gray-50 focus:bg-white text-sm sm:text-base"
								/>
							</div>
						</div>

						{/* Mensajes de Feedback */}
						{successMessage && (
							<div className="p-3 sm:p-4 bg-green-50 text-green-700 rounded-lg border border-green-200 text-sm sm:text-base font-medium flex items-center justify-center gap-2">
								<svg
									className="w-5 h-5 shrink-0"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										d="M5 13l4 4L19 7"
									></path>
								</svg>
								{successMessage}
							</div>
						)}

						{errorMessage && (
							<div className="p-3 sm:p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm sm:text-base font-medium text-center">
								{errorMessage}
							</div>
						)}

						{/* Botonera */}
						<div className="pt-5 sm:pt-6 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-end gap-3">
							<Link
								href="/mi-cuenta"
								className="w-full sm:w-auto px-6 py-3 text-center rounded-xl text-gray-600 font-bold hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all text-sm sm:text-base"
							>
								Cancelar
							</Link>
							<button
								type="submit"
								disabled={isSubmitting}
								className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#EE1120] text-white font-bold hover:bg-[#c4000e] shadow-md hover:shadow-lg transition-all disabled:opacity-70 flex items-center justify-center gap-2 text-sm sm:text-base"
							>
								{isSubmitting ? (
									<>
										<Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
										Guardando...
									</>
								) : (
									<>
										<Save className="w-4 h-4 sm:w-5 sm:h-5" />
										Guardar Cambios
									</>
								)}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
