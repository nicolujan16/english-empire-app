"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
	LayoutDashboard,
	BookOpen,
	Users,
	// UserCheck
	CreditCard,
	Briefcase,
	UserPlus2,
	Settings,
	LogOut,
	AlertTriangle,
	MoveLeft,
} from "lucide-react";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import logo from "@/assets/logo-empire.png";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Button } from "../ui/button";

interface SidebarProps {
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
}

const Sidebar = ({ isOpen, setIsOpen }: SidebarProps) => {
	const pathname = usePathname();
	const router = useRouter();

	const { logoutAdmin, adminData } = useAdminAuth();

	const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

	const menuItems = [
		{ icon: LayoutDashboard, label: "Resumen", path: "/admin" },
		{ icon: BookOpen, label: "Cursos", path: "/admin/cursos" },
		{ icon: Briefcase, label: "Personal", path: "/admin/personal" },
		{ icon: UserPlus2, label: "Inscripciones", path: "/admin/inscripciones" },
		{ icon: CreditCard, label: "Cuotas", path: "/admin/cuotas" },
		{ icon: Users, label: "Alumnos", path: "/admin/alumnos" },
		// { icon: UserCheck, label: "Tutores", path: "/admin/tutores" },
	];

	const handleConfirmLogout = async () => {
		try {
			await logoutAdmin();
			setIsLogoutModalOpen(false);
			router.push("/admin-login");
		} catch (error) {
			console.error("Error al cerrar sesión:", error);
		}
	};

	return (
		<div
			className={`fixed left-0 top-0 h-screen w-64 bg-[#252d62] text-white flex flex-col shadow-xl z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"} 
        lg:translate-x-0
      `}
		>
			<button
				onClick={() => setIsOpen(false)}
				className="sm:hidden absolute top-4 right-4 p-2 bg-white/10 rounded-md hover:bg-white/20 z-50 transition-colors"
			>
				<MoveLeft className="sm:w-5 h-5" />
			</button>

			<div className="hidden sm:flex items-center justify-center p-4 border-b border-white/10 lg:pt-4">
				<Image
					src={logo}
					alt="English Empire Institute"
					width={400}
					height={120}
					className="w-full h-auto bg-white rounded-lg"
					priority
				/>
			</div>

			<nav className="pt-16 sm:pt-3 flex-1 py-4 px-3 overflow-y-auto min-h-0 sidebar-scroll">
				<ul className="space-y-1.5">
					{menuItems.map((item, index) => {
						const Icon = item.icon;
						const isActive = pathname === item.path;

						return (
							<motion.li
								key={item.path}
								initial={{ opacity: 0, x: -20 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ duration: 0.3, delay: index * 0.05 }}
							>
								<Link
									href={item.path}
									onClick={() => setIsOpen(false)} // <-- Cerramos al hacer clic en móvil
									className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
										isActive
											? "bg-white/15 text-white shadow-sm"
											: "text-white/80 hover:bg-white/10 hover:text-white"
									}`}
								>
									<Icon
										className={`w-5 h-5 transition-transform duration-200 ${
											isActive ? "scale-110" : "group-hover:scale-110"
										}`}
									/>
									<span className="font-medium text-sm">{item.label}</span>
								</Link>
							</motion.li>
						);
					})}
				</ul>

				{/* --- Tu diseño inferior original --- */}
				<div className="w-full border-t border-white/10 py-2 shrink-0">
					<div className="pb-4">
						<ul className="space-y-1.5">
							<motion.li
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3, delay: 0.4 }}
							>
								<Link
									href="/admin/configuracion"
									onClick={() => setIsOpen(false)} // <-- Cerramos al hacer clic en móvil
									className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
										pathname === "/admin/configuracion"
											? "bg-white/15 text-white shadow-sm"
											: "text-white/80 hover:bg-white/10 hover:text-white"
									}`}
								>
									<Settings className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90" />
									<span className="font-medium text-sm">Configuración</span>
								</Link>
							</motion.li>

							<motion.li
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3, delay: 0.45 }}
							>
								<button
									onClick={() => setIsLogoutModalOpen(true)}
									className="w-full cursor-pointer flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-white/80 hover:bg-[#EE1120]/20 hover:text-[#EE1120] group"
								>
									<LogOut className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-1" />
									<span className="font-medium text-sm">Cerrar Sesión</span>
								</button>
							</motion.li>
						</ul>
					</div>
					{adminData && (
						<div className="py-2 px-4 rounded-lg bg-white/5 border border-white/10">
							<p className="text-xs text-white/60 mb-1 font-medium uppercase tracking-wider">
								Sesión actual
							</p>
							<p
								className="text-sm font-semibold truncate"
								title={adminData.email}
							>
								{adminData.nombre || adminData.email}
							</p>
						</div>
					)}
				</div>
			</nav>

			<Dialog open={isLogoutModalOpen} onOpenChange={setIsLogoutModalOpen}>
				<DialogContent className="max-w-[95%] rounded-lg w-[425px]">
					<DialogHeader>
						<div className="flex items-center gap-3 mb-2">
							<div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
								<AlertTriangle className="w-5 h-5 text-red-600" />
							</div>
							<DialogTitle className="text-xl text-[#2a2e5b]">
								Cerrar Sesión
							</DialogTitle>
						</div>
						<DialogDescription className="text-gray-600">
							¿Estás seguro que deseas cerrar tu sesión administrativa? Tendrás
							que volver a ingresar tus credenciales para acceder al panel.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0 mt-4">
						<Button
							variant="outline"
							onClick={() => setIsLogoutModalOpen(false)}
							className="border-gray-300 text-gray-700 hover:bg-gray-50"
						>
							Cancelar
						</Button>
						<Button
							onClick={handleConfirmLogout}
							className="bg-[#EE1120] hover:bg-[#c4000e] text-white"
						>
							Sí, cerrar sesión
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};

export default Sidebar;
