"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
	Lock,
	CreditCard,
	Banknote,
	ShieldCheck,
	Loader2,
	AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PaymentModal from "@/components/portal/PaymentModal";
import { useAuth } from "@/context/AuthContext";
import {
	doc,
	getDoc,
	collection,
	query,
	where,
	getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

function CheckoutContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { userData, user, isLoading: authLoading } = useAuth();

	const [isProcessing, setIsProcessing] = useState(false);
	const [modalMessage, setModalMessage] = useState("");

	const [errorState, setErrorState] = useState({
		show: false,
		message: "",
	});

	const cursoId = searchParams.get("curso");
	const alumnoDni = searchParams.get("alumnoDNI");

	const [courseInfo, setCourseInfo] = useState({
		name: "Cargando curso...",
		price: 0,
		isLoading: true,
	});

	const [studentInfo, setStudentInfo] = useState({
		name: "Validando estudiante...",
		dni: "---",
		isLoading: true,
	});

	useEffect(() => {
		if (!authLoading && !user) {
			router.push("/iniciar-sesion?redirect=/checkout");
		}
	}, [user, authLoading, router]);

	useEffect(() => {
		const fetchCourse = async () => {
			if (!cursoId) {
				setErrorState({
					show: true,
					message:
						"Falta información del curso. Por favor, selecciona un curso válido.",
				});
				setCourseInfo((prev) => ({ ...prev, isLoading: false }));
				return;
			}

			try {
				const docRef = doc(db, "Cursos", cursoId);
				const docSnap = await getDoc(docRef);

				if (docSnap.exists()) {
					const data = docSnap.data();
					setCourseInfo({
						name: data.nombre || "Curso sin nombre",
						price: data.inscripcion,
						isLoading: false,
					});
				} else {
					setErrorState({
						show: true,
						message: "El curso seleccionado no existe o ya no está disponible.",
					});
					setCourseInfo((prev) => ({ ...prev, isLoading: false }));
				}
			} catch (error) {
				console.error("Error al obtener el curso:", error);
				setErrorState({
					show: true,
					message: "Hubo un problema de conexión al verificar el curso.",
				});
				setCourseInfo((prev) => ({ ...prev, isLoading: false }));
			}
		};

		fetchCourse();
	}, [cursoId]);

	useEffect(() => {
		const validateStudent = async () => {
			if (authLoading || !user || !userData) return;

			if (!alumnoDni) {
				setErrorState({
					show: true,
					message: "Falta el DNI del alumno a inscribir.",
				});
				// Apagamos el loading
				setStudentInfo((prev) => ({ ...prev, isLoading: false }));
				return;
			}

			try {
				if (alumnoDni === userData.dni) {
					setStudentInfo({
						name: `${userData.nombre} ${userData.apellido}`,
						dni: userData.dni,
						isLoading: false,
					});
					return;
				}

				const hijosRef = collection(db, "Hijos");
				const qHijo = query(hijosRef, where("dni", "==", alumnoDni));
				const hijoSnapshot = await getDocs(qHijo);

				if (!hijoSnapshot.empty) {
					const hijoData = hijoSnapshot.docs[0].data();

					if (hijoData.tutorId !== user.uid) {
						setErrorState({
							show: true,
							message:
								"Acceso denegado: El alumno seleccionado no está asociado a tu cuenta.",
						});
						setStudentInfo((prev) => ({ ...prev, isLoading: false }));
						return;
					}

					setStudentInfo({
						name: `${hijoData.nombre} ${hijoData.apellido}`,
						dni: hijoData.dni,
						isLoading: false,
					});
					return;
				}

				const usersRef = collection(db, "Users");
				const qUser = query(usersRef, where("dni", "==", alumnoDni));
				const userSnapshot = await getDocs(qUser);

				if (!userSnapshot.empty) {
					setErrorState({
						show: true,
						message:
							"El alumno ingresado es un titular. Debe iniciar sesión con su propia cuenta para abonar.",
					});
					setStudentInfo((prev) => ({ ...prev, isLoading: false }));
					return;
				}

				setErrorState({
					show: true,
					message: "No se encontró ningún alumno registrado con ese DNI.",
				});
				setStudentInfo((prev) => ({ ...prev, isLoading: false }));
			} catch (error) {
				console.error("Error al validar estudiante:", error);
				setErrorState({
					show: true,
					message: "Hubo un error al verificar los datos del alumno.",
				});
				setStudentInfo((prev) => ({ ...prev, isLoading: false }));
			}
		};

		validateStudent();
	}, [alumnoDni, user, userData, authLoading]);

	const handlePayment = async () => {
		if (courseInfo.price === 0 || !user || !cursoId || !alumnoDni) return;

		setIsProcessing(true);
		setModalMessage("Validando inscripción y preparando pago...");

		try {
			const response = await fetch("/api/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: user.uid,
					alumnoDni: alumnoDni,
					cursoId: cursoId,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				setIsProcessing(false);
				setErrorState({
					show: true,
					message: data.error || "Ocurrió un error al procesar tu solicitud.",
				});
				return;
			}

			setModalMessage("Redirigiendo a Mercado Pago...");

			setTimeout(() => {
				window.location.href = data.init_point;
				setIsProcessing(false);
			}, 1500);
		} catch (error) {
			console.error("Error al conectar con la API de checkout:", error);
			setIsProcessing(false);
			setErrorState({
				show: true,
				message:
					"Hubo un problema de conexión con el servidor. Inténtalo más tarde.",
			});
		}
	};

	// 3. CORRECCIÓN: Invertimos el orden. El error tiene máxima prioridad visual.
	if (errorState.show) {
		return (
			<div className="min-h-[400px] bg-gray-50 flex items-center justify-center p-4">
				<motion.div
					initial={{ opacity: 0, scale: 0.95, y: 10 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border-t-4 border-[#EE1120]"
				>
					<div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
						<AlertCircle className="w-8 h-8 text-[#EE1120]" />
					</div>
					<h2 className="text-2xl font-bold text-[#2a2e5b] mb-2">
						Verificación Fallida
					</h2>
					<p className="text-gray-600 mb-8">{errorState.message}</p>
					<Button
						onClick={() => router.push("/cursos")}
						className="w-full bg-[#2a2e5b] hover:bg-[#1d2355] text-white py-6 rounded-lg font-bold transition-all"
					>
						Volver al catálogo de cursos
					</Button>
				</motion.div>
			</div>
		);
	}

	// Si no hay error, validamos si sigue cargando
	if (courseInfo.isLoading || studentInfo.isLoading || authLoading) {
		return (
			<div className="h-screen flex items-center justify-center bg-gray-50">
				<Loader2 className="w-12 h-12 animate-spin text-[#EE1120]" />
			</div>
		);
	}

	// --- RENDERIZADO NORMAL ---
	return (
		<>
			<div className="bg-gray-50">
				<div className="container mx-auto px-4 py-8 md:py-12">
					<div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
						{/* COLUMNA IZQUIERDA - MÉTODOS DE PAGO */}
						<div className="lg:col-span-2">
							<motion.div
								initial={{ opacity: 0, x: -20 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ duration: 0.5 }}
							>
								<div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
									<h2 className="text-xl md:text-2xl font-bold text-[#2a2e5b] mb-6">
										Elige cómo pagar
									</h2>

									<div className="border-2 border-blue-500 rounded-lg p-5 bg-blue-50/30 hover:shadow-md transition-all duration-300 cursor-pointer">
										<div className="flex items-start gap-4">
											<div className="flex-shrink-0 mt-1">
												<div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center">
													<div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
												</div>
											</div>

											<div className="flex-1">
												<div className="flex items-center gap-3 mb-3">
													<div className="bg-white p-1.5 rounded-md shadow-sm border border-gray-100">
														<Banknote className="h-6 w-6 text-green-600" />
													</div>
													<span className="text-sm font-bold text-gray-800">
														Mercado Pago
													</span>
												</div>

												<p className="text-sm text-gray-600 mb-3">
													Paga de forma segura con tarjeta de crédito, débito o
													efectivo
												</p>

												<div className="flex items-center gap-2 flex-wrap">
													<div className="flex items-center gap-1.5 bg-white rounded px-2 py-1 border border-gray-200 shadow-sm">
														<CreditCard className="w-3.5 h-3.5 text-gray-500" />
														<span className="text-[10px] font-medium text-gray-700">
															Visa
														</span>
													</div>
													<div className="flex items-center gap-1.5 bg-white rounded px-2 py-1 border border-gray-200 shadow-sm">
														<CreditCard className="w-3.5 h-3.5 text-gray-500" />
														<span className="text-[10px] font-medium text-gray-700">
															Mastercard
														</span>
													</div>
													<div className="flex items-center gap-1.5 bg-white rounded px-2 py-1 border border-gray-200 shadow-sm">
														<Banknote className="w-3.5 h-3.5 text-gray-500" />
														<span className="text-[10px] font-medium text-gray-700">
															Efectivo
														</span>
													</div>
												</div>
											</div>
										</div>
									</div>

									<div className="mt-6 flex items-center gap-2 text-lg text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
										<ShieldCheck className="w-4 h-4 text-green-600" />
										<span>
											Tus datos están protegidos con encriptación SSL de 256
											bits
										</span>
									</div>
								</div>
							</motion.div>
						</div>

						{/* COLUMNA DERECHA - RESUMEN */}
						<div className="lg:col-span-1">
							<motion.div
								initial={{ opacity: 0, x: 20 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ duration: 0.5, delay: 0.2 }}
								className="lg:sticky lg:top-24"
							>
								<div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
									<h3 className="text-xl font-bold text-[#2a2e5b] mb-4">
										Resumen de Compra
									</h3>

									<div className="mb-4 pb-4 border-b border-gray-100">
										<div className="flex justify-between mb-1">
											<span className="text-lg text-gray-500">Estudiante:</span>
											<span className="text-lg font-semibold text-gray-800 text-right">
												{studentInfo.name}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-lg text-gray-500">DNI:</span>
											<span className="text-lg font-semibold text-gray-800">
												{studentInfo.dni}
											</span>
										</div>
									</div>

									<div className="mb-4 pb-4 border-b border-gray-100">
										<p className="font-semibold text-lg text-gray-800 mb-2 leading-tight">
											{courseInfo.name}
										</p>
										<div className="flex justify-between items-baseline">
											<span className="text-lg text-gray-500">Precio:</span>
											<span className="text-lg font-bold text-[#2a2e5b]">
												ARS ${courseInfo.price.toLocaleString("es-AR")}
											</span>
										</div>
									</div>

									<div className="mb-6">
										<div className="flex justify-between items-baseline">
											<span className="text-lg font-bold text-gray-800">
												Total a pagar:
											</span>
											<span className="text-xl font-bold text-[#EE1120]">
												ARS ${courseInfo.price.toLocaleString("es-AR")}
											</span>
										</div>
									</div>

									<Button
										onClick={handlePayment}
										disabled={
											isProcessing ||
											courseInfo.price === 0 ||
											studentInfo.dni === "---"
										}
										className="w-full bg-[#EE1120] hover:bg-[#c4000e] text-white text-sm font-bold py-5 rounded-lg shadow hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<Lock className="w-4 h-4 mr-2" />
										Pagar Ahora de forma Segura
									</Button>

									<p className="text-[10px] text-center text-gray-400 mt-2 flex items-center justify-center gap-1">
										<Lock className="w-2.5 h-2.5" />
										Transacción encriptada 256-bits
									</p>
								</div>
							</motion.div>
						</div>
					</div>
				</div>
			</div>

			<PaymentModal isOpen={isProcessing} message={modalMessage} />
		</>
	);
}

export default function PaymentCheckout() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center">
					<Loader2 className="w-10 h-10 animate-spin text-[#EE1120]" />
				</div>
			}
		>
			<CheckoutContent />
		</Suspense>
	);
}
