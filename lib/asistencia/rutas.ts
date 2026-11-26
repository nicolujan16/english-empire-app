/**
 * Rutas de la sección "Registro de Asistencias" dentro del panel de admin.
 * Están acá para no repetir el prefijo en cada link.
 */
export const RUTA_ASISTENCIA = "/admin/registro-asistencias";

export const rutasAsistencia = {
	calendario: (periodo?: string) =>
		periodo ? `${RUTA_ASISTENCIA}?periodo=${periodo}` : RUTA_ASISTENCIA,
	recibos: (periodo?: string) =>
		periodo
			? `${RUTA_ASISTENCIA}/recibos?periodo=${periodo}`
			: `${RUTA_ASISTENCIA}/recibos`,
	carga: (tab?: string) =>
		tab ? `${RUTA_ASISTENCIA}/carga?tab=${tab}` : `${RUTA_ASISTENCIA}/carga`,
	lector: () => `${RUTA_ASISTENCIA}/lector`,
};
