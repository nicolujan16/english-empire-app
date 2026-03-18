/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Loader2,
	UserCog,
	CheckCircle2,
	AlertCircle,
	Mail,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
	getAuth,
	createUserWithEmailAndPassword,
	sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { app, db } from "@/lib/firebaseConfig";

interface AddNewPersonalProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function AddNewAdmin({ isOpen, onClose }: AddNewPersonalProps) {
	const [nombre, setNombre] = useState("");
	const [apellido, setApellido] = useState("");
	const [email, setEmail] = useState("");
	const [rol, setRol] = useState<"secretario" | "admin">("secretario");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [exito, setExito] = useState(false);

	const handleClose = () => {
		if (isLoading) return;
		setNombre("");
		setApellido("");
		setEmail("");
		setRol("secretario");
		setError(null);
		setExito(false);
		onClose();
	};

	const handleSubmit = async () => {
		setError(null);

		if (!nombre.trim() || !apellido.trim() || !email.trim()) {
			setError("Completá todos los campos.");
			return;
		}

		setIsLoading(true);
		try {
			// 1. App secundaria para no desloguear al admin actual
			const secondaryApp = initializeApp(
				app.options,
				`PersonalCreation_${Date.now()}`,
			);
			const secondaryAuth = getAuth(secondaryApp);

			const randomPassword =
				Math.random().toString(36).slice(-8) +
				Math.random().toString(36).slice(-4).toUpperCase() +
				"@1!";

			const userCredential = await createUserWithEmailAndPassword(
				secondaryAuth,
				email,
				randomPassword,
			);
			await secondaryAuth.signOut();

			// 2. Crear doc en Admins
			await setDoc(doc(db, "Admins", userCredential.user.uid), {
				email,
				nombre: `${nombre.trim()} ${apellido.trim()}`,
				rol,
				creadoEn: serverTimestamp(),
			});

			// 3. Enviar mail de restablecimiento
			const primaryAuth = getAuth(app);
			await sendPasswordResetEmail(primaryAuth, email);

			setExito(true);
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
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
				{/* Header */}
				<DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
					<div className="flex items-center gap-3">
						<div className="bg-[#252d62] p-2 rounded-lg">
							<UserCog className="w-4 h-4 text-white" />
						</div>
						<div>
							<DialogTitle className="text-lg font-bold text-[#252d62]">
								Agregar nuevo personal
							</DialogTitle>
							<p className="text-xs text-gray-500 mt-0.5">
								Se enviará un mail para que establezca su contraseña
							</p>
						</div>
					</div>
				</DialogHeader>

				{/* Contenido */}
				<div className="px-6 py-5 space-y-5">
					{/* Éxito */}
					{exito && (
						<div className="flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
							<CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
							<div>
								<p className="text-sm font-semibold text-green-800">
									¡Cuenta creada exitosamente!
								</p>
								<p className="text-xs text-green-600 mt-0.5">
									Se envió un mail a <strong>{email}</strong> para que
									establezca su contraseña.
								</p>
							</div>
						</div>
					)}

					{/* Error */}
					{error && (
						<div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
							<AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
							<p className="text-sm text-red-700">{error}</p>
						</div>
					)}

					{!exito && (
						<>
							{/* Nombre y Apellido */}
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-bold text-gray-700 mb-1.5">
										Nombre
									</label>
									<input
										type="text"
										value={nombre}
										onChange={(e) => setNombre(e.target.value)}
										placeholder="Juan"
										className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] transition-all"
									/>
								</div>
								<div>
									<label className="block text-sm font-bold text-gray-700 mb-1.5">
										Apellido
									</label>
									<input
										type="text"
										value={apellido}
										onChange={(e) => setApellido(e.target.value)}
										placeholder="García"
										className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] transition-all"
									/>
								</div>
							</div>

							{/* Email */}
							<div>
								<label className="block text-sm font-bold text-gray-700 mb-1.5">
									Email
								</label>
								<input
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="secretario@englishempire.com.ar"
									className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] transition-all"
								/>
							</div>

							{/* Rol */}
							<div>
								<label className="block text-sm font-bold text-gray-700 mb-2">
									Rol
								</label>
								<div className="flex gap-3">
									{(["secretario", "admin"] as const).map((r) => (
										<button
											key={r}
											type="button"
											onClick={() => setRol(r)}
											className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
												rol === r
													? "border-[#252d62] bg-[#252d62] text-white"
													: "border-gray-200 text-gray-500 hover:border-gray-300"
											}`}
										>
											{r === "secretario" ? "Secretario/a" : "Administrador"}
										</button>
									))}
								</div>
								<p className="text-xs text-gray-400 mt-2">
									{rol === "admin"
										? "Acceso total al panel, incluyendo creación de cuentas."
										: "Acceso a gestión diaria. No puede crear ni eliminar cuentas."}
								</p>
							</div>

							{/* Aviso mail */}
							<div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-start gap-2.5">
								<Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
								<p className="text-xs text-blue-700">
									Al crear la cuenta,{" "}
									<strong>{email || "el nuevo usuario"}</strong> recibirá un
									mail para crear su contraseña.
								</p>
							</div>
						</>
					)}
				</div>

				{/* Footer */}
				<div className="px-6 pb-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
					<button
						onClick={handleClose}
						disabled={isLoading}
						className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50"
					>
						{exito ? "Cerrar" : "Cancelar"}
					</button>
					{!exito && (
						<button
							onClick={handleSubmit}
							disabled={isLoading || !nombre || !apellido || !email}
							className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#252d62] text-white rounded-lg hover:bg-[#1a2050] transition-all disabled:opacity-50 shadow-sm"
						>
							{isLoading ? (
								<>
									<Loader2 className="w-4 h-4 animate-spin" />
									Creando cuenta...
								</>
							) : (
								<>
									<UserCog className="w-4 h-4" />
									Crear cuenta
								</>
							)}
						</button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
