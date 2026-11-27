"use client";

/**
 * Liquidación de cursos (solo director).
 *
 * Los cursos se crean y editan en Admin → Cursos (nombre, horarios, vigencia):
 * acá se ven tal cual. Lo que se edita es lo que define el pago de las profesoras:
 * - Profesoras: es la misma asignación que Configuración → Gestionar profesores
 *   (`Teachers.cursosAsignados`), y los días que da cada una (`Teachers.diasAsignados`):
 *   las titulares de cada clase son las de ese día (ver titulares.ts).
 * - Alumnos: salen de los inscriptos (Users + Hijos), con opción de corregirlos.
 * - Monto fijo y porcentaje de cada profesora (`CursosLiquidacion`).
 */
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
	AlertTriangle,
	BookOpen,
	CalendarClock,
	CalendarRange,
	Clock,
	DollarSign,
	ExternalLink,
	Lock,
	Pencil,
	Search,
	Users,
} from "lucide-react";
import {
	DIAS_SEMANA,
	fechaAR,
	fechaCorta,
	nombrePeriodo,
	sumarMeses,
} from "@/lib/asistencia/fechas";
import {
	clasesDelMesDeProfesora,
	clasesDelMesSegunHorarios,
	cursoSinDatosDePago,
	pagoMensual,
	pagoPorClaseEstimado,
	sumaPorcentajes,
} from "@/lib/asistencia/pagoCursos";
import { formatPesos } from "@/lib/asistencia/dinero";
import { diasSinTitular, faltaRepartirDias } from "@/lib/asistencia/titulares";
import type { RepositorioCarga } from "@/lib/asistencia/repositorio";
import {
	nombreCompleto,
	type Curso,
	type DiaSemana,
	type LiquidacionCursoInput,
	type Persona,
} from "@/lib/asistencia/tipos";
import {
	Campo,
	Interruptor,
	ModalFormulario,
	Vacio,
	inputClase,
	inputFiltroClase,
	mensajeDeError,
	type Notificar,
} from "./ui";

const diaCorto = (d: DiaSemana) =>
	DIAS_SEMANA.find((x) => x.valor === d)?.corto ?? "?";

/** "Lu, Mi" (null = todos los días del curso) */
const textoDias = (dias: DiaSemana[] | null) =>
	dias === null ? "todos los días" : dias.length === 0 ? "sin días" : dias.map(diaCorto).join(", ");

/** Horarios del curso de ese día: "18:00–19:30 y 20:00–21:00" */
const horariosDelDia = (c: Curso, d: DiaSemana) =>
	c.horarios
		.filter((h) => h.dia === d)
		.map((h) => `${h.inicio}–${h.fin}`)
		.join(" y ");

type Seccion = "profesoras" | "precios";

/** "" → null; si no es un número válido, NaN (lo marca la validación) */
const leerNumero = (v: string) => (v.trim() === "" ? null : Number(v));

/** Meses de la vigencia del curso (como mucho 24), para elegir el del estimado */
const mesesDeVigencia = (c: Pick<Curso, "fechaInicio" | "fechaFin">) => {
	const desde = c.fechaInicio.slice(0, 7);
	const hasta = c.fechaFin.slice(0, 7);
	if (!/^\d{4}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}$/.test(hasta) || hasta < desde)
		return [];
	const meses: string[] = [];
	for (let m = desde; m <= hasta && meses.length < 24; m = sumarMeses(m, 1))
		meses.push(m);
	return meses;
};

/** Devuelve el primer error de validación (y en qué sección está), o null */
const validar = (
	f: LiquidacionCursoInput,
	conDias: boolean,
	nombreDe: (id: string) => string,
): { mensaje: string; seccion: Seccion } | null => {
	const precios = (mensaje: string) => ({ mensaje, seccion: "precios" as const });
	if (conDias) {
		const sinDias = f.profesoraIds.find((id) => (f.diasPorProfesora[id] ?? []).length === 0);
		if (sinDias)
			return {
				mensaje: `Elegí qué días da ${nombreDe(sinDias)}, o sacala del curso.`,
				seccion: "profesoras",
			};
	}
	// Precios: opcionales (si faltan, el recibo lo avisa), pero si están tienen que ser válidos
	if (
		f.cantidadAlumnosManual !== null &&
		(!Number.isInteger(f.cantidadAlumnosManual) || f.cantidadAlumnosManual < 0)
	)
		return precios("La cantidad de alumnos tiene que ser un número entero.");
	if (f.montoFijo !== null && (!Number.isFinite(f.montoFijo) || f.montoFijo < 0))
		return precios("El monto fijo tiene que ser un número positivo.");
	for (const id of f.profesoraIds) {
		const pct = f.porcentajes[id];
		if (pct !== undefined && (!Number.isFinite(pct) || pct < 0 || pct > 100))
			return precios("Cada porcentaje tiene que estar entre 0 y 100.");
	}
	return null;
};

/** Texto de alumnos de la tarjeta: los que se usan y de dónde salen */
const textoAlumnos = (c: Curso) => {
	const n = c.cantidadAlumnos;
	const base = n === null ? "Sin alumnos" : `${n} alumno${n === 1 ? "" : "s"}`;
	if (c.alumnosCorregidos)
		return `${base} (corregido${c.alumnosInscriptos !== null ? ` · ${c.alumnosInscriptos} inscriptos` : ""})`;
	return n === null ? base : `${base} inscriptos`;
};

export default function TabCursos({
	cursos,
	personal,
	repo,
	notificar,
}: {
	cursos: Curso[];
	personal: Persona[];
	repo: RepositorioCarga;
	notificar: Notificar;
}) {
	const [busqueda, setBusqueda] = useState("");
	const [verInactivos, setVerInactivos] = useState(false);

	const [editando, setEditando] = useState<Curso | null>(null);
	const [form, setForm] = useState<LiquidacionCursoInput | null>(null);
	const [corregirAlumnos, setCorregirAlumnos] = useState(false);
	const [seccion, setSeccion] = useState<Seccion>("profesoras");
	const [mesEstimado, setMesEstimado] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [guardando, setGuardando] = useState(false);

	// Profesoras, y secretarias que también lo son
	const profesoras = useMemo(
		() => personal.filter((p) => p.rol === "profesora" || p.tambienProfesora === true),
		[personal],
	);

	const filtrados = useMemo(() => {
		const q = busqueda.trim().toLowerCase();
		return cursos.filter(
			(c) =>
				(verInactivos || c.activo) &&
				(!q ||
					c.nombre.toLowerCase().includes(q) ||
					c.profesoraNombres.some((n) => n.toLowerCase().includes(q))),
		);
	}, [cursos, busqueda, verInactivos]);

	const abrirEdicion = (c: Curso) => {
		setEditando(c);
		setForm({
			profesoraIds: [...c.profesoraIds],
			// Las que todavía no tienen días repartidos (null) dan todos los días
			diasPorProfesora: Object.fromEntries(
				c.profesoraIds.map((id) => [id, [...(c.diasPorProfesora[id] ?? c.diasDeClase)]]),
			),
			cantidadAlumnosManual: c.alumnosCorregidos ? c.cantidadAlumnos : null,
			montoFijo: c.montoFijo,
			porcentajes: { ...c.porcentajes },
		});
		setCorregirAlumnos(c.alumnosCorregidos);
		setSeccion("profesoras");
		setMesEstimado(null);
		setError(null);
	};

	const cerrar = () => {
		setEditando(null);
		setForm(null);
	};

	const toggleProfesora = (id: string) =>
		setForm((f) => {
			if (!f || !editando) return f;
			const diasPorProfesora = { ...f.diasPorProfesora };
			if (f.profesoraIds.includes(id)) {
				delete diasPorProfesora[id];
				return {
					...f,
					profesoraIds: f.profesoraIds.filter((x) => x !== id),
					diasPorProfesora,
				};
			}
			// Una profesora nueva arranca con los días que no tiene nadie
			const cubiertos = new Set(f.profesoraIds.flatMap((p) => f.diasPorProfesora[p] ?? []));
			diasPorProfesora[id] = editando.diasDeClase.filter((d) => !cubiertos.has(d));
			return { ...f, profesoraIds: [...f.profesoraIds, id], diasPorProfesora };
		});

	const toggleDia = (id: string, dia: DiaSemana) =>
		setForm((f) => {
			if (!f) return f;
			const actuales = f.diasPorProfesora[id] ?? [];
			const dias = actuales.includes(dia)
				? actuales.filter((d) => d !== dia)
				: [...actuales, dia].sort((a, b) => a - b);
			return { ...f, diasPorProfesora: { ...f.diasPorProfesora, [id]: dias } };
		});

	const setPorcentaje = (id: string, valor: string) =>
		setForm((f) => {
			if (!f) return f;
			const porcentajes = { ...f.porcentajes };
			const n = leerNumero(valor);
			if (n === null) delete porcentajes[id];
			else porcentajes[id] = n;
			return { ...f, porcentajes };
		});

	// Lo que se está editando, como curso, para los cálculos del estimado
	const borrador: Curso | null =
		editando && form
			? {
					...editando,
					profesoraIds: form.profesoraIds,
					diasPorProfesora: form.diasPorProfesora,
					montoFijo: form.montoFijo,
					porcentajes: form.porcentajes,
					cantidadAlumnos: corregirAlumnos
						? form.cantidadAlumnosManual
						: editando.alumnosInscriptos,
				}
			: null;

	// Mes del estimado por clase: el elegido, o el actual si está en la vigencia, o el primero
	const meses = borrador ? mesesDeVigencia(borrador) : [];
	const mesActual = fechaAR(new Date()).slice(0, 7);
	const mes =
		mesEstimado && meses.includes(mesEstimado)
			? mesEstimado
			: meses.includes(mesActual)
				? mesActual
				: (meses[0] ?? mesActual);
	const clasesDelMes = borrador ? clasesDelMesSegunHorarios(borrador, mes) : 0;
	const totalPorcentajes = borrador ? sumaPorcentajes(borrador) : 0;
	const sinProfesoras = (form?.profesoraIds.length ?? 0) === 0;

	const guardar = async () => {
		if (!editando || !form) return;
		const datos: LiquidacionCursoInput = {
			...form,
			cantidadAlumnosManual: corregirAlumnos ? form.cantidadAlumnosManual : null,
		};
		const err = validar(datos, editando.diasDeClase.length > 0, (id) => {
			const p = profesoras.find((x) => x.id === id);
			return p ? nombreCompleto(p) : "la profesora";
		});
		if (err) {
			setError(err.mensaje);
			setSeccion(err.seccion);
			return;
		}
		setGuardando(true);
		setError(null);
		try {
			await repo.guardarLiquidacionCurso(editando, datos);
			notificar(`Se guardó la liquidación de ${editando.nombre}.`);
			cerrar();
		} catch (e) {
			setError(mensajeDeError(e));
		} finally {
			setGuardando(false);
		}
	};

	// Profesoras para el formulario: activas + las inactivas que ya estaban asignadas
	const profesorasFormulario = profesoras.filter(
		(p) => p.activo || (form?.profesoraIds.includes(p.id) ?? false),
	);

	return (
		<div className="space-y-4">
			{/* Barra */}
			<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
					<input
						value={busqueda}
						onChange={(e) => setBusqueda(e.target.value)}
						placeholder="Buscar curso o profesora..."
						className={`${inputFiltroClase} w-full pl-9`}
					/>
				</div>
				<label className="flex items-center gap-2 text-sm text-gray-600 select-none">
					<input
						type="checkbox"
						checked={verInactivos}
						onChange={(e) => setVerInactivos(e.target.checked)}
						className="w-4 h-4 accent-[#252d62]"
					/>
					Mostrar inactivos
				</label>
				<Link
					href="/admin/cursos"
					className="flex items-center gap-2 text-sm font-bold text-[#252d62] hover:text-[#4338ca] px-2"
				>
					<ExternalLink className="w-4 h-4" /> Crear o editar cursos
				</Link>
			</div>

			<p className="text-xs text-gray-500 px-1">
				El nombre, los horarios y la vigencia de cada curso se cargan en{" "}
				<strong>Admin → Cursos</strong>. Acá se definen las profesoras titulares y
				lo que cobra cada una.
			</p>

			{/* Grilla de cursos */}
			{filtrados.length === 0 ? (
				<div className="bg-white rounded-xl border border-gray-100 shadow-sm">
					<Vacio
						icono={BookOpen}
						titulo={
							cursos.length === 0 ? "Todavía no hay cursos" : "No hay resultados"
						}
						texto={
							cursos.length === 0
								? "Cargá los cursos con sus horarios en Admin → Cursos: el registro los usa para esperar las clases de las profesoras."
								: "Probá con otra búsqueda."
						}
					/>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
					{filtrados.map((c, idx) => (
						<motion.div
							key={c.id}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: Math.min(idx, 9) * 0.05 }}
							className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col hover:shadow-md transition-shadow ${c.activo ? "" : "opacity-60"}`}
						>
							<div className="flex justify-between items-start gap-3 mb-3">
								<div className="flex items-center gap-3 min-w-0">
									<div className="w-11 h-11 bg-indigo-50 text-[#252d62] rounded-xl flex items-center justify-center shrink-0">
										<BookOpen className="w-5 h-5" />
									</div>
									<div className="min-w-0">
										<h3 className="font-bold text-gray-900 text-lg leading-tight truncate">
											{c.nombre}
										</h3>
										<p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
											<CalendarRange className="w-3 h-3" />
											{fechaCorta(c.fechaInicio)} → {fechaCorta(c.fechaFin)}
										</p>
									</div>
								</div>
								<span
									className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shrink-0 ${
										c.activo ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
									}`}
								>
									{c.activo ? "Activo" : "Inactivo"}
								</span>
							</div>

							<div className="flex flex-wrap gap-1.5 mb-3">
								{c.horarios.map((h, i) => (
									<span
										key={i}
										className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100"
									>
										<Clock className="w-3 h-3" />
										{diaCorto(h.dia)} {h.inicio}–{h.fin}
									</span>
								))}
								{c.horarios.length === 0 && (
									<span className="text-xs text-gray-400 italic">Sin horarios</span>
								)}
							</div>

							{c.horariosSinInterpretar.length > 0 && (
								<p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mb-3 flex items-start gap-1.5">
									<AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
									<span>
										El calendario y la aplicación de escritorio no esperan clases para:{" "}
										{c.horariosSinInterpretar.join(", ")}. Completá el horario (con
										hora de fin) en Admin → Cursos.
									</span>
								</p>
							)}

							{c.profesoraIds.length > 0 && (
								<p
									className={`text-sm font-bold flex items-center gap-1.5 mb-2 ${cursoSinDatosDePago(c) ? "text-amber-600" : "text-[#252d62]"}`}
								>
									<DollarSign className="w-4 h-4 shrink-0" />
									{textoAlumnos(c)}
									{c.montoFijo !== null
										? ` · ${formatPesos(c.montoFijo)} fijo`
										: " · falta el monto fijo"}
								</p>
							)}

							<div className="flex-1">
								{c.profesoraIds.length > 0 ? (
									<div className="text-sm text-gray-600 flex items-start gap-1.5">
										<Users className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
										<ul className="space-y-0.5 min-w-0">
											{c.profesoraIds.map((id, i) => {
												const mensual = pagoMensual(c, id);
												return (
													<li key={id} className="truncate">
														{c.profesoraNombres[i]}
														{c.diasDeClase.length > 0 && (
															<span className="text-gray-400">
																{" "}
																· {textoDias(c.diasPorProfesora[id] ?? null)}
															</span>
														)}
														{c.porcentajes[id] !== undefined && (
															<span className="text-gray-400">
																{" "}
																· {c.porcentajes[id]}%
																{mensual !== null && ` · ${formatPesos(mensual)}/mes`}
															</span>
														)}
													</li>
												);
											})}
										</ul>
									</div>
								) : (
									<p className="text-sm text-amber-600 flex items-center gap-1.5">
										<Users className="w-4 h-4" /> Sin profesora asignada
									</p>
								)}
								{faltaRepartirDias(c) ? (
									<p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-2 flex items-start gap-1.5">
										<AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
										<span>
											Falta repartir los días: hoy las {c.profesoraIds.length} profesoras
											son titulares de todas las clases.
										</span>
									</p>
								) : (
									diasSinTitular(c).length > 0 && (
										<p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-2 flex items-start gap-1.5">
											<AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
											<span>Sin profesora: {diasSinTitular(c).map(diaCorto).join(", ")}.</span>
										</p>
									)
								)}
							</div>

							<div className="mt-4 pt-3 border-t border-gray-50">
								<button
									onClick={() => abrirEdicion(c)}
									className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm bg-indigo-50 text-[#252d62] hover:bg-[#252d62] hover:text-white transition-all"
								>
									<Pencil className="w-4 h-4" /> Editar liquidación
								</button>
							</div>
						</motion.div>
					))}
				</div>
			)}

			{/* Modal */}
			<ModalFormulario
				abierto={!!editando}
				onCerrar={cerrar}
				titulo={editando ? `Liquidación de ${editando.nombre}` : ""}
				subtitulo={
					seccion === "profesoras"
						? "Quiénes dan el curso y qué días"
						: "Lo que cobra cada profesora por mes en este curso"
				}
				icono={CalendarClock}
				error={error}
				guardando={guardando}
				onGuardar={guardar}
				textoGuardar="Guardar"
				ancho="sm:max-w-2xl"
			>
				{editando && form && borrador && (
					<>
						{/* Secciones del formulario */}
						<div className="grid grid-cols-2 gap-1 bg-gray-50 rounded-xl p-1">
							{(
								[
									["profesoras", "Profesoras", Users],
									["precios", "Precios", DollarSign],
								] as const
							).map(([id, label, Icono]) => {
								const bloqueada = id === "precios" && sinProfesoras;
								return (
									<button
										key={id}
										type="button"
										disabled={bloqueada}
										onClick={() => {
											setSeccion(id);
											setError(null);
										}}
										title={bloqueada ? "Asigná al menos una profesora" : undefined}
										className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-all disabled:cursor-not-allowed disabled:text-gray-300 ${
											seccion === id
												? "bg-white shadow-sm text-[#252d62] font-semibold"
												: "text-gray-500 hover:text-gray-700"
										}`}
									>
										{bloqueada ? <Lock className="w-4 h-4" /> : <Icono className="w-4 h-4" />}
										{label}
									</button>
								);
							})}
						</div>

						{seccion === "profesoras" && (
							<div className="space-y-2">
								<label className="text-sm font-semibold text-gray-700">
									Profesoras titulares
								</label>
								{profesorasFormulario.length === 0 ? (
									<p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
										No hay profesoras cargadas. Agregalas primero en la tab
										&quot;Carga de personal&quot;.
									</p>
								) : (
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
										{profesorasFormulario.map((p) => {
											const sel = form.profesoraIds.includes(p.id);
											return (
												<label
													key={p.id}
													className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
														sel
															? "bg-indigo-50 border-indigo-200"
															: "bg-white border-gray-200 hover:bg-gray-50"
													}`}
												>
													<input
														type="checkbox"
														checked={sel}
														onChange={() => toggleProfesora(p.id)}
														className="w-4 h-4 accent-[#252d62]"
													/>
													<span
														className={`text-sm ${sel ? "font-semibold text-[#252d62]" : "text-gray-700"}`}
													>
														{nombreCompleto(p)}
														{!p.activo && (
															<span className="text-xs text-gray-400"> (inactiva)</span>
														)}
													</span>
												</label>
											);
										})}
									</div>
								)}
								<p className="text-xs text-gray-400">
									Es la misma asignación que se ve en Configuración → Gestionar
									profesores (y en el portal docente).
								</p>

								{form.profesoraIds.length > 0 && editando.diasDeClase.length > 0 && (
									<div className="space-y-2 pt-2">
										<div>
											<label className="text-sm font-semibold text-gray-700">
												Días que da cada una
											</label>
											<p className="text-xs text-gray-400">
												Un día puede tener más de una profesora. Si una clase la da
												alguien que no tiene ese día (aunque sea del curso), queda
												como reemplazo.
											</p>
										</div>
										<div className="bg-gray-50 border border-gray-100 rounded-xl divide-y divide-gray-100">
											{form.profesoraIds.map((id) => {
												const persona = profesoras.find((p) => p.id === id);
												const dias = form.diasPorProfesora[id] ?? [];
												return (
													<div
														key={id}
														className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
													>
														<p
															className={`text-sm font-semibold truncate ${dias.length === 0 ? "text-amber-700" : "text-gray-800"}`}
														>
															{persona ? nombreCompleto(persona) : "Profesora"}
														</p>
														<div className="flex flex-wrap gap-1.5">
															{editando.diasDeClase.map((d) => {
																const sel = dias.includes(d);
																const horario = horariosDelDia(editando, d);
																return (
																	<button
																		key={d}
																		type="button"
																		onClick={() => toggleDia(id, d)}
																		aria-pressed={sel}
																		title={horario || undefined}
																		className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
																			sel
																				? "bg-[#252d62] border-[#252d62] text-white"
																				: "bg-white border-gray-200 text-gray-500 hover:bg-gray-100"
																		}`}
																	>
																		{diaCorto(d)}
																	</button>
																);
															})}
														</div>
													</div>
												);
											})}
										</div>
										{diasSinTitular(borrador).length > 0 && (
											<p className="text-xs text-amber-700 flex items-start gap-1.5">
												<AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
												<span>
													Sin profesora:{" "}
													{diasSinTitular(borrador)
														.map((d) => `${diaCorto(d)} ${horariosDelDia(editando, d)}`.trim())
														.join(", ")}
													. Esas clases no tienen titular.
												</span>
											</p>
										)}
									</div>
								)}
								{sinProfesoras && (
									<p className="text-xs text-gray-500 flex items-center gap-1.5">
										<Lock className="w-3.5 h-3.5 shrink-0" /> Asigná al menos una
										profesora para cargar los precios del curso.
									</p>
								)}
							</div>
						)}

						{seccion === "precios" && !sinProfesoras && (
							<>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div className="space-y-2">
										<label className="text-sm font-semibold text-gray-700">
											Cantidad de alumnos
										</label>
										<p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
											{editando.alumnosInscriptos === null
												? "No se pudo contar los inscriptos"
												: `${editando.alumnosInscriptos} inscripto${editando.alumnosInscriptos === 1 ? "" : "s"}`}
										</p>
										<Interruptor
											activo={corregirAlumnos}
											onChange={(v) => {
												setCorregirAlumnos(v);
												if (v && form.cantidadAlumnosManual === null)
													setForm({
														...form,
														cantidadAlumnosManual: editando.alumnosInscriptos,
													});
											}}
											label="Corregir a mano"
										/>
										{corregirAlumnos && (
											<input
												type="number"
												inputMode="numeric"
												min={0}
												step={1}
												value={form.cantidadAlumnosManual ?? ""}
												onChange={(e) =>
													setForm({
														...form,
														cantidadAlumnosManual: leerNumero(e.target.value),
													})
												}
												placeholder="Ej.: 12"
												aria-label="Cantidad de alumnos corregida"
												className={inputClase}
												autoFocus
											/>
										)}
									</div>
									<Campo label="Monto fijo del curso" hint="Por alumno, por mes">
										<div className="relative">
											<span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
												$
											</span>
											<input
												type="number"
												inputMode="decimal"
												min={0}
												step="any"
												value={form.montoFijo ?? ""}
												onChange={(e) =>
													setForm({ ...form, montoFijo: leerNumero(e.target.value) })
												}
												placeholder="Ej.: 24500"
												className={`${inputClase} pl-8`}
											/>
										</div>
									</Campo>
								</div>

								<div className="space-y-2">
									<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
										<div>
											<label className="text-sm font-semibold text-gray-700">
												Porcentaje de cada profesora
											</label>
											<p className="text-xs text-gray-400">
												Pago mensual = monto fijo × alumnos × porcentaje
											</p>
										</div>
										{meses.length > 1 && (
											<select
												value={mes}
												onChange={(e) => setMesEstimado(e.target.value)}
												className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20"
												aria-label="Mes del estimado por clase"
											>
												{meses.map((m) => (
													<option key={m} value={m}>
														Estimado de {nombrePeriodo(m)}
													</option>
												))}
											</select>
										)}
									</div>

									<div className="bg-gray-50 border border-gray-100 rounded-xl divide-y divide-gray-100">
										{form.profesoraIds.map((id) => {
											const persona = profesoras.find((p) => p.id === id);
											const mensual = pagoMensual(borrador, id);
											const susClases = clasesDelMesDeProfesora(borrador, mes, id);
											const porClase = pagoPorClaseEstimado(mensual, susClases);
											return (
												<div
													key={id}
													className="p-3 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] sm:items-center gap-2 sm:gap-3"
												>
													<p className="text-sm font-semibold text-gray-800 truncate">
														{persona ? nombreCompleto(persona) : "Profesora"}
													</p>
													<div className="relative">
														<input
															type="number"
															inputMode="decimal"
															min={0}
															max={100}
															step="any"
															value={form.porcentajes[id] ?? ""}
															onChange={(e) => setPorcentaje(id, e.target.value)}
															placeholder="0"
															aria-label={`Porcentaje de ${persona ? nombreCompleto(persona) : "la profesora"}`}
															className={`${inputClase} pr-8 text-right`}
														/>
														<span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
															%
														</span>
													</div>
													<div className="sm:text-right">
														{mensual === null ? (
															<p className="text-xs text-gray-400">
																Completá alumnos, monto y porcentaje
															</p>
														) : (
															<>
																<p className="text-sm font-bold text-[#252d62]">
																	{formatPesos(mensual)}{" "}
																	<span className="text-xs font-normal text-gray-500">
																		por mes
																	</span>
																</p>
																<p className="text-xs text-gray-500">
																	{porClase === null
																		? "Sin clases ese mes"
																		: `≈ ${formatPesos(porClase)} por clase (${susClases} en el mes)`}
																</p>
															</>
														)}
													</div>
												</div>
											);
										})}
									</div>

									<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
										<span className="text-gray-500">
											{nombrePeriodo(mes)}: {clasesDelMes} clase
											{clasesDelMes === 1 ? "" : "s"} según los horarios
										</span>
										<span
											className={
												totalPorcentajes > 100
													? "font-semibold text-amber-600"
													: "text-gray-500"
											}
										>
											Total: {Math.round(totalPorcentajes * 100) / 100}%
											{totalPorcentajes > 100 && " · supera el 100%"}
										</span>
									</div>
									<p className="text-xs text-gray-400">
										El recibo de la profesora es el pago mensual: no depende de las
										clases que dio. El valor por clase (pago mensual ÷ sus clases del
										mes, según sus días) es el que se le descuenta si la reemplazan (y
										cobra la reemplazante).
									</p>
								</div>
							</>
						)}
					</>
				)}
			</ModalFormulario>
		</div>
	);
}
