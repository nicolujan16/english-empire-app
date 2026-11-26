/**
 * Bloques de clases de una profesora y qué hacer con un toque de su llavero.
 * Funciones puras (las usa /api/fichar). Mismas reglas que la aplicación de escritorio:
 *
 * - Las clases seguidas, con `huecoMax` minutos o menos entre una y otra, forman un
 *   bloque: un solo toque al llegar registra todas las clases del bloque.
 * - Se puede fichar desde `anticipo` minutos antes del inicio del bloque hasta su fin.
 * - Si el bloque ya está registrado: "ya registrado". Si toca hasta `gracia` minutos
 *   después de terminar un bloque registrado (al irse), también: no hace falta fichar.
 * - Si no hay ningún bloque cerca: "sin clase" (queda para que el director lo revise).
 */

export interface ClaseProgramada {
	cursoId: string;
	cursoNombre: string;
	inicio: string; // "HH:MM"
	fin: string; // "HH:MM"
	titularIds: string[];
}

export interface Bloque {
	clases: ClaseProgramada[];
	inicio: number; // minutos del día
	fin: number;
}

export const REGLAS_FICHADA = {
	antirreboteSegundos: 60,
	anticipoMinutos: 45,
	huecoMaxMinutos: 30,
	graciaSalidaMinutos: 30,
	/** Una fichada offline más vieja que esto queda marcada para revisar la hora */
	offlineMaxHoras: 48,
} as const;

/** "18:30" → 1110 */
export const aMinutos = (hhmm: string) => {
	const [h, m] = hhmm.split(":").map(Number);
	return h * 60 + m;
};

/** 1110 → "18:30" */
export const aHHMM = (minutos: number) =>
	`${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

/** Une clases consecutivas si entre el fin de una y el inicio de la otra hay huecoMax o menos */
export function agruparBloques(
	clases: ClaseProgramada[],
	huecoMax: number = REGLAS_FICHADA.huecoMaxMinutos,
): Bloque[] {
	const bloques: Bloque[] = [];
	[...clases]
		.sort((a, b) => aMinutos(a.inicio) - aMinutos(b.inicio))
		.forEach((c) => {
			const ini = aMinutos(c.inicio);
			const fin = aMinutos(c.fin);
			const ultimo = bloques[bloques.length - 1];
			if (ultimo && ini - ultimo.fin <= huecoMax) {
				ultimo.clases.push(c);
				ultimo.fin = Math.max(ultimo.fin, fin);
			} else bloques.push({ clases: [c], inicio: ini, fin });
		});
	return bloques;
}

export type Decision =
	| { accion: "entrada"; bloque: Bloque }
	| { accion: "ya_registrado"; bloque: Bloque; terminado: boolean }
	| { accion: "sin_clase"; proximo: Bloque | null };

/**
 * Qué hacer con un toque a los `minutos` del día.
 * `registrado(b)`: si el bloque ya tiene sus clases registradas.
 */
export function decidirToque(
	bloques: Bloque[],
	registrado: (b: Bloque) => boolean,
	minutos: number,
	anticipo: number = REGLAS_FICHADA.anticipoMinutos,
	gracia: number = REGLAS_FICHADA.graciaSalidaMinutos,
): Decision {
	for (const b of bloques) {
		if (b.inicio - anticipo <= minutos && minutos < b.fin)
			return registrado(b)
				? { accion: "ya_registrado", bloque: b, terminado: false }
				: { accion: "entrada", bloque: b };
	}
	// Toque al irse, poco después de terminar un bloque ya registrado
	for (const b of bloques) {
		if (registrado(b) && b.fin <= minutos && minutos < b.fin + gracia)
			return { accion: "ya_registrado", bloque: b, terminado: true };
	}
	return {
		accion: "sin_clase",
		proximo: bloques.find((b) => b.inicio - anticipo > minutos) ?? null,
	};
}
