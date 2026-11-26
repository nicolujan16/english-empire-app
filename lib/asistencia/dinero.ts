/** Helpers de montos en pesos argentinos */

const formato = new Intl.NumberFormat("es-AR", {
	style: "currency",
	currency: "ARS",
	maximumFractionDigits: 2,
});

/** 12000 → "$ 12.000" */
export const formatPesos = (monto: number) => formato.format(monto);

/** Redondea a centavos, para que los totales no arrastren decimales de más */
export const redondearCentavos = (monto: number) =>
	Math.round(monto * 100) / 100;
