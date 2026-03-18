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
import {
	doc,
	getDoc,
	collection,
	query,
	where,
	getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

interface StudentDetailsModalProps {
	student: StudentDetails | null;
	isOpen: boolean;
	onClose: () => void;
}

interface FetchedCourse {
	id: string;
	nombre: string;
}

type CuotaEstadoBadge =
	| { tipo: "al-dia" }
	| { tipo: "pendiente"; mes: number }
	| { tipo: "atraso"; desdeMes: number };

interface CuotaDoc {
	estado: string;
	mes: number;
}

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

function calcularEstadoCuota(cuotas: CuotaDoc[]): CuotaEstadoBadge {
	const mesActual = new Date().getMonth() + 1;
	const pendientes = cuotas.filter((c) => c.estado === "Pendiente");

	const atrasadas = pendientes.filter((c) => c.mes < mesActual);
	if (atrasadas.length > 0) {
		const mesMasAntiguo = Math.min(...atrasadas.map((c) => c.mes));
		return { tipo: "atraso", desdeMes: mesMasAntiguo };
	}

	const pendienteActual = pendientes.find((c) => c.mes === mesActual);
	if (pendienteActual) return { tipo: "pendiente", mes: mesActual };

	return { tipo: "al-dia" };
}

function CuotaBadge({ estado }: { estado: CuotaEstadoBadge }) {
	if (estado.tipo === "al-dia") {
		return (
			<span className="py-1 px-3 rounded-full text-sm font-bold bg-green-100 text-green-800">
				✓ Al Día
			</span>
		);
	}
	if (estado.tipo === "pendiente") {
		return (
			<span className="py-1 px-3 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800">
				Pendiente {MESES[estado.mes - 1]}
			</span>
		);
	}
	return (
		<span className="py-1 px-3 rounded-full text-sm font-bold bg-red-100 text-red-800">
			Atraso desde {MESES[estado.desdeMes - 1]}
		</span>
	);
}

function PagarCuotaButton({ estado }: { estado: CuotaEstadoBadge }) {
	if (estado.tipo === "al-dia") return null;

	const label =
		estado.tipo === "atraso" ? "Pagar cuotas atrasadas" : "Pagar cuota";

	return (
		<Link href="mi-cuenta/cuotas">
			<Button
				size="sm"
				className="bg-white border border-[#EE1120] text-[#EE1120] hover:bg-[#EE1120] hover:text-white transition-colors"
			>
				{label}
			</Button>
		</Link>
	);
}

export default function StudentDetailsModal({
	student,
	isOpen,
	onClose,
}: StudentDetailsModalProps) {
	const [enrolledCourse, setEnrolledCourse] = useState<FetchedCourse | null>(
		null,
	);
	const [cuotaEstado, setCuotaEstado] = useState<CuotaEstadoBadge | null>(null);
	const [isLoadingCourse, setIsLoadingCourse] = useState(false);

	useEffect(() => {
		const fetchCourseAndCuota = async () => {
			if (
				!isOpen ||
				!student ||
				!student.cursos ||
				student.cursos.length === 0
			) {
				setEnrolledCourse(null);
				setCuotaEstado(null);
				return;
			}

			setIsLoadingCourse(true);
			try {
				const cursoId = student.cursos[0] as string;

				// Fetch curso y cuotas en paralelo
				const [courseSnap, cuotasSnap] = await Promise.all([
					getDoc(doc(db, "Cursos", cursoId)),
					getDocs(
						query(
							collection(db, "Cuotas"),
							where("alumnoId", "==", String(student.id)),
							where("cursoId", "==", cursoId),
							where("anio", "==", new Date().getFullYear()),
						),
					),
				]);

				if (courseSnap.exists()) {
					setEnrolledCourse({
						id: courseSnap.id,
						nombre: courseSnap.data().nombre || "Curso sin nombre",
					});
				} else {
					setEnrolledCourse(null);
				}

				const cuotas = cuotasSnap.docs.map((d) => d.data() as CuotaDoc);
				setCuotaEstado(calcularEstadoCuota(cuotas));
			} catch (error) {
				console.error("Error al obtener datos del alumno:", error);
			} finally {
				setIsLoadingCourse(false);
			}
		};

		fetchCourseAndCuota();
	}, [isOpen, student]);

	if (!student) return null;

	const hasCourse = !!enrolledCourse;
	const age = Math.floor(
		(new Date().getTime() - new Date(student.fechaNacimiento).getTime()) /
			(1000 * 60 * 60 * 24 * 365.25),
	);

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[700px]">
				<DialogHeader>
					<DialogTitle className="text-2xl font-bold text-[#252d62] mb-4">
						Detalles del Alumno
					</DialogTitle>
				</DialogHeader>

				{/* DATOS PERSONALES */}
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
						<p className="text-lg font-semibold text-gray-900">{age} años</p>
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

				{/* CURSO INSCRIPTO */}
				<div className="border-t pt-6">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-lg font-bold text-[#252d62]">
							Curso inscripto
						</h3>
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
										<th className="px-4 py-3 text-left font-medium text-gray-700">
											Nombre del curso
										</th>
										<th className="px-4 py-3 text-left font-medium text-gray-700">
											Estado de Cuota
										</th>
										<th className="px-4 py-3 text-left font-medium text-gray-700">
											Acción
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-200">
									{isLoadingCourse ? (
										<tr>
											<td colSpan={3} className="px-4 py-8 text-center">
												<Loader2 className="w-6 h-6 animate-spin text-[#EE1120] mx-auto" />
											</td>
										</tr>
									) : hasCourse && cuotaEstado ? (
										<tr className="hover:bg-gray-50">
											<td className="px-4 py-3 text-gray-900 font-bold">
												{enrolledCourse.nombre}
											</td>
											<td className="px-4 py-3">
												<CuotaBadge estado={cuotaEstado} />
											</td>
											<td className="px-4 py-3">
												<PagarCuotaButton estado={cuotaEstado} />
											</td>
										</tr>
									) : (
										<tr>
											<td
												colSpan={3}
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

				{/* FOOTER */}
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
