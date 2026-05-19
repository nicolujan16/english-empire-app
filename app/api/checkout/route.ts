import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { MercadoPagoConfig, Preference } from "mercadopago";

const client = new MercadoPagoConfig({
	accessToken: process.env.MP_ACCESS_TOKEN || "FALTA_TOKEN",
});

export async function POST(request: Request) {
	try {
		// ── Verificación de identidad: extraemos el UID del token JWT, nunca del body ──
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return NextResponse.json(
				{ error: "No autorizado. Token faltante." },
				{ status: 401 },
			);
		}
		const idToken = authHeader.split("Bearer ")[1];
		let userId: string;
		try {
			const decodedToken = await adminAuth.verifyIdToken(idToken);
			userId = decodedToken.uid;
		} catch {
			return NextResponse.json(
				{ error: "No autorizado. Token inválido o expirado." },
				{ status: 401 },
			);
		}

		const body = await request.json();
		const { alumnoDni, cursoId, alumnoId } = body;

		if (!alumnoDni || !cursoId) {
			return NextResponse.json(
				{ error: "Faltan datos requeridos." },
				{ status: 400 },
			);
		}

		let fechaNacimientoAlumno = "";
		let nombreAlumno = "";
		let tipoAlumno = "Titular";
		let etiquetasAlumno: string[] = [];

		// --- VALIDACIONES DE NEGOCIO ---
		const userSnap = await adminDb.doc(`Users/${userId}`).get();

		if (!userSnap.exists) {
			return NextResponse.json(
				{ error: "Usuario no encontrado." },
				{ status: 404 },
			);
		}

		const userData = userSnap.data()!;

		if (userData.dni === alumnoDni) {
			fechaNacimientoAlumno = userData.fechaNacimiento;
			nombreAlumno = `${userData.nombre} ${userData.apellido}`;
			etiquetasAlumno = userData.etiquetas || [];
		} else {
			const hijosSnap = await adminDb
				.collection("Hijos")
				.where("tutorId", "==", userId)
				.where("dni", "==", alumnoDni)
				.get();

			if (hijosSnap.empty) {
				return NextResponse.json(
					{
						error:
							"Permiso denegado sobre este DNI. Inicie sesión como el tutor.",
					},
					{ status: 403 },
				);
			}

			const hijoData = hijosSnap.docs[0].data();
			fechaNacimientoAlumno = hijoData.fechaNacimiento;
			nombreAlumno = `${hijoData.nombre} ${hijoData.apellido}`;
			tipoAlumno = "Menor/A cargo";
			etiquetasAlumno = hijoData.etiquetas || [];
		}

		if (!fechaNacimientoAlumno) {
			return NextResponse.json(
				{
					error:
						"El alumno no tiene fecha de nacimiento, consulte en administración.",
				},
				{ status: 400 },
			);
		}

		const cursoSnap = await adminDb.doc(`Cursos/${cursoId}`).get();

		if (!cursoSnap.exists) {
			return NextResponse.json(
				{ error: "El curso solicitado no existe." },
				{ status: 404 },
			);
		}

		const cursoData = cursoSnap.data()!;

		if (cursoData.active === false) {
			return NextResponse.json(
				{ error: "Este curso no se encuentra activo." },
				{ status: 400 },
			);
		}

		// Verificacion de edad
		const [birthYear, birthMonth, birthDay] = fechaNacimientoAlumno
			.split("-")
			.map(Number);
		const today = new Date();
		const currentYear = today.getFullYear();
		const edadCalendario = currentYear - birthYear;

		let edadReal = currentYear - birthYear;
		if (
			today.getMonth() + 1 < birthMonth ||
			(today.getMonth() + 1 === birthMonth && today.getDate() < birthDay)
		) {
			edadReal--;
		}

		const [edadMin, edadMax] = cursoData.edades || [0, 999];

		if (edadCalendario < edadMin || edadReal > edadMax) {
			const mensajeEdad =
				edadMax === 999
					? `de ${edadMin} años en adelante`
					: `de ${edadMin} a ${edadMax} años`;

			return NextResponse.json(
				{
					error: `Edad no permitida. El curso es para alumnos ${mensajeEdad}.`,
				},
				{ status: 400 },
			);
		}

		const inscripcionesSnap = await adminDb
			.collection("Inscripciones")
			.where("alumnoDni", "==", alumnoDni)
			.where("status", "in", ["Confirmado", "Pendiente"])
			.get();

		if (!inscripcionesSnap.empty) {
			const inscripcionExistente = inscripcionesSnap.docs[0].data();
			return NextResponse.json(
				{
					error: `El alumno ya está inscripto en un curso: ${inscripcionExistente.cursoNombre}.`,
				},
				{ status: 400 },
			);
		}

		// LÓGICA DE ETIQUETAS Y DESCUENTOS
		let maxDescuentoPorcentaje = 0;
		let nombreDescuentoAplicado: string | null = null;

		if (etiquetasAlumno.length > 0) {
			const promesasEtiquetas = etiquetasAlumno.map((idEtiqueta) =>
				adminDb.doc(`EtiquetasDescuento/${idEtiqueta}`).get(),
			);

			const snapsEtiquetas = await Promise.all(promesasEtiquetas);

			snapsEtiquetas.forEach((snap) => {
				if (snap.exists) {
					const dataEtiqueta = snap.data()!;
					if (dataEtiqueta.descuentoInscripcion > maxDescuentoPorcentaje) {
						maxDescuentoPorcentaje = dataEtiqueta.descuentoInscripcion;
						nombreDescuentoAplicado = dataEtiqueta.nombre;
					}
				}
			});
		}

		let montoACobrar =
			cursoData.inscripcion > 0 ? cursoData.inscripcion : cursoData.cuota;

		if (maxDescuentoPorcentaje > 0) {
			const descuentoEnPesos = montoACobrar * (maxDescuentoPorcentaje / 100);
			montoACobrar = montoACobrar - descuentoEnPesos;
			montoACobrar = Math.round(montoACobrar);
		}

		// CREACIÓN DE LA PREFERENCIA EN MERCADO PAGO
		const itemTitle =
			maxDescuentoPorcentaje > 0
				? `Inscripción: ${cursoData.nombre} (Desc. ${maxDescuentoPorcentaje}%)`
				: `Inscripción: ${cursoData.nombre}`;

		const preference = new Preference(client);

		const result = await preference.create({
			body: {
				items: [
					{
						id: cursoId,
						title: itemTitle,
						description: `Inscripción de ${nombreAlumno} al curso ${cursoData.nombre}`,
						quantity: 1,
						unit_price: Number(montoACobrar),
						currency_id: "ARS",
					},
				],
				back_urls: {
					success: `${process.env.NEXT_PUBLIC_APP_URL}?pago=exitoso`,
					failure: `${process.env.NEXT_PUBLIC_APP_URL}?pago=fallido`,
					pending: `${process.env.NEXT_PUBLIC_APP_URL}?pago=pendiente`,
				},
				auto_return: "approved",
				metadata: {
					user_id: userId,
					alumno_dni: alumnoDni,
					alumno_id: alumnoId,
					alumno_nombre: nombreAlumno,
					curso_id: cursoId,
					curso_nombre: cursoData.nombre,
					tipo_alumno: tipoAlumno,
					descuento_aplicado: nombreDescuentoAplicado,
					descuento_porcentaje: maxDescuentoPorcentaje,
				},
				notification_url: `${process.env.WEBHOOK_URL}/api/webhook`,
			},
		});

		return NextResponse.json({
			success: true,
			init_point: result.init_point,
		});
	} catch (error: unknown) {
		if (error instanceof Error) {
			console.error("Error crítico en /api/checkout:", error.message);
		} else {
			console.error("Error crítico desconocido en /api/checkout:", error);
		}
		return NextResponse.json(
			{ error: "Error interno del servidor al procesar la solicitud." },
			{ status: 500 },
		);
	}
}
