"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import Link from "next/link";

interface LoginForm {
	email: string;
	password: string;
}

export default function LoginPage() {
	const [form, setForm] = useState<LoginForm>({
		email: "",
		password: "",
	});

	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [errorMsg, setErrorMsg] = useState<string>("");

	const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
		setForm({
			...form,
			[e.target.id]: e.target.value,
		});
	};

	const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsLoading(true);
		setErrorMsg("");

		setTimeout(() => {
			if (!form.email.includes("@")) {
				setErrorMsg("Por favor, ingresa un correo electrónico válido.");
				setIsLoading(false);
				return;
			}

			alert("¡Login exitoso! (Modo Prueba)");
			setIsLoading(false);
		}, 1500);
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="text-center">
				<h1 className="text-2xl font-bold text-[#252d62] m-0">¡Bienvenido!</h1>
				<p className="text-gray-500 mt-1 text-base m-0">
					Ingresa a tu panel de usuario
				</p>
			</div>

			{errorMsg && (
				<div className="bg-red-50 border border-red-200 text-red-600 p-2 rounded-lg text-sm text-center font-medium">
					{errorMsg}
				</div>
			)}

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
						/* AGREGAMOS: text-gray-900 y placeholder:text-gray-400 */
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
						/* AGREGAMOS: text-gray-900 y placeholder:text-gray-400 */
						className="w-full h-11 px-4 text-base text-gray-900 placeholder:text-gray-400 bg-[#f1f1f1] rounded-lg border border-transparent focus:border-[#1d2355] focus:bg-white focus:ring-2 focus:ring-[#1d2355]/20 outline-none transition-all"
					/>
					<div className="flex justify-end mt-1">
						<Link
							href="/recuperar-password"
							className="text-xs text-[#252d62] hover:underline font-medium"
						>
							¿Olvidaste tu contraseña?
						</Link>
					</div>
				</div>

				<button
					type="submit"
					disabled={isLoading}
					className={`w-full bg-[#EE1120] text-white text-lg font-bold py-2 rounded-full shadow-lg mt-1 transition-all duration-300 ${isLoading ? "opacity-70 cursor-wait" : "hover:bg-[#b30000] hover:scale-105 active:scale-95"}`}
				>
					{isLoading ? "Ingresando..." : "Ingresar"}
				</button>
			</form>

			<div className="w-full border-t border-gray-200 mt-1 pt-3">
				<p className="text-center text-sm text-gray-600 m-0">
					¿Aún no eres alumno?{" "}
					<Link
						href="/register"
						className="text-[#EE1120] font-bold hover:underline"
					>
						Regístrate aquí
					</Link>
				</p>
			</div>
		</div>
	);
}
