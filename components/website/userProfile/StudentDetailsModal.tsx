"use client";

import React from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";

// 1. Tipamos el objeto del curso
interface Course {
	id: number;
	name: string;
	start: string;
	end: string;
	teacher: string;
}

// 2. Tipamos la información del alumno que esperamos recibir
export interface StudentDetails {
	id?: string | number; // Opcional por si no lo pasas
	fullName: string;
	dni: string;
	age: number | string;
	birthDate: string;
}

// 3. Tipamos las Props del Modal
interface StudentDetailsModalProps {
	student: StudentDetails | null;
	isOpen: boolean;
	onClose: () => void;
}

export default function StudentDetailsModal({
	student,
	isOpen,
	onClose,
}: StudentDetailsModalProps) {
	// Si no hay estudiante seleccionado, el modal no renderiza nada interno
	if (!student) return null;

	// Mock data for courses (Tipamos el array)
	const enrolledCourses: Course[] = [
		{
			id: 1,
			name: "Inglés Básico A1",
			start: "10/02/2026",
			end: "15/05/2026",
			teacher: "Prof. Smith",
		},
		{
			id: 2,
			name: "Conversación I",
			start: "20/02/2026",
			end: "20/04/2026",
			teacher: "Prof. Johnson",
		},
	];

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[700px]">
				<DialogHeader>
					{/* Ajustado el color al azul institucional */}
					<DialogTitle className="text-2xl font-bold text-[#252d62] mb-4">
						Detalles del Alumno
					</DialogTitle>
				</DialogHeader>

				{/* --- DATOS PERSONALES --- */}
				<div className="grid grid-cols-2 gap-6 mb-6">
					<div>
						<p className="text-sm font-medium text-gray-500">
							Nombre y Apellido
						</p>
						<p className="text-lg font-semibold text-gray-900">
							{student.fullName}
						</p>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-500">DNI</p>
						<p className="text-lg font-semibold text-gray-900">{student.dni}</p>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-500">Edad</p>
						<p className="text-lg font-semibold text-gray-900">
							{student.age} años
						</p>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-500">
							Fecha de nacimiento
						</p>
						<p className="text-lg font-semibold text-gray-900">
							{student.birthDate}
						</p>
					</div>
				</div>

				{/* --- CURSOS INSCRIPTOS --- */}
				<div className="border-t pt-6">
					<h3 className="text-lg font-bold text-[#252d62] mb-4">
						Cursos inscritos
					</h3>

					<div className="overflow-hidden rounded-lg border border-gray-200">
						{/* Si hubiese muchos cursos, un overflow-x-auto ayudaría en móviles */}
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead className="bg-gray-50">
									<tr>
										<th className="px-4 py-3 text-left font-medium text-gray-700 whitespace-nowrap">
											Nombre del curso
										</th>
										<th className="px-4 py-3 text-left font-medium text-gray-700 whitespace-nowrap">
											Inicio
										</th>
										<th className="px-4 py-3 text-left font-medium text-gray-700 whitespace-nowrap">
											Fin
										</th>
										<th className="px-4 py-3 text-left font-medium text-gray-700 whitespace-nowrap">
											Profesor
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-200">
									{enrolledCourses.length > 0 ? (
										enrolledCourses.map((course) => (
											<tr key={course.id} className="hover:bg-gray-50">
												<td className="px-4 py-3 text-gray-900 font-medium">
													{course.name}
												</td>
												<td className="px-4 py-3 text-gray-600">
													{course.start}
												</td>
												<td className="px-4 py-3 text-gray-600">
													{course.end}
												</td>
												<td className="px-4 py-3 text-gray-600">
													{course.teacher}
												</td>
											</tr>
										))
									) : (
										<tr>
											<td
												colSpan={4}
												className="px-4 py-6 text-center text-gray-500"
											>
												Este alumno aún no está inscripto en ningún curso.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>

				{/* --- FOOTER --- */}
				<DialogFooter className="mt-6">
					<Button
						onClick={onClose}
						// Cambiado a variante predeterminada de shadcn o colores institucionales
						className="bg-[#252d62] hover:bg-[#1d2355] text-white"
					>
						Cerrar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
