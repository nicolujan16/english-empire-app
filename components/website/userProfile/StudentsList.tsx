"use client";

import React, { useState } from "react";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import AddStudentModal from "./AddStudentModal";
import StudentDetailsModal from "./StudentDetailsModal";

interface Student {
	id: number;
	fullName: string;
	dni: string;
	age: number;
	birthDate: string;
}

function StudentsList() {
	const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
	const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

	// Sample students data
	const students = [
		{
			id: 1,
			fullName: "Carlos Rodríguez López",
			dni: "12345678",
			age: 22,
			birthDate: "15/03/2004",
		},
		{
			id: 2,
			fullName: "Ana Martínez García",
			dni: "23456789",
			age: 19,
			birthDate: "22/07/2007",
		},
		{
			id: 3,
			fullName: "Luis Fernández Ruiz",
			dni: "34567890",
			age: 25,
			birthDate: "10/11/2001",
		},
		{
			id: 4,
			fullName: "Laura Sánchez Moreno",
			dni: "45678901",
			age: 21,
			birthDate: "05/09/2005",
		},
		{
			id: 5,
			fullName: "Pedro Jiménez Castro",
			dni: "56789012",
			age: 23,
			birthDate: "18/01/2003",
		},
	];

	return (
		<div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-2xl font-bold text-[#1a237e]">
					Lista de alumnos a cargo
				</h2>
				<Button
					onClick={() => setIsAddModalOpen(true)}
					className="bg-[#d30000] hover:bg-[#b30000] text-white flex items-center gap-2"
				>
					<Plus className="w-4 h-4" />
					Agregar nuevo alumno
				</Button>
			</div>

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
						{students.map((student) => (
							<tr
								key={student.id}
								onClick={() => setSelectedStudent(student)}
								className="border-b border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer"
							>
								<td className="py-4 px-4 text-gray-900 font-medium">
									{student.fullName}
								</td>
								<td className="py-4 px-4 text-gray-700">{student.dni}</td>
								<td className="py-4 px-4 text-gray-700">{student.age}</td>
								<td className="py-4 px-4 text-gray-700">{student.birthDate}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

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
