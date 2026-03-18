"use client";

import React, { useEffect, useState } from "react";
import {
	collection,
	getDocs,
	query,
	orderBy,
	Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import {
	Loader2,
	TrendingDown,
	DollarSign,
	Search,
	Filter,
	PackageOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import RegistrarEgresoModal from "@/components/admin/egresos/RegistrarEgresoModal";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface EgresoItem {
	id: string;
	descripcion: string;
	monto: number;
	fecha: Date;
	registradoPor: string;
}

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

export default function EgresosPage() {
	const [egresos, setEgresos] = useState<EgresoItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [busqueda, setBusqueda] = useState("");
	const [filtroMes, setFiltroMes] = useState<number>(0);
	const [isModalOpen, setIsModalOpen] = useState(false);

	const fetchEgresos = async () => {
		setIsLoading(true);
		try {
			const snap = await getDocs(
				query(collection(db, "Egresos"), orderBy("fecha", "desc")),
			);

			const items: EgresoItem[] = snap.docs.map((d) => {
				const data = d.data();
				const fechaRaw = data.fecha as Timestamp;
				return {
					id: d.id,
					descripcion: data.descripcion ?? "-",
					monto: data.monto ?? 0,
					fecha: fechaRaw?.toDate?.() ?? new Date(),
					registradoPor: data.registradoPor ?? "-",
				};
			});

			setEgresos(items);
		} catch (error) {
			console.error("Error al cargar egresos:", error);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchEgresos();
	}, []);

	// ── Filtros ────────────────────────────────────────────────────────────────
	const egresosFiltrados = egresos.filter((item) => {
		const matchBusqueda =
			busqueda === "" ||
			item.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
			item.registradoPor.toLowerCase().includes(busqueda.toLowerCase());

		const matchMes = filtroMes === 0 || item.fecha.getMonth() + 1 === filtroMes;

		return matchBusqueda && matchMes;
	});

	// ── Métricas ───────────────────────────────────────────────────────────────
	const totalEgresos = egresos.reduce((sum, i) => sum + i.monto, 0);
	const totalFiltrado = egresosFiltrados.reduce((sum, i) => sum + i.monto, 0);

	const egresosMesActual = egresos.filter(
		(i) =>
			i.fecha.getMonth() + 1 === new Date().getMonth() + 1 &&
			i.fecha.getFullYear() === new Date().getFullYear(),
	);
	const totalMesActual = egresosMesActual.reduce((sum, i) => sum + i.monto, 0);

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
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				className="flex items-center justify-between gap-3"
			>
				<div className="flex items-center gap-3">
					<div className="bg-[#EE1120] p-2.5 rounded-lg">
						<TrendingDown className="w-5 h-5 text-white" />
					</div>
					<div>
						<h1 className="text-2xl font-bold text-[#252d62]">Egresos</h1>
						<p className="text-sm text-gray-500">
							Historial de gastos y salidas de dinero del instituto
						</p>
					</div>
				</div>

				<Button
					onClick={() => setIsModalOpen(true)}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold py-5 px-6 rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
				>
					<DollarSign className="w-5 h-5" />
					Registrar nuevo egreso
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
							Total egresos
						</p>
						<div className="bg-red-50 p-2 rounded-lg">
							<TrendingDown className="w-4 h-4 text-red-500" />
						</div>
					</div>
					<p className="text-2xl font-bold text-red-600">
						{formatMonto(totalEgresos)}
					</p>
					<p className="text-xs text-gray-400 mt-1">
						{egresos.length} egreso{egresos.length !== 1 ? "s" : ""} registrado
						{egresos.length !== 1 ? "s" : ""}
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
							Este mes
						</p>
						<div className="bg-orange-50 p-2 rounded-lg">
							<DollarSign className="w-4 h-4 text-orange-500" />
						</div>
					</div>
					<p className="text-2xl font-bold text-gray-900">
						{formatMonto(totalMesActual)}
					</p>
					<p className="text-xs text-gray-400 mt-1">
						{MESES[new Date().getMonth()]} {new Date().getFullYear()}
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
							Promedio por egreso
						</p>
						<div className="bg-gray-100 p-2 rounded-lg">
							<PackageOpen className="w-4 h-4 text-gray-500" />
						</div>
					</div>
					<p className="text-2xl font-bold text-gray-900">
						{egresos.length > 0
							? formatMonto(Math.round(totalEgresos / egresos.length))
							: formatMonto(0)}
					</p>
					<p className="text-xs text-gray-400 mt-1">Por operación registrada</p>
				</motion.div>
			</div>

			{/* Filtros */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.2 }}
				className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3"
			>
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
					<input
						type="text"
						placeholder="Buscar por descripción o registrado por..."
						value={busqueda}
						onChange={(e) => setBusqueda(e.target.value)}
						className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62]"
					/>
				</div>

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
				<div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
					<p className="text-sm text-gray-500">
						{egresosFiltrados.length} resultado
						{egresosFiltrados.length !== 1 ? "s" : ""}
					</p>
					<p className="text-sm font-bold text-red-600">
						Subtotal: {formatMonto(totalFiltrado)}
					</p>
				</div>

				{egresosFiltrados.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 text-center">
						<div className="bg-gray-100 p-4 rounded-full mb-4">
							<PackageOpen className="w-8 h-8 text-gray-400" />
						</div>
						<p className="text-gray-500 font-medium">
							{egresos.length === 0
								? "Aún no hay egresos registrados"
								: "No hay egresos para mostrar"}
						</p>
						<p className="text-gray-400 text-sm mt-1">
							{egresos.length === 0
								? "Usá el botón de arriba para registrar el primero"
								: "Probá cambiando los filtros"}
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-gray-100">
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Descripción
									</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Período
									</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Fecha
									</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Registrado por
									</th>
									<th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Monto
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{egresosFiltrados.map((item, index) => (
									<motion.tr
										key={item.id}
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										transition={{ delay: index * 0.02 }}
										className="hover:bg-gray-50 transition-colors"
									>
										<td className="px-6 py-4">
											<p className="font-medium text-gray-900">
												{item.descripcion}
											</p>
										</td>
										<td className="px-6 py-4 text-gray-600">
											{MESES[item.fecha.getMonth()]} {item.fecha.getFullYear()}
										</td>
										<td className="px-6 py-4 text-gray-600">
											{formatFecha(item.fecha)}
										</td>
										<td className="px-6 py-4 text-gray-600">
											{item.registradoPor}
										</td>
										<td className="px-6 py-4 text-right font-bold text-red-600">
											{formatMonto(item.monto)}
										</td>
									</motion.tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</motion.div>

			{/* Modal — conectar cuando esté listo */}
			<RegistrarEgresoModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onSuccess={() => {
					setIsModalOpen(false);
					fetchEgresos();
				}}
			/>
		</div>
	);
}
