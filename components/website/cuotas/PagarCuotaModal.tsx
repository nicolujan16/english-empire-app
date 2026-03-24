"use client";

import React, { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
	Loader2,
	CreditCard,
	Banknote,
	ShieldCheck,
	AlertCircle,
	Tag,
} from "lucide-react";
import {
	type Cuota,
	calcularPrecioBase,
	aplicarDescuentos,
} from "@/lib/cuotas";

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

interface PagarCuotaModalProps {
	cuota: Cuota | null;
	isOpen: boolean;
	onClose: () => void;
}

export default function PagarCuotaModal({
	cuota,
	isOpen,
	onClose,
}: PagarCuotaModalProps) {
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!cuota) return null;

	const tieneDescuentos = cuota.descuentos && cuota.descuentos.length > 0;
	const totalDescuento =
		cuota.descuentos?.reduce((acc, d) => acc + d.porcentaje, 0) ?? 0;
	const precioBase = calcularPrecioBase(cuota);
	const montoFinal = aplicarDescuentos(precioBase, cuota.descuentos);
	const ahorro = precioBase - montoFinal;

	const handlePagar = async () => {
		setIsProcessing(true);
		setError(null);

		try {
			const response = await fetch("/api/pagar-cuota", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ cuotaId: cuota.id }),
			});

			const data = await response.json();

			if (!response.ok) {
				setError(data.error || "Ocurrió un error al procesar el pago.");
				setIsProcessing(false);
				return;
			}

			window.location.href = data.init_point;
		} catch (err) {
			console.error(err);
			setError("Hubo un problema de conexión. Intentá de nuevo.");
			setIsProcessing(false);
		}
	};

	const handleClose = () => {
		if (isProcessing) return;
		setError(null);
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle className="text-2xl font-bold text-[#252d62]">
						Pagar Cuota
					</DialogTitle>
				</DialogHeader>

				{/* Resumen */}
				<div className="bg-gray-50 rounded-xl p-4 space-y-3 my-2">
					<div className="flex justify-between text-sm">
						<span className="text-gray-500">Curso</span>
						<span className="font-semibold text-gray-900">
							{cuota.cursoNombre}
						</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-500">Alumno</span>
						<span className="font-semibold text-gray-900">
							{cuota.alumnoNombre}
						</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-500">Período</span>
						<span className="font-semibold text-gray-900">
							{MESES[cuota.mes - 1]} {cuota.anio}
						</span>
					</div>

					{/* Desglose de descuentos */}
					{tieneDescuentos && (
						<>
							<div className="border-t border-gray-200 pt-3 space-y-2">
								<div className="flex justify-between text-sm">
									<span className="text-gray-500">Precio base</span>
									<span className="text-gray-500 line-through">
										${precioBase.toLocaleString("es-AR")}
									</span>
								</div>
								{cuota.descuentos!.map((d, i) => (
									<div key={i} className="flex justify-between text-sm">
										<span className="flex items-center gap-1.5 text-emerald-600 font-medium">
											<Tag className="w-3 h-3" />
											{d.detalle}
										</span>
										<span className="text-emerald-600 font-bold">
											−{d.porcentaje}%
										</span>
									</div>
								))}
								<div className="flex justify-between text-sm text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1.5">
									<span className="font-medium">Ahorrás</span>
									<span className="font-bold">
										−${ahorro.toLocaleString("es-AR")} ({totalDescuento}% off)
									</span>
								</div>
							</div>
						</>
					)}

					{/* Total */}
					<div
						className={`${tieneDescuentos ? "" : "border-t border-gray-200 pt-3"} flex justify-between items-center`}
					>
						<span className="font-bold text-gray-900">Total a pagar</span>
						<div className="flex flex-col items-end">
							<span className="font-bold text-xl text-[#EE1120]">
								${montoFinal.toLocaleString("es-AR")}
							</span>
							{tieneDescuentos && (
								<span className="text-[10px] text-emerald-600 font-medium">
									Con {totalDescuento}% de descuento aplicado
								</span>
							)}
						</div>
					</div>
				</div>

				{/* Método de pago */}
				<div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50/30">
					<div className="flex items-center gap-3 mb-2">
						<div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center">
							<div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
						</div>
						<div className="flex items-center gap-2">
							<Banknote className="w-5 h-5 text-green-600" />
							<span className="font-bold text-sm text-gray-800">
								Mercado Pago
							</span>
						</div>
					</div>
					<p className="text-xs text-gray-500 ml-8">
						Tarjeta de crédito, débito o efectivo
					</p>
				</div>

				{/* SSL */}
				<div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
					<ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
					Tus datos están protegidos con encriptación SSL de 256 bits
				</div>

				{/* Error */}
				{error && (
					<div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
						<AlertCircle className="w-4 h-4 flex-shrink-0" />
						{error}
					</div>
				)}

				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						variant="outline"
						onClick={handleClose}
						disabled={isProcessing}
						className="text-[#252d62] border-[#252d62] hover:bg-[#252d62] hover:text-white transition-all"
					>
						Cancelar
					</Button>
					<Button
						onClick={handlePagar}
						disabled={isProcessing}
						className="bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold transition-all"
					>
						{isProcessing ? (
							<>
								<Loader2 className="w-4 h-4 mr-2 animate-spin" />
								Procesando...
							</>
						) : (
							<>
								<CreditCard className="w-4 h-4 mr-2" />
								Pagar ${montoFinal.toLocaleString("es-AR")}
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
