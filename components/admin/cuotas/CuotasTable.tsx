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
	Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

interface CuotaDoc {
	id: string;
	alumnoId: string;
	alumnoTipo: "adulto" | "menor";
	alumnoNombre: string;
	alumnoDni: string;
	cursoId: string;
	cursoNombre: string;
	mes: number;
	anio: number;
	cuota1a10: number;
	cuota11enAdelante: number;
	esPrimerMes: boolean;
	montoPrimerMes: number | null;
	estado: "Pendiente" | "Pagado" | "Eximido";
	montoPagado: number | null;
	metodoPago: string | null;
}

// ── Misma firma que antes, sin cambios ───────────────────────────────────────
interface CuotasTableProps {
	searchTerm: string;
	selectedMonth: string; // Formato "YYYY-MM", ej: "2026-04"
	statusFilter: string;
	courseFilter: string;
	refreshTrigger: number;
	setIsModalCobrarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

function resolverMontoCuota(cuota: CuotaDoc): number {
	if (cuota.estado === "Pagado" && cuota.montoPagado !== null) {
		return cuota.montoPagado;
	}
	if (cuota.esPrimerMes && cuota.montoPrimerMes !== null) {
		return cuota.montoPrimerMes;
	}
	const diaHoy = new Date().getDate();
	return diaHoy <= 10 ? cuota.cuota1a10 : cuota.cuota11enAdelante;
}

function MetodoPagoBadge({ metodo }: { metodo: string | null }) {
	if (!metodo) return <span className="text-xs text-gray-400 italic">—</span>;

	const lower = metodo.toLowerCase();
	let icon = <HelpCircle className="w-3.5 h-3.5" />;
	let colorClasses = "bg-gray-100 text-gray-700";

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
			{metodo}
		</span>
	);
}

function EstadoBadge({ estado }: { estado: CuotaDoc["estado"] }) {
	if (estado === "Pagado") {
		return (
			<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold">
				<CheckCircle2 className="w-3.5 h-3.5" /> Al día
			</span>
		);
	}
	if (estado === "Eximido") {
		return (
			<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
				<Tag className="w-3.5 h-3.5" /> Eximido
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">
			<AlertCircle className="w-3.5 h-3.5" /> Pendiente
		</span>
	);
}

export default function CuotasTable({
	searchTerm,
	selectedMonth,
	statusFilter,
	courseFilter,
	refreshTrigger,
	setIsModalCobrarOpen,
}: CuotasTableProps) {
	const [cuotas, setCuotas] = useState<CuotaDoc[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchCuotas = async () => {
			setIsLoading(true);
			try {
				// Parseamos "YYYY-MM" → mes y anio para la query
				const [anioStr, mesStr] = selectedMonth.split("-");
				const anio = parseInt(anioStr);
				const mes = parseInt(mesStr);

				// Una sola query — los datos están denormalizados en cada cuota
				const q = query(
					collection(db, "Cuotas"),
					where("mes", "==", mes),
					where("anio", "==", anio),
				);
				const snap = await getDocs(q);

				const fetchedCuotas: CuotaDoc[] = snap.docs.map((docSnap) => {
					const data = docSnap.data();
					return {
						id: docSnap.id,
						alumnoId: data.alumnoId,
						alumnoTipo: data.alumnoTipo,
						alumnoNombre: data.alumnoNombre,
						alumnoDni: data.alumnoDni,
						cursoId: data.cursoId,
						cursoNombre: data.cursoNombre,
						mes: data.mes,
						anio: data.anio,
						cuota1a10: data.cuota1a10 ?? 0,
						cuota11enAdelante: data.cuota11enAdelante ?? 0,
						esPrimerMes: data.esPrimerMes ?? false,
						montoPrimerMes: data.montoPrimerMes ?? null,
						estado: data.estado ?? "Pendiente",
						montoPagado: data.montoPagado ?? null,
						metodoPago: data.metodoPago ?? null,
					};
				});

				fetchedCuotas.sort((a, b) =>
					a.alumnoNombre.localeCompare(b.alumnoNombre),
				);
				setCuotas(fetchedCuotas);
			} catch (error) {
				console.error("Error cargando tabla de cuotas:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchCuotas();
	}, [selectedMonth, refreshTrigger]);

	// ── Filtros del lado del cliente ──────────────────────────────────────────
	const filteredCuotas = cuotas.filter((cuota) => {
		const matchesSearch =
			searchTerm === "" ||
			cuota.alumnoNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
			cuota.alumnoDni.includes(searchTerm);

		const matchesStatus =
			statusFilter === "todos" ||
			(statusFilter === "pagados" && cuota.estado === "Pagado") ||
			(statusFilter === "pendientes" && cuota.estado === "Pendiente") ||
			(statusFilter === "eximidos" && cuota.estado === "Eximido");

		const matchesCourse =
			courseFilter === "todos" || cuota.cursoId === courseFilter;

		return matchesSearch && matchesStatus && matchesCourse;
	});

	// ── Estados de carga y vacío ──────────────────────────────────────────────
	if (isLoading) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center p-10 text-gray-500">
				<Loader2 className="w-8 h-8 animate-spin text-[#EE1120] mb-4" />
				<p>Cargando estado de cuotas...</p>
			</div>
		);
	}

	if (filteredCuotas.length === 0) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center p-10 text-gray-500">
				<AlertCircle className="w-12 h-12 text-gray-300 mb-3" />
				<p className="text-lg font-medium text-gray-600">
					No hay cuotas para este mes.
				</p>
				<p className="text-sm mt-1 text-center max-w-md">
					{cuotas.length === 0
						? "No se generaron cuotas para este mes aún."
						: "Los filtros aplicados no arrojaron resultados."}
				</p>
			</div>
		);
	}

	// ── Tabla ─────────────────────────────────────────────────────────────────
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
					{filteredCuotas.map((cuota) => (
						<tr
							key={cuota.id}
							className="hover:bg-gray-50 transition-colors group"
						>
							{/* Alumno */}
							<td className="px-6 py-4">
								<div className="flex items-center gap-3">
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
											cuota.alumnoTipo === "adulto"
												? "bg-blue-100 text-blue-700"
												: "bg-purple-100 text-purple-700"
										}`}
									>
										<User className="w-4 h-4" />
									</div>
									<div>
										<p className="font-bold text-[#252d62]">
											{cuota.alumnoNombre}
										</p>
										<p className="text-xs text-gray-500">
											DNI: {cuota.alumnoDni}
										</p>
									</div>
								</div>
							</td>

							{/* Curso */}
							<td className="px-6 py-4">
								<div className="flex items-center gap-2">
									<span className="font-medium text-gray-700">
										{cuota.cursoNombre}
									</span>
									{cuota.esPrimerMes && (
										<span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
											1er mes
										</span>
									)}
								</div>
							</td>

							{/* Estado */}
							<td className="px-6 py-4 text-center">
								<EstadoBadge estado={cuota.estado} />
							</td>

							{/* Monto */}
							<td className="px-6 py-4">
								<div>
									<span className="font-semibold text-gray-800">
										${resolverMontoCuota(cuota).toLocaleString("es-AR")}
									</span>
									{/* Para cuotas regulares pendientes mostramos el rango */}
									{cuota.estado === "Pendiente" && !cuota.esPrimerMes && (
										<p className="text-[11px] text-gray-400 mt-0.5">
											1-10: ${cuota.cuota1a10.toLocaleString("es-AR")} · 11+: $
											{cuota.cuota11enAdelante.toLocaleString("es-AR")}
										</p>
									)}
								</div>
							</td>

							{/* Método de Pago */}
							<td className="px-6 py-4">
								<MetodoPagoBadge metodo={cuota.metodoPago} />
							</td>

							<td className="px-6 py-4 text-center">
								{cuota.estado === "Pendiente" ? (
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
