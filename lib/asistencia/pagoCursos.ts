/**
 * Pago de las profesoras por curso. Funciones puras.
 *
 * 1. Pago mensual (lo que paga Juan) = monto fijo × cantidad de alumnos × porcentaje.
 *    No usa los horarios ni depende de cuántas clases dio. Si da varios cursos, se suma
 *    lo de cada uno. Ej.: Kinder A con Fio: 49.000 × 8 × 45% = 176.400 por mes.
 *
 * 2. Pago por clase (estimado) = pago mensual ÷ clases que tiene el curso en el mes.
 *    Las clases del mes son los días del mes que caen en los días de la semana del
 *    curso. Los feriados se cuentan igual (es un estimativo: lo que importa es el
 *    pago mensual). Ej.: Kinder A lunes y miércoles; noviembre 2026 tiene 5 lunes y
 *    4 miércoles = 9 clases → 176.400 ÷ 9 = 19.600 por clase.
 *    Es el valor que se descuenta a la titular (y cobra la reemplazante) por un reemplazo.
 */
import { diasDelMes, rangoDelMes } from "./calendario";
import { redondearCentavos } from "./dinero";
import { diaSemanaDeFecha } from "./fechas";
import type { Curso } from "./tipos";

type DatosDePago = Pick<Curso, "cantidadAlumnos" | "montoFijo" | "porcentajes">;

/** Pago mensual de una profesora en un curso; null si falta algún dato */
export function pagoMensual(
	curso: DatosDePago,
	profesoraId: string,
): number | null {
	const porcentaje = curso.porcentajes[profesoraId];
	if (
		curso.cantidadAlumnos === null ||
		curso.montoFijo === null ||
		porcentaje === undefined ||
		porcentaje === null
	)
		return null;
	return redondearCentavos((curso.montoFijo * curso.cantidadAlumnos * porcentaje) / 100);
}

/** true si la vigencia del curso toca el mes "YYYY-MM" */
export function cursoVigenteEnMes(
	curso: Pick<Curso, "fechaInicio" | "fechaFin">,
	periodo: string,
): boolean {
	const { desde, hasta } = rangoDelMes(periodo);
	return curso.fechaInicio <= hasta && curso.fechaFin >= desde;
}

/**
 * Clases que tiene el curso en el mes: los días del mes (todo el mes, feriados
 * incluidos) cuyo día de la semana es uno de los días de clase del curso.
 * Cada día cuenta una vez, aunque ese día tenga más de un horario.
 */
export function clasesDelMesSegunHorarios(
	curso: Pick<Curso, "diasDeClase">,
	periodo: string,
): number {
	const dias = new Set(curso.diasDeClase);
	return diasDelMes(periodo).filter((f) => dias.has(diaSemanaDeFecha(f))).length;
}

/** Pago por clase estimado; null si falta el pago mensual o el mes no tiene clases */
export function pagoPorClaseEstimado(
	mensual: number | null,
	clasesDelMes: number,
): number | null {
	if (mensual === null || clasesDelMes === 0) return null;
	return redondearCentavos(mensual / clasesDelMes);
}

/** Suma de los porcentajes de las profesoras asignadas */
export const sumaPorcentajes = (
	curso: Pick<Curso, "porcentajes" | "profesoraIds">,
) =>
	curso.profesoraIds.reduce((acc, id) => acc + (curso.porcentajes[id] ?? 0), 0);

/** true si al curso le falta algún dato para calcular el pago de sus profesoras */
export const cursoSinDatosDePago = (curso: Curso) =>
	curso.profesoraIds.length > 0 &&
	curso.profesoraIds.some((id) => pagoMensual(curso, id) === null);
