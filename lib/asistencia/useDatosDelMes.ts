/**
 * Hook que carga todo lo de un mes y lo deja listo para el calendario y los recibos:
 * personal y cursos (en vivo), registros del mes, recibos generados y la liquidación.
 */
import { useEffect, useMemo, useState } from "react";
import { mensajeDeError } from "@/components/admin/asistencia-personal/carga/ui";
import { armarCalendario, type DatosCalendario } from "./calendario";
import { liquidarMes, type Liquidacion } from "./liquidacion";
import { repositorioFirestore } from "./repositorio";
import { suscribirMes, type DatosDelMes } from "./repositorioCalendario";
import type { ClaseDictada, Curso, Persona, Recibo } from "./tipos";

/** Error atado a un mes: si se cambia de mes, deja de mostrarse solo */
interface ErrorDelMes {
	periodo: string;
	mensaje: string;
}

export interface DatosDelMesListos {
	personal: Persona[] | null;
	cursos: Curso[] | null;
	datos: DatosCalendario | null;
	/** Las ClasesDictadas del mes tal cual están en Firestore (con historial), por id */
	dictadas: Map<string, ClaseDictada>;
	liquidaciones: Liquidacion[];
	recibos: Map<string, Recibo>; // por personalId
	cargando: boolean;
	error: string | null;
	errorPendientes: string | null;
}

/**
 * @param esDirector Solo el director lee precios, datos de pago y recibos.
 *   Para las secretarias la liquidación sale en $0 y no se muestra.
 */
export function useDatosDelMes(
	periodo: string,
	{ esDirector, fechaInicio }: { esDirector: boolean; fechaInicio: string },
): DatosDelMesListos {
	const [personal, setPersonal] = useState<Persona[] | null>(null);
	const [cursos, setCursos] = useState<Curso[] | null>(null);
	const [mes, setMes] = useState<DatosDelMes | null>(null);
	const [errorBase, setErrorBase] = useState<string | null>(null);
	const [errorMes, setErrorMes] = useState<ErrorDelMes | null>(null);
	const [errorPendientes, setErrorPendientes] = useState<ErrorDelMes | null>(null);

	// Los cursos del instituto no guardan año: la vigencia se arma con el del mes que se mira
	const anio = Number(periodo.slice(0, 4));

	// Personal y cursos: no dependen del mes (los cursos, solo del año)
	useEffect(() => {
		const onError = (e: Error) => setErrorBase(mensajeDeError(e));
		return repositorioFirestore.suscribirPersonal(setPersonal, onError, {
			conLiquidacion: esDirector,
		});
	}, [esDirector]);

	useEffect(() => {
		const onError = (e: Error) => setErrorBase(mensajeDeError(e));
		return repositorioFirestore.suscribirCursos(setCursos, onError, {
			conLiquidacion: esDirector,
			anio,
		});
	}, [esDirector, anio]);

	useEffect(
		() =>
			suscribirMes(
				periodo,
				setMes,
				(e) => setErrorMes({ periodo, mensaje: mensajeDeError(e) }),
				(e) => setErrorPendientes({ periodo, mensaje: mensajeDeError(e) }),
				{ conRecibos: esDirector },
			),
		[periodo, esDirector],
	);

	// Mientras llega el mes nuevo no se muestran los datos del anterior
	const mesActual = mes?.periodo === periodo ? mes : null;

	const datos = useMemo(
		() =>
			personal && cursos && mesActual
				? armarCalendario({
						periodo,
						personal,
						cursos,
						jornadas: mesActual.jornadas,
						dictadas: mesActual.dictadas,
						diasEspeciales: mesActual.diasEspeciales,
						fichadas: mesActual.fichadas,
						fechaInicio,
					})
				: null,
		[periodo, personal, cursos, mesActual, fechaInicio],
	);

	const liquidaciones = useMemo(
		() =>
			datos && personal && cursos
				? liquidarMes({ ...datos, periodo, personal, cursos })
				: [],
		[datos, periodo, personal, cursos],
	);

	const dictadas = useMemo(
		() => new Map((mesActual?.dictadas ?? []).map((d) => [d.id, d])),
		[mesActual],
	);

	const recibos = useMemo(
		() => new Map((mesActual?.recibos ?? []).map((r) => [r.personalId, r])),
		[mesActual],
	);

	const error =
		errorBase ?? (errorMes?.periodo === periodo ? errorMes.mensaje : null);

	return {
		personal,
		cursos,
		datos,
		dictadas,
		liquidaciones,
		recibos,
		cargando: !datos && !error,
		error,
		errorPendientes:
			errorPendientes?.periodo === periodo ? errorPendientes.mensaje : null,
	};
}

/** "YYYY-MM" del mes actual en hora argentina */
export const periodoActual = () =>
	new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Argentina/Buenos_Aires",
	})
		.format(new Date())
		.slice(0, 7);

/** Valida un "YYYY-MM" que viene de la URL */
export const periodoValido = (v: string | null): string | null =>
	v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null;
