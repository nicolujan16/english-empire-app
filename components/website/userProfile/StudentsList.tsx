"use client";

import React, { useState } from "react";
import { Button } from "../../ui/button";
import { Plus, Users } from "lucide-react";
import AddStudentModal from "./AddStudentModal";
import StudentDetailsModal from "./StudentDetailsModal";
import { StudentDetails } from "@/types";

function StudentsList({ students = [] }: { students: StudentDetails[] }) {
	const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
	const [selectedStudent, setSelectedStudent] = useState<StudentDetails | null>(
		null,
	);

	const hasStudents = students && students.length > 0;

	return (
		<div className="bg-white rounded-xl shadow-md p-6 md:p-8 border border-gray-100 h-full">
			{/* HEADER */}
			<div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
				<h2 className="text-xl md:text-2xl font-bold text-[#252d62]">
					Lista de alumnos a cargo
				</h2>
				<Button
					onClick={() => setIsAddModalOpen(true)}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white flex items-center gap-2 transition-all cursor-pointer w-full sm:w-auto"
				>
					<Plus className="w-4 h-4" />
					Agregar nuevo alumno
				</Button>
			</div>

			{hasStudents ? (
				<>
					{/* MOBILE: Tarjetas */}
					<div className="flex flex-col gap-3 md:hidden">
						{students.map((student) => {
							const age = Math.floor(
								(new Date().getTime() -
									new Date(student.fechaNacimiento).getTime()) /
									(1000 * 60 * 60 * 24 * 365.25),
							);

							return (
								<div
									key={student.dni}
									onClick={() => setSelectedStudent(student)}
									className="border border-gray-200 rounded-lg p-4 hover:bg-blue-50 transition-colors cursor-pointer"
								>
									<p className="font-semibold text-gray-900 text-base mb-2">
										{student.nombre} {student.apellido}
									</p>
									<div className="grid grid-cols-2 gap-1 text-sm">
										<span className="text-gray-500">DNI</span>
										<span className="text-gray-700 font-medium">
											{student.dni}
										</span>

										<span className="text-gray-500">Edad</span>
										<span className="text-gray-700 font-medium">
											{isNaN(age) ? "-" : `${age} años`}
										</span>

										<span className="text-gray-500">Nacimiento</span>
										<span className="text-gray-700 font-medium">
											{student.fechaNacimiento}
										</span>
									</div>
								</div>
							);
						})}
					</div>

					{/* DESKTOP: Tabla */}
					<div className="hidden md:block overflow-x-auto">
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
									const age = Math.floor(
										(new Date().getTime() -
											new Date(student.fechaNacimiento).getTime()) /
											(1000 * 60 * 60 * 24 * 365.25),
									);

									return (
										<tr
											key={student.dni}
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
				</>
			) : (
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

			<AddStudentModal
				isOpen={isAddModalOpen}
				onClose={() => setIsAddModalOpen(false)}
			/>

			<StudentDetailsModal
				student={selectedStudent}
				isOpen={!!selectedStudent}
				onClose={() => setSelectedStudent(null)}
			/>
		</div>
	);
}

export default StudentsList;
