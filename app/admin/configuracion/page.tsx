"use client";

import React, { useState } from "react";
import {
	Settings,
	Key,
	Lock,
	Eye,
	EyeOff,
	Loader2,
	AlertCircle,
	CheckCircle2,
	ShieldCheck,
	UserCog,
	GraduationCap,
	Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import AddNewAdmin from "@/components/admin/configuracion/AddNewAdmin";
import AdminListModal from "@/components/admin/configuracion/AdminListModal";
import AddNewTeacherModal from "@/components/admin/configuracion/AddNewTeacherModal";
import TeacherListModal from "@/components/admin/configuracion/TeacherListModal";

// --- FIREBASE ---
import {
	getAuth,
	updatePassword,
	EmailAuthProvider,
	reauthenticateWithCredential,
} from "firebase/auth";
import { app } from "@/lib/firebaseConfig";
import { useAdminAuth } from "@/context/AdminAuthContext";

export default function ConfiguracionPage() {
	const { adminData } = useAdminAuth();

	// Estados de contraseña
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	// Modales de personal
	const [isAddPersonalOpen, setIsAddPersonalOpen] = useState(false);
	const [isAdminListOpen, setIsAdminListOpen] = useState(false);

	// Modales de profesores (listos para conectar)
	const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
	const [isTeacherListOpen, setIsTeacherListOpen] = useState(false);

	// Toggle visibilidad contraseñas
	const [showCurrentPassword, setShowCurrentPassword] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState({ type: "", text: "" });

	const handleChangePassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage({ type: "", text: "" });

		if (!currentPassword) {
			setMessage({
				type: "error",
				text: "Debes ingresar tu contraseña actual.",
			});
			return;
		}
		if (newPassword.length < 6) {
			setMessage({
				type: "error",
				text: "La nueva contraseña debe tener al menos 6 caracteres.",
			});
			return;
		}
		if (newPassword !== confirmPassword) {
			setMessage({
				type: "error",
				text: "Las contraseñas nuevas no coinciden.",
			});
			return;
		}
		if (currentPassword === newPassword) {
			setMessage({
				type: "error",
				text: "La nueva contraseña no puede ser igual a la actual.",
			});
			return;
		}

		setIsSubmitting(true);

		try {
			const auth = getAuth(app);
			const user = auth.currentUser;

			if (!user || !user.email) throw new Error("No_User");

			const credential = EmailAuthProvider.credential(
				user.email,
				currentPassword,
			);
			await reauthenticateWithCredential(user, credential);
			await updatePassword(user, newPassword);

			setMessage({
				type: "success",
				text: "¡Tu contraseña ha sido actualizada exitosamente!",
			});
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (error: any) {
			console.error("Error al cambiar contraseña:", error);
			if (
				error.code === "auth/invalid-credential" ||
				error.code === "auth/wrong-password"
			) {
				setMessage({
					type: "error",
					text: "La contraseña actual es incorrecta.",
				});
			} else if (error.code === "auth/too-many-requests") {
				setMessage({
					type: "error",
					text: "Demasiados intentos fallidos. Por favor, intenta más tarde.",
				});
			} else {
				setMessage({
					type: "error",
					text: "Hubo un error al intentar actualizar la contraseña. Inténtalo de nuevo más tarde.",
				});
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
			<div className="flex items-center gap-3 border-b border-gray-200 pb-5">
				<div className="p-3 bg-[#252d62]/10 rounded-xl">
					<Settings className="w-6 h-6 text-[#252d62]" />
				</div>
				<div>
					<h1 className="text-2xl font-bold text-[#252d62]">Configuración</h1>
					<p className="text-gray-500 text-sm mt-1">
						Gestiona las preferencias y la seguridad de tu cuenta de
						administrador.
					</p>
				</div>
			</div>

			{/* ── Sección: Personal del instituto ── */}
			{adminData?.rol === "admin" && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
				>
					<div className="flex items-center gap-3">
						<div className="p-2 bg-[#252d62]/10 rounded-lg">
							<UserCog className="w-5 h-5 text-[#252d62]" />
						</div>
						<div>
							<h3 className="font-bold text-[#252d62]">
								Personal del instituto
							</h3>
							<p className="text-xs text-gray-500 mt-0.5">
								Creá cuentas para secretarios y administradores
							</p>
						</div>
					</div>
					<div className="flex flex-row gap-2">
						<Button
							onClick={() => setIsAddPersonalOpen(true)}
							className="bg-[#252d62] hover:bg-[#1a204d] text-white font-bold rounded-xl flex items-center gap-2 w-full sm:w-auto"
						>
							<UserCog className="w-4 h-4" />
							Añadir nuevo personal
						</Button>
						{adminData?.esDirector && (
							<Button
								onClick={() => setIsAdminListOpen(true)}
								variant="outline"
								className="border-[#252d62] text-[#252d62] hover:bg-[#252d62] hover:text-white font-bold rounded-xl flex items-center gap-2 w-full sm:w-auto"
							>
								<ShieldCheck className="w-4 h-4" />
								Gestionar accesos
							</Button>
						)}
					</div>
				</motion.div>
			)}

			{/* ── Sección: Profesores ── */}
			{adminData?.rol === "admin" && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.15 }}
					className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
				>
					<div className="flex items-center gap-3">
						<div className="p-2 bg-indigo-50 rounded-lg">
							<GraduationCap className="w-5 h-5 text-[#4338ca]" />
						</div>
						<div>
							<h3 className="font-bold text-[#252d62]">Profesores</h3>
							<p className="text-xs text-gray-500 mt-0.5">
								Creá cuentas docentes y asignales cursos
							</p>
						</div>
					</div>
					<div className="flex flex-row gap-2">
						<Button
							onClick={() => setIsAddTeacherOpen(true)}
							className="bg-[#4338ca] hover:bg-[#3730a3] text-white font-bold rounded-xl flex items-center gap-2 w-full sm:w-auto"
						>
							<GraduationCap className="w-4 h-4" />
							Añadir profesor
						</Button>
						<Button
							onClick={() => setIsTeacherListOpen(true)}
							variant="outline"
							className="border-[#4338ca] text-[#4338ca] hover:bg-[#4338ca] hover:text-white font-bold rounded-xl flex items-center gap-2 w-full sm:w-auto"
						>
							<Users className="w-4 h-4" />
							Gestionar profesores
						</Button>
					</div>
				</motion.div>
			)}

			{/* ── Perfil + Cambiar contraseña ── */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				{/* Columna izquierda: Info de la cuenta */}
				<div className="md:col-span-1 flex flex-col gap-4">
					<div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
						<h3 className="font-bold text-[#252d62] border-b border-gray-100 pb-3 mb-4">
							Perfil Actual
						</h3>
						<div className="flex flex-col gap-3 text-sm">
							<div>
								<span className="text-gray-400 font-medium block text-xs">
									Nombre
								</span>
								<span className="font-bold text-gray-800">
									{adminData?.nombre || "Cargando..."}
								</span>
							</div>
							<div>
								<span className="text-gray-400 font-medium block text-xs">
									Correo Electrónico
								</span>
								<span className="font-bold text-gray-800">
									{adminData?.email || "Cargando..."}
								</span>
							</div>
							<div>
								<span className="text-gray-400 font-medium block text-xs">
									Rol
								</span>
								<span className="inline-block mt-1 bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
									{adminData?.rol || "Admin"}
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* Columna derecha: Formulario contraseña */}
				<div className="md:col-span-2">
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
					>
						<div className="flex items-center gap-2 mb-6">
							<Key className="w-5 h-5 text-[#EE1120]" />
							<h2 className="text-lg font-bold text-[#252d62]">
								Cambiar Contraseña
							</h2>
						</div>

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

						<form onSubmit={handleChangePassword} className="space-y-5">
							{/* Contraseña actual */}
							<div>
								<label className="block text-sm font-bold text-gray-700 mb-2">
									Contraseña Actual
								</label>
								<div className="relative">
									<ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
									<input
										type={showCurrentPassword ? "text" : "password"}
										required
										value={currentPassword}
										onChange={(e) => setCurrentPassword(e.target.value)}
										className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] outline-none font-mono text-sm"
										placeholder="Tu contraseña actual"
									/>
									<button
										type="button"
										onClick={() => setShowCurrentPassword(!showCurrentPassword)}
										className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
									>
										{showCurrentPassword ? (
											<EyeOff className="w-4 h-4" />
										) : (
											<Eye className="w-4 h-4" />
										)}
									</button>
								</div>
							</div>

							<div className="border-t border-gray-100 my-4" />

							{/* Nueva contraseña */}
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
											<EyeOff className="w-4 h-4" />
										) : (
											<Eye className="w-4 h-4" />
										)}
									</button>
								</div>
							</div>

							{/* Confirmar nueva contraseña */}
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
											<EyeOff className="w-4 h-4" />
										) : (
											<Eye className="w-4 h-4" />
										)}
									</button>
								</div>
							</div>

							<div className="pt-2">
								<Button
									type="submit"
									disabled={
										isSubmitting ||
										!currentPassword ||
										!newPassword ||
										!confirmPassword
									}
									className="bg-[#252d62] hover:bg-[#1a204d] text-white py-6 px-6 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md w-full sm:w-auto transition-colors disabled:opacity-50"
								>
									{isSubmitting ? (
										<>
											<Loader2 className="w-4 h-4 animate-spin" />
											Actualizando...
										</>
									) : (
										"Actualizar Contraseña"
									)}
								</Button>
							</div>
						</form>
					</motion.div>
				</div>
			</div>

			{/* Modales de personal */}
			<AddNewAdmin
				isOpen={isAddPersonalOpen}
				onClose={() => setIsAddPersonalOpen(false)}
			/>
			<AdminListModal
				isOpen={isAdminListOpen}
				onClose={() => setIsAdminListOpen(false)}
			/>

			{/* Modales de profesores — descomentar cuando estén listos: */}

			<AddNewTeacherModal
				isOpen={isAddTeacherOpen}
				onClose={() => setIsAddTeacherOpen(false)}
			/>
			<TeacherListModal
				isOpen={isTeacherListOpen}
				onClose={() => setIsTeacherListOpen(false)}
			/>
		</div>
	);
}
