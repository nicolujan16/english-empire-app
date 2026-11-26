/**
 * UID canónico de los llaveros: hexadecimal en mayúsculas sin separadores.
 * Mismo criterio que la aplicación de escritorio (app/dominio/uid.py).
 */

/** "04:a2:3b:1c:5d:6e:80" → "04A23B1C5D6E80". Tira error si no es válido. */
export function normalizarUid(raw: string): string {
	const limpio = String(raw ?? "")
		.replace(/[\s:\-]/g, "")
		.toUpperCase();
	if (!limpio || limpio.length % 2 !== 0 || !/^[0-9A-F]+$/.test(limpio) || limpio.length > 40)
		throw new Error(`UID inválido: ${raw}`);
	return limpio;
}
