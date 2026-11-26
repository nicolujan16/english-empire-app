/**
 * Feriados predeterminados: los nacionales de Argentina y los provinciales de
 * La Rioja. Se calculan en código para cualquier año (no se guardan).
 *
 * En Firestore (`DiasEspeciales`) solo queda lo que decide Juan:
 *  - Si se adhiere o no a un feriado predeterminado: doc con id = id del feriado
 *    (`pred-2026-carnaval-lunes`) y `adherido`.
 *  - Los días que agrega a mano (feriados que falten o días del instituto).
 *
 * `combinarDiasEspeciales` junta las dos cosas. Funciones puras: no leen Firebase.
 *
 * Fuentes (revisadas en noviembre de 2026):
 *  - Nacionales: Ley 27.399 (inamovibles, trasladables y no laborables) y, para
 *    2026, la Resolución 164/2025 (días no laborables con fines turísticos).
 *  - La Rioja: Ley provincial 9.844 (20/5, 4/8 y 31/12) y el calendario 2026
 *    publicado por los medios públicos de la provincia (suma 1/3 y 12/11).
 * Si un año el Gobierno mueve un feriado distinto a la regla, se corrige en AJUSTES_POR_ANIO.
 */
import { diaSemanaDeFecha, sumarDias } from "./fechas";
import type { DiaEspecial } from "./tipos";

export type AmbitoFeriado = "nacional" | "provincial";

export interface FeriadoPredeterminado {
	id: string; // `pred-${anio}-${clave}`
	fecha: string;
	nombre: string;
	ambito: AmbitoFeriado;
	/** Día no laborable (optativo para el empleador): arranca sin adhesión */
	noLaborable: boolean;
	/** Trasladable: la fecha puede no ser la del calendario */
	trasladable: boolean;
}

type FeriadoBase = Omit<FeriadoPredeterminado, "id"> & { clave: string };

export const PREFIJO_PREDETERMINADO = "pred-";

const idPredeterminado = (anio: number, clave: string) =>
	`${PREFIJO_PREDETERMINADO}${anio}-${clave}`;

export const esIdPredeterminado = (id: string) =>
	id.startsWith(PREFIJO_PREDETERMINADO);

const f = (anio: number, mesDia: string) => `${anio}-${mesDia}`;

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano) */
export function domingoDePascua(anio: number): string {
	const a = anio % 19;
	const b = Math.floor(anio / 100);
	const c = anio % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const g = Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const mes = Math.floor((h + l - 7 * m + 114) / 31);
	const dia = ((h + l - 7 * m + 114) % 31) + 1;
	return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Regla de los trasladables (Ley 27.399, art. 6): si cae martes o miércoles
 * pasa al lunes anterior; si cae jueves o viernes, al lunes siguiente.
 */
export function trasladar(fecha: string): string {
	const dia = diaSemanaDeFecha(fecha); // 1 = lunes
	if (dia === 2 || dia === 3) return sumarDias(fecha, 1 - dia);
	if (dia === 4 || dia === 5) return sumarDias(fecha, 8 - dia);
	return fecha;
}

/**
 * Lo que cambia según el año y no sale de una regla: días turísticos que decreta
 * el Gobierno, feriados extraordinarios o traslados distintos a la regla.
 */
const AJUSTES_POR_ANIO: Record<
	number,
	{ fechas?: Record<string, string>; extras?: FeriadoBase[] }
> = {
	2026: {
		extras: [
			{
				clave: "turistico-marzo",
				fecha: "2026-03-23",
				nombre: "Día no laborable con fines turísticos",
				ambito: "nacional",
				noLaborable: true,
				trasladable: false,
			},
			{
				clave: "turistico-julio",
				fecha: "2026-07-10",
				nombre: "Día no laborable con fines turísticos",
				ambito: "nacional",
				noLaborable: true,
				trasladable: false,
			},
			{
				clave: "visita-papa",
				fecha: "2026-11-09",
				nombre: "Feriado por la visita del Papa León XIV",
				ambito: "nacional",
				noLaborable: false,
				trasladable: false,
			},
			{
				clave: "turistico-diciembre",
				fecha: "2026-12-07",
				nombre: "Día no laborable con fines turísticos",
				ambito: "nacional",
				noLaborable: true,
				trasladable: false,
			},
		],
	},
};

function feriadosBase(anio: number): FeriadoBase[] {
	const pascua = domingoDePascua(anio);
	const nacional = (
		clave: string,
		fecha: string,
		nombre: string,
		extra: Partial<FeriadoBase> = {},
	): FeriadoBase => ({
		clave,
		fecha,
		nombre,
		ambito: "nacional",
		noLaborable: false,
		trasladable: false,
		...extra,
	});
	const trasladable = (clave: string, mesDia: string, nombre: string) =>
		nacional(clave, trasladar(f(anio, mesDia)), nombre, { trasladable: true });
	const provincial = (clave: string, mesDia: string, nombre: string): FeriadoBase => ({
		clave,
		fecha: f(anio, mesDia),
		nombre,
		ambito: "provincial",
		noLaborable: false,
		trasladable: false,
	});

	return [
		// Nacionales inamovibles
		nacional("anio-nuevo", f(anio, "01-01"), "Año Nuevo"),
		nacional("carnaval-lunes", sumarDias(pascua, -48), "Carnaval"),
		nacional("carnaval-martes", sumarDias(pascua, -47), "Carnaval"),
		nacional(
			"memoria",
			f(anio, "03-24"),
			"Día Nacional de la Memoria por la Verdad y la Justicia",
		),
		nacional(
			"malvinas",
			f(anio, "04-02"),
			"Día del Veterano y de los Caídos en la Guerra de Malvinas",
		),
		nacional("jueves-santo", sumarDias(pascua, -3), "Jueves Santo", {
			noLaborable: true,
		}),
		nacional("viernes-santo", sumarDias(pascua, -2), "Viernes Santo"),
		nacional("trabajador", f(anio, "05-01"), "Día del Trabajador"),
		nacional("revolucion-mayo", f(anio, "05-25"), "Día de la Revolución de Mayo"),
		nacional(
			"belgrano",
			f(anio, "06-20"),
			"Paso a la Inmortalidad del Gral. Manuel Belgrano",
		),
		nacional("independencia", f(anio, "07-09"), "Día de la Independencia"),
		nacional(
			"inmaculada",
			f(anio, "12-08"),
			"Día de la Inmaculada Concepción de María",
		),
		nacional("navidad", f(anio, "12-25"), "Navidad"),
		// Nacionales trasladables
		trasladable(
			"guemes",
			"06-17",
			"Paso a la Inmortalidad del Gral. Martín Miguel de Güemes",
		),
		trasladable(
			"san-martin",
			"08-17",
			"Paso a la Inmortalidad del Gral. José de San Martín",
		),
		trasladable("diversidad", "10-12", "Día del Respeto a la Diversidad Cultural"),
		trasladable("soberania", "11-20", "Día de la Soberanía Nacional"),
		// Provinciales de La Rioja
		provincial("lr-autonomia", "03-01", "Día de la Autonomía Provincial"),
		provincial("lr-fundacion", "05-20", "Día de la Fundación de La Rioja"),
		provincial(
			"lr-angelelli",
			"08-04",
			"Aniversario del fallecimiento de Mons. Enrique Angelelli",
		),
		provincial(
			"lr-penaloza",
			"11-12",
			"Aniversario del fallecimiento de Ángel Vicente Peñaloza",
		),
		provincial("lr-tinkunaco", "12-31", "Día del Tinkunaco riojano"),
	];
}

/** Feriados nacionales y de La Rioja de un año, ordenados por fecha */
export function feriadosPredeterminados(anio: number): FeriadoPredeterminado[] {
	const ajustes = AJUSTES_POR_ANIO[anio];
	return [...feriadosBase(anio), ...(ajustes?.extras ?? [])]
		.map(({ clave, ...resto }) => ({
			...resto,
			id: idPredeterminado(anio, clave),
			fecha: ajustes?.fechas?.[clave] ?? resto.fecha,
		}))
		.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Un feriado predeterminado como DiaEspecial (todo el día, todos los cursos) */
export const predeterminadoComoDia = (
	p: FeriadoPredeterminado,
	adherido = !p.noLaborable,
): DiaEspecial => ({
	id: p.id,
	fecha: p.fecha,
	descripcion: p.nombre,
	todoElDia: true,
	desde: null,
	hasta: null,
	cursoIds: [],
	tipo: "feriado",
	cerrado: true,
	sinClases: true,
	adherido,
	predeterminado: true,
});

/** Años (como número) que toca el rango [desde, hasta] */
const aniosDelRango = (desde: string, hasta: string) => {
	const anios: number[] = [];
	for (let a = Number(desde.slice(0, 4)); a <= Number(hasta.slice(0, 4)); a++)
		anios.push(a);
	return anios;
};

/**
 * Todos los días especiales del rango: los predeterminados (con la adhesión que
 * haya guardado Juan) y los que cargó a mano. Incluye los no adheridos: para el
 * cálculo usar `diasQueAplican`.
 *
 * `guardados` son los docs de `DiasEspeciales`. Los que tienen id de predeterminado
 * pero ya no coinciden con ninguno (porque cambió una fecha en AJUSTES) se ignoran.
 */
export function combinarDiasEspeciales(
	guardados: DiaEspecial[],
	desde: string,
	hasta: string,
): DiaEspecial[] {
	const porId = new Map(guardados.map((g) => [g.id, g]));
	const predeterminados = aniosDelRango(desde, hasta)
		.flatMap(feriadosPredeterminados)
		.filter((p) => p.fecha >= desde && p.fecha <= hasta)
		.map((p) => {
			const guardado = porId.get(p.id);
			return predeterminadoComoDia(p, guardado?.adherido ?? !p.noLaborable);
		});
	const manuales = guardados.filter(
		(g) => !esIdPredeterminado(g.id) && g.fecha >= desde && g.fecha <= hasta,
	);
	return [...predeterminados, ...manuales].sort(
		(a, b) => a.fecha.localeCompare(b.fecha) || a.descripcion.localeCompare(b.descripcion),
	);
}

/** Los días que cuentan para el calendario y los recibos */
export const diasQueAplican = (dias: DiaEspecial[]) =>
	dias.filter((d) => d.adherido);

/** Mapa id → datos del predeterminado, para mostrar ámbito y etiquetas en la lista */
export const predeterminadosPorId = (anio: number) =>
	new Map(feriadosPredeterminados(anio).map((p) => [p.id, p]));
