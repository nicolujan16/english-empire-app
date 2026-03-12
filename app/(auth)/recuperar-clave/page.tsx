"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
	ArrowLeft,
	Mail,
	Loader2,
	CheckCircle2,
	AlertCircle,
} from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore"; // Importamos Firestore
import { db } from "@/lib/firebaseConfig";

export default function RecoverPasswordPage() {
	const { resetPassword } = useAuth();

	const [email, setEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [feedback, setFeedback] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setFeedback(null);

		try {
			// 1. CHEQUEO MANUAL EN FIRESTORE (Porque Firebase Auth ya no tira error si no existe)
			const usersRef = collection(db, "Users");
			const q = query(
				usersRef,
				where("email", "==", email.trim().toLowerCase()),
			);
			const querySnapshot = await getDocs(q);

			if (querySnapshot.empty) {
				// Si no lo encontramos en la BD, tiramos un error intencionalmente
				setFeedback({
					type: "error",
					message:
						"No encontramos ninguna cuenta asociada a este correo electrónico.",
				});
				setIsSubmitting(false);
				return; // Cortamos la ejecución acá
			}

			// 2. SI EXISTE, ENVIAMOS EL MAIL VÍA AUTH
			await resetPassword(email);

			setFeedback({
				type: "success",
				message:
					"¡Listo! Te enviamos un correo con las instrucciones para restablecer tu contraseña. Por favor, revisá también tu bandeja de spam.",
			});
			setEmail("");
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (error: any) {
			console.error("Error al recuperar contraseña:", error);

			let errorMsg =
				"Hubo un error al intentar enviar el correo. Por favor, intentá de nuevo.";

			// Por si tira algún otro error como mail mal escrito
			if (error.code === "auth/invalid-email") {
				errorMsg = "El formato del correo electrónico no es válido.";
			}

			setFeedback({
				type: "error",
				message: errorMsg,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="min-h-[300px] bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
			<div className="sm:mx-auto sm:w-full sm:max-w-md">
				<h2 className="mt-6 text-center text-3xl font-extrabold text-[#252d62]">
					Recuperar Contraseña
				</h2>
				<p className="mt-2 text-center text-sm text-gray-600 max-w-sm mx-auto">
					Ingresá el correo electrónico asociado a tu cuenta y te enviaremos un
					enlace para que puedas crear una nueva.
				</p>
			</div>

			<div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
				<div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100">
					{/* Mensajes de Feedback */}
					{feedback && (
						<div
							className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm font-medium ${
								feedback.type === "success"
									? "bg-green-50 text-green-800 border border-green-200"
									: "bg-red-50 text-red-800 border border-red-200"
							}`}
						>
							{feedback.type === "success" ? (
								<CheckCircle2 className="w-5 h-5 shrink-0 text-green-600 mt-0.5" />
							) : (
								<AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
							)}
							<p>{feedback.message}</p>
						</div>
					)}

					{/* Formulario (se oculta si el envío fue exitoso) */}
					{feedback?.type !== "success" && (
						<form onSubmit={handleSubmit} className="space-y-6">
							<div>
								<label
									htmlFor="email"
									className="block text-sm font-bold text-gray-700 mb-1"
								>
									Correo Electrónico
								</label>
								<div className="relative">
									<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
										<Mail className="h-5 w-5 text-gray-400" />
									</div>
									<input
										id="email"
										name="email"
										type="email"
										autoComplete="email"
										required
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										disabled={isSubmitting}
										className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] sm:text-sm transition-all"
										placeholder="ejemplo@correo.com"
									/>
								</div>
							</div>

							<div>
								<button
									type="submit"
									disabled={isSubmitting || !email}
									className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-[#EE1120] hover:bg-[#c4000e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#EE1120] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
								>
									{isSubmitting ? (
										<Loader2 className="w-5 h-5 animate-spin" />
									) : (
										"Enviar enlace de recuperación"
									)}
								</button>
							</div>
						</form>
					)}

					{/* Botón para volver */}
					<div className="mt-6 text-center">
						<Link
							href="/iniciar-sesion"
							className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#252d62] transition-colors"
						>
							<ArrowLeft className="w-4 h-4" />
							Volver a Iniciar Sesión
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
