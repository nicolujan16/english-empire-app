"use client";

/**
 * "Mis recibos": los recibos de sueldo de la persona logueada, con la imagen del
 * recibo (la misma que genera el director) para ver y descargar.
 * Se usa en el portal docente (profesoras) y en el panel de admin (secretarias).
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, FileText, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModalDetalleRecibo from "@/components/admin/asistencia-personal/recibos/ModalDetalleRecibo";
import { formatPesos } from "@/lib/asistencia/dinero";
import { fechaCorta, nombrePeriodo } from "@/lib/asistencia/fechas";
import { useMisRecibos, type FiltroMisRecibos } from "@/lib/asistencia/misRecibos";
import { leerImagenRecibo } from "@/lib/asistencia/repositorioCalendario";
import type { ReciboPublicado } from "@/lib/asistencia/tipos";

const ACENTOS = {
	navy: { texto: "text-[#252d62]", caja: "bg-indigo-50 text-[#252d62]", boton: "bg-[#252d62] hover:bg-[#1a2046]" },
	indigo: { texto: "text-[#4338ca]", caja: "bg-indigo-50 text-[#4338ca]", boton: "bg-[#4338ca] hover:bg-[#3730a3]" },
};

export default function MisRecibos({
	filtro,
	acento = "navy",
	textoVacio = "Todavía no tenés recibos. Cuando administración genere tu recibo del mes, va a aparecer acá.",
}: {
	/** null mientras no se sabe quién es (sesión cargando) */
	filtro: FiltroMisRecibos | null;
	acento?: keyof typeof ACENTOS;
	textoVacio?: string;
}) {
	const { recibos, error, cargando } = useMisRecibos(filtro);
	const [abierto, setAbierto] = useState<ReciboPublicado | null>(null);
	const a = ACENTOS[acento];

	if (cargando) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className={`w-8 h-8 animate-spin ${a.texto}`} />
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
				<AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
				<p className="text-sm text-red-700">{error}</p>
			</div>
		);
	}

	if (!recibos || recibos.length === 0) {
		return (
			<div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
				<FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
				<p className="text-gray-500 font-medium">{textoVacio}</p>
			</div>
		);
	}

	return (
		<>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{recibos.map((r, idx) => (
					<motion.div
						key={r.id}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: Math.min(idx, 8) * 0.05 }}
						className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col"
					>
						<div className="flex items-start gap-3 mb-4">
							<div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.caja}`}>
								<FileText className="w-5 h-5" />
							</div>
							<div className="min-w-0">
								<h4 className="font-bold text-gray-900 text-lg leading-tight capitalize">
									{nombrePeriodo(r.periodo)}
								</h4>
								<p className="text-xs text-gray-500 mt-0.5">
									{r.numeroTexto ? `Recibo N° ${r.numeroTexto}` : "Recibo"}
									{r.fechaEmision && ` · emitido el ${fechaCorta(r.fechaEmision)}`}
								</p>
							</div>
						</div>
						<div className="flex-1">
							<p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
								Total a cobrar
							</p>
							<p className={`text-2xl font-black ${a.texto}`}>{formatPesos(r.total)}</p>
						</div>
						<Button
							onClick={() => setAbierto(r)}
							className={`mt-4 w-full text-white font-bold rounded-xl flex items-center justify-center gap-2 ${a.boton}`}
						>
							<Eye className="w-4 h-4" /> Ver recibo
						</Button>
					</motion.div>
				))}
			</div>

			{abierto && (
				<ModalDetalleRecibo
					key={`${abierto.id}-${abierto.version}`}
					titulo={abierto.numeroTexto ? `Recibo N° ${abierto.numeroTexto}` : "Recibo"}
					subtitulo={nombrePeriodo(abierto.periodo)}
					nombreArchivo={`Recibo ${abierto.numeroTexto?.replace("/", "-") ?? abierto.periodo} - ${abierto.nombreRecibo}.jpg`}
					cargar={async () => {
						const guardada = await leerImagenRecibo(abierto.id);
						if (!guardada) throw new Error("La imagen de este recibo todavía no está lista.");
						return { imagen: guardada.imagen, guardada: true };
					}}
					onCerrar={() => setAbierto(null)}
				/>
			)}
		</>
	);
}
