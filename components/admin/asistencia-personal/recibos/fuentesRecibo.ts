/**
 * Tipografías de la plantilla del recibo (diseño de Canva de Juan).
 * Solo se usan en el recibo; el panel sigue con Arial (STYLE.md).
 * Next las descarga en el build y las sirve desde el propio sitio.
 */
import { Archivo_Black, League_Spartan } from "next/font/google";

/** "RECIBO" */
export const fuenteTitulo = Archivo_Black({
	weight: "400",
	subsets: ["latin"],
});

/** Todo el resto del recibo */
export const fuenteRecibo = League_Spartan({
	subsets: ["latin"],
});
