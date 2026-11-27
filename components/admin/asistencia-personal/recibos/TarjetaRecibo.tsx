"use client";

/**
 * Vista previa del recibo de una persona, con su estado y el botón para generarlo.
 * Muestra las partes que tenga (horas, clases, cursos, reemplazos): una secretaria
 * puede tener reemplazos, o ser también profesora, y todo va en un solo recibo.
 */
import React, { useState } from "react";
import {
	AlertCircle,
	AlertTriangle,
	Briefcase,
	CheckCircle2,
	ChevronDown,
	Clock,
	Eye,
	FileCheck2,
	ImageUp,
	GraduationCap,
	Loader2,
	Repeat,
	RotateCw,
	FilePen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPesos } from "@/lib/asistencia/dinero";
import {
	fechaConDia,
	fechaHoraCorta,
	formatMinutos,
	iniciales,
	nombrePeriodo,
} from "@/lib/asistencia/fechas";
import type { EstadoRecibo, Liquidacion } from "@/lib/asistencia/liquidacion";
import {
	totalDelRecibo,
	type Recibo,
	type ReemplazoLiquidado,
} from "@/lib/asistencia/tipos";

const BADGE_ESTADO: Record<
	EstadoRecibo,
	{ texto: string; clase: string; icono: React.ComponentType<{ className?: string }> }
> = {
	sin_generar: {
		texto: "Sin generar",
		clase: "bg-gray-100 text-gray-500",
		icono: FileCheck2,
	},
	generado: {
		texto: "Generado",
		clase: "bg-green-50 text-green-700",
		icono: CheckCircle2,
	},
	desactualizado: {
		texto: "Desactualizado",
		clase: "bg-amber-50 text-amber-700",
		icono: AlertTriangle,
	},
};

/** Total y detalle de los reemplazos de un tipo ("dio" suma, "recibio" resta) */
function FilaReemplazos({
	reemplazos,
	tipo,
}: {
	reemplazos: ReemplazoLiquidado[];
	tipo: ReemplazoLiquidado["tipo"];
}) {
	const lista = reemplazos.filter((r) => r.tipo === tipo);
	if (lista.length === 0) return null;
	const total = lista.reduce((acc, r) => acc + r.monto, 0);
	const clases = new Set(lista.map((r) => r.claseId)).size;
	const otras = [...new Set(lista.map((r) => r.otraNombre).filter(Boolean))];
	const detalle = lista
		.map(
			(r) =>
				`${fechaConDia(r.fecha)} · ${r.cursoNombre} · ${r.otraNombre}: ${formatPesos(r.monto)} (pago mensual ÷ ${r.clasesDelMes} clases)`,
		)
		.join("\n");
	return (
		<Fila label={tipo === "dio" ? "Reemplazos que dio" : "La reemplazaron"}>
			<span title={detalle} className={tipo === "dio" ? "text-green-700" : "text-red-700"}>
				{tipo === "dio" ? "+ " : "− "}
				{formatPesos(total)}
				<span className="block text-xs font-normal text-gray-400">
					{clases} clase{clases === 1 ? "" : "s"}
					{otras.length > 0 && ` · ${tipo === "dio" ? "a" : "por"} ${otras.join(", ")}`}
				</span>
			</span>
		</Fila>
	);
}

function Fila({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-baseline justify-between gap-3 text-sm">
			<dt className="text-gray-500">{label}</dt>
			<dd className="font-medium text-gray-900 text-right">{children}</dd>
		</div>
	);
}

export default function TarjetaRecibo({
	periodo,
	liquidacion: l,
	recibo,
	estado,
	generando,
	error,
	onGenerar,
	onGuardarImagen,
	onVerDetalle,
	onEditar,
}: {
	periodo: string;
	liquidacion: Liquidacion;
	recibo?: Recibo;
	estado: EstadoRecibo;
	generando: boolean;
	error?: string;
	onGenerar: () => void;
	/** Reintentar solo la imagen, sin cambiar la versión */
	onGuardarImagen: () => void;
	onVerDetalle: () => void;
	/** Abre el editor del recibo (se puede editar antes o después de generarlo) */
	onEditar: () => void;
}) {
	const edicion = recibo?.edicion ?? null;
	const [verClases, setVerClases] = useState(false);
	const badge = BADGE_ESTADO[estado];
	// Se guardaron los datos pero no la imagen (por ejemplo, se cortó la conexión)
	const faltaImagen =
		!!recibo && estado === "generado" && recibo.imagenVersion !== recibo.version;
	const BadgeIcono = badge.icono;

	return (
		<div
			className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col ${
				estado === "desactualizado" ? "border-amber-200" : "border-gray-100"
			}`}
		>
			{/* Encabezado */}
			<div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-start justify-between gap-3">
				<div className="flex items-center gap-3 min-w-0">
					<div className="w-10 h-10 rounded-full bg-[#252d62] text-white flex items-center justify-center font-bold text-sm tracking-widest shrink-0">
						{iniciales(l.nombre)}
					</div>
					<div className="min-w-0">
						<p className="font-bold text-gray-900 truncate">{l.nombre}</p>
						{l.rol === "secretaria" ? (
							<span className="inline-flex items-center gap-1 text-xs font-semibold text-[#252d62]">
								<Briefcase className="w-3 h-3" /> Secretaria
								{l.tambienProfesora && (
									<span className="inline-flex items-center gap-1 text-purple-700">
										· <GraduationCap className="w-3 h-3" /> Profesora
									</span>
								)}
							</span>
						) : (
							<span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700">
								<GraduationCap className="w-3 h-3" /> Profesora
							</span>
						)}
					</div>
				</div>
				<span
					className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${badge.clase}`}
				>
					<BadgeIcono className="w-3 h-3" /> {badge.texto}
				</span>
			</div>

			{/* Recibo */}
			<div className="p-5 space-y-4 flex-1">
				<dl className="space-y-2">
					<Fila label="Período">{nombrePeriodo(periodo)}</Fila>
					{l.totalMinutos !== null && (
						<>
							<Fila label="Horas de secretaria">
								{formatMinutos(l.totalMinutos)}
								{l.minutosEnClase > 0 && (
									<span className="block text-xs font-normal text-gray-400">
										sin {formatMinutos(l.minutosEnClase)} dando clase en su turno
									</span>
								)}
							</Fila>
							<Fila label="Precio por hora">
								{l.precioHora === null ? (
									<span className="text-amber-600 font-semibold">Sin precio</span>
								) : (
									formatPesos(l.precioHora)
								)}
							</Fila>
						</>
					)}
					{(l.rol === "profesora" || l.clases.length > 0 || l.cursos.length > 0) && (
						<>
							<Fila label="Clases dadas">{l.totalClases}</Fila>
							{l.cursos.length === 0 ? (
								l.rol === "profesora" && (
									<Fila label="Cursos">
										<span className="text-gray-400">Ninguno vigente</span>
									</Fila>
								)
							) : (
								l.cursos.map((c) => (
									<Fila key={c.cursoId} label={c.cursoNombre}>
										{c.cantidadAlumnos === null ||
										c.montoFijo === null ||
										c.porcentaje === null ? (
											<span className="text-amber-600 font-semibold">
												Faltan datos
											</span>
										) : (
											<span title={`${c.cantidadAlumnos} alumnos × ${formatPesos(c.montoFijo)} × ${c.porcentaje}%`}>
												{formatPesos(c.total)}
												<span className="block text-xs font-normal text-gray-400">
													{c.cantidadAlumnos} al. × {formatPesos(c.montoFijo)} ×{" "}
													{c.porcentaje}%
												</span>
											</span>
										)}
									</Fila>
								))
							)}
							<FilaReemplazos reemplazos={l.reemplazos} tipo="dio" />
							<FilaReemplazos reemplazos={l.reemplazos} tipo="recibio" />
						</>
					)}
				</dl>

				<div className="pt-3 border-t border-dashed border-gray-200 flex items-baseline justify-between gap-3">
					<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
						Total a cobrar
					</p>
					<p className="text-2xl font-black text-[#252d62]">
						{formatPesos(l.totalAPagar)}
					</p>
				</div>

				{edicion && (
					<p className="text-xs text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
						<FilePen className="w-3.5 h-3.5 shrink-0 mt-px" />
						<span>
							<strong>Editado a mano</strong>
							{edicion.editadoEn ? ` el ${fechaHoraCorta(edicion.editadoEn)}` : ""}: el
							recibo dice <strong>{formatPesos(edicion.total)}</strong>
							{edicion.total !== l.totalAPagar ? " (distinto de lo calculado)" : ""}.
						</span>
					</p>
				)}

				{l.faltaPrecio && (
					<p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
						<AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
						{l.totalMinutos !== null && l.precioHora === null && l.totalMinutos > 0
							? "Falta cargar su precio por hora: esa parte se calculó en $0."
							: "A un curso le faltan alumnos, monto fijo o porcentaje: esa parte se calculó en $0."}
					</p>
				)}

				{/* Detalle de clases */}
				{l.clases.length > 0 && (
					<div>
						<button
							type="button"
							onClick={() => setVerClases((v) => !v)}
							className="w-full flex items-center justify-between text-sm font-semibold text-[#252d62] hover:text-[#4338ca] transition-colors"
						>
							{verClases ? "Ocultar" : "Ver"} detalle de las {l.clases.length}{" "}
							clase{l.clases.length === 1 ? "" : "s"}
							<ChevronDown
								className={`w-4 h-4 transition-transform ${verClases ? "rotate-180" : ""}`}
							/>
						</button>
						{verClases && (
							<ul className="mt-2 bg-gray-50 border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-64 overflow-y-auto">
								{l.clases.map((c) => (
									<li
										key={c.claseId}
										className="px-3 py-2 flex items-center justify-between gap-3 text-xs"
									>
										<div className="min-w-0">
											<p className="font-semibold text-gray-800 truncate">
												{fechaConDia(c.fecha)} · {c.cursoNombre}
											</p>
											<p className="text-gray-500 flex items-center gap-1">
												<Clock className="w-3 h-3" /> {c.horaInicio}–{c.horaFin}
												{c.esReemplazo && (
													<span className="inline-flex items-center gap-1 ml-1 text-indigo-700 font-semibold">
														<Repeat className="w-3 h-3" /> Reemplazo
													</span>
												)}
											</p>
										</div>
									</li>
								))}
							</ul>
						)}
					</div>
				)}

				{/* Recibo guardado */}
				{recibo && estado === "desactualizado" && (
					<p className="text-xs text-amber-700">
						El recibo guardado (versión {recibo.version}) dice{" "}
						<strong>{formatPesos(totalDelRecibo(recibo))}</strong>. El registro cambió
						después:{" "}
						{edicion
							? "revisalo en “Editar recibo” o volvé a generarlo (se pierden los cambios a mano)."
							: "volvé a generarlo."}
					</p>
				)}
				{recibo && estado === "generado" && (
					<p className="text-xs text-gray-400">
						{recibo.numeroTexto ? `N° ${recibo.numeroTexto} · ` : ""}
						Generado
						{recibo.generadoEn ? ` el ${fechaHoraCorta(recibo.generadoEn)}` : ""} ·
						versión {recibo.version}
					</p>
				)}
				{faltaImagen && (
					<p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
						<AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
						Los datos están guardados, pero falta la imagen del recibo.
					</p>
				)}

				{error && (
					<p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
						<AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /> {error}
					</p>
				)}
			</div>

			{/* Acciones */}
			<div className="p-4 border-t border-gray-100 grid grid-cols-2 gap-2">
				<Button
					variant="ghost"
					onClick={onEditar}
					disabled={generando}
					className="col-span-2 text-[#252d62] hover:bg-indigo-50 font-bold rounded-xl flex items-center justify-center gap-2"
				>
					<FilePen className="w-4 h-4" /> {edicion ? "Editar recibo (editado)" : "Editar recibo"}
				</Button>
				<Button
					variant="outline"
					onClick={onVerDetalle}
					disabled={generando}
					className="border-gray-200 text-gray-700 hover:bg-gray-50 font-bold py-5 rounded-xl flex items-center justify-center gap-2"
				>
					<Eye className="w-4 h-4" /> Ver detalle
				</Button>
				<Button
					onClick={faltaImagen ? onGuardarImagen : onGenerar}
					disabled={generando}
					variant={estado === "generado" && !faltaImagen ? "outline" : "default"}
					className={`font-bold py-5 rounded-xl flex items-center justify-center gap-2 ${
						estado === "generado" && !faltaImagen
							? "border-[#252d62] text-[#252d62] hover:bg-[#252d62]/5"
							: "bg-[#252d62] hover:bg-[#1a2046] text-white"
					}`}
				>
					{generando ? (
						<Loader2 className="w-4 h-4 animate-spin" />
					) : faltaImagen ? (
						<ImageUp className="w-4 h-4" />
					) : estado === "sin_generar" ? (
						<FileCheck2 className="w-4 h-4" />
					) : (
						<RotateCw className="w-4 h-4" />
					)}
					{generando
						? "Generando..."
						: faltaImagen
							? "Guardar imagen"
							: estado === "sin_generar"
								? "Generar recibo"
								: "Volver a generar"}
				</Button>
			</div>
		</div>
	);
}
