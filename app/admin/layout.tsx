import React from "react";
import Sidebar from "@/components/admin/Sidebar";
import Header from "@/components/admin/Header";

// Reemplazo nativo de Next.js para el <Helmet> de React
export const metadata = {
	title: "Panel de Administración - English Empire Institute",
	description:
		"Panel de control administrativo para gestionar alumnos, cursos, inscripciones y pagos.",
};

export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-screen bg-gray-50 flex">
			<Sidebar />
			<div className="flex-1 ml-64 flex flex-col min-w-0">
				<Header />
				<main className="p-8 flex-1 overflow-x-hidden">{children}</main>
			</div>
		</div>
	);
}
