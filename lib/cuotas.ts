// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Descuento {
	porcentaje: number;
	detalle: string;
	acumulableConGrupoFamiliar?: boolean;
}

export interface Cuota {
	id: string;
	alumnoId: string;
	alumnoDni: string;
	alumnoNombre: string;
	alumnoTipo: "adulto" | "menor";
	cursoId: string;
	cursoNombre: string;
	mes: number;
	anio: number;
	estado: "Pendiente" | "Pagado" | "Incobrable";
	esPrimerMes: boolean;
	montoPrimerMes: number | null;
	cuota1a10: number;
	cuota11enAdelante: number;
	montoPagado: number | null;
	fechaPago: string | null;
	metodoPago: string | null;
	inscripcionId: string;
	descuentos?: Descuento[];
	montoAjustado?: number | null;
	motivoAjuste?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Devuelve el precio BASE según la fecha de pago, sin aplicar descuentos.
 * - Si es primer mes: usa montoPrimerMes
 * - Si el pago es adelantado o en término (día ≤ 10): usa cuota1a10
 * - Si el pago es tardío (día > 10): usa cuota11enAdelante
 */
export function calcularPrecioBase(cuota: Cuota): number {
	if (cuota.esPrimerMes && cuota.montoPrimerMes) {
		return cuota.montoPrimerMes;
	}

	const hoy = new Date();
	const mesActual = hoy.getMonth() + 1;
	const anioActual = hoy.getFullYear();
	const diaActual = hoy.getDate();

	const esPagoAdelantado =
		anioActual < cuota.anio ||
		(anioActual === cuota.anio && mesActual < cuota.mes);

	const esPagoEnTermino =
		anioActual === cuota.anio && mesActual === cuota.mes && diaActual <= 10;

	return esPagoAdelantado || esPagoEnTermino
		? cuota.cuota1a10
		: cuota.cuota11enAdelante;
}

/**
 * Devuelve el descuento de mayor porcentaje, o null si no hay ninguno.
 * Regla de negocio: los descuentos NO se acumulan — siempre se aplica
 * únicamente el de mayor beneficio (ej: etiqueta vs. grupo familiar).
 */
export function obtenerMejorDescuento(
	descuentos?: Descuento[],
): Descuento | null {
	if (!descuentos || descuentos.length === 0) return null;
	return descuentos.reduce((max, d) =>
		d.porcentaje > max.porcentaje ? d : max,
	);
}

/**
 * Aplica los descuentos recibidos sobre un precio base (los porcentajes se
 * suman entre sí). Como los descuentos no son acumulables, los callers deben
 * pasar a lo sumo uno: `mejorDescuento ? [mejorDescuento] : []`.
 */
export function aplicarDescuentos(
	precioBase: number,
	descuentos?: Descuento[],
): number {
	if (!descuentos || descuentos.length === 0) return precioBase;
	const totalPorcentaje = descuentos.reduce((acc, d) => acc + d.porcentaje, 0);
	return Math.round(precioBase * (1 - totalPorcentaje / 100));
}

/**
 * Precio final que debe pagar el usuario por una cuota pendiente:
 * - Si tiene un monto ajustado manualmente, ese monto manda.
 * - Si no, precio base según fecha + el mejor descuento (sin acumular).
 */
export function calcularMontoPendiente(cuota: Cuota): number {
	if (cuota.montoAjustado != null) return cuota.montoAjustado;
	const base = calcularPrecioBase(cuota);
	const mejorDescuento = obtenerMejorDescuento(cuota.descuentos);
	return aplicarDescuentos(base, mejorDescuento ? [mejorDescuento] : []);
}
