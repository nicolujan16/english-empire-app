"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell } from "lucide-react";

const Header = () => {
	return (
		<header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
			<div className="px-8 py-4 flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-[#252d62]">
						Hola, Administrador
					</h1>
					<p className="text-sm text-gray-500 mt-0.5">
						Bienvenido al panel de administración
					</p>
				</div>

				<div className="flex items-center gap-4">
					<button className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 relative">
						<Bell className="w-5 h-5 text-gray-600" />
						<span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#EE1120] rounded-full"></span>
					</button>

					<Avatar className="w-10 h-10 border-2 border-[#252d62]/20">
						<AvatarImage
							src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin"
							alt="Admin"
							className="bg-white"
						/>
						<AvatarFallback className="bg-[#252d62] text-white font-semibold">
							AD
						</AvatarFallback>
					</Avatar>
				</div>
			</div>
		</header>
	);
};

export default Header;
