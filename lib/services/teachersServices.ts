/**
 * Alta de profesores: crea la cuenta en Firebase Auth, el doc en `Teachers/{uid}`
 * y le manda el mail para que elija su contraseña.
 *
 * Lo usan Configuración → Añadir profesor y Registro de Asistencias → Carga de personal.
 */
import { deleteApp, initializeApp } from "firebase/app";
import {
	createUserWithEmailAndPassword,
	getAuth,
	sendPasswordResetEmail,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { app, db } from "@/lib/firebaseConfig";

export interface NuevoProfesor {
	nombre: string;
	apellido: string;
	email: string;
	dni?: string | null;
	telefono?: string;
	titulo?: string;
}

/** Devuelve el uid del profesor creado. Si el email ya existe, Auth tira `auth/email-already-in-use`. */
export async function crearCuentaProfesor(datos: NuevoProfesor): Promise<string> {
	const email = datos.email.trim();

	// App secundaria para no desloguear al admin actual
	const secondaryApp = initializeApp(app.options, `TeacherCreation_${Date.now()}`);
	const secondaryAuth = getAuth(secondaryApp);

	const randomPassword =
		Math.random().toString(36).slice(-8) +
		Math.random().toString(36).slice(-4).toUpperCase() +
		"@1!";

	let uid: string;
	try {
		const cred = await createUserWithEmailAndPassword(
			secondaryAuth,
			email,
			randomPassword,
		);
		uid = cred.user.uid;
		await secondaryAuth.signOut();
	} finally {
		deleteApp(secondaryApp).catch(() => {});
	}

	await setDoc(doc(db, "Teachers", uid), {
		email,
		nombre: datos.nombre.trim(),
		apellido: datos.apellido.trim(),
		dni: (datos.dni ?? "").replace(/[\s.]/g, ""),
		telefono: (datos.telefono ?? "").trim(),
		titulo: (datos.titulo ?? "").trim(),
		activo: true,
		cursosAsignados: [],
		creadoEn: serverTimestamp(),
	});

	// Mail para que el profe elija su contraseña
	await sendPasswordResetEmail(getAuth(app), email);

	return uid;
}
