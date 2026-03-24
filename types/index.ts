import { User, UserCredential } from "firebase/auth";
import { Timestamp } from "firebase/firestore";

// CURSOS

export interface CursoObject {
	imgURL: string;
	id: string;
	nombre: string;
	descripcion: string[];
	duracion: string;
	clasesSemanales: number;
	inscripcion: number;
	cuota1a10: number;
	cuota11enAdelante: number;
	inicio: string;
	fin: string;
	categoria: string;
	horarios: Horario[];
}

export interface Horario {
	dia: string;
	hora: string;
}

// AUTH

export interface CursoInscripto {
	courseId: string;
	nombreCurso: string;
	fechaInicio: string;
	cuotasPagadas: number;
	totalCuotas: number;
	estado?: "activo" | "pendiente" | "cancelado";
}

export interface UserFirestoreData {
	nombre: string;
	apellido: string;
	dni: string;
	fechaNacimiento: string;
	edadTitular: number | string;
	isTutor: boolean;
	etiquetas?: string[];
	hijos: StudentDetails[];
	cuotasPagadas?: Record<string, string[]>;
	cursos: string[];
	email?: string;
	rol?: string;
	fechaRegistro?: Date | Timestamp | string;
	telefono?: string | number;
}

export interface AuthContextType {
	user: User | null;
	isLoading: boolean;
	userData: UserFirestoreData | null;
	login: ({
		email,
		pass,
		rememberMe,
	}: {
		email: string;
		pass: string;
		rememberMe: boolean;
	}) => Promise<UserCredential>;
	register: ({
		email,
		pass,
		userData,
	}: {
		email: string;
		pass: string;
		userData: UserFirestoreData;
	}) => Promise<UserCredential>;
	logout: () => Promise<void>;
	resetPassword: (email: string) => Promise<void>;
}

export interface StudentDetails {
	id?: string | number;
	nombre: string;
	apellido: string;
	dni: string;
	fechaNacimiento: string;
	cursos: string[];
}
