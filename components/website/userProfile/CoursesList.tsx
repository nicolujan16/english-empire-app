"use client";

import React, { useEffect, useState } from "react";
import { Plus, BookOpen, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "../../ui/button";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

interface CourseDetails {
	id: string;
	nombre: string;
	inicioMes: number;
	finMes: number;
}

// NUEVO: Agregamos cuotasPagadas a las props
interface CoursesListProps {
	cursos: string[] | null;
	cuotasPagadas?: Record<string, string[]>;
}

// Diccionario para convertir el número a string
const MESES = [
	"Enero",
	"Febrero",
	"Marzo",
	"Abril",
	"Mayo",
	"Junio",
	"Julio",
	"Agosto",
	"Septiembre",
	"Octubre",
	"Noviembre",
	"Diciembre",
];

function CoursesList({
	cursos: cursoInscripto,
	cuotasPagadas,
}: CoursesListProps) {
	const hasCourses = cursoInscripto && cursoInscripto.length > 0;

	const [courseData, setCourseData] = useState<CourseDetails | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		const fetchCourseDetails = async () => {
			if (hasCourses && cursoInscripto[0]) {
				setIsLoading(true);
				try {
					const docRef = doc(db, "Cursos", cursoInscripto[0]);
					const docSnap = await getDoc(docRef);

					if (docSnap.exists()) {
						setCourseData({
							id: docSnap.id,
							...docSnap.data(),
						} as CourseDetails);
					} else {
						console.error("El curso no existe en la base de datos.");
					}
				} catch (error) {
					console.error("Error al cargar el curso:", error);
				} finally {
					setIsLoading(false);
				}
			}
		};

		fetchCourseDetails();
	}, [cursoInscripto, hasCourses]);

	// Variables calculadas en base a los datos obtenidos
	let totalCuotas = 0;
	let pagadasCount = 0;
	let mesInicioNombre = "";

	if (courseData) {
		// Cálculo de cuotas totales (Ej: 11 - 4 + 1 = 8 cuotas)
		totalCuotas = courseData.finMes - courseData.inicioMes + 1;
		// Mapeo del mes (Ej: 4 - 1 = índice 3 -> "Abril")
		mesInicioNombre =
			MESES[courseData.inicioMes - 1] || `Mes ${courseData.inicioMes}`;

		// Contamos cuántas cuotas pagó de ESTE curso en particular
		if (cursoInscripto && cursoInscripto[0]) {
			pagadasCount = cuotasPagadas?.[cursoInscripto[0]]?.length || 0;
		}
	}

	return (
		<div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-2xl font-bold text-[#252d62]">Mis Cursos</h2>
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
					{isLoading ? (
						<div className="flex justify-center items-center py-8">
							<Loader2 className="w-8 h-8 animate-spin text-[#252d62]" />
						</div>
					) : courseData ? (
						<table className="w-full">
							<thead>
								<tr className="border-b-2 border-gray-200">
									<th className="text-left py-4 px-4 font-semibold text-gray-700">
										Nombre del curso
									</th>
									<th className="text-left py-4 px-4 font-semibold text-gray-700">
										Inicio
									</th>
									<th className="text-left py-4 px-4 font-semibold text-gray-700">
										Estado de Cuotas
									</th>
								</tr>
							</thead>
							<tbody>
								<tr className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
									<td className="py-4 px-4 text-gray-900 font-bold">
										{courseData.nombre}
									</td>
									<td className="py-4 px-4 text-gray-700 font-medium">
										{mesInicioNombre}
									</td>
									<td className="py-4 px-4 text-gray-700">
										{/* Badge visual que cambia de color si pagó todo o no */}
										<span
											className={`py-1 px-3 rounded-full text-sm font-bold ${
												pagadasCount >= totalCuotas
													? "bg-green-100 text-green-800"
													: "bg-blue-100 text-[#252d62]"
											}`}
										>
											{pagadasCount} / {totalCuotas} Pagadas
										</span>
									</td>
								</tr>
							</tbody>
						</table>
					) : (
						<p className="text-center text-gray-500 py-4">
							No se pudo cargar la información del curso.
						</p>
					)}
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
