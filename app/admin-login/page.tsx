"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Lock, Mail, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLoginPage() {
	const router = useRouter();

	const { loginAdmin, adminData, isLoading } = useAdminAuth();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [rememberMe, setRememberMe] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");

	const [showPassword, setShowPassword] = useState(false);

	useEffect(() => {
		if (!isLoading && adminData) {
			router.replace("/admin");
		}
	}, [adminData, isLoading, router]);

	const handleAdminLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setError("");

		try {
			await loginAdmin(email, password, rememberMe);

			// ✅ Verificar si quedó logueado (si activo:false, el contexto hizo signOut)
			const { getAuth } = await import("firebase/auth");
			const currentUser = getAuth().currentUser;

			if (!currentUser) {
				setError(
					"Tu cuenta está inhabilitada. Contactá al director del instituto si creés que es un error.",
				);
				return;
			}

			router.push("/admin");
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: any) {
			if (err.code === "auth/account-disabled") {
				setError(
					"Tu cuenta está inhabilitada. Comunicáte con el director del instituto si creés que es un error.",
				);
			} else if (
				err.code === "auth/wrong-password" ||
				err.code === "auth/user-not-found" ||
				err.code === "auth/invalid-credential" ||
				err.code === "auth/not-admin"
			) {
				setError(
					"Credenciales incorrectas o no tenés permisos de administrador.",
				);
			} else {
				setError("Hubo un error al intentar iniciar sesión.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-[#2a2e5b] flex items-center justify-center">
				<Loader2 className="w-10 h-10 animate-spin text-white" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#2a2e5b] flex flex-col justify-center items-center p-4">
			<div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10">
				<div className="text-center mb-10">
					<Image
						src="/logo.png"
						alt="English Empire Logo"
						width={200}
						height={64}
						priority
						className="h-20 md:h-30 w-auto mx-auto mb-4"
					/>
					<h1 className="text-3xl font-extrabold text-[#2a2e5b]">
						Panel de Control
					</h1>
					<p className="text-gray-500 mt-2">
						Inicia sesión para gestionar el instituto
					</p>
				</div>

				{error && (
					<div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3 mb-6 border border-red-200 text-sm">
						<AlertCircle className="w-5 h-5 shrink-0" />
						<p>{error}</p>
					</div>
				)}

				<form onSubmit={handleAdminLogin} className="space-y-6">
					<div>
						<label className="block text-sm font-bold text-gray-700 mb-1">
							Correo Electrónico
						</label>
						<div className="relative">
							<Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
							<input
								type="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2a2e5b]/20 focus:border-[#2a2e5b] outline-none"
								placeholder="juan@englishempire.com"
							/>
						</div>
					</div>

					<div>
						<label className="block text-sm font-bold text-gray-700 mb-1">
							Contraseña
						</label>
						<div className="relative">
							<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
							<input
								type={showPassword ? "text" : "password"}
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2a2e5b]/20 focus:border-[#2a2e5b] outline-none font-mono"
								placeholder="••••••••"
							/>

							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2a2e5b]/20"
								aria-label={
									showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
								}
							>
								{showPassword ? (
									<EyeOff className="w-5 h-5" />
								) : (
									<Eye className="w-5 h-5" />
								)}
							</button>
						</div>
					</div>

					<div className="flex items-center">
						<input
							id="remember-me"
							type="checkbox"
							checked={rememberMe}
							onChange={(e) => setRememberMe(e.target.checked)}
							className="w-4 h-4 text-[#EE1120] bg-gray-100 border-gray-300 rounded focus:ring-[#EE1120] focus:ring-2 cursor-pointer"
						/>
						<label
							htmlFor="remember-me"
							className="ml-2 text-sm font-medium text-gray-600 cursor-pointer select-none"
						>
							Mantener sesión iniciada
						</label>
					</div>

					<Button
						type="submit"
						disabled={isSubmitting}
						className="w-full bg-[#EE1120] hover:bg-[#c4000e] text-white py-6 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-md transition-all"
					>
						{isSubmitting ? (
							<Loader2 className="w-5 h-5 animate-spin" />
						) : (
							"Iniciar Sesión como Admin"
						)}
					</Button>
				</form>
			</div>
		</div>
	);
}
