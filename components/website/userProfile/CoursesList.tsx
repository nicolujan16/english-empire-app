import React from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";

function CoursesList() {
	// Sample courses data
	const courses = [
		{
			id: 1,
			name: "Inglés Básico A1",
			startDate: "10/02/2026",
			endDate: "15/05/2026",
			teacher: "Prof. John Smith",
		},
		{
			id: 2,
			name: "Inglés Intermedio B1",
			startDate: "12/02/2026",
			endDate: "20/05/2026",
			teacher: "Prof. Sarah Johnson",
		},
		{
			id: 3,
			name: "Inglés Avanzado C1",
			startDate: "15/02/2026",
			endDate: "25/05/2026",
			teacher: "Prof. Michael Brown",
		},
		{
			id: 4,
			name: "Preparación TOEFL",
			startDate: "18/02/2026",
			endDate: "30/05/2026",
			teacher: "Prof. Emily Davis",
		},
	];

	const handleEnroll = () => {};

	return (
		<div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-2xl font-bold text-[#1a237e]">Lista de cursos</h2>
				<Button
					onClick={handleEnroll}
					className="bg-[#d30000] hover:bg-[#b30000] text-white flex items-center gap-2"
				>
					<Plus className="w-4 h-4" />
					<Link href="/curso">Inscribirse a nuevo curso</Link>
				</Button>
			</div>

			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr className="border-b-2 border-gray-200">
							<th className="text-left py-4 px-4 font-semibold text-gray-700">
								Nombre del curso
							</th>
							<th className="text-left py-4 px-4 font-semibold text-gray-700">
								Fecha de inicio
							</th>
							<th className="text-left py-4 px-4 font-semibold text-gray-700">
								Fecha de finalización
							</th>
							<th className="text-left py-4 px-4 font-semibold text-gray-700">
								Nombre del profesor
							</th>
						</tr>
					</thead>
					<tbody>
						{courses.map((course) => (
							<tr
								key={course.id}
								className="border-b border-gray-100 hover:bg-blue-50 transition-colors"
							>
								<td className="py-4 px-4 text-gray-900 font-medium">
									{course.name}
								</td>
								<td className="py-4 px-4 text-gray-700">{course.startDate}</td>
								<td className="py-4 px-4 text-gray-700">{course.endDate}</td>
								<td className="py-4 px-4 text-gray-700">{course.teacher}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default CoursesList;
