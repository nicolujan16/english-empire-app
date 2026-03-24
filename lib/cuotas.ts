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
 * Aplica todos los descuentos acumulados sobre un precio base.
 * Los porcentajes se suman y se aplican en una sola operación.
 * Ej: 10% + 15% = 25% de descuento total.
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
 * Precio final que debe pagar el usuario: base + descuentos aplicados.
 */
export function calcularMontoPendiente(cuota: Cuota): number {
	const base = calcularPrecioBase(cuota);
	return aplicarDescuentos(base, cuota.descuentos);
}
