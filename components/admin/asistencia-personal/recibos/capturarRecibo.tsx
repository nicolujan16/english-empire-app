"use client";

/**
 * Convierte el diseño del recibo en una imagen JPG (data URL), en el navegador.
 * Lo dibuja fuera de pantalla, espera tipografías y logo, y lo captura con html-to-image.
 * La imagen tiene que entrar en un documento de Firestore (máx. 1 MB), así que si
 * queda pesada se baja la calidad.
 */
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { DatosReciboImpreso } from "@/lib/asistencia/reciboImpreso";
import DisenoRecibo from "./DisenoRecibo";
import { fuenteRecibo, fuenteTitulo } from "./fuentesRecibo";

/** Margen bajo el límite de 1 MiB de Firestore (el doc tiene otros campos) */
export const LIMITE_IMAGEN = 900_000;

const INTENTOS: { pixelRatio: number; quality: number }[] = [
	{ pixelRatio: 2, quality: 0.88 },
	{ pixelRatio: 2, quality: 0.72 },
	{ pixelRatio: 1.5, quality: 0.72 },
];

export async function capturarRecibo(datos: DatosReciboImpreso): Promise<string> {
	const { toJpeg } = await import("html-to-image");

	const contenedor = document.createElement("div");
	contenedor.style.cssText =
		"position:fixed;left:-10000px;top:0;pointer-events:none;";
	document.body.appendChild(contenedor);
	const root = createRoot(contenedor);

	try {
		flushSync(() => root.render(<DisenoRecibo datos={datos} />));
		const nodo = contenedor.firstElementChild as HTMLElement;

		// Tipografías y logo listos antes de capturar
		await Promise.all([
			document.fonts.load(`400 16px ${fuenteRecibo.style.fontFamily}`),
			document.fonts.load(`700 16px ${fuenteRecibo.style.fontFamily}`),
			document.fonts.load(`400 40px ${fuenteTitulo.style.fontFamily}`),
		]);
		await document.fonts.ready;
		await Promise.all(
			[...nodo.querySelectorAll("img")].map((img) =>
				img.complete ? null : img.decode().catch(() => null),
			),
		);

		for (const intento of INTENTOS) {
			const imagen = await toJpeg(nodo, {
				...intento,
				backgroundColor: "#ffffff",
			});
			if (imagen.length <= LIMITE_IMAGEN) return imagen;
		}
		throw new Error(
			"La imagen del recibo quedó demasiado pesada para guardarla. Avisale a Nicolás.",
		);
	} finally {
		root.unmount();
		contenedor.remove();
	}
}
