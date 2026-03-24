import React from "react";
import Image from "next/image";
import logoIMG from "@/public/icon.png";

export const metadata = {
	title: "Portal Docente | English Empire",
	description: "Acceso exclusivo para profesores de English Empire Institute",
};

export default function ProfesoresLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-screen bg-slate-50 flex flex-col font-sans">
			{/* Navbar simplificado para el profesor */}
			<header className="bg-[#4338ca] text-white sticky top-0 z-40 shadow-md">
				<div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className=" p-2 rounded-lg backdrop-blur-sm">
							{/* <BookOpen className="w-5 h-5 text-white" /> */}
							<Image src={logoIMG} alt="" height={40} width={40} />
						</div>
						<div>
							<h1 className="font-bold text-lg leading-tight tracking-wide">
								English Empire Institute
							</h1>
							<p className="text-[10px] text-indigo-200 font-medium uppercase tracking-widest">
								Portal Docente
							</p>
						</div>
					</div>
				</div>
			</header>

			{/* Contenedor principal */}
			<main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 flex flex-col">
				{children}
			</main>
		</div>
	);
}
