"use client";

/**
 * Configuración del registro de asistencia, en vivo.
 *
 * `fechaInicio`: desde cuándo cuenta el registro. Antes de esa fecha no se esperan
 * clases, no hay pendientes y no se puede navegar a meses anteriores (los cursos
 * pueden haber empezado antes, pero los recibos de sueldo arrancan acá).
 * Mientras carga, o si no hay nada guardado, vale FECHA_INICIO_POR_DEFECTO.
 */
import { useEffect, useState } from "react";
import {
	FECHA_INICIO_POR_DEFECTO,
	repositorioFirestore,
	type ConfiguracionAsistencia,
} from "./repositorio";

export function useConfiguracion(): ConfiguracionAsistencia & {
	/** "YYYY-MM" del primer mes que se puede ver */
	periodoMinimo: string;
	cargando: boolean;
} {
	const [config, setConfig] = useState<ConfiguracionAsistencia | null>(null);

	useEffect(() => repositorioFirestore.suscribirConfiguracion(setConfig), []);

	const actual = config ?? { fechaInicio: FECHA_INICIO_POR_DEFECTO, guardada: false };
	return {
		...actual,
		periodoMinimo: actual.fechaInicio.slice(0, 7),
		cargando: config === null,
	};
}

/** El período no puede ser anterior al mes de inicio del registro */
export const periodoDesde = (periodo: string, periodoMinimo: string) =>
	periodo < periodoMinimo ? periodoMinimo : periodo;
