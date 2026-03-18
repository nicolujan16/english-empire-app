"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
	collection,
	query,
	where,
	getDocs,
	orderBy,
	Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import {
	Loader2,
	Receipt,
	Clock,
	CheckCircle2,
	AlertTriangle,
	FileText,
	ChevronLeft,
	GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudentDetails } from "@/types";
import PagarCuotaModal from "@/components/website/cuotas/PagarCuotaModal";
import ComprobanteCuotaModal from "@/components/website/cuotas/ComprobanteCuotaModal";
import ComprobanteInscripcionModal from "@/components/website/pagos/ComprobanteInscripcionModal";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Cuota {
	id: string;
	alumnoId: string;
	alumnoDni: string;
	alumnoNombre: string;
	alumnoTipo: "adulto" | "menor";
	cursoId: string;
	cursoNombre: string;
	mes: number;
	anio: number;
	estado: "Pendiente" | "Pagado";
	esPrimerMes: boolean;
	montoPrimerMes: number | null;
	cuota1a10: number;
	cuota11enAdelante: number;
	montoPagado: number | null;
	fechaPago: string | null;
	metodoPago: string | null;
	inscripcionId: string;
}

interface Inscripcion {
	id: string;
	alumnoId: string;
	alumnoNombre: string;
	alumnoDni: string;
	tipoAlumno: "Titular" | "Menor/A cargo";
	cursoId: string;
	cursoNombre: string;
	cursoInscripcion: number;
	fecha: Timestamp;
	metodoPago: string;
	paymentId: string;
	status: "Confirmado" | "Pendiente";
}

type FiltroEstado = "todas" | "pendientes" | "pagadas";
type TabVista = "cuotas" | "inscripciones";

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

function calcularMontoPendiente(cuota: Cuota): number {
	const hoy = new Date();
	const esElMesActual =
		cuota.mes === hoy.getMonth() + 1 && cuota.anio === hoy.getFullYear();
	if (cuota.esPrimerMes && cuota.montoPrimerMes) return cuota.montoPrimerMes;
	if (esElMesActual && hoy.getDate() <= 10) return cuota.cuota1a10;
	return cuota.cuota11enAdelante;
}

function formatearFecha(timestamp: Timestamp): string {
	if (!timestamp?.toDate) return "-";
	return timestamp.toDate().toLocaleDateString("es-AR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

// ─── Badges compartidos ───────────────────────────────────────────────────────

function TitularBadge({ tipo, nombre }: { tipo: string; nombre: string }) {
	const esAdulto = tipo === "adulto" || tipo === "Titular";
	return (
		<span
			className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full ${
				esAdulto
					? "bg-purple-100 text-purple-700"
					: "bg-orange-100 text-orange-700"
			}`}
		>
			{esAdulto ? "Vos" : nombre}
		</span>
	);
}

// ─── Card de Cuota ────────────────────────────────────────────────────────────

function CuotaCard({
	cuota,
	onPagar,
	onVerComprobante,
}: {
	cuota: Cuota;
	onPagar: (c: Cuota) => void;
	onVerComprobante: (c: Cuota) => void;
}) {
	const isPagada = cuota.estado === "Pagado";
	const montoPendiente = calcularMontoPendiente(cuota);
	const isAtrasada =
		!isPagada &&
		(cuota.mes < new Date().getMonth() + 1 ||
			cuota.anio < new Date().getFullYear());

	return (
		<div
			className={`bg-white rounded-xl border p-5 transition-all hover:shadow-md ${
				isAtrasada
					? "border-red-200 bg-red-50/30"
					: isPagada
						? "border-gray-100"
						: "border-yellow-200 bg-yellow-50/20"
			}`}
		>
			<div className="flex items-start justify-between gap-3 mb-4">
				<div className="flex-1 min-w-0">
					<p className="font-bold text-[#252d62] text-base truncate">
						{cuota.cursoNombre}
					</p>
					<p className="text-sm text-gray-500 mt-0.5">
						{MESES[cuota.mes - 1]} {cuota.anio}
					</p>
				</div>
				<div className="flex flex-col items-end gap-1.5 flex-shrink-0">
					<span
						className={`inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-bold ${
							isPagada
								? "bg-green-100 text-green-800"
								: "bg-yellow-100 text-yellow-800"
						}`}
					>
						{isPagada ? (
							<CheckCircle2 className="w-3.5 h-3.5" />
						) : (
							<Clock className="w-3.5 h-3.5" />
						)}
						{isPagada ? "Pagado" : "Pendiente"}
					</span>
					{isAtrasada && (
						<span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
							<AlertTriangle className="w-3 h-3" />
							Atrasada
						</span>
					)}
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3 text-sm mb-4">
				<div>
					<p className="text-gray-500 text-xs mb-0.5">Alumno</p>
					<TitularBadge tipo={cuota.alumnoTipo} nombre={cuota.alumnoNombre} />
				</div>
				<div>
					<p className="text-gray-500 text-xs mb-0.5">
						{isPagada ? "Monto pagado" : "Monto a pagar"}
					</p>
					<p className="font-bold text-gray-900">
						$
						{(isPagada ? cuota.montoPagado : montoPendiente)?.toLocaleString(
							"es-AR",
						) ?? "-"}
					</p>
				</div>
				{isPagada && cuota.fechaPago && (
					<div>
						<p className="text-gray-500 text-xs mb-0.5">Fecha de pago</p>
						<p className="font-medium text-gray-700 text-xs">
							{cuota.fechaPago}
						</p>
					</div>
				)}
				{isPagada && cuota.metodoPago && (
					<div>
						<p className="text-gray-500 text-xs mb-0.5">Método</p>
						<p className="font-medium text-gray-700 text-xs">
							{cuota.metodoPago}
						</p>
					</div>
				)}
			</div>

			<div className="flex gap-2 pt-3 border-t border-gray-100">
				{isPagada ? (
					<Button
						size="sm"
						variant="outline"
						className="flex items-center gap-1.5 text-xs text-[#252d62] border-[#252d62] hover:bg-[#252d62] hover:text-white transition-all w-full"
						onClick={() => onVerComprobante(cuota)}
					>
						<FileText className="w-3.5 h-3.5" />
						Ver comprobante
					</Button>
				) : (
					<Button
						size="sm"
						className="flex items-center gap-1.5 text-xs bg-white border border-[#EE1120] text-[#EE1120] hover:bg-[#EE1120] hover:text-white transition-colors w-full"
						onClick={() => onPagar(cuota)}
					>
						Pagar cuota
					</Button>
				)}
			</div>
		</div>
	);
}

// ─── Card de Inscripción ──────────────────────────────────────────────────────

function InscripcionCard({
	inscripcion,
	onVerComprobante, // ✅ NUEVO
}: {
	inscripcion: Inscripcion;
	onVerComprobante: (i: Inscripcion) => void; // ✅ NUEVO
}) {
	const isConfirmada = inscripcion.status === "Confirmado";

	return (
		<div
			className={`bg-white rounded-xl border p-5 transition-all hover:shadow-md ${
				isConfirmada ? "border-gray-100" : "border-yellow-200 bg-yellow-50/20"
			}`}
		>
			<div className="flex items-start justify-between gap-3 mb-4">
				<div className="flex-1 min-w-0">
					<p className="font-bold text-[#252d62] text-base truncate">
						{inscripcion.cursoNombre}
					</p>
					<p className="text-sm text-gray-500 mt-0.5">Inscripción</p>
				</div>
				<span
					className={`inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-bold flex-shrink-0 ${
						isConfirmada
							? "bg-green-100 text-green-800"
							: "bg-yellow-100 text-yellow-800"
					}`}
				>
					{isConfirmada ? (
						<>
							<CheckCircle2 className="w-3.5 h-3.5" /> Confirmada
						</>
					) : (
						<>
							<Clock className="w-3.5 h-3.5" /> Pendiente
						</>
					)}
				</span>
			</div>

			<div className="grid grid-cols-2 gap-3 text-sm mb-4">
				<div>
					<p className="text-gray-500 text-xs mb-0.5">Alumno</p>
					<TitularBadge
						tipo={inscripcion.tipoAlumno}
						nombre={inscripcion.alumnoNombre}
					/>
				</div>
				<div>
					<p className="text-gray-500 text-xs mb-0.5">Monto pagado</p>
					<p className="font-bold text-gray-900">
						${inscripcion.cursoInscripcion?.toLocaleString("es-AR") ?? "-"}
					</p>
				</div>
				<div>
					<p className="text-gray-500 text-xs mb-0.5">Fecha</p>
					<p className="font-medium text-gray-700 text-xs">
						{formatearFecha(inscripcion.fecha)}
					</p>
				</div>
				<div>
					<p className="text-gray-500 text-xs mb-0.5">Método</p>
					<p className="font-medium text-gray-700 text-xs">
						{inscripcion.metodoPago}
					</p>
				</div>
			</div>

			{isConfirmada && (
				<div className="pt-3 border-t border-gray-100">
					<Button
						size="sm"
						variant="outline"
						className="flex items-center gap-1.5 text-xs text-[#252d62] border-[#252d62] hover:bg-[#252d62] hover:text-white transition-all w-full"
						onClick={() => onVerComprobante(inscripcion)} // ✅ CONECTADO
					>
						<FileText className="w-3.5 h-3.5" />
						Ver comprobante
					</Button>
				</div>
			)}
		</div>
	);
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PagosPage() {
	const router = useRouter();
	const { user, userData, isLoading: authLoading } = useAuth();

	const [tab, setTab] = useState<TabVista>("cuotas");
	const [cuotaAPagar, setCuotaAPagar] = useState<Cuota | null>(null);
	const [cuotaComprobante, setCuotaComprobante] = useState<Cuota | null>(null);
	const [inscripcionComprobante, setInscripcionComprobante] =
		useState<Inscripcion | null>(null); // ✅ NUEVO

	const [cuotas, setCuotas] = useState<Cuota[]>([]);
	const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [filtroCuotas, setFiltroCuotas] = useState<FiltroEstado>("todas");

	useEffect(() => {
		if (!authLoading && !user) router.push("/iniciar-sesion");
	}, [user, authLoading, router]);

	useEffect(() => {
		const fetchTodo = async () => {
			if (!user || !userData) return;
			setIsLoading(true);

			const alumnoIds: string[] = [user.uid];
			userData.hijos?.forEach((hijo: StudentDetails) => {
				if (hijo.id) alumnoIds.push(String(hijo.id));
			});

			try {
				const cuotasSnaps = await Promise.all(
					alumnoIds.map((alumnoId) =>
						getDocs(
							query(
								collection(db, "Cuotas"),
								where("alumnoId", "==", alumnoId),
								orderBy("anio", "desc"),
								orderBy("mes", "desc"),
							),
						),
					),
				);

				const todasLasCuotas: Cuota[] = cuotasSnaps
					.flatMap((snap) =>
						snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Cuota),
					)
					.sort((a, b) =>
						a.anio !== b.anio ? b.anio - a.anio : b.mes - a.mes,
					);

				setCuotas(todasLasCuotas);

				const inscripcionesSnaps = await Promise.all(
					alumnoIds.map((alumnoId) =>
						getDocs(
							query(
								collection(db, "Inscripciones"),
								where("alumnoId", "==", alumnoId),
							),
						),
					),
				);

				const todasLasInscripciones: Inscripcion[] = inscripcionesSnaps
					.flatMap((snap) =>
						snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Inscripcion),
					)
					.sort((a, b) => {
						const fechaA = a.fecha?.toDate?.()?.getTime() ?? 0;
						const fechaB = b.fecha?.toDate?.()?.getTime() ?? 0;
						return fechaB - fechaA;
					});

				setInscripciones(todasLasInscripciones);
			} catch (error) {
				console.error("Error al cargar pagos:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchTodo();
	}, [user, userData]);

	const cuotasFiltradas = cuotas.filter((c) => {
		if (filtroCuotas === "pendientes") return c.estado === "Pendiente";
		if (filtroCuotas === "pagadas") return c.estado === "Pagado";
		return true;
	});

	const countPendientes = cuotas.filter((c) => c.estado === "Pendiente").length;
	const countPagadas = cuotas.filter((c) => c.estado === "Pagado").length;
	const countAtrasadas = cuotas.filter(
		(c) =>
			c.estado === "Pendiente" &&
			(c.mes < new Date().getMonth() + 1 || c.anio < new Date().getFullYear()),
	).length;

	if (authLoading || isLoading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
				<Loader2 className="w-10 h-10 animate-spin text-[#EE1120]" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8">
			<div className="max-w-7xl mx-auto px-4 md:px-6 space-y-6">
				{/* Header */}
				<div>
					<button
						onClick={() => router.push("/mi-cuenta")}
						className="flex items-center gap-1.5 text-sm text-[#252d62] transition-colors mb-3 group cursor-pointer"
					>
						<ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
						Volver al panel de usuario
					</button>
					<h1 className="text-3xl md:text-4xl font-bold text-[#1a237e] mb-1">
						Mis Pagos
					</h1>
					<p className="text-gray-600">
						Historial de cuotas e inscripciones de todos los alumnos a tu cargo
					</p>
				</div>

				{/* Tabs */}
				<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 flex gap-1 w-full md:w-fit">
					<button
						onClick={() => setTab("cuotas")}
						className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
							tab === "cuotas"
								? "bg-[#252d62] text-white shadow-sm"
								: "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
						}`}
					>
						<Receipt className="w-4 h-4" />
						Cuotas ({cuotas.length})
					</button>
					<button
						onClick={() => setTab("inscripciones")}
						className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
							tab === "inscripciones"
								? "bg-[#252d62] text-white shadow-sm"
								: "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
						}`}
					>
						<GraduationCap className="w-4 h-4" />
						Inscripciones ({inscripciones.length})
					</button>
				</div>

				{/* ── TAB CUOTAS ── */}
				{tab === "cuotas" && (
					<>
						<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
							<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
								<div className="bg-yellow-100 p-3 rounded-full">
									<Clock className="w-5 h-5 text-yellow-700" />
								</div>
								<div>
									<p className="text-2xl font-bold text-gray-900">
										{countPendientes}
									</p>
									<p className="text-xs text-gray-500">Pendientes</p>
								</div>
							</div>
							<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
								<div className="bg-green-100 p-3 rounded-full">
									<CheckCircle2 className="w-5 h-5 text-green-700" />
								</div>
								<div>
									<p className="text-2xl font-bold text-gray-900">
										{countPagadas}
									</p>
									<p className="text-xs text-gray-500">Pagadas</p>
								</div>
							</div>
							<div className="bg-white rounded-xl border border-red-100 shadow-sm p-4 flex items-center gap-4 col-span-2 md:col-span-1">
								<div className="bg-red-100 p-3 rounded-full">
									<AlertTriangle className="w-5 h-5 text-red-600" />
								</div>
								<div>
									<p className="text-2xl font-bold text-gray-900">
										{countAtrasadas}
									</p>
									<p className="text-xs text-gray-500">Atrasadas</p>
								</div>
							</div>
						</div>

						<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 flex gap-1 w-full md:w-fit">
							{(["todas", "pendientes", "pagadas"] as FiltroEstado[]).map(
								(f) => (
									<button
										key={f}
										onClick={() => setFiltroCuotas(f)}
										className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
											filtroCuotas === f
												? "bg-[#252d62] text-white shadow-sm"
												: "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
										}`}
									>
										{f === "todas"
											? `Todas (${cuotas.length})`
											: f === "pendientes"
												? `Pendientes (${countPendientes})`
												: `Pagadas (${countPagadas})`}
									</button>
								),
							)}
						</div>

						{cuotasFiltradas.length === 0 ? (
							<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 flex flex-col items-center justify-center text-center">
								<div className="bg-gray-100 p-4 rounded-full mb-4">
									<Receipt className="w-8 h-8 text-gray-400" />
								</div>
								<h3 className="text-lg font-bold text-gray-900 mb-1">
									No hay cuotas para mostrar
								</h3>
								<p className="text-gray-500 text-sm">
									{filtroCuotas === "pendientes"
										? "¡Estás al día con todos tus pagos!"
										: filtroCuotas === "pagadas"
											? "Todavía no tenés cuotas pagadas."
											: "No tenés cuotas registradas."}
								</p>
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
								{cuotasFiltradas.map((cuota) => (
									<CuotaCard
										key={cuota.id}
										cuota={cuota}
										onPagar={setCuotaAPagar}
										onVerComprobante={setCuotaComprobante}
									/>
								))}
							</div>
						)}
					</>
				)}

				{/* ── TAB INSCRIPCIONES ── */}
				{tab === "inscripciones" && (
					<>
						{inscripciones.length === 0 ? (
							<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 flex flex-col items-center justify-center text-center">
								<div className="bg-gray-100 p-4 rounded-full mb-4">
									<GraduationCap className="w-8 h-8 text-gray-400" />
								</div>
								<h3 className="text-lg font-bold text-gray-900 mb-1">
									No hay inscripciones para mostrar
								</h3>
								<p className="text-gray-500 text-sm">
									Todavía no tenés inscripciones registradas.
								</p>
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
								{inscripciones.map((inscripcion) => (
									<InscripcionCard
										key={inscripcion.id}
										inscripcion={inscripcion}
										onVerComprobante={setInscripcionComprobante} // ✅ CONECTADO
									/>
								))}
							</div>
						)}
					</>
				)}
			</div>

			<PagarCuotaModal
				cuota={cuotaAPagar}
				isOpen={!!cuotaAPagar}
				onClose={() => setCuotaAPagar(null)}
			/>

			<ComprobanteCuotaModal
				cuota={cuotaComprobante}
				isOpen={!!cuotaComprobante}
				onClose={() => setCuotaComprobante(null)}
			/>

			{/* ✅ NUEVO */}
			<ComprobanteInscripcionModal
				inscripcion={inscripcionComprobante}
				isOpen={!!inscripcionComprobante}
				onClose={() => setInscripcionComprobante(null)}
			/>
		</div>
	);
}
