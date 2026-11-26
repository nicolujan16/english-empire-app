/**
 * Montos en letras, como van en el recibo:
 * 585595 → "PESOS QUINIENTOS OCHENTA Y CINCO MIL QUINIENTOS NOVENTA Y CINCO CON 00 CENTAVOS"
 */

const UNIDADES = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const DIEZ_A_DIECINUEVE = [
	"DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE",
	"DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE",
];
const VEINTES = [
	"VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO",
	"VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE",
];
const DECENAS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = [
	"", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS",
	"QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS",
];

/** 0 a 99 */
const decenas = (n: number): string => {
	if (n < 10) return UNIDADES[n];
	if (n < 20) return DIEZ_A_DIECINUEVE[n - 10];
	if (n < 30) return VEINTES[n - 20];
	const u = n % 10;
	return DECENAS[Math.floor(n / 10)] + (u ? ` Y ${UNIDADES[u]}` : "");
};

/** 0 a 999 */
const centenas = (n: number): string => {
	if (n === 100) return "CIEN";
	const c = Math.floor(n / 100);
	const resto = decenas(n % 100);
	return [CENTENAS[c], resto].filter(Boolean).join(" ");
};

/** Antes de "MIL" o "MILLONES": UNO → UN, VEINTIUNO → VEINTIÚN */
const apocopar = (texto: string) =>
	texto.replace(/VEINTIUNO$/, "VEINTIÚN").replace(/UNO$/, "UN");

/** Entero de 0 a 999.999.999 en letras */
export function enteroALetras(n: number): string {
	if (!Number.isInteger(n) || n < 0 || n > 999_999_999)
		throw new Error(`No se puede escribir en letras: ${n}`);
	if (n === 0) return "CERO";

	const millones = Math.floor(n / 1_000_000);
	const miles = Math.floor((n % 1_000_000) / 1000);
	const resto = n % 1000;
	const partes: string[] = [];

	if (millones === 1) partes.push("UN MILLÓN");
	else if (millones > 1) partes.push(`${apocopar(centenas(millones))} MILLONES`);

	if (miles === 1) partes.push("MIL");
	else if (miles > 1) partes.push(`${apocopar(centenas(miles))} MIL`);

	if (resto > 0) partes.push(centenas(resto));

	return partes.join(" ");
}

/** Monto en pesos con centavos */
export function montoEnLetras(monto: number): string {
	const centavosTotales = Math.round(monto * 100);
	const pesos = Math.floor(centavosTotales / 100);
	const centavos = centavosTotales % 100;
	return `PESOS ${enteroALetras(pesos)} CON ${String(centavos).padStart(2, "0")} CENTAVOS`;
}
