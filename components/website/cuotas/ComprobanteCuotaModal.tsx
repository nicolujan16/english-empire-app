"use client";

import React, { useRef } from "react";
import Image from "next/image";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, CheckCircle2 } from "lucide-react";
import logoEmpire from "@/assets/logo-empire.png";

interface Cuota {
	id: string;
	alumnoNombre: string;
	alumnoDni: string;
	alumnoTipo: "adulto" | "menor";
	cursoNombre: string;
	mes: number;
	anio: number;
	montoPagado: number | null;
	fechaPago: string | null;
	metodoPago: string | null;
	paymentId?: string;
}

interface ComprobanteModalProps {
	cuota: Cuota | null;
	isOpen: boolean;
	onClose: () => void;
}

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

export default function ComprobanteCuotaModal({
	cuota,
	isOpen,
	onClose,
}: ComprobanteModalProps) {
	const printRef = useRef<HTMLDivElement>(null);

	if (!cuota) return null;

	const numeroComprobante = cuota.paymentId
		? `TXN-${cuota.paymentId.slice(-8).toUpperCase()}`
		: `TXN-${cuota.id.slice(-8).toUpperCase()}`;

	const handlePrint = () => {
		const ventana = window.open("", "_blank");
		if (!ventana) return;

		// URL absoluta para que funcione en la ventana de impresión
		const logoUrl = `${window.location.origin}${logoEmpire.src}`;

		ventana.document.write(`
			<html>
				<head>
					<title>Comprobante — ${cuota.alumnoNombre}</title>
					<style>
						* { margin: 0; padding: 0; box-sizing: border-box; }
						body { font-family: Georgia, serif; background: white; color: #1a1a2e; }
						.comprobante { max-width: 600px; margin: 32px auto; padding: 40px; }
						.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #252d62; padding-bottom: 20px; margin-bottom: 24px; }
						.logo { height: 64px; width: auto; }
						.subtitulo { font-size: 11px; color: #888; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px; }
						.comp-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; text-align: right; }
						.comp-num { font-size: 13px; font-weight: bold; color: #252d62; font-family: monospace; margin-top: 4px; }
						.sello { display: flex; align-items: center; gap: 8px; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 10px 16px; margin-bottom: 24px; }
						.sello-icon { width: 20px; height: 20px; color: #16a34a; }
						.sello-title { font-size: 13px; font-weight: bold; color: #166534; }
						.sello-sub { font-size: 11px; color: #16a34a; margin-top: 2px; }
						.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
						.section-title { font-size: 9px; font-weight: bold; color: #aaa; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; }
						.row { display: flex; justify-content: space-between; margin-bottom: 6px; }
						.row-label { font-size: 11px; color: #666; }
						.row-value { font-size: 11px; font-weight: 600; color: #1a1a2e; }
						.tabla { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin-bottom: 24px; }
						.tabla thead { background: #f9fafb; }
						.tabla th { padding: 10px 14px; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; text-align: left; }
						.tabla th:last-child { text-align: right; }
						.tabla td { padding: 12px 14px; font-size: 12px; border-top: 1px solid #e5e7eb; }
						.tabla td:last-child { text-align: right; font-weight: 600; }
						.tabla tfoot { background: #252d62; }
						.tabla tfoot td { padding: 12px 14px; font-size: 13px; font-weight: bold; color: white; text-align: right; }
						.tabla tfoot td:first-child { text-align: right; }
						.footer { border-top: 1px solid #e5e7eb; padding-top: 16px; text-align: center; }
						.footer p { font-size: 10px; color: #aaa; line-height: 1.6; }
					</style>
				</head>
				<body>
					<div class="comprobante">

						<div class="header">
							<div>
								<img src="${logoUrl}" alt="English Empire Institute" class="logo" />
								<p class="subtitulo">Comprobante oficial de pago</p>
							</div>
							<div style="text-align:right; padding-top: 8px;">
								<p class="comp-label">N° Comprobante</p>
								<p class="comp-num">${numeroComprobante}</p>
							</div>
						</div>

						<div class="sello">
							<div>
								<p class="sello-title">✓ Pago acreditado correctamente</p>
								<p class="sello-sub">${cuota.fechaPago} — ${cuota.metodoPago}</p>
							</div>
						</div>

						<div class="grid">
							<div>
								<p class="section-title">Datos del alumno</p>
								<div class="row">
									<span class="row-label">Nombre</span>
									<span class="row-value">${cuota.alumnoNombre}</span>
								</div>
								<div class="row">
									<span class="row-label">DNI</span>
									<span class="row-value">${cuota.alumnoDni}</span>
								</div>
								<div class="row">
									<span class="row-label">Tipo</span>
									<span class="row-value">${cuota.alumnoTipo === "adulto" ? "Titular" : "Menor a cargo"}</span>
								</div>
							</div>
							<div>
								<p class="section-title">Detalles del pago</p>
								<div class="row">
									<span class="row-label">Fecha</span>
									<span class="row-value">${cuota.fechaPago}</span>
								</div>
								<div class="row">
									<span class="row-label">Método</span>
									<span class="row-value">${cuota.metodoPago}</span>
								</div>
							</div>
						</div>

						<table class="tabla">
							<thead>
								<tr>
									<th>Concepto</th>
									<th>Período</th>
									<th>Importe</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td>Cuota mensual — ${cuota.cursoNombre}</td>
									<td>${MESES[cuota.mes - 1]} ${cuota.anio}</td>
									<td>ARS $${cuota.montoPagado?.toLocaleString("es-AR") ?? "-"}</td>
								</tr>
							</tbody>
							<tfoot>
								<tr>
									<td colspan="2">TOTAL ABONADO</td>
									<td>ARS $${cuota.montoPagado?.toLocaleString("es-AR") ?? "-"}</td>
								</tr>
							</tfoot>
						</table>

						<div class="footer">
                <p>Este documento es un comprobante válido de pago emitido por English Empire Institute.</p>
                <p>Este documento no es válido como factura.</p>
                <p>© ${new Date().getFullYear()} English Empire Institute — Todos los derechos reservados</p>
            </div>

					</div>
				</body>
			</html>
		`);

		ventana.document.close();
		ventana.focus();
		setTimeout(() => {
			ventana.print();
			ventana.close();
		}, 500);
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[620px] p-0 overflow-hidden">
				{/* Barra superior del modal */}
				<DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
					<DialogTitle className="text-base font-bold text-[#252d62]">
						Comprobante de Pago
					</DialogTitle>
					<div className="flex items-center gap-2 mr-4">
						<Button
							size="sm"
							variant="outline"
							onClick={handlePrint}
							className="text-xs border-[#252d62] text-[#252d62] hover:bg-[#252d62] hover:text-white transition-all"
						>
							<Printer className="w-3.5 h-3.5 mr-1.5" />
							Imprimir
						</Button>
						{/* <button
							onClick={onClose}
							className="text-gray-400 hover:text-gray-600 transition-colors p-1"
						>
							<X className="w-4 h-4" />
						</button> */}
					</div>
				</DialogHeader>

				{/* Contenido visible en el modal */}
				<div className="overflow-y-auto max-h-[75vh] p-6">
					<div ref={printRef}>
						{/* Header */}
						<div className="flex items-start justify-between border-b-2 border-[#252d62] pb-5 mb-6">
							<div>
								<Image
									src={logoEmpire}
									alt="English Empire Institute"
									height={64}
									className="w-auto"
									priority
								/>
								<p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">
									Comprobante oficial de pago
								</p>
							</div>
							<div className="text-right pt-2">
								<p className="text-[9px] text-gray-400 uppercase tracking-widest">
									N° Comprobante
								</p>
								<p className="font-mono text-sm font-bold text-[#252d62] mt-0.5">
									{numeroComprobante}
								</p>
							</div>
						</div>

						{/* Sello PAGADO */}
						<div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6">
							<CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
							<div>
								<p className="text-sm font-bold text-green-800">
									Pago acreditado correctamente
								</p>
								<p className="text-xs text-green-600">
									{cuota.fechaPago} — {cuota.metodoPago}
								</p>
							</div>
						</div>

						{/* Grid de datos */}
						<div className="grid grid-cols-2 gap-6 mb-6">
							<div>
								<p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">
									Datos del alumno
								</p>
								<div className="space-y-2">
									<div className="flex justify-between">
										<span className="text-xs text-gray-500">Nombre</span>
										<span className="text-xs font-semibold text-gray-900">
											{cuota.alumnoNombre}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-xs text-gray-500">DNI</span>
										<span className="text-xs font-semibold text-gray-900">
											{cuota.alumnoDni}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-xs text-gray-500">Tipo</span>
										<span className="text-xs font-semibold text-gray-900">
											{cuota.alumnoTipo === "adulto"
												? "Titular"
												: "Menor a cargo"}
										</span>
									</div>
								</div>
							</div>

							<div>
								<p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">
									Detalles del pago
								</p>
								<div className="space-y-2">
									<div className="flex justify-between">
										<span className="text-xs text-gray-500">Fecha</span>
										<span className="text-xs font-semibold text-gray-900">
											{cuota.fechaPago}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-xs text-gray-500">Método</span>
										<span className="text-xs font-semibold text-gray-900">
											{cuota.metodoPago}
										</span>
									</div>
								</div>
							</div>
						</div>

						{/* Tabla */}
						<div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
							<table className="w-full text-sm">
								<thead className="bg-gray-50">
									<tr>
										<th className="px-4 py-2.5 text-left text-[9px] font-bold text-gray-500 uppercase tracking-widest">
											Concepto
										</th>
										<th className="px-4 py-2.5 text-left text-[9px] font-bold text-gray-500 uppercase tracking-widest">
											Período
										</th>
										<th className="px-4 py-2.5 text-right text-[9px] font-bold text-gray-500 uppercase tracking-widest">
											Importe
										</th>
									</tr>
								</thead>
								<tbody>
									<tr className="border-t border-gray-100">
										<td className="px-4 py-3 text-xs text-gray-900 font-medium">
											Cuota mensual — {cuota.cursoNombre}
										</td>
										<td className="px-4 py-3 text-xs text-gray-600">
											{MESES[cuota.mes - 1]} {cuota.anio}
										</td>
										<td className="px-4 py-3 text-xs font-semibold text-gray-900 text-right">
											ARS ${cuota.montoPagado?.toLocaleString("es-AR") ?? "-"}
										</td>
									</tr>
								</tbody>
								<tfoot className="bg-[#252d62]">
									<tr>
										<td
											colSpan={2}
											className="px-4 py-3 text-xs font-bold text-white text-right"
										>
											TOTAL ABONADO
										</td>
										<td className="px-4 py-3 text-sm font-bold text-white text-right">
											ARS ${cuota.montoPagado?.toLocaleString("es-AR") ?? "-"}
										</td>
									</tr>
								</tfoot>
							</table>
						</div>

						{/* Footer */}
						<div className="border-t border-gray-100 pt-4 text-center">
							<p className="text-[10px] text-gray-400 leading-relaxed">
								Este documento es un comprobante válido de pago emitido por
								English Empire Institute.
							</p>
							<p className="text-[10px] text-gray-400 mt-0.5">
								Este documento no es válido como factura.
							</p>
							<p className="text-[10px] text-gray-300 mt-1">
								© {new Date().getFullYear()} English Empire Institute — Todos
								los derechos reservados
							</p>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
