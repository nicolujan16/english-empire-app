import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseConfig";
import {
	collection,
	query,
	where,
	getDocs,
	doc,
	getDoc,
} from "firebase/firestore";

// 1. IMPORTAMOS MERCADO PAGO
import { MercadoPagoConfig, Preference } from "mercadopago";

// 2. INICIALIZAMOS EL CLIENTE CON TU TOKEN
// Asegurate de tener MP_ACCESS_TOKEN en tu archivo .env.local
const client = new MercadoPagoConfig({
	accessToken: process.env.MP_ACCESS_TOKEN || "FALTA_TOKEN",
});

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { userId, alumnoDni, cursoId } = body;

		if (!userId || !alumnoDni || !cursoId) {
			return NextResponse.json(
				{ error: "Faltan datos requeridos." },
				{ status: 400 },
			);
		}

		let fechaNacimientoAlumno = "";
		let nombreAlumno = "";
		let tipoAlumno = "Titular"; // Para guardarlo luego en la BD

		// --- VALIDACIONES DE NEGOCIO (Igual que antes) ---
		const userRef = doc(db, "Users", userId);
		const userSnap = await getDoc(userRef);

		if (!userSnap.exists()) {
			return NextResponse.json(
				{ error: "Usuario no encontrado." },
				{ status: 404 },
			);
		}

		const userData = userSnap.data();

		if (userData.dni === alumnoDni) {
			fechaNacimientoAlumno = userData.fechaNacimiento;
			nombreAlumno = `${userData.nombre} ${userData.apellido}`;
		} else {
			const hijosRef = collection(db, "Hijos");
			const qHijos = query(
				hijosRef,
				where("tutorId", "==", userId),
				where("dni", "==", alumnoDni),
			);
			const hijosSnap = await getDocs(qHijos);

			if (hijosSnap.empty) {
				return NextResponse.json(
					{ error: "Permiso denegado sobre este DNI." },
					{ status: 403 },
				);
			}
			const hijoData = hijosSnap.docs[0].data();
			fechaNacimientoAlumno = hijoData.fechaNacimiento;
			nombreAlumno = `${hijoData.nombre} ${hijoData.apellido}`;
			tipoAlumno = "Menor/A cargo";
		}

		if (!fechaNacimientoAlumno) {
			return NextResponse.json(
				{ error: "El alumno no tiene fecha de nacimiento." },
				{ status: 400 },
			);
		}

		const cursoRef = doc(db, "Cursos", cursoId);
		const cursoSnap = await getDoc(cursoRef);

		if (!cursoSnap.exists()) {
			return NextResponse.json(
				{ error: "El curso solicitado no existe." },
				{ status: 404 },
			);
		}

		const cursoData = cursoSnap.data();

		if (cursoData.active === false) {
			return NextResponse.json(
				{ error: "Este curso no se encuentra activo." },
				{ status: 400 },
			);
		}

		// Verificacion de edad:
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

		const [edadMin, edadMax] = cursoData.edades || [0, 99];

		if (edadCalendario < edadMin || edadReal > edadMax) {
			return NextResponse.json(
				{
					error: `Edad no permitida. El curso es para alumnos de ${edadMin} a ${edadMax} años.`,
				},
				{ status: 400 },
			);
		}

		const inscripcionesRef = collection(db, "Inscripciones");
		const qInscripciones = query(
			inscripcionesRef,
			where("alumnoDni", "==", alumnoDni),
			where("status", "in", ["Confirmado", "Pendiente"]),
		);

		const inscripcionesSnap = await getDocs(qInscripciones);

		if (!inscripcionesSnap.empty) {
			const inscripcionExistente = inscripcionesSnap.docs[0].data();
			return NextResponse.json(
				{
					error: `El alumno ya está inscripto en un curso: ${inscripcionExistente.cursoNombre}.`,
				},
				{ status: 400 },
			);
		}

		// ====================================================================
		// ✅ CREACIÓN DE LA PREFERENCIA EN MERCADO PAGO
		// ====================================================================

		const montoACobrar =
			cursoData.inscripcion > 0 ? cursoData.inscripcion : cursoData.cuota;

		const preference = new Preference(client);

		const result = await preference.create({
			body: {
				items: [
					{
						id: cursoId,
						title: `Inscripción: ${cursoData.nombre}`,
						description: `Inscripción de ${nombreAlumno} al curso ${cursoData.nombre}`,
						quantity: 1,
						unit_price: Number(montoACobrar),
						currency_id: "ARS",
					},
				],
				back_urls: {
					success: "https://englishempire.com.ar?pago=exitoso",
					failure: "https://englishempire.com.ar?pago=fallido",
					pending: "https://englishempire.com.ar?pago=pendiente",
				},
				auto_return: "approved",

				// La metadata sigue intacta para que nuestro Webhook la lea después
				metadata: {
					user_id: userId,
					alumno_dni: alumnoDni,
					alumno_nombre: nombreAlumno,
					curso_id: cursoId,
					curso_nombre: cursoData.nombre,
					tipo_alumno: tipoAlumno,
				},
				notification_url: "https://w4w8vc0r-3000.brs.devtunnels.ms/api/webhook",
			},
		});

		// Devolvemos el link que nos dio MP
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
