"use client";

import React, { useState, useEffect } from "react";
import {
	X,
	AlertCircle,
	CheckCircle,
	Loader2,
	Search,
	User,
	BookOpen,
	CreditCard,
	DollarSign,
	CalendarDays,
	ChevronRight,
	AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	collection,
	getDocs,
	query,
	where,
	updateDoc,
	doc,
	serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

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

// Info del alumno extraída de las cuotas (ya está denormalizada)
interface AlumnoInfo {
	id: string;
	nombre: string;
	tipo: "adulto" | "menor";
	dni: string;
	// Mapa de cursoId → nombre de curso (para el selector)
	cursos: Record<string, string>;
}

// ── Misma firma que antes, sin cambios ───────────────────────────────────────
interface RegistrarPagoModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	preloadedDni?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

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

function formatMes(mes: number, anio: number): string {
	return `${MESES[mes - 1]} ${anio}`;
}

function resolverMontoCobro(cuota: CuotaDoc): number {
	if (cuota.esPrimerMes && cuota.montoPrimerMes !== null) {
		return cuota.montoPrimerMes;
	}
	const dia = new Date().getDate();
	return dia <= 10 ? cuota.cuota1a10 : cuota.cuota11enAdelante;
}

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("es-AR", {
		style: "currency",
		currency: "ARS",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
}

function sortCuotasAsc(cuotas: CuotaDoc[]): CuotaDoc[] {
	return [...cuotas].sort((a, b) =>
		a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes,
	);
}

function mapDocToCuota(d: {
	id: string;
	data: () => Record<string, unknown>;
}): CuotaDoc {
	const data = d.data();
	return {
		id: d.id,
		alumnoId: data.alumnoId as string,
		alumnoTipo: data.alumnoTipo as "adulto" | "menor",
		alumnoNombre: data.alumnoNombre as string,
		alumnoDni: data.alumnoDni as string,
		cursoId: data.cursoId as string,
		cursoNombre: data.cursoNombre as string,
		mes: data.mes as number,
		anio: data.anio as number,
		cuota1a10: (data.cuota1a10 as number) ?? 0,
		cuota11enAdelante: (data.cuota11enAdelante as number) ?? 0,
		esPrimerMes: (data.esPrimerMes as boolean) ?? false,
		montoPrimerMes: (data.montoPrimerMes as number | null) ?? null,
		estado: (data.estado as "Pendiente" | "Pagado" | "Eximido") ?? "Pendiente",
		montoPagado: (data.montoPagado as number | null) ?? null,
		metodoPago: (data.metodoPago as string | null) ?? null,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────────────────────

export default function RegistrarCuotaModal({
	isOpen,
	onClose,
	onSuccess,
	preloadedDni,
}: RegistrarPagoModalProps) {
	const [dniSearch, setDniSearch] = useState("");
	const [isSearching, setIsSearching] = useState(false);

	// Info del alumno extraída de las cuotas
	const [alumnoInfo, setAlumnoInfo] = useState<AlumnoInfo | null>(null);

	// Todas las cuotas pendientes del alumno (todos los cursos)
	const [todasCuotasPendientes, setTodasCuotasPendientes] = useState<
		CuotaDoc[]
	>([]);

	// Curso seleccionado en el selector
	const [selectedCursoId, setSelectedCursoId] = useState("");

	// Cuotas pendientes filtradas por el curso seleccionado, ordenadas asc
	const cuotasPendientesCurso = sortCuotasAsc(
		todasCuotasPendientes.filter((c) => c.cursoId === selectedCursoId),
	);

	// La cuota más antigua del curso: la única cobrable ahora
	const cuotaACobrar = cuotasPendientesCurso[0] ?? null;
	const cuotasEnDeuda = cuotasPendientesCurso.slice(1);
	const montoCobrar = cuotaACobrar ? resolverMontoCobro(cuotaACobrar) : 0;

	const [paymentMethod, setPaymentMethod] = useState("");
	const [allowException, setAllowException] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	// Aviso si la cuota a cobrar es de un mes futuro
	const isFutureMonthWarning = (() => {
		if (!cuotaACobrar) return false;
		const hoy = new Date();
		const mesHoy = hoy.getMonth() + 1;
		const anioHoy = hoy.getFullYear();
		return (
			cuotaACobrar.anio > anioHoy ||
			(cuotaACobrar.anio === anioHoy && cuotaACobrar.mes > mesHoy)
		);
	})();

	// ── Reset al abrir ───────────────────────────────────────────────────────
	useEffect(() => {
		if (!isOpen) return;

		setAlumnoInfo(null);
		setTodasCuotasPendientes([]);
		setSelectedCursoId("");
		setPaymentMethod("");
		setAllowException(false);
		setErrorMsg(null);

		if (preloadedDni) {
			setDniSearch(preloadedDni);
			searchByDni(preloadedDni);
		} else {
			setDniSearch("");
		}
	}, [isOpen, preloadedDni]);

	// Resetea excepción si cambia la cuota a cobrar
	useEffect(() => {
		setAllowException(false);
	}, [cuotaACobrar?.id]);

	// ── Búsqueda: una sola query a Cuotas por alumnoDni ─────────────────────
	//
	// Ya no necesitamos ir a Users ni a Hijos. Toda la info del alumno
	// (nombre, tipo, cursos) está denormalizada en los documentos de Cuotas.
	// ────────────────────────────────────────────────────────────────────────
	const searchByDni = async (dni: string) => {
		setIsSearching(true);
		setErrorMsg(null);
		setAlumnoInfo(null);
		setTodasCuotasPendientes([]);
		setSelectedCursoId("");

		try {
			// Traemos TODAS las cuotas del alumno (cualquier estado)
			// para poder determinar si existe y qué cursos tiene
			const snapTodas = await getDocs(
				query(collection(db, "Cuotas"), where("alumnoDni", "==", dni)),
			);

			if (snapTodas.empty) {
				setErrorMsg(
					"No se encontró ningún alumno con ese DNI en el sistema de cuotas.",
				);
				return;
			}

			// Extraemos info del alumno de la primera cuota encontrada
			const primerDoc = snapTodas.docs[0].data();
			const cursosMap: Record<string, string> = {};

			snapTodas.docs.forEach((d) => {
				const data = d.data();
				// Construimos el mapa cursoId → cursoNombre
				if (data.cursoId && data.cursoNombre) {
					cursosMap[data.cursoId] = data.cursoNombre;
				}
			});

			setAlumnoInfo({
				id: primerDoc.alumnoId,
				nombre: primerDoc.alumnoNombre,
				tipo: primerDoc.alumnoTipo,
				dni: primerDoc.alumnoDni,
				cursos: cursosMap,
			});

			// Filtramos solo las pendientes para el cobro
			const pendientes = snapTodas.docs
				.filter((d) => d.data().estado === "Pendiente")
				.map(mapDocToCuota);

			setTodasCuotasPendientes(pendientes);

			// Seleccionamos automáticamente el primer curso del mapa
			const primerCursoId = Object.keys(cursosMap)[0];
			setSelectedCursoId(primerCursoId);
		} catch (error) {
			console.error("Error al buscar alumno por DNI:", error);
			setErrorMsg("Error de conexión al buscar el DNI.");
		} finally {
			setIsSearching(false);
		}
	};

	const handleSearchStudent = () => {
		if (!dniSearch.trim()) {
			setErrorMsg("Debes ingresar un DNI para buscar.");
			return;
		}
		searchByDni(dniSearch.trim());
	};

	// ── Registrar pago ───────────────────────────────────────────────────────
	const handleRegistrarPago = async () => {
		if (!paymentMethod) {
			setErrorMsg("Por favor, seleccioná un método de pago.");
			return;
		}
		if (!cuotaACobrar) return;

		setIsLoading(true);
		setErrorMsg(null);

		try {
			// Siempre actualizamos la cuota más antigua del curso (orden forzado)
			await updateDoc(doc(db, "Cuotas", cuotaACobrar.id), {
				estado: "Pagado",
				fechaPago: serverTimestamp(),
				metodoPago: paymentMethod,
				montoPagado: montoCobrar,
				actualizadoEn: serverTimestamp(),
			});

			onSuccess();
			onClose();
		} catch (error) {
			console.error("Error al registrar el pago:", error);
			setErrorMsg("Ocurrió un error en el servidor al procesar el pago.");
		} finally {
			setIsLoading(false);
		}
	};

	if (!isOpen) return null;

	const cursosIds = alumnoInfo ? Object.keys(alumnoInfo.cursos) : [];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
			<div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
				{/* Header */}
				<div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
					<h2 className="text-xl font-bold text-[#252d62]">Registrar Pago</h2>
					<button
						onClick={onClose}
						disabled={isLoading}
						className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				<div className="p-6 space-y-6 overflow-y-auto">
					{/* ── Búsqueda por DNI ── */}
					<div className="space-y-2">
						<label className="text-sm font-semibold text-gray-700">
							Buscar Alumno por DNI
						</label>
						<div className="flex gap-2">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
								<input
									type="text"
									value={dniSearch}
									onChange={(e) => setDniSearch(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleSearchStudent()}
									placeholder="Ej: 38123456"
									className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20"
								/>
							</div>
							<Button
								onClick={handleSearchStudent}
								disabled={isSearching || !dniSearch.trim()}
								className="bg-[#252d62] hover:bg-[#1a2046] text-white rounded-xl"
							>
								{isSearching ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									"Buscar"
								)}
							</Button>
						</div>
					</div>

					{/* ── Resultado ── */}
					{alumnoInfo && (
						<div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
							{/* Card alumno */}
							<div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-3">
								<div className="p-2 bg-blue-100 text-blue-700 rounded-full">
									<User className="w-5 h-5" />
								</div>
								<div>
									<p className="text-sm font-bold text-[#252d62]">
										{alumnoInfo.nombre}
									</p>
									<p className="text-xs text-gray-500">
										DNI: {alumnoInfo.dni} |{" "}
										<span className="uppercase text-blue-600 font-semibold">
											{alumnoInfo.tipo === "menor"
												? "Alumno Menor"
												: "Alumno Mayor"}
										</span>
									</p>
								</div>
							</div>

							{/* Selector de curso (solo si tiene más de uno) */}
							<div className="space-y-2">
								<label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
									<BookOpen className="w-4 h-4" /> Curso
								</label>
								{cursosIds.length > 1 ? (
									<select
										value={selectedCursoId}
										onChange={(e) => {
											setSelectedCursoId(e.target.value);
											setPaymentMethod("");
										}}
										className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 font-medium"
									>
										{cursosIds.map((id) => (
											<option key={id} value={id}>
												{alumnoInfo.cursos[id]}
											</option>
										))}
									</select>
								) : (
									<div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium">
										{alumnoInfo.cursos[selectedCursoId] || selectedCursoId}
									</div>
								)}
							</div>

							{/* ── Estado de cuotas del curso seleccionado ── */}
							{cuotasPendientesCurso.length === 0 ? (
								<div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm flex items-center gap-2">
									<CheckCircle className="w-4 h-4" />
									Al día. Todas las cuotas pagadas para este curso.
								</div>
							) : (
								<>
									{/* Resumen de deuda si hay más de una cuota atrasada */}
									{cuotasEnDeuda.length > 0 && (
										<div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
											<div className="flex items-start gap-2">
												<AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
												<div>
													<p className="text-sm font-bold text-amber-800">
														{cuotasPendientesCurso.length} cuotas pendientes
													</p>
													<p className="text-xs text-amber-700 mt-0.5">
														Se deben abonar en orden. No se puede saltar una
														cuota sin pagar la anterior.
													</p>
												</div>
											</div>
											<div className="space-y-1.5">
												{cuotasPendientesCurso.map((cuota, index) => (
													<div
														key={cuota.id}
														className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
															index === 0
																? "bg-amber-100 border border-amber-300 font-semibold text-amber-900"
																: "bg-white/60 border border-amber-200/50 text-amber-700 opacity-60"
														}`}
													>
														<div className="flex items-center gap-2">
															<CalendarDays className="w-3.5 h-3.5 shrink-0" />
															<span>{formatMes(cuota.mes, cuota.anio)}</span>
															{index === 0 && (
																<span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded">
																	COBRAR AHORA
																</span>
															)}
														</div>
														<div className="flex items-center gap-1 text-xs">
															{formatCurrency(resolverMontoCobro(cuota))}
															{index > 0 && (
																<ChevronRight className="w-3 h-3 opacity-50" />
															)}
														</div>
													</div>
												))}
											</div>
										</div>
									)}

									{/* Cuota a abonar */}
									<div className="space-y-2">
										<label className="text-sm font-semibold text-gray-700">
											Cuota a Abonar
										</label>
										<div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3">
											<CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
											<span className="text-sm font-semibold text-gray-700">
												{formatMes(cuotaACobrar.mes, cuotaACobrar.anio)}
											</span>
											{cuotaACobrar.esPrimerMes && (
												<span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
													1er mes
												</span>
											)}
										</div>
									</div>

									{/* Advertencia mes futuro */}
									{isFutureMonthWarning && (
										<div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
											<div className="flex items-start gap-2 text-amber-800">
												<AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
												<p className="text-sm font-medium">
													Este mes está fuera del período habitual de cobro. No
													se permite registrar pagos con tanta anticipación.
												</p>
											</div>
											<label className="flex items-center gap-3 cursor-pointer select-none">
												<div
													onClick={() => setAllowException((v) => !v)}
													className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
														allowException
															? "bg-amber-500 border-amber-500"
															: "border-amber-400 bg-white"
													}`}
												>
													{allowException && (
														<svg
															className="w-3 h-3 text-white"
															viewBox="0 0 12 12"
															fill="none"
														>
															<path
																d="M2 6l3 3 5-5"
																stroke="currentColor"
																strokeWidth="2"
																strokeLinecap="round"
																strokeLinejoin="round"
															/>
														</svg>
													)}
												</div>
												<span className="text-sm font-semibold text-amber-800">
													Permitir excepción para este pago
												</span>
											</label>
										</div>
									)}

									{/* Monto a cobrar */}
									<div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
										<div className="flex items-center gap-2">
											<div className="p-2 bg-green-100 rounded-lg">
												<DollarSign className="w-5 h-5 text-green-700" />
											</div>
											<div>
												<p className="text-sm font-medium text-gray-500">
													Monto a Cobrar
												</p>
												<p className="text-lg font-bold text-[#252d62]">
													{formatCurrency(montoCobrar)}
												</p>
											</div>
										</div>
										<p className="text-[11px] text-gray-400 text-right max-w-[120px]">
											{cuotaACobrar.esPrimerMes
												? "Monto de primer mes"
												: new Date().getDate() <= 10
													? "Cobro del 1 al 10"
													: "Cobro del 11 en adelante"}
										</p>
									</div>

									{/* Método de pago */}
									<div className="space-y-2">
										<label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
											<CreditCard className="w-4 h-4" /> Método de Pago
										</label>
										<select
											value={paymentMethod}
											onChange={(e) => setPaymentMethod(e.target.value)}
											className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 font-medium bg-white"
										>
											<option value="" disabled>
												-- Seleccione una opción --
											</option>
											<option value="Efectivo">Efectivo</option>
											<option value="Transferencia Bancaria (Verificada)">
												Transferencia Bancaria (Verificada)
											</option>
											<option value="Tarjeta (Posnet)">Tarjeta (Posnet)</option>
										</select>
									</div>
								</>
							)}
						</div>
					)}
				</div>

				{/* Mensaje de error */}
				{errorMsg && (
					<div className="mx-6 mb-2 flex items-start gap-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
						<AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
						<p className="font-medium">{errorMsg}</p>
					</div>
				)}

				{/* Footer */}
				<div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 shrink-0">
					<Button
						variant="outline"
						onClick={onClose}
						className="rounded-xl"
						disabled={isLoading}
					>
						Cancelar
					</Button>
					<Button
						onClick={handleRegistrarPago}
						disabled={
							isLoading ||
							!cuotaACobrar ||
							!paymentMethod ||
							isSearching ||
							(isFutureMonthWarning && !allowException)
						}
						className="bg-[#252d62] hover:bg-[#1a2046] text-white rounded-xl flex items-center gap-2"
					>
						{isLoading ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<CheckCircle className="w-4 h-4" />
						)}
						{isLoading ? "Procesando..." : "Confirmar Pago"}
					</Button>
				</div>
			</div>
		</div>
	);
}
