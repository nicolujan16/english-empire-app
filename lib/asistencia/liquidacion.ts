/**
 * Cálculo de lo que cobra cada persona en el mes. Funciones puras.
 * Lo usan la tabla del calendario y la pantalla de recibos, así muestran lo mismo.
 *
 * Cada persona tiene un solo recibo, armado por partes (tiene las que le tocan):
 * - Horas (secretarias): precio por hora × minutos de sus turnos. Cuentan las
 *   jornadas Activas con salida (las incompletas no suman hasta que Juan las
 *   complete). **El tiempo de su turno que estuvo dando una clase (propia o de
 *   reemplazo) no se paga como hora de secretaria**: se descuenta la superposición.
 *   Ej.: turno de 18 a 22 con clase de 19 a 20 → se pagan 3 horas.
 * - Cursos (titulares): pago mensual fijo por cada curso del que es titular y que
 *   está vigente en el mes: monto fijo × alumnos × su porcentaje (ver pagoCursos.ts).
 *   No depende de cuántas clases dio: las clases que cuentan (Activa, no excluida
 *   por un día especial, salvo "contar igual") van al recibo como control.
 * - Reemplazos (cualquiera, también secretarias): si una clase que cuenta la dio
 *   alguien que no es titular de ese día (aunque sea profesora del curso: ver
 *   titulares.ts), el valor de la clase (pago mensual de la titular ÷ sus clases del
 *   curso en el mes, feriados incluidos) se le resta a la titular y se le suma a
 *   quien la dio.
 *
 * Así salen solos los cuatro casos: secretaria, profesora, secretaria que reemplaza
 * y secretaria que también es profesora.
 */
import {
	diaEspecialQueExcluye,
	type ClaseCalendario,
	type DiaEspecialCalendario,
	type EmpleadoCalendario,
	type JornadaCalendario,
} from "@/components/admin/asistencia-personal/CalendarioAsistencia";
import { redondearCentavos } from "./dinero";
import { diaSemanaDeFecha, fechaHoraAR } from "./fechas";
import { titularesDelDia } from "./titulares";
import {
	clasesDelMesDeProfesora,
	cursoVigenteEnMes,
	pagoMensual,
	pagoPorClaseEstimado,
} from "./pagoCursos";
import type {
	ClaseLiquidada,
	Curso,
	CursoLiquidado,
	Persona,
	Recibo,
	ReemplazoLiquidado,
	Rol,
} from "./tipos";

export interface Liquidacion {
	personalId: string;
	nombre: string;
	/** "secretaria" si tiene horas (está en Personal), aunque también sea profesora */
	rol: Rol;
	/** Secretaria que además es titular de cursos (o tiene su cuenta del portal docente) */
	tambienProfesora: boolean;
	// ── Horas: solo secretarias ──
	/** Minutos que se pagan (los de sus turnos menos los que estuvo dando clase). null = no es secretaria */
	totalMinutos: number | null;
	/** Minutos de sus turnos que estuvo dando clase: se descuentan de las horas */
	minutosEnClase: number;
	precioHora: number | null;
	/** Lo que cobra por las horas: precio por hora × totalMinutos */
	totalHoras: number;
	// ── Clases, cursos y reemplazos: cualquiera ──
	/** Clases que dio y cuentan (control de asistencia) */
	totalClases: number;
	clases: ClaseLiquidada[];
	cursos: CursoLiquidado[];
	reemplazos: ReemplazoLiquidado[];
	totalAPagar: number;
	/** true si falta algún precio: esa parte se calculó en $0 */
	faltaPrecio: boolean;
	/** Secretarias: precio por hora. Profesoras: null (cobran un monto mensual por curso) */
	precio: number | null;
	precioEsPromedio: boolean;
	/** Cursos que cobra en el mes */
	cantidadCursos: number;
}

export interface DatosLiquidacion {
	periodo: string; // "YYYY-MM"
	empleados: EmpleadoCalendario[];
	jornadas: JornadaCalendario[];
	clases: ClaseCalendario[];
	diasEspeciales: DiaEspecialCalendario[];
	personal: Persona[];
	cursos: Curso[];
}

/** Minutos que suma una jornada (misma regla que el calendario) */
export const minutosQueCuentan = (j: JornadaCalendario): number => {
	if (j.estado !== "Activa" || j.incompleta || !j.salida) return 0;
	if (j.minutos != null) return j.minutos;
	return Math.max(
		0,
		Math.round((j.salida.getTime() - j.entrada.getTime()) / 60000),
	);
};

/**
 * Minutos de la jornada en los que estuvo dando alguna de esas clases (la unión de
 * las clases, recortada a la jornada). Nunca más que lo que suma la jornada.
 */
export function minutosEnClaseDeJornada(
	j: JornadaCalendario,
	clases: Pick<ClaseCalendario, "fecha" | "horaInicio" | "horaFin">[],
): number {
	const suma = minutosQueCuentan(j);
	if (suma === 0 || !j.salida) return 0;
	const ini = j.entrada.getTime();
	const fin = j.salida.getTime();
	const tramos = clases
		.map((c) => [
			Math.max(fechaHoraAR(c.fecha, c.horaInicio).getTime(), ini),
			Math.min(fechaHoraAR(c.fecha, c.horaFin).getTime(), fin),
		])
		.filter(([a, b]) => b > a)
		.sort((x, y) => x[0] - y[0]);
	let total = 0;
	let desde = 0;
	let hasta = 0;
	tramos.forEach(([a, b], i) => {
		if (i === 0 || a > hasta) {
			total += hasta - desde;
			desde = a;
			hasta = b;
		} else hasta = Math.max(hasta, b);
	});
	total += hasta - desde;
	return Math.min(suma, Math.round(total / 60000));
}

/** true si la clase dictada cuenta para el recibo */
export const claseCuenta = (
	c: ClaseCalendario,
	diasEspeciales: DiaEspecialCalendario[],
) =>
	c.dictada?.estado === "Activa" &&
	(c.dictada.contarIgual || !diaEspecialQueExcluye(c, diasEspeciales));

const ordenarClases = (a: ClaseCalendario, b: ClaseCalendario) =>
	a.fecha === b.fecha
		? a.horaInicio.localeCompare(b.horaInicio)
		: a.fecha.localeCompare(b.fecha);

/** Una clase dada por otra persona en lugar de una titular, con lo que vale */
interface Traspaso {
	clase: ClaseCalendario;
	titularId: string;
	titularNombre: string;
	reemplazanteId: string;
	reemplazanteNombre: string;
	clasesDelMes: number;
	monto: number | null; // null si al curso le faltan datos de pago
}

/**
 * Reemplazos del mes: clases que cuentan, de cursos activos y vigentes, dadas
 * por alguien que no es titular de ese día. Uno por cada titular de ese día.
 */
export function traspasosDelMes(datos: DatosLiquidacion): Traspaso[] {
	const cursosPorId = new Map(datos.cursos.map((c) => [c.id, c]));
	return datos.clases.flatMap((clase) => {
		const curso = cursosPorId.get(clase.cursoId);
		const dictada = clase.dictada;
		if (!curso || !dictada || !curso.activo || !cursoVigenteEnMes(curso, datos.periodo))
			return [];
		const titulares = titularesDelDia(curso, diaSemanaDeFecha(clase.fecha));
		if (titulares.includes(dictada.profesoraId) || !claseCuenta(clase, datos.diasEspeciales))
			return [];
		return titulares.map((titularId): Traspaso => {
			const clasesDelMes = clasesDelMesDeProfesora(curso, datos.periodo, titularId);
			return {
				clase,
				titularId,
				titularNombre: curso.profesoraNombres[curso.profesoraIds.indexOf(titularId)] ?? "",
				reemplazanteId: dictada.profesoraId,
				reemplazanteNombre: dictada.profesoraNombre,
				clasesDelMes,
				monto: pagoPorClaseEstimado(pagoMensual(curso, titularId), clasesDelMes),
			};
		});
	});
}

const ordenarReemplazos = (a: ReemplazoLiquidado, b: ReemplazoLiquidado) =>
	a.fecha === b.fecha
		? a.claseId.localeCompare(b.claseId)
		: a.fecha.localeCompare(b.fecha);

export function liquidarPersona(
	empleado: EmpleadoCalendario,
	datos: DatosLiquidacion,
	traspasosMes: Traspaso[] = traspasosDelMes(datos),
): Liquidacion {
	const esSecretaria = empleado.tipo === "secretaria";
	const persona = datos.personal.find((p) => p.id === empleado.id && p.rol === empleado.tipo);

	// ── Clases que dio y cuentan (propias o reemplazos) ──
	const dadas = datos.clases
		.filter(
			(c) =>
				c.dictada?.profesoraId === empleado.id &&
				claseCuenta(c, datos.diasEspeciales),
		)
		.sort(ordenarClases);
	const clases = dadas.map(
		(c): ClaseLiquidada => ({
			claseId: c.id,
			fecha: c.fecha,
			cursoId: c.cursoId,
			cursoNombre: c.cursoNombre,
			horaInicio: c.horaInicio,
			horaFin: c.horaFin,
			esReemplazo: c.dictada?.esReemplazo ?? false,
		}),
	);

	// ── Horas (secretarias): sus turnos menos el tiempo que estuvo dando clase ──
	const precioHora = esSecretaria ? (persona?.precioHora ?? null) : null;
	let totalMinutos: number | null = null;
	let minutosEnClase = 0;
	if (esSecretaria) {
		const suyas = datos.jornadas.filter((j) => j.empleadoId === empleado.id);
		const brutos = suyas.reduce((acc, j) => acc + minutosQueCuentan(j), 0);
		minutosEnClase = suyas.reduce((acc, j) => acc + minutosEnClaseDeJornada(j, dadas), 0);
		totalMinutos = Math.max(0, brutos - minutosEnClase);
	}
	const totalHoras = redondearCentavos(((precioHora ?? 0) * (totalMinutos ?? 0)) / 60);

	// ── Cursos activos de los que es titular y que están vigentes en el mes ──
	const cursos = datos.cursos
		.filter(
			(c) =>
				c.activo &&
				c.profesoraIds.includes(empleado.id) &&
				cursoVigenteEnMes(c, datos.periodo),
		)
		.sort((a, b) => a.nombre.localeCompare(b.nombre))
		.map((c): CursoLiquidado => {
			const total = pagoMensual(c, empleado.id);
			return {
				cursoId: c.id,
				cursoNombre: c.nombre,
				cantidadAlumnos: c.cantidadAlumnos,
				montoFijo: c.montoFijo,
				porcentaje: c.porcentajes[empleado.id] ?? null,
				total: total ?? 0,
			};
		});

	// ── Reemplazos: suma lo que dio en lugar de otra, resta lo que le dieron a ella ──
	const traspasos = traspasosMes.filter(
		(t) => t.reemplazanteId === empleado.id || t.titularId === empleado.id,
	);
	const reemplazos = traspasos
		.map((t): ReemplazoLiquidado => {
			const dio = t.reemplazanteId === empleado.id;
			return {
				claseId: t.clase.id,
				fecha: t.clase.fecha,
				cursoId: t.clase.cursoId,
				cursoNombre: t.clase.cursoNombre,
				tipo: dio ? "dio" : "recibio",
				otraId: dio ? t.titularId : t.reemplazanteId,
				otraNombre: dio ? t.titularNombre : t.reemplazanteNombre,
				clasesDelMes: t.clasesDelMes,
				monto: t.monto ?? 0,
			};
		})
		.sort(ordenarReemplazos);

	const totalCursos = cursos.reduce((acc, c) => acc + c.total, 0);
	const totalReemplazos = reemplazos.reduce(
		(acc, r) => acc + (r.tipo === "dio" ? r.monto : -r.monto),
		0,
	);

	return {
		personalId: empleado.id,
		nombre: empleado.nombreCompleto,
		rol: esSecretaria ? "secretaria" : "profesora",
		tambienProfesora: esSecretaria && (persona?.tambienProfesora === true || cursos.length > 0),
		totalMinutos,
		minutosEnClase,
		precioHora,
		totalHoras,
		totalClases: clases.length,
		clases,
		cursos,
		reemplazos,
		precio: precioHora,
		precioEsPromedio: false,
		cantidadCursos: cursos.length,
		totalAPagar: redondearCentavos(totalHoras + totalCursos + totalReemplazos),
		faltaPrecio:
			(esSecretaria && precioHora === null && (totalMinutos ?? 0) > 0) ||
			cursos.some(
				(c) =>
					c.cantidadAlumnos === null || c.montoFijo === null || c.porcentaje === null,
			) ||
			traspasos.some((t) => t.monto === null),
	};
}

/** Liquidación de todo el personal del mes: secretarias primero, después por nombre */
export const liquidarMes = (datos: DatosLiquidacion): Liquidacion[] => {
	const traspasos = traspasosDelMes(datos);
	return datos.empleados
		.map((e) => liquidarPersona(e, datos, traspasos))
		.sort((a, b) =>
			a.rol === b.rol
				? a.nombre.localeCompare(b.nombre)
				: a.rol === "secretaria"
					? -1
					: 1,
		);
};

/** Qué falta configurar para que los recibos no salgan en $0 */
export function preciosFaltantes(liquidaciones: Liquidacion[]) {
	const cursosSinPrecio = new Set<string>();
	liquidaciones.forEach((l) =>
		l.cursos.forEach((c) => {
			if (c.cantidadAlumnos === null || c.montoFijo === null || c.porcentaje === null)
				cursosSinPrecio.add(c.cursoNombre);
		}),
	);
	return {
		secretarias: liquidaciones
			.filter((l) => l.rol === "secretaria" && l.precioHora === null && (l.totalMinutos ?? 0) > 0)
			.map((l) => l.nombre),
		cursos: [...cursosSinPrecio].sort(),
	};
}

export type EstadoRecibo = "sin_generar" | "generado" | "desactualizado";

/**
 * Compara lo que se calcula hoy con el recibo guardado. Compara todas las partes
 * (los recibos viejos no tienen las que no correspondían a su rol: vienen vacías).
 */
export function estadoRecibo(l: Liquidacion, recibo?: Recibo): EstadoRecibo {
	if (!recibo) return "sin_generar";
	const reemplazos = recibo.reemplazos ?? [];
	const igual =
		recibo.totalAPagar === l.totalAPagar &&
		(recibo.totalMinutos ?? null) === l.totalMinutos &&
		(recibo.minutosEnClase ?? 0) === l.minutosEnClase &&
		(recibo.precioHora ?? null) === l.precioHora &&
		recibo.clases.length === l.clases.length &&
		recibo.clases.every((c, i) => c.claseId === l.clases[i].claseId) &&
		recibo.cursos.length === l.cursos.length &&
		recibo.cursos.every(
			(c, i) =>
				c.cursoId === l.cursos[i].cursoId &&
				c.total === l.cursos[i].total &&
				c.cantidadAlumnos === l.cursos[i].cantidadAlumnos &&
				c.montoFijo === l.cursos[i].montoFijo &&
				c.porcentaje === l.cursos[i].porcentaje,
		) &&
		reemplazos.length === l.reemplazos.length &&
		reemplazos.every(
			(r, i) =>
				r.claseId === l.reemplazos[i].claseId &&
				r.tipo === l.reemplazos[i].tipo &&
				r.otraId === l.reemplazos[i].otraId &&
				r.monto === l.reemplazos[i].monto,
		);
	return igual ? "generado" : "desactualizado";
}
