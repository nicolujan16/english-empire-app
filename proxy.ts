import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ✅ Solo estos dominios base usan la lógica de subdominios
const SUBDOMAIN_DOMAINS = [
	"englishempire.com.ar",
	"localhost:3000",
	"localhost",
];

export default function proxy(req: NextRequest) {
	const url = req.nextUrl.clone();
	const hostname = req.headers.get("host") || "";
	const protocol = req.nextUrl.protocol;
	const cleanHostname = hostname.replace("www.", "");

	// Obtenemos el dominio base (sin prefijo admin./teachers.)
	const baseDomain = cleanHostname
		.replace(/^admin\./, "")
		.replace(/^teachers\./, "");

	// ✅ Solo aplicamos la lógica de subdominios en dominios habilitados
	const isSubdomainEnabled = SUBDOMAIN_DOMAINS.includes(baseDomain);

	if (isSubdomainEnabled) {
		// ─── 1. CANDADOS DE REDIRECCIÓN ───
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

		// ─── 2. LÓGICA DE REESCRITURA ───
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
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|svg|webp)).*)",
	],
};
