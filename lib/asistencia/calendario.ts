/**
 * Arma los datos que muestra `CalendarioAsistencia` a partir de lo que hay en
 * Firestore. Funciones puras: no leen Firebase.
 *
 * Las "clases esperadas" no se guardan: salen de `Cursos.horarios` (y su
 * vigencia) para cada día del mes, y se cruzan por ID con `ClasesDictadas`.
 * Las titulares de cada clase son las de ese día de la semana (titulares.ts), y si
 * una clase es reemplazo se calcula con ellas: así, si Juan reparte los días después
 * de que se registró una clase, el calendario y el recibo dicen lo mismo.
 *
 * Una secretaria que también es profesora ficha solo su turno (un llavero): su clase
 * cuenta como dada si estaba en su turno a esa hora (dadaEnSuTurno). No se guarda:
 * se calcula, así si Juan corrige la jornada se recalcula sola. Si no la dio, Juan
 * la asigna a otra o la anula desde el calendario (eso sí se guarda y manda).
 */
import type {
	ClaseCalendario,
	DiaEspecialCalendario,
	EmpleadoCalendario,
	JornadaCalendario,
	PendienteCalendario,
} from "@/components/admin/asistencia-personal/CalendarioAsistencia";
import { diaEspecialQueExcluye } from "@/components/admin/asistencia-personal/CalendarioAsistencia";
import { combinarDiasEspeciales, diasQueAplican } from "./feriados";
import { diaSemanaDeFecha, horaAR, sumarDias } from "./fechas";
import { dadaEnSuTurno } from "./turnos";
import { titularesDelDia } from "./titulares";
import {
	idClaseDictada,
	nombreCompleto,
	type ClaseDictada,
	type Curso,
	type DiaEspecial,
	type Fichada,
	type Jornada,
	type Persona,
} from "./tipos";

export interface DatosCalendario {
	empleados: EmpleadoCalendario[];
	jornadas: JornadaCalendario[];
	clases: ClaseCalendario[];
	diasEspeciales: DiaEspecialCalendario[];
	pendientes: PendienteCalendario[];
}

/** Resultados de fichada que Juan tiene que revisar en el calendario */
export const RESULTADOS_PENDIENTES = ["sin_clase", "llavero_desconocido"] as const;

/** Primer y último día del período, para las queries por rango de fecha */
export const rangoDelMes = (periodo: string) => {
	const [anio, mes] = periodo.split("-").map(Number);
	const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
	return {
		desde: `${periodo}-01`,
		hasta: `${periodo}-${String(ultimo).padStart(2, "0")}`,
	};
};

/** Todas las fechas "YYYY-MM-DD" del período */
export const diasDelMes = (periodo: string) => {
	const { desde, hasta } = rangoDelMes(periodo);
	const dias: string[] = [];
	for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f);
	return dias;
};

/**
 * Clases esperadas del mes (cursos activos, dentro de su vigencia) cruzadas con
 * las dictadas. Las dictadas que no coinciden con ningún horario se agregan igual.
 * Antes de `fechaInicio` (inicio del registro) no se espera ninguna clase, así esos
 * días no quedan como "sin registro". No cambia los montos: la liquidación usa las
 * dictadas y los horarios del curso, no esta lista de esperadas.
 */
export function clasesDelMes(
	periodo: string,
	cursos: Curso[],
	dictadas: ClaseDictada[],
	personal: Persona[],
	fechaInicio = "",
	/** Para las clases de las secretarias que también son profesoras (dadaEnSuTurno) */
	turnos: { jornadas: Jornada[]; diasEspeciales: DiaEspecialCalendario[] } = {
		jornadas: [],
		diasEspeciales: [],
	},
): ClaseCalendario[] {
	const porId = new Map(dictadas.map((d) => [d.id, d]));
	const cursosPorId = new Map(cursos.map((c) => [c.id, c]));
	const nombres = new Map(personal.map((p) => [p.id, nombreCompleto(p)]));
	const clases: ClaseCalendario[] = [];

	// Si es reemplazo se calcula con las titulares de hoy (null = no hay curso: lo guardado)
	const aDictada = (
		d: ClaseDictada | undefined,
		titularIds: string[] | null,
	): ClaseCalendario["dictada"] =>
		d
			? {
					profesoraId: d.profesoraDictoId,
					profesoraNombre: d.profesoraDictoNombre,
					esReemplazo: titularIds ? !titularIds.includes(d.profesoraDictoId) : d.esReemplazo,
					minutosTarde: d.minutosTarde,
					estado: d.estado,
					contarIgual: d.contarIgual,
					fueOffline: d.fueOffline,
				}
			: null;

	diasDelMes(periodo).forEach((fecha) => {
		if (fecha < fechaInicio) return;
		const dia = diaSemanaDeFecha(fecha);
		cursos
			.filter((c) => c.activo && c.fechaInicio <= fecha && fecha <= c.fechaFin)
			.forEach((c) => {
				const titularIds = titularesDelDia(c, dia);
				const titularNombres = titularIds.map(
					(t) => c.profesoraNombres[c.profesoraIds.indexOf(t)] ?? "",
				);
				c.horarios
					.filter((h) => h.dia === dia)
					.forEach((h) => {
						const id = idClaseDictada(c.id, fecha, h.inicio);
						const base = {
							id,
							fecha,
							cursoId: c.id,
							cursoNombre: c.nombre,
							horaInicio: h.inicio,
							horaFin: h.fin,
							titularIds,
							titularNombres,
						};
						const guardada = porId.get(id);
						// Sin registro: si es de una secretaria-profesora que estaba en su turno, la dio ella
						const enSuTurno =
							!guardada && !diaEspecialQueExcluye(base, turnos.diasEspeciales)
								? dadaEnSuTurno(base, personal, turnos.jornadas)
								: null;
						clases.push({
							...base,
							dictada: enSuTurno
								? {
										profesoraId: enSuTurno.id,
										profesoraNombre: nombreCompleto(enSuTurno),
										esReemplazo: false,
										minutosTarde: null,
										estado: "Activa",
										contarIgual: false,
										enSuTurno: true,
									}
								: aDictada(guardada, titularIds),
						});
						porId.delete(id);
					});
			});
	});

	// Registradas fuera de los horarios del curso (clases extra o curso dado de baja)
	porId.forEach((d) => {
		const curso = cursosPorId.get(d.cursoId);
		const titularIds = curso ? titularesDelDia(curso, diaSemanaDeFecha(d.fecha)) : d.titularIds;
		clases.push({
			id: d.id,
			fecha: d.fecha,
			cursoId: d.cursoId,
			cursoNombre: d.cursoNombre,
			horaInicio: d.horaInicio,
			horaFin: d.horaFin,
			titularIds,
			titularNombres: titularIds.map((id) => nombres.get(id) ?? ""),
			dictada: aDictada(d, curso ? titularIds : null),
		});
	});

	return clases;
}

/**
 * Personal que aparece en el calendario: las personas activas y, además,
 * las inactivas que tienen actividad en el mes (para que sus horas o clases cuenten).
 */
export function empleadosDelMes(
	personal: Persona[],
	jornadas: Jornada[],
	dictadas: ClaseDictada[],
): EmpleadoCalendario[] {
	const conActividad = new Set([
		...jornadas.map((j) => j.personalId),
		...dictadas.map((c) => c.profesoraDictoId),
	]);
	return personal
		.filter((p) => p.activo || conActividad.has(p.id))
		.map((p) => ({ id: p.id, nombreCompleto: nombreCompleto(p), tipo: p.rol }));
}

export const aJornadaCalendario = (j: Jornada): JornadaCalendario => ({
	id: j.id,
	empleadoId: j.personalId,
	empleadoNombre: j.personalNombre,
	fecha: j.fecha,
	entrada: j.entrada,
	salida: j.salida,
	minutos: j.minutos,
	incompleta: j.incompleta,
	estado: j.estado,
	fueOffline: j.fueOffline,
});

export const aDiaEspecialCalendario = (d: DiaEspecial): DiaEspecialCalendario => ({
	id: d.id,
	fecha: d.fecha,
	descripcion: d.descripcion,
	todoElDia: d.todoElDia,
	desde: d.desde,
	hasta: d.hasta,
	cursoIds: d.cursoIds,
	tipo: d.tipo,
	cerrado: d.cerrado,
	sinClases: d.sinClases,
});

/** Fichadas sin resolver que el calendario muestra como "Para revisar" */
export const pendientesDeFichadas = (fichadas: Fichada[]): PendienteCalendario[] =>
	fichadas
		.filter((f) => !f.resuelta)
		.flatMap((f) =>
			f.resultado === "sin_clase" || f.resultado === "llavero_desconocido"
				? [
						{
							id: f.id,
							fecha: f.fecha,
							tipo: f.resultado,
							empleadoNombre: f.personalNombre,
							hora: horaAR(f.horaEfectiva),
							descripcion:
								f.resultado === "sin_clase"
									? "Fichó y no había ninguna clase suya en ese horario."
									: `Llavero ${f.llaveroUid} sin asignar a nadie.`,
						},
					]
				: [],
		);

export function armarCalendario(input: {
	periodo: string;
	personal: Persona[];
	cursos: Curso[];
	jornadas: Jornada[];
	dictadas: ClaseDictada[];
	/** Los guardados en Firestore: se suman los feriados predeterminados */
	diasEspeciales: DiaEspecial[];
	fichadas: Fichada[];
	/** Inicio del registro: antes no se esperan clases */
	fechaInicio?: string;
}): DatosCalendario {
	const { desde, hasta } = rangoDelMes(input.periodo);
	const diasEspeciales = diasQueAplican(
		combinarDiasEspeciales(input.diasEspeciales, desde, hasta),
	);
	const diasCalendario = diasEspeciales.map(aDiaEspecialCalendario);
	return {
		empleados: empleadosDelMes(input.personal, input.jornadas, input.dictadas),
		jornadas: input.jornadas.map(aJornadaCalendario),
		clases: clasesDelMes(
			input.periodo,
			input.cursos,
			input.dictadas,
			input.personal,
			input.fechaInicio,
			{ jornadas: input.jornadas, diasEspeciales: diasCalendario },
		),
		diasEspeciales: diasCalendario,
		pendientes: pendientesDeFichadas(input.fichadas),
	};
}

/**
 * Lo que el calendario marca "para revisar" (misma regla que el componente):
 * jornadas sin salida, clases de días pasados sin registro (que no caen en un
 * día especial) y fichadas sin resolver.
 */
export function contarARevisar(datos: DatosCalendario, hoy: string) {
	const ids = new Set(datos.empleados.map((e) => e.id));
	const incompletas = datos.jornadas.filter(
		(j) =>
			ids.has(j.empleadoId) &&
			j.estado === "Activa" &&
			(j.incompleta || !j.salida),
	).length;
	const sinRegistro = datos.clases.filter(
		(c) =>
			!c.dictada &&
			c.fecha < hoy &&
			!diaEspecialQueExcluye(c, datos.diasEspeciales),
	).length;
	const pendientes = datos.pendientes.length;
	return {
		incompletas,
		sinRegistro,
		pendientes,
		total: incompletas + sinRegistro + pendientes,
	};
}
