"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAdminAuth } from "@/context/AdminAuthContext";

interface RegistrarIngresoModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void; // para refrescar la lista al guardar
}

const SUGERENCIAS = [
	"Venta de uniforme",
	"Venta de útiles escolares",
	"Alquiler de espacio",
	"Donación",
	"Otro",
];

export default function RegistrarIngresoModal({
	isOpen,
	onClose,
	onSuccess,
}: RegistrarIngresoModalProps) {
	const { adminData } = useAdminAuth();

	const [descripcion, setDescripcion] = useState("");
	const [monto, setMonto] = useState("");
	const [fecha, setFecha] = useState(
		new Date().toISOString().split("T")[0], // hoy por defecto
	);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [exito, setExito] = useState(false);

	const handleClose = () => {
		if (isLoading) return;
		setDescripcion("");
		setMonto("");
		setFecha(new Date().toISOString().split("T")[0]);
		setError(null);
		setExito(false);
		onClose();
	};

	const handleSubmit = async () => {
		setError(null);

		if (!descripcion.trim()) {
			setError("La descripción es obligatoria.");
			return;
		}
		if (!monto || isNaN(Number(monto)) || Number(monto) <= 0) {
			setError("El monto debe ser un número mayor a cero.");
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
				monto: Number(monto),
				fecha: new Date(fecha + "T12:00:00"), // evitar problemas de timezone
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
				{/* Header */}
				<DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
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

				{/* Contenido */}
				<div className="px-6 py-5 space-y-5">
					{/* Estado de éxito */}
					{exito && (
						<div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
							<CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
							<p className="text-sm font-semibold text-green-800">
								¡Ingreso registrado correctamente!
							</p>
						</div>
					)}

					{/* Error */}
					{error && (
						<div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
							<AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
							<p className="text-sm text-red-700">{error}</p>
						</div>
					)}

					{/* Descripción */}
					<div>
						<label className="block text-sm font-semibold text-gray-700 mb-1.5">
							<span className="flex items-center gap-1.5">
								<FileText className="w-3.5 h-3.5 text-gray-400" />
								Descripción
							</span>
						</label>
						<input
							type="text"
							value={descripcion}
							onChange={(e) => setDescripcion(e.target.value)}
							placeholder="Ej: Venta de 3 uniformes escolares"
							maxLength={120}
							className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] transition-all"
						/>
						<p className="text-xs text-gray-400 mt-1 text-right">
							{descripcion.length}/120
						</p>

						{/* Sugerencias rápidas */}
						<div className="flex flex-wrap gap-1.5 mt-2">
							{SUGERENCIAS.map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => setDescripcion(s)}
									className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-[#252d62] hover:text-[#252d62] hover:bg-[#252d62]/5 transition-all"
								>
									{s}
								</button>
							))}
						</div>
					</div>

					{/* Monto y fecha en fila */}
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
									onChange={(e) => setMonto(e.target.value)}
									placeholder="0"
									min={1}
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
								className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] transition-all"
							/>
						</div>
					</div>

					{/* Registrado por */}
					<div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between">
						<p className="text-xs text-gray-500">Registrado por</p>
						<p className="text-xs font-semibold text-gray-700">
							{adminData?.nombre || adminData?.email || "Admin"}
						</p>
					</div>
				</div>

				{/* Footer */}
				<div className="px-6 pb-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
					<button
						onClick={handleClose}
						disabled={isLoading}
						className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50"
					>
						Cancelar
					</button>
					<button
						onClick={handleSubmit}
						disabled={isLoading || exito}
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
