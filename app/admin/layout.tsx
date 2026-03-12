"use client";

import React, { useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import Header from "@/components/admin/Header";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import AdminGuard from "@/components/admin/AdminGuard";

export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);

	return (
		<>
			<title>Panel de Administración - English Empire Institute</title>
			<meta
				name="description"
				content="Panel de control administrativo para gestionar alumnos, cursos, inscripciones y pagos."
			/>

			<AdminAuthProvider>
				<AdminGuard>
					<div className="bg-gray-50 flex relative">
						<Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

						{isSidebarOpen && (
							<div
								className="fixed inset-0 bg-black/50 z-40 lg:hidden"
								onClick={() => setIsSidebarOpen(false)}
							/>
						)}

						<div className="flex-1 lg:ml-64 flex flex-col min-w-0 w-full">
							<Header setIsSidebarOpen={setIsSidebarOpen} />
							<main className="p-4 md:p-8 flex-1 overflow-x-hidden">
								{children}
							</main>
						</div>
					</div>
				</AdminGuard>
			</AdminAuthProvider>
		</>
	);
}
