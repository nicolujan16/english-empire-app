/**
 * Clases "dadas en su turno". Funciones puras (las usan la web y el servidor).
 *
 * Una secretaria que también es profesora ficha solo su turno, con un único llavero:
 * su clase cuenta como dada si estaba en su turno a esa hora. No se guarda en
 * ClasesDictadas: se calcula, así si se corrige la jornada se recalcula sola. Si no
 * la dio, el director la asigna a otra o la anula (eso sí se guarda y manda).
 *
 * Lo usan el calendario y los recibos (calendario.ts), Carga de datos → Registro y la
 * API de la aplicación de escritorio (para que su itinerario la muestre como dada).
 */
import { fechaHoraAR } from "./fechas";
import type { Jornada, Persona } from "./tipos";

type JornadaTurno = Pick<Jornada, "personalId" | "fecha" | "entrada" | "salida" | "estado">;

interface ClaseDelDia {
	fecha: string;
	horaInicio: string;
	horaFin: string;
	/** Titulares de ese día (titularesDelDia) */
	titularIds: string[];
}

/**
 * La secretaria que también es profesora, titular de la clase, que tiene una jornada
 * activa que se superpone con la clase (si la jornada sigue abierta, solo cuenta la
 * del mismo día), y esa jornada. null si no hay.
 */
export function turnoQueCubre<J extends JornadaTurno>(
	clase: ClaseDelDia,
	personal: Pick<Persona, "id" | "rol" | "tambienProfesora">[],
	jornadas: J[],
): { personaId: string; jornada: J } | null {
	const ini = fechaHoraAR(clase.fecha, clase.horaInicio).getTime();
	const fin = fechaHoraAR(clase.fecha, clase.horaFin).getTime();
	for (const p of personal) {
		if (p.rol !== "secretaria" || p.tambienProfesora !== true || !clase.titularIds.includes(p.id))
			continue;
		const jornada = jornadas.find(
			(j) =>
				j.personalId === p.id &&
				j.estado === "Activa" &&
				j.entrada.getTime() < fin &&
				(j.salida ? j.salida.getTime() > ini : j.fecha === clase.fecha),
		);
		if (jornada) return { personaId: p.id, jornada };
	}
	return null;
}

/** Quién dio la clase en su turno (ver turnoQueCubre), o null */
export function dadaEnSuTurno<P extends Pick<Persona, "id" | "rol" | "tambienProfesora">>(
	clase: ClaseDelDia,
	personal: P[],
	jornadas: JornadaTurno[],
): P | null {
	const t = turnoQueCubre(clase, personal, jornadas);
	return t ? (personal.find((p) => p.id === t.personaId) ?? null) : null;
}
