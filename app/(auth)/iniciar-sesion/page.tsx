"use client";

import { useState, ChangeEvent, SyntheticEvent, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface LoginForm {
	email: string;
	password: string;
	rememberMe: boolean;
}

export default function LoginPage() {
	const router = useRouter();
	const { user, login } = useAuth();

	useEffect(() => {
		// Si el usuario ya está autenticado, redirigimos a su panel
		if (user) {
			router.push("/mi-cuenta");
		}
	}, [router, user]);

	const [form, setForm] = useState<LoginForm>({
		email: "",
		password: "",
		rememberMe: true, // Por defecto, mantenemos la sesión iniciada
	});

	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [errorMsg, setErrorMsg] = useState<string>("");

	const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
		// Manejamos el caso especial del checkbox
		const value =
			e.target.type === "checkbox" ? e.target.checked : e.target.value;

		setForm({
			...form,
			[e.target.id]: value,
		});
	};

	const handleLogin = async (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsLoading(true);
		setErrorMsg("");

		try {
			await login({
				email: form.email,
				pass: form.password,
				rememberMe: form.rememberMe,
			});

			router.push("/mi-cuenta");
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (error: any) {
			console.error("Error en login:", error);

			if (
				error.code === "auth/user-not-found" ||
				error.code === "auth/wrong-password" ||
				error.code === "auth/invalid-credential"
			) {
				setErrorMsg("Correo o contraseña incorrectos.");
			} else if (error.code === "auth/too-many-requests") {
				setErrorMsg("Demasiados intentos fallidos. Intenta más tarde.");
			} else {
				setErrorMsg("Hubo un error al iniciar sesión. Intenta nuevamente.");
			}
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="text-center">
				<h1 className="text-2xl font-bold text-[#252d62] m-0">¡Bienvenido!</h1>
				<p className="text-gray-500 mt-1 text-base m-0">
					Ingresa a tu panel de usuario
				</p>
			</div>

			<form onSubmit={handleLogin} className="flex flex-col gap-3">
				{/* Email */}
				<div className="flex flex-col gap-1">
					<label htmlFor="email" className="font-bold text-gray-700 text-sm">
						Email
					</label>
					<input
						type="email"
						id="email"
						required
						value={form.email}
						onChange={handleInputChange}
						placeholder="tu@email.com"
						className="w-full h-11 px-4 text-base text-gray-900 placeholder:text-gray-400 bg-[#f1f1f1] rounded-lg border border-transparent focus:border-[#1d2355] focus:bg-white focus:ring-2 focus:ring-[#1d2355]/20 outline-none transition-all"
					/>
				</div>

				{/* Contraseña */}
				<div className="flex flex-col gap-1">
					<label htmlFor="password" className="font-bold text-gray-700 text-sm">
						Contraseña
					</label>
					<input
						type="password"
						id="password"
						required
						value={form.password}
						onChange={handleInputChange}
						placeholder="••••••••"
						className="w-full h-11 px-4 text-base text-gray-900 placeholder:text-gray-400 bg-[#f1f1f1] rounded-lg border border-transparent focus:border-[#1d2355] focus:bg-white focus:ring-2 focus:ring-[#1d2355]/20 outline-none transition-all"
					/>
				</div>

				{/* Fila: Mantener Sesión y Recuperar Contraseña */}
				<div className="flex items-center justify-between mt-1">
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							id="rememberMe"
							checked={form.rememberMe}
							onChange={handleInputChange}
							className="w-4 h-4 text-[#EE1120] rounded border-gray-300 focus:ring-[#EE1120] cursor-pointer"
						/>
						<span className="text-sm font-medium text-gray-700">
							Mantener sesión
						</span>
					</label>

					<Link
						href="/recuperar-password"
						className="text-xs text-[#252d62] hover:underline font-medium"
					>
						¿Olvidaste tu clave?
					</Link>
				</div>

				{errorMsg && (
					<div className="bg-red-50 border border-red-200 text-red-600 p-2 rounded-lg text-sm text-center font-medium">
						{errorMsg}
					</div>
				)}

				<button
					type="submit"
					disabled={isLoading}
					className={`w-full bg-[#EE1120] text-white text-lg font-bold py-2 rounded-full shadow-lg mt-2 transition-all duration-300 ${isLoading ? "opacity-70 cursor-wait" : "hover:bg-[#b30000] hover:scale-105 active:scale-95"}`}
				>
					{isLoading ? "Ingresando..." : "Ingresar"}
				</button>
			</form>

			<div className="w-full border-t border-gray-200 mt-1 pt-3">
				<p className="text-center text-sm text-gray-600 m-0">
					¿Aún no eres alumno?{" "}
					<Link
						href="/registrarse"
						className="text-[#EE1120] font-bold hover:underline"
					>
						Regístrate aquí
					</Link>
				</p>
			</div>
		</div>
	);
}
