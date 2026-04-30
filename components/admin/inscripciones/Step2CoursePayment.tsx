import React, { SyntheticEvent, useState, useEffect, useMemo, useRef } from "react";
import {
	User,
	Tag as TagIcon,
	BookOpen,
	AlertTriangle,
	Wallet,
	CreditCard,
	CalendarClock,
	ArrowLeft,
	Save,
	Loader2,
	Plus,
	Trash2,
	SplitSquareHorizontal,
	Clock,
	Calendar,
	Info,
	Users,
	DollarSign,
	Pencil,
	RotateCcw,
	MessageSquare,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
	StudentData,
	CourseData,
	GrupoFamiliarInfo,
	TagDiscount,
} from "./ManualInscriptionModal";

interface Step2Props {
	foundStudent: StudentData | null;
	grupoFamiliar: GrupoFamiliarInfo;
	courses: CourseData[];
	isLoadingCourses: boolean;
	selectedCourseId: string;
	setSelectedCourseId: (val: string) => void;
	metodoPago: string;
	setMetodoPago: (val: string) => void;
	paymentStatus: "Confirmado" | "Pendiente";
	setPaymentStatus: (val: "Confirmado" | "Pendiente") => void;
	promiseDate: string;
	setPromiseDate: (val: string) => void;
	overrideAgeWarning: boolean;
	setOverrideAgeWarning: (val: boolean) => void;
	isSubmitting: boolean;
	bestTag: TagDiscount | null;
	applyTagDiscount: boolean;
	setApplyTagDiscount: (val: boolean) => void;
	onBack: () => void;
	onSubmit: (e: SyntheticEvent) => void;
	getTomorrow: () => string;
	calcularMontoPrimerMes: (fecha: Date, cuota1a10: number) => number;
	// Inscripción de fecha pasada
	isPastInscription: boolean;
	setIsPastInscription: (val: boolean) => void;
	pastDate: string;
	setPastDate: (val: string) => void;
	applyGroupDiscountToPast: boolean;
	setApplyGroupDiscountToPast: (val: boolean) => void;
	hasGrupoFamiliar: boolean;
	incluirPrimerMes: boolean;
	setIncluirPrimerMes: (val: boolean) => void;
	onAjusteChange: (monto: number | null, motivo: string) => void;
}

export default function Step2CoursePayment({
	foundStudent,
	grupoFamiliar,
	courses,
	isLoadingCourses,
	selectedCourseId,
	setSelectedCourseId,
	metodoPago,
	setMetodoPago,
	paymentStatus,
	setPaymentStatus,
	promiseDate,
	setPromiseDate,
	overrideAgeWarning,
	setOverrideAgeWarning,
	isSubmitting,
	bestTag,
	applyTagDiscount,
	setApplyTagDiscount,
	onBack,
	onSubmit,
	getTomorrow,
	isPastInscription,
	setIsPastInscription,
	pastDate,
	setPastDate,
	applyGroupDiscountToPast,
	setApplyGroupDiscountToPast,
	hasGrupoFamiliar,
	incluirPrimerMes,
	setIncluirPrimerMes,
	onAjusteChange,
}: Step2Props) {
	const selectedCourse = courses.find((c) => c.id === selectedCourseId);
	const isAgeWarning =
		selectedCourse &&
		foundStudent &&
		(foundStudent.edad < selectedCourse.edadMinima ||
			foundStudent.edad > selectedCourse.edadMaxima);

	const montoBaseInscripcion = selectedCourse?.inscripcion || 0;
	const montoFinalInscripcion =
		bestTag && applyTagDiscount
			? Math.round(
					montoBaseInscripcion * (1 - bestTag.descuentoInscripcion / 100),
				)
			: montoBaseInscripcion;

	// ─── Lógica de Pagos Múltiples (Split Payment) ──────────────────────────────
	const [isSplitPayment, setIsSplitPayment] = useState(false);
	const [partialPayments, setPartialPayments] = useState<
		{ method: string; amount: number }[]
	>([{ method: "", amount: 0 }]);

	// ─── Estado del ajuste manual ──────────────────────────────────────────────
	const [editandoMonto, setEditandoMonto] = useState(false);
	const [montoEditado, setMontoEditado] = useState<string>("");
	const [motivoAjuste, setMotivoAjuste] = useState<string>("");
	const inputMontoRef = useRef<HTMLInputElement>(null);

	const montoEditadoNum = parseFloat(montoEditado);
	const ajusteAplicado =
		montoEditado !== "" &&
		!isNaN(montoEditadoNum) &&
		montoEditadoNum > 0 &&
		montoEditadoNum !== montoFinalInscripcion;

	const diferenciaAjuste = ajusteAplicado ? montoEditadoNum - montoFinalInscripcion : 0;

	// Monto final a cobrar (sea el del sistema o el ajustado manual)
	const montoMostrar = ajusteAplicado ? montoEditadoNum : montoFinalInscripcion;

	useEffect(() => {
		if (editandoMonto && inputMontoRef.current) {
			inputMontoRef.current.focus();
			inputMontoRef.current.select();
		}
	}, [editandoMonto]);

	const handleAplicarMonto = () => {
		const valor = parseFloat(montoEditado);
		if (isNaN(valor) || valor <= 0) {
			alert("Ingresá un monto válido mayor a cero.");
			return;
		}
		if (!motivoAjuste.trim()) {
			alert("Debés ingresar una aclaración para el ajuste de monto.");
			return;
		}
		setEditandoMonto(false);
		
		// Notificamos al padre
		onAjusteChange(valor, motivoAjuste.trim());

		// Si aplican un ajuste manual y estaban en medio de un Split Payment, re-calculamos
		if (isSplitPayment) {
			setPartialPayments([{ method: "", amount: valor }]);
			setMetodoPago("");
		}
	};

	const handleCancelarEdicion = () => {
		setMontoEditado("");
		setMotivoAjuste("");
		setEditandoMonto(false);
		onAjusteChange(null, "");
		if (isSplitPayment) {
			setPartialPayments([{ method: "", amount: montoFinalInscripcion }]);
			setMetodoPago("");
		}
	};

	const totalIngresado = partialPayments.reduce(
		(acc, curr) => acc + (curr.amount || 0),
		0,
	);
	const saldoRestante = montoMostrar - totalIngresado;

	// ─── Lógica de preview para inscripción de fecha pasada ───────────────
	const MESES_NOMBRES = [
		"Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
		"Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
	];

	const pastDatePreview = useMemo(() => {
		if (!isPastInscription || !pastDate) return null;

		const fechaIns = new Date(pastDate + "T12:00:00");
		
		if (fechaIns.getFullYear() < 2026) {
			return { error: true, meses: [], total: 0 };
		}

		const hoy = new Date();
		const meses: string[] = [];

		const mesInicio = Math.max(fechaIns.getMonth() + 1, selectedCourse?.inicioMes || 1);
		const cursor = new Date(fechaIns.getFullYear(), mesInicio - 1, 1);
		const mesActualDate = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

		let esPrimerIteracion = true;
		while (cursor <= mesActualDate) {
			// Si el admin optó por no generar el primer mes, lo salteamos en el preview
			if (esPrimerIteracion && !incluirPrimerMes) {
				esPrimerIteracion = false;
				cursor.setMonth(cursor.getMonth() + 1);
				continue;
			}
			meses.push(`${MESES_NOMBRES[cursor.getMonth()]} ${cursor.getFullYear()}`);
			esPrimerIteracion = false;
			cursor.setMonth(cursor.getMonth() + 1);
		}

		if (hoy.getDate() >= 20) {
			const sig = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
			meses.push(`${MESES_NOMBRES[sig.getMonth()]} ${sig.getFullYear()}`);
		}

		return { error: false, meses, total: meses.length };
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isPastInscription, pastDate, selectedCourse?.inicioMes, incluirPrimerMes]);

	// Fecha máxima para inscripción pasada: ayer (cualquier día anterior al de hoy)
	const maxPastDate = useMemo(() => {
		const hoy = new Date();
		const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
		return ayer.toISOString().split("T")[0];
	}, []);

	// Efecto "Concatenador": Arma el String para Firebase si está todo cuadrado
	useEffect(() => {
		if (isSplitPayment && paymentStatus === "Confirmado") {
			const allMethodsSelected = partialPayments.every((p) => p.method !== "");

			// Solo le pasamos el string al padre (y habilitamos el botón) si la matemática da exacto
			if (
				totalIngresado === montoMostrar &&
				allMethodsSelected &&
				partialPayments.length > 0
			) {
				const stringFormateado = partialPayments
					.map((p) => `${p.method} ($${p.amount.toLocaleString("es-AR")})`)
					.join(" + ");
				setMetodoPago(stringFormateado);
			} else {
				setMetodoPago(""); // Esto bloquea el botón "Finalizar Inscripción" automáticamente
			}
		}
	}, [
		partialPayments,
		isSplitPayment,
		paymentStatus,
		montoMostrar,
		setMetodoPago,
		totalIngresado,
	]);

	const addPartialPayment = () => {
		setPartialPayments([
			...partialPayments,
			{ method: "", amount: saldoRestante > 0 ? saldoRestante : 0 },
		]);
	};

	const updatePartialPayment = (
		index: number,
		field: "method" | "amount",
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		value: any,
	) => {
		const newPayments = [...partialPayments];
		newPayments[index] = { ...newPayments[index], [field]: value };
		setPartialPayments(newPayments);
	};

	const removePartialPayment = (index: number) => {
		const newPayments = partialPayments.filter((_, i) => i !== index);
		setPartialPayments(newPayments);
	};

	return (
		<form onSubmit={onSubmit} className="space-y-6">
			<div className="space-y-4">
				{/* Resumen alumno */}
				<div className="bg-gray-50 p-3 rounded-lg flex items-center gap-3 border border-gray-100">
					<User className="w-5 h-5 text-gray-400" />
					<div>
						<p className="text-xs text-gray-500 font-medium">Inscribiendo a:</p>
						<p className="text-sm font-bold text-[#252d62]">
							{foundStudent?.nombre} {foundStudent?.apellido}{" "}
							<span className="text-gray-400 font-normal">
								({foundStudent?.dni}) - {foundStudent?.edad} años
							</span>
						</p>
					</div>
				</div>

				{grupoFamiliar.aplica && paymentStatus === "Confirmado" && (
					<div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
						<TagIcon className="w-4 h-4 text-emerald-600 shrink-0" />
						<p className="text-xs font-bold text-emerald-700">
							Descuento por Grupo Familiar (10%) será aplicado a las CUOTAS.
						</p>
					</div>
				)}

				<label className="block text-sm font-bold text-[#252d62]">
					2. Detalles de Cursada e Inscripción
				</label>

				{/* Select curso */}
				<div className="relative">
					<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<BookOpen className="h-4 w-4 text-gray-400" />
					</div>
					<select
						required
						disabled={isLoadingCourses || isSubmitting}
						value={selectedCourseId}
						onChange={(e) => setSelectedCourseId(e.target.value)}
						className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white"
					>
						<option value="">
							{isLoadingCourses
								? "Cargando cursos..."
								: "Seleccionar Curso Activo"}
						</option>
						{courses.map((c) => (
							<option key={c.id} value={c.id}>
								{c.nombre} - Inscripción: ${c.inscripcion}
							</option>
						))}
					</select>
				</div>

				{/* Banner de Etiqueta Detectada */}
				<AnimatePresence>
					{bestTag && (
						<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							className="overflow-hidden"
						>
							<div className="bg-purple-50 border border-purple-200 p-4 rounded-lg flex flex-col gap-3">
								<div className="flex items-start gap-2">
									<TagIcon className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
									<div>
										<p className="text-sm text-purple-800 font-bold">
											Etiqueta Especial Detectada
										</p>
										<p className="text-sm text-purple-700 mt-1">
											El alumno posee la etiqueta{" "}
											<strong>{bestTag.nombre}</strong>. Aplica para un{" "}
											<strong>
												{bestTag.descuentoInscripcion}% de descuento
											</strong>{" "}
											en la matrícula.
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2 mt-1 ml-7 bg-white p-2 rounded border border-purple-100 w-fit">
									<input
										type="checkbox"
										id="apply-tag"
										checked={applyTagDiscount}
										onChange={(e) => setApplyTagDiscount(e.target.checked)}
										className="w-4 h-4 text-purple-600 rounded cursor-pointer border-purple-300"
									/>
									<label
										htmlFor="apply-tag"
										className="text-sm text-purple-800 font-bold cursor-pointer"
									>
										Aplicar descuento a la inscripción
									</label>
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				{/* ── Monto a cobrar ──────────────────────────────────────── */}
				{selectedCourse && (
					<div className="space-y-2">
						<div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
							{/* Fila principal: monto + botón ajustar */}
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<div className="p-2 bg-green-100 rounded-lg shrink-0">
										<DollarSign className="w-5 h-5 text-green-700" />
									</div>
									<div>
										<p className="text-sm font-medium text-gray-500">
											Monto Inscripción a Cobrar
										</p>
										<div className="flex items-center gap-2">
											<p
												className={`text-lg font-bold ${ajusteAplicado ? "text-amber-600" : "text-[#252d62]"}`}
											>
												${montoMostrar.toLocaleString("es-AR")}
											</p>
											{(ajusteAplicado || (bestTag && applyTagDiscount)) && (
												<span className="text-xs text-gray-400 line-through">
													${(ajusteAplicado ? montoFinalInscripcion : montoBaseInscripcion).toLocaleString("es-AR")}
												</span>
											)}
										</div>
									</div>
								</div>

								{!editandoMonto ? (
									<button
										type="button"
										onClick={() => {
											setMontoEditado(
												ajusteAplicado
													? montoEditado
													: String(montoFinalInscripcion),
											);
											setEditandoMonto(true);
										}}
										className="flex items-center gap-1.5 text-xs font-semibold text-[#252d62] hover:text-[#EE1120] border border-gray-200 hover:border-[#EE1120] px-2.5 py-1.5 rounded-lg transition-colors"
									>
										<Pencil className="w-3 h-3" />
										{ajusteAplicado
											? "Editar ajuste"
											: "Modificar monto"}
									</button>
								) : (
									<button
										type="button"
										onClick={handleCancelarEdicion}
										className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg transition-colors"
									>
										<RotateCcw className="w-3 h-3" />
										Cancelar
									</button>
								)}
							</div>

							{/* Form de ajuste: nuevo monto + motivo */}
							{editandoMonto && (
								<div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
									<div className="space-y-1">
										<p className="text-xs text-gray-500">
											Monto del sistema:{" "}
											<span className="font-semibold">
												${montoFinalInscripcion.toLocaleString("es-AR")}
											</span>
											. Ingresá el nuevo monto:
										</p>
										<div className="relative">
											<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">
												$
											</span>
											<input
												ref={inputMontoRef}
												type="number"
												min={1}
												value={montoEditado}
												onChange={(e) =>
													setMontoEditado(e.target.value)
												}
												onKeyDown={(e) =>
													e.key === "Enter" &&
													(e.preventDefault(), inputMontoRef.current?.blur())
												}
												className="w-full pl-7 pr-3 py-2 border border-[#252d62] rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#252d62]/20"
												placeholder={String(montoFinalInscripcion)}
											/>
										</div>
									</div>

									<div className="space-y-1">
										<label className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
											<MessageSquare className="w-3.5 h-3.5" />
											Motivo del ajuste{" "}
											<span className="text-red-500">*</span>
										</label>
										<textarea
											value={motivoAjuste}
											onChange={(e) => setMotivoAjuste(e.target.value)}
											placeholder="Ej: Acuerdo de pago en cuotas, cortesía..."
											rows={2}
											className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 resize-none"
										/>
									</div>

									<Button
										type="button"
										onClick={handleAplicarMonto}
										className="w-full bg-[#252d62] hover:bg-[#1a2046] text-white rounded-lg text-sm"
									>
										Aplicar ajuste
									</Button>
								</div>
							)}

							{/* Badge de ajuste aplicado */}
							{ajusteAplicado && !editandoMonto && (
								<div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
									<AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
									<div className="flex-1 min-w-0">
										<p className="text-xs text-amber-700 font-bold">
											Monto ajustado{" "}
											{diferenciaAjuste > 0
												? `+$${diferenciaAjuste.toLocaleString("es-AR")}`
												: `-$${Math.abs(diferenciaAjuste).toLocaleString("es-AR")}`}
										</p>
										<p className="text-[11px] text-amber-600 mt-0.5 truncate">
											{motivoAjuste}
										</p>
									</div>
									<button
										type="button"
										onClick={() => {
											setMontoEditado("");
											setMotivoAjuste("");
											setEditandoMonto(false);
											onAjusteChange(null, "");
											if (isSplitPayment) {
												setPartialPayments([
													{ method: "", amount: montoFinalInscripcion },
												]);
												setMetodoPago("");
											}
										}}
										className="text-amber-500 hover:text-amber-700 transition-colors p-1"
									>
										<X className="w-4 h-4" />
									</button>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Alerta de edad */}
				<AnimatePresence>
					{isAgeWarning && selectedCourse && (
						<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							className="bg-orange-50 border border-orange-200 p-4 rounded-lg flex flex-col gap-3 overflow-hidden"
						>
							<div className="flex items-start gap-2">
								<AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
								<div>
									<p className="text-sm text-orange-800 font-bold">
										Advertencia de Edad
									</p>
									<p className="text-sm text-orange-700 mt-1">
										{selectedCourse.edadMaxima === 999 ? (
											<>
												Este curso es para alumnos mayores de{" "}
												<span className="font-bold">
													{selectedCourse.edadMinima}
												</span>{" "}
												años.
											</>
										) : (
											<>
												Este curso es para alumnos de{" "}
												<span className="font-bold">
													{selectedCourse.edadMinima}
												</span>{" "}
												a{" "}
												<span className="font-bold">
													{selectedCourse.edadMaxima}
												</span>{" "}
												años.
											</>
										)}{" "}
										El alumno tiene{" "}
										<span className="font-bold">{foundStudent?.edad}</span>{" "}
										años.
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2 mt-1 ml-7">
								<input
									type="checkbox"
									id="override-age"
									checked={overrideAgeWarning}
									onChange={(e) => setOverrideAgeWarning(e.target.checked)}
									className="w-4 h-4 text-[#EE1120] rounded cursor-pointer"
								/>
								<label
									htmlFor="override-age"
									className="text-sm text-orange-800 font-medium cursor-pointer"
								>
									Inscribir de todas formas (Excepción autorizada)
								</label>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				{/* ─── Inscripción de Fecha Pasada ─── */}
				<div className="mt-6 border border-amber-200 bg-amber-50/50 rounded-xl p-4 space-y-3">
					<label className="flex items-center gap-2.5 cursor-pointer select-none">
						<input
							type="checkbox"
							checked={isPastInscription}
							onChange={(e) => {
								setIsPastInscription(e.target.checked);
								if (!e.target.checked) {
									setPastDate("");
									setApplyGroupDiscountToPast(false);
								} else {
									setPaymentStatus("Confirmado");
								}
							}}
							disabled={isSubmitting}
							className="w-4 h-4 text-amber-600 rounded cursor-pointer border-amber-300"
						/>
						<div className="flex items-center gap-1.5">
							<Clock className="w-4 h-4 text-amber-600" />
							<span className="text-sm font-bold text-amber-800">
								Inscripción de fecha pasada
							</span>
						</div>
					</label>

					<AnimatePresence>
						{isPastInscription && (
							<motion.div
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: "auto" }}
								exit={{ opacity: 0, height: 0 }}
								className="space-y-3 overflow-hidden"
							>
								{/* Input de fecha */}
								<div className="relative">
									<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
										<Calendar className="h-4 w-4 text-amber-500" />
									</div>
									<input
										type="date"
										value={pastDate}
										min="2026-01-01"
										max={maxPastDate}
										onChange={(e) => setPastDate(e.target.value)}
										disabled={isSubmitting}
										className={`block w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 ${
											pastDatePreview?.error
												? "border-red-300 focus:border-red-500 focus:ring-red-500"
												: "border-amber-200 focus:ring-amber-500 focus:border-amber-500"
										}`}
									/>
								</div>
								{pastDatePreview?.error && (
									<p className="text-xs text-red-500 font-semibold mt-1">
										Solo se permiten fechas del ciclo lectivo 2026
									</p>
								)}

								{/* Checkbox grupo familiar (solo si aplica) */}
								{hasGrupoFamiliar && (
									<label className="flex items-center gap-2.5 cursor-pointer select-none bg-white p-2.5 rounded-lg border border-amber-100">
										<input
											type="checkbox"
											checked={applyGroupDiscountToPast}
											onChange={(e) => setApplyGroupDiscountToPast(e.target.checked)}
											disabled={isSubmitting}
											className="w-4 h-4 text-emerald-600 rounded cursor-pointer border-emerald-300"
										/>
										<div className="flex items-center gap-1.5">
											<Users className="w-3.5 h-3.5 text-emerald-600" />
											<span className="text-xs font-semibold text-emerald-800">
												Aplicar descuento de grupo familiar a cuotas pasadas
											</span>
										</div>
									</label>
								)}

								{/* Preview informativo */}
								{pastDatePreview && !pastDatePreview.error && (
									<div className="bg-white border border-amber-100 rounded-lg p-3 space-y-2">
										<div className="flex items-center gap-1.5">
											<Info className="w-3.5 h-3.5 text-amber-600" />
											<span className="text-xs font-bold text-amber-800">
												Se generarán {pastDatePreview.total} cuota{pastDatePreview.total !== 1 ? "s" : ""}:
											</span>
										</div>
										<div className="flex flex-wrap gap-1.5">
											{pastDatePreview.meses.map((mes, i) => (
												<span
													key={i}
													className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-semibold rounded"
												>
													{mes}
												</span>
											))}
										</div>
										<p className="text-[10px] text-amber-600 mt-1">
											Todas las cuotas se crean en estado <strong>Pendiente</strong>. Deberás gestionarlas desde el panel de cuotas.
										</p>
									</div>
								)}
							</motion.div>
						)}
					</AnimatePresence>
				</div>

				{/* ─── Generar cuota del primer mes ─── */}
				<div className="border border-blue-200 bg-blue-50/50 rounded-xl p-4">
					<label className="flex items-start gap-2.5 cursor-pointer select-none">
						<input
							type="checkbox"
							checked={incluirPrimerMes}
							onChange={(e) => setIncluirPrimerMes(e.target.checked)}
							disabled={isSubmitting}
							className="w-4 h-4 mt-0.5 text-blue-600 rounded cursor-pointer border-blue-300"
						/>
						<div>
							<div className="flex items-center gap-1.5">
								<CalendarClock className="w-4 h-4 text-blue-600" />
								<span className="text-sm font-bold text-blue-800">
									Generar cuota del primer mes (mes de inscripción)
								</span>
							</div>
							<p className="text-xs text-blue-600 mt-0.5">
								{incluirPrimerMes
									? "Se generará la cuota del mes de inscripción."
									: "No se generará la cuota del mes de inscripción."}
							</p>
						</div>
					</label>
				</div>

				<label className="block text-sm font-bold text-[#252d62] mt-6">
					3. Estado del Pago
				</label>

				{/* Select estado */}
				<div className="relative">
					<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<Wallet className="h-4 w-4 text-gray-400" />
					</div>
					<select
						required
						disabled={isSubmitting || isPastInscription}
						value={paymentStatus}
						onChange={(e) =>
							setPaymentStatus(e.target.value as "Confirmado" | "Pendiente")
						}
						className={`block w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm font-medium ${paymentStatus === "Confirmado" ? "bg-green-50 border-green-200 text-green-800" : "bg-yellow-50 border-yellow-200 text-yellow-800"} ${isPastInscription ? "opacity-70 cursor-not-allowed" : ""}`}
					>
						<option value="Confirmado">
							El tutor abona en este momento (Confirmado)
						</option>
						<option value="Pendiente">
							El tutor pagará otro día (Promesa de Pago)
						</option>
					</select>
				</div>

				{/* Método de pago */}
				{paymentStatus === "Confirmado" && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						className="space-y-3"
					>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<CreditCard className="h-4 w-4 text-gray-400" />
							</div>
							<select
								required
								disabled={isSubmitting}
								// Si está en split, mostramos un value artificial
								value={isSplitPayment ? "multiple" : metodoPago}
								onChange={(e) => {
									if (e.target.value === "multiple") {
										setIsSplitPayment(true);
										setMetodoPago(""); // Reseteamos hasta que cuadre la matemática
										setPartialPayments([
											{ method: "", amount: montoMostrar },
										]);
									} else {
										setIsSplitPayment(false);
										setMetodoPago(e.target.value);
									}
								}}
								className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white"
							>
								<option value="">Seleccionar Medio de Pago Recibido</option>
								<option value="Efectivo">Efectivo en Sede</option>
								<option value="Transferencia Bancaria (Verificada)">
									Transferencia Bancaria (Verificada)
								</option>
								<option value="Tarjeta (Posnet)">Tarjeta (Posnet)</option>
								<option value="multiple" className="font-bold text-blue-700">
									💳 Múltiples métodos (Ej: Efectivo + Transferencia)
								</option>
							</select>
						</div>

						{/* UI de Split Payment */}
						{isSplitPayment && (
							<motion.div
								initial={{ opacity: 0, y: -5 }}
								animate={{ opacity: 1, y: 0 }}
								className="p-4 border border-blue-200 bg-blue-50/30 rounded-xl space-y-3"
							>
								<div className="flex justify-between items-center pb-2 border-b border-blue-100">
									<span className="text-xs font-bold text-[#252d62] uppercase tracking-wider flex items-center gap-1.5">
										<SplitSquareHorizontal className="w-3.5 h-3.5" /> Desglose
										de pagos
									</span>
									<span
										className={`text-sm font-bold ${
											saldoRestante === 0
												? "text-emerald-600"
												: saldoRestante < 0
													? "text-red-600"
													: "text-amber-600"
										}`}
									>
										Restante: ${saldoRestante.toLocaleString("es-AR")}
									</span>
								</div>

								{partialPayments.map((p, index) => (
									<div key={index} className="flex gap-2 items-center">
										<select
											value={p.method}
											onChange={(e) =>
												updatePartialPayment(index, "method", e.target.value)
											}
											className="flex-1 py-2 px-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
										>
											<option value="">Método...</option>
											<option value="Efectivo">Efectivo</option>
											<option value="Transferencia">Transferencia</option>
											<option value="Tarjeta">Tarjeta</option>
										</select>

										<div className="relative w-1/3">
											<span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">
												$
											</span>
											<input
												type="number"
												min={0}
												value={p.amount === 0 ? "" : p.amount}
												onChange={(e) =>
													updatePartialPayment(
														index,
														"amount",
														Number(e.target.value),
													)
												}
												className="w-full pl-6 pr-2 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
												placeholder="0"
											/>
										</div>

										{partialPayments.length > 1 ? (
											<button
												type="button"
												onClick={() => removePartialPayment(index)}
												className="p-2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
											>
												<Trash2 className="w-3.5 h-3.5" />
											</button>
										) : (
											<div className="w-[34px]" /> // Spacer para mantener el diseño alineado
										)}
									</div>
								))}

								{saldoRestante > 0 && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={addPartialPayment}
										className="w-full mt-2 border-dashed border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400"
									>
										<Plus className="w-3.5 h-3.5 mr-1.5" /> Agregar otro pago
										por ${saldoRestante.toLocaleString("es-AR")}
									</Button>
								)}

								{saldoRestante < 0 && (
									<p className="text-[10px] text-red-500 font-medium text-center">
										Los montos superan el total a cobrar. Ajuste los valores.
									</p>
								)}
							</motion.div>
						)}
					</motion.div>
				)}

				{/* Fecha promesa */}
				{paymentStatus === "Pendiente" && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						className="space-y-2"
					>
						<div className="relative">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<CalendarClock className="h-4 w-4 text-gray-400" />
							</div>
							<input
								type="date"
								required
								disabled={isSubmitting}
								value={promiseDate}
								min={getTomorrow()}
								onChange={(e) => {
									setPromiseDate(e.target.value);
									setMetodoPago("A confirmar");
								}}
								className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50"
							/>
						</div>
					</motion.div>
				)}
			</div>

			<div className="pt-4 border-t border-gray-100 flex justify-between mt-8">
				<Button
					type="button"
					variant="outline"
					onClick={onBack}
					disabled={isSubmitting}
				>
					<ArrowLeft className="w-4 h-4 mr-2" /> Atrás
				</Button>
				<Button
					type="submit"
					disabled={
						isSubmitting ||
						!selectedCourseId ||
						(paymentStatus === "Confirmado" && !metodoPago) || // Fíjate que el 'metodoPago' estará vacío si la matemática del Split no da 0.
						(paymentStatus === "Pendiente" && !promiseDate) ||
						(isAgeWarning && !overrideAgeWarning) ||
						(isPastInscription && (!pastDate || pastDatePreview?.error)) ||
						editandoMonto
					}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white"
				>
					{isSubmitting ? (
						<Loader2 className="w-4 h-4 animate-spin" />
					) : (
						<>
							<Save className="w-4 h-4 mr-2" /> Finalizar Inscripción
						</>
					)}
				</Button>
			</div>
		</form>
	);
}
