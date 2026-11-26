"use client";

/**
 * "Ver detalle" de un recibo: muestra la imagen guardada o, si todavía no se
 * generó, una vista previa con el mismo diseño. Se puede descargar.
 */
import React, { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, Download, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { mensajeDeError } from "@/components/admin/asistencia-personal/carga/ui";

export interface ImagenDetalle {
	imagen: string; // data URL JPG
	/** true = es la imagen guardada; false = vista previa armada en el momento */
	guardada: boolean;
	aviso?: string;
}

export default function ModalDetalleRecibo({
	titulo,
	subtitulo,
	nombreArchivo,
	cargar,
	onCerrar,
}: {
	titulo: string;
	subtitulo: string;
	nombreArchivo: string;
	cargar: () => Promise<ImagenDetalle>;
	onCerrar: () => void;
}) {
	const [detalle, setDetalle] = useState<ImagenDetalle | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let vigente = true;
		cargar()
			.then((d) => vigente && setDetalle(d))
			.catch((e) => vigente && setError(mensajeDeError(e)));
		return () => {
			vigente = false;
		};
		// Se carga una sola vez por apertura (el modal se monta con key)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<Dialog open onOpenChange={(o) => !o && onCerrar()}>
			<DialogContent className="sm:max-w-[680px] p-0 gap-0 overflow-hidden rounded-2xl max-h-[92vh] flex flex-col">
				<div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
					<div className="bg-[#252d62] p-2 rounded-lg">
						<Eye className="w-4 h-4 text-white" />
					</div>
					<div className="min-w-0">
						<DialogTitle className="text-lg font-bold text-[#252d62]">
							{titulo}
						</DialogTitle>
						<DialogDescription className="text-xs text-gray-500 mt-0.5">
							{subtitulo}
						</DialogDescription>
					</div>
				</div>

				<div className="p-4 sm:p-6 bg-gray-100 overflow-y-auto space-y-3">
					{detalle && !detalle.guardada && (
						<p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
							<strong>Vista previa.</strong> Todavía no se guardó: el número se
							asigna al generar el recibo.
						</p>
					)}
					{detalle?.aviso && (
						<p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
							<AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
							{detalle.aviso}
						</p>
					)}

					{error ? (
						<div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
							<AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
							<p className="text-sm text-red-700">{error}</p>
						</div>
					) : detalle ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={detalle.imagen}
							alt={titulo}
							className="w-full h-auto bg-white rounded-lg shadow-md"
						/>
					) : (
						<div className="flex items-center justify-center h-96">
							<Loader2 className="w-8 h-8 animate-spin text-[#252d62]" />
						</div>
					)}
				</div>

				<div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-2 shrink-0">
					<Button
						variant="ghost"
						onClick={onCerrar}
						className="font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
					>
						Cerrar
					</Button>
					{detalle && (
						<Button
							asChild
							className="bg-[#252d62] hover:bg-[#1a2046] text-white font-bold rounded-xl"
						>
							<a href={detalle.imagen} download={nombreArchivo}>
								<Download className="w-4 h-4 mr-2" /> Descargar imagen
							</a>
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
