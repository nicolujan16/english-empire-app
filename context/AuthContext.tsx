"use client";

import {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from "react";

import {
	getAuth,
	onAuthStateChanged,
	User,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signOut,
	sendPasswordResetEmail,
	setPersistence,
	browserLocalPersistence,
	browserSessionPersistence,
} from "firebase/auth";

import {
	doc,
	setDoc,
	onSnapshot,
	collection,
	query,
	where,
} from "firebase/firestore";

import { app, db } from "@/lib/firebaseConfig";
import { AuthContextType, UserFirestoreData, StudentDetails } from "@/types";

const AuthContext = createContext<AuthContextType>({
	user: null,
	isLoading: true,
	userData: null,
	login: async () => {
		throw new Error("Context no inicializado");
	},
	register: async () => {
		throw new Error("Context no inicializado");
	},
	logout: async () => {},
	resetPassword: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [userData, setUserData] = useState<UserFirestoreData | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);

	const auth = getAuth(app);

	useEffect(() => {
		let unsubscribeUserSnapshot: () => void;
		let unsubscribeHijosSnapshot: (() => void) | null = null;

		const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
			if (firebaseUser) {
				setUser(firebaseUser);

				const docRef = doc(db, "Users", firebaseUser.uid);

				unsubscribeUserSnapshot = onSnapshot(
					docRef,
					(docSnap) => {
						if (docSnap.exists()) {
							const baseUserData = docSnap.data() as UserFirestoreData;

							if (!baseUserData.isTutor) {
								setUserData({ ...baseUserData, hijos: [] });
								setIsLoading(false);
							} else {
								if (unsubscribeHijosSnapshot) unsubscribeHijosSnapshot();

								const hijosRef = collection(db, "Hijos");
								// Buscamos todos los hijos cuyo 'tutorId' coincida con el usuario actual
								const q = query(
									hijosRef,
									where("tutorId", "==", firebaseUser.uid),
								);

								unsubscribeHijosSnapshot = onSnapshot(q, (querySnapshot) => {
									const listaHijos: StudentDetails[] = [];

									querySnapshot.forEach((hijoDoc) => {
										listaHijos.push({
											id: hijoDoc.id,
											...hijoDoc.data(),
										} as StudentDetails);
									});

									setUserData({
										...baseUserData,
										hijos: listaHijos,
									});

									setIsLoading(false);
								});
							}
						} else {
							console.warn(
								"El usuario está en Auth pero no tiene documento en Firestore.",
							);
							setUserData(null);
							setIsLoading(false);
						}
					},
					(error) => {
						console.error("Error al escuchar los datos de Firestore:", error);
						setUserData(null);
						setIsLoading(false);
					},
				);
			} else {
				setUser(null);
				setUserData(null);
				setIsLoading(false);

				if (unsubscribeUserSnapshot) unsubscribeUserSnapshot();
				if (unsubscribeHijosSnapshot) unsubscribeHijosSnapshot();
			}
		});

		return () => {
			unsubscribeAuth();
			if (unsubscribeUserSnapshot) unsubscribeUserSnapshot();
			if (unsubscribeHijosSnapshot) unsubscribeHijosSnapshot();
		};
	}, [auth]);

	// --------- FUNCIONES AUTH ------------

	const login = async ({
		email,
		pass,
		rememberMe,
	}: {
		email: string;
		pass: string;
		rememberMe: boolean;
	}) => {
		const persistenceType = rememberMe
			? browserLocalPersistence
			: browserSessionPersistence;
		await setPersistence(auth, persistenceType);
		return signInWithEmailAndPassword(auth, email, pass);
	};

	const register = async ({
		email,
		pass,
		userData,
	}: {
		email: string;
		pass: string;
		userData: UserFirestoreData;
	}) => {
		const userCredential = await createUserWithEmailAndPassword(
			auth,
			email,
			pass,
		);

		await setDoc(doc(db, "Users", userCredential.user.uid), {
			...userData,
			email: email,
			rol: "alumno",
			fechaRegistro: new Date(),
		});

		return userCredential;
	};

	const logout = async () => {
		await signOut(auth);
	};

	const resetPassword = (email: string) => {
		return sendPasswordResetEmail(auth, email);
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				isLoading,
				userData,
				login,
				register,
				logout,
				resetPassword,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export const useAuth = () => useContext(AuthContext);
