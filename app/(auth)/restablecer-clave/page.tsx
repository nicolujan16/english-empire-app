"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
	Lock,
	Eye,
	EyeOff,
	Loader2,
	AlertCircle,
	CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { getAuth, confirmPasswordReset } from "firebase/auth";
import { app } from "@/lib/firebaseConfig";

function RestablecerForm() {
	const searchParams = useSearchParams();
	const router = useRouter();

	const oobCode = searchParams.get("oobCode");

	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState({ type: "", text: "" });
	const [isSuccess, setIsSuccess] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage({ type: "", text: "" });

		if (!oobCode) {
			setMessage({
				type: "error",
				text: "Código de seguridad faltante o inválido. Por favor, vuelve a solicitar el cambio de contraseña.",
			});
			return;
		}

		if (newPassword.length < 6) {
			setMessage({
				type: "error",
				text: "La contraseña debe tener al menos 6 caracteres.",
			});
			return;
		}

		if (newPassword !== confirmPassword) {
			setMessage({ type: "error", text: "Las contraseñas no coinciden." });
			return;
		}

		setIsSubmitting(true);

		try {
			const auth = getAuth(app);
			await confirmPasswordReset(auth, oobCode, newPassword);

			setIsSuccess(true);
			setMessage({
				type: "success",
				text: "¡Tu contraseña ha sido restablecida con éxito!",
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (error: any) {
			console.error("Error al restablecer:", error);
			if (
				error.code === "auth/invalid-action-code" ||
				error.code === "auth/expired-action-code"
			) {
				setMessage({
					type: "error",
					text: "El enlace es inválido o ya expiró. Por favor, solicita uno nuevo.",
				});
			} else {
				setMessage({
					type: "error",
					text: "Ocurrió un error al intentar cambiar la contraseña.",
				});
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!oobCode) {
		return (
			<div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-start gap-3 border border-red-200 text-sm">
				<AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
				<p>
					No se encontró un código de seguridad válido en el enlace. Asegúrate
					de haber copiado el enlace completo desde tu correo electrónico.
				</p>
			</div>
		);
	}

	if (isSuccess) {
		return (
			<div className="text-center space-y-6 animate-in fade-in zoom-in duration-300">
				<div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
					<CheckCircle2 className="w-10 h-10 text-green-600" />
				</div>
				<h2 className="text-2xl sm:text-3xl font-bold text-[#252d62]">
					¡Contraseña actualizada!
				</h2>
				<p className="text-gray-500">
					Ya puedes iniciar sesión en tu cuenta con tu nueva contraseña.
				</p>
				<Button
					onClick={() => router.push("/iniciar-sesion")}
					className="w-full bg-[#EE1120] hover:bg-[#c4000e] text-white py-6 rounded-xl font-bold text-lg shadow-md"
				>
					Ir a Iniciar Sesión
				</Button>
			</div>
		);
	}

	return (
		<>
			{message.text && (
				<div
					className={`p-4 rounded-xl flex items-start gap-3 mb-6 border text-sm font-medium ${
						message.type === "success"
							? "bg-green-50 border-green-200 text-green-800"
							: "bg-red-50 border-red-200 text-red-800"
					}`}
				>
					{message.type === "success" ? (
						<CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
					) : (
						<AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
					)}
					<p>{message.text}</p>
				</div>
			)}

			<form onSubmit={handleSubmit} className="space-y-5">
				<div>
					<label className="block text-sm font-bold text-gray-700 mb-2">
						Nueva Contraseña
					</label>
					<div className="relative">
						<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
						<input
							type={showPassword ? "text" : "password"}
							required
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] outline-none font-mono text-sm"
							placeholder="Mínimo 6 caracteres"
						/>
						<button
							type="button"
							onClick={() => setShowPassword(!showPassword)}
							className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
						>
							{showPassword ? (
								<EyeOff className="w-5 h-5" />
							) : (
								<Eye className="w-5 h-5" />
							)}
						</button>
					</div>
				</div>

				<div>
					<label className="block text-sm font-bold text-gray-700 mb-2">
						Confirmar Nueva Contraseña
					</label>
					<div className="relative">
						<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
						<input
							type={showConfirmPassword ? "text" : "password"}
							required
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] outline-none font-mono text-sm"
							placeholder="Repite tu nueva contraseña"
						/>
						<button
							type="button"
							onClick={() => setShowConfirmPassword(!showConfirmPassword)}
							className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
						>
							{showConfirmPassword ? (
								<EyeOff className="w-5 h-5" />
							) : (
								<Eye className="w-5 h-5" />
							)}
						</button>
					</div>
				</div>

				<Button
					type="submit"
					disabled={isSubmitting || !newPassword || !confirmPassword}
					className="w-full bg-[#252d62] hover:bg-[#1a204d] text-white py-6 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-md transition-colors disabled:opacity-50 mt-4"
				>
					{isSubmitting ? (
						<>
							<Loader2 className="w-5 h-5 animate-spin" />
							Restableciendo...
						</>
					) : (
						"Guardar Nueva Contraseña"
					)}
				</Button>
			</form>
		</>
	);
}

export default function RestablecerClavePage() {
	return (
		<div className="flex flex-col w-full">
			{/* Solo dejamos el título y la descripción acá.
        El layout ya se encarga del logo, el botón de volver y la caja blanca. 
      */}
			<div className="text-center mb-8 mt-2">
				<h1 className="text-2xl sm:text-3xl font-extrabold text-[#252d62]">
					Crear nueva contraseña
				</h1>
				<p className="text-gray-500 mt-2 text-sm sm:text-base">
					Ingresa tu nueva clave para recuperar el acceso a tu cuenta.
				</p>
			</div>

			<Suspense
				fallback={
					<div className="flex justify-center p-8">
						<Loader2 className="w-8 h-8 animate-spin text-[#252d62]" />
					</div>
				}
			>
				<RestablecerForm />
			</Suspense>
		</div>
	);
}
