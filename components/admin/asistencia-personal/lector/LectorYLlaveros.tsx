"use client";

/**
 * Lector y llaveros: historial de lo que registró el kiosco y llaveros.
 * Lo ve todo el panel; solo el director corrige movimientos y asigna llaveros.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
	AlertCircle,
	CheckCircle2,
	History,
	KeyRound,
	Loader2,
	Lock,
	Monitor,
} from "lucide-react";
import { mensajeDeError, type Notificar } from "../carga/ui";
import { usePermisosAsistencia } from "@/lib/asistencia/permisos";
import { repositorioFirestore } from "@/lib/asistencia/repositorio";
import { suscribirLlaveros } from "@/lib/asistencia/repositorioLector";
import type { Llavero, Persona } from "@/lib/asistencia/tipos";
import { useConfiguracion } from "@/lib/asistencia/useConfiguracion";
import TabHistorial from "./TabHistorial";
import TabComputadoras from "./TabComputadoras";
import TabLlaveros from "./TabLlaveros";

type Tab = "historial" | "llaveros" | "computadoras";

interface Toast {
	id: number;
	mensaje: string;
	tipo: "ok" | "error";
}

export default function LectorYLlaveros() {
	const { esDirector } = usePermisosAsistencia();
	const { fechaInicio } = useConfiguracion();
	const [tab, setTab] = useState<Tab>("historial");
	const [personal, setPersonal] = useState<Persona[] | null>(null);
	const [llaveros, setLlaveros] = useState<Llavero[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [toasts, setToasts] = useState<Toast[]>([]);
	const idToast = useRef(0);

	useEffect(() => {
		const onError = (e: Error) => setError(mensajeDeError(e));
		const u1 = repositorioFirestore.suscribirPersonal(setPersonal, onError);
		const u2 = suscribirLlaveros(setLlaveros, onError);
		return () => {
			u1();
			u2();
		};
	}, []);

	const notificar: Notificar = useCallback((mensaje, tipo = "ok") => {
		const id = ++idToast.current;
		setToasts((t) => [...t, { id, mensaje, tipo }]);
		setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
	}, []);

	const tabs: { id: Tab; label: string; icono: React.ComponentType<{ className?: string }> }[] = [
		{ id: "historial", label: "Historial de registros", icono: History },
		{ id: "llaveros", label: "Llaveros", icono: KeyRound },
		// Solo el director administra las computadoras vinculadas
		...(esDirector ? [{ id: "computadoras" as const, label: "Computadoras", icono: Monitor }] : []),
	];

	return (
		<div className="p-6 space-y-6 max-w-7xl mx-auto">
			<motion.div
				initial={{ opacity: 0, x: -20 }}
				animate={{ opacity: 1, x: 0 }}
				className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
			>
				<div className="flex items-center gap-3">
					<div className="bg-[#252d62] p-2.5 rounded-lg">
						<KeyRound className="w-5 h-5 text-white" />
					</div>
					<div>
						<h1 className="text-2xl font-bold text-[#252d62]">Lector y llaveros</h1>
						<p className="text-sm text-gray-500">
							Lo que registró la aplicación de escritorio y los llaveros del personal
						</p>
					</div>
				</div>
				{!esDirector && (
					<span className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
						<Lock className="w-3.5 h-3.5" /> Solo lectura · las correcciones las hace el director
					</span>
				)}
			</motion.div>

			<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-1.5 flex gap-1 overflow-x-auto">
				{tabs.map(({ id, label, icono: Icono }) => {
					const activa = tab === id;
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
									layoutId="tab-lector"
									className="absolute inset-0 bg-[#252d62] rounded-lg shadow-sm"
									transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
								/>
							)}
							<Icono className="relative w-4 h-4" />
							<span className="relative">{label}</span>
							{id === "llaveros" && llaveros && (
								<span
									className={`relative text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
										activa ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
									}`}
								>
									{llaveros.length}
								</span>
							)}
						</button>
					);
				})}
			</div>

			{error && (
				<div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
					<AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
					<p className="text-sm text-red-700">No se pudieron cargar los datos: {error}</p>
				</div>
			)}

			{tab === "computadoras" && esDirector ? (
				<TabComputadoras notificar={notificar} />
			) : !personal || !llaveros ? (
				!error && (
					<div className="flex items-center justify-center h-96">
						<Loader2 className="w-10 h-10 animate-spin text-[#252d62]" />
					</div>
				)
			) : tab === "historial" ? (
				<TabHistorial
					personal={personal}
					llaveros={llaveros}
					esDirector={esDirector}
					fechaInicio={fechaInicio}
					notificar={notificar}
				/>
			) : (
				<TabLlaveros
					personal={personal}
					llaveros={llaveros}
					esDirector={esDirector}
					notificar={notificar}
				/>
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
