import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { db } from "@/lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import {
	type Cuota,
	calcularPrecioBase,
	aplicarDescuentos,
} from "@/lib/cuotas";

const client = new MercadoPagoConfig({
	accessToken: process.env.MP_ACCESS_TOKEN || "",
});

const MESES = [
	"Enero",
	"Febrero",
	"Marzo",
	"Abril",
	"Mayo",
	"Junio",
	"Julio",
	"Agosto",
	"Septiembre",
	"Octubre",
	"Noviembre",
	"Diciembre",
];

export async function POST(request: Request) {
	try {
		const { cuotaId } = await request.json();

		if (!cuotaId) {
			return NextResponse.json(
				{ error: "Falta el ID de la cuota." },
				{ status: 400 },
			);
		}

		// Buscar la cuota en Firestore
		const cuotaSnap = await getDoc(doc(db, "Cuotas", cuotaId));

		if (!cuotaSnap.exists()) {
			return NextResponse.json(
				{ error: "La cuota no existe." },
				{ status: 404 },
			);
		}

		const cuotaData = { id: cuotaSnap.id, ...cuotaSnap.data() } as Cuota;

		if (cuotaData.estado === "Pagado") {
			return NextResponse.json(
				{ error: "Esta cuota ya fue pagada." },
				{ status: 400 },
			);
		}

		// ── Cálculo del monto con descuentos acumulables ──────────────────────
		// 1. Precio base según fecha (cuota1a10 / cuota11enAdelante / montoPrimerMes)
		const precioBase = calcularPrecioBase(cuotaData);
		// 2. Aplicar todos los descuentos del array sobre el precio base

		const mejorDescuento = cuotaData.descuentos?.length
			? cuotaData.descuentos.reduce((max, d) =>
					d.porcentaje > max.porcentaje ? d : max,
				)
			: null;

		const descuentosAAplicar = mejorDescuento ? [mejorDescuento] : [];

		const montoFinal = aplicarDescuentos(precioBase, descuentosAAplicar);
		// ─────────────────────────────────────────────────────────────────────

		const mesNombre = MESES[cuotaData.mes - 1];

		const preference = new Preference(client);
		const result = await preference.create({
			body: {
				items: [
					{
						id: cuotaId,
						title: `Cuota ${mesNombre} ${cuotaData.anio} — ${cuotaData.cursoNombre}`,
						description: `Cuota de ${cuotaData.alumnoNombre} — ${cuotaData.cursoNombre}`,
						quantity: 1,
						unit_price: montoFinal,
						currency_id: "ARS",
					},
				],
				back_urls: {
					success: `${process.env.NEXT_PUBLIC_APP_URL}/mi-cuenta/cuotas?pago=exitoso`,
					failure: `${process.env.NEXT_PUBLIC_APP_URL}/mi-cuenta/cuotas?pago=fallido`,
					pending: `${process.env.NEXT_PUBLIC_APP_URL}/mi-cuenta/cuotas?pago=pendiente`,
				},
				auto_return: "approved",
				metadata: {
					cuota_id: cuotaId,
					alumno_id: cuotaData.alumnoId,
					alumno_nombre: cuotaData.alumnoNombre,
					curso_id: cuotaData.cursoId,
					curso_nombre: cuotaData.cursoNombre,
					mes: cuotaData.mes,
					anio: cuotaData.anio,
					monto_base: precioBase,
					monto_final: montoFinal,
					descuento_aplicado: mejorDescuento ?? null,
				},
				notification_url: `${process.env.WEBHOOK_URL}/api/webhook-cuota`,
			},
		});

		return NextResponse.json({ success: true, init_point: result.init_point });
	} catch (error) {
		console.error("Error en /api/pagar-cuota:", error);
		return NextResponse.json(
			{ error: "Error interno del servidor." },
			{ status: 500 },
		);
	}
}
