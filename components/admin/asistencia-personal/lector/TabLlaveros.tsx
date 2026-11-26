"use client";

/**
 * Llaveros registrados. Cada llavero aparece solo la primera vez que se apoya en
 * el lector del kiosco (se identifica por su número de serie de fábrica, no por el
 * número grabado). El director lo asigna, lo quita o lo da de baja; también se
 * puede asignar desde el kiosco (son los mismos datos).
 */
import React, { useMemo, useState } from "react";
import {
	Ban,
	Briefcase,
	GraduationCap,
	Info,
	KeyRound,
	Link2,
	Loader2,
	Plus,
	RotateCcw,
	Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fechaCorta, fechaAR, horaAR } from "@/lib/asistencia/fechas";
import {
	asignarLlavero,
	crearLlaverosPendientes,
	liberarLlavero,
	reactivarLlavero,
} from "@/lib/asistencia/repositorioLector";
import { nombreCompleto, type Llavero, type Persona } from "@/lib/asistencia/tipos";
import {
	Campo,
	ModalFormulario,
	Vacio,
	inputClase,
	mensajeDeError,
	type Notificar,
} from "../carga/ui";

const ESTADO: Record<Llavero["estado"], { texto: string; clase: string }> = {
	Asignado: { texto: "Asignado", clase: "bg-green-50 text-green-700" },
	SinAsignar: { texto: "Sin asignar", clase: "bg-amber-50 text-amber-700" },
	Baja: { texto: "De baja", clase: "bg-gray-100 text-gray-500" },
};

type Accion =
	| { tipo: "asignar"; llavero: Llavero }
	| { tipo: "quitar"; llavero: Llavero }
	| { tipo: "baja"; llavero: Llavero };

const etiqueta = (l: Llavero) => (l.numero ? `Llavero ${l.numero}` : "Llavero sin número");

// TEMPORAL: los primeros llaveros del instituto, para cargarlos de antemano con un botón.
// Cuando estén todos cargados el botón desaparece solo; después se puede borrar este bloque.
const NUMEROS_INICIALES = Array.from({ length: 10 }, (_, i) => String(101 + i));

const usoTexto = (d: Date | null) => {
	if (!d) return "Nunca";
	return fechaAR(d) === fechaAR(new Date()) ? `Hoy ${horaAR(d)}` : `${fechaCorta(fechaAR(d))} ${horaAR(d)}`;
};

export default function TabLlaveros({
	personal,
	llaveros,
	esDirector,
	notificar,
}: {
	personal: Persona[];
	llaveros: Llavero[];
	esDirector: boolean;
	notificar: Notificar;
}) {
	const [accion, setAccion] = useState<Accion | null>(null);
	const [personaId, setPersonaId] = useState("");
	const [guardando, setGuardando] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [reactivandoUid, setReactivandoUid] = useState<string | null>(null);
	const [creando, setCreando] = useState(false);

	// TEMPORAL: números del 101 al 110 que todavía no existen
	const faltantes = NUMEROS_INICIALES.filter((n) => !llaveros.some((l) => l.numero === n));
	const crearIniciales = async () => {
		setCreando(true);
		try {
			const n = await crearLlaverosPendientes(NUMEROS_INICIALES, llaveros);
			notificar(`Se cargaron ${n} llavero${n === 1 ? "" : "s"} (pendientes de leer).`);
		} catch (e) {
			notificar(mensajeDeError(e), "error");
		} finally {
			setCreando(false);
		}
	};

	const porId = useMemo(() => new Map(personal.map((p) => [p.id, p])), [personal]);
	const numeroPorUid = useMemo(() => new Map(llaveros.map((l) => [l.uid, l.numero])), [llaveros]);
	const activos = useMemo(() => personal.filter((p) => p.activo), [personal]);
	const sinLlavero = activos.filter((p) => !p.llaveroUid);

	const abrir = (a: Accion) => {
		setAccion(a);
		setPersonaId("");
		setError(null);
	};

	const ejecutar = async () => {
		if (!accion) return;
		setGuardando(true);
		setError(null);
		try {
			const l = accion.llavero;
			if (accion.tipo === "asignar") {
				const persona = porId.get(personaId);
				if (!persona) throw new Error("Elegí a quién se lo asignás.");
				await asignarLlavero(l, persona, personal);
				notificar(`${etiqueta(l)} asignado a ${nombreCompleto(persona)}.`);
			} else {
				await liberarLlavero(l, personal, { baja: accion.tipo === "baja" });
				notificar(accion.tipo === "baja" ? `${etiqueta(l)} dado de baja.` : `${etiqueta(l)} quedó sin asignar.`);
			}
			setAccion(null);
		} catch (e) {
			setError(mensajeDeError(e));
		} finally {
			setGuardando(false);
		}
	};

	const reactivar = async (l: Llavero) => {
		setReactivandoUid(l.uid);
		try {
			await reactivarLlavero(l);
			notificar(`${etiqueta(l)} reactivado: ya se puede asignar.`);
		} catch (e) {
			notificar(mensajeDeError(e), "error");
		} finally {
			setReactivandoUid(null);
		}
	};

	// Para el modal de asignar
	const elegida = porId.get(personaId);
	const duenoActual =
		accion?.tipo === "asignar" && accion.llavero.personalId ? porId.get(accion.llavero.personalId) : undefined;

	return (
		<div className="space-y-4">
			<div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-start gap-2.5 text-sm text-indigo-900">
				<Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" />
				<p>
					Cada llavero aparece acá <strong>la primera vez que se apoya en el lector</strong>{" "}
					de la aplicación de escritorio, con su número (101, 102…). Los que se cargan de
					antemano quedan{" "}
					<strong>pendientes de leer</strong>: al apoyarlos por primera vez se vinculan solos
					por el número grabado y conservan su asignación. Se asignan desde acá o desde el
					la aplicación de escritorio. Un llavero sin asignar, o dado de baja, no registra
					asistencia.
				</p>
			</div>

			{/* TEMPORAL: carga de los primeros llaveros del instituto */}
			{esDirector && faltantes.length > 0 && (
				<div className="p-4 bg-white border border-dashed border-gray-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<p className="text-sm text-gray-600">
						Cargá de una vez los llaveros del instituto: <strong>{faltantes.join(", ")}</strong>.
						Quedan sin asignar.
					</p>
					<Button
						onClick={crearIniciales}
						disabled={creando}
						className="bg-[#252d62] hover:bg-[#1a2046] text-white font-bold rounded-xl flex items-center gap-2 shrink-0"
					>
						{creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
						Crear llaveros {faltantes[0]} a {faltantes[faltantes.length - 1]}
					</Button>
				</div>
			)}

			{sinLlavero.length > 0 && (
				<p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
					Sin llavero todavía: {sinLlavero.map(nombreCompleto).join(", ")}.
				</p>
			)}

			<div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
				<div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
					<p className="text-sm text-gray-500">
						{llaveros.length} llavero{llaveros.length === 1 ? "" : "s"}
					</p>
					<p className="text-sm font-bold text-[#252d62]">
						{llaveros.filter((l) => l.estado === "Asignado").length} asignados ·{" "}
						{llaveros.filter((l) => l.estado === "SinAsignar").length} sin asignar
					</p>
				</div>

				{llaveros.length === 0 ? (
					<Vacio
						icono={KeyRound}
						titulo="Todavía no se leyó ningún llavero"
						texto="Apoyá los llaveros en el lector de la aplicación de escritorio para que se registren acá."
					/>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-gray-100">
									{["Número", "Estado", "Asignado a", "Último uso", "Código del llavero", ""].map((h, i) => (
										<th
											key={i}
											className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${i === 5 ? "text-right" : "text-left"}`}
										>
											{h}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{llaveros.map((l) => {
									const persona = l.personalId ? porId.get(l.personalId) : undefined;
									const estado = ESTADO[l.estado];
									return (
										<tr key={l.uid} className={`hover:bg-gray-50 transition-colors ${l.estado === "Baja" ? "opacity-60" : ""}`}>
											<td className="px-4 py-3">
												<span className={`text-lg font-black ${l.numero ? "text-[#252d62]" : "text-gray-400 text-sm"}`}>
													{l.numero ?? "Sin número"}
												</span>
											</td>
											<td className="px-4 py-3">
												<span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${estado.clase}`}>
													{estado.texto}
												</span>
											</td>
											<td className="px-4 py-3">
												{persona ? (
													<div>
														<p className="font-medium text-gray-900 whitespace-nowrap">{nombreCompleto(persona)}</p>
														<p className="text-xs text-gray-400 flex items-center gap-1">
															{persona.rol === "secretaria" ? (
																<>
																	<Briefcase className="w-3 h-3" /> Secretaria
																</>
															) : (
																<>
																	<GraduationCap className="w-3 h-3" /> Profesora
																</>
															)}
														</p>
													</div>
												) : (
													<span className="text-xs text-gray-400">—</span>
												)}
											</td>
											<td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{usoTexto(l.ultimoUsoEn)}</td>
											<td className="px-4 py-3">
												{l.pendienteDeLectura ? (
													<span className="text-xs text-amber-700" title="Se completa la primera vez que se apoye en el lector">
														Pendiente de leer
													</span>
												) : (
													<span className="font-mono text-[11px] text-gray-400">{l.uid}</span>
												)}
											</td>
											<td className="px-4 py-3 text-right whitespace-nowrap">
												{esDirector &&
													(l.estado === "Baja" ? (
														<button
															onClick={() => reactivar(l)}
															disabled={reactivandoUid === l.uid}
															className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#252d62] hover:bg-indigo-50 disabled:opacity-50"
														>
															<RotateCcw className="w-3.5 h-3.5" /> Reactivar
														</button>
													) : (
														<>
															<button
																onClick={() => abrir({ tipo: "asignar", llavero: l })}
																className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#252d62] hover:bg-indigo-50"
															>
																<Link2 className="w-3.5 h-3.5" /> {persona ? "Reasignar" : "Asignar"}
															</button>
															{persona && (
																<button
																	onClick={() => abrir({ tipo: "quitar", llavero: l })}
																	className="p-2 rounded-lg text-gray-400 hover:text-[#252d62] hover:bg-indigo-50"
																	title="Quitar la asignación"
																	aria-label="Quitar la asignación"
																>
																	<Unlink className="w-4 h-4" />
																</button>
															)}
															<button
																onClick={() => abrir({ tipo: "baja", llavero: l })}
																className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
																title="Dar de baja (perdido o roto)"
																aria-label="Dar de baja"
															>
																<Ban className="w-4 h-4" />
															</button>
														</>
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

			{/* Modal de la acción */}
			<ModalFormulario
				abierto={!!accion}
				onCerrar={() => setAccion(null)}
				titulo={
					!accion
						? ""
						: accion.tipo === "asignar"
							? `Asignar ${etiqueta(accion.llavero).toLowerCase()}`
							: accion.tipo === "quitar"
								? `Quitar la asignación del ${etiqueta(accion.llavero).toLowerCase()}`
								: `Dar de baja el ${etiqueta(accion.llavero).toLowerCase()}`
				}
				subtitulo={
					accion?.tipo === "baja"
						? "Para un llavero perdido o roto: sus toques no van a registrar asistencia"
						: undefined
				}
				icono={accion?.tipo === "asignar" ? Link2 : accion?.tipo === "quitar" ? Unlink : Ban}
				error={error}
				guardando={guardando}
				onGuardar={ejecutar}
				puedeGuardar={accion?.tipo !== "asignar" || !!personaId}
				variante={accion?.tipo === "baja" ? "rojo" : "navy"}
				textoGuardar={accion?.tipo === "asignar" ? "Asignar" : accion?.tipo === "quitar" ? "Quitar" : "Dar de baja"}
			>
				{accion?.tipo === "asignar" && (
					<>
						<Campo label="¿De quién es?">
							<select
								value={personaId}
								onChange={(e) => setPersonaId(e.target.value)}
								className={inputClase}
								autoFocus
							>
								<option value="" disabled>
									Elegí a la persona
								</option>
								{(["secretaria", "profesora"] as const).map((rol) => {
									const grupo = activos.filter((p) => p.rol === rol);
									return grupo.length === 0 ? null : (
										<optgroup key={rol} label={rol === "secretaria" ? "Secretarias" : "Profesoras"}>
											{grupo.map((p) => (
												<option key={p.id} value={p.id} disabled={p.id === accion.llavero.personalId}>
													{nombreCompleto(p)}
													{p.llaveroUid ? ` (tiene el ${numeroPorUid.get(p.llaveroUid) ?? "otro"})` : ""}
												</option>
											))}
										</optgroup>
									);
								})}
							</select>
						</Campo>
						{duenoActual && (
							<p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
								Ahora es de <strong>{nombreCompleto(duenoActual)}</strong>: se le va a quitar.
							</p>
						)}
						{elegida?.llaveroUid && elegida.llaveroUid !== accion.llavero.uid && (
							<p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
								{nombreCompleto(elegida)} ya tiene el llavero{" "}
								{numeroPorUid.get(elegida.llaveroUid) ?? ""}: ese va a quedar sin asignar.
							</p>
						)}
					</>
				)}
				{accion?.tipo === "quitar" && (
					<p className="text-sm text-gray-600">
						El llavero queda sin asignar. Hasta que se lo asignes a alguien, sus toques no
						registran asistencia.
					</p>
				)}
				{accion?.tipo === "baja" && (
					<p className="text-sm text-gray-600">
						{accion.llavero.personalId ? "Se le quita a quien lo tenía y " : ""}
						queda de baja. Si aparece, se puede reactivar.
					</p>
				)}
			</ModalFormulario>
		</div>
	);
}
