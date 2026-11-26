/**
 * Traduce un doc de `Cursos` del instituto (el que se carga en Admin → Cursos)
 * a lo que necesita el registro de asistencia. Funciones puras.
 *
 * En `Cursos` los horarios se guardan como un mapa de texto:
 *   { "Lunes": "18:00 - 19:30, 20:00 - 21:00", "Miércoles": "18:00 - 19:30" }
 *   { "A definir": "" }
 * y la vigencia como meses sueltos (`inicioMes` / `finMes`, 1 a 12), o con el
 * nombre del mes en los cursos viejos (`inicio` / `fin`).
 */
import type { DiaSemana, HorarioCurso } from "./tipos";

const DIAS: Record<string, DiaSemana> = {
	lunes: 1,
	martes: 2,
	miercoles: 3,
	jueves: 4,
	viernes: 5,
	sabado: 6,
	domingo: 7,
};

const MESES = [
	"enero",
	"febrero",
	"marzo",
	"abril",
	"mayo",
	"junio",
	"julio",
	"agosto",
	"septiembre",
	"octubre",
	"noviembre",
	"diciembre",
];

const sinAcentos = (s: string) =>
	s
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.trim()
		.toLowerCase();

/** "9:00" → "09:00"; null si no es una hora válida */
const normalizarHora = (h: string): string | null => {
	const m = /^(\d{1,2}):(\d{2})$/.exec(h.trim());
	if (!m) return null;
	const hh = Number(m[1]);
	const mm = Number(m[2]);
	if (hh > 23 || mm > 59) return null;
	return `${String(hh).padStart(2, "0")}:${m[2]}`;
};

export interface HorariosInterpretados {
	/** Turnos completos (con inicio y fin): son las clases que espera el calendario y el kiosco */
	horarios: HorarioCurso[];
	/**
	 * Días de la semana en que el curso tiene clase, sin repetir. Incluye los días cuyo
	 * horario no tiene hora de fin: para contar las clases del mes alcanza con el día.
	 */
	diasDeClase: DiaSemana[];
	/** Lo que no se pudo usar, para avisarle a Juan (ej.: "Lunes 18:00 (sin hora de fin)") */
	sinInterpretar: string[];
}

/** Convierte el mapa de horarios de `Cursos` en horarios con día, inicio y fin */
export function interpretarHorarios(raw: unknown): HorariosInterpretados {
	const horarios: HorarioCurso[] = [];
	const dias = new Set<DiaSemana>();
	const sinInterpretar: string[] = [];
	if (!raw || typeof raw !== "object") return { horarios, diasDeClase: [], sinInterpretar };

	for (const [diaTexto, valor] of Object.entries(raw as Record<string, unknown>)) {
		const dia = DIAS[sinAcentos(diaTexto)];
		if (!dia) {
			sinInterpretar.push(diaTexto); // "A definir"
			continue;
		}
		const partes = String(valor ?? "")
			.split(",")
			.map((p) => p.trim())
			.filter(Boolean);
		// Si el día tiene algún horario cargado, el curso tiene clase ese día
		if (partes.length > 0) dias.add(dia);
		for (const parte of partes) {
			const [ini, fin] = parte.split("-").map((x) => x.trim());
			const inicio = ini ? normalizarHora(ini) : null;
			const final = fin ? normalizarHora(fin) : null;
			if (!inicio) {
				sinInterpretar.push(`${diaTexto} ${parte}`);
			} else if (!final) {
				sinInterpretar.push(`${diaTexto} ${parte} (sin hora de fin)`);
			} else if (final <= inicio) {
				sinInterpretar.push(`${diaTexto} ${parte} (termina antes de empezar)`);
			} else if (!horarios.some((h) => h.dia === dia && h.inicio === inicio)) {
				horarios.push({ dia, inicio, fin: final });
			}
		}
	}

	horarios.sort((a, b) =>
		a.dia === b.dia ? a.inicio.localeCompare(b.inicio) : a.dia - b.dia,
	);
	return { horarios, diasDeClase: [...dias].sort((a, b) => a - b), sinInterpretar };
}

/** Mes 1-12 desde un número o un nombre ("Marzo"); null si no se entiende */
const leerMes = (v: unknown): number | null => {
	if (typeof v === "number" && v >= 1 && v <= 12) return Math.trunc(v);
	if (typeof v === "string") {
		const n = Number(v);
		if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
		const i = MESES.indexOf(sinAcentos(v));
		if (i >= 0) return i + 1;
	}
	return null;
};

const ultimoDia = (anio: number, mes: number) =>
	new Date(Date.UTC(anio, mes, 0)).getUTCDate();

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/**
 * Vigencia del curso en un año dado, como "YYYY-MM-DD".
 * Los cursos del instituto no guardan año: se toma el del mes que se está mirando.
 * Si el curso termina en un mes anterior al de inicio, se asume que cruza de año.
 */
export function vigenciaDelCurso(
	d: { inicioMes?: unknown; finMes?: unknown; inicio?: unknown; fin?: unknown },
	anio: number,
): { fechaInicio: string; fechaFin: string } {
	const mesInicio = leerMes(d.inicioMes) ?? leerMes(d.inicio) ?? 1;
	const mesFin = leerMes(d.finMes) ?? leerMes(d.fin) ?? 12;
	const anioFin = mesFin < mesInicio ? anio + 1 : anio;
	return {
		fechaInicio: `${anio}-${dosDigitos(mesInicio)}-01`,
		fechaFin: `${anioFin}-${dosDigitos(mesFin)}-${dosDigitos(ultimoDia(anioFin, mesFin))}`,
	};
}
