import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function proxy(req: NextRequest) {
	const url = req.nextUrl.clone();
	const hostname = req.headers.get("host") || "";

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
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
