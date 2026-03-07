"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
	LayoutDashboard,
	BookOpen,
	Users,
	UserCheck,
	CreditCard,
	Briefcase,
	UserPlus2,
} from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/logo-empire.png";

// Que icono de lucide-react seria ideal para inscripciones? Quizas UserPlus o UserCheck dependiendo del contexto

const Sidebar = () => {
	const pathname = usePathname();

	const menuItems = [
		{ icon: LayoutDashboard, label: "Resumen", path: "/admin" },
		{ icon: BookOpen, label: "Cursos", path: "/admin/cursos" },
		{ icon: Briefcase, label: "Personal", path: "/admin/personal" },
		{ icon: UserPlus2, label: "Inscripciones", path: "/admin/inscripciones" },
		{
			icon: CreditCard,
			label: "Pagos",
			path: "/admin/Pagos",
		},
		{ icon: Users, label: "Alumnos", path: "/admin/alumnos" },
		{ icon: UserCheck, label: "Tutores", path: "/admin/tutores" },
	];

	return (
		<div className="fixed left-0 top-0 h-screen w-64 bg-[#252d62] text-white flex flex-col shadow-xl z-50">
			{/* Logo */}
			<div className="p-4 border-b border-white/10 ">
				<Image
					src={logo}
					alt="English Empire Institute"
					width={400}
					height={120}
					className="w-full h-auto bg-white rounded-lg"
					priority
				/>
			</div>

			{/* Navigation Menu */}
			<nav className="flex-1 py-6 px-3 overflow-y-auto">
				<ul className="space-y-1.5">
					{menuItems.map((item, index) => {
						const Icon = item.icon;
						// Verificamos si la ruta actual coincide exactamente, o si es una sub-ruta
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
			</nav>

			{/* Footer */}
			<div className="p-4 border-t border-white/10">
				<p className="text-xs text-white/60 text-center">
					© 2026 English Empire Institute
				</p>
			</div>
		</div>
	);
};

export default Sidebar;
