"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Loader2 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { StudentDetails } from "@/types";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

interface StudentDetailsModalProps {
	student: StudentDetails | null;
	isOpen: boolean;
	onClose: () => void;
}

// Interfaz simplificada
interface FetchedCourse {
	id: string;
	nombre: string;
}

export default function StudentDetailsModal({
	student,
	isOpen,
	onClose,
}: StudentDetailsModalProps) {
	// Ahora es un solo objeto, no un array
	const [enrolledCourse, setEnrolledCourse] = useState<FetchedCourse | null>(
		null,
	);
	const [isLoadingCourse, setIsLoadingCourse] = useState(false);

	useEffect(() => {
		const fetchCourse = async () => {
			if (
				!isOpen ||
				!student ||
				!student.cursos ||
				student.cursos.length === 0
			) {
				setEnrolledCourse(null);
				return;
			}

			setIsLoadingCourse(true);
			try {
				// Como solo puede tener 1 curso, agarramos directamente el elemento 0
				const cursoId = student.cursos[0] as string;
				const courseRef = doc(db, "Cursos", cursoId);
				const courseSnap = await getDoc(courseRef);

				if (courseSnap.exists()) {
					setEnrolledCourse({
						id: courseSnap.id,
						nombre: courseSnap.data().nombre || "Curso sin nombre",
					});
				} else {
					setEnrolledCourse(null);
				}
			} catch (error) {
				console.error("Error al obtener el curso del alumno:", error);
			} finally {
				setIsLoadingCourse(false);
			}
		};

		fetchCourse();
	}, [isOpen, student]);

	if (!student) return null;

	// Variable auxiliar para saber si ya tiene curso
	const hasCourse = !!enrolledCourse;

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

				{/* --- CURSO INSCRIPTO --- */}
				<div className="border-t pt-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-bold text-[#252d62]">
							Curso inscripto
						</h3>

						{/* Si NO tiene curso y NO está cargando, mostramos el botón */}
						{!hasCourse && !isLoadingCourse && (
							<Button
								asChild
								className="bg-[#EE1120] hover:bg-[#c4000e] text-white flex items-center gap-2 transition-all shadow-sm"
							>
								<Link href="/cursos">
									<Plus className="w-4 h-4" />
									Inscribir a un curso
								</Link>
							</Button>
						)}
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
											Estado
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-200">
									{isLoadingCourse ? (
										<tr>
											<td colSpan={2} className="px-4 py-8 text-center">
												<Loader2 className="w-6 h-6 animate-spin text-[#EE1120] mx-auto" />
											</td>
										</tr>
									) : hasCourse ? (
										<tr className="hover:bg-gray-50">
											<td className="px-4 py-3 text-gray-900 font-bold">
												{enrolledCourse.nombre}
											</td>
											<td className="px-4 py-3 text-green-600 font-medium flex items-center gap-1.5">
												<span className="w-2 h-2 rounded-full bg-green-500"></span>
												Inscripción Activa
											</td>
										</tr>
									) : (
										<tr>
											<td
												colSpan={2}
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
