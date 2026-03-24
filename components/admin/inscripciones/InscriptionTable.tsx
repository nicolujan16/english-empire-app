"use client";

import React, {
	useState,
	useEffect,
	useMemo,
	useRef,
	useCallback,
} from "react";
import {
	Search,
	Filter,
	Pencil,
	Loader2,
	ChevronDown,
	X,
	Calendar,
	CreditCard as CreditCardIcon,
	Book,
	Lock,
	Tag,
	Printer,
} from "lucide-react";
import { motion } from "framer-motion";

import {
	collection,
	onSnapshot,
	query,
	doc,
	updateDoc,
	deleteDoc,
	arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

import EditInscriptionModal, {
	Inscription,
	InscriptionStatus,
} from "./EditarInscriptionModal";

// ─── INTERFACES ───────────────────────────────────────────────────────────────

interface InscriptionRow extends Inscription {
	metodoPago: string;
	tipoAlumno?: string;
	fechaPromesaPago?: string;
	descuentoPorEtiqueta?: string | null;
	descuentoPorcentaje?: number;
}

interface InscriptionsTableProps {
	showTitle?: boolean;
}

// ─── COMPONENTE ETIQUETA BADGE (Adaptado y Optimizado) ────────────────────────

const TOOLTIP_WIDTH = 220;
const TOOLTIP_HEIGHT = 80;

function EtiquetaBadge({
	nombre,
	porcentaje,
}: {
	nombre: string;
	porcentaje: number;
}) {
	const inicialesEtiqueta = nombre.substring(0, 2).toUpperCase();

	const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
		null,
	);
	const badgeRef = useRef<HTMLSpanElement>(null);

	const showTooltip = useCallback(() => {
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

	const hideTooltip = useCallback(() => setTooltipPos(null), []);

	return (
		<>
			<span
				ref={badgeRef}
				onMouseEnter={showTooltip}
				onMouseLeave={hideTooltip}
				className="inline-flex items-center justify-center text-[9px] font-black px-1.5 py-0.5 rounded border cursor-default select-none bg-purple-100 text-purple-700 border-purple-200 transition-colors hover:bg-purple-200 shadow-sm"
			>
				<Tag className="w-2.5 h-2.5 mr-1" />
				{inicialesEtiqueta}
			</span>

			{/* Tooltip renderizado en posición fixed — escapa del overflow */}
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
						{/* Título */}
						<div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
							<span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
							<p className="text-xs font-bold leading-tight truncate">
								{nombre}
							</p>
						</div>
						{/* Descuentos */}
						<div className="flex items-center justify-between text-xs">
							<span className="text-white/60">Descuento aplicado:</span>
							<span className="font-bold text-emerald-400 text-sm">
								{porcentaje}% off
							</span>
						</div>
					</div>
					{/* Flecha apuntando hacia abajo */}
					<div className="flex justify-center -mt-1">
						<div className="w-2 h-2 bg-[#1a2248] rotate-45" />
					</div>
				</div>
			)}
		</>
	);
}

// ─── TABLA PRINCIPAL ──────────────────────────────────────────────────────────

const InscriptionsTable = ({ showTitle = true }: InscriptionsTableProps) => {
	const [searchTerm, setSearchTerm] = useState<string>("");
	const [courseFilter, setCourseFilter] = useState<string>("Todos");
	const [paymentFilter, setPaymentFilter] = useState<string>("Todos");
	const [statusFilter, setStatusFilter] = useState<string>("Todos");
	const [tagFilter, setTagFilter] = useState<string>("Todos");
	const [currentPage, setCurrentPage] = useState(1);

	const [inscriptions, setInscriptions] = useState<InscriptionRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [inscriptionToEdit, setInscriptionToEdit] =
		useState<Inscription | null>(null);

	const PAGE_SIZE = 15;

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setCurrentPage(1);
	}, [searchTerm, courseFilter, paymentFilter, statusFilter, tagFilter]);

	useEffect(() => {
		const inscripcionesRef = collection(db, "Inscripciones");
		const q = query(inscripcionesRef);

		const unsubscribe = onSnapshot(
			q,
			(snapshot) => {
				const data: InscriptionRow[] = [];

				snapshot.forEach((docSnap) => {
					const item = docSnap.data();

					let fechaFormateada = "Sin fecha";
					if (item.fecha) {
						if (typeof item.fecha.toDate === "function") {
							fechaFormateada = item.fecha
								.toDate()
								.toLocaleDateString("es-AR", {
									day: "2-digit",
									month: "2-digit",
									year: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								});
						} else if (typeof item.fecha === "string") {
							fechaFormateada = item.fecha;
						}
					}

					let formattedPromesa = undefined;
					if (item.fechaPromesaPago) {
						const [year, month, day] = item.fechaPromesaPago.split("-");
						formattedPromesa =
							day && month && year
								? `${day}/${month}/${year}`
								: item.fechaPromesaPago;
					}

					data.push({
						id: docSnap.id,
						fecha: fechaFormateada,
						alumnoNombre: item.alumnoNombre || "Sin nombre",
						alumnoDni: item.alumnoDni || "Sin DNI",
						cursoNombre: item.cursoNombre || "Sin curso",
						cursoInscripcion: item.cursoInscripcion || 0,
						status: item.status || "Pendiente",
						metodoPago: item.metodoPago || "No especificado",
						alumnoTipo:
							item.alumnoTipo === "adulto" || item.alumnoTipo === "menor"
								? (item.alumnoTipo as "adulto" | "menor")
								: item.tipoAlumno === "Titular"
									? "adulto"
									: "menor",
						fechaPromesaPago: formattedPromesa,
						alumnoId: item.alumnoId || "",
						cursoId: item.cursoId || "",
						cuota1a10: item.cuota1a10 || 0,
						cuota11enAdelante: item.cuota11enAdelante || 0,
						descuentoPorEtiqueta: item.descuentoPorEtiqueta || null,
						descuentoPorcentaje: item.descuentoPorcentaje || 0,
					});
				});

				setInscriptions(data.reverse());
				setIsLoading(false);
			},
			(error) => {
				console.error("Error trayendo inscripciones:", error);
				setIsLoading(false);
			},
		);

		return () => unsubscribe();
	}, []);

	const uniqueCourses = [
		"Todos",
		...Array.from(new Set(inscriptions.map((i) => i.cursoNombre))),
	];
	const PAYMENT_OPTIONS = [
		{ value: "Todos", label: "Pago (Todos)" },
		{ value: "Efectivo", label: "Efectivo" },
		{ value: "Transferencia", label: "Transferencia Bancaria" },
		{ value: "Tarjeta", label: "Tarjeta (Posnet)" },
		{ value: "multiple", label: "Pago Múltiple" },
	];
	const uniqueStatuses = ["Todos", "Confirmado", "Pendiente"];
	const uniqueTags = [
		"Todos",
		...Array.from(
			new Set(
				inscriptions
					.map((i) => i.descuentoPorEtiqueta)
					.filter((e): e is string => !!e),
			),
		),
	];

	const filteredInscriptions = useMemo(() => {
		return inscriptions.filter((item) => {
			const searchLower = searchTerm.toLowerCase();
			const matchesSearch =
				item.alumnoNombre.toLowerCase().includes(searchLower) ||
				item.alumnoDni.includes(searchLower) ||
				item.cursoNombre.toLowerCase().includes(searchLower);
			const matchesCourse =
				courseFilter === "Todos" || item.cursoNombre === courseFilter;
			const matchesPayment =
				paymentFilter === "Todos" ||
				(paymentFilter === "multiple"
					? item.metodoPago.includes("+")
					: paymentFilter === "Efectivo"
						? item.metodoPago.toLowerCase().includes("efectivo")
						: paymentFilter === "Transferencia"
							? item.metodoPago.toLowerCase().includes("transferencia")
							: paymentFilter === "Tarjeta"
								? item.metodoPago.toLowerCase().includes("tarjeta")
								: false);
			const matchesStatus =
				statusFilter === "Todos" || item.status === statusFilter;
			const matchesTag =
				tagFilter === "Todos" || item.descuentoPorEtiqueta === tagFilter;
			return (
				matchesSearch &&
				matchesCourse &&
				matchesPayment &&
				matchesStatus &&
				matchesTag
			);
		});
	}, [
		inscriptions,
		searchTerm,
		courseFilter,
		paymentFilter,
		statusFilter,
		tagFilter,
	]);

	const totalPages = Math.ceil(filteredInscriptions.length / PAGE_SIZE);
	const paginatedInscriptions = filteredInscriptions.slice(
		(currentPage - 1) * PAGE_SIZE,
		currentPage * PAGE_SIZE,
	);

	const getStatusBadge = (estado: InscriptionStatus) => {
		const styles: Record<string, string> = {
			Confirmado: "bg-green-100 text-green-800 border-green-200",
			Pendiente: "bg-yellow-100 text-yellow-800 border-yellow-200",
		};
		return styles[estado] || styles["Pendiente"];
	};

	const handleEditClick = (inscription: InscriptionRow) => {
		setInscriptionToEdit(inscription);
		setIsEditModalOpen(true);
	};

	const handleSaveInscription = async (
		id: string,
		nuevoEstado: InscriptionStatus,
		nuevoMonto: number,
		nuevoMetodoPago?: string | null,
		nuevaFechaPromesa?: string | null,
	) => {
		const inscription = inscriptions.find((i) => i.id === id);

		if (nuevoEstado === "Cancelado") {
			await deleteDoc(doc(db, "Inscripciones", id));

			if (inscription?.alumnoId && inscription?.cursoId) {
				const collectionName =
					inscription.alumnoTipo === "adulto" ? "Users" : "Hijos";
				await updateDoc(doc(db, collectionName, inscription.alumnoId), {
					cursos: arrayRemove(inscription.cursoId),
				});
			}
			return;
		}

		const docRef = doc(db, "Inscripciones", id);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const updateData: any = {
			status: nuevoEstado,
			cursoInscripcion: nuevoMonto,
		};
		if (nuevoMetodoPago) updateData.metodoPago = nuevoMetodoPago;
		if (nuevaFechaPromesa !== undefined)
			updateData.fechaPromesaPago = nuevaFechaPromesa;

		await updateDoc(docRef, updateData);
	};

	const handlePrint = () => {
		if (filteredInscriptions.length === 0) return;

		const formatMoney = (n: number) => `$${n.toLocaleString("es-AR")}`;

		const resumenFiltros = [
			searchTerm ? `Búsqueda: "${searchTerm}"` : null,
			courseFilter !== "Todos" ? `Curso: ${courseFilter}` : null,
			paymentFilter !== "Todos" ? `Pago: ${paymentFilter}` : null,
			statusFilter !== "Todos" ? `Estado: ${statusFilter}` : null,
			tagFilter !== "Todos" ? `Etiqueta: ${tagFilter}` : null,
		]
			.filter(Boolean)
			.join(" · ");

		const filas = filteredInscriptions
			.map((item) => {
				const estadoColor =
					item.status === "Confirmado" ? "#15803d" : "#d97706";

				const iniciales = item.descuentoPorEtiqueta
					? item.descuentoPorEtiqueta
							.split(" ")
							.filter(Boolean)
							.map((p: string) => p[0].toUpperCase())
							.join("")
					: "";

				const etiquetaHtml = item.descuentoPorEtiqueta
					? `<span style="font-size:10px;background:#f3e8ff;color:#7e22ce;padding:2px 5px;border-radius:4px;font-weight:700;display:inline-block;">
						${iniciales} · ${item.descuentoPorcentaje}% off
					</span>`
					: "";

				const promesaHtml =
					item.status === "Pendiente" && item.fechaPromesaPago
						? `<div style="font-size:11px;color:#9ca3af;margin-top:2px;">Pago prometido: ${item.fechaPromesaPago}</div>`
						: "";

				return `
      <tr>
        <td>${item.fecha.split(",")[0]}</td>
        <td>
					<strong>${item.alumnoNombre}</strong>
					${etiquetaHtml ? `<div style="margin-top:3px;">${etiquetaHtml}</div>` : ""}
					<div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:600;margin-top:3px;">
						${item.alumnoTipo ?? ""}
					</div>
				</td>
        <td style="font-family:monospace;">${item.alumnoDni}</td>
        <td>${item.cursoNombre}</td>
        <td>${item.metodoPago}</td>
        <td><strong>${formatMoney(item.cursoInscripcion)}</strong></td>
        <td>
          <span style="color:${estadoColor};font-weight:700;">${item.status}</span>
          ${promesaHtml}
        </td>
      </tr>`;
			})
			.join("");

		const totalConfirmado = filteredInscriptions
			.filter((i) => i.status === "Confirmado")
			.reduce((acc, i) => acc + i.cursoInscripcion, 0);

		const totalPendiente = filteredInscriptions
			.filter((i) => i.status === "Pendiente")
			.reduce((acc, i) => acc + i.cursoInscripcion, 0);

		const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Inscripciones – English Empire</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 28px 32px; }

        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #252d62; padding-bottom: 14px; }
        .header-left h1 { font-size: 20px; color: #252d62; font-weight: 800; }
        .header-left p { font-size: 12px; color: #6b7280; margin-top: 3px; }
        .header-right { text-align: right; font-size: 11px; color: #6b7280; }

        .titulo { font-size: 15px; font-weight: 700; color: #252d62; margin-bottom: 6px; }
        .filtros { font-size: 11px; color: #6b7280; margin-bottom: 16px; min-height: 14px; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        thead { background: #f3f4f6; }
        th { padding: 9px 10px; text-align: left; font-size: 11px; color: #374151; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e5e7eb; }
        td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
        tr:last-child td { border-bottom: none; }

        .resumen { display: flex; gap: 24px; justify-content: flex-end; border-top: 1px solid #e5e7eb; padding-top: 14px; }
        .resumen-item { text-align: right; }
        .resumen-item .label { font-size: 11px; color: #6b7280; }
        .resumen-item .valor { font-size: 15px; font-weight: 800; }
        .verde { color: #15803d; }
        .amarillo { color: #d97706; }
        .azul { color: #252d62; }

        .footer { margin-top: 28px; font-size: 10px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }

        @media print {
          body { padding: 12px 16px; }
          @page { margin: 1.2cm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <h1>English Empire Institute</h1>
          <p>Panel de administración · Inscripciones</p>
        </div>
        <div class="header-right">
          <div>Impreso: ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}</div>
          <div>${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>

      <div class="titulo">Listado de Inscripciones</div>
      <div class="filtros">
        ${resumenFiltros || "Sin filtros adicionales aplicados"} · ${filteredInscriptions.length} registro${filteredInscriptions.length !== 1 ? "s" : ""}
      </div>

      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Alumno</th>
            <th>DNI</th>
            <th>Curso</th>
            <th>Método de Pago</th>
            <th>Monto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>

      <div class="resumen">
        <div class="resumen-item">
          <div class="label">Total confirmado</div>
          <div class="valor verde">${formatMoney(totalConfirmado)}</div>
        </div>
        <div class="resumen-item">
          <div class="label">Total pendiente</div>
          <div class="valor amarillo">${formatMoney(totalPendiente)}</div>
        </div>
        <div class="resumen-item">
          <div class="label">Total general</div>
          <div class="valor azul">${formatMoney(totalConfirmado + totalPendiente)}</div>
        </div>
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

	const canEdit = (status: InscriptionStatus) => status === "Pendiente";

	return (
		<>
			<div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col max-h-screen">
				{showTitle && (
					<div className="p-4 sm:p-6 border-b border-gray-100 shrink-0">
						<h2 className="text-lg sm:text-xl font-bold text-[#252d62]">
							Inscripciones Recientes
						</h2>
					</div>
				)}

				{/* FILTROS */}
				<div className="p-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
					<div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
						<div className="relative w-full xl:w-96 group">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<Search className="h-4 w-4 text-gray-400 group-focus-within:text-[#252d62] transition-colors" />
							</div>
							<input
								type="text"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="text-black block w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] sm:text-sm transition-all"
								placeholder="Buscar alumno, DNI o curso..."
							/>
							{searchTerm && (
								<button
									onClick={() => setSearchTerm("")}
									className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
								>
									<X className="h-4 w-4" />
								</button>
							)}
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-4 xl:flex gap-3 w-full xl:w-auto">
							<div className="relative w-full">
								<select
									value={tagFilter}
									onChange={(e) => setTagFilter(e.target.value)}
									className="appearance-none w-full bg-white border border-gray-200 text-gray-700 py-2 pl-9 pr-8 rounded-md focus:outline-none focus:border-[#252d62] focus:ring-2 focus:ring-[#252d62]/20 text-sm font-medium cursor-pointer hover:border-[#252d62] transition-colors"
								>
									{uniqueTags.map((t) => (
										<option key={t} value={t}>
											{t === "Todos" ? "Etiquetas (Todas)" : t}
										</option>
									))}
								</select>
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
									<Tag className="h-3.5 w-3.5" />
								</div>
								<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
									<ChevronDown className="h-4 w-4" />
								</div>
							</div>
							<div className="relative w-full">
								<select
									value={courseFilter}
									onChange={(e) => setCourseFilter(e.target.value)}
									className="appearance-none w-full bg-white border border-gray-200 text-gray-700 py-2 pl-9 pr-8 rounded-md focus:outline-none focus:border-[#252d62] focus:ring-2 focus:ring-[#252d62]/20 text-sm font-medium cursor-pointer hover:border-[#252d62] transition-colors"
								>
									{uniqueCourses.map((c) => (
										<option key={c} value={c}>
											{c === "Todos" ? "Cursos (Todos)" : c}
										</option>
									))}
								</select>
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
									<Filter className="h-3.5 w-3.5" />
								</div>
								<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
									<ChevronDown className="h-4 w-4" />
								</div>
							</div>

							<div className="relative w-full">
								<select
									value={paymentFilter}
									onChange={(e) => setPaymentFilter(e.target.value)}
									className="appearance-none w-full bg-white border border-gray-200 text-gray-700 py-2 pl-9 pr-8 rounded-md focus:outline-none focus:border-[#252d62] focus:ring-2 focus:ring-[#252d62]/20 text-sm font-medium cursor-pointer hover:border-[#252d62] transition-colors"
								>
									{PAYMENT_OPTIONS.map((p) => (
										<option key={p.value} value={p.value}>
											{p.label}
										</option>
									))}
								</select>
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
									<Filter className="h-3.5 w-3.5" />
								</div>
								<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
									<ChevronDown className="h-4 w-4" />
								</div>
							</div>

							<div className="relative w-full">
								<select
									value={statusFilter}
									onChange={(e) => setStatusFilter(e.target.value)}
									className="appearance-none w-full bg-white border border-gray-200 text-gray-700 py-2 pl-9 pr-8 rounded-md focus:outline-none focus:border-[#252d62] focus:ring-2 focus:ring-[#252d62]/20 text-sm font-medium cursor-pointer hover:border-[#252d62] transition-colors"
								>
									{uniqueStatuses.map((s) => (
										<option key={s} value={s}>
											{s === "Todos" ? "Estados (Todos)" : s}
										</option>
									))}
								</select>
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
									<Filter className="h-3.5 w-3.5" />
								</div>
								<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
									<ChevronDown className="h-4 w-4" />
								</div>
							</div>

							<button
								onClick={handlePrint}
								disabled={filteredInscriptions.length === 0}
								className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-gray-200 bg-white text-gray-600 text-sm font-semibold hover:border-[#252d62] hover:text-[#252d62] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
							>
								<Printer className="w-4 h-4" />
								Imprimir
							</button>
						</div>
					</div>
				</div>

				{/* CONTENIDO */}
				<div className="flex-1 overflow-hidden flex flex-col">
					{isLoading ? (
						<div className="flex flex-col justify-center items-center h-full min-h-[300px] gap-4">
							<Loader2 className="w-10 h-10 animate-spin text-[#EE1120]" />
							<p className="text-gray-500 font-medium">
								Cargando inscripciones...
							</p>
						</div>
					) : (
						<div className="overflow-auto h-full w-full">
							{/* MÓVIL */}
							<div className="md:hidden flex flex-col p-4 gap-4 bg-gray-50/30">
								{paginatedInscriptions.map((item, index) => (
									<motion.div
										key={`mobile-${item.id}`}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.2, delay: index * 0.05 }}
										className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 relative"
									>
										<div className="absolute top-4 right-4">
											{canEdit(item.status as InscriptionStatus) ? (
												<button
													onClick={() => handleEditClick(item)}
													className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
												>
													<Pencil className="w-4 h-4" />
												</button>
											) : (
												<span className="p-2 text-gray-200 rounded-full cursor-not-allowed inline-flex">
													<Lock className="w-4 h-4" />
												</span>
											)}
										</div>

										<div className="flex items-center gap-3 mb-3 border-b border-gray-100 pb-3 pr-12">
											<div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-[#252d62] font-bold text-sm shrink-0">
												{item.alumnoNombre.charAt(0).toUpperCase()}
											</div>
											<div>
												{/* NUEVO MÓVIL: Etiqueta al lado del nombre */}
												<h3 className="font-bold text-[#252d62] text-base leading-tight flex items-center gap-2 flex-wrap">
													{item.alumnoNombre}
													{item.descuentoPorEtiqueta && (
														<EtiquetaBadge
															nombre={item.descuentoPorEtiqueta}
															porcentaje={item.descuentoPorcentaje || 0}
														/>
													)}
												</h3>
												<div className="flex items-center gap-2 mt-0.5">
													<span className="text-xs text-gray-500 font-mono">
														{item.alumnoDni}
													</span>
													<span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase font-semibold">
														{item.tipoAlumno}
													</span>
												</div>
											</div>
										</div>

										<div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
											<div className="flex flex-col">
												<span className="text-xs text-gray-400 flex items-center gap-1">
													<Book className="w-3 h-3" /> Curso
												</span>
												<span className="font-bold text-[#252d62]">
													{item.cursoNombre}
												</span>
											</div>
											<div className="flex flex-col">
												<span className="text-xs text-gray-400 flex items-center gap-1">
													<CreditCardIcon className="w-3 h-3" /> Monto
												</span>
												<span className="font-bold text-gray-900">
													${item.cursoInscripcion.toLocaleString("es-AR")}
												</span>
											</div>
											<div className="flex flex-col">
												<span className="text-xs text-gray-400 flex items-center gap-1">
													<Calendar className="w-3 h-3" /> Fecha
												</span>
												<span className="font-medium text-gray-600">
													{item.fecha.split(",")[0]}
												</span>
											</div>
											<div className="flex flex-col">
												<span className="text-xs text-gray-400 mb-1">
													Estado
												</span>
												<span
													className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border w-fit ${getStatusBadge(item.status as InscriptionStatus)}`}
												>
													{item.status}
												</span>
											</div>
										</div>
									</motion.div>
								))}
							</div>

							{/* DESKTOP */}
							<div className="hidden md:block w-full">
								<table className="min-w-full divide-y divide-gray-200">
									<thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
										<tr>
											<th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Fecha
											</th>
											<th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Alumno
											</th>
											<th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												DNI
											</th>
											<th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Curso
											</th>
											<th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Método
											</th>
											<th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Monto
											</th>
											<th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Estado
											</th>
											<th className="px-4 lg:px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
												Acciones
											</th>
										</tr>
									</thead>
									<tbody className="bg-white divide-y divide-gray-100">
										{paginatedInscriptions.map((item, index) => (
											<motion.tr
												key={item.id}
												initial={{ opacity: 0, y: 10 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{ duration: 0.2, delay: index * 0.02 }}
												className="hover:bg-blue-50/50 transition-colors duration-150"
											>
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
													{item.fecha.split(",")[0]}
												</td>
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap">
													<div className="flex items-center">
														<div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-[#252d62] font-bold text-xs mr-3 shrink-0">
															{item.alumnoNombre.charAt(0).toUpperCase()}
														</div>
														<div className="flex flex-col">
															{/* NUEVO DESKTOP: Etiqueta al lado del nombre */}
															<span className="text-sm font-bold text-[#252d62] flex items-center gap-2">
																{item.alumnoNombre}
																{item.descuentoPorEtiqueta && (
																	<EtiquetaBadge
																		nombre={item.descuentoPorEtiqueta}
																		porcentaje={item.descuentoPorcentaje || 0}
																	/>
																)}
															</span>
															<span className="text-[10px] text-gray-400 uppercase font-semibold">
																{item.tipoAlumno}
															</span>
														</div>
													</div>
												</td>
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
													{item.alumnoDni}
												</td>
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-[#252d62] font-bold">
													{item.cursoNombre}
												</td>
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
													{item.metodoPago}
												</td>
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
													${item.cursoInscripcion.toLocaleString("es-AR")}
												</td>
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap">
													<div className="flex flex-col items-start gap-1">
														<span
															className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadge(item.status as InscriptionStatus)}`}
														>
															{item.status}
														</span>
														{item.status === "Pendiente" &&
															item.fechaPromesaPago && (
																<span className="text-[10px] text-gray-500 font-medium pl-1">
																	Pago: {item.fechaPromesaPago}
																</span>
															)}
													</div>
												</td>
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right">
													{canEdit(item.status as InscriptionStatus) ? (
														<button
															onClick={() => handleEditClick(item)}
															className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
														>
															<Pencil className="w-4 h-4" />
														</button>
													) : (
														<span className="p-1.5 text-gray-200 rounded-lg cursor-not-allowed inline-flex">
															<Lock className="w-4 h-4" />
														</span>
													)}
												</td>
											</motion.tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{!isLoading && filteredInscriptions.length === 0 && (
						<div className="p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[300px] w-full">
							<Search className="h-10 w-10 text-gray-300 mb-3" />
							<p className="text-lg font-bold text-[#252d62]">
								No se encontraron inscripciones
							</p>
							<p className="text-sm mt-1 text-gray-500">
								Ajusta tus filtros de búsqueda.
							</p>
						</div>
					)}

					{!isLoading && totalPages > 1 && (
						<div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white shrink-0">
							<p className="text-sm text-gray-500">
								Mostrando{" "}
								<span className="font-semibold text-gray-700">
									{(currentPage - 1) * PAGE_SIZE + 1}–
									{Math.min(
										currentPage * PAGE_SIZE,
										filteredInscriptions.length,
									)}
								</span>{" "}
								de{" "}
								<span className="font-semibold text-gray-700">
									{filteredInscriptions.length}
								</span>{" "}
								inscripciones
							</p>

							<div className="flex items-center gap-1">
								<button
									onClick={() => setCurrentPage(1)}
									disabled={currentPage === 1}
									className="px-2 py-1.5 text-xs rounded-md border border-gray-200 text-gray-500 hover:border-[#252d62] hover:text-[#252d62] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
								>
									«
								</button>
								<button
									onClick={() => setCurrentPage((p) => p - 1)}
									disabled={currentPage === 1}
									className="px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-500 hover:border-[#252d62] hover:text-[#252d62] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
								>
									Anterior
								</button>

								{Array.from({ length: totalPages }, (_, i) => i + 1)
									.filter(
										(p) =>
											p === 1 ||
											p === totalPages ||
											Math.abs(p - currentPage) <= 1,
									)
									.reduce<(number | "...")[]>((acc, p, i, arr) => {
										if (i > 0 && p - (arr[i - 1] as number) > 1)
											acc.push("...");
										acc.push(p);
										return acc;
									}, [])
									.map((p, i) =>
										p === "..." ? (
											<span
												key={`ellipsis-${i}`}
												className="px-2 py-1.5 text-xs text-gray-400"
											>
												...
											</span>
										) : (
											<button
												key={p}
												onClick={() => setCurrentPage(p as number)}
												className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
													currentPage === p
														? "bg-[#252d62] text-white border-[#252d62]"
														: "border-gray-200 text-gray-500 hover:border-[#252d62] hover:text-[#252d62]"
												}`}
											>
												{p}
											</button>
										),
									)}

								<button
									onClick={() => setCurrentPage((p) => p + 1)}
									disabled={currentPage === totalPages}
									className="px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-500 hover:border-[#252d62] hover:text-[#252d62] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
								>
									Siguiente
								</button>
								<button
									onClick={() => setCurrentPage(totalPages)}
									disabled={currentPage === totalPages}
									className="px-2 py-1.5 text-xs rounded-md border border-gray-200 text-gray-500 hover:border-[#252d62] hover:text-[#252d62] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
								>
									»
								</button>
							</div>
						</div>
					)}
				</div>
			</div>

			<EditInscriptionModal
				isOpen={isEditModalOpen}
				onClose={() => setIsEditModalOpen(false)}
				inscriptionToEdit={inscriptionToEdit}
				onSave={handleSaveInscription}
			/>
		</>
	);
};

export default InscriptionsTable;
