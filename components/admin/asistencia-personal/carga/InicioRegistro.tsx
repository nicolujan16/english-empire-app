"use client";

/**
 * Fecha de inicio del registro de asistencia (solo director).
 * Antes de esta fecha no se esperan clases ni hay pendientes, y el calendario y los
 * recibos no muestran meses anteriores. No cambia lo que cobra cada persona.
 */
import React, { useState } from "react";
import { CalendarCheck, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fechaAR, fechaLarga } from "@/lib/asistencia/fechas";
import type { RepositorioCarga } from "@/lib/asistencia/repositorio";
import { mensajeDeError, type Notificar } from "./ui";

export default function InicioRegistro({
	fechaInicio,
	guardada,
	repo,
	notificar,
}: {
	fechaInicio: string;
	/** false = todavía no se eligió y se usa la fecha por defecto */
	guardada: boolean;
	repo: RepositorioCarga;
	notificar: Notificar;
}) {
	const [editando, setEditando] = useState(false);
	const [valor, setValor] = useState(fechaInicio);
	const [guardando, setGuardando] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const abrir = () => {
		setValor(fechaInicio);
		setError(null);
		setEditando(true);
	};

	const guardar = async () => {
		setGuardando(true);
		setError(null);
		try {
			await repo.guardarFechaInicio(valor);
			notificar(`El registro cuenta desde el ${fechaLarga(valor)}.`);
			setEditando(false);
		} catch (e) {
			setError(mensajeDeError(e));
		} finally {
			setGuardando(false);
		}
	};

	return (
		<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
			<div className="flex items-start gap-3 flex-1 min-w-0">
				<div className="w-9 h-9 rounded-lg bg-indigo-50 text-[#252d62] flex items-center justify-center shrink-0">
					<CalendarCheck className="w-4 h-4" />
				</div>
				<div className="min-w-0">
					<p className="text-sm font-semibold text-gray-800">
						El registro de asistencia cuenta desde el{" "}
						<span className="text-[#252d62]">{fechaLarga(fechaInicio)}</span>
						{!guardada && (
							<span className="ml-1.5 text-[10px] font-bold uppercase text-amber-600">
								Por defecto
							</span>
						)}
					</p>
					<p className="text-xs text-gray-500">
						Antes de esa fecha no se esperan clases ni aparecen pendientes, y el
						calendario y los recibos empiezan en ese mes. No cambia lo que cobra
						cada uno.
					</p>
					{error && <p className="text-xs text-red-600 mt-1">{error}</p>}
				</div>
			</div>

			{editando ? (
				<div className="flex items-center gap-2 shrink-0">
					<input
						type="date"
						value={valor}
						onChange={(e) => setValor(e.target.value)}
						max={`${Number(fechaAR(new Date()).slice(0, 4)) + 1}-12-31`}
						className="text-sm font-semibold text-[#252d62] border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#252d62]/20"
						aria-label="Fecha de inicio del registro"
						autoFocus
					/>
					<Button
						variant="outline"
						onClick={() => setEditando(false)}
						disabled={guardando}
						className="border-gray-300 text-gray-700 rounded-xl"
					>
						Cancelar
					</Button>
					<Button
						onClick={guardar}
						disabled={guardando || !valor || valor === fechaInicio}
						className="bg-[#252d62] hover:bg-[#1a2046] text-white font-bold rounded-xl"
					>
						{guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
					</Button>
				</div>
			) : (
				<Button
					variant="outline"
					onClick={abrir}
					className="border-gray-200 text-[#252d62] rounded-xl flex items-center gap-2 shrink-0"
				>
					<Pencil className="w-4 h-4" /> Cambiar fecha
				</Button>
			)}
		</div>
	);
}
