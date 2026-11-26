/**
 * GET /api/asistencia/escritorio/config — configuración pública que necesita la
 * aplicación de escritorio para iniciar sesión con Firebase Auth (la misma clave
 * web que ya usa el navegador: es pública por diseño). Así la aplicación solo
 * necesita saber la dirección de la web.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
	return NextResponse.json({
		ok: true,
		firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
		proyecto: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
	});
}
