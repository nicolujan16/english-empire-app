/**
 * Titulares de cada día de un curso. Funciones puras (las usan la web y el servidor).
 *
 * Un curso puede tener varias profesoras que se reparten los días: Kinder A los lunes
 * con Fio y los miércoles con Ana. Se guarda en cada profesora, al lado de su lista de
 * cursos: `Teachers.diasAsignados = { [cursoId]: [1, 3] }` (1 = lunes … 7 = domingo).
 *
 * - Si una profesora tiene el curso en `cursosAsignados` pero no tiene días cargados
 *   para ese curso (null), da **todos** los días. Así funciona lo que se asignó antes
 *   de repartir los días, y lo que se asigna desde Configuración → Gestionar profesores.
 * - Un mismo día puede tener varias titulares (dan la clase juntas).
 * - Si la da una profesora que no es titular de ese día, es un reemplazo, aunque sea
 *   profesora del curso.
 */
import type { Curso, DiaSemana } from "./tipos";

export type DiasPorProfesora = Record<string, DiaSemana[] | null>;

type ConTitulares = Pick<Curso, "profesoraIds" | "diasPorProfesora">;

const esDia = (v: unknown): v is DiaSemana =>
	typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 7;

/** Los días de una profesora en un curso, desde su doc de Teachers. null = todos los días */
export function leerDiasAsignados(diasAsignados: unknown, cursoId: string): DiaSemana[] | null {
	if (!diasAsignados || typeof diasAsignados !== "object") return null;
	const v = (diasAsignados as Record<string, unknown>)[cursoId];
	if (!Array.isArray(v)) return null;
	return [...new Set(v.filter(esDia))].sort((a, b) => a - b);
}

/** true si la profesora es titular del curso ese día de la semana */
export const daElDia = (curso: ConTitulares, profesoraId: string, dia: number) => {
	if (!curso.profesoraIds.includes(profesoraId)) return false;
	const dias = curso.diasPorProfesora[profesoraId] ?? null;
	return dias === null || dias.includes(dia as DiaSemana);
};

/** Titulares del curso ese día de la semana (1 = lunes … 7 = domingo) */
export const titularesDelDia = (curso: ConTitulares, dia: number): string[] =>
	curso.profesoraIds.filter((id) => daElDia(curso, id, dia));

/** Días de clase del curso que no tienen ninguna titular */
export const diasSinTitular = (curso: ConTitulares & Pick<Curso, "diasDeClase">): DiaSemana[] =>
	curso.profesoraIds.length === 0
		? []
		: curso.diasDeClase.filter((d) => titularesDelDia(curso, d).length === 0);

/**
 * true si el curso tiene dos o más profesoras y todavía no se repartieron los días
 * (todas siguen "todos los días", como se asignaron antes de poder repartirlos).
 */
export const faltaRepartirDias = (curso: ConTitulares & Pick<Curso, "diasDeClase">) =>
	curso.profesoraIds.length >= 2 &&
	curso.diasDeClase.length > 0 &&
	curso.profesoraIds.every((id) => (curso.diasPorProfesora[id] ?? null) === null);
