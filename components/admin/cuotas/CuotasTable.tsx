"use client";

import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import {
	Loader2,
	CheckCircle2,
	AlertCircle,
	User,
	CreditCard,
	Banknote,
	Smartphone,
	Landmark,
	HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// --- INTERFACES ---
interface CursoData {
	id: string;
	nombre: string;
	cuota: number;
	inicioMes: number;
	finMes: number;
}

interface CuotaRowData {
	idFila: string;
	alumnoId: string;
	nombreAlumno: string;
	dniAlumno: string;
	tipoAlumno: "Titular" | "Menor";
	cursoId: string;
	nombreCurso: string;
	montoCuota: number;
	estado: "Pagado" | "Pendiente";
	metodoPago: string | null; // null si aún no pagó
}

interface CuotasTableProps {
	searchTerm: string;
	selectedMonth: string;
	statusFilter: string;
	courseFilter: string;
	refreshTrigger: number;
	setIsModalCobrarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

// --- HELPER: ícono y color según método de pago ---
function MetodoPagoBadge({ metodo }: { metodo: string | null }) {
	if (!metodo) {
		return <span className="text-xs text-gray-400 italic">—</span>;
	}

	// Normalizamos a minúsculas para comparar
	const lower = metodo.toLowerCase();

	let icon = <HelpCircle className="w-3.5 h-3.5" />;
	let colorClasses = "bg-gray-100 text-gray-700";
	const label = metodo;

	if (lower.includes("efectivo")) {
		icon = <Banknote className="w-3.5 h-3.5" />;
		colorClasses = "bg-emerald-100 text-emerald-800";
	} else if (lower.includes("transferencia")) {
		icon = <Landmark className="w-3.5 h-3.5" />;
		colorClasses = "bg-blue-100 text-blue-800";
	} else if (
		lower.includes("mercado") ||
		lower.includes("mp") ||
		lower.includes("digital")
	) {
		icon = <Smartphone className="w-3.5 h-3.5" />;
		colorClasses = "bg-yellow-100 text-yellow-800";
	} else if (
		lower.includes("tarjeta") ||
		lower.includes("débito") ||
		lower.includes("crédito")
	) {
		icon = <CreditCard className="w-3.5 h-3.5" />;
		colorClasses = "bg-purple-100 text-purple-800";
	}

	return (
		<span
			className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${colorClasses}`}
		>
			{icon}
			{label}
		</span>
	);
}

// --- COMPONENTE PRINCIPAL ---
export default function CuotasTable({
	searchTerm,
	selectedMonth,
	statusFilter,
	courseFilter,
	refreshTrigger,
	setIsModalCobrarOpen,
}: CuotasTableProps) {
	const [rows, setRows] = useState<CuotaRowData[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const fetchCuotasData = async () => {
		setIsLoading(true);
		try {
			const cursosSnap = await getDocs(collection(db, "Cursos"));
			const cursosMap: Record<string, CursoData> = {};
			cursosSnap.forEach((doc) => {
				const data = doc.data();
				cursosMap[doc.id] = {
					id: doc.id,
					nombre: data.nombre || "Curso Desconocido",
					cuota: data.cuota || 0,
					inicioMes: data.inicioMes || 3,
					finMes: data.finMes || 12,
				};
			});

			const cuotasQuery = query(
				collection(db, "Cuotas"),
				where("mes", "==", selectedMonth),
			);
			const cuotasSnap = await getDocs(cuotasQuery);
			const metodoPagoMap: Record<string, string> = {};
			cuotasSnap.forEach((doc) => {
				const data = doc.data();
				if (data.alumnoId && data.curso) {
					const key = `${data.alumnoId}_${data.curso}`;
					metodoPagoMap[key] = data.metodoPago || "Desconocido";
				}
			});

			// 3. Construir filas para Titulares (Users)
			const tableRows: CuotaRowData[] = [];
			const selectedMonthNumber = parseInt(selectedMonth.split("-")[1]);

			const qUsers = query(collection(db, "Users"), where("cursos", "!=", []));
			const usersSnap = await getDocs(qUsers);

			usersSnap.forEach((doc) => {
				const data = doc.data();
				if (data.cursos && data.cursos.length > 0) {
					data.cursos.forEach((cursoId: string) => {
						const cursoInfo = cursosMap[cursoId];
						if (
							cursoInfo &&
							selectedMonthNumber >= cursoInfo.inicioMes &&
							selectedMonthNumber <= cursoInfo.finMes
						) {
							const cuotasPagadasDelCurso = data.cuotasPagadas?.[cursoId] || [];
							const estaPagado = cuotasPagadasDelCurso.includes(selectedMonth);
							const metodoPago = estaPagado
								? (metodoPagoMap[`${doc.id}_${cursoId}`] ?? null)
								: null;

							tableRows.push({
								idFila: `titular_${doc.id}_${cursoId}`,
								alumnoId: doc.id,
								nombreAlumno: `${data.nombre} ${data.apellido}`,
								dniAlumno: data.dni,
								tipoAlumno: "Titular",
								cursoId: cursoId,
								nombreCurso: cursoInfo.nombre,
								montoCuota: cursoInfo.cuota,
								estado: estaPagado ? "Pagado" : "Pendiente",
								metodoPago,
							});
						}
					});
				}
			});

			// 4. Construir filas para Menores (Hijos)
			const qHijos = query(collection(db, "Hijos"), where("cursos", "!=", []));
			const hijosSnap = await getDocs(qHijos);

			hijosSnap.forEach((doc) => {
				const data = doc.data();
				if (data.cursos && data.cursos.length > 0) {
					data.cursos.forEach((cursoId: string) => {
						const cursoInfo = cursosMap[cursoId];
						if (
							cursoInfo &&
							selectedMonthNumber >= cursoInfo.inicioMes &&
							selectedMonthNumber <= cursoInfo.finMes
						) {
							const cuotasPagadasDelCurso = data.cuotasPagadas?.[cursoId] || [];
							const estaPagado = cuotasPagadasDelCurso.includes(selectedMonth);
							const metodoPago = estaPagado
								? (metodoPagoMap[`${doc.id}_${cursoId}`] ?? null)
								: null;

							tableRows.push({
								idFila: `menor_${doc.id}_${cursoId}`,
								alumnoId: doc.id,
								nombreAlumno: `${data.nombre} ${data.apellido}`,
								dniAlumno: data.dni,
								tipoAlumno: "Menor",
								cursoId: cursoId,
								nombreCurso: cursoInfo.nombre,
								montoCuota: cursoInfo.cuota,
								estado: estaPagado ? "Pagado" : "Pendiente",
								metodoPago,
							});
						}
					});
				}
			});

			tableRows.sort((a, b) => a.nombreAlumno.localeCompare(b.nombreAlumno));
			setRows(tableRows);
		} catch (error) {
			console.error("Error cargando tabla de cuotas:", error);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchCuotasData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedMonth, refreshTrigger]);

	// --- FILTROS ---
	const filteredRows = rows.filter((row) => {
		const matchesSearch =
			searchTerm === "" ||
			row.nombreAlumno.toLowerCase().includes(searchTerm.toLowerCase()) ||
			row.dniAlumno.includes(searchTerm);

		const matchesStatus =
			statusFilter === "todos" ||
			(statusFilter === "pagados" && row.estado === "Pagado") ||
			(statusFilter === "pendientes" && row.estado === "Pendiente");

		const matchesCourse =
			courseFilter === "todos" || row.cursoId === courseFilter;

		return matchesSearch && matchesStatus && matchesCourse;
	});

	// --- ESTADOS DE CARGA Y VACÍO ---
	if (isLoading) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center p-10 text-gray-500">
				<Loader2 className="w-8 h-8 animate-spin text-[#EE1120] mb-4" />
				<p>Cargando estado de cuotas...</p>
			</div>
		);
	}

	if (filteredRows.length === 0) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center p-10 text-gray-500">
				<AlertCircle className="w-12 h-12 text-gray-300 mb-3" />
				<p className="text-lg font-medium text-gray-600">
					No hay cuotas para este mes.
				</p>
				<p className="text-sm mt-1 text-center max-w-md">
					Puede que el curso no se dicte en esta fecha, o los filtros aplicados
					no arrojaron resultados.
				</p>
			</div>
		);
	}

	// --- TABLA ---
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-left text-sm">
				<thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
					<tr>
						<th className="px-6 py-4">Alumno</th>
						<th className="px-6 py-4">Curso</th>
						<th className="px-6 py-4 text-center">Estado de Cuota</th>
						<th className="px-6 py-4">Monto</th>
						<th className="px-6 py-4">Método de Pago</th>
						<th className="px-6 py-4 text-center">Acciones</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-gray-100">
					{filteredRows.map((row) => (
						<tr
							key={row.idFila}
							className="hover:bg-gray-50 transition-colors group"
						>
							{/* Alumno */}
							<td className="px-6 py-4">
								<div className="flex items-center gap-3">
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
											row.tipoAlumno === "Titular"
												? "bg-blue-100 text-blue-700"
												: "bg-purple-100 text-purple-700"
										}`}
									>
										<User className="w-4 h-4" />
									</div>
									<div>
										<p className="font-bold text-[#252d62]">
											{row.nombreAlumno}
										</p>
										<p className="text-xs text-gray-500">
											DNI: {row.dniAlumno}
										</p>
									</div>
								</div>
							</td>

							{/* Curso */}
							<td className="px-6 py-4">
								<span className="font-medium text-gray-700">
									{row.nombreCurso}
								</span>
							</td>

							{/* Estado */}
							<td className="px-6 py-4 text-center">
								{row.estado === "Pagado" ? (
									<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold">
										<CheckCircle2 className="w-3.5 h-3.5" /> Al día
									</span>
								) : (
									<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">
										<AlertCircle className="w-3.5 h-3.5" /> Pendiente
									</span>
								)}
							</td>

							{/* Monto */}
							<td className="px-6 py-4 font-medium text-gray-700">
								${row.montoCuota.toLocaleString("es-AR")}
							</td>

							{/* ✅ NUEVA COLUMNA: Método de Pago */}
							<td className="px-6 py-4">
								<MetodoPagoBadge metodo={row.metodoPago} />
							</td>

							{/* Acciones */}
							<td className="px-6 py-4 text-center">
								{row.estado === "Pendiente" ? (
									<Button
										size="sm"
										className="bg-white border border-[#EE1120] text-[#EE1120] hover:bg-[#EE1120] hover:text-white transition-colors"
										onClick={() => setIsModalCobrarOpen(true)}
									>
										<CreditCard className="w-4 h-4 mr-2" />
										Cobrar
									</Button>
								) : (
									<span className="text-xs text-gray-400 italic">
										Sin acciones
									</span>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
