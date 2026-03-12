"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
	onAuthStateChanged,
	User,
	signInWithEmailAndPassword,
	signOut,
	browserLocalPersistence,
	browserSessionPersistence,
	setPersistence,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseConfig";

export interface AdminData {
	email: string;
	rol: string;
	nombre: string;
}

interface AdminAuthContextType {
	adminUser: User | null;
	adminData: AdminData | null;
	isLoading: boolean;
	loginAdmin: (
		email: string,
		pass: string,
		rememberMe: boolean,
	) => Promise<void>;
	logoutAdmin: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType>(
	{} as AdminAuthContextType,
);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
	const [adminUser, setAdminUser] = useState<User | null>(null);
	const [adminData, setAdminData] = useState<AdminData | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
			if (currentUser) {
				const adminDocRef = doc(db, "Admins", currentUser.uid);
				const adminDocSnap = await getDoc(adminDocRef);

				if (adminDocSnap.exists()) {
					setAdminUser(currentUser);
					setAdminData(adminDocSnap.data() as AdminData);
				} else {
					setAdminUser(null);
					setAdminData(null);
				}
			} else {
				setAdminUser(null);
				setAdminData(null);
			}
			setIsLoading(false);
		});

		return () => unsubscribe();
	}, []);

	const loginAdmin = async (
		email: string,
		pass: string,
		rememberMe: boolean,
	) => {
		console.log("INICIAR SESION");
		const persistenceType = rememberMe
			? browserLocalPersistence
			: browserSessionPersistence;
		await setPersistence(auth, persistenceType);

		await signInWithEmailAndPassword(auth, email, pass);
	};

	const logoutAdmin = async () => {
		await signOut(auth);
	};

	return (
		<AdminAuthContext.Provider
			value={{ adminUser, adminData, isLoading, loginAdmin, logoutAdmin }}
		>
			{children}
		</AdminAuthContext.Provider>
	);
}

// Hook personalizado para usar este contexto fácilmente
export const useAdminAuth = () => useContext(AdminAuthContext);
