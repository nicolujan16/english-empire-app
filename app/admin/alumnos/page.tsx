"use client";

import React, { useState } from "react"; // <-- Importamos useState
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import AlumnosTable from "@/components/admin/alumnos/AlumnosTable";
import CreateStudentModal from "@/components/admin/alumnos/CreateStudentModal"; // <-- Importamos el Modal

export default function AlumnosPage() {
	// Estado para controlar si el modal está abierto o cerrado
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<div>
					<h1 className="text-2xl font-bold text-[#252d62]">
						Gestión de Alumnos
					</h1>
					<p className="text-gray-500 text-sm mt-1">
						Administra titulares, tutores y menores inscriptos en el instituto.
					</p>
				</div>

				{/* Cambiamos el <Link> por un botón que abre el modal */}
				<Button
					onClick={() => setIsCreateModalOpen(true)}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white shadow-md flex items-center w-full sm:w-auto"
				>
					<UserPlus className="w-4 h-4 mr-2" />
					Nuevo Alumno
				</Button>
			</div>

			{/* --- TABLA --- */}
			<AlumnosTable />

			{/* --- MODAL --- */}
			<CreateStudentModal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				// onSuccess={() => { ... Opcional: Podrías forzar recargar la tabla acá,
				// pero como AlumnosTable usa onSnapshot/fetchData, quizás quieras recargar
				// o dejarlo así ya que el fetch inicial lee la BD. }}
			/>
		</div>
	);
}
