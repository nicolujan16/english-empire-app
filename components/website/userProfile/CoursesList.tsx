import React from "react";
import { Plus, BookOpen } from "lucide-react"; // Sumamos BookOpen para el estado vacío
import Link from "next/link";
import { Button } from "../../ui/button";
import { CursoInscripto } from "@/types";

function CoursesList({ cursos }: { cursos: CursoInscripto[] | null }) {
	// Verificamos si realmente hay cursos en el array
	const hasCourses = cursos && cursos.length > 0;

	return (
		<div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-2xl font-bold text-[#252d62]">Lista de cursos</h2>
				<Button
					asChild
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white flex items-center gap-2 transition-all"
				>
					<Link href="/cursos">
						<Plus className="w-4 h-4" />
						Inscribirse a nuevo curso
					</Link>
				</Button>
			</div>

			{hasCourses ? (
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
									Cuotas pagas
								</th>
							</tr>
						</thead>
						<tbody>
							{cursos.map((course) => (
								<tr
									key={course.courseId}
									className="border-b border-gray-100 hover:bg-blue-50 transition-colors"
								>
									<td className="py-4 px-4 text-gray-900 font-medium">
										{course.nombreCurso}
									</td>
									<td className="py-4 px-4 text-gray-700">
										{course.fechaInicio}
									</td>
									<td className="py-4 px-4 text-gray-700">
										<span className="bg-gray-100 text-gray-700 py-1 px-3 rounded-full text-sm font-bold">
											{course.cuotasPagadas} / {course.totalCuotas}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
					<div className="bg-white p-4 rounded-full shadow-sm mb-4">
						<BookOpen className="w-8 h-8 text-[#252d62]" />
					</div>
					<h3 className="text-lg font-bold text-gray-900 mb-2">
						Aún no tienes cursos
					</h3>
					<p className="text-gray-500 max-w-md mb-6">
						Parece que todavía no te has inscripto en ninguna de nuestras
						materias. ¡Empieza tu camino en English Empire hoy mismo!
					</p>
					<Button
						asChild
						variant="outline"
						className="text-[#252d62] border-[#252d62] hover:bg-[#252d62] hover:text-white transition-all"
					>
						<Link href="/cursos">Explorar cursos disponibles</Link>
					</Button>
				</div>
			)}
		</div>
	);
}

export default CoursesList;
