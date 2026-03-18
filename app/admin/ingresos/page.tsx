"use client";

import React, { useEffect, useState } from "react";
import {
	collection,
	getDocs,
	query,
	orderBy,
	Timestamp,
	where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import {
	Loader2,
	TrendingUp,
	Receipt,
	GraduationCap,
	DollarSign,
	Search,
	Filter,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import RegistrarIngresoModal from "@/components/admin/ingresos/RegistrarIngresoModal";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface IngresoItem {
	id: string;
	tipo: "cuota" | "inscripcion";
	alumnoNombre: string;
	alumnoDni: string;
	cursoNombre: string;
	monto: number;
	fecha: Date;
	metodoPago: string;
	mes?: number;
	anio?: number;
}

type FiltroTipo = "todos" | "cuotas" | "inscripciones";

// ─── Constantes ───────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFecha(fecha: Date): string {
	return fecha.toLocaleDateString("es-AR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

function formatMonto(monto: number): string {
	return monto.toLocaleString("es-AR", {
		style: "currency",
		currency: "ARS",
		minimumFractionDigits: 0,
	});
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function IngresosPage() {
	const [ingresos, setIngresos] = useState<IngresoItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
	const [busqueda, setBusqueda] = useState("");
	const [filtroMes, setFiltroMes] = useState<number>(0);
	const [isModalOpen, setIsModalOpen] = useState(false);

	const fetchIngresos = async () => {
		setIsLoading(true);
		try {
			// ── Cuotas pagadas ─────────────────────────────────────────────
			const cuotasSnap = await getDocs(
				query(
					collection(db, "Cuotas"),
					where("estado", "==", "Pagado"),
					orderBy("actualizadoEn", "desc"),
				),
			);

			const cuotas: IngresoItem[] = cuotasSnap.docs.map((d) => {
				const data = d.data();
				const fechaRaw = data.actualizadoEn as Timestamp;
				return {
					id: d.id,
					tipo: "cuota",
					alumnoNombre: data.alumnoNombre,
					alumnoDni: data.alumnoDni,
					cursoNombre: data.cursoNombre,
					monto: data.montoPagado ?? 0,
					fecha: fechaRaw?.toDate?.() ?? new Date(),
					metodoPago: data.metodoPago ?? "-",
					mes: data.mes,
					anio: data.anio,
				};
			});

			// ── Inscripciones confirmadas ──────────────────────────────────
			const inscripcionesSnap = await getDocs(
				query(
					collection(db, "Inscripciones"),
					where("status", "==", "Confirmado"),
				),
			);

			const inscripciones: IngresoItem[] = inscripcionesSnap.docs.map((d) => {
				const data = d.data();
				const fechaRaw = data.fecha as Timestamp;
				return {
					id: d.id,
					tipo: "inscripcion",
					alumnoNombre: data.alumnoNombre,
					alumnoDni: data.alumnoDni,
					cursoNombre: data.cursoNombre,
					monto: data.cursoInscripcion ?? 0,
					fecha: fechaRaw?.toDate?.() ?? new Date(),
					metodoPago: data.metodoPago ?? "-",
				};
			});

			// Unir y ordenar por fecha desc
			const todos = [...cuotas, ...inscripciones].sort(
				(a, b) => b.fecha.getTime() - a.fecha.getTime(),
			);

			setIngresos(todos);
		} catch (error) {
			console.error("Error al cargar ingresos:", error);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchIngresos();
	}, []);

	// ── Filtros ────────────────────────────────────────────────────────────────
	const ingresosFiltrados = ingresos.filter((item) => {
		const matchTipo =
			filtroTipo === "todos" ||
			(filtroTipo === "cuotas" && item.tipo === "cuota") ||
			(filtroTipo === "inscripciones" && item.tipo === "inscripcion");

		const matchBusqueda =
			busqueda === "" ||
			item.alumnoNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
			item.alumnoDni.includes(busqueda) ||
			item.cursoNombre.toLowerCase().includes(busqueda.toLowerCase());

		const matchMes =
			filtroMes === 0 ||
			(item.tipo === "cuota" && item.mes === filtroMes) ||
			(item.tipo === "inscripcion" && item.fecha.getMonth() + 1 === filtroMes);

		return matchTipo && matchBusqueda && matchMes;
	});

	// ── Métricas ───────────────────────────────────────────────────────────────
	const totalIngresos = ingresosFiltrados.reduce((sum, i) => sum + i.monto, 0);
	const totalCuotas = ingresos
		.filter((i) => i.tipo === "cuota")
		.reduce((s, i) => s + i.monto, 0);
	const totalInscripciones = ingresos
		.filter((i) => i.tipo === "inscripcion")
		.reduce((s, i) => s + i.monto, 0);
	const countCuotas = ingresos.filter((i) => i.tipo === "cuota").length;
	const countInscripciones = ingresos.filter(
		(i) => i.tipo === "inscripcion",
	).length;

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-96">
				<Loader2 className="w-10 h-10 animate-spin text-[#252d62]" />
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			{/* Header */}
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				className="flex items-center justify-between gap-3"
			>
				<div className="flex items-center gap-3">
					<div className="bg-[#252d62] p-2.5 rounded-lg">
						<TrendingUp className="w-5 h-5 text-white" />
					</div>
					<div>
						<h1 className="text-2xl font-bold text-[#252d62]">Ingresos</h1>
						<p className="text-sm text-gray-500">
							Historial de cuotas e inscripciones cobradas
						</p>
					</div>
				</div>

				<Button
					onClick={() => setIsModalOpen(true)}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold py-5 px-6 rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
				>
					<DollarSign className="w-5 h-5" />
					Registrar nuevo ingreso
				</Button>
			</motion.div>

			{/* Cards de resumen */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.05 }}
					className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
				>
					<div className="flex items-center justify-between mb-3">
						<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
							Total recaudado
						</p>
						<div className="bg-[#252d62]/10 p-2 rounded-lg">
							<DollarSign className="w-4 h-4 text-[#252d62]" />
						</div>
					</div>
					<p className="text-2xl font-bold text-[#252d62]">
						{formatMonto(totalCuotas + totalInscripciones)}
					</p>
					<p className="text-xs text-gray-400 mt-1">
						{countCuotas + countInscripciones} pagos registrados
					</p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
				>
					<div className="flex items-center justify-between mb-3">
						<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
							Por cuotas
						</p>
						<div className="bg-blue-50 p-2 rounded-lg">
							<Receipt className="w-4 h-4 text-blue-600" />
						</div>
					</div>
					<p className="text-2xl font-bold text-gray-900">
						{formatMonto(totalCuotas)}
					</p>
					<p className="text-xs text-gray-400 mt-1">
						{countCuotas} cuotas cobradas
					</p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.15 }}
					className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
				>
					<div className="flex items-center justify-between mb-3">
						<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
							Por inscripciones
						</p>
						<div className="bg-green-50 p-2 rounded-lg">
							<GraduationCap className="w-4 h-4 text-green-600" />
						</div>
					</div>
					<p className="text-2xl font-bold text-gray-900">
						{formatMonto(totalInscripciones)}
					</p>
					<p className="text-xs text-gray-400 mt-1">
						{countInscripciones} inscripciones confirmadas
					</p>
				</motion.div>
			</div>

			{/* Filtros */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.2 }}
				className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3"
			>
				{/* Búsqueda */}
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
					<input
						type="text"
						placeholder="Buscar por alumno, DNI o curso..."
						value={busqueda}
						onChange={(e) => setBusqueda(e.target.value)}
						className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62]"
					/>
				</div>

				{/* Filtro tipo */}
				<div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
					{(["todos", "cuotas", "inscripciones"] as FiltroTipo[]).map((f) => (
						<button
							key={f}
							onClick={() => setFiltroTipo(f)}
							className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${
								filtroTipo === f
									? "bg-[#252d62] text-white shadow-sm"
									: "text-gray-500 hover:text-gray-800"
							}`}
						>
							{f}
						</button>
					))}
				</div>

				{/* Filtro mes */}
				<div className="flex items-center gap-2">
					<Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
					<select
						value={filtroMes}
						onChange={(e) => setFiltroMes(Number(e.target.value))}
						className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-white"
					>
						<option value={0}>Todos los meses</option>
						{MESES.map((mes, i) => (
							<option key={i} value={i + 1}>
								{mes}
							</option>
						))}
					</select>
				</div>
			</motion.div>

			{/* Tabla */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.25 }}
				className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
			>
				{/* Subtotal filtrado */}
				<div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
					<p className="text-sm text-gray-500">
						{ingresosFiltrados.length} resultado
						{ingresosFiltrados.length !== 1 ? "s" : ""}
					</p>
					<p className="text-sm font-bold text-[#252d62]">
						Subtotal: {formatMonto(totalIngresos)}
					</p>
				</div>

				{ingresosFiltrados.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 text-center">
						<div className="bg-gray-100 p-4 rounded-full mb-4">
							<TrendingUp className="w-8 h-8 text-gray-400" />
						</div>
						<p className="text-gray-500 font-medium">
							No hay ingresos para mostrar
						</p>
						<p className="text-gray-400 text-sm mt-1">
							Probá cambiando los filtros
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-gray-100">
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Tipo
									</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Alumno
									</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Curso
									</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Período
									</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Método
									</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Fecha
									</th>
									<th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Monto
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{ingresosFiltrados.map((item, index) => (
									<motion.tr
										key={item.id}
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										transition={{ delay: index * 0.02 }}
										className="hover:bg-gray-50 transition-colors"
									>
										<td className="px-6 py-4">
											{item.tipo === "cuota" ? (
												<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
													<Receipt className="w-3 h-3" />
													Cuota
												</span>
											) : (
												<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">
													<GraduationCap className="w-3 h-3" />
													Inscripción
												</span>
											)}
										</td>
										<td className="px-6 py-4">
											<p className="font-medium text-gray-900">
												{item.alumnoNombre}
											</p>
											<p className="text-xs text-gray-400">
												DNI: {item.alumnoDni}
											</p>
										</td>
										<td className="px-6 py-4 text-gray-700">
											{item.cursoNombre}
										</td>
										<td className="px-6 py-4 text-gray-600">
											{item.tipo === "cuota" && item.mes && item.anio
												? `${MESES[item.mes - 1]} ${item.anio}`
												: `${MESES[item.fecha.getMonth()]} ${item.fecha.getFullYear()}`}
										</td>
										<td className="px-6 py-4 text-gray-600">
											{item.metodoPago}
										</td>
										<td className="px-6 py-4 text-gray-600">
											{formatFecha(item.fecha)}
										</td>
										<td className="px-6 py-4 text-right font-bold text-[#252d62]">
											{formatMonto(item.monto)}
										</td>
									</motion.tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</motion.div>

			<RegistrarIngresoModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onSuccess={() => {
					setIsModalOpen(false);
					fetchIngresos();
				}}
			/>
		</div>
	);
}
