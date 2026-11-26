"use client";

/**
 * Historial de registros: cada entrada y salida de las secretarias, cada clase
 * registrada de las profesoras y los avisos del kiosco, con filtros.
 * El director corrige, anula o agrega entradas y salidas, y marca avisos como revisados.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
	AlertCircle,
	AlertTriangle,
	Ban,
	CheckCircle2,
	GraduationCap,
	History,
	KeyRound,
	LogIn,
	LogOut,
	Pencil,
	Plus,
	Search,
	Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fechaAR, fechaCorta, horaAR, sumarDias } from "@/lib/asistencia/fechas";
import {
	AVISOS_A_REVISAR,
	armarHistorial,
	type FilaHistorial,
} from "@/lib/asistencia/historialLector";
import {
	marcarFichadaRevisada,
	suscribirHistorial,
	type DatosHistorial,
} from "@/lib/asistencia/repositorioLector";
import type { Llavero, Persona } from "@/lib/asistencia/tipos";
import {
	Segmentado,
	Vacio,
	inputFiltroClase,
	mensajeDeError,
	type Notificar,
} from "../carga/ui";
import ModalMovimiento, { type ModoMovimiento } from "./ModalMovimiento";

type Rango = "hoy" | "semana" | "mes" | "otro";
type FiltroTipo = "todos" | "movimientos" | "clases" | "avisos";

const ETIQUETA: Record<FilaHistorial["tipo"], { texto: string; clase: string; icono: React.ComponentType<{ className?: string }> }> = {
	entrada: { texto: "Entrada", clase: "bg-green-50 text-green-700", icono: LogIn },
	salida: { texto: "Salida", clase: "bg-indigo-50 text-[#252d62]", icono: LogOut },
	clase: { texto: "Clase", clase: "bg-purple-50 text-purple-700", icono: GraduationCap },
	aviso: { texto: "Aviso", clase: "bg-amber-50 text-amber-700", icono: AlertTriangle },
};

export default function TabHistorial({
	personal,
	llaveros,
	esDirector,
	fechaInicio,
	notificar,
}: {
	personal: Persona[];
	llaveros: Llavero[];
	esDirector: boolean;
	fechaInicio: string;
	notificar: Notificar;
}) {
	const hoy = fechaAR(new Date());
	const [rango, setRango] = useState<Rango>("hoy");
	const [desdeOtro, setDesdeOtro] = useState(sumarDias(hoy, -6));
	const [hastaOtro, setHastaOtro] = useState(hoy);
	const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
	const [busqueda, setBusqueda] = useState("");
	const [modal, setModal] = useState<ModoMovimiento | null>(null);
	const [marcandoId, setMarcandoId] = useState<string | null>(null);

	const { desde, hasta } =
		rango === "hoy"
			? { desde: hoy, hasta: hoy }
			: rango === "semana"
				? { desde: sumarDias(hoy, -6), hasta: hoy }
				: rango === "mes"
					? { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy }
					: desdeOtro <= hastaOtro
						? { desde: desdeOtro, hasta: hastaOtro }
						: { desde: hastaOtro, hasta: desdeOtro };

	// Datos atados a su rango: al cambiar de rango, los anteriores dejan de mostrarse solos
	const clave = `${desde}|${hasta}`;
	const [cargados, setCargados] = useState<{ clave: string; datos: DatosHistorial } | null>(null);
	const [errorRango, setErrorRango] = useState<{ clave: string; mensaje: string } | null>(null);
	useEffect(
		() =>
			suscribirHistorial(
				desde,
				hasta,
				(datos) => setCargados({ clave, datos }),
				(e) => setErrorRango({ clave, mensaje: mensajeDeError(e) }),
			),
		// `clave` resume desde y hasta
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[clave],
	);
	const datos = cargados?.clave === clave ? cargados.datos : null;
	const error = errorRango?.clave === clave ? errorRango.mensaje : null;

	const secretarias = useMemo(
		() => personal.filter((p) => p.rol === "secretaria" && p.activo),
		[personal],
	);
	const rolDe = useMemo(() => new Map(personal.map((p) => [p.id, p.rol])), [personal]);

	const filas = useMemo(() => (datos ? armarHistorial(datos, llaveros) : []), [datos, llaveros]);
	const visibles = useMemo(() => {
		const q = busqueda.trim().toLowerCase();
		return filas.filter(
			(f) =>
				(filtroTipo === "todos" ||
					(filtroTipo === "movimientos" && (f.tipo === "entrada" || f.tipo === "salida")) ||
					(filtroTipo === "clases" && f.tipo === "clase") ||
					(filtroTipo === "avisos" && f.tipo === "aviso")) &&
				(!q || f.personaNombre.toLowerCase().includes(q) || (f.llaveroNumero ?? "").includes(q)),
		);
	}, [filas, filtroTipo, busqueda]);

	const cuenta = (t: FilaHistorial["tipo"]) => filas.filter((f) => f.tipo === t && !f.anulada).length;

	const marcar = async (f: FilaHistorial) => {
		if (!f.fichada) return;
		setMarcandoId(f.id);
		try {
			await marcarFichadaRevisada(f.fichada, !f.fichada.resuelta);
			notificar(f.fichada.resuelta ? "Se marcó como pendiente." : "Se marcó como revisado.");
		} catch (e) {
			notificar(mensajeDeError(e), "error");
		} finally {
			setMarcandoId(null);
		}
	};

	return (
		<div className="space-y-4">
			{/* Filtros */}
			<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
				<div className="flex flex-col lg:flex-row gap-3 lg:items-center">
					<Segmentado
						opciones={
							[
								["hoy", "Hoy"],
								["semana", "Últimos 7 días"],
								["mes", "Este mes"],
								["otro", "Elegir fechas"],
							] as const
						}
						valor={rango}
						onChange={setRango}
					/>
					{rango === "otro" && (
						<div className="flex items-center gap-2">
							<input
								type="date"
								value={desdeOtro}
								max={hoy}
								onChange={(e) => e.target.value && setDesdeOtro(e.target.value)}
								className={inputFiltroClase}
								aria-label="Desde"
							/>
							<span className="text-gray-400 text-sm">a</span>
							<input
								type="date"
								value={hastaOtro}
								max={hoy}
								onChange={(e) => e.target.value && setHastaOtro(e.target.value)}
								className={inputFiltroClase}
								aria-label="Hasta"
							/>
						</div>
					)}
					<div className="flex-1" />
					{esDirector && (
						<Button
							onClick={() => setModal({ accion: "agregar" })}
							className="bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold py-5 px-5 rounded-xl flex items-center gap-2 shadow-md"
						>
							<Plus className="w-5 h-5" /> Agregar entrada/salida
						</Button>
					)}
				</div>
				<div className="flex flex-col lg:flex-row gap-3 lg:items-center">
					<Segmentado
						opciones={
							[
								["todos", "Todo"],
								["movimientos", "Entradas y salidas"],
								["clases", "Clases"],
								["avisos", "Avisos del lector"],
							] as const
						}
						valor={filtroTipo}
						onChange={setFiltroTipo}
					/>
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
						<input
							value={busqueda}
							onChange={(e) => setBusqueda(e.target.value)}
							placeholder="Buscar por nombre o número de llavero..."
							className={`${inputFiltroClase} w-full pl-9`}
						/>
					</div>
				</div>
			</div>

			{error && (
				<div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
					<AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
					<p className="text-sm text-red-700">No se pudo cargar el historial: {error}</p>
				</div>
			)}

			{/* Tabla */}
			<div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
				<div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
					<p className="text-sm text-gray-500">
						{visibles.length} registro{visibles.length === 1 ? "" : "s"}
					</p>
					<p className="text-sm font-bold text-[#252d62]">
						{cuenta("entrada")} entradas · {cuenta("salida")} salidas · {cuenta("clase")} clases ·{" "}
						{cuenta("aviso")} avisos
					</p>
				</div>

				{!datos && !error ? (
					<p className="px-6 py-12 text-center text-sm text-gray-400">Cargando…</p>
				) : visibles.length === 0 ? (
					<Vacio
						icono={History}
						titulo={filas.length === 0 ? "No hay registros en estas fechas" : "No hay resultados"}
						texto={
							filas.length === 0
								? "Cuando el lector registre entradas, salidas o clases (o se carguen a mano), van a aparecer acá."
								: "Probá con otro filtro o búsqueda."
						}
					/>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-gray-100">
									{["Fecha y hora", "Persona", "Registro", "Llavero", "Origen", "Detalle", ""].map((h, i) => (
										<th
											key={i}
											className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${i === 6 ? "text-right" : "text-left"}`}
										>
											{h}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{visibles.map((f) => {
									const et = ETIQUETA[f.tipo];
									const Icono = et.icono;
									const esMovimiento = (f.tipo === "entrada" || f.tipo === "salida") && !!f.jornada;
									const editable = esDirector && esMovimiento && !f.anulada;
									const aRevisar = f.tipo === "aviso" && !!f.resultado && AVISOS_A_REVISAR.includes(f.resultado);
									const rol = f.personaId ? rolDe.get(f.personaId) : undefined;
									return (
										<tr key={f.id} className={`hover:bg-gray-50 transition-colors ${f.anulada ? "opacity-50" : ""}`}>
											<td className="px-4 py-3 whitespace-nowrap">
												<p className={`font-bold text-gray-900 ${f.anulada ? "line-through" : ""}`}>
													{horaAR(f.hora)}
												</p>
												<p className="text-xs text-gray-400">{fechaCorta(f.fecha)}</p>
											</td>
											<td className="px-4 py-3">
												<p className="font-medium text-gray-900 whitespace-nowrap">{f.personaNombre}</p>
												{rol && (
													<p className="text-xs text-gray-400">
														{rol === "secretaria" ? "Secretaria" : "Profesora"}
													</p>
												)}
											</td>
											<td className="px-4 py-3">
												<div className="flex flex-wrap items-center gap-1.5">
													<span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${et.clase}`}>
														<Icono className="w-3 h-3" /> {et.texto}
													</span>
													{f.anulada && (
														<span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-500">
															Anulada
														</span>
													)}
													{f.corregida && !f.anulada && (
														<span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700">
															Corregida
														</span>
													)}
													{f.sinSalida && (
														<span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700">
															Sin salida
														</span>
													)}
												</div>
											</td>
											<td className="px-4 py-3 whitespace-nowrap">
												{f.llaveroNumero ? (
													<span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600">
														<KeyRound className="w-3 h-3" /> {f.llaveroNumero}
													</span>
												) : (
													<span className="text-xs text-gray-300">—</span>
												)}
											</td>
											<td className="px-4 py-3">
												<span
													className={`text-xs font-semibold ${f.origen === "kiosco" ? "text-gray-600" : "text-indigo-700"}`}
												>
													{f.origen === "kiosco" ? "Lector" : "Manual"}
												</span>
											</td>
											<td className="px-4 py-3 text-xs text-gray-500 max-w-[280px]">
												{f.detalle}
												{f.tipo === "clase" && esDirector && (
													<span className="block text-gray-400">Se corrige desde el calendario</span>
												)}
											</td>
											<td className="px-4 py-3 text-right whitespace-nowrap">
												{editable && f.jornada && (
													<>
														<button
															onClick={() =>
																setModal({ accion: "corregir", jornada: f.jornada!, tipo: f.tipo as "entrada" | "salida" })
															}
															className="p-2 rounded-lg text-gray-400 hover:text-[#252d62] hover:bg-indigo-50 transition-colors"
															title={`Corregir la hora de la ${f.tipo}`}
															aria-label={`Corregir ${f.tipo}`}
														>
															<Pencil className="w-4 h-4" />
														</button>
														<button
															onClick={() =>
																setModal({ accion: "anular", jornada: f.jornada!, tipo: f.tipo as "entrada" | "salida" })
															}
															className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
															title={`Anular la ${f.tipo}`}
															aria-label={`Anular ${f.tipo}`}
														>
															<Ban className="w-4 h-4" />
														</button>
													</>
												)}
												{aRevisar &&
													(esDirector ? (
														<button
															onClick={() => marcar(f)}
															disabled={marcandoId === f.id}
															className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
																f.fichada?.resuelta
																	? "text-green-700 bg-green-50 hover:bg-green-100"
																	: "text-amber-700 bg-amber-50 hover:bg-amber-100"
															}`}
															title={f.fichada?.resuelta ? "Volver a marcar como pendiente" : "Marcar como revisado"}
														>
															{f.fichada?.resuelta ? (
																<>
																	<CheckCircle2 className="w-3.5 h-3.5" /> Revisado
																	<Undo2 className="w-3 h-3 opacity-60" />
																</>
															) : (
																"Marcar revisado"
															)}
														</button>
													) : (
														f.fichada?.resuelta && (
															<span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
																<CheckCircle2 className="w-3.5 h-3.5" /> Revisado
															</span>
														)
													))}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{modal && (
				<ModalMovimiento
					key={modal.accion === "agregar" ? "agregar" : `${modal.accion}-${modal.jornada.id}-${modal.tipo}`}
					modo={modal}
					secretarias={secretarias}
					fechaInicio={fechaInicio}
					notificar={notificar}
					onCerrar={() => setModal(null)}
				/>
			)}
		</div>
	);
}
