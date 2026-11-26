"use client";

/**
 * Feriados y fechas especiales del año.
 * - Los feriados nacionales y de La Rioja vienen cargados (lib/asistencia/feriados.ts):
 *   Juan elige si el instituto se adhiere o no a cada uno.
 * - Juan puede agregar días: feriados que falten o días especiales del instituto.
 * Los días adheridos que son "sin clases" hacen que las clases de ese día no cuenten.
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
	AlertCircle,
	CalendarOff,
	ChevronLeft,
	ChevronRight,
	Loader2,
	Pencil,
	Plus,
	Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	combinarDiasEspeciales,
	predeterminadosPorId,
	type FeriadoPredeterminado,
} from "@/lib/asistencia/feriados";
import { DIAS_SEMANA, diaSemanaDeFecha, fechaAR, fechaLarga } from "@/lib/asistencia/fechas";
import type { RepositorioCarga } from "@/lib/asistencia/repositorio";
import type {
	DiaEspecial,
	DiaEspecialInput,
	TipoDiaEspecial,
} from "@/lib/asistencia/tipos";
import {
	Campo,
	Interruptor,
	ModalFormulario,
	Segmentado,
	Vacio,
	inputClase,
	mensajeDeError,
	type Notificar,
} from "./ui";

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

/** Feriados en celeste, días del instituto en turquesa (igual que en el calendario) */
const COLOR = {
	feriado: {
		fecha: "bg-sky-50 text-sky-700 border-sky-100",
		chip: "bg-sky-50 text-sky-700 border-sky-100",
		barra: "bg-sky-400",
	},
	instituto: {
		fecha: "bg-teal-50 text-teal-700 border-teal-100",
		chip: "bg-teal-50 text-teal-700 border-teal-100",
		barra: "bg-teal-400",
	},
} as const;

type Efecto = "cerrado_sin_clases" | "sin_clases" | "cerrado";

const EFECTOS: readonly (readonly [Efecto, string])[] = [
	["cerrado_sin_clases", "Cerrado y sin clases"],
	["sin_clases", "Abierto, sin clases"],
	["cerrado", "Cerrado, con clases"],
];

const TIPOS: readonly (readonly [TipoDiaEspecial, string])[] = [
	["feriado", "Feriado nacional / provincial"],
	["instituto", "Día especial del instituto"],
];

const aEfecto = (d: Pick<DiaEspecial, "cerrado" | "sinClases">): Efecto =>
	d.cerrado && d.sinClases ? "cerrado_sin_clases" : d.sinClases ? "sin_clases" : "cerrado";

const desdeEfecto = (e: Efecto) => ({
	cerrado: e !== "sin_clases",
	sinClases: e !== "cerrado",
});

const textoEfecto = (d: Pick<DiaEspecial, "cerrado" | "sinClases">) =>
	EFECTOS.find(([v]) => v === aEfecto(d))?.[1] ?? "";

const diaVacio = (anio: number): DiaEspecialInput => {
	const hoy = fechaAR(new Date());
	return {
		fecha: hoy.startsWith(String(anio)) ? hoy : `${anio}-01-01`,
		descripcion: "",
		tipo: "instituto",
		cerrado: true,
		sinClases: true,
	};
};

const diaCorto = (fecha: string) =>
	DIAS_SEMANA.find((d) => d.valor === diaSemanaDeFecha(fecha))?.corto ?? "";

function Chip({
	className,
	children,
}: {
	className: string;
	children: React.ReactNode;
}) {
	return (
		<span
			className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${className}`}
		>
			{children}
		</span>
	);
}

export default function TabFeriados({
	repo,
	notificar,
}: {
	repo: RepositorioCarga;
	notificar: Notificar;
}) {
	const anioActual = Number(fechaAR(new Date()).slice(0, 4));
	const [anio, setAnio] = useState(anioActual);
	const [filtro, setFiltro] = useState<"todos" | TipoDiaEspecial>("todos");
	const [guardados, setGuardados] = useState<{
		anio: number;
		dias: DiaEspecial[];
	} | null>(null);
	const [errorCarga, setErrorCarga] = useState<string | null>(null);
	const [cambiando, setCambiando] = useState<Set<string>>(new Set());

	// Formulario de alta / edición
	const [modalAbierto, setModalAbierto] = useState(false);
	const [editandoId, setEditandoId] = useState<string | null>(null);
	const [form, setForm] = useState<DiaEspecialInput>(() => diaVacio(anioActual));
	const [error, setError] = useState<string | null>(null);
	const [guardando, setGuardando] = useState(false);

	// Confirmación de borrado
	const [aEliminar, setAEliminar] = useState<DiaEspecial | null>(null);
	const [eliminando, setEliminando] = useState(false);

	useEffect(
		() =>
			repo.suscribirDiasEspeciales(
				anio,
				(dias) => {
					setGuardados({ anio, dias });
					setErrorCarga(null);
				},
				(e) => setErrorCarga(mensajeDeError(e)),
			),
		[repo, anio],
	);

	// Mientras llega el año nuevo no se muestra el anterior
	const delAnio = guardados?.anio === anio ? guardados.dias : null;

	const dias = useMemo(
		() =>
			delAnio
				? combinarDiasEspeciales(delAnio, `${anio}-01-01`, `${anio}-12-31`)
				: null,
		[delAnio, anio],
	);
	const predeterminados = useMemo(() => predeterminadosPorId(anio), [anio]);

	const visibles = useMemo(
		() => (dias ?? []).filter((d) => filtro === "todos" || d.tipo === filtro),
		[dias, filtro],
	);

	const porMes = useMemo(() => {
		const grupos: { mes: number; dias: DiaEspecial[] }[] = [];
		visibles.forEach((d) => {
			const mes = Number(d.fecha.slice(5, 7));
			const ultimo = grupos[grupos.length - 1];
			if (ultimo?.mes === mes) ultimo.dias.push(d);
			else grupos.push({ mes, dias: [d] });
		});
		return grupos;
	}, [visibles]);

	const resumen = useMemo(() => {
		const lista = dias ?? [];
		return {
			feriados: lista.filter((d) => d.tipo === "feriado" && d.adherido).length,
			noAdheridos: lista.filter((d) => d.tipo === "feriado" && !d.adherido).length,
			instituto: lista.filter((d) => d.tipo === "instituto").length,
		};
	}, [dias]);

	const abrirNuevo = () => {
		setEditandoId(null);
		setForm(diaVacio(anio));
		setError(null);
		setModalAbierto(true);
	};

	const abrirEdicion = (d: DiaEspecial) => {
		setEditandoId(d.id);
		setForm({
			fecha: d.fecha,
			descripcion: d.descripcion,
			tipo: d.tipo,
			cerrado: d.cerrado,
			sinClases: d.sinClases,
		});
		setError(null);
		setModalAbierto(true);
	};

	const guardar = async () => {
		if (!form.descripcion.trim()) return setError("Poné un nombre al día.");
		if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fecha)) return setError("Elegí la fecha.");
		setGuardando(true);
		setError(null);
		try {
			await repo.guardarDiaEspecial(form, editandoId ?? undefined);
			notificar(
				editandoId
					? "Día actualizado."
					: `Se agregó ${form.descripcion.trim()} (${form.fecha.slice(8)}/${form.fecha.slice(5, 7)}).`,
			);
			setModalAbierto(false);
			// Si se cargó en otro año, se va a ese año para verlo
			const anioForm = Number(form.fecha.slice(0, 4));
			if (anioForm !== anio) setAnio(anioForm);
		} catch (e) {
			setError(mensajeDeError(e));
		} finally {
			setGuardando(false);
		}
	};

	const cambiarAdhesion = async (d: DiaEspecial) => {
		setCambiando((s) => new Set(s).add(d.id));
		try {
			await repo.cambiarAdhesion(d, !d.adherido);
			notificar(
				d.adherido
					? `${d.descripcion}: el instituto no se adhiere, el día cuenta normal.`
					: `${d.descripcion}: el instituto se adhiere.`,
			);
		} catch (e) {
			notificar(mensajeDeError(e), "error");
		} finally {
			setCambiando((s) => {
				const n = new Set(s);
				n.delete(d.id);
				return n;
			});
		}
	};

	const eliminar = async () => {
		if (!aEliminar) return;
		setEliminando(true);
		try {
			await repo.eliminarDiaEspecial(aEliminar.id);
			notificar(`Se eliminó ${aEliminar.descripcion}.`);
			setAEliminar(null);
		} catch (e) {
			notificar(mensajeDeError(e), "error");
		} finally {
			setEliminando(false);
		}
	};

	const etiquetasPredeterminado = (p: FeriadoPredeterminado | undefined) =>
		p ? (
			<>
				<Chip className="bg-gray-50 text-gray-600 border-gray-200">
					{p.ambito === "nacional" ? "Nacional" : "Provincial · La Rioja"}
				</Chip>
				{p.noLaborable && (
					<Chip className="bg-amber-50 text-amber-700 border-amber-100">
						No laborable
					</Chip>
				)}
				{p.trasladable && (
					<Chip className="bg-gray-50 text-gray-500 border-gray-200">
						Trasladable
					</Chip>
				)}
			</>
		) : null;

	return (
		<div className="space-y-4">
			{/* Barra */}
			<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
				<div className="flex items-center gap-1">
					<button
						onClick={() => setAnio((a) => a - 1)}
						className="p-2 rounded-lg text-gray-500 hover:text-[#252d62] hover:bg-gray-50 transition-colors"
						aria-label="Año anterior"
					>
						<ChevronLeft className="w-5 h-5" />
					</button>
					<span className="text-lg font-bold text-[#252d62] w-16 text-center tabular-nums">
						{anio}
					</span>
					<button
						onClick={() => setAnio((a) => a + 1)}
						className="p-2 rounded-lg text-gray-500 hover:text-[#252d62] hover:bg-gray-50 transition-colors"
						aria-label="Año siguiente"
					>
						<ChevronRight className="w-5 h-5" />
					</button>
				</div>
				<div className="overflow-x-auto">
					<Segmentado
						opciones={[
							["todos", "Todos"],
							["feriado", "Feriados"],
							["instituto", "Del instituto"],
						]}
						valor={filtro}
						onChange={setFiltro}
					/>
				</div>
				<p className="flex-1 text-xs text-gray-500">
					{resumen.feriados} feriado{resumen.feriados === 1 ? "" : "s"} adherido
					{resumen.feriados === 1 ? "" : "s"}
					{resumen.noAdheridos > 0 && ` · ${resumen.noAdheridos} sin adhesión`}
					{` · ${resumen.instituto} del instituto`}
				</p>
				<Button
					onClick={abrirNuevo}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold py-5 px-5 rounded-xl flex items-center gap-2 shadow-md"
				>
					<Plus className="w-5 h-5" /> Agregar día especial
				</Button>
			</div>

			{/* Referencias */}
			<div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-gray-500">
				<span className="flex items-center gap-1.5">
					<span className={`w-3 h-3 rounded ${COLOR.feriado.barra}`} /> Feriado
					nacional / provincial
				</span>
				<span className="flex items-center gap-1.5">
					<span className={`w-3 h-3 rounded ${COLOR.instituto.barra}`} /> Día
					especial del instituto
				</span>
				<span>
					Si no te adherís a un feriado, ese día se trabaja normal y las clases
					cuentan.
				</span>
			</div>

			{errorCarga && (
				<div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
					<AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
					<p className="text-sm text-red-700">
						No se pudieron cargar los días guardados: {errorCarga}. Se muestran
						los feriados sin tus cambios.
					</p>
				</div>
			)}

			{/* Lista */}
			{!dias && !errorCarga ? (
				<div className="flex items-center justify-center h-64">
					<Loader2 className="w-8 h-8 animate-spin text-[#252d62]" />
				</div>
			) : porMes.length === 0 && !errorCarga ? (
				<div className="bg-white rounded-xl border border-gray-100 shadow-sm">
					<Vacio
						icono={CalendarOff}
						titulo="No hay días en este filtro"
						texto="Agregá un día especial del instituto con el botón de arriba."
					/>
				</div>
			) : (
				<div className="space-y-4">
					{porMes.map(({ mes, dias: diasMes }) => (
						<div
							key={mes}
							className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
						>
							<p className="px-4 py-2.5 bg-gray-50/70 border-b border-gray-100 text-xs font-bold uppercase tracking-wider text-gray-500">
								{MESES[mes - 1]}
							</p>
							<ul className="divide-y divide-gray-50">
								{diasMes.map((d, idx) => {
									const color = COLOR[d.tipo];
									const pred = predeterminados.get(d.id);
									const ocupado = cambiando.has(d.id);
									return (
										<motion.li
											key={d.id}
											initial={{ opacity: 0, y: 6 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: Math.min(idx, 8) * 0.03 }}
											className="relative flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3"
										>
											<span
												className={`absolute left-0 top-0 bottom-0 w-1 ${color.barra} ${d.adherido ? "" : "opacity-30"}`}
											/>
											<div
												className={`flex items-center gap-3 min-w-0 flex-1 ${d.adherido ? "" : "opacity-50"}`}
											>
												<div
													className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center shrink-0 ${color.fecha}`}
													title={fechaLarga(d.fecha)}
												>
													<span className="text-[10px] font-bold uppercase leading-none">
														{diaCorto(d.fecha)}
													</span>
													<span className="text-lg font-black leading-tight">
														{Number(d.fecha.slice(8))}
													</span>
												</div>
												<div className="min-w-0">
													<p className="font-bold text-gray-900 leading-tight">
														{d.descripcion}
													</p>
													<div className="flex flex-wrap items-center gap-1.5 mt-1">
														<Chip className={color.chip}>
															{d.tipo === "feriado" ? "Feriado" : "Instituto"}
														</Chip>
														{pred
															? etiquetasPredeterminado(pred)
															: d.tipo === "feriado" && (
																	<Chip className="bg-gray-50 text-gray-500 border-gray-200">
																		Agregado a mano
																	</Chip>
																)}
														<span className="text-xs text-gray-500">
															{d.adherido
																? textoEfecto(d)
																: "Sin adhesión: día normal"}
															{d.adherido &&
																d.sinClases &&
																(!d.todoElDia || d.cursoIds.length > 0) &&
																" (parcial)"}
														</span>
													</div>
												</div>
											</div>

											<div className="flex items-center gap-2 sm:justify-end shrink-0 pl-15 sm:pl-0">
												{d.tipo === "feriado" && (
													<div className={ocupado ? "pointer-events-none opacity-60" : ""}>
														<Interruptor
															activo={d.adherido}
															onChange={() => cambiarAdhesion(d)}
															label={d.adherido ? "Adherido" : "No adherido"}
														/>
													</div>
												)}
												{!d.predeterminado && (
													<>
														<button
															onClick={() => abrirEdicion(d)}
															className="p-2 rounded-lg text-gray-400 hover:text-[#252d62] hover:bg-indigo-50 transition-colors"
															aria-label={`Editar ${d.descripcion}`}
														>
															<Pencil className="w-4 h-4" />
														</button>
														<button
															onClick={() => setAEliminar(d)}
															className="p-2 rounded-lg text-gray-400 hover:text-[#EE1120] hover:bg-red-50 transition-colors"
															aria-label={`Eliminar ${d.descripcion}`}
														>
															<Trash2 className="w-4 h-4" />
														</button>
													</>
												)}
											</div>
										</motion.li>
									);
								})}
							</ul>
						</div>
					))}
				</div>
			)}

			{/* Alta / edición */}
			<ModalFormulario
				abierto={modalAbierto}
				onCerrar={() => setModalAbierto(false)}
				titulo={editandoId ? "Editar día especial" : "Agregar día especial"}
				subtitulo="Feriados que falten o fechas propias del instituto"
				icono={CalendarOff}
				error={error}
				guardando={guardando}
				onGuardar={guardar}
				textoGuardar={editandoId ? "Guardar cambios" : "Agregar"}
			>
				<Campo label="Nombre">
					<input
						value={form.descripcion}
						onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
						placeholder="Ej.: Aniversario del instituto"
						className={inputClase}
						autoFocus
					/>
				</Campo>

				<Campo label="Fecha">
					<input
						type="date"
						value={form.fecha}
						onChange={(e) => setForm({ ...form, fecha: e.target.value })}
						className={inputClase}
					/>
				</Campo>

				<Campo label="Tipo">
					<div className="overflow-x-auto">
						<Segmentado
							opciones={TIPOS}
							valor={form.tipo}
							onChange={(tipo) => setForm({ ...form, tipo })}
						/>
					</div>
				</Campo>

				<Campo
					label="¿Qué pasa ese día?"
					hint={
						form.sinClases
							? "Las clases de ese día no cuentan para el recibo (salvo que marques “contar igual” en la clase). Las horas de las secretarias cuentan siempre."
							: "Las clases se dictan y cuentan normal. Las horas de las secretarias cuentan siempre."
					}
				>
					<div className="overflow-x-auto">
						<Segmentado
							opciones={EFECTOS}
							valor={aEfecto(form)}
							onChange={(e) => setForm({ ...form, ...desdeEfecto(e) })}
						/>
					</div>
				</Campo>
			</ModalFormulario>

			{/* Confirmación de borrado */}
			<ModalFormulario
				abierto={aEliminar !== null}
				onCerrar={() => setAEliminar(null)}
				titulo="Eliminar día especial"
				subtitulo={aEliminar ? fechaLarga(aEliminar.fecha) : undefined}
				icono={Trash2}
				guardando={eliminando}
				onGuardar={eliminar}
				textoGuardar="Eliminar"
				variante="rojo"
			>
				<p className="text-sm text-gray-600">
					¿Eliminar <strong>{aEliminar?.descripcion}</strong>?
					{aEliminar?.sinClases &&
						" Las clases de ese día van a volver a contar para los recibos."}
				</p>
			</ModalFormulario>
		</div>
	);
}
