import React, { SyntheticEvent, useState, useEffect } from "react";
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

	const totalIngresado = partialPayments.reduce(
		(acc, curr) => acc + (curr.amount || 0),
		0,
	);
	const saldoRestante = montoFinalInscripcion - totalIngresado;

	// Efecto "Concatenador": Arma el String para Firebase si está todo cuadrado
	useEffect(() => {
		if (isSplitPayment && paymentStatus === "Confirmado") {
			const allMethodsSelected = partialPayments.every((p) => p.method !== "");

			// Solo le pasamos el string al padre (y habilitamos el botón) si la matemática da exacto
			if (
				totalIngresado === montoFinalInscripcion &&
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
		montoFinalInscripcion,
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

				{/* Muestra del monto a cobrar dinámico */}
				{selectedCourse && (
					<div className="flex items-center justify-between p-3 bg-[#252d62]/5 border border-[#252d62]/10 rounded-lg">
						<span className="text-sm font-semibold text-[#252d62]">
							Total Inscripción a cobrar:
						</span>
						<div className="flex items-center gap-2">
							{bestTag && applyTagDiscount && (
								<span className="text-xs text-gray-400 line-through">
									${montoBaseInscripcion.toLocaleString("es-AR")}
								</span>
							)}
							<span className="text-lg font-black text-[#252d62]">
								${montoFinalInscripcion.toLocaleString("es-AR")}
							</span>
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
										Este curso es para alumnos de{" "}
										<span className="font-bold">
											{selectedCourse.edadMinima}
										</span>{" "}
										a{" "}
										<span className="font-bold">
											{selectedCourse.edadMaxima}
										</span>{" "}
										años. El alumno tiene{" "}
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
						disabled={isSubmitting}
						value={paymentStatus}
						onChange={(e) =>
							setPaymentStatus(e.target.value as "Confirmado" | "Pendiente")
						}
						className={`block w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm font-medium ${paymentStatus === "Confirmado" ? "bg-green-50 border-green-200 text-green-800" : "bg-yellow-50 border-yellow-200 text-yellow-800"}`}
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
											{ method: "", amount: montoFinalInscripcion },
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
						false
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
