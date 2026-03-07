"use client";

import React from "react";
import Link from "next/link"; // Importamos Link para la redirección
import { Plus } from "lucide-react"; // Importamos un ícono lindo para el botón
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { StudentDetails } from "@/types";

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
	if (!student) return null;

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[700px]">
				<DialogHeader>
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
							{student.nombre} {student.apellido}
						</p>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-500">DNI</p>
						<p className="text-lg font-semibold text-gray-900">{student.dni}</p>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-500">Edad</p>
						<p className="text-lg font-semibold text-gray-900">
							{Math.floor(
								(new Date().getTime() -
									new Date(student.fechaNacimiento).getTime()) /
									(1000 * 60 * 60 * 24 * 365.25),
							)}{" "}
							años
						</p>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-500">
							Fecha de nacimiento
						</p>
						<p className="text-lg font-semibold text-gray-900">
							{student.fechaNacimiento.split("-").reverse().join("/")}
						</p>
					</div>
				</div>

				{/* --- CURSOS INSCRIPTOS --- */}
				<div className="border-t pt-6">
					{/* NUEVO: Header de la sección con el botón de Inscribir */}
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-bold text-[#252d62]">
							Cursos inscritos
						</h3>
						<Button
							asChild
							className="bg-[#EE1120] hover:bg-[#c4000e] text-white flex items-center gap-2 transition-all shadow-sm"
						>
							<Link href="/cursos">
								<Plus className="w-4 h-4" />
								Inscribir a curso nuevo
							</Link>
						</Button>
					</div>

					<div className="overflow-hidden rounded-lg border border-gray-200">
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
											Cuotas
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-200">
									{student?.cursos?.length > 0 ? (
										student.cursos.map((course) => (
											<tr key={course.courseId} className="hover:bg-gray-50">
												<td className="px-4 py-3 text-gray-900 font-medium">
													{course.nombreCurso}
												</td>
												<td className="px-4 py-3 text-gray-600">
													{course.fechaInicio}
												</td>
												<td className="px-4 py-3 text-gray-600">
													{course.cuotasPagadas}/{course.totalCuotas}
												</td>
											</tr>
										))
									) : (
										<tr>
											<td
												colSpan={4}
												className="px-4 py-8 text-center text-gray-500 bg-gray-50/50"
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
						variant="outline"
						className="text-[#252d62] border-[#252d62] hover:bg-[#252d62] hover:text-white transition-all"
					>
						Cerrar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
