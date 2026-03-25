"use client";

import React, { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import AlumnosTable from "@/components/admin/alumnos/AlumnosTable";
import CreateStudentModal from "@/components/admin/alumnos/CreateStudentModal";

export default function AlumnosPage() {
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const [newStudent, setNewStudent] = useState<any>(null);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
				<div>
					<h1 className="text-2xl font-bold text-[#252d62]">
						Gestión de Usuarios
					</h1>
					<p className="text-gray-500 text-sm mt-1">
						Administra titulares, tutores y menores registrados en el instituto.
					</p>
				</div>

				<Button
					onClick={() => setIsCreateModalOpen(true)}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white shadow-md flex items-center w-full sm:w-auto"
				>
					<UserPlus className="w-4 h-4 mr-2" />
					Nuevo Alumno
				</Button>
			</div>

			<AlumnosTable newStudent={newStudent} />

			<CreateStudentModal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				onSuccess={(student) => {
					if (student) {
						setNewStudent(student); // Guardamos el alumno nuevo
					}
					setIsCreateModalOpen(false); // Cerramos el modal suavemente
				}}
			/>
		</div>
	);
}
