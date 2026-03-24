"use client";

import React, { useState, useEffect, useMemo } from "react";
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
	CalendarClock,
	RefreshCw,
	AlertTriangle,
	Pencil,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	type Cuota,
	type Descuento,
	calcularPrecioBase,
	aplicarDescuentos,
} from "@/lib/cuotas";
import EditarCuotaModal from "./EditarCuotaModal";
import { motion } from "framer-motion";

const MESES_NOMBRES = [
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

const CF_URL = "/api/generar-cuotas";

interface CuotaDoc extends Cuota {
	estado: "Pendiente" | "Pagado" | "Incobrable";
	montoAjustado?: number | null;
	motivoAjuste?: string | null;
}

interface CuotasTableProps {
	searchTerm: string;
	selectedMonth: string;
	statusFilter: string;
	courseFilter: string;
	tagFilter: string;
	refreshTrigger: number;
	isFutureMonth: boolean;
	setIsModalCobrarOpen: React.Dispatch<React.SetStateAction<boolean>>;
	onCobrar: (dni: string) => void;
	onCuotasGeneradas: () => void;
	printTrigger: number;
}

// ─── Lógica de Máximo Beneficio ──────────────────────────────────────

function obtenerMejorDescuento(descuentos?: Descuento[]): Descuento | null {
	if (!descuentos || descuentos.length === 0) return null;
	return descuentos.reduce((max, obj) =>
		obj.porcentaje > max.porcentaje ? obj : max,
	);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolverMontoCuota(cuota: CuotaDoc): number {
	if (cuota.estado === "Pagado" && cuota.montoPagado !== null) {
		return cuota.montoPagado;
	}
	if (cuota.montoAjustado != null) return cuota.montoAjustado;

	const base = calcularPrecioBase(cuota);
	const mejorDescuento = obtenerMejorDescuento(cuota.descuentos);
	return aplicarDescuentos(base, mejorDescuento ? [mejorDescuento] : []);
}

function obtenerIniciales(texto: string): string {
	return texto
		.split(" ")
		.filter(Boolean)
		.map((palabra) => palabra[0].toUpperCase())
		.join("");
}

// ─── Badges ──────────────────────────────────────────────────────────────────

function SingleMetodoBadge({ metodo }: { metodo: string }) {
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
			{icon} {metodo.trim()}
		</span>
	);
}

function MetodoPagoBadge({ metodo }: { metodo: string | null }) {
	if (!metodo) return <span className="text-xs text-gray-400 italic">—</span>;
	const partes = metodo
		.split("+")
		.map((p) => p.trim())
		.filter(Boolean);
	if (partes.length === 1) return <SingleMetodoBadge metodo={partes[0]} />;

	return (
		<div className="flex flex-col gap-1.5">
			{partes.map((parte, i) => (
				<SingleMetodoBadge key={i} metodo={parte} />
			))}
		</div>
	);
}

function EstadoBadge({ estado }: { estado: CuotaDoc["estado"] }) {
	if (estado === "Pagado")
		return (
			<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold">
				<CheckCircle2 className="w-3.5 h-3.5" /> Pagado
			</span>
		);
	if (estado === "Incobrable")
		return (
			<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
				<Tag className="w-3.5 h-3.5" /> Incobrable
			</span>
		);
	return (
		<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">
			<AlertCircle className="w-3.5 h-3.5" /> Pendiente
		</span>
	);
}

function MontoCelda({ cuota }: { cuota: CuotaDoc }) {
	const mejorDescuento = obtenerMejorDescuento(cuota.descuentos);
	const arrayDescuentosAplicar = mejorDescuento ? [mejorDescuento] : [];
	const tieneDescuentos = !!mejorDescuento;

	const precioBase = calcularPrecioBase(cuota);
	const montoConDescuento = aplicarDescuentos(
		precioBase,
		arrayDescuentosAplicar,
	);
	const montoMostrar = resolverMontoCuota(cuota);

	const TOOLTIP_WIDTH = 220;
	const TOOLTIP_HEIGHT = 80;
	const badgeRef = React.useRef<HTMLSpanElement>(null);
	const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
		null,
	);

	const showTooltip = React.useCallback(() => {
		if (!badgeRef.current) return;
		const rect = badgeRef.current.getBoundingClientRect();
		let x = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
		let y = rect.top - TOOLTIP_HEIGHT - 10;
		if (x + TOOLTIP_WIDTH > window.innerWidth - 8)
			x = window.innerWidth - TOOLTIP_WIDTH - 8;
		if (x < 8) x = 8;
		if (y < 8) y = rect.bottom + 10;
		setTooltipPos({ x, y });
	}, []);

	const hideTooltip = React.useCallback(() => setTooltipPos(null), []);

	return (
		<div className="flex flex-col gap-1 items-start">
			<div className="flex items-center gap-2">
				<span className="font-semibold text-gray-800">
					${montoMostrar.toLocaleString("es-AR")}
				</span>

				{cuota.motivoAjuste && cuota.motivoAjuste.trim() !== "" && (
					<>
						<span
							ref={badgeRef}
							onMouseEnter={showTooltip}
							onMouseLeave={hideTooltip}
							className="text-amber-500 cursor-help"
						>
							<AlertCircle className="w-4 h-4" />
						</span>

						{tooltipPos && (
							<div
								className="fixed z-[9999] pointer-events-none"
								style={{
									left: tooltipPos.x,
									top: tooltipPos.y,
									width: TOOLTIP_WIDTH,
								}}
							>
								<div className="bg-[#1a2248] text-white rounded-xl shadow-xl p-3">
									<div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
										<AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
										<p className="text-xs font-bold leading-tight">
											Monto Ajustado Manualmente
										</p>
									</div>
									<p className="text-xs text-white/80 leading-relaxed italic">
										{cuota.motivoAjuste}
									</p>
								</div>
								<div className="flex justify-center -mt-1">
									<div className="w-2 h-2 bg-[#1a2248] rotate-45" />
								</div>
							</div>
						)}
					</>
				)}
			</div>

			{/* Precio base tachado si hay descuento y está pendiente */}
			{tieneDescuentos &&
				cuota.estado === "Pendiente" &&
				precioBase !== montoConDescuento && (
					<span className="text-[11px] text-gray-400 line-through">
						${precioBase.toLocaleString("es-AR")}
					</span>
				)}

			{/* Rango 1-10 / 11+ sin descuento */}
			{cuota.estado === "Pendiente" &&
				!cuota.esPrimerMes &&
				!tieneDescuentos && (
					<p className="text-[11px] text-gray-400">
						1-10: ${cuota.cuota1a10.toLocaleString("es-AR")} · 11+: $
						{cuota.cuota11enAdelante.toLocaleString("es-AR")}
					</p>
				)}

			{/* Rango 1-10 / 11+ con el ÚNICO descuento aplicado */}
			{tieneDescuentos &&
				cuota.estado === "Pendiente" &&
				!cuota.esPrimerMes && (
					<p className="text-[11px] text-emerald-600">
						1-10: $
						{aplicarDescuentos(
							cuota.cuota1a10,
							arrayDescuentosAplicar,
						).toLocaleString("es-AR")}{" "}
						· 11+: $
						{aplicarDescuentos(
							cuota.cuota11enAdelante,
							arrayDescuentosAplicar,
						).toLocaleString("es-AR")}
					</p>
				)}

			{/* Badge del ÚNICO descuento utilizado */}
			{tieneDescuentos && mejorDescuento && (
				<div className="flex flex-wrap gap-1 mt-0.5">
					<span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-200">
						<Tag className="w-2.5 h-2.5 shrink-0" />
						{mejorDescuento.porcentaje}% ·{" "}
						{obtenerIniciales(mejorDescuento.detalle)}
					</span>
					{cuota.estado === "Pendiente" && (
						<span className="text-[9px] text-emerald-600 font-bold">
							Aplicado
						</span>
					)}
				</div>
			)}
		</div>
	);
}

// ─── Estados vacíos ───────────────────────────────────────────────────────────

function EmptyFutureMonthPending({
	mesNombre,
	mesActualNombre,
}: {
	mesNombre: string;
	mesActualNombre: string;
}) {
	return (
		<div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
			<div className="bg-blue-50 p-5 rounded-full mb-4">
				<CalendarClock className="w-10 h-10 text-blue-400" />
			</div>
			<p className="text-lg font-bold text-[#252d62] mb-1">
				Las cuotas de {mesNombre} aún no están disponibles
			</p>
			<p className="text-sm text-gray-500 max-w-sm">
				La generación automática de cuotas de{" "}
				<span className="font-semibold">{mesNombre}</span> se ejecutará el{" "}
				<span className="font-semibold">20 de {mesActualNombre}</span>.
			</p>
		</div>
	);
}

function EmptyFutureMonthError({
	mesNombre,
	mes,
	anio,
	onGenerado,
}: {
	mesNombre: string;
	mes: number;
	anio: number;
	onGenerado: () => void;
}) {
	const [isTriggering, setIsTriggering] = useState(false);
	const [triggerStatus, setTriggerStatus] = useState<"idle" | "ok" | "error">(
		"idle",
	);

	const handleTrigger = async () => {
		setIsTriggering(true);
		setTriggerStatus("idle");
		try {
			const res = await fetch(`${CF_URL}?mes=${mes}&anio=${anio}`);
			if (res.ok) {
				setTriggerStatus("ok");
				setTimeout(() => onGenerado(), 2500);
			} else setTriggerStatus("error");
		} catch {
			setTriggerStatus("error");
		} finally {
			setIsTriggering(false);
		}
	};

	return (
		<div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
			<div className="bg-amber-50 p-5 rounded-full mb-4">
				<AlertTriangle className="w-10 h-10 text-amber-400" />
			</div>
			<p className="text-lg font-bold text-[#252d62] mb-1">
				No se encontraron cuotas para {mesNombre}
			</p>
			<p className="text-sm text-gray-500 max-w-sm mb-6">
				Si creés que es un error, podés generar las cuotas de{" "}
				<span className="font-semibold">{mesNombre}</span> manualmente.
			</p>
			{triggerStatus === "ok" ? (
				<div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 px-4 py-3 rounded-xl text-sm font-medium">
					<CheckCircle2 className="w-4 h-4" /> ¡Cuotas generadas! Recargando
					tabla...
				</div>
			) : triggerStatus === "error" ? (
				<div className="flex flex-col items-center gap-3">
					<div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl text-sm font-medium">
						<AlertCircle className="w-4 h-4" /> Hubo un error al ejecutar la
						función.
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={handleTrigger}
						className="gap-2"
					>
						<RefreshCw className="w-4 h-4" /> Reintentar
					</Button>
				</div>
			) : (
				<Button
					onClick={handleTrigger}
					disabled={isTriggering}
					className="bg-[#252d62] hover:bg-[#1a1f45] text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-70"
				>
					{isTriggering ? (
						<>
							<Loader2 className="w-4 h-4 animate-spin" /> Generando cuotas...
						</>
					) : (
						<>
							<RefreshCw className="w-4 h-4" /> Generar cuotas de {mesNombre}
						</>
					)}
				</Button>
			)}
		</div>
	);
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CuotasTable({
	searchTerm,
	selectedMonth,
	statusFilter,
	courseFilter,
	tagFilter,
	refreshTrigger,
	isFutureMonth,
	printTrigger,
	onCobrar,
	onCuotasGeneradas,
}: CuotasTableProps) {
	const [cuotas, setCuotas] = useState<CuotaDoc[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [cuotaAEditar, setCuotaAEditar] = useState<CuotaDoc | null>(null);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);

	const [currentPage, setCurrentPage] = useState(1);
	const PAGE_SIZE = 15;

	const hoy = new Date();
	const diaHoy = hoy.getDate();
	const mesActualIdx = hoy.getMonth();
	const [selAnio, selMes] = selectedMonth.split("-").map(Number);
	const mesNombre = MESES_NOMBRES[selMes - 1];
	const mesActualNombre = MESES_NOMBRES[mesActualIdx];

	// Reset de página si cambian filtros o de mes
	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm, selectedMonth, statusFilter, courseFilter, tagFilter]);

	useEffect(() => {
		const fetchCuotas = async () => {
			setIsLoading(true);
			try {
				const q = query(
					collection(db, "Cuotas"),
					where("mes", "==", selMes),
					where("anio", "==", selAnio),
				);
				const snap = await getDocs(q);
				const fetchedCuotas: CuotaDoc[] = snap.docs.map((docSnap) => {
					const data = docSnap.data();
					return {
						id: docSnap.id,
						alumnoId: data.alumnoId,
						alumnoDni: data.alumnoDni,
						alumnoTipo: data.alumnoTipo,
						alumnoNombre: data.alumnoNombre,
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
						inscripcionId: data.inscripcionId ?? "",
						fechaPago: data.fechaPago ?? null,
						descuentos: data.descuentos ?? [],
						montoAjustado: data.montoAjustado ?? null,
						motivoAjuste: data.motivoAjuste ?? null,
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
	}, [selectedMonth, refreshTrigger, selMes, selAnio]);

	// Master Filter (Array Completo)
	const filteredCuotas = useMemo(() => {
		return cuotas.filter((cuota) => {
			const matchesSearch =
				searchTerm === "" ||
				cuota.alumnoNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
				cuota.alumnoDni.includes(searchTerm);

			const matchesStatus =
				statusFilter === "todos" ||
				(statusFilter === "pagados" && cuota.estado === "Pagado") ||
				(statusFilter === "pendientes" && cuota.estado === "Pendiente") ||
				(statusFilter === "eximidos" && cuota.estado === "Incobrable");

			const matchesCourse =
				courseFilter === "todos" || cuota.cursoId === courseFilter;

			let matchesTag = true;
			if (tagFilter !== "todos") {
				matchesTag =
					cuota.descuentos?.some((d) => {
						if (tagFilter === "grupo_familiar")
							return d.detalle === "Grupo Familiar";
						return d.detalle.includes(tagFilter);
					}) ?? false;
			}

			return matchesSearch && matchesStatus && matchesCourse && matchesTag;
		});
	}, [cuotas, searchTerm, statusFilter, courseFilter, tagFilter]);

	// 🚀 Array Paginado (Recortado para la vista actual)
	const paginatedCuotas = useMemo(() => {
		const startIndex = (currentPage - 1) * PAGE_SIZE;
		return filteredCuotas.slice(startIndex, startIndex + PAGE_SIZE);
	}, [filteredCuotas, currentPage]);

	const totalPages = Math.ceil(filteredCuotas.length / PAGE_SIZE);

	useEffect(() => {
		if (printTrigger === 0) return;
		if (!isLoading && filteredCuotas.length > 0) handlePrint();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [printTrigger]);

	const handlePrint = () => {
		const formatMoney = (n: number) => `$${n.toLocaleString("es-AR")}`;

		// USAMOS filteredCuotas ACÁ PARA IMPRIMIR TODO LO QUE CUMPLA EL FILTRO
		const filas = filteredCuotas
			.map((cuota) => {
				const mejorDescuento = obtenerMejorDescuento(cuota.descuentos);
				const arrayDesc = mejorDescuento ? [mejorDescuento] : [];
				const monto = resolverMontoCuota(cuota);
				const base = calcularPrecioBase(cuota);
				const tieneDesc = !!mejorDescuento;

				const estadoColor =
					cuota.estado === "Pagado"
						? "#15803d"
						: cuota.estado === "Incobrable"
							? "#6b7280"
							: "#dc2626";

				const montoExtra = tieneDesc
					? `<div style="font-size:11px;color:#059669;">1-10: ${formatMoney(aplicarDescuentos(cuota.cuota1a10, arrayDesc))} · 11+: ${formatMoney(aplicarDescuentos(cuota.cuota11enAdelante, arrayDesc))}</div><div style="font-size:10px;color:#059669;font-weight:600;">${mejorDescuento!.porcentaje}% desc. – ${mejorDescuento!.detalle}</div>`
					: cuota.estado === "Pendiente" && !cuota.esPrimerMes
						? `<div style="font-size:11px;color:#9ca3af;">1-10: ${formatMoney(cuota.cuota1a10)} · 11+: ${formatMoney(cuota.cuota11enAdelante)}</div>`
						: "";

				const montoTachado =
					tieneDesc && cuota.estado === "Pendiente" && base !== monto
						? `<div style="font-size:11px;text-decoration:line-through;color:#9ca3af;">${formatMoney(base)}</div>`
						: "";

				const fechaPagoStr = cuota.fechaPago ?? "—";

				return `
        <tr>
          <td>
            <strong>${cuota.alumnoNombre}</strong>
            <div style="font-size:11px;color:#6b7280;">DNI: ${cuota.alumnoDni}</div>
          </td>
          <td>
            <div style="font-weight:500;">${cuota.cursoNombre}</div>
            ${cuota.esPrimerMes ? '<div style="margin-top:3px;"><span style="font-size:10px;background:#e0e7ff;color:#4338ca;padding:2px 6px;border-radius:4px;display:inline-block;">1er mes</span></div>' : ""}
          </td>
          <td style="text-align:center;">
            <span style="color:${estadoColor};font-weight:700;">${cuota.estado}</span>
          </td>
          <td>
            <strong>${formatMoney(monto)}</strong>
            ${montoTachado}
            ${montoExtra}
          </td>
          <td>${cuota.metodoPago ?? "—"}</td>
          <td style="text-align:center;">${cuota.estado === "Pagado" ? fechaPagoStr : "—"}</td>
        </tr>`;
			})
			.join("");

		const resumenFiltros = [
			statusFilter !== "todos" ? `Estado: ${statusFilter}` : null,
			courseFilter !== "todos" ? `Curso: ${courseFilter}` : null,
			tagFilter !== "todos" ? `Etiqueta: ${tagFilter}` : null,
			searchTerm ? `Búsqueda: "${searchTerm}"` : null,
		]
			.filter(Boolean)
			.join(" · ");

		const totalPagado = filteredCuotas
			.filter((c) => c.estado === "Pagado")
			.reduce((acc, c) => acc + (c.montoPagado ?? 0), 0);
		const totalPendiente = filteredCuotas
			.filter((c) => c.estado === "Pendiente")
			.reduce((acc, c) => acc + resolverMontoCuota(c), 0);

		const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Cuotas ${mesNombre} ${selAnio} – English Empire</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 28px 32px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #252d62; padding-bottom: 14px; }
        .header-left h1 { font-size: 20px; color: #252d62; font-weight: 800; }
        .header-left p { font-size: 12px; color: #6b7280; margin-top: 3px; }
        .header-right { text-align: right; font-size: 11px; color: #6b7280; }
        .periodo { font-size: 15px; font-weight: 700; color: #252d62; margin-bottom: 8px; }
        .filtros { font-size: 11px; color: #6b7280; margin-bottom: 16px; min-height: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        thead { background: #f3f4f6; }
        th { padding: 9px 10px; text-align: left; font-size: 11px; color: #374151; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e5e7eb; }
        td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #f9fafb; }
        .resumen { display: flex; gap: 24px; justify-content: flex-end; border-top: 1px solid #e5e7eb; padding-top: 14px; }
        .resumen-item { text-align: right; }
        .resumen-item .label { font-size: 11px; color: #6b7280; }
        .resumen-item .valor { font-size: 15px; font-weight: 800; }
        .valor-pagado { color: #15803d; }
        .valor-pendiente { color: #dc2626; }
        .valor-total { color: #252d62; }
        .footer { margin-top: 28px; font-size: 10px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        @media print { body { padding: 12px 16px; } @page { margin: 1.2cm; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <h1>English Empire Institute</h1>
          <p>Panel de administración · Gestión de Cuotas</p>
        </div>
        <div class="header-right">
          <div>Impreso: ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}</div>
          <div>${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>
      <div class="periodo">Cuotas de ${mesNombre} ${selAnio}</div>
      <div class="filtros">${resumenFiltros || "Sin filtros adicionales aplicados"} · ${filteredCuotas.length} registro${filteredCuotas.length !== 1 ? "s" : ""}</div>
      <table>
        <thead>
          <tr>
            <th>Alumno</th>
            <th>Curso</th>
            <th style="text-align:center;">Estado</th>
            <th>Monto</th>
            <th>Método de Pago</th>
            <th style="text-align:center;">Fecha de Pago</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="resumen">
        <div class="resumen-item"><div class="label">Total cobrado</div><div class="valor valor-pagado">${formatMoney(totalPagado)}</div></div>
        <div class="resumen-item"><div class="label">Total pendiente</div><div class="valor valor-pendiente">${formatMoney(totalPendiente)}</div></div>
        <div class="resumen-item"><div class="label">Total general</div><div class="valor valor-total">${formatMoney(totalPagado + totalPendiente)}</div></div>
      </div>
      <div class="footer">Este documento fue generado automáticamente por el sistema de administración de English Empire Institute.</div>
    </body>
    </html>`;

		const ventana = window.open("", "_blank", "width=900,height=700");
		if (!ventana) return;
		ventana.document.write(html);
		ventana.document.close();
		ventana.focus();
		setTimeout(() => ventana.print(), 400);
	};

	if (isLoading)
		return (
			<div className="flex-1 flex flex-col items-center justify-center p-10 text-gray-500">
				<Loader2 className="w-8 h-8 animate-spin text-[#EE1120] mb-4" />
				<p>Cargando estado de cuotas...</p>
			</div>
		);

	if (cuotas.length === 0) {
		if (isFutureMonth && diaHoy < 20)
			return (
				<EmptyFutureMonthPending
					mesNombre={mesNombre}
					mesActualNombre={mesActualNombre}
				/>
			);
		if (isFutureMonth && diaHoy >= 20)
			return (
				<EmptyFutureMonthError
					mesNombre={mesNombre}
					mes={selMes}
					anio={selAnio}
					onGenerado={onCuotasGeneradas}
				/>
			);
		return (
			<div className="flex-1 flex flex-col items-center justify-center p-10 text-gray-500">
				<AlertCircle className="w-12 h-12 text-gray-300 mb-3" />
				<p className="text-lg font-medium text-gray-600">
					No hay cuotas para este mes.
				</p>
			</div>
		);
	}

	if (filteredCuotas.length === 0)
		return (
			<div className="flex-1 flex flex-col items-center justify-center p-10 text-gray-500">
				<AlertCircle className="w-12 h-12 text-gray-300 mb-3" />
				<p className="text-lg font-medium text-gray-600">
					Sin resultados para los filtros aplicados.
				</p>
			</div>
		);

	return (
		<div className="overflow-x-auto flex flex-col h-full flex-1">
			<table className="w-full text-left text-sm">
				<thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
					<tr>
						<th className="px-4 py-4">Alumno</th>
						<th className="px-4 py-4">Curso</th>
						<th className="px-4 py-4 text-center">Estado</th>
						<th className="px-4 py-4">Monto</th>
						<th className="px-4 py-4">Método de Pago</th>
						<th className="px-4 py-4 text-center">Acciones</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-gray-100">
					{/* 🚀 USAMOS EL ARRAY PAGINADO ACÁ */}
					{paginatedCuotas.map((cuota, index) => (
						<motion.tr
							key={cuota.id}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.2, delay: index * 0.02 }}
							className="hover:bg-gray-50 transition-colors group"
						>
							<td className="px-4 py-4">
								<div className="flex items-center gap-3">
									<div
										className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cuota.alumnoTipo === "adulto" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}
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
							<td className="px-4 py-4">
								<div className="flex items-start flex-col gap-1">
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
							<td className="px-4 py-4 text-center">
								<EstadoBadge estado={cuota.estado} />
							</td>
							<td className="px-4 py-4">
								<MontoCelda cuota={cuota} />
							</td>
							<td className="px-4 py-4">
								<MetodoPagoBadge metodo={cuota.metodoPago} />
							</td>
							<td className="px-4 py-4 text-center">
								<div className="flex items-center justify-center gap-2">
									{cuota.estado !== "Pagado" && (
										<Button
											size="sm"
											variant="outline"
											className="border-gray-200 text-gray-500 hover:border-[#252d62] hover:text-[#252d62] transition-colors"
											onClick={() => {
												setCuotaAEditar(cuota);
												setIsEditModalOpen(true);
											}}
										>
											<Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
										</Button>
									)}
									{cuota.estado === "Pendiente" ? (
										<Button
											size="sm"
											className="bg-white border border-[#EE1120] text-[#EE1120] hover:bg-[#EE1120] hover:text-white transition-colors"
											onClick={() => onCobrar(cuota.alumnoDni)}
										>
											<CreditCard className="w-4 h-4 mr-2" /> Cobrar
										</Button>
									) : (
										<span className="text-xs text-gray-400 italic">
											Sin acciones
										</span>
									)}
								</div>
							</td>
						</motion.tr>
					))}
				</tbody>
			</table>

			{/* 🚀 CONTROLES DE PAGINACIÓN */}
			{!isLoading && totalPages > 1 && (
				<div className="mt-auto flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white shrink-0">
					<p className="text-sm text-gray-500">
						Mostrando{" "}
						<span className="font-semibold text-gray-700">
							{(currentPage - 1) * PAGE_SIZE + 1}
						</span>{" "}
						a{" "}
						<span className="font-semibold text-gray-700">
							{Math.min(currentPage * PAGE_SIZE, filteredCuotas.length)}
						</span>{" "}
						de{" "}
						<span className="font-semibold text-gray-700">
							{filteredCuotas.length}
						</span>{" "}
						cuotas
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
							onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
							disabled={currentPage === totalPages}
							className="flex items-center gap-1 text-gray-600 disabled:opacity-50"
						>
							Siguiente <ChevronRight className="w-4 h-4" />
						</Button>
					</div>
				</div>
			)}

			<EditarCuotaModal
				isOpen={isEditModalOpen}
				onClose={() => {
					setIsEditModalOpen(false);
					setCuotaAEditar(null);
				}}
				cuota={cuotaAEditar}
				onSuccess={() => {
					setIsEditModalOpen(false);
					setCuotaAEditar(null);
					onCuotasGeneradas();
				}}
			/>
		</div>
	);
}
