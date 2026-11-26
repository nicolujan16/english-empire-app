"use client";

/**
 * CargaDatos
 * ─────────────────────────────────────────────────────────────────────────────
 * Pantalla donde se cargan y corrigen los datos del registro de asistencia:
 *  1. Carga de personal           (secretarias en Personal, profesoras en Teachers)   · director
 *  2. Precio/hora - Secretarias   (PersonalLiquidacion)                                · director
 *  3. Liquidación de cursos       (titulares + CursosLiquidacion)                      · director
 *  4. Carga de asistencia manual  (Jornadas y ClasesDictadas: carga manual,
 *                                  salidas olvidadas, correcciones y anulaciones)
 *  5. Feriados / Fechas especiales (DiasEspeciales + feriados predeterminados)
 *
 * Las secretarias solo ven las tabs 4 y 5 (ver lib/asistencia/permisos.ts).
 * Se puede abrir en una tab con `?tab=precios` (ids de TABS).
 *
 * Por defecto usa `repositorioFirestore`. Se le puede pasar otro `repo`
 * (por ejemplo, uno en memoria para probar sin Firebase).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
	AlertCircle,
	CalendarClock,
	CalendarOff,
	CheckCircle2,
	ClipboardList,
	Database,
	DollarSign,
	Loader2,
	Users,
} from "lucide-react";
import {
	repositorioFirestore,
	type RepositorioCarga,
} from "@/lib/asistencia/repositorio";
import type { Curso, Persona } from "@/lib/asistencia/tipos";
import { usePermisosAsistencia, type TabCarga } from "@/lib/asistencia/permisos";
import { useConfiguracion } from "@/lib/asistencia/useConfiguracion";
import InicioRegistro from "./InicioRegistro";
import TabPersonal from "./TabPersonal";
import TabCursos from "./TabCursos";
import TabRegistros from "./TabRegistros";
import TabFeriados from "./TabFeriados";
import TabPreciosHora from "./TabPreciosHora";
import { mensajeDeError, type Notificar } from "./ui";

type Tab = TabCarga;

const TODAS_LAS_TABS: {
	id: Tab;
	label: string;
	icono: React.ComponentType<{ className?: string }>;
}[] = [
	{ id: "personal", label: "Carga de personal", icono: Users },
	{ id: "precios", label: "Precio/hora - Secretarias", icono: DollarSign },
	{ id: "cursos", label: "Liquidación de cursos", icono: CalendarClock },
	{ id: "registros", label: "Carga de asistencia manual", icono: ClipboardList },
	{ id: "feriados", label: "Feriados / Fechas especiales", icono: CalendarOff },
];

interface Toast {
	id: number;
	mensaje: string;
	tipo: "ok" | "error";
}

export default function CargaDatos({
	repo = repositorioFirestore,
	tabInicial,
}: {
	repo?: RepositorioCarga;
	tabInicial?: Tab;
}) {
	const searchParams = useSearchParams();
	const { esDirector, tabsCarga } = usePermisosAsistencia();
	const config = useConfiguracion();
	const TABS = TODAS_LAS_TABS.filter((t) => tabsCarga.includes(t.id));
	const [tabElegida, setTab] = useState<Tab | null>(() => {
		const deUrl = TABS.find((t) => t.id === searchParams.get("tab"))?.id;
		return tabInicial ?? deUrl ?? null;
	});
	// Si la tab no está permitida (ej.: link a ?tab=precios de una secretaria), la primera
	const tab: Tab =
		tabElegida && tabsCarga.includes(tabElegida) ? tabElegida : tabsCarga[0];
	const [personal, setPersonal] = useState<Persona[] | null>(null);
	const [cursos, setCursos] = useState<Curso[] | null>(null);
	const [errorCarga, setErrorCarga] = useState<string | null>(null);
	const [toasts, setToasts] = useState<Toast[]>([]);
	const idToast = useRef(0);

	useEffect(() => {
		const onError = (e: Error) => setErrorCarga(mensajeDeError(e));
		const opciones = { conLiquidacion: esDirector };
		const u1 = repo.suscribirPersonal(setPersonal, onError, opciones);
		const u2 = repo.suscribirCursos(setCursos, onError, opciones);
		return () => {
			u1();
			u2();
		};
	}, [repo, esDirector]);

	const notificar: Notificar = useCallback((mensaje, tipo = "ok") => {
		const id = ++idToast.current;
		setToasts((t) => [...t, { id, mensaje, tipo }]);
		setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
	}, []);

	const cargando = personal === null || cursos === null;

	const contador = (t: Tab) =>
		t === "personal"
			? personal?.filter((p) => p.activo).length
			: t === "cursos"
				? cursos?.filter((c) => c.activo).length
				: undefined;

	return (
		<div className="p-6 space-y-6 max-w-7xl mx-auto">
			{/* Encabezado */}
			<motion.div
				initial={{ opacity: 0, x: -20 }}
				animate={{ opacity: 1, x: 0 }}
				className="flex items-center gap-3"
			>
				<div className="bg-[#252d62] p-2.5 rounded-lg">
					<Database className="w-5 h-5 text-white" />
				</div>
				<div>
					<h1 className="text-2xl font-bold text-[#252d62]">Carga de datos</h1>
					<p className="text-sm text-gray-500">
						{esDirector
							? "Personal, precios por hora, cursos, asistencia manual y feriados"
							: "Asistencia manual y feriados"}
					</p>
				</div>
			</motion.div>

			{/* Desde cuándo cuenta el registro (solo director) */}
			{esDirector && !config.cargando && (
				<InicioRegistro
					fechaInicio={config.fechaInicio}
					guardada={config.guardada}
					repo={repo}
					notificar={notificar}
				/>
			)}

			{/* Tabs */}
			<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 flex gap-1 overflow-x-auto">
				{TABS.map(({ id, label, icono: Icono }) => {
					const activa = tab === id;
					const n = contador(id);
					return (
						<button
							key={id}
							onClick={() => setTab(id)}
							className={`relative flex-1 min-w-max flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors ${
								activa
									? "text-white font-semibold"
									: "text-gray-500 hover:text-[#252d62] hover:bg-gray-50"
							}`}
						>
							{activa && (
								<motion.span
									layoutId="tab-activa"
									className="absolute inset-0 bg-[#252d62] rounded-lg shadow-sm"
									transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
								/>
							)}
							<Icono className="relative w-4 h-4" />
							<span className="relative">{label}</span>
							{n !== undefined && (
								<span
									className={`relative text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
										activa ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
									}`}
								>
									{n}
								</span>
							)}
						</button>
					);
				})}
			</div>

			{errorCarga && (
				<div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
					<AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
					<div>
						<p className="text-sm font-bold text-red-800">
							No se pudieron cargar los datos
						</p>
						<p className="text-xs text-red-700">
							{errorCarga}. Revisá la conexión y que tu usuario tenga permisos
							en el panel.
						</p>
					</div>
				</div>
			)}

			{/* Contenido */}
			{cargando && !errorCarga ? (
				<div className="flex items-center justify-center h-96">
					<Loader2 className="w-10 h-10 animate-spin text-[#252d62]" />
				</div>
			) : (
				personal &&
				cursos && (
					<AnimatePresence mode="wait">
						<motion.div
							key={tab}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -10 }}
							transition={{ duration: 0.15 }}
						>
							{tab === "personal" && (
								<TabPersonal
									personal={personal}
									cursos={cursos}
									repo={repo}
									notificar={notificar}
								/>
							)}
							{tab === "precios" && (
								<TabPreciosHora
									personal={personal}
									repo={repo}
									notificar={notificar}
								/>
							)}
							{tab === "cursos" && (
								<TabCursos
									cursos={cursos}
									personal={personal}
									repo={repo}
									notificar={notificar}
								/>
							)}
							{tab === "feriados" && (
								<TabFeriados repo={repo} notificar={notificar} />
							)}
							{tab === "registros" && (
								<TabRegistros
									personal={personal}
									cursos={cursos}
									repo={repo}
									notificar={notificar}
									fechaInicio={config.fechaInicio}
								/>
							)}
						</motion.div>
					</AnimatePresence>
				)
			)}

			{/* Toasts */}
			<div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-[calc(100vw-2rem)]">
				<AnimatePresence>
					{toasts.map((t) => (
						<motion.div
							key={t.id}
							initial={{ opacity: 0, y: 10, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 10, scale: 0.95 }}
							transition={{ duration: 0.15 }}
							className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium border ${
								t.tipo === "ok"
									? "bg-white text-gray-800 border-gray-100"
									: "bg-red-50 text-red-700 border-red-200"
							}`}
						>
							{t.tipo === "ok" ? (
								<CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
							) : (
								<AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
							)}
							{t.mensaje}
						</motion.div>
					))}
				</AnimatePresence>
			</div>
		</div>
	);
}
