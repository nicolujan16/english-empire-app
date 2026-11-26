"use client";

/**
 * Recibos del mes: vista previa de todos y generación de a una persona.
 * El mes viene de la URL (/recibos?periodo=YYYY-MM).
 */
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { rutasAsistencia } from "@/lib/asistencia/rutas";
import { periodoDesde, useConfiguracion } from "@/lib/asistencia/useConfiguracion";
import { motion } from "framer-motion";
import {
	AlertCircle,
	AlertTriangle,
	ArrowLeft,
	ChevronLeft,
	ChevronRight,
	DollarSign,
	FileCheck2,
	Loader2,
	RotateCw,
	Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AvisoPreciosFaltantes from "@/components/admin/asistencia-personal/AvisoPreciosFaltantes";
import { Segmentado, Vacio, mensajeDeError } from "@/components/admin/asistencia-personal/carga/ui";
import { contarARevisar } from "@/lib/asistencia/calendario";
import { formatPesos } from "@/lib/asistencia/dinero";
import { fechaAR, nombrePeriodo, sumarMeses } from "@/lib/asistencia/fechas";
import {
	estadoRecibo,
	preciosFaltantes,
	type Liquidacion,
} from "@/lib/asistencia/liquidacion";
import {
	impresoDesdeLiquidacion,
	impresoDesdeRecibo,
} from "@/lib/asistencia/reciboImpreso";
import {
	generarRecibo,
	guardarImagenRecibo,
	leerImagenRecibo,
} from "@/lib/asistencia/repositorioCalendario";
import {
	periodoActual,
	periodoValido,
	useDatosDelMes,
} from "@/lib/asistencia/useDatosDelMes";
import {
	totalDelRecibo,
	type EdicionRecibo,
	type Recibo,
	type Rol,
} from "@/lib/asistencia/tipos";
import { ModalFormulario } from "@/components/admin/asistencia-personal/carga/ui";
import { capturarRecibo } from "./capturarRecibo";
import ModalDetalleRecibo, { type ImagenDetalle } from "./ModalDetalleRecibo";
import ModalEditarRecibo from "./ModalEditarRecibo";
import TarjetaRecibo from "./TarjetaRecibo";

function Kpi({
	label,
	value,
	hint,
	icono: Icono,
	iconBox,
	valueClass = "text-[#252d62]",
}: {
	label: string;
	value: string | number;
	hint: string;
	icono: React.ComponentType<{ className?: string }>;
	iconBox: string;
	valueClass?: string;
}) {
	return (
		<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
			<div className="flex items-center justify-between mb-3">
				<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
					{label}
				</p>
				<div className={`p-2 rounded-lg ${iconBox}`}>
					<Icono className="w-4 h-4" />
				</div>
			</div>
			<p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
			<p className="text-xs text-gray-400 mt-1">{hint}</p>
		</div>
	);
}

export default function Recibos() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { fechaInicio, periodoMinimo } = useConfiguracion();
	// Los recibos arrancan en el mes de inicio del registro: nunca antes
	const periodo = periodoDesde(
		periodoValido(searchParams.get("periodo")) ?? periodoActual(),
		periodoMinimo,
	);
	const hoy = fechaAR(new Date());

	const {
		personal,
		datos,
		liquidaciones,
		recibos,
		cargando,
		error,
		errorPendientes,
	} = useDatosDelMes(periodo, { esDirector: true, fechaInicio }); // la página solo la abre el director

	const [filtro, setFiltro] = useState<"todos" | Rol>("todos");
	const [generando, setGenerando] = useState<Set<string>>(new Set());
	const [errores, setErrores] = useState<Record<string, string>>({});
	const [detalle, setDetalle] = useState<Liquidacion | null>(null);
	const [editando, setEditando] = useState<Liquidacion | null>(null);
	// "Volver a generar" un recibo editado a mano pisa los cambios: se confirma antes
	const [confirmarRegenerar, setConfirmarRegenerar] = useState<Liquidacion | null>(null);

	const personaDe = (id: string) => personal?.find((p) => p.id === id);

	const cambiarPeriodo = (nuevo: string) =>
		router.replace(rutasAsistencia.recibos(nuevo));

	const estados = useMemo(
		() =>
			new Map(
				liquidaciones.map((l) => [
					l.personalId,
					estadoRecibo(l, recibos.get(l.personalId)),
				]),
			),
		[liquidaciones, recibos],
	);

	const totales = useMemo(() => {
		const lista = [...estados.values()];
		return {
			// Si un recibo fue editado a mano, cuenta lo que dice el recibo
			aPagar: liquidaciones.reduce((acc, l) => {
				const r = recibos.get(l.personalId);
				return acc + (r?.edicion ? totalDelRecibo(r) : l.totalAPagar);
			}, 0),
			generados: lista.filter((e) => e === "generado").length,
			desactualizados: lista.filter((e) => e === "desactualizado").length,
			sinGenerar: lista.filter((e) => e === "sin_generar").length,
		};
	}, [liquidaciones, estados, recibos]);

	const revision = datos ? contarARevisar(datos, hoy) : null;
	const faltantes = useMemo(
		() => preciosFaltantes(liquidaciones),
		[liquidaciones],
	);

	const visibles = liquidaciones.filter((l) => filtro === "todos" || l.rol === filtro);

	/** Corre una acción sobre el recibo de una persona, con su spinner y su error */
	const conEstado = async (personalId: string, accion: () => Promise<void>) => {
		setGenerando((g) => new Set(g).add(personalId));
		setErrores((x) => {
			const resto = { ...x };
			delete resto[personalId];
			return resto;
		});
		try {
			await accion();
		} catch (e) {
			setErrores((x) => ({ ...x, [personalId]: mensajeDeError(e) }));
		} finally {
			setGenerando((g) => {
				const n = new Set(g);
				n.delete(personalId);
				return n;
			});
		}
	};

	const guardarImagen = async (recibo: Recibo) => {
		const imagen = await capturarRecibo(impresoDesdeRecibo(recibo));
		await guardarImagenRecibo(recibo, imagen);
	};

	// 1) guarda los datos con su número  2) dibuja el recibo y guarda la imagen
	const generarAhora = (l: Liquidacion) =>
		conEstado(l.personalId, async () => {
			const recibo = await generarRecibo(periodo, l, personaDe(l.personalId));
			await guardarImagen(recibo);
		});

	const generar = (l: Liquidacion) => {
		if (recibos.get(l.personalId)?.edicion) setConfirmarRegenerar(l);
		else generarAhora(l);
	};

	/** Genera el recibo con lo que editó el director (los errores los muestra el editor) */
	const guardarEdicion = async (
		l: Liquidacion,
		edicion: Omit<EdicionRecibo, "editadoEn">,
	) => {
		const recibo = await generarRecibo(periodo, l, personaDe(l.personalId), edicion);
		await guardarImagen(recibo);
	};

	const reintentarImagen = (recibo: Recibo) =>
		conEstado(recibo.personalId, () => guardarImagen(recibo));

	/** Imagen guardada si está al día; si no, vista previa armada en el momento */
	const cargarDetalle = async (l: Liquidacion): Promise<ImagenDetalle> => {
		const recibo = recibos.get(l.personalId);
		const estado = estados.get(l.personalId);
		if (recibo && recibo.imagenVersion === recibo.version) {
			const guardada = await leerImagenRecibo(recibo.id);
			if (guardada)
				return {
					imagen: guardada.imagen,
					guardada: true,
					aviso:
						estado === "desactualizado"
							? "Este es el recibo guardado. El registro cambió después de generarlo: volvé a generarlo para que tenga los datos actuales."
							: undefined,
				};
		}
		return {
			imagen: await capturarRecibo(
				// Si está editado a mano (y falta la imagen), la vista previa es la edición
				recibo?.edicion
					? impresoDesdeRecibo(recibo)
					: impresoDesdeLiquidacion(l, personaDe(l.personalId), periodo, hoy),
			),
			guardada: false,
		};
	};

	return (
		<div className="p-6 space-y-6 max-w-7xl mx-auto">
			{/* Encabezado */}
			<motion.div
				initial={{ opacity: 0, x: 20 }}
				animate={{ opacity: 1, x: 0 }}
				className="flex flex-col md:flex-row md:items-center justify-between gap-4"
			>
				<div className="flex items-center gap-3">
					<div className="bg-[#252d62] p-2.5 rounded-lg">
						<FileCheck2 className="w-5 h-5 text-white" />
					</div>
					<div>
						<h1 className="text-2xl font-bold text-[#252d62]">Recibos</h1>
						<p className="text-sm text-gray-500">
							Revisá la vista previa y generá el recibo de cada persona
						</p>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
					<Button
						asChild
						variant="ghost"
						className="font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
					>
						<Link href={rutasAsistencia.calendario(periodo)}>
							<ArrowLeft className="w-4 h-4 mr-1" /> Calendario
						</Link>
					</Button>
					<Button
						variant="outline"
						size="icon"
						onClick={() => cambiarPeriodo(sumarMeses(periodo, -1))}
						disabled={periodo <= periodoMinimo}
						title={
							periodo <= periodoMinimo
								? "Los recibos empiezan este mes"
								: undefined
						}
						className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl"
						aria-label="Mes anterior"
					>
						<ChevronLeft className="w-4 h-4" />
					</Button>
					<div className="min-w-[170px] text-center bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
						<p className="text-sm font-bold text-[#252d62]">
							{nombrePeriodo(periodo)}
						</p>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() => cambiarPeriodo(sumarMeses(periodo, 1))}
						className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl"
						aria-label="Mes siguiente"
					>
						<ChevronRight className="w-4 h-4" />
					</Button>
				</div>
			</motion.div>

			{/* Avisos */}
			{error && (
				<div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
					<AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
					<div>
						<p className="text-sm font-bold text-red-800">
							No se pudieron cargar los datos del mes
						</p>
						<p className="text-xs text-red-700">{error}</p>
					</div>
				</div>
			)}
			{revision && revision.total > 0 && (
				<div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
					<AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
					<div className="space-y-1">
						<p className="text-sm font-bold text-amber-800">
							Hay {revision.total} registro{revision.total === 1 ? "" : "s"} para
							revisar en el calendario
						</p>
						<ul className="text-xs text-amber-700 list-disc pl-4 space-y-0.5">
							{revision.incompletas > 0 && (
								<li>
									{revision.incompletas} jornada
									{revision.incompletas === 1 ? "" : "s"} sin salida:{" "}
									<strong>no suman horas</strong> hasta que se completen.
								</li>
							)}
							{revision.sinRegistro > 0 && (
								<li>
									{revision.sinRegistro} clase
									{revision.sinRegistro === 1 ? "" : "s"} sin registro: no se
									cobran.
								</li>
							)}
							{revision.pendientes > 0 && (
								<li>
									{revision.pendientes} fichada
									{revision.pendientes === 1 ? "" : "s"} sin resolver.
								</li>
							)}
						</ul>
						<Link
							href={rutasAsistencia.calendario(periodo)}
							className="inline-block text-xs font-bold text-amber-800 underline hover:text-amber-900"
						>
							Revisar en el calendario
						</Link>
					</div>
				</div>
			)}
			{errorPendientes && !error && (
				<div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
					<AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
					<p className="text-xs text-amber-700">
						No se pudieron cargar las fichadas para revisar. {errorPendientes}
					</p>
				</div>
			)}
			<AvisoPreciosFaltantes faltantes={faltantes} />

			{cargando ? (
				<div className="flex items-center justify-center h-96">
					<Loader2 className="w-10 h-10 animate-spin text-[#252d62]" />
				</div>
			) : (
				!error && (
					<>
						{/* KPIs */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							<Kpi
								label="Total a pagar"
								value={formatPesos(totales.aPagar)}
								hint={`${liquidaciones.length} persona${liquidaciones.length === 1 ? "" : "s"}`}
								icono={DollarSign}
								iconBox="bg-[#252d62]/10 text-[#252d62]"
							/>
							<Kpi
								label="Generados"
								value={`${totales.generados} / ${liquidaciones.length}`}
								hint="Recibos al día"
								icono={FileCheck2}
								iconBox="bg-green-50 text-green-600"
								valueClass="text-gray-900"
							/>
							<Kpi
								label="Para regenerar"
								value={totales.desactualizados}
								hint="Cambió el registro después de generarlos"
								icono={RotateCw}
								iconBox={
									totales.desactualizados > 0
										? "bg-amber-50 text-amber-600"
										: "bg-gray-100 text-gray-400"
								}
								valueClass={
									totales.desactualizados > 0 ? "text-amber-700" : "text-gray-900"
								}
							/>
							<Kpi
								label="Sin generar"
								value={totales.sinGenerar}
								hint="Todavía no tienen recibo"
								icono={Users}
								iconBox="bg-blue-50 text-blue-600"
								valueClass="text-gray-900"
							/>
						</div>

						{/* Filtro */}
						<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
							<Segmentado
								opciones={
									[
										["todos", "Todos"],
										["secretaria", "Secretarias"],
										["profesora", "Profesoras"],
									] as const
								}
								valor={filtro}
								onChange={setFiltro}
							/>
							<p className="text-sm text-gray-500">
								{visibles.length} recibo{visibles.length === 1 ? "" : "s"} ·{" "}
								<span className="font-bold text-[#252d62]">
									{formatPesos(visibles.reduce((a, l) => a + l.totalAPagar, 0))}
								</span>
							</p>
						</div>

						{/* Vista previa */}
						{visibles.length === 0 ? (
							<div className="bg-white rounded-xl border border-gray-100 shadow-sm">
								<Vacio
									icono={Users}
									titulo="No hay recibos para este mes"
									texto="Aparecen las personas activas y las que tuvieron actividad en el mes."
								/>
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
								{visibles.map((l, idx) => (
									<motion.div
										key={l.personalId}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: Math.min(idx, 9) * 0.05 }}
									>
										<TarjetaRecibo
											periodo={periodo}
											liquidacion={l}
											recibo={recibos.get(l.personalId)}
											estado={estados.get(l.personalId) ?? "sin_generar"}
											generando={generando.has(l.personalId)}
											error={errores[l.personalId]}
											onGenerar={() => generar(l)}
											onGuardarImagen={() => {
												const r = recibos.get(l.personalId);
												if (r) reintentarImagen(r);
											}}
											onVerDetalle={() => setDetalle(l)}
											onEditar={() => setEditando(l)}
										/>
									</motion.div>
								))}
							</div>
						)}
					</>
				)
			)}
			{editando && (
				<ModalEditarRecibo
					key={editando.personalId}
					periodo={periodo}
					liquidacion={editando}
					persona={personaDe(editando.personalId)}
					recibo={recibos.get(editando.personalId)}
					hoy={hoy}
					onGuardar={(edicion) => guardarEdicion(editando, edicion)}
					onCerrar={() => setEditando(null)}
				/>
			)}

			<ModalFormulario
				abierto={!!confirmarRegenerar}
				onCerrar={() => setConfirmarRegenerar(null)}
				titulo="¿Volver a generar el recibo?"
				subtitulo={confirmarRegenerar?.nombre}
				icono={RotateCw}
				variante="rojo"
				textoGuardar="Volver a generar"
				onGuardar={() => {
					const l = confirmarRegenerar;
					setConfirmarRegenerar(null);
					if (l) generarAhora(l);
				}}
			>
				<p className="text-sm text-gray-600">
					Este recibo fue <strong>editado a mano</strong>. Si lo volvés a generar,
					se arma de nuevo con lo calculado y <strong>se pierden los cambios</strong>.
					El número de recibo se mantiene.
				</p>
				<p className="text-sm text-gray-600">
					Si solo querés corregir algo, usá “Editar recibo”.
				</p>
			</ModalFormulario>

			{detalle && (
				<ModalDetalleRecibo
					key={`${detalle.personalId}-${recibos.get(detalle.personalId)?.version ?? 0}`}
					titulo={
						recibos.get(detalle.personalId)?.numeroTexto
							? `Recibo N° ${recibos.get(detalle.personalId)?.numeroTexto}`
							: "Vista previa del recibo"
					}
					subtitulo={`${detalle.nombre} · ${nombrePeriodo(periodo)}`}
					nombreArchivo={`Recibo ${
						recibos.get(detalle.personalId)?.numeroTexto?.replace("/", "-") ??
						"vista previa"
					} - ${detalle.nombre}.jpg`}
					cargar={() => cargarDetalle(detalle)}
					onCerrar={() => setDetalle(null)}
				/>
			)}
		</div>
	);
}
