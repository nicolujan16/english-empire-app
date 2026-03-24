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
	Printer,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import RegistrarEgresoModal from "@/components/admin/egresos/RegistrarEgresoModal";
import { useAdminAuth } from "@/context/AdminAuthContext";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface EgresoItem {
	id: string;
	descripcion: string;
	monto: number;
	fecha: Date;
	registradoPor: string;
	metodoPago?: string;
}

type FiltroMetodo =
	| "Todos"
	| "Efectivo"
	| "Transferencia"
	| "Tarjeta"
	| "Mixto";

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

const PAGE_SIZE = 15;

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

function matchMetodoPago(metodoPago: string, filtro: FiltroMetodo): boolean {
	if (filtro === "Todos") return true;
	const m = metodoPago?.toLowerCase();
	const esMultiple = m.includes("+");
	if (filtro === "Mixto") return esMultiple;
	if (filtro === "Efectivo") return m.includes("efectivo");
	if (filtro === "Transferencia") return m.includes("transferencia");
	if (filtro === "Tarjeta") return m.includes("tarjeta");
	return false;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EgresosPage() {
	const { adminData } = useAdminAuth();
	const isAdmin = adminData?.rol === "admin";

	const [egresos, setEgresos] = useState<EgresoItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [busqueda, setBusqueda] = useState("");
	const [filtroMes, setFiltroMes] = useState<number>(0);
	const [filtroMetodo, setFiltroMetodo] = useState<FiltroMetodo>("Todos");

	const [isModalOpen, setIsModalOpen] = useState(false);

	const [currentPage, setCurrentPage] = useState(1);

	useEffect(() => {
		setCurrentPage(1);
	}, [busqueda, filtroMes, filtroMetodo]);

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
					metodoPago: data.metodoPago ?? "-",
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
		const matchMetodo = matchMetodoPago(item.metodoPago || "", filtroMetodo);

		return matchBusqueda && matchMes && matchMetodo;
	});

	const totalPages = Math.ceil(egresosFiltrados.length / PAGE_SIZE);
	const paginatedEgresos = egresosFiltrados.slice(
		(currentPage - 1) * PAGE_SIZE,
		currentPage * PAGE_SIZE,
	);

	// ── Métricas (Usan el array completo filtrado, no el paginado) ──────────────
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

	const handlePrint = () => {
		const filtrosActivos = [
			filtroMetodo !== "Todos"
				? {
						Efectivo: "Efectivo",
						Transferencia: "Transferencia",
						Tarjeta: "Tarjeta",
						Mixto: "Mixto",
					}[filtroMetodo]
				: null,
			filtroMes !== 0 ? MESES[filtroMes - 1] : null,
		].filter(Boolean);

		const filtrosTexto =
			filtrosActivos.length > 0 ? filtrosActivos.join(" · ") : "Ninguno";

		const filas = egresosFiltrados
			.map(
				(item) => `
    <tr>
      <td>${item.descripcion}</td>
      <td>${MESES[item.fecha.getMonth()]} ${item.fecha.getFullYear()}</td>
      <td>${formatFecha(item.fecha)}</td>
      <td>${item.registradoPor}</td>
      <td>${item.metodoPago}</td>
      <td style="text-align:right">${formatMonto(item.monto)}</td>
    </tr>
  `,
			)
			.join("");

		const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Egresos - English Empire</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
        h1 { font-size: 18px; color: #252d62; margin-bottom: 4px; }
        p.subtitulo { font-size: 11px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background-color: #EE1120; color: white; }
        thead th { padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
        tbody tr:nth-child(even) { background-color: #f5f5f5; }
        tbody td { padding: 7px 10px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
        tfoot tr { background-color: #f0f0f0; font-weight: bold; }
        tfoot td { padding: 8px 10px; border-top: 2px solid #EE1120; }
      </style>
    </head>
    <body>
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
        <div>
          <h1>Egresos — English Empire Institute</h1>
          <p class="subtitulo">
            Generado el ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
            · ${egresosFiltrados.length} resultado${egresosFiltrados.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style="text-align:right; font-size:11px; color:#444;">
          <span style="font-weight:bold; color:#EE1120;">Filtros aplicados</span><br/>
          ${filtrosTexto}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Descripción</th>
            <th>Período</th>
            <th>Fecha</th>
            <th>Registrado por</th>
            <th>Método</th>
            <th style="text-align:right">Monto</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
        <tfoot>
          <tr>
            <td colspan="5">Total</td>
            <td style="text-align:right">${formatMonto(totalFiltrado)}</td>
          </tr>
        </tfoot>
      </table>
    </body>
    </html>
  `;

		const ventana = window.open("", "_blank");
		if (!ventana) return;
		ventana.document.write(html);
		ventana.document.close();
		ventana.focus();
		setTimeout(() => ventana.print(), 400);
	};

	return (
		<div className="p-6 space-y-6 flex flex-col h-full">
			{/* Header */}
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				className="flex items-center justify-between gap-3 shrink-0"
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

				<div className="flex items-center gap-3">
					<Button
						onClick={handlePrint}
						disabled={egresosFiltrados.length === 0}
						variant="outline"
						className="border-[#252d62] text-[#252d62] hover:bg-[#252d62]/5 font-bold py-5 px-5 rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
					>
						<Printer className="w-5 h-5" />
						Imprimir
					</Button>

					<Button
						onClick={() => setIsModalOpen(true)}
						className="bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold py-5 px-6 rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
					>
						<DollarSign className="w-5 h-5" />
						Registrar nuevo egreso
					</Button>
				</div>
			</motion.div>

			{/* Cards de resumen */}
			{isAdmin && (
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
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
							{egresos.length} egreso{egresos.length !== 1 ? "s" : ""}{" "}
							registrado
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
						<p className="text-xs text-gray-400 mt-1">
							Por operación registrada
						</p>
					</motion.div>
				</div>
			)}

			{/* Filtros */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.2 }}
				className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3 shrink-0"
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
						value={filtroMetodo}
						onChange={(e) => setFiltroMetodo(e.target.value as FiltroMetodo)}
						className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-white"
					>
						<option value="Todos">Todos los métodos</option>
						<option value="Efectivo">Efectivo</option>
						<option value="Transferencia">Transferencia</option>
						<option value="Tarjeta">Tarjeta</option>
						<option value="Mixto">Mixto</option>
					</select>
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

			{/* Tabla con Paginación */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.25 }}
				className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col flex-1 overflow-hidden"
			>
				<div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
					<p className="text-sm text-gray-500">
						{egresosFiltrados.length} resultado
						{egresosFiltrados.length !== 1 ? "s" : ""}
					</p>
					<p className="text-sm font-bold text-red-600">
						Subtotal: {formatMonto(totalFiltrado)}
					</p>
				</div>

				{egresosFiltrados.length === 0 ? (
					<div className="flex flex-col items-center justify-center flex-1 py-16 text-center">
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
					<div className="overflow-x-auto flex-1">
						<table className="w-full text-sm">
							<thead className="bg-white sticky top-0 shadow-sm z-10">
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
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Método de pago
									</th>
									<th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Monto
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{/* 🚀 Usamos paginatedEgresos aquí */}
								{paginatedEgresos.map((item, index) => (
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
										<td className="px-6 py-4 text-gray-600">
											{item.metodoPago ?? "-"}
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

				{/* 🚀 NUEVO: CONTROLES DE PAGINACIÓN */}
				{totalPages > 1 && (
					<div className="mt-auto px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
						<p className="text-sm text-gray-500">
							Mostrando{" "}
							<span className="font-semibold text-gray-700">
								{(currentPage - 1) * PAGE_SIZE + 1}
							</span>{" "}
							a{" "}
							<span className="font-semibold text-gray-700">
								{Math.min(currentPage * PAGE_SIZE, egresosFiltrados.length)}
							</span>{" "}
							de{" "}
							<span className="font-semibold text-gray-700">
								{egresosFiltrados.length}
							</span>{" "}
							egresos
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={currentPage === 1}
								className="flex items-center gap-1 text-gray-600 disabled:opacity-50"
							>
								<ChevronLeft className="w-4 h-4" /> Anterior
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									setCurrentPage((p) => Math.min(totalPages, p + 1))
								}
								disabled={currentPage === totalPages}
								className="flex items-center gap-1 text-gray-600 disabled:opacity-50"
							>
								Siguiente <ChevronRight className="w-4 h-4" />
							</Button>
						</div>
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
