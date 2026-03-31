import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "@/lib/firebaseConfig";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { enviarCorreoCuota } from "@/lib/services/emailServices";

const client = new MercadoPagoConfig({
	accessToken: process.env.MP_ACCESS_TOKEN || "",
});

export async function POST(request: Request) {
	try {
		const body = await request.json();
		console.log("🔔 WEBHOOK CUOTA RECIBIDO:", body.action || body.type);

		const paymentId = body?.data?.id;

		if (
			body.type === "payment" ||
			body.action === "payment.created" ||
			body.action === "payment.updated"
		) {
			if (!paymentId) {
				return NextResponse.json({ success: true }, { status: 200 });
			}

			const payment = new Payment(client);
			const paymentInfo = await payment.get({ id: paymentId });

			console.log(`💰 Estado del pago ${paymentId}:`, paymentInfo.status);

			if (paymentInfo.status === "approved") {
				const metadata = paymentInfo.metadata;

				if (!metadata?.cuota_id) {
					console.error("❌ No se encontró cuota_id en metadata.");
					return NextResponse.json({ success: true }, { status: 200 });
				}

				const cuotaRef = doc(db, "Cuotas", metadata.cuota_id);

				await updateDoc(cuotaRef, {
					estado: "Pagado",
					montoPagado: metadata.monto_final,
					fechaPago: new Date().toLocaleDateString("es-AR"),
					metodoPago: "Mercado Pago",
					paymentId: String(paymentId),
					actualizadoEn: serverTimestamp(),
				});

				console.log(
					`✅ CUOTA ${metadata.cuota_id} MARCADA COMO PAGADA — ${metadata.alumno_nombre} | ${metadata.curso_nombre} | Mes ${metadata.mes}/${metadata.anio} | Base: $${metadata.monto_base} | Final: $${metadata.monto_final}`,
				);

				try {
					let emailDestino = "";

					if (metadata.user_id) {
						const userSnap = await getDoc(doc(db, "Users", metadata.user_id));
						if (userSnap.exists() && userSnap.data().email) {
							emailDestino = userSnap.data().email;
						}
					}

					if (emailDestino) {
						await enviarCorreoCuota({
							emailDestino,
							nombreAlumno: metadata.alumno_nombre,
							cursoNombre: metadata.curso_nombre,
							mes: Number(metadata.mes),
							anio: Number(metadata.anio),
							montoAbonado: Number(metadata.monto_final),
							metodoPago: "Mercado Pago",
							nroComprobante: `TXN-${paymentId.toString().slice(-8).toUpperCase()}`,
						});
						console.log(`✉️ Comprobante de cuota enviado a ${emailDestino}`);
					} else {
						console.log(
							`⚠️ No se envió correo: Usuario ${metadata.user_id} no tiene email registrado.`,
						);
					}
				} catch (emailError) {
					console.error("❌ Error al enviar correo de cuota:", emailError);
				}
			}
		}

		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.error("❌ Error en webhook-cuota:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
