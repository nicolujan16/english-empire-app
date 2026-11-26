/**
 * Alta de secretarias: crea la cuenta en Firebase Auth, el doc en `Admins/{uid}` con
 * `rol: "secretario"` y le manda el mail para que elija su contraseña.
 *
 * Lo usa Registro de Asistencias → Carga de personal (es el mismo alta que
 * Configuración → Agregar personal, con el rol de secretario).
 */
import { deleteApp, initializeApp } from "firebase/app";
import {
	createUserWithEmailAndPassword,
	getAuth,
	sendPasswordResetEmail,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { app, db } from "@/lib/firebaseConfig";

export interface NuevaSecretaria {
	nombre: string;
	apellido: string;
	email: string;
}

/** Devuelve el uid de la cuenta creada. Si el email ya existe, Auth tira `auth/email-already-in-use`. */
export async function crearCuentaSecretario(datos: NuevaSecretaria): Promise<string> {
	const email = datos.email.trim();

	// App secundaria para no desloguear al director
	const secondaryApp = initializeApp(app.options, `SecretarioCreation_${Date.now()}`);
	const secondaryAuth = getAuth(secondaryApp);

	const randomPassword =
		Math.random().toString(36).slice(-8) +
		Math.random().toString(36).slice(-4).toUpperCase() +
		"@1!";

	let uid: string;
	try {
		const cred = await createUserWithEmailAndPassword(secondaryAuth, email, randomPassword);
		uid = cred.user.uid;
		await secondaryAuth.signOut();
	} finally {
		deleteApp(secondaryApp).catch(() => {});
	}

	await setDoc(doc(db, "Admins", uid), {
		email,
		nombre: `${datos.nombre.trim()} ${datos.apellido.trim()}`,
		rol: "secretario",
		creadoEn: serverTimestamp(),
	});

	// Mail para que elija su contraseña
	await sendPasswordResetEmail(getAuth(app), email);

	return uid;
}
