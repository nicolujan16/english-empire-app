"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
	AlertTriangle,
	Ban,
	BookOpen,
	Briefcase,
	CalendarDays,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	ClipboardList,
	Clock,
	Loader2,
	LogOut,
	Pencil,
	Plus,
	Repeat,
	UserCheck,
	WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	diaSemanaDeFecha,
	esHoraValida,
	fechaAR,
	fechaLarga,
	formatMinutos,
	horaAR,
	iniciales,
	sumarDias,
} from "@/lib/asistencia/fechas";
import type {
	RegistrosDelDia,
	RepositorioCarga,
} from "@/lib/asistencia/repositorio";
import {
	idClaseDictada,
	nombreCompleto,
	type ClaseDictada,
	type Curso,
	type Jornada,
	type Persona,
} from "@/lib/asistencia/tipos";
import {
	Campo,
	CampoMotivo,
	Historial,
	Interruptor,
	ModalFormulario,
	Segmentado,
	Vacio,
	inputClase,
	mensajeDeError,
	type Notificar,
} from "./ui";

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface FilaClase {
	key: string;
	curso: Curso | null;
	cursoNombre: string;
	horaInicio: string;
	horaFin: string;
	titulares: string[];
	dictada: ClaseDictada | null;
	fueraDeHorario: boolean;
}

type ModalJornada =
	| { modo: "nueva" }
	| { modo: "editar"; jornada: Jornada }
	| null;

type ModalClase =
	| { modo: "nueva"; cursoId?: string; turno?: string }
	| { modo: "editar"; clase: ClaseDictada }
	| null;

type ModalAnular =
	| { tipo: "jornada"; jornada: Jornada }
	| { tipo: "clase"; clase: ClaseDictada }
	| null;

function Badge({
	className,
	icon: Icon,
	children,
}: {
	className: string;
	icon?: React.ComponentType<{ className?: string }>;
	children: React.ReactNode;
}) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border whitespace-nowrap ${className}`}
		>
			{Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
			{children}
		</span>
	);
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function TabRegistros({
	personal,
	cursos,
	repo,
	notificar,
	fechaInicio = "",
}: {
	personal: Persona[];
	cursos: Curso[];
	repo: RepositorioCarga;
	notificar: Notificar;
	/** Inicio del registro: no se cargan registros de días anteriores */
	fechaInicio?: string;
}) {
	const hoy = fechaAR(new Date());
	const [fechaElegida, setFecha] = useState(hoy);
	// Nunca antes del inicio del registro (salvo que el inicio todavía no llegó)
	const minimo = fechaInicio && fechaInicio <= hoy ? fechaInicio : "";
	const fecha = minimo && fechaElegida < minimo ? minimo : fechaElegida;
	const [vista, setVista] = useState<"jornadas" | "clases">("jornadas");
	// Atados a su fecha: al cambiar de día, los del anterior dejan de mostrarse solos
	const [cargados, setCargados] = useState<{
		fecha: string;
		datos: RegistrosDelDia;
	} | null>(null);
	const [errorDia, setErrorDia] = useState<{ fecha: string; mensaje: string } | null>(
		null,
	);
	const registros = cargados?.fecha === fecha ? cargados.datos : null;
	const errorCarga = errorDia?.fecha === fecha ? errorDia.mensaje : null;

	// Modales
	const [modalJornada, setModalJornada] = useState<ModalJornada>(null);
	const [modalClase, setModalClase] = useState<ModalClase>(null);
	const [modalAnular, setModalAnular] = useState<ModalAnular>(null);
	const [guardando, setGuardando] = useState(false);
	const [errorForm, setErrorForm] = useState<string | null>(null);

	// Formularios
	const [fj, setFj] = useState({
		personaId: "",
		entrada: "08:00",
		salida: "",
		motivo: "",
	});
	const [fc, setFc] = useState({
		cursoId: "",
		turno: "",
		inicio: "18:00",
		fin: "19:30",
		profesoraId: "",
		contarIgual: false,
		motivo: "",
	});
	const [motivoAnular, setMotivoAnular] = useState("");

	// ── Suscripción a los registros del día ───────────────────────────────────
	useEffect(
		() =>
			repo.suscribirRegistrosDelDia(
				fecha,
				(datos) => setCargados({ fecha, datos }),
				(e) => setErrorDia({ fecha, mensaje: mensajeDeError(e) }),
			),
		[fecha, repo],
	);

	const personalPorId = useMemo(
		() => new Map(personal.map((p) => [p.id, p])),
		[personal],
	);
	const cursosPorId = useMemo(
		() => new Map(cursos.map((c) => [c.id, c])),
		[cursos],
	);
	const secretariasActivas = personal.filter(
		(p) => p.rol === "secretaria" && p.activo,
	);
	const profesorasActivas = personal.filter(
		(p) => p.rol === "profesora" && p.activo,
	);

	// ── Clases esperadas del día + registradas ────────────────────────────────
	const filasClases: FilaClase[] = useMemo(() => {
		const dia = diaSemanaDeFecha(fecha);
		const dictadas = new Map(
			(registros?.clases ?? []).map((c) => [c.id, c]),
		);
		const filas: FilaClase[] = [];

		cursos
			.filter(
				(c) => c.activo && c.fechaInicio <= fecha && fecha <= c.fechaFin,
			)
			.forEach((c) =>
				c.horarios
					.filter((h) => h.dia === dia)
					.forEach((h) => {
						const id = idClaseDictada(c.id, fecha, h.inicio);
						filas.push({
							key: id,
							curso: c,
							cursoNombre: c.nombre,
							horaInicio: h.inicio,
							horaFin: h.fin,
							titulares: c.profesoraNombres,
							dictada: dictadas.get(id) ?? null,
							fueraDeHorario: false,
						});
						dictadas.delete(id);
					}),
			);

		// Registradas que no coinciden con ningún horario (clases extra)
		dictadas.forEach((d) =>
			filas.push({
				key: d.id,
				curso: cursosPorId.get(d.cursoId) ?? null,
				cursoNombre: d.cursoNombre,
				horaInicio: d.horaInicio,
				horaFin: d.horaFin,
				titulares: cursosPorId.get(d.cursoId)?.profesoraNombres ?? [],
				dictada: d,
				fueraDeHorario: true,
			}),
		);

		return filas.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
	}, [cursos, cursosPorId, fecha, registros]);

	const jornadas = registros?.jornadas ?? [];
	const jornadasSinSalida = jornadas.filter(
		(j) => j.estado === "Activa" && !j.salida,
	).length;

	// ── Abrir modales ─────────────────────────────────────────────────────────
	const cerrarModales = () => {
		setModalJornada(null);
		setModalClase(null);
		setModalAnular(null);
		setErrorForm(null);
	};

	const abrirNuevaJornada = () => {
		setFj({
			personaId: secretariasActivas[0]?.id ?? "",
			entrada: "08:00",
			salida: "13:00",
			motivo: "",
		});
		setErrorForm(null);
		setModalJornada({ modo: "nueva" });
	};

	const abrirEditarJornada = (j: Jornada) => {
		setFj({
			personaId: j.personalId,
			entrada: horaAR(j.entrada),
			salida: j.salida ? horaAR(j.salida) : "",
			motivo: "",
		});
		setErrorForm(null);
		setModalJornada({ modo: "editar", jornada: j });
	};

	const abrirNuevaClase = (fila?: FilaClase) => {
		const curso = fila?.curso ?? cursos.find((c) => c.activo) ?? null;
		const primerTurno = turnosDelCurso(curso ?? undefined)[0];
		const turno = fila
			? `${fila.horaInicio}-${fila.horaFin}`
			: primerTurno
				? `${primerTurno.inicio}-${primerTurno.fin}`
				: "otro";
		setFc({
			cursoId: curso?.id ?? "",
			turno,
			inicio: fila?.horaInicio ?? "18:00",
			fin: fila?.horaFin ?? "19:30",
			profesoraId: curso?.profesoraIds[0] ?? profesorasActivas[0]?.id ?? "",
			contarIgual: false,
			motivo: "",
		});
		setErrorForm(null);
		setModalClase({ modo: "nueva", cursoId: curso?.id, turno });
	};

	const abrirEditarClase = (c: ClaseDictada) => {
		setFc((f) => ({
			...f,
			profesoraId: c.profesoraDictoId,
			contarIgual: c.contarIgual,
			motivo: "",
		}));
		setErrorForm(null);
		setModalClase({ modo: "editar", clase: c });
	};

	// ── Guardados ─────────────────────────────────────────────────────────────
	const ejecutar = async (fn: () => Promise<void>, mensajeOk: string) => {
		setGuardando(true);
		setErrorForm(null);
		try {
			await fn();
			notificar(mensajeOk);
			cerrarModales();
		} catch (e) {
			setErrorForm(mensajeDeError(e));
		} finally {
			setGuardando(false);
		}
	};

	const guardarJornada = () => {
		if (!modalJornada) return;
		if (modalJornada.modo === "nueva") {
			const persona = personalPorId.get(fj.personaId);
			if (!persona) return setErrorForm("Elegí una secretaria.");
			return ejecutar(
				() =>
					repo.crearJornadaManual({
						persona,
						fecha,
						entrada: fj.entrada,
						salida: fj.salida,
						motivo: fj.motivo.trim(),
					}),
				`Jornada de ${persona.nombre} cargada.`,
			);
		}
		return ejecutar(
			() =>
				repo.editarJornada(
					modalJornada.jornada,
					{ entrada: fj.entrada, salida: fj.salida || null },
					fj.motivo.trim(),
				),
			"Jornada actualizada.",
		);
	};

	const turnosDelCurso = (curso: Curso | undefined) =>
		curso
			? curso.horarios
					.filter((h) => h.dia === diaSemanaDeFecha(fecha))
					.sort((a, b) => a.inicio.localeCompare(b.inicio))
			: [];

	const guardarClase = () => {
		if (!modalClase) return;
		const profesora = personalPorId.get(fc.profesoraId);
		if (!profesora) return setErrorForm("Elegí quién dio la clase.");

		if (modalClase.modo === "nueva") {
			const curso = cursosPorId.get(fc.cursoId);
			if (!curso) return setErrorForm("Elegí un curso.");
			const [inicio, fin] =
				fc.turno && fc.turno !== "otro"
					? fc.turno.split("-")
					: [fc.inicio, fc.fin];
			return ejecutar(
				() =>
					repo.crearClaseManual({
						curso,
						fecha,
						horaInicio: inicio,
						horaFin: fin,
						profesora,
						motivo: fc.motivo.trim(),
					}),
				`Clase de ${curso.nombre} registrada.`,
			);
		}
		return ejecutar(
			() =>
				repo.editarClase(
					modalClase.clase,
					{ profesora, contarIgual: fc.contarIgual },
					fc.motivo.trim(),
				),
			"Clase actualizada.",
		);
	};

	const confirmarAnular = () => {
		if (!modalAnular) return;
		const motivo = motivoAnular.trim();
		return modalAnular.tipo === "jornada"
			? ejecutar(
					() => repo.anularJornada(modalAnular.jornada, motivo),
					"Jornada anulada.",
				)
			: ejecutar(
					() => repo.anularClase(modalAnular.clase, motivo),
					"Clase anulada.",
				);
	};

	// ── Validaciones de formularios ───────────────────────────────────────────
	const jornadaValida = (() => {
		if (!fj.motivo.trim() || !esHoraValida(fj.entrada)) return false;
		if (modalJornada?.modo === "nueva")
			return !!fj.personaId && esHoraValida(fj.salida) && fj.salida > fj.entrada;
		return fj.salida === "" || (esHoraValida(fj.salida) && fj.salida > fj.entrada);
	})();

	const cursoSeleccionado = cursosPorId.get(fc.cursoId);
	const turnos = turnosDelCurso(cursoSeleccionado);
	const claseValida = (() => {
		if (!fc.motivo.trim() || !fc.profesoraId) return false;
		if (modalClase?.modo === "nueva") {
			if (!fc.cursoId || !fc.turno) return false;
			if (fc.turno === "otro")
				return esHoraValida(fc.inicio) && esHoraValida(fc.fin) && fc.fin > fc.inicio;
		}
		return true;
	})();

	const titularesSeleccion =
		modalClase?.modo === "editar"
			? modalClase.clase.titularIds
			: (cursoSeleccionado?.profesoraIds ?? []);
	const seraReemplazo =
		!!fc.profesoraId && !titularesSeleccion.includes(fc.profesoraId);
	// Cargar una clase de su titular es un registro manual; si la dio otra, es un cambio
	const claseRegistroManual = modalClase?.modo === "nueva" && !seraReemplazo;

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<div className="space-y-4">
			{/* Navegación de fecha + vista */}
			<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon"
						onClick={() => setFecha(sumarDias(fecha, -1))}
						disabled={!!minimo && fecha <= minimo}
						title={
							minimo && fecha <= minimo ? "El registro empieza este día" : undefined
						}
						className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl"
						aria-label="Día anterior"
					>
						<ChevronLeft className="w-4 h-4" />
					</Button>
					<input
						type="date"
						value={fecha}
						min={minimo || undefined}
						max={hoy}
						onChange={(e) => e.target.value && setFecha(e.target.value)}
						className="text-sm font-semibold text-[#252d62] border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#252d62]/20"
					/>
					<Button
						variant="outline"
						size="icon"
						onClick={() => setFecha(sumarDias(fecha, 1))}
						disabled={fecha >= hoy}
						className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl"
						aria-label="Día siguiente"
					>
						<ChevronRight className="w-4 h-4" />
					</Button>
					{fecha !== hoy && (
						<Button
							variant="ghost"
							onClick={() => setFecha(hoy)}
							className="font-bold text-gray-500 hover:bg-gray-100 rounded-xl"
						>
							Hoy
						</Button>
					)}
				</div>
				<p className="text-sm font-medium text-gray-500 lg:ml-2">
					{fechaLarga(fecha)}
				</p>
				<div className="lg:ml-auto">
					<Segmentado
						opciones={
							[
								["jornadas", `Secretarias (${jornadas.length})`],
								["clases", `Clases (${filasClases.length})`],
							] as const
						}
						valor={vista}
						onChange={setVista}
					/>
				</div>
			</div>

			{errorCarga && (
				<div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
					No se pudieron cargar los registros: {errorCarga}
				</div>
			)}

			{/* Contenido */}
			<div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
				<div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
					<p className="text-sm text-gray-500">
						{vista === "jornadas"
							? jornadasSinSalida > 0
								? `${jornadasSinSalida} jornada${jornadasSinSalida === 1 ? "" : "s"} sin salida`
								: "Entradas y salidas de las secretarias"
							: "Clases esperadas según los horarios de cada curso"}
					</p>
					{vista === "jornadas" ? (
						<Button
							onClick={abrirNuevaJornada}
							disabled={secretariasActivas.length === 0}
							className="bg-[#252d62] hover:bg-[#1a2046] text-white font-semibold rounded-xl h-9 px-4 flex items-center gap-2"
						>
							<Plus className="w-4 h-4" /> Cargar jornada
						</Button>
					) : (
						<Button
							onClick={() => abrirNuevaClase()}
							disabled={cursos.length === 0}
							className="bg-[#252d62] hover:bg-[#1a2046] text-white font-semibold rounded-xl h-9 px-4 flex items-center gap-2"
						>
							<Plus className="w-4 h-4" /> Registrar clase
						</Button>
					)}
				</div>

				{!registros && !errorCarga ? (
					<div className="flex items-center justify-center h-48">
						<Loader2 className="w-8 h-8 animate-spin text-[#252d62]" />
					</div>
				) : vista === "jornadas" ? (
					jornadas.length === 0 ? (
						<Vacio
							icono={Briefcase}
							titulo="No hay jornadas registradas este día"
							texto="Si alguien vino y no fichó, cargala con “Cargar jornada”."
						/>
					) : (
						<div className="divide-y divide-gray-50">
							{jornadas.map((j, idx) => {
								const anulada = j.estado === "Anulada";
								const enCurso = !j.salida && j.fecha === hoy && !j.incompleta;
								return (
									<motion.div
										key={j.id}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: Math.min(idx, 10) * 0.03 }}
										className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 hover:bg-gray-50 transition-colors ${anulada ? "opacity-60" : ""}`}
									>
										<div className="flex items-center gap-3 min-w-0">
											<div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs shrink-0">
												{iniciales(j.personalNombre)}
											</div>
											<div className="min-w-0">
												<p
													className={`font-bold text-gray-900 text-sm ${anulada ? "line-through" : ""}`}
												>
													{j.personalNombre}
												</p>
												<p className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
													<Clock className="w-3 h-3" />
													{horaAR(j.entrada)} → {j.salida ? horaAR(j.salida) : "—"}
													{j.origen === "manual" && (
														<span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
															Manual
														</span>
													)}
													{j.fueOffline && (
														<WifiOff className="w-3 h-3 text-gray-400" aria-label="Sin conexión" />
													)}
												</p>
											</div>
										</div>
										<div className="flex items-center gap-2 shrink-0">
											{anulada ? (
												<Badge icon={Ban} className="bg-gray-100 text-gray-400 border-gray-200">
													Anulada
												</Badge>
											) : j.salida ? (
												<Badge
													icon={CheckCircle2}
													className="bg-green-50 text-green-700 border-green-100"
												>
													{formatMinutos(j.minutos ?? 0)}
												</Badge>
											) : enCurso ? (
												<Badge icon={Clock} className="bg-indigo-50 text-indigo-700 border-indigo-100">
													En curso
												</Badge>
											) : (
												<button
													onClick={() => abrirEditarJornada(j)}
													className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-colors"
												>
													<LogOut className="w-3.5 h-3.5" /> Cargar salida
												</button>
											)}
											{!anulada && (
												<>
													<button
														onClick={() => abrirEditarJornada(j)}
														className="p-1.5 rounded-lg text-gray-400 hover:text-[#252d62] hover:bg-indigo-50 transition-colors"
														aria-label="Editar jornada"
													>
														<Pencil className="w-4 h-4" />
													</button>
													<button
														onClick={() => {
															setMotivoAnular("");
															setErrorForm(null);
															setModalAnular({ tipo: "jornada", jornada: j });
														}}
														className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
														aria-label="Anular jornada"
													>
														<Ban className="w-4 h-4" />
													</button>
												</>
											)}
										</div>
									</motion.div>
								);
							})}
						</div>
					)
				) : filasClases.length === 0 ? (
					<Vacio
						icono={BookOpen}
						titulo="No hay clases este día"
						texto="Ningún curso activo tiene horario este día. Si se dio una clase extra, registrala igual."
					/>
				) : (
					<div className="divide-y divide-gray-50">
						{filasClases.map((f, idx) => {
							const d = f.dictada;
							const anulada = d?.estado === "Anulada";
							const pasada = fecha < hoy;
							return (
								<motion.div
									key={f.key}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: Math.min(idx, 10) * 0.03 }}
									className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 hover:bg-gray-50 transition-colors ${anulada ? "opacity-60" : ""}`}
								>
									<div className="min-w-0">
										<div className="flex items-center gap-2 mb-1 flex-wrap">
											<span className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
												<Clock className="w-3 h-3" />
												{f.horaInicio}–{f.horaFin}
											</span>
											<p
												className={`font-bold text-gray-900 text-sm ${anulada ? "line-through" : ""}`}
											>
												{f.cursoNombre}
											</p>
											{f.fueraDeHorario && (
												<span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
													Fuera de horario
												</span>
											)}
										</div>
										<p className="text-xs text-gray-500">
											{d
												? d.esReemplazo
													? `Dio: ${d.profesoraDictoNombre} · titular ${f.titulares.join(", ") || "—"}`
													: `Dio: ${d.profesoraDictoNombre}`
												: f.titulares.join(", ") || "Sin profesora asignada"}
											{d?.origen === "manual" && " · carga manual"}
											{d?.contarIgual && " · cuenta igual"}
										</p>
									</div>
									<div className="flex items-center gap-2 shrink-0">
										{anulada ? (
											<Badge icon={Ban} className="bg-gray-100 text-gray-400 border-gray-200">
												Anulada
											</Badge>
										) : d?.esReemplazo ? (
											<Badge icon={Repeat} className="bg-indigo-50 text-indigo-700 border-indigo-100">
												Reemplazo
											</Badge>
										) : d ? (
											<Badge icon={UserCheck} className="bg-green-50 text-green-700 border-green-100">
												Dada
											</Badge>
										) : (
											<Badge
												icon={pasada ? AlertTriangle : CalendarDays}
												className={
													pasada
														? "bg-amber-50 text-amber-700 border-amber-100"
														: "bg-gray-100 text-gray-500 border-gray-200"
												}
											>
												{pasada ? "Sin registro" : "Sin registro aún"}
											</Badge>
										)}
										{!d || anulada ? (
											<button
												onClick={() => abrirNuevaClase(f)}
												disabled={!f.curso}
												className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-[#252d62] text-white hover:bg-[#1a2046] transition-colors disabled:opacity-50"
											>
												<Plus className="w-3.5 h-3.5" /> Registrar
											</button>
										) : (
											<>
												<button
													onClick={() => abrirEditarClase(d)}
													className="p-1.5 rounded-lg text-gray-400 hover:text-[#252d62] hover:bg-indigo-50 transition-colors"
													aria-label="Editar clase"
												>
													<Pencil className="w-4 h-4" />
												</button>
												<button
													onClick={() => {
														setMotivoAnular("");
														setErrorForm(null);
														setModalAnular({ tipo: "clase", clase: d });
													}}
													className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
													aria-label="Anular clase"
												>
													<Ban className="w-4 h-4" />
												</button>
											</>
										)}
									</div>
								</motion.div>
							);
						})}
					</div>
				)}
			</div>

			{/* ══ Modal jornada ══ */}
			<ModalFormulario
				abierto={!!modalJornada}
				onCerrar={cerrarModales}
				titulo={
					modalJornada?.modo === "nueva"
						? "Cargar jornada"
						: modalJornada && !modalJornada.jornada.salida
							? "Cargar salida"
							: "Editar jornada"
				}
				subtitulo={
					modalJornada?.modo === "editar"
						? `${modalJornada.jornada.personalNombre} · ${fechaLarga(fecha)}`
						: fechaLarga(fecha)
				}
				icono={Briefcase}
				error={errorForm}
				guardando={guardando}
				puedeGuardar={jornadaValida}
				onGuardar={guardarJornada}
			>
				{modalJornada?.modo === "nueva" && (
					<Campo label="Secretaria">
						<select
							value={fj.personaId}
							onChange={(e) => setFj({ ...fj, personaId: e.target.value })}
							className={inputClase}
						>
							{secretariasActivas.map((p) => (
								<option key={p.id} value={p.id}>
									{nombreCompleto(p)}
								</option>
							))}
						</select>
					</Campo>
				)}
				<div className="grid grid-cols-2 gap-4">
					<Campo label="Entrada">
						<input
							type="time"
							value={fj.entrada}
							onChange={(e) => setFj({ ...fj, entrada: e.target.value })}
							className={inputClase}
						/>
					</Campo>
					<Campo
						label="Salida"
						hint={modalJornada?.modo === "editar" ? "Vacío = sin salida" : undefined}
					>
						<input
							type="time"
							value={fj.salida}
							onChange={(e) => setFj({ ...fj, salida: e.target.value })}
							className={inputClase}
							autoFocus={modalJornada?.modo === "editar" && !fj.salida}
						/>
					</Campo>
				</div>
				{esHoraValida(fj.entrada) && esHoraValida(fj.salida) && fj.salida > fj.entrada && (
					<p className="text-sm text-gray-600">
						Duración:{" "}
						<strong className="text-[#252d62]">
							{formatMinutos(
								(Number(fj.salida.slice(0, 2)) * 60 + Number(fj.salida.slice(3))) -
									(Number(fj.entrada.slice(0, 2)) * 60 + Number(fj.entrada.slice(3))),
							)}
						</strong>
					</p>
				)}
				<CampoMotivo
					value={fj.motivo}
					onChange={(motivo) => setFj({ ...fj, motivo })}
					{...(modalJornada?.modo === "nueva"
						? { label: "Motivo del registro manual", placeholder: "Ej.: se olvidó el llavero" }
						: {})}
				/>
				{modalJornada?.modo === "editar" && (
					<Historial items={modalJornada.jornada.historial} />
				)}
			</ModalFormulario>

			{/* ══ Modal clase ══ */}
			<ModalFormulario
				abierto={!!modalClase}
				onCerrar={cerrarModales}
				titulo={modalClase?.modo === "editar" ? "Editar clase" : "Registrar clase"}
				subtitulo={
					modalClase?.modo === "editar"
						? `${modalClase.clase.cursoNombre} · ${modalClase.clase.horaInicio}–${modalClase.clase.horaFin}`
						: fechaLarga(fecha)
				}
				icono={ClipboardList}
				error={errorForm}
				guardando={guardando}
				puedeGuardar={claseValida}
				onGuardar={guardarClase}
			>
				{modalClase?.modo === "nueva" && (
					<>
						<Campo label="Curso">
							<select
								value={fc.cursoId}
								onChange={(e) => {
									const c = cursosPorId.get(e.target.value);
									const t = turnosDelCurso(c)[0];
									setFc({
										...fc,
										cursoId: e.target.value,
										turno: t ? `${t.inicio}-${t.fin}` : "otro",
										profesoraId: c?.profesoraIds[0] ?? fc.profesoraId,
									});
								}}
								className={inputClase}
							>
								<option value="" disabled>
									Elegí un curso
								</option>
								{cursos
									.filter((c) => c.activo)
									.map((c) => (
										<option key={c.id} value={c.id}>
											{c.nombre}
										</option>
									))}
							</select>
						</Campo>
						<Campo
							label="Horario"
							hint={
								turnos.length === 0
									? "Este curso no tiene clases este día: indicá el horario de la clase extra."
									: undefined
							}
						>
							<select
								value={fc.turno}
								onChange={(e) => setFc({ ...fc, turno: e.target.value })}
								className={inputClase}
							>
								<option value="" disabled>
									Elegí el horario
								</option>
								{turnos.map((t) => (
									<option key={t.inicio} value={`${t.inicio}-${t.fin}`}>
										{t.inicio} a {t.fin}
									</option>
								))}
								<option value="otro">Otro horario (clase extra)</option>
							</select>
						</Campo>
						{fc.turno === "otro" && (
							<div className="grid grid-cols-2 gap-4">
								<Campo label="Inicio">
									<input
										type="time"
										value={fc.inicio}
										onChange={(e) => setFc({ ...fc, inicio: e.target.value })}
										className={inputClase}
									/>
								</Campo>
								<Campo label="Fin">
									<input
										type="time"
										value={fc.fin}
										onChange={(e) => setFc({ ...fc, fin: e.target.value })}
										className={inputClase}
									/>
								</Campo>
							</div>
						)}
					</>
				)}

				<Campo label="¿Quién dio la clase?">
					<select
						value={fc.profesoraId}
						onChange={(e) => setFc({ ...fc, profesoraId: e.target.value })}
						className={inputClase}
					>
						<option value="" disabled>
							Elegí una profesora
						</option>
						{(() => {
							const titulares = profesorasActivas.filter((p) =>
								titularesSeleccion.includes(p.id),
							);
							const otras = profesorasActivas.filter(
								(p) => !titularesSeleccion.includes(p.id),
							);
							const actual =
								modalClase?.modo === "editar" &&
								!profesorasActivas.some((p) => p.id === modalClase.clase.profesoraDictoId)
									? personalPorId.get(modalClase.clase.profesoraDictoId)
									: undefined;
							return (
								<>
									{actual && (
										<option value={actual.id}>
											{nombreCompleto(actual)} (inactiva)
										</option>
									)}
									{titulares.length > 0 && (
										<optgroup label="Titulares del curso">
											{titulares.map((p) => (
												<option key={p.id} value={p.id}>
													{nombreCompleto(p)}
												</option>
											))}
										</optgroup>
									)}
									{otras.length > 0 && (
										<optgroup label="Otras profesoras (reemplazo)">
											{otras.map((p) => (
												<option key={p.id} value={p.id}>
													{nombreCompleto(p)}
												</option>
											))}
										</optgroup>
									)}
								</>
							);
						})()}
					</select>
				</Campo>
				{seraReemplazo && (
					<div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 flex items-center gap-2">
						<Repeat className="w-4 h-4 shrink-0" />
						No es titular del curso: la clase queda como <strong>reemplazo</strong> y
						cuenta para ella.
					</div>
				)}
				{modalClase?.modo === "editar" && (
					<Interruptor
						activo={fc.contarIgual}
						onChange={(contarIgual) => setFc({ ...fc, contarIgual })}
						label="Contar igual aunque caiga en un día especial"
					/>
				)}
				<CampoMotivo
					value={fc.motivo}
					onChange={(motivo) => setFc({ ...fc, motivo })}
					label={claseRegistroManual ? "Motivo del registro manual" : "Motivo del cambio"}
					placeholder={
						claseRegistroManual
							? "Ej.: se olvidó el llavero"
							: seraReemplazo
								? "Ej.: reemplazó a la titular, que estaba enferma"
								: "Ej.: se cargó a la profesora equivocada"
					}
				/>
				{modalClase?.modo === "editar" && (
					<Historial items={modalClase.clase.historial} />
				)}
			</ModalFormulario>

			{/* ══ Modal anular ══ */}
			<ModalFormulario
				abierto={!!modalAnular}
				onCerrar={cerrarModales}
				titulo={modalAnular?.tipo === "clase" ? "Anular clase" : "Anular jornada"}
				subtitulo="No se borra: queda en el historial y deja de contar para el recibo"
				icono={Ban}
				error={errorForm}
				guardando={guardando}
				puedeGuardar={motivoAnular.trim().length > 0}
				onGuardar={confirmarAnular}
				textoGuardar="Anular"
				variante="rojo"
			>
				{modalAnular && (
					<div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700">
						{modalAnular.tipo === "jornada"
							? `${modalAnular.jornada.personalNombre} · ${horaAR(modalAnular.jornada.entrada)} → ${modalAnular.jornada.salida ? horaAR(modalAnular.jornada.salida) : "—"}`
							: `${modalAnular.clase.cursoNombre} · ${modalAnular.clase.horaInicio}–${modalAnular.clase.horaFin} · ${modalAnular.clase.profesoraDictoNombre}`}
					</div>
				)}
				<CampoMotivo
					value={motivoAnular}
					onChange={setMotivoAnular}
					placeholder="Ej.: fichada por error"
				/>
			</ModalFormulario>
		</div>
	);
}
