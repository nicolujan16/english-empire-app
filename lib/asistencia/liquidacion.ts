/**
 * Cálculo de lo que cobra cada persona en el mes. Funciones puras.
 * Lo usan la tabla del calendario y la pantalla de recibos, así muestran lo mismo.
 *
 * - Secretarias: precio por hora × horas trabajadas. Cuentan las jornadas
 *   Activas con salida (las incompletas no suman hasta que Juan las complete).
 * - Profesoras: pago mensual fijo por cada curso del que es titular y que está
 *   vigente en el mes: monto fijo × alumnos × su porcentaje (ver pagoCursos.ts).
 *   No depende de cuántas clases dio: las clases que cuentan (Activa, no excluida
 *   por un día especial, salvo "contar igual") van al recibo como control.
 * - Reemplazos: si una clase que cuenta la dio alguien que no es titular de ese
 *   día (aunque sea profesora del curso: ver titulares.ts), el valor de la clase
 *   (pago mensual de la titular ÷ sus clases del curso en el mes, feriados
 *   incluidos) se le resta a la titular y se le suma a la reemplazante.
 */
import {
	diaEspecialQueExcluye,
	type ClaseCalendario,
	type DiaEspecialCalendario,
	type EmpleadoCalendario,
	type JornadaCalendario,
} from "@/components/admin/asistencia-personal/CalendarioAsistencia";
import { redondearCentavos } from "./dinero";
import { diaSemanaDeFecha } from "./fechas";
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

interface LiquidacionBase {
	personalId: string;
	nombre: string;
	rol: Rol;
	totalAPagar: number;
	/** true si falta algún precio: esa parte se calculó en $0 */
	faltaPrecio: boolean;
	/** Secretarias: precio por hora. Profesoras: null (cobran un monto mensual por curso) */
	precio: number | null;
	precioEsPromedio: boolean;
	/** Profesoras: cursos que cobra en el mes. Secretarias: 0 */
	cantidadCursos: number;
}

export interface LiquidacionSecretaria extends LiquidacionBase {
	rol: "secretaria";
	totalMinutos: number;
	precioHora: number | null;
}

export interface LiquidacionProfesora extends LiquidacionBase {
	rol: "profesora";
	totalClases: number;
	clases: ClaseLiquidada[];
	cursos: CursoLiquidado[];
	reemplazos: ReemplazoLiquidado[];
}

export type Liquidacion = LiquidacionSecretaria | LiquidacionProfesora;

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

/** Una clase dada por otra en lugar de una titular, con lo que vale */
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
): Liquidacion {
	if (empleado.tipo === "secretaria") {
		const precioHora =
			datos.personal.find((p) => p.id === empleado.id)?.precioHora ?? null;
		const totalMinutos = datos.jornadas
			.filter((j) => j.empleadoId === empleado.id)
			.reduce((acc, j) => acc + minutosQueCuentan(j), 0);
		return {
			personalId: empleado.id,
			nombre: empleado.nombreCompleto,
			rol: "secretaria",
			totalMinutos,
			precioHora,
			precio: precioHora,
			precioEsPromedio: false,
			cantidadCursos: 0,
			totalAPagar: redondearCentavos(((precioHora ?? 0) * totalMinutos) / 60),
			faltaPrecio: precioHora === null && totalMinutos > 0,
		};
	}

	const clases = datos.clases
		.filter(
			(c) =>
				c.dictada?.profesoraId === empleado.id &&
				claseCuenta(c, datos.diasEspeciales),
		)
		.sort(ordenarClases)
		.map(
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

	// Cursos activos de los que es titular y que están vigentes en el mes
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

	// Reemplazos: suma lo que dio en lugar de otra, resta lo que le dieron a ella
	const traspasos = traspasosDelMes(datos).filter(
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
		rol: "profesora",
		totalClases: clases.length,
		clases,
		cursos,
		reemplazos,
		precio: null,
		precioEsPromedio: false,
		cantidadCursos: cursos.length,
		totalAPagar: redondearCentavos(totalCursos + totalReemplazos),
		faltaPrecio:
			cursos.some(
				(c) =>
					c.cantidadAlumnos === null || c.montoFijo === null || c.porcentaje === null,
			) || traspasos.some((t) => t.monto === null),
	};
}

/** Liquidación de todo el personal del mes: secretarias primero, después por nombre */
export const liquidarMes = (datos: DatosLiquidacion): Liquidacion[] =>
	datos.empleados
		.map((e) => liquidarPersona(e, datos))
		.sort((a, b) =>
			a.rol === b.rol
				? a.nombre.localeCompare(b.nombre)
				: a.rol === "secretaria"
					? -1
					: 1,
		);

/** Qué falta configurar para que los recibos no salgan en $0 */
export function preciosFaltantes(liquidaciones: Liquidacion[]) {
	const cursosSinPrecio = new Set<string>();
	liquidaciones.forEach((l) => {
		if (l.rol === "profesora")
			l.cursos.forEach((c) => {
				if (c.cantidadAlumnos === null || c.montoFijo === null || c.porcentaje === null)
					cursosSinPrecio.add(c.cursoNombre);
			});
	});
	return {
		secretarias: liquidaciones
			.filter((l) => l.rol === "secretaria" && l.faltaPrecio)
			.map((l) => l.nombre),
		cursos: [...cursosSinPrecio].sort(),
	};
}

export type EstadoRecibo = "sin_generar" | "generado" | "desactualizado";

/** Compara lo que se calcula hoy con el recibo guardado */
export function estadoRecibo(l: Liquidacion, recibo?: Recibo): EstadoRecibo {
	if (!recibo) return "sin_generar";
	const igual =
		recibo.totalAPagar === l.totalAPagar &&
		(l.rol === "secretaria"
			? recibo.totalMinutos === l.totalMinutos && recibo.precioHora === l.precioHora
			: recibo.totalClases === l.totalClases &&
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
				(recibo.reemplazos ?? []).length === l.reemplazos.length &&
				(recibo.reemplazos ?? []).every(
					(r, i) =>
						r.claseId === l.reemplazos[i].claseId &&
						r.tipo === l.reemplazos[i].tipo &&
						r.otraId === l.reemplazos[i].otraId &&
						r.monto === l.reemplazos[i].monto,
				));
	return igual ? "generado" : "desactualizado";
}
