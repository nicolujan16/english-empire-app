"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
	LogIn,
	Loader2,
	AlertCircle,
	LogOut,
	Users,
	CalendarClock,
	ChevronRight,
	BookOpen,
	Eye,
	EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Firebase Imports
import {
	signInWithEmailAndPassword,
	signOut,
	onAuthStateChanged,
	User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseConfig";
import Link from "next/link";

interface TeacherData {
	id: string;
	nombre: string;
	apellido: string;
	email: string;
}

interface CursoAsignado {
	id: string;
	nombre: string;
	horario: string;
}

export default function ProfesoresPage() {
	const [currentUser, setCurrentUser] = useState<User | null>(null);
	const [teacherData, setTeacherData] = useState<TeacherData | null>(null);

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");

	const [isAuthLoading, setIsAuthLoading] = useState(true);
	const [isActionLoading, setIsActionLoading] = useState(false);

	const [cursos, setCursos] = useState<CursoAsignado[]>([]);

	// ─── 1. CREAR FUNCION PARA TRAER CURSOS DEL PROFESOR ───────────────────────────
	// 🚀 NUEVA LÓGICA: Recibimos el array de IDs directamente desde el documento del profesor
	const fetchCursosDelProfe = async (cursosIds: string[]) => {
		if (!cursosIds || cursosIds.length === 0) {
			setCursos([]);
			return;
		}

		try {
			// 🚀 Buscamos solo los cursos exactos que están en el array
			const promesas = cursosIds.map((id) => getDoc(doc(db, "Cursos", id)));
			const snaps = await Promise.all(promesas);

			const cursosList: CursoAsignado[] = [];

			snaps.forEach((d) => {
				// Solo mostramos el curso si existe y sigue activo
				if (d.exists() && d.data().active !== false) {
					const data = d.data();
					let horarioFinal = "Horario a definir";

					if (data.horarios) {
						if (typeof data.horarios === "string") {
							horarioFinal = data.horarios;
						} else if (Array.isArray(data.horarios)) {
							horarioFinal = data.horarios.join(" - ");
						} else if (typeof data.horarios === "object") {
							horarioFinal =
								Object.keys(data.horarios).join(" - ") || "Horario a definir";
						}
					}

					cursosList.push({
						id: d.id,
						nombre: data.nombre,
						horario: horarioFinal,
					});
				}
			});

			// Ordenamos alfabéticamente para que se vea prolijo
			cursosList.sort((a, b) => a.nombre.localeCompare(b.nombre));

			setCursos(cursosList);
		} catch (err) {
			console.error("Error trayendo cursos:", err);
		}
	};

	// ─── 2. ESCUCHAR ESTADO DE AUTENTICACIÓN ─────────────────────────────────
	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, async (user) => {
			if (user) {
				try {
					const docRef = doc(db, "Teachers", user.uid);
					const docSnap = await getDoc(docRef);

					if (docSnap.exists() && docSnap.data().activo !== false) {
						setCurrentUser(user);
						const data = docSnap.data();

						setTeacherData({
							id: docSnap.id,
							nombre: data.nombre,
							apellido: data.apellido,
							email: data.email,
						});

						// 🚀 Extraemos el array de cursosAsignados y se lo pasamos a la función
						const cursosAsignados = data.cursosAsignados || [];
						fetchCursosDelProfe(cursosAsignados);
					} else {
						await signOut(auth);
						setError("Acceso denegado. No tienes permisos de docente.");
					}
				} catch (err) {
					console.error("Error verificando rol:", err);
					setError("Error de conexión al verificar permisos.");
				}
			} else {
				setCurrentUser(null);
				setTeacherData(null);
			}
			setIsAuthLoading(false);
		});

		return () => unsubscribe();
	}, []);

	// ─── 3. MANEJO DE LOGIN / LOGOUT ──────────────────────────────────────────
	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setIsActionLoading(true);

		try {
			await signInWithEmailAndPassword(auth, email, password);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: any) {
			console.error(err);
			setError("Credenciales incorrectas o usuario no encontrado.");
			setIsActionLoading(false);
		}
	};

	const handleLogout = async () => {
		setIsActionLoading(true);
		await signOut(auth);
		setIsActionLoading(false);
	};

	// ─── RENDER: PANTALLA DE CARGA ───────────────────────────────────────────
	if (isAuthLoading) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
				<Loader2 className="w-10 h-10 animate-spin text-[#4338ca] mb-4" />
				<p className="text-gray-500 font-medium animate-pulse">
					Verificando credenciales...
				</p>
			</div>
		);
	}

	// ─── RENDER: PANTALLA DE LOGIN ───────────────────────────────────────────
	if (!currentUser || !teacherData) {
		return (
			<div className="flex-1 flex items-center justify-center min-h-[70vh]">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-gray-100"
				>
					<div className="text-center mb-8">
						<div className="w-14 h-14 bg-indigo-50 text-[#4338ca] rounded-2xl flex items-center justify-center mx-auto mb-4">
							<LogIn className="w-7 h-7" />
						</div>
						<h2 className="text-2xl font-bold text-gray-900">
							Bienvenido/a Docente
						</h2>
						<p className="text-sm text-gray-500 mt-2">
							Ingresá tus credenciales para acceder a tus cursos y tomar
							asistencia.
						</p>
					</div>

					{error && (
						<div className="mb-6 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2 text-sm">
							<AlertCircle className="w-4 h-4 shrink-0" />
							<p>{error}</p>
						</div>
					)}

					<form onSubmit={handleLogin} className="space-y-5">
						<div>
							<label className="block text-sm font-bold text-gray-700 mb-1.5">
								Correo Electrónico
							</label>
							<input
								type="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#4338ca]/20 focus:border-[#4338ca] outline-none transition-all"
								placeholder="tu@email.com"
							/>
						</div>
						<div>
							<label className="block text-sm font-bold text-gray-700 mb-1.5">
								Contraseña
							</label>
							<div className="relative">
								<input
									type={showPassword ? "text" : "password"}
									required
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#4338ca]/20 focus:border-[#4338ca] outline-none transition-all"
									placeholder="••••••••"
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#4338ca] transition-colors p-1"
								>
									{showPassword ? (
										<EyeOff className="w-5 h-5" />
									) : (
										<Eye className="w-5 h-5" />
									)}
								</button>
							</div>
						</div>

						<Button
							type="submit"
							disabled={isActionLoading}
							className="w-full bg-[#4338ca] hover:bg-[#3730a3] text-white py-6 rounded-xl text-md font-bold shadow-lg shadow-indigo-200 transition-all mt-2"
						>
							{isActionLoading ? (
								<Loader2 className="w-5 h-5 animate-spin" />
							) : (
								"Ingresar al Portal"
							)}
						</Button>
					</form>
				</motion.div>
			</div>
		);
	}

	// ─── RENDER: DASHBOARD DEL PROFESOR (Mis Cursos) ─────────────────────────
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="space-y-8"
		>
			{/* Bienvenida y Logout */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
				<div>
					<h2 className="text-2xl font-black text-gray-900">
						¡Hello, teacher {teacherData.nombre}! 👋
					</h2>
					<p className="text-gray-500 text-sm mt-1">
						Este es tu espacio de gestión académica.
					</p>
				</div>
				<Button
					variant="outline"
					onClick={handleLogout}
					disabled={isActionLoading}
					className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 rounded-xl"
				>
					<LogOut className="w-4 h-4 mr-2" /> Cerrar Sesión
				</Button>
			</div>

			{/* Grilla de Cursos */}
			<div>
				<h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
					<Users className="w-5 h-5 text-[#4338ca]" /> Mis Cursos Asignados
				</h3>

				{cursos.length === 0 ? (
					<div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
						<p className="text-gray-500 font-medium">
							Aún no tienes cursos asignados a tu perfil.
						</p>
						<p className="text-sm text-gray-400 mt-1">
							Contactá con administración si creés que es un error.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
						{cursos.map((curso, idx) => (
							<motion.div
								key={curso.id}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: idx * 0.1 }}
								className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col h-full group"
							>
								<div className="flex-1">
									<div className="w-10 h-10 bg-indigo-50 text-[#4338ca] rounded-xl flex items-center justify-center mb-4">
										<BookOpen className="w-5 h-5" />
									</div>
									<h4 className="font-bold text-gray-900 text-lg leading-tight mb-2">
										{curso.nombre}
									</h4>
									<p className="flex items-center gap-1.5 text-sm text-gray-500">
										<CalendarClock className="w-4 h-4" /> {curso.horario}
									</p>
								</div>

								<Link href={`/teachers/curso/${curso.id}`}>
									<div className="mt-6 pt-4 border-t border-gray-50 cursor-pointer">
										<Button className=" cursor-pointer w-full bg-indigo-50 hover:bg-[#4338ca] text-[#4338ca] hover:text-white border-none shadow-none group-hover:bg-[#4338ca] group-hover:text-white transition-all">
											Gestionar Asistencia{" "}
											<ChevronRight className="w-4 h-4 ml-1" />
										</Button>
									</div>
								</Link>
							</motion.div>
						))}
					</div>
				)}
			</div>
		</motion.div>
	);
}
