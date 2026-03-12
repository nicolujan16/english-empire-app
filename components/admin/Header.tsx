"use client";

import React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu } from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import Link from "next/link";

const Header = ({
	setIsSidebarOpen,
}: {
	setIsSidebarOpen: (isOpen: boolean) => void;
}) => {
	const { adminData } = useAdminAuth();

	const getInitials = (name?: string) => {
		if (!name) return "AD";
		const parts = name.trim().split(/\s+/);
		if (parts.length === 1) {
			return parts[0].charAt(0).toUpperCase();
		}
		return (
			parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
		).toUpperCase();
	};

	return (
		<header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-2 ">
			<div className="px-8 py-4 flex items-center justify-between">
				<div className="flex gap-4 justify-center items-center">
					<button
						onClick={() => setIsSidebarOpen(true)}
						className="lg:hidden bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors w-10 h-10 flex items-center justify-center"
					>
						<Menu className="w-6 h-6" />
					</button>
					<div>
						<h1 className="text-2xl font-bold text-[#252d62]">
							{/* Añadido un pequeño fallback por si adminData tarda en cargar */}
							Hola, {adminData?.nombre?.split(" ")[0] || "Admin"}
						</h1>
						<p className="text-sm text-gray-500 mt-0.5">
							Bienvenido al panel de administración
						</p>
					</div>
				</div>

				<Link href={"/admin/configuracion"} className="flex items-center gap-4">
					<Avatar className="w-10 h-10 border-2 border-[#252d62]/20">
						<AvatarFallback className="bg-[#252d62] text-white font-bold tracking-widest text-sm">
							{getInitials(adminData?.nombre)}
						</AvatarFallback>
					</Avatar>
				</Link>
			</div>
		</header>
	);
};

export default Header;
