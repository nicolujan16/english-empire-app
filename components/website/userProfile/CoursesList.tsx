"use client";

import React, { useEffect, useState } from "react";
import { Plus, BookOpen, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "../../ui/button";
import {
	doc,
	getDoc,
	collection,
	query,
	where,
	getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { StudentDetails } from "@/types";

interface CourseDetails {
	id: string;
	nombre: string;
	inicioMes: number;
	finMes: number;
}

type CuotaEstadoBadge =
	| { tipo: "al-dia" }
	| { tipo: "pendiente"; mes: number }
	| { tipo: "atraso"; desdeMes: number };

interface CourseRow {
	courseId: string;
	courseData: CourseDetails;
	ownerName: string;
	cuotaEstado: CuotaEstadoBadge;
}

interface CoursesListProps {
	cursos: string[] | null;
	cuotasPagadas?: Record<string, string[]>;
	hijos?: StudentDetails[];
	parentId: string;
}

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
	const ahora = new Date();
	const mesActual = ahora.getMonth() + 1;

	const pendientes = cuotas.filter((c) => c.estado === "Pendiente");

	const atrasadas = pendientes.filter((c) => c.mes < mesActual);
	if (atrasadas.length > 0) {
		const mesMasAntiguo = Math.min(...atrasadas.map((c) => c.mes));
		return { tipo: "atraso", desdeMes: mesMasAntiguo };
	}

	const pendienteActual = pendientes.find((c) => c.mes === mesActual);
	if (pendienteActual) {
		return { tipo: "pendiente", mes: mesActual };
	}

	return { tipo: "al-dia" };
}

async function fetchCuotasEstado(
	alumnoId: string,
	cursoId: string,
): Promise<CuotaEstadoBadge> {
	const anioActual = new Date().getFullYear();

	const q = query(
		collection(db, "Cuotas"),
		where("alumnoId", "==", alumnoId),
		where("cursoId", "==", cursoId),
		where("anio", "==", anioActual),
	);

	const snapshot = await getDocs(q);
	const cuotas = snapshot.docs.map((d) => d.data() as CuotaDoc);
	return calcularEstadoCuota(cuotas);
}

function CuotaBadge({
	estado,
	showPrefix = false,
}: {
	estado: CuotaEstadoBadge;
	showPrefix?: boolean;
}) {
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
				{showPrefix ? "Cuota pendiente" : "Pendiente"} {MESES[estado.mes - 1]}
			</span>
		);
	}
	return (
		<span className="py-1 px-3 rounded-full text-sm font-bold bg-red-100 text-red-800">
			{showPrefix ? "Cuota atrasada desde" : "Atraso desde"}{" "}
			{MESES[estado.desdeMes - 1]}
		</span>
	);
}

function PagarCuotaButton({ estado }: { estado: CuotaEstadoBadge }) {
	if (estado.tipo === "al-dia") {
		return (
			<span className="text-xs text-gray-400 italic">
				Sin acciones disponibles
			</span>
		);
	}

	const label =
		estado.tipo === "atraso" ? "Pagar cuotas atrasadas" : "Pagar cuota";

	return (
		<Link href="/mi-cuenta/pagos">
			<Button
				size="lg"
				className="bg-white border border-[#EE1120] text-[#EE1120] hover:bg-[#EE1120] hover:text-white transition-colors p-2 w-full sm:w-auto"
			>
				{label}
			</Button>
		</Link>
	);
}

function CoursesList({ cursos, hijos, parentId }: CoursesListProps) {
	const [rows, setRows] = useState<CourseRow[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		const fetchAll = async () => {
			setIsLoading(true);

			const toFetch: {
				alumnoId: string;
				courseId: string;
				ownerName: string;
			}[] = [];

			if (cursos && cursos.length > 0) {
				toFetch.push({
					alumnoId: parentId,
					courseId: cursos[0],
					ownerName: "Vos",
				});
			}

			hijos?.forEach((hijo) => {
				hijo.cursos?.forEach((courseId: string) => {
					toFetch.push({
						alumnoId: String(hijo.id),
						courseId,
						ownerName: `${hijo.nombre} ${hijo.apellido}`,
					});
				});
			});

			if (toFetch.length === 0) {
				setRows([]);
				setIsLoading(false);
				return;
			}

			try {
				const results = await Promise.all(
					toFetch.map(async ({ alumnoId, courseId, ownerName }) => {
						const [docSnap, cuotaEstado] = await Promise.all([
							getDoc(doc(db, "Cursos", courseId)),
							fetchCuotasEstado(alumnoId, courseId),
						]);

						if (!docSnap.exists()) return null;

						return {
							courseId,
							courseData: {
								id: docSnap.id,
								...docSnap.data(),
							} as CourseDetails,
							ownerName,
							cuotaEstado,
						} as CourseRow;
					}),
				);

				setRows(results.filter(Boolean) as CourseRow[]);
			} catch (error) {
				console.error("Error al cargar los cursos:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchAll();
	}, [cursos, hijos, parentId]);

	const hasAnyCourses =
		(cursos && cursos.length > 0) ||
		hijos?.some((h) => h.cursos && h.cursos.length > 0);

	return (
		<div className="bg-white rounded-xl shadow-md p-6 md:p-8 border border-gray-100 h-full">
			{/* HEADER */}
			<div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
				<h2 className="text-xl md:text-2xl font-bold text-[#252d62]">
					Mis Cursos
				</h2>
				<Button
					asChild
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white flex items-center gap-2 transition-all w-full sm:w-auto"
				>
					<Link href="/cursos">
						<Plus className="w-4 h-4" />
						Inscribirse a nuevo curso
					</Link>
				</Button>
			</div>

			{hasAnyCourses ? (
				<>
					{isLoading ? (
						<div className="flex justify-center items-center py-8">
							<Loader2 className="w-8 h-8 animate-spin text-[#252d62]" />
						</div>
					) : rows.length > 0 ? (
						<>
							{/* MOBILE: Tarjetas */}
							<div className="flex flex-col gap-3 md:hidden">
								{rows.map((row) => (
									<div
										key={`${row.courseId}-${row.ownerName}`}
										className="border border-gray-200 rounded-lg p-4"
									>
										<div className="flex items-start justify-between gap-2 mb-3">
											<p className="font-semibold text-gray-900 text-base">
												{row.courseData.nombre}
											</p>
											<span
												className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
													row.ownerName === "Vos"
														? "bg-purple-100 text-purple-700"
														: "bg-orange-100 text-orange-700"
												}`}
											>
												{row.ownerName}
											</span>
										</div>
										<div className="flex flex-col gap-2">
											<CuotaBadge estado={row.cuotaEstado} showPrefix />{" "}
											{/* 👈 */}
											<PagarCuotaButton estado={row.cuotaEstado} />
										</div>
									</div>
								))}
							</div>

							{/* DESKTOP: Tabla */}
							<div className="hidden md:block overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-b-2 border-gray-200">
											<th className="text-left py-4 px-4 font-semibold text-gray-700">
												Curso
											</th>
											<th className="text-left py-4 px-4 font-semibold text-gray-700">
												Alumno
											</th>
											<th className="text-left py-4 px-4 font-semibold text-gray-700">
												Estado de Cuota
											</th>
											<th className="text-left py-4 px-4 font-semibold text-gray-700">
												Acción
											</th>
										</tr>
									</thead>
									<tbody>
										{rows.map((row) => (
											<tr
												key={`${row.courseId}-${row.ownerName}`}
												className="border-b border-gray-100 hover:bg-blue-50 transition-colors"
											>
												<td className="py-4 px-4 text-gray-900">
													{row.courseData.nombre}
												</td>
												<td className="py-4 px-4">
													<span
														className={`text-sm font-medium px-2 py-1 rounded-full ${
															row.ownerName === "Vos"
																? "bg-purple-100 text-purple-700"
																: "bg-orange-100 text-orange-700"
														}`}
													>
														{row.ownerName}
													</span>
												</td>
												<td className="py-4 px-4">
													<CuotaBadge estado={row.cuotaEstado} />
												</td>
												<td className="py-4 px-4">
													<PagarCuotaButton estado={row.cuotaEstado} />
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</>
					) : (
						<p className="text-center text-gray-500 py-4">
							No se pudo cargar la información de los cursos.
						</p>
					)}
				</>
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
