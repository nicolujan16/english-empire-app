"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
	BookOpen,
	Briefcase,
	GraduationCap,
	KeyRound,
	Pencil,
	Search,
	UserPlus,
	Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { iniciales } from "@/lib/asistencia/fechas";
import { dniConPuntos } from "@/lib/asistencia/reciboImpreso";
import type { CuentaSecretaria, RepositorioCarga } from "@/lib/asistencia/repositorio";
import {
	nombreCompleto,
	type Curso,
	type Persona,
	type PersonaInput,
	type Rol,
} from "@/lib/asistencia/tipos";
import {
	Campo,
	Interruptor,
	ModalFormulario,
	Segmentado,
	Vacio,
	inputClase,
	inputFiltroClase,
	mensajeDeError,
	type Notificar,
} from "./ui";
import ModalCursosProfesora from "./ModalCursosProfesora";

const VACIO: PersonaInput = {
	nombre: "",
	apellido: "",
	email: "",
	dni: null,
	rol: "secretaria",
	activo: true,
	telefono: "",
	titulo: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Vacío, o 7 u 8 dígitos (se aceptan puntos al escribirlo) */
const DNI_RE = /^(\d{7,8})?$/;

export default function TabPersonal({
	personal,
	cursos,
	repo,
	notificar,
}: {
	personal: Persona[];
	cursos: Curso[];
	repo: RepositorioCarga;
	notificar: Notificar;
}) {
	const [busqueda, setBusqueda] = useState("");
	const [filtroRol, setFiltroRol] = useState<"todos" | Rol>("todos");
	const [verInactivos, setVerInactivos] = useState(false);

	const [modalAbierto, setModalAbierto] = useState(false);
	const [editando, setEditando] = useState<Persona | null>(null);
	const editandoId = editando?.id ?? null;
	const [form, setForm] = useState<PersonaInput>(VACIO);
	const [error, setError] = useState<string | null>(null);
	const [guardando, setGuardando] = useState(false);
	const [cambiandoId, setCambiandoId] = useState<string | null>(null);
	// Modal de cursos: se guarda el id y se busca en `personal`, que llega en vivo,
	// así el modal muestra los cambios apenas se guardan
	const [cursosDeId, setCursosDeId] = useState<string | null>(null);
	const esDocente = (p: Persona) => p.rol === "profesora" || p.tambienProfesora === true;
	const profesoraCursos = cursosDeId
		? (personal.find((p) => p.id === cursosDeId && esDocente(p)) ?? null)
		: null;
	// Secretaria que también va a ser profesora (confirmación)
	const [sumarProfesora, setSumarProfesora] = useState<Persona | null>(null);
	const [sumando, setSumando] = useState(false);
	const [errorSumar, setErrorSumar] = useState<string | null>(null);
	const confirmarSumarProfesora = async () => {
		if (!sumarProfesora) return;
		setSumando(true);
		setErrorSumar(null);
		try {
			await repo.hacerTambienProfesora(sumarProfesora);
			notificar(
				`${sumarProfesora.nombre} ya es también profesora: asignale sus cursos y entra al portal docente con su misma cuenta.`,
			);
			setCursosDeId(sumarProfesora.id);
			setSumarProfesora(null);
		} catch (e) {
			setErrorSumar(mensajeDeError(e));
		} finally {
			setSumando(false);
		}
	};

	// Cuentas del panel con rol secretario que todavía no están en el registro
	const [cuentas, setCuentas] = useState<CuentaSecretaria[] | null>(null);
	const [filasTraer, setFilasTraer] = useState<CuentaSecretaria[] | null>(null);
	const [errorTraer, setErrorTraer] = useState<string | null>(null);
	const [trayendo, setTrayendo] = useState(false);
	useEffect(() => {
		let vigente = true;
		repo
			.cuentasDeSecretarias()
			.then((c) => vigente && setCuentas(c))
			.catch(() => vigente && setCuentas(null));
		return () => {
			vigente = false;
		};
	}, [repo]);
	const sinTraer = useMemo(() => {
		const ids = new Set(personal.map((p) => p.id));
		return (cuentas ?? []).filter((c) => !ids.has(c.uid));
	}, [cuentas, personal]);
	const filasValidas =
		!!filasTraer && filasTraer.every((f) => f.nombre.trim() !== "" && f.apellido.trim() !== "");

	const abrirTraer = () => {
		setFilasTraer(sinTraer.map((c) => ({ ...c })));
		setErrorTraer(null);
	};
	const editarFila = (uid: string, campo: "nombre" | "apellido", valor: string) =>
		setFilasTraer((fs) => fs?.map((f) => (f.uid === uid ? { ...f, [campo]: valor } : f)) ?? null);
	const traer = async () => {
		if (!filasTraer) return;
		setTrayendo(true);
		setErrorTraer(null);
		try {
			const n = await repo.traerSecretariasDelPanel(filasTraer);
			notificar(
				n === 1
					? "Se agregó 1 secretaria al personal."
					: `Se agregaron ${n} secretarias al personal.`,
			);
			setFilasTraer(null);
		} catch (e) {
			setErrorTraer(mensajeDeError(e));
		} finally {
			setTrayendo(false);
		}
	};

	const cursosPorProfe = useMemo(() => {
		const m = new Map<string, Curso[]>();
		cursos.forEach((c) =>
			c.profesoraIds.forEach((id) => m.set(id, [...(m.get(id) ?? []), c])),
		);
		return m;
	}, [cursos]);

	const filtrados = useMemo(() => {
		const q = busqueda.trim().toLowerCase();
		return personal.filter(
			(p) =>
				(verInactivos || p.activo) &&
				(filtroRol === "todos" ||
					p.rol === filtroRol ||
					(filtroRol === "profesora" && p.tambienProfesora === true)) &&
				(!q ||
					nombreCompleto(p).toLowerCase().includes(q) ||
					p.email.toLowerCase().includes(q) ||
					(!!p.dni && p.dni.includes(q.replace(/\D/g, "") || "-"))),
		);
	}, [personal, busqueda, filtroRol, verInactivos]);

	const abrirNueva = () => {
		setEditando(null);
		setForm(VACIO);
		setError(null);
		setModalAbierto(true);
	};

	const abrirEdicion = (p: Persona) => {
		setEditando(p);
		setForm({
			nombre: p.nombre,
			apellido: p.apellido,
			email: p.email,
			dni: p.dni,
			rol: p.rol,
			activo: p.activo,
			telefono: p.telefono ?? "",
			titulo: p.titulo ?? "",
		});
		setError(null);
		setModalAbierto(true);
	};

	const dniInvalido = !DNI_RE.test((form.dni ?? "").replace(/\D/g, ""));
	const valido =
		form.nombre.trim() !== "" &&
		form.apellido.trim() !== "" &&
		EMAIL_RE.test(form.email.trim()) &&
		DNI_RE.test((form.dni ?? "").replace(/\D/g, ""));

	// El rol no se cambia después del alta: secretarias y profesoras viven en colecciones distintas
	const rolBloqueado = editando !== null;
	// El email es el de su cuenta (portal docente o panel): no se cambia después del alta
	const emailBloqueado = editando !== null;

	const guardar = async () => {
		setGuardando(true);
		setError(null);
		try {
			await repo.guardarPersona(form, editando ?? undefined);
			notificar(
				editandoId
					? "Datos actualizados."
					: form.rol === "profesora"
						? `Se creó la cuenta de ${form.nombre.trim()}: le llegó un mail para elegir su contraseña.`
						: `Se creó la cuenta del panel de ${form.nombre.trim()}: le llegó un mail para elegir su contraseña.`,
			);
			setModalAbierto(false);
		} catch (e) {
			setError(mensajeDeError(e));
		} finally {
			setGuardando(false);
		}
	};

	const toggleActivo = async (p: Persona) => {
		setCambiandoId(p.id);
		try {
			await repo.cambiarActivoPersona(p, !p.activo);
			const nCursos = cursosPorProfe.get(p.id)?.length ?? 0;
			notificar(
				p.activo && nCursos > 0
					? `${p.nombre} quedó inactiva, pero sigue asignada a ${nCursos} curso(s).`
					: `${p.nombre} quedó ${p.activo ? "inactiva" : "activa"}.`,
			);
		} catch (e) {
			notificar(mensajeDeError(e), "error");
		} finally {
			setCambiandoId(null);
		}
	};

	return (
		<div className="space-y-4">
			{/* Barra de filtros */}
			<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
					<input
						value={busqueda}
						onChange={(e) => setBusqueda(e.target.value)}
						placeholder="Buscar por nombre o email..."
						className={`${inputFiltroClase} w-full pl-9`}
					/>
				</div>
				<Segmentado
					opciones={
						[
							["todos", "Todos"],
							["secretaria", "Secretarias"],
							["profesora", "Profesoras"],
						] as const
					}
					valor={filtroRol}
					onChange={setFiltroRol}
				/>
				<label className="flex items-center gap-2 text-sm text-gray-600 select-none">
					<input
						type="checkbox"
						checked={verInactivos}
						onChange={(e) => setVerInactivos(e.target.checked)}
						className="w-4 h-4 accent-[#252d62]"
					/>
					Mostrar inactivas
				</label>
				<Button
					onClick={abrirNueva}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold py-5 px-5 rounded-xl flex items-center gap-2 shadow-md"
				>
					<UserPlus className="w-5 h-5" /> Agregar persona
				</Button>
			</div>

			{/* Uso único: las secretarias que ya tienen cuenta en el panel (Admins) */}
			{sinTraer.length > 0 && (
				<div className="p-4 bg-white border border-dashed border-gray-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<p className="text-sm text-gray-600">
						{sinTraer.length === 1
							? "Hay 1 secretaria con cuenta en el panel que todavía no está en el registro: "
							: `Hay ${sinTraer.length} secretarias con cuenta en el panel que todavía no están en el registro: `}
						<strong>{sinTraer.map((c) => `${c.nombre} ${c.apellido}`.trim()).join(", ")}</strong>.
					</p>
					<Button
						onClick={abrirTraer}
						className="bg-[#252d62] hover:bg-[#1a2046] text-white font-bold rounded-xl flex items-center gap-2 shrink-0"
					>
						<Users className="w-4 h-4" /> Traer secretarias del panel
					</Button>
				</div>
			)}

			{/* Tabla */}
			<div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
				<div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
					<p className="text-sm text-gray-500">
						{filtrados.length} persona{filtrados.length === 1 ? "" : "s"}
					</p>
					<p className="text-sm font-bold text-[#252d62]">
						{personal.filter((p) => p.activo && p.rol === "secretaria").length}{" "}
						secretarias ·{" "}
						{personal.filter((p) => p.activo && esDocente(p)).length}{" "}
						profesoras activas
					</p>
				</div>

				{filtrados.length === 0 ? (
					<Vacio
						icono={Users}
						titulo={
							personal.length === 0
								? "Todavía no cargaste a nadie"
								: "No hay resultados"
						}
						texto={
							personal.length === 0
								? "Empezá agregando a las secretarias y profesoras del instituto."
								: "Probá con otro nombre o filtro."
						}
					/>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="bg-white">
								<tr className="border-b border-gray-100">
									{["Nombre", "Rol", "Llavero", "Cursos", "Estado", ""].map(
										(h, i) => (
											<th
												key={i}
												className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${i === 5 ? "text-right" : "text-left"}`}
											>
												{h}
											</th>
										),
									)}
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{filtrados.map((p, idx) => {
									const susCursos = cursosPorProfe.get(p.id) ?? [];
									return (
										<motion.tr
											key={p.id}
											initial={{ opacity: 0, y: 10 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: Math.min(idx, 10) * 0.03 }}
											className={`hover:bg-gray-50 transition-colors ${p.activo ? "" : "opacity-60"}`}
										>
											<td className="px-6 py-4">
												<div className="flex items-center gap-3">
													<div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs shrink-0">
														{iniciales(nombreCompleto(p))}
													</div>
													<div className="min-w-0">
														<p className="font-medium text-gray-900 whitespace-nowrap">
															{nombreCompleto(p)}
														</p>
														<p className="text-xs text-gray-400 truncate">
															{p.email}
														</p>
														<p className="text-[10px] text-gray-400 font-mono">
															{p.dni ? `DNI ${dniConPuntos(p.dni)}` : "Sin DNI"}
														</p>
													</div>
												</div>
											</td>
											<td className="px-6 py-4">
												{p.rol === "secretaria" ? (
													<div className="flex flex-wrap gap-1">
														<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-[#252d62]">
															<Briefcase className="w-3 h-3" /> Secretaria
														</span>
														{p.tambienProfesora && (
															<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
																<GraduationCap className="w-3 h-3" /> Profesora
															</span>
														)}
													</div>
												) : (
													<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
														<GraduationCap className="w-3 h-3" /> Profesora
													</span>
												)}
											</td>
											<td className="px-6 py-4">
												{p.llaveroUid ? (
													<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">
														<KeyRound className="w-3 h-3" /> Asignado
													</span>
												) : (
													<span className="text-xs text-gray-400 italic">
														Sin llavero
													</span>
												)}
											</td>
											<td className="px-6 py-4 text-gray-600">
												{esDocente(p) ? (
													<button
														type="button"
														onClick={() => setCursosDeId(p.id)}
														title={
															susCursos.length > 0
																? `${susCursos.map((c) => c.nombre).join(", ")} · Gestionar cursos`
																: "Asignar cursos"
														}
														className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
															susCursos.length > 0
																? "text-[#252d62] hover:bg-indigo-50"
																: "text-amber-700 bg-amber-50 hover:bg-amber-100"
														}`}
													>
														<BookOpen className="w-3.5 h-3.5 shrink-0" />
														<span className="max-w-[180px] truncate">
															{susCursos.length === 0
																? "Asignar cursos"
																: susCursos.length === 1
																	? susCursos[0].nombre
																	: `${susCursos.length} cursos`}
														</span>
													</button>
												) : (
													<span className="text-xs text-gray-300">—</span>
												)}
											</td>
											<td className="px-6 py-4">
												<button
													onClick={() => toggleActivo(p)}
													disabled={cambiandoId === p.id}
													title={p.activo ? "Desactivar" : "Activar"}
													className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
														p.activo
															? "bg-green-50 text-green-700 hover:bg-green-100"
															: "bg-gray-100 text-gray-500 hover:bg-gray-200"
													}`}
												>
													<span
														className={`w-1.5 h-1.5 rounded-full ${p.activo ? "bg-green-500" : "bg-gray-400"}`}
													/>
													{p.activo ? "Activa" : "Inactiva"}
												</button>
											</td>
											<td className="px-6 py-4 text-right whitespace-nowrap">
												{p.rol === "secretaria" && !p.tambienProfesora && p.activo && (
													<button
														onClick={() => {
															setErrorSumar(null);
															setSumarProfesora(p);
														}}
														className="p-2 rounded-lg text-gray-400 hover:text-purple-700 hover:bg-purple-50 transition-colors"
														aria-label={`Sumar a ${nombreCompleto(p)} como profesora`}
														title="También es profesora"
													>
														<GraduationCap className="w-4 h-4" />
													</button>
												)}
												{esDocente(p) && (
													<button
														onClick={() => setCursosDeId(p.id)}
														className="p-2 rounded-lg text-gray-400 hover:text-[#252d62] hover:bg-indigo-50 transition-colors"
														aria-label={`Cursos de ${nombreCompleto(p)}`}
														title="Gestionar cursos"
													>
														<BookOpen className="w-4 h-4" />
													</button>
												)}
												<button
													onClick={() => abrirEdicion(p)}
													className="p-2 rounded-lg text-gray-400 hover:text-[#252d62] hover:bg-indigo-50 transition-colors"
													aria-label={`Editar a ${nombreCompleto(p)}`}
												>
													<Pencil className="w-4 h-4" />
												</button>
											</td>
										</motion.tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Modal de cursos de una profesora */}
			<ModalCursosProfesora
				profesora={profesoraCursos}
				cursos={cursos}
				repo={repo}
				notificar={notificar}
				onCerrar={() => setCursosDeId(null)}
			/>

			{/* Modal: una secretaria que también es profesora */}
			<ModalFormulario
				abierto={sumarProfesora !== null}
				onCerrar={() => setSumarProfesora(null)}
				titulo="También es profesora"
				subtitulo={sumarProfesora ? nombreCompleto(sumarProfesora) : ""}
				icono={GraduationCap}
				error={errorSumar}
				guardando={sumando}
				onGuardar={confirmarSumarProfesora}
				textoGuardar="Sumar como profesora"
			>
				<ul className="text-sm text-gray-600 space-y-2 list-disc pl-5">
					<li>
						Entra al <strong>portal docente</strong> con su misma cuenta (mismo email y
						contraseña). No se crea otra cuenta.
					</li>
					<li>
						Le asignás sus cursos y días como a cualquier profesora, y cobra su pago mensual.
					</li>
					<li>
						Sigue fichando su turno con <strong>su mismo llavero</strong>. Su clase cuenta como
						dada si estaba en su turno a esa hora, y ese tiempo no se le paga como horas de
						secretaria. Si no la dio, la corregís desde el calendario.
					</li>
					<li>Tiene un solo recibo por mes, con todo junto, y lo ve en los dos paneles.</li>
				</ul>
			</ModalFormulario>

			{/* Modal: traer las secretarias del panel */}
			<ModalFormulario
				abierto={filasTraer !== null}
				onCerrar={() => setFilasTraer(null)}
				titulo="Traer secretarias del panel"
				subtitulo="Revisá cómo quedan el nombre y el apellido: así van impresos en el recibo"
				icono={Users}
				error={errorTraer}
				guardando={trayendo}
				puedeGuardar={filasValidas}
				onGuardar={traer}
				textoGuardar={
					filasTraer && filasTraer.length === 1
						? "Traer 1 secretaria"
						: `Traer ${filasTraer?.length ?? 0} secretarias`
				}
				ancho="sm:max-w-2xl"
			>
				<p className="text-sm text-gray-600">
					En el panel el nombre está guardado junto, y se separó tomando la última palabra como
					apellido. Corregilo si hace falta. El DNI lo cargás después, editando a cada una.
				</p>
				<div className="space-y-3">
					{filasTraer?.map((f) => (
						<div key={f.uid} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
							<p className="text-xs text-gray-500 truncate">
								{f.email}
								{!f.activo && " · inactiva en el panel"}
							</p>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<Campo label="Nombre">
									<input
										value={f.nombre}
										onChange={(e) => editarFila(f.uid, "nombre", e.target.value)}
										className={inputClase}
									/>
								</Campo>
								<Campo label="Apellido">
									<input
										value={f.apellido}
										onChange={(e) => editarFila(f.uid, "apellido", e.target.value)}
										className={`${inputClase} ${f.apellido.trim() ? "" : "border-red-300 focus:ring-red-200"}`}
									/>
								</Campo>
							</div>
						</div>
					))}
				</div>
			</ModalFormulario>

			{/* Modal alta / edición */}
			<ModalFormulario
				abierto={modalAbierto}
				onCerrar={() => setModalAbierto(false)}
				titulo={editandoId ? "Editar persona" : "Agregar persona"}
				subtitulo={
					editandoId
						? editando?.rol === "profesora"
							? "Son los mismos datos de su cuenta del portal docente"
							: editando?.tambienProfesora
								? "También se actualizan en su cuenta del portal docente"
								: "Los registros ya cargados conservan el nombre anterior"
						: "Se le crea la cuenta y después le vas a poder asignar un llavero"
				}
				icono={UserPlus}
				error={error}
				guardando={guardando}
				puedeGuardar={valido}
				onGuardar={guardar}
				textoGuardar={editandoId ? "Guardar cambios" : "Agregar"}
			>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<Campo label="Nombre">
						<input
							value={form.nombre}
							onChange={(e) => setForm({ ...form, nombre: e.target.value })}
							className={inputClase}
							autoFocus
						/>
					</Campo>
					<Campo label="Apellido">
						<input
							value={form.apellido}
							onChange={(e) => setForm({ ...form, apellido: e.target.value })}
							className={inputClase}
						/>
					</Campo>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div className="space-y-1.5">
						<label htmlFor="dni" className="text-sm font-semibold text-gray-700">
							DNI
						</label>
						<input
							id="dni"
							inputMode="numeric"
							value={form.dni ?? ""}
							onChange={(e) => setForm({ ...form, dni: e.target.value })}
							placeholder="Ej.: 43552355"
							aria-invalid={dniInvalido}
							className={`${inputClase} ${dniInvalido ? "border-red-300 focus:ring-red-200" : ""}`}
						/>
						{dniInvalido ? (
							<p className="text-xs text-red-600">
								Tiene que tener 7 u 8 números (los puntos no importan).
							</p>
						) : (
							<p className="text-xs text-gray-400">
								Va impreso en el recibo, debajo del nombre.
							</p>
						)}
					</div>
					<Campo
						label="Email"
						hint={
							emailBloqueado
								? editando?.rol === "profesora"
									? "Es el de su cuenta del portal docente: no se cambia desde acá."
									: "Es el de su cuenta del panel: no se cambia desde acá."
								: form.rol === "secretaria"
									? "Con este email se crea su cuenta del panel, donde ve sus recibos."
									: "Con este email se crea su cuenta del portal docente, donde ve sus recibos."
						}
					>
						<input
							type="email"
							value={form.email}
							onChange={(e) => setForm({ ...form, email: e.target.value })}
							disabled={emailBloqueado}
							className={`${inputClase} disabled:opacity-60 disabled:cursor-not-allowed`}
						/>
					</Campo>
				</div>
				<Campo
					label="Rol"
					hint={
						rolBloqueado
							? "El rol no se puede cambiar después del alta."
							: form.rol === "secretaria"
								? "Cobra por horas trabajadas. Se le crea la cuenta del panel (rol secretario) y le llega un mail para elegir su contraseña."
								: "Cobra un pago mensual por cada curso. Se le crea la cuenta del portal docente y le llega un mail para elegir su contraseña."
					}
				>
					<div>
						<Segmentado
							opciones={
								[
									["secretaria", "Secretaria"],
									["profesora", "Profesora"],
								] as const
							}
							valor={form.rol}
							onChange={(rol) => setForm({ ...form, rol })}
							disabled={rolBloqueado}
						/>
					</div>
				</Campo>
				{form.rol === "profesora" && (
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<Campo label="Teléfono" hint="Opcional">
							<input
								type="tel"
								value={form.telefono ?? ""}
								onChange={(e) => setForm({ ...form, telefono: e.target.value })}
								className={inputClase}
							/>
						</Campo>
						<Campo label="Título" hint="Opcional">
							<input
								value={form.titulo ?? ""}
								onChange={(e) => setForm({ ...form, titulo: e.target.value })}
								placeholder="Ej.: Profesora de Inglés"
								className={inputClase}
							/>
						</Campo>
					</div>
				)}
				{editandoId && (
					<Interruptor
						activo={form.activo}
						onChange={(activo) => setForm({ ...form, activo })}
						label={form.activo ? "Activa" : "Inactiva (no puede fichar)"}
					/>
				)}
			</ModalFormulario>
		</div>
	);
}
