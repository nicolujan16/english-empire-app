/**
 * Filas del historial de "Lector y llaveros". Función pura.
 *
 * - Secretarias: cada jornada da una fila de entrada y, si tiene, una de salida
 *   (son los "movimientos" que Juan puede corregir de a uno).
 * - Profesoras: una fila por clase registrada (llegada).
 * - Avisos del kiosco: toques que no generaron un movimiento (ya registrado, sin
 *   clase, llavero sin asignar o de baja, persona inactiva).
 */
import type { DatosHistorial } from "./repositorioLector";
import type { CambioHistorial, ClaseDictada, Fichada, Jornada, Llavero, ResultadoFichada } from "./tipos";

export type TipoFila = "entrada" | "salida" | "clase" | "aviso";
export type OrigenFila = "kiosco" | "manual";

export interface FilaHistorial {
	id: string;
	fecha: string;
	hora: Date;
	tipo: TipoFila;
	personaId: string | null;
	personaNombre: string;
	llaveroNumero: string | null;
	origen: OrigenFila;
	/** La jornada o clase está anulada */
	anulada: boolean;
	/** Se le corrigió la hora (o se agregó a mano después) */
	corregida: boolean;
	/** Entrada sin salida */
	sinSalida: boolean;
	detalle: string;
	/** Para editar: la jornada de la entrada/salida */
	jornada?: Jornada;
	clase?: ClaseDictada;
	fichada?: Fichada;
	/** Avisos: resultado del kiosco */
	resultado?: ResultadoFichada;
}

const tocadoA = (historial: CambioHistorial[], campo: string) =>
	historial.some((h) => h.campo === campo);

const AVISOS: Partial<Record<ResultadoFichada, string>> = {
	ya_registrado: "Toque repetido: ya estaba registrado",
	sin_clase: "Fichó sin tener una clase en ese horario",
	llavero_desconocido: "Llavero sin asignar a nadie",
	llavero_baja: "Llavero dado de baja",
	personal_inactivo: "Persona dada de baja",
};

/** Avisos que conviene revisar (se pueden marcar como revisados) */
export const AVISOS_A_REVISAR: ResultadoFichada[] = ["sin_clase", "llavero_desconocido"];

export function armarHistorial(
	datos: DatosHistorial,
	llaveros: Llavero[],
): FilaHistorial[] {
	const fichadaPorId = new Map(datos.fichadas.map((f) => [f.id, f]));
	const numeroPorUid = new Map(llaveros.map((l) => [l.uid, l.numero]));
	const numeroDe = (fichadaId: string | null) => {
		const f = fichadaId ? fichadaPorId.get(fichadaId) : undefined;
		return f ? (f.llaveroNumero ?? numeroPorUid.get(f.llaveroUid) ?? null) : null;
	};
	const filas: FilaHistorial[] = [];

	datos.jornadas.forEach((j) => {
		const anulada = j.estado === "Anulada";
		const entradaKiosco = j.origen === "fichada";
		filas.push({
			id: `${j.id}-entrada`,
			fecha: j.fecha,
			hora: j.entrada,
			tipo: "entrada",
			personaId: j.personalId,
			personaNombre: j.personalNombre,
			llaveroNumero: numeroDe(j.fichadaEntradaId),
			origen: entradaKiosco ? "kiosco" : "manual",
			anulada,
			corregida: tocadoA(j.historial, "entrada"),
			sinSalida: !anulada && !j.salida,
			detalle: j.incompleta && !j.salida ? "Sin salida: quedó para revisar" : "",
			jornada: j,
		});
		if (j.salida) {
			// La salida es del kiosco si la registró una fichada y nadie la cargó o cambió a mano
			const salidaKiosco = !!j.fichadaSalidaId || (entradaKiosco && !tocadoA(j.historial, "salida"));
			filas.push({
				id: `${j.id}-salida`,
				fecha: j.fecha,
				hora: j.salida,
				tipo: "salida",
				personaId: j.personalId,
				personaNombre: j.personalNombre,
				llaveroNumero: numeroDe(j.fichadaSalidaId),
				origen: salidaKiosco ? "kiosco" : "manual",
				anulada,
				corregida: tocadoA(j.historial, "salida") && salidaKiosco,
				sinSalida: false,
				detalle: j.minutos != null ? `Jornada de ${Math.floor(j.minutos / 60)} h ${String(j.minutos % 60).padStart(2, "0")} min` : "",
				jornada: j,
			});
		}
	});

	datos.clases.forEach((c) => {
		const kiosco = c.origen === "fichada";
		const hora = c.llegada ?? new Date(`${c.fecha}T${c.horaInicio}:00-03:00`);
		filas.push({
			id: c.id,
			fecha: c.fecha,
			hora,
			tipo: "clase",
			personaId: c.profesoraDictoId,
			personaNombre: c.profesoraDictoNombre,
			llaveroNumero: null,
			origen: kiosco ? "kiosco" : "manual",
			anulada: c.estado === "Anulada",
			corregida: tocadoA(c.historial, "profesoraDicto"),
			sinSalida: false,
			detalle: `${c.cursoNombre} · ${c.horaInicio}–${c.horaFin}${c.esReemplazo ? " · reemplazo" : ""}${
				c.minutosTarde ? ` · ${c.minutosTarde} min tarde` : ""
			}`,
			clase: c,
		});
	});

	datos.fichadas
		.filter((f) => f.resultado in AVISOS)
		.forEach((f) => {
			filas.push({
				id: f.id,
				fecha: f.fecha,
				hora: f.horaEfectiva,
				tipo: "aviso",
				personaId: f.personalId,
				personaNombre: f.personalNombre ?? "—",
				llaveroNumero: f.llaveroNumero ?? numeroPorUid.get(f.llaveroUid) ?? null,
				origen: "kiosco",
				anulada: false,
				corregida: false,
				sinSalida: false,
				detalle: f.detalle ?? AVISOS[f.resultado] ?? f.resultado,
				fichada: f,
				resultado: f.resultado,
			});
		});

	return filas.sort((a, b) => b.hora.getTime() - a.hora.getTime());
}
