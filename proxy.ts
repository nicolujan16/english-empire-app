// proxy.ts (en la raíz del proyecto, al lado del app/ folder)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function proxy(req: NextRequest) {
	const url = req.nextUrl.clone(); // ✅ clonar para no mutar el original
	const hostname = req.headers.get("host") || "";

	// Soporte para desarrollo local con puerto
	const mainDomain = process.env.NEXT_PUBLIC_DOMAIN || "englishempire.com.ar";

	if (
		hostname === `admin.${mainDomain}` ||
		hostname === "admin.localhost:3000"
	) {
		// Evitar doble prefijo si ya empieza con /admin
		if (!url.pathname.startsWith("/admin")) {
			url.pathname = `/admin${url.pathname}`;
		}
		return NextResponse.rewrite(url);
	}

	if (
		hostname === `teachers.${mainDomain}` ||
		hostname === "teachers.localhost:3000"
	) {
		if (!url.pathname.startsWith("/teachers")) {
			url.pathname = `/teachers${url.pathname}`;
		}
		return NextResponse.rewrite(url);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
