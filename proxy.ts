import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function proxy(req: NextRequest) {
	const url = req.nextUrl.clone();
	const hostname = req.headers.get("host") || "";
	const protocol = req.nextUrl.protocol; // Atrapa http (localhost) o https (producción)
	const cleanHostname = hostname.replace("www.", ""); // Limpiamos el www. por las dudas

	// ─── 1. CANDADOS DE REDIRECCIÓN (Protección del dominio principal) ───

	if (
		!hostname.startsWith("admin.") &&
		(url.pathname.startsWith("/admin") ||
			url.pathname.startsWith("/admin-login"))
	) {
		const targetPath = url.pathname === "/admin" ? "/" : url.pathname;
		const newUrl = new URL(
			`${protocol}//admin.${cleanHostname}${targetPath}${url.search}`,
		);
		return NextResponse.redirect(newUrl);
	}

	if (
		!hostname.startsWith("teachers.") &&
		url.pathname.startsWith("/teachers")
	) {
		const targetPath = url.pathname === "/teachers" ? "/" : url.pathname;
		const newUrl = new URL(
			`${protocol}//teachers.${cleanHostname}${targetPath}${url.search}`,
		);
		return NextResponse.redirect(newUrl);
	}

	// ─── 2. LÓGICA DE REESCRITURA (Lo que ya tenías) ───

	if (url.pathname.includes(".")) {
		return NextResponse.next();
	}

	if (hostname.startsWith("admin.")) {
		if (!url.pathname.startsWith("/admin")) {
			url.pathname = `/admin${url.pathname}`;
		}
		return NextResponse.rewrite(url);
	}

	if (hostname.startsWith("teachers.")) {
		if (!url.pathname.startsWith("/teachers")) {
			url.pathname = `/teachers${url.pathname}`;
		}
		return NextResponse.rewrite(url);
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|svg|webp)).*)",
	],
};
