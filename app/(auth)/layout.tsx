import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import logo from "@/assets/logo-empire.png";

export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		// Cambiamos min-h-screen por h-screen y agregamos overflow-y-auto por si lo abren en un celular muy chiquito
		<div className="min-h-screen w-full bg-[#f1f1f1] flex flex-col justify-center items-center p-6 relative overflow-y-auto">
			{/* Ajustamos la posición del botón de volver */}
			<Link
				href="/"
				className="absolute top-4 left-4 md:top-6 md:left-6 flex items-center gap-2 text-[#252d62] font-medium hover:underline transition-all"
			>
				<ArrowLeft size={24} /> <span>Volver al inicio</span>
			</Link>
			<Image
				src={logo}
				alt="English Empire Logo"
				className="w-[260px] h-auto object-contain"
				priority
			/>

			<div className="w-full max-w-xl min-w-80 bg-white rounded-[20px] shadow-xl border border-gray-100 p-4 md:p-8">
				{children}
			</div>
		</div>
	);
}
