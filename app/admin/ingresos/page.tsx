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
	Printer,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import RegistrarIngresoModal from "@/components/admin/ingresos/RegistrarIngresoModal";
import { useAdminAuth } from "@/context/AdminAuthContext";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface IngresoItem {
	id: string;
	tipo: "cuota" | "inscripcion" | "especial";
	alumnoNombre: string;
	alumnoDni: string;
	cursoNombre: string;
	monto: number;
	fecha: Date;
	metodoPago: string;
	mes?: number;
	anio?: number;
	registradoPor?: string;
}

type FiltroTipo = "todos" | "cuotas" | "inscripciones" | "especiales";
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

function obtenerMontoPorFiltro(
	montoTotal: number,
	metodoPago: string,
	filtro: FiltroMetodo,
): number {
	if (filtro === "Todos" || filtro === "Mixto" || !metodoPago.includes("+")) {
		return montoTotal;
	}
	const partes = metodoPago.split("+");
	const parteEncontrada = partes.find((p) =>
		p.toLowerCase().includes(filtro.toLowerCase()),
	);

	if (parteEncontrada) {
		const match = parteEncontrada.match(/\$\s*([\d.,]+)/);
		if (match && match[1]) {
			const numeroLimpio = match[1].replace(/\./g, "").replace(/,/g, ".");
			return parseFloat(numeroLimpio) || 0;
		}
	}

	return 0;
}

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

	const m = metodoPago.toLowerCase();
	const esMultiple = m.includes("+");

	if (filtro === "Mixto") return esMultiple;
	if (filtro === "Efectivo") return m.includes("efectivo");
	if (filtro === "Transferencia") return m.includes("transferencia");
	if (filtro === "Tarjeta") return m.includes("tarjeta");

	return false;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function IngresosPage() {
	const { adminData } = useAdminAuth();
	const isAdmin = adminData?.rol === "admin";

	const [ingresos, setIngresos] = useState<IngresoItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
	const [filtroMetodo, setFiltroMetodo] = useState<FiltroMetodo>("Todos");

	const [busqueda, setBusqueda] = useState("");
	const [filtroMes, setFiltroMes] = useState<number>(0);
	const [isModalOpen, setIsModalOpen] = useState(false);

	const [currentPage, setCurrentPage] = useState(1);

	useEffect(() => {
		setCurrentPage(1);
	}, [busqueda, filtroTipo, filtroMetodo, filtroMes]);

	const fetchIngresos = async () => {
		setIsLoading(true);
		try {
			const [cuotasSnap, inscripcionesSnap, especialesSnap] = await Promise.all(
				[
					getDocs(
						query(
							collection(db, "Cuotas"),
							where("estado", "==", "Pagado"),
							orderBy("actualizadoEn", "desc"),
						),
					),
					getDocs(
						query(
							collection(db, "Inscripciones"),
							where("status", "==", "Confirmado"),
						),
					),
					getDocs(
						query(
							collection(db, "IngresosEspeciales"),
							orderBy("fecha", "desc"),
						),
					),
				],
			);

			// ── Mapeo Cuotas ──
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

			// ── Mapeo Inscripciones ──
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

			// ── Mapeo Especiales ──
			const especiales: IngresoItem[] = especialesSnap.docs.map((d) => {
				const data = d.data();
				const fechaRaw = data.fecha as Timestamp;
				return {
					id: d.id,
					tipo: "especial",
					alumnoNombre: "-",
					alumnoDni: "-",
					cursoNombre: data.descripcion || "Ingreso Especial",
					monto: data.monto ?? 0,
					fecha: fechaRaw?.toDate?.() ?? new Date(),
					metodoPago: data.metodoPago ?? "-",
					registradoPor: data.registradoPor || "Admin",
				};
			});

			// Unir y ordenar por fecha desc
			const todos = [...cuotas, ...inscripciones, ...especiales].sort(
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
	const ingresosFiltrados = ingresos
		.filter((item) => {
			const matchTipo =
				filtroTipo === "todos" ||
				(filtroTipo === "cuotas" && item.tipo === "cuota") ||
				(filtroTipo === "inscripciones" && item.tipo === "inscripcion") ||
				(filtroTipo === "especiales" && item.tipo === "especial");

			const matchBusqueda =
				busqueda === "" ||
				item.alumnoNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
				item.alumnoDni.includes(busqueda) ||
				item.cursoNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
				(item.registradoPor &&
					item.registradoPor.toLowerCase().includes(busqueda.toLowerCase()));

			const matchMes =
				filtroMes === 0 ||
				(item.tipo === "cuota" && item.mes === filtroMes) ||
				((item.tipo === "inscripcion" || item.tipo === "especial") &&
					item.fecha.getMonth() + 1 === filtroMes);

			const matchMetodo = matchMetodoPago(item.metodoPago, filtroMetodo);

			return matchTipo && matchBusqueda && matchMes && matchMetodo;
		})
		.map((item) => ({
			...item,
			monto: obtenerMontoPorFiltro(item.monto, item.metodoPago, filtroMetodo),
		}));

	const totalPages = Math.ceil(ingresosFiltrados.length / PAGE_SIZE);
	const paginatedIngresos = ingresosFiltrados.slice(
		(currentPage - 1) * PAGE_SIZE,
		currentPage * PAGE_SIZE,
	);

	// ── Métricas ───────────────────────────────────────────────────────────────
	const totalIngresos = ingresosFiltrados.reduce((sum, i) => sum + i.monto, 0);
	const totalCuotas = ingresos
		.filter((i) => i.tipo === "cuota")
		.reduce((s, i) => s + i.monto, 0);
	const totalInscripciones = ingresos
		.filter((i) => i.tipo === "inscripcion")
		.reduce((s, i) => s + i.monto, 0);
	const totalEspeciales = ingresos
		.filter((i) => i.tipo === "especial")
		.reduce((s, i) => s + i.monto, 0);

	const countCuotas = ingresos.filter((i) => i.tipo === "cuota").length;
	const countInscripciones = ingresos.filter(
		(i) => i.tipo === "inscripcion",
	).length;
	const countEspeciales = ingresos.filter((i) => i.tipo === "especial").length;

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-96">
				<Loader2 className="w-10 h-10 animate-spin text-[#252d62]" />
			</div>
		);
	}

	const handlePrint = () => {
		// 🚀 IMPRIMIR usa ingresosFiltrados (El array completo)
		const filas = ingresosFiltrados
			.map(
				(item) => `
          <tr>
            <td>${item.tipo === "cuota" ? "Cuota" : item.tipo === "inscripcion" ? "Inscripción" : "Especial"}</td>
            <td>
              ${
								item.tipo === "especial"
									? (item.registradoPor ?? "-")
									: `${item.alumnoNombre}<br/><small>DNI: ${item.alumnoDni}</small>`
							}
            </td>
            <td>${item.cursoNombre}</td>
            <td>${
							item.tipo === "cuota" && item.mes && item.anio
								? `${MESES[item.mes - 1]} ${item.anio}`
								: `${MESES[item.fecha.getMonth()]} ${item.fecha.getFullYear()}`
						}</td>
            <td>${item.metodoPago}</td>
            <td>${formatFecha(item.fecha)}</td>
            <td style="text-align:right">${formatMonto(item.monto)}</td>
          </tr>
        `,
			)
			.join("");

		const filtrosActivos = [
			filtroTipo !== "todos"
				? filtroTipo.charAt(0).toUpperCase() + filtroTipo.slice(1)
				: null,
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

		const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Ingresos - English Empire</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
        h1 { font-size: 18px; color: #252d62; margin-bottom: 4px; }
        p.subtitulo { font-size: 11px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background-color: #252d62; color: white; }
        thead th { padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
        tbody tr:nth-child(even) { background-color: #f5f5f5; }
        tbody td { padding: 7px 10px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
        tfoot tr { background-color: #f0f0f0; font-weight: bold; }
        tfoot td { padding: 8px 10px; border-top: 2px solid #252d62; }
        small { color: #888; }
        @media print { body { padding: 12px 16px; } @page { margin: 1.2cm; } }
      </style>
    </head>
    <body>
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
        <div>
          <h1>Ingresos — English Empire Institute</h1>
          <p class="subtitulo">
            Generado el ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })} 
            · ${ingresosFiltrados.length} resultado${ingresosFiltrados.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style="text-align:right; font-size:11px; color:#444;">
          <span style="font-weight:bold; color:#252d62;">Filtros aplicados</span><br/>
          ${filtrosTexto}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Alumno / Detalle</th>
            <th>Concepto</th>
            <th>Período</th>
            <th>Método</th>
            <th>Fecha de pago</th>
            <th style="text-align:right">Monto</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
        <tfoot>
          <tr>
            <td colspan="6">Total</td>
            <td style="text-align:right">${formatMonto(totalIngresos)}</td>
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
		<div className="p-6 space-y-6 flex flex-col h-full flex-1">
			{/* Header */}
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				className="flex items-center justify-between gap-3 shrink-0"
			>
				<div className="flex items-center gap-3">
					<div className="bg-[#252d62] p-2.5 rounded-lg">
						<TrendingUp className="w-5 h-5 text-white" />
					</div>
					<div>
						<h1 className="text-2xl font-bold text-[#252d62]">Ingresos</h1>
						<p className="text-sm text-gray-500">
							Historial de cobros e ingresos especiales
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<Button
						onClick={handlePrint}
						variant="outline"
						disabled={ingresosFiltrados.length === 0}
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
						Registrar nuevo ingreso
					</Button>
				</div>
			</motion.div>

			{/* Cards de resumen */}
			{isAdmin && (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
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
							{formatMonto(totalCuotas + totalInscripciones + totalEspeciales)}
						</p>
						<p className="text-xs text-gray-400 mt-1">
							{countCuotas + countInscripciones + countEspeciales} ingresos en
							total
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
							{countInscripciones} confirmadas
						</p>
					</motion.div>

					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
						className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
					>
						<div className="flex items-center justify-between mb-3">
							<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
								Otros Ingresos
							</p>
							<div className="bg-purple-50 p-2 rounded-lg">
								<DollarSign className="w-4 h-4 text-purple-600" />
							</div>
						</div>
						<p className="text-2xl font-bold text-gray-900">
							{formatMonto(totalEspeciales)}
						</p>
						<p className="text-xs text-gray-400 mt-1">
							{countEspeciales} ingresos varios
						</p>
					</motion.div>
				</div>
			)}

			{/* Filtros */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.25 }}
				className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col xl:flex-row gap-3 shrink-0"
			>
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
					<input
						type="text"
						placeholder="Buscar por alumno, DNI, descripción o administrador..."
						value={busqueda}
						onChange={(e) => setBusqueda(e.target.value)}
						className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62]"
					/>
				</div>

				<div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 overflow-x-auto">
					<select
						value={filtroTipo}
						onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
						className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-white"
					>
						<option value="todos">Todos los tipos</option>
						<option value="cuotas">Cuotas</option>
						<option value="inscripciones">Inscripciones</option>
						<option value="especiales">Especiales</option>
					</select>
				</div>

				<div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 overflow-x-auto">
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
				transition={{ delay: 0.3 }}
				className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col flex-1 overflow-hidden"
			>
				<div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
					<p className="text-sm text-gray-500">
						{ingresosFiltrados.length} resultado
						{ingresosFiltrados.length !== 1 ? "s" : ""}
					</p>
					<p className="text-sm font-bold text-[#252d62]">
						Subtotal filtrado: {formatMonto(totalIngresos)}
					</p>
				</div>

				{ingresosFiltrados.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 text-center flex-1">
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
					<div className="overflow-x-auto flex-1">
						<table className="w-full text-sm">
							<thead className="bg-white sticky top-0 z-10 shadow-sm">
								<tr className="border-b border-gray-100">
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Tipo
									</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Alumno / Detalle
									</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Concepto
									</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Período
									</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Método
									</th>
									<th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Fecha de pago
									</th>
									<th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
										Monto
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{/* 🚀 Renderiza el arreglo paginado */}
								{paginatedIngresos.map((item, index) => (
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
													<Receipt className="w-3 h-3" /> Cuota
												</span>
											) : item.tipo === "inscripcion" ? (
												<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">
													<GraduationCap className="w-3 h-3" /> Inscripción
												</span>
											) : (
												<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
													<DollarSign className="w-3 h-3" /> Especial
												</span>
											)}
										</td>
										<td className="px-6 py-4">
											{item.tipo === "especial" ? (
												<p className="font-medium text-gray-900">
													Registro: {item.registradoPor}
												</p>
											) : (
												<>
													<p className="font-medium text-gray-900">
														{item.alumnoNombre}
													</p>
													<p className="text-xs text-gray-400">
														DNI: {item.alumnoDni}
													</p>
												</>
											)}
										</td>
										<td className="px-6 py-4 text-gray-700 font-medium">
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
								{Math.min(currentPage * PAGE_SIZE, ingresosFiltrados.length)}
							</span>{" "}
							de{" "}
							<span className="font-semibold text-gray-700">
								{ingresosFiltrados.length}
							</span>{" "}
							ingresos
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
