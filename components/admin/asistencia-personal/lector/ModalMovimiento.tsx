"use client";

/**
 * Corrección de un movimiento de secretaria (solo director):
 * - agregar: una entrada o una salida que el kiosco no registró
 * - corregir: la hora de una entrada o de una salida
 * - anular: una entrada (anula la jornada) o una salida (queda sin salida)
 * Siempre con motivo, que queda en el historial de la jornada.
 */
import React, { useState } from "react";
import { AlertTriangle, Ban, LogIn, LogOut, Pencil, Plus } from "lucide-react";
import { fechaAR, fechaLarga, horaAR } from "@/lib/asistencia/fechas";
import {
	agregarMovimiento,
	anularMovimiento,
	corregirMovimiento,
	type TipoMovimiento,
} from "@/lib/asistencia/repositorioLector";
import { nombreCompleto, type Jornada, type Persona } from "@/lib/asistencia/tipos";
import {
	Campo,
	CampoMotivo,
	Historial,
	ModalFormulario,
	Segmentado,
	inputClase,
	mensajeDeError,
	type Notificar,
} from "../carga/ui";

export type ModoMovimiento =
	| { accion: "agregar" }
	| { accion: "corregir" | "anular"; jornada: Jornada; tipo: TipoMovimiento };

const ahoraHHMM = () => horaAR(new Date());

export default function ModalMovimiento({
	modo,
	secretarias,
	fechaInicio,
	notificar,
	onCerrar,
}: {
	modo: ModoMovimiento;
	secretarias: Persona[];
	fechaInicio: string;
	notificar: Notificar;
	onCerrar: () => void;
}) {
	const hoy = fechaAR(new Date());
	const [personaId, setPersonaId] = useState("");
	const [tipo, setTipo] = useState<TipoMovimiento>(modo.accion === "agregar" ? "entrada" : modo.tipo);
	const [fecha, setFecha] = useState(hoy);
	const [hora, setHora] = useState(() => {
		if (modo.accion === "agregar") return ahoraHHMM();
		const actual = modo.tipo === "entrada" ? modo.jornada.entrada : modo.jornada.salida;
		return actual ? horaAR(actual) : ahoraHHMM();
	});
	const [motivo, setMotivo] = useState("");
	const [guardando, setGuardando] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const agregar = modo.accion === "agregar";
	const anular = modo.accion === "anular";
	const jornada = agregar ? null : modo.jornada;
	const nombreTipo = tipo === "entrada" ? "entrada" : "salida";

	const puedeGuardar =
		!!motivo.trim() && (anular || /^\d{2}:\d{2}$/.test(hora)) && (!agregar || !!personaId);

	const guardar = async () => {
		setGuardando(true);
		setError(null);
		try {
			if (agregar) {
				const persona = secretarias.find((p) => p.id === personaId);
				if (!persona) throw new Error("Elegí a la secretaria.");
				await agregarMovimiento({ persona, tipo, fecha, hora, motivo: motivo.trim() });
				notificar(`Se agregó la ${nombreTipo} de ${persona.nombre} (${hora}).`);
			} else if (anular) {
				await anularMovimiento(modo.jornada, modo.tipo, motivo.trim());
				notificar(`Se anuló la ${nombreTipo} de ${modo.jornada.personalNombre}.`);
			} else {
				await corregirMovimiento(modo.jornada, modo.tipo, hora, motivo.trim());
				notificar(`Se corrigió la ${nombreTipo} de ${modo.jornada.personalNombre}.`);
			}
			onCerrar();
		} catch (e) {
			setError(mensajeDeError(e));
		} finally {
			setGuardando(false);
		}
	};

	return (
		<ModalFormulario
			abierto
			onCerrar={onCerrar}
			titulo={
				agregar
					? "Agregar entrada o salida"
					: anular
						? `Anular ${nombreTipo}`
						: `Corregir ${nombreTipo}`
			}
			subtitulo={
				jornada
					? `${jornada.personalNombre} · ${fechaLarga(jornada.fecha)}`
					: "Para un movimiento que el lector no registró"
			}
			icono={agregar ? Plus : anular ? Ban : Pencil}
			error={error}
			guardando={guardando}
			onGuardar={guardar}
			puedeGuardar={puedeGuardar}
			variante={anular ? "rojo" : "navy"}
			textoGuardar={agregar ? "Agregar" : anular ? "Anular" : "Guardar corrección"}
		>
			{agregar && (
				<>
					<Campo label="Secretaria">
						<select
							value={personaId}
							onChange={(e) => setPersonaId(e.target.value)}
							className={inputClase}
							autoFocus
						>
							<option value="" disabled>
								Elegí a la secretaria
							</option>
							{secretarias.map((p) => (
								<option key={p.id} value={p.id}>
									{nombreCompleto(p)}
									{!p.activo ? " (inactiva)" : ""}
								</option>
							))}
						</select>
					</Campo>
					<Campo label="Movimiento">
						<div>
							<Segmentado
								opciones={
									[
										["entrada", "Entrada"],
										["salida", "Salida"],
									] as const
								}
								valor={tipo}
								onChange={setTipo}
							/>
						</div>
					</Campo>
					<div className="grid grid-cols-2 gap-4">
						<Campo label="Fecha">
							<input
								type="date"
								value={fecha}
								min={fechaInicio && fechaInicio <= hoy ? fechaInicio : undefined}
								max={hoy}
								onChange={(e) => e.target.value && setFecha(e.target.value)}
								className={inputClase}
							/>
						</Campo>
						<Campo label="Hora">
							<input
								type="time"
								value={hora}
								onChange={(e) => setHora(e.target.value)}
								className={inputClase}
							/>
						</Campo>
					</div>
					<p className="text-xs text-gray-500 flex items-start gap-1.5">
						{tipo === "entrada" ? (
							<>
								<LogIn className="w-3.5 h-3.5 shrink-0 mt-px" />
								{fecha === hoy
									? "Si es de hoy, queda abierta: cuando apoye el llavero al irse se registra la salida."
									: "Queda sin salida hasta que agregues la salida de ese día."}
							</>
						) : (
							<>
								<LogOut className="w-3.5 h-3.5 shrink-0 mt-px" />
								La salida cierra la última entrada sin salida de ese día.
							</>
						)}
					</p>
				</>
			)}

			{!agregar && !anular && jornada && (
				<div className="grid grid-cols-2 gap-4">
					<Campo label={`Hora de ${nombreTipo} registrada`}>
						<p className="text-sm font-semibold text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
							{horaAR(modo.tipo === "entrada" ? jornada.entrada : jornada.salida!)}
						</p>
					</Campo>
					<Campo label="Hora correcta">
						<input
							type="time"
							value={hora}
							onChange={(e) => setHora(e.target.value)}
							className={inputClase}
							autoFocus
						/>
					</Campo>
				</div>
			)}

			{anular && jornada && (
				<div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-800 flex items-start gap-2">
					<AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
					<span>
						{modo.tipo === "entrada"
							? `Se anula la jornada entera (entrada ${horaAR(jornada.entrada)}${
									jornada.salida ? ` y salida ${horaAR(jornada.salida)}` : ""
								}): deja de sumar horas. No se borra, queda en el historial.`
							: jornada.fecha === hoy
								? "La jornada vuelve a quedar abierta: cuando apoye el llavero se registra la salida de nuevo."
								: "La jornada queda sin salida y no suma horas hasta que agregues la salida correcta."}
					</span>
				</div>
			)}

			<CampoMotivo
				value={motivo}
				onChange={setMotivo}
				label={agregar ? "Motivo del registro manual" : "Motivo del cambio"}
				placeholder={
					agregar
						? "Ej.: se olvidó el llavero"
						: anular
							? "Ej.: apoyó el llavero por error"
							: "Ej.: el lector registró tarde la salida"
				}
			/>

			{jornada && <Historial items={jornada.historial} />}
		</ModalFormulario>
	);
}
