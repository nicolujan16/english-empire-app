"use client";

import React, { useState } from "react";
import { Button } from "../ui/button";
import { Plus, Users } from "lucide-react"; // Importamos 'Users' para el estado vacío
import AddStudentModal from "./AddStudentModal";
import StudentDetailsModal from "./StudentDetailsModal";
import { StudentDetails } from "@/types";

function StudentsList({ students = [] }: { students: StudentDetails[] }) {
	const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
	const [selectedStudent, setSelectedStudent] = useState<StudentDetails | null>(
		null,
	);

	// Variable para que el renderizado condicional sea más legible
	const hasStudents = students && students.length > 0;

	return (
		<div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
			{/* HEADER DE LA SECCIÓN */}
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-2xl font-bold text-[#252d62]">
					Lista de alumnos a cargo
				</h2>
				<Button
					onClick={() => setIsAddModalOpen(true)}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white flex items-center gap-2 transition-all cursor-pointer"
				>
					<Plus className="w-4 h-4" />
					Agregar nuevo alumno
				</Button>
			</div>

			{/* RENDERIZADO CONDICIONAL */}
			{hasStudents ? (
				// --- 1. ESTADO CON DATOS (Muestra la tabla) ---
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-b-2 border-gray-200">
								<th className="text-left py-4 px-4 font-semibold text-gray-700">
									Nombre y Apellido
								</th>
								<th className="text-left py-4 px-4 font-semibold text-gray-700">
									DNI
								</th>
								<th className="text-left py-4 px-4 font-semibold text-gray-700">
									Edad
								</th>
								<th className="text-left py-4 px-4 font-semibold text-gray-700">
									Fecha de nacimiento
								</th>
							</tr>
						</thead>
						<tbody>
							{students.map((student) => {
								// Cálculo de edad aislado para mayor claridad
								const age = Math.floor(
									(new Date().getTime() -
										new Date(student.fechaNacimiento).getTime()) /
										(1000 * 60 * 60 * 24 * 365.25),
								);

								return (
									<tr
										key={student.dni} // Usamos DNI como key porque es único
										onClick={() => setSelectedStudent(student)}
										className="border-b border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer"
									>
										<td className="py-4 px-4 text-gray-900 font-medium">
											{student.nombre} {student.apellido}
										</td>
										<td className="py-4 px-4 text-gray-700">{student.dni}</td>
										<td className="py-4 px-4 text-gray-700">
											{isNaN(age) ? "-" : `${age} años`}
										</td>
										<td className="py-4 px-4 text-gray-700">
											{student.fechaNacimiento}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			) : (
				// --- 2. ESTADO VACÍO (Muestra un mensaje amigable) ---
				<div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
					<div className="bg-white p-4 rounded-full shadow-sm mb-4">
						<Users className="w-8 h-8 text-[#252d62]" />
					</div>
					<h3 className="text-lg font-bold text-gray-900 mb-2">
						Aún no tienes alumnos a cargo
					</h3>
					<p className="text-gray-500 max-w-md mb-6">
						Si eres tutor y deseas inscribir a familiares o menores a cargo,
						puedes agregarlos aquí para gestionar sus cursos.
					</p>
					<Button
						onClick={() => setIsAddModalOpen(true)}
						variant="outline"
						className="text-[#252d62] border-[#252d62] hover:bg-[#252d62] hover:text-white transition-all flex items-center gap-2 cursor-pointer"
					>
						<Plus className="w-4 h-4" />
						Agregar un alumno
					</Button>
				</div>
			)}

			{/* --- MODALES --- */}
			<AddStudentModal
				isOpen={isAddModalOpen}
				onClose={() => setIsAddModalOpen(false)}
			/>

			{/* Para StudentDetailsModal necesitamos formatear la data para que coincida con su prop interface */}
			<StudentDetailsModal
				student={selectedStudent}
				isOpen={!!selectedStudent}
				onClose={() => setSelectedStudent(null)}
			/>
		</div>
	);
}

export default StudentsList;
