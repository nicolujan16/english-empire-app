import { NextRequest, NextResponse } from "next/server";

const CF_URL = process.env.CLOUD_FUNCTION_CUOTAS_URL!;

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const mes = searchParams.get("mes");
	const anio = searchParams.get("anio");

	try {
		await fetch(`${CF_URL}?mes=${mes}&anio=${anio}`);
		return NextResponse.json({ ok: true });
	} catch (error) {
		return NextResponse.json(
			{ ok: false, error: String(error) },
			{ status: 500 },
		);
	}
}
