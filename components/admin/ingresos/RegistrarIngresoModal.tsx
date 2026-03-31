"use client";

import React, { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Loader2,
	DollarSign,
	FileText,
	CheckCircle2,
	AlertCircle,
	CreditCard,
	SplitSquareHorizontal,
	Plus,
	Trash2,
} from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Button } from "@/components/ui/button";

interface RegistrarIngresoModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

const CATEGORIAS_PREDEFINIDAS = [
	"Venta de uniforme",
	"Venta de útiles escolares",
	"Alquiler de espacio",
	"Donación",
	"Otro (Escribir manualmente...)",
];

export default function RegistrarIngresoModal({
	isOpen,
	onClose,
	onSuccess,
}: RegistrarIngresoModalProps) {
	const { adminData } = useAdminAuth();

	const [descripcion, setDescripcion] = useState("");

	const [modoEscritura, setModoEscritura] = useState(false);

	const [monto, setMonto] = useState("");
	const [metodoPago, setMetodoPago] = useState("");
	const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [exito, setExito] = useState(false);

	const [isSplitPayment, setIsSplitPayment] = useState(false);
	const [partialPayments, setPartialPayments] = useState<
		{ method: string; amount: number }[]
	>([{ method: "", amount: 0 }]);

	const montoNum = Number(monto) || 0;
	const totalIngresado = partialPayments.reduce(
		(acc, curr) => acc + (curr.amount || 0),
		0,
	);
	const saldoRestante = montoNum - totalIngresado;

	useEffect(() => {
		if (isSplitPayment) {
			const allMethodsSelected = partialPayments.every((p) => p.method !== "");

			if (
				montoNum > 0 &&
				totalIngresado === montoNum &&
				allMethodsSelected &&
				partialPayments.length > 0
			) {
				const stringFormateado = partialPayments
					.map((p) => `${p.method} ($${p.amount.toLocaleString("es-AR")})`)
					.join(" + ");
				setMetodoPago(stringFormateado);
			} else {
				setMetodoPago("");
			}
		}
	}, [partialPayments, isSplitPayment, montoNum, totalIngresado]);

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

	const handleClose = () => {
		if (isLoading) return;
		setDescripcion("");
		setModoEscritura(false);
		setMonto("");
		setMetodoPago("");
		setIsSplitPayment(false);
		setPartialPayments([{ method: "", amount: 0 }]);
		setFecha(new Date().toISOString().split("T")[0]);
		setError(null);
		setExito(false);
		onClose();
	};

	const handleSubmit = async () => {
		setError(null);

		if (
			!descripcion.trim() ||
			descripcion === "Otro (Escribir manualmente...)"
		) {
			setError("Debes seleccionar o escribir una descripción válida.");
			return;
		}
		if (!monto || isNaN(montoNum) || montoNum <= 0) {
			setError("El monto debe ser un número mayor a cero.");
			return;
		}
		if (isSplitPayment && !metodoPago) {
			setError("Los montos de los métodos de pago no coinciden con el total.");
			return;
		}
		if (!metodoPago) {
			setError("Debes seleccionar un método de pago.");
			return;
		}
		if (!fecha) {
			setError("La fecha es obligatoria.");
			return;
		}

		setIsLoading(true);
		try {
			await addDoc(collection(db, "IngresosEspeciales"), {
				descripcion: descripcion.trim(),
				monto: montoNum,
				metodoPago: metodoPago,
				fecha: new Date(fecha + "T12:00:00"),
				registradoPor: adminData?.nombre || adminData?.email || "Admin",
				creadoEn: serverTimestamp(),
			});

			setExito(true);
			setTimeout(() => {
				onSuccess();
				handleClose();
			}, 1500);
		} catch (err) {
			console.error(err);
			setError("Hubo un error al guardar el ingreso. Intentá de nuevo.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
				<DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 bg-gray-50/50">
					<div className="flex items-center gap-3">
						<div className="bg-[#252d62] p-2 rounded-lg">
							<DollarSign className="w-4 h-4 text-white" />
						</div>
						<div>
							<DialogTitle className="text-lg font-bold text-[#252d62]">
								Registrar ingreso especial
							</DialogTitle>
							<p className="text-xs text-gray-500 mt-0.5">
								Ingresos fuera del sistema de cuotas e inscripciones
							</p>
						</div>
					</div>
				</DialogHeader>

				<div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
					{exito && (
						<div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
							<CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
							<p className="text-sm font-semibold text-green-800">
								¡Ingreso registrado correctamente!
							</p>
						</div>
					)}

					{error && (
						<div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
							<AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
							<p className="text-sm font-semibold text-red-800">{error}</p>
						</div>
					)}

					{/* 🚀 NUEVA SECCIÓN DE CATEGORÍA / DESCRIPCIÓN */}
					<div>
						<label className="block text-sm font-semibold text-gray-700 mb-1.5">
							<span className="flex items-center gap-1.5">
								<FileText className="w-3.5 h-3.5 text-gray-400" />
								Concepto del ingreso
							</span>
						</label>

						{!modoEscritura ? (
							<select
								value={descripcion}
								onChange={(e) => {
									const val = e.target.value;
									if (val === "Otro (Escribir manualmente...)") {
										setModoEscritura(true);
										setDescripcion(""); // Limpiamos para que escriba libre
									} else {
										setDescripcion(val);
									}
								}}
								disabled={isLoading || exito}
								className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] transition-all bg-white font-medium"
							>
								<option value="" disabled>
									Selecciona una categoría...
								</option>
								{CATEGORIAS_PREDEFINIDAS.map((cat) => (
									<option key={cat} value={cat}>
										{cat}
									</option>
								))}
							</select>
						) : (
							<div className="space-y-2">
								<input
									type="text"
									value={descripcion}
									onChange={(e) => setDescripcion(e.target.value)}
									placeholder="Ej: Compra de libro de actividades"
									maxLength={120}
									disabled={isLoading || exito}
									autoFocus
									className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] transition-all"
								/>
								<div className="flex justify-between items-center">
									<button
										type="button"
										onClick={() => {
											setModoEscritura(false);
											setDescripcion("");
										}}
										className="text-[11px] font-bold text-[#EE1120] hover:text-[#b30000] transition-colors"
									>
										« Volver a la lista
									</button>
									<p className="text-[10px] text-gray-400">
										{descripcion.length}/120
									</p>
								</div>
							</div>
						)}
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-semibold text-gray-700 mb-1.5">
								Monto (ARS)
							</label>
							<div className="relative">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
									$
								</span>
								<input
									type="number"
									value={monto}
									onChange={(e) => {
										setMonto(e.target.value);
										if (isSplitPayment && partialPayments.length === 1) {
											setPartialPayments([
												{
													method: partialPayments[0].method,
													amount: Number(e.target.value),
												},
											]);
										}
									}}
									placeholder="0"
									min={1}
									disabled={isLoading || exito}
									className="w-full pl-7 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] transition-all"
								/>
							</div>
						</div>

						<div>
							<label className="block text-sm font-semibold text-gray-700 mb-1.5">
								Fecha
							</label>
							<input
								type="date"
								value={fecha}
								onChange={(e) => setFecha(e.target.value)}
								disabled={isLoading || exito}
								className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] transition-all"
							/>
						</div>
					</div>

					{/* Método de Pago */}
					<div className="space-y-3">
						<label className="block text-sm font-semibold text-gray-700 mb-1.5">
							<span className="flex items-center gap-1.5">
								<CreditCard className="w-3.5 h-3.5 text-gray-400" />
								Método de Pago
							</span>
						</label>
						<select
							value={isSplitPayment ? "multiple" : metodoPago}
							onChange={(e) => {
								if (e.target.value === "multiple") {
									setIsSplitPayment(true);
									setMetodoPago("");
									setPartialPayments([{ method: "", amount: montoNum }]);
								} else {
									setIsSplitPayment(false);
									setMetodoPago(e.target.value);
								}
							}}
							disabled={isLoading || exito}
							className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] transition-all bg-white"
						>
							<option value="" disabled>
								Seleccioná un método...
							</option>
							<option value="Efectivo">Efectivo</option>
							<option value="Transferencia Bancaria (Verificada)">
								Transferencia Bancaria (Verificada)
							</option>
							<option value="Tarjeta (Posnet)">Tarjeta (Posnet)</option>
							<option value="Otro">Otro</option>
							<option value="multiple" className="font-bold text-blue-700">
								💳 Múltiples métodos (Ej: Efectivo + Transferencia)
							</option>
						</select>

						{isSplitPayment && (
							<div className="p-4 border border-blue-200 bg-blue-50/30 rounded-xl space-y-3">
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
											disabled={isLoading || exito}
										>
											<option value="">Método...</option>
											<option value="Efectivo">Efectivo</option>
											<option value="Transferencia">Transferencia</option>
											<option value="Tarjeta">Tarjeta</option>
											<option value="Otro">Otro</option>
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
												disabled={isLoading || exito}
												className="w-full pl-6 pr-2 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
												placeholder="0"
											/>
										</div>

										{partialPayments.length > 1 ? (
											<button
												type="button"
												onClick={() => removePartialPayment(index)}
												disabled={isLoading || exito}
												className="p-2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
											>
												<Trash2 className="w-3.5 h-3.5" />
											</button>
										) : (
											<div className="w-[34px]" />
										)}
									</div>
								))}

								{saldoRestante > 0 && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={addPartialPayment}
										disabled={isLoading || exito}
										className="w-full mt-2 border-dashed border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400"
									>
										<Plus className="w-3.5 h-3.5 mr-1.5" /> Agregar otro pago
										por ${saldoRestante.toLocaleString("es-AR")}
									</Button>
								)}

								{saldoRestante < 0 && (
									<p className="text-[10px] text-red-500 font-medium text-center">
										Los montos superan el total del ingreso. Ajuste los valores.
									</p>
								)}
							</div>
						)}
					</div>

					<div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between mt-2">
						<p className="text-xs text-gray-500">Registrado por</p>
						<p className="text-xs font-semibold text-gray-700">
							{adminData?.nombre || adminData?.email || "Admin"}
						</p>
					</div>
				</div>

				<div className="px-6 py-4 flex gap-3 justify-end border-t border-gray-100 bg-gray-50/50">
					<button
						onClick={handleClose}
						disabled={isLoading || exito}
						className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 bg-white"
					>
						Cancelar
					</button>
					<button
						onClick={handleSubmit}
						disabled={isLoading || exito || (!metodoPago && !isSplitPayment)}
						className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#252d62] text-white rounded-lg hover:bg-[#1a2050] transition-all disabled:opacity-50 shadow-sm"
					>
						{isLoading ? (
							<>
								<Loader2 className="w-4 h-4 animate-spin" />
								Guardando...
							</>
						) : (
							<>
								<DollarSign className="w-4 h-4" />
								Registrar ingreso
							</>
						)}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
