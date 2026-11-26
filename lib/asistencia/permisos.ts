"use client";

/**
 * Qué puede ver cada uno en Registro de Asistencias.
 *
 * - Director (`Admins.esDirector`): todo (métricas, montos, recibos y toda la carga de datos).
 * - Resto del panel (secretarios y admins que no son director): el calendario sin
 *   métricas, montos ni recibos, y en Carga de datos solo la asistencia manual y los feriados.
 *
 * Esto solo decide qué se muestra: la protección real está en firestore.rules (isDirector()).
 */
import { useAdminAuth } from "@/context/AdminAuthContext";

export type TabCarga = "personal" | "precios" | "cursos" | "registros" | "feriados";

const TABS_SECRETARIA: TabCarga[] = ["registros", "feriados"];
const TABS_DIRECTOR: TabCarga[] = ["personal", "precios", "cursos", "registros", "feriados"];

export interface PermisosAsistencia {
	esDirector: boolean;
	verMontos: boolean;
	verRecibos: boolean;
	tabsCarga: TabCarga[];
}

export function permisosAsistencia(esDirector: boolean): PermisosAsistencia {
	return {
		esDirector,
		verMontos: esDirector,
		verRecibos: esDirector,
		tabsCarga: esDirector ? TABS_DIRECTOR : TABS_SECRETARIA,
	};
}

export function usePermisosAsistencia(): PermisosAsistencia {
	const { adminData } = useAdminAuth();
	return permisosAsistencia(adminData?.esDirector === true);
}
