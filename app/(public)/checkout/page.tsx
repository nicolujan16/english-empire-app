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
	Tag,
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

// ─── Helper: descuento máximo de inscripción para un alumno ──────────────────

async function getMaxDescuentoInscripcion(
	etiquetaIds: string[],
): Promise<{ porcentaje: number; nombre: string } | null> {
	if (!etiquetaIds || etiquetaIds.length === 0) return null;
	try {
		const snap = await getDocs(
			query(collection(db, "EtiquetasDescuento"), where("activa", "==", true)),
		);
		let maxPorcentaje = 0;
		let maxNombre = "";
		snap.docs.forEach((d) => {
			if (!etiquetaIds.includes(d.id)) return;
			const pct: number = d.data().descuentoInscripcion ?? 0;
			if (pct > maxPorcentaje) {
				maxPorcentaje = pct;
				maxNombre = d.data().nombre ?? d.id;
			}
		});
		return maxPorcentaje > 0
			? { porcentaje: maxPorcentaje, nombre: maxNombre }
			: null;
	} catch {
		return null;
	}
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

function CheckoutContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { userData, user, isLoading: authLoading } = useAuth();

	const [isProcessing, setIsProcessing] = useState(false);
	const [modalMessage, setModalMessage] = useState("");
	const [errorState, setErrorState] = useState({ show: false, message: "" });

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
		alumnoId: "",
		isLoading: true,
	});

	// Descuento por etiqueta
	const [descuento, setDescuento] = useState<{
		porcentaje: number;
		nombre: string;
	} | null>(null);
	const [etiquetaIds, setEtiquetaIds] = useState<string[]>([]);

	// ── Auth guard ────────────────────────────────────────────────────────────
	useEffect(() => {
		if (!authLoading && !user)
			router.push("/iniciar-sesion?redirect=/checkout");
	}, [user, authLoading, router]);

	// ── Cargar curso ──────────────────────────────────────────────────────────
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
				const docSnap = await getDoc(doc(db, "Cursos", cursoId));
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
			} catch {
				setErrorState({
					show: true,
					message: "Hubo un problema de conexión al verificar el curso.",
				});
				setCourseInfo((prev) => ({ ...prev, isLoading: false }));
			}
		};
		fetchCourse();
	}, [cursoId]);

	// ── Validar alumno + cargar sus etiquetas ─────────────────────────────────
	useEffect(() => {
		const validateStudent = async () => {
			if (authLoading || !user || !userData) return;
			if (!alumnoDni) {
				setErrorState({
					show: true,
					message: "Falta el DNI del alumno a inscribir.",
				});
				setStudentInfo((prev) => ({ ...prev, isLoading: false }));
				return;
			}
			try {
				if (alumnoDni === userData.dni) {
					setStudentInfo({
						name: `${userData.nombre} ${userData.apellido}`,
						dni: userData.dni,
						alumnoId: user.uid,
						isLoading: false,
					});
					setEtiquetaIds(userData.etiquetas ?? []);
					return;
				}

				const hijoSnapshot = await getDocs(
					query(collection(db, "Hijos"), where("dni", "==", alumnoDni)),
				);
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
						alumnoId: hijoSnapshot.docs[0].id,
						isLoading: false,
					});
					setEtiquetaIds(hijoData.etiquetas ?? []);
					return;
				}

				const userSnapshot = await getDocs(
					query(collection(db, "Users"), where("dni", "==", alumnoDni)),
				);
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
			} catch {
				setErrorState({
					show: true,
					message: "Hubo un error al verificar los datos del alumno.",
				});
				setStudentInfo((prev) => ({ ...prev, isLoading: false }));
			}
		};
		validateStudent();
	}, [alumnoDni, user, userData, authLoading]);

	// ── Calcular descuento una vez que se tienen las etiquetas ────────────────
	useEffect(() => {
		if (etiquetaIds.length === 0) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setDescuento(null);
			return;
		}
		getMaxDescuentoInscripcion(etiquetaIds).then(setDescuento);
	}, [etiquetaIds]);

	// ── Precios finales ───────────────────────────────────────────────────────
	const precioOriginal = courseInfo.price;
	const precioFinal = descuento
		? Math.round(precioOriginal * (1 - descuento.porcentaje / 100))
		: precioOriginal;
	const ahorro = precioOriginal - precioFinal;

	// ── Pago ──────────────────────────────────────────────────────────────────
	const handlePayment = async () => {
		if (precioFinal === 0 || !user || !cursoId || !alumnoDni) return;
		setIsProcessing(true);
		setModalMessage("Validando inscripción y preparando pago...");
		try {
			const response = await fetch("/api/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: user.uid,
					alumnoDni,
					cursoId,
					alumnoId: studentInfo.alumnoId,
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
		} catch {
			setIsProcessing(false);
			setErrorState({
				show: true,
				message:
					"Hubo un problema de conexión con el servidor. Inténtalo más tarde.",
			});
		}
	};

	// ── Estados de carga / error ──────────────────────────────────────────────
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

	if (courseInfo.isLoading || studentInfo.isLoading || authLoading) {
		return (
			<div className="h-screen flex items-center justify-center bg-gray-50">
				<Loader2 className="w-12 h-12 animate-spin text-[#EE1120]" />
			</div>
		);
	}

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<>
			<div className="bg-gray-50">
				<div className="container mx-auto px-4 py-8 md:py-12">
					<div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
						{/* Columna izquierda — métodos de pago */}
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
													<div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
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
													{["Visa", "Mastercard"].map((m) => (
														<div
															key={m}
															className="flex items-center gap-1.5 bg-white rounded px-2 py-1 border border-gray-200 shadow-sm"
														>
															<CreditCard className="w-3.5 h-3.5 text-gray-500" />
															<span className="text-[10px] font-medium text-gray-700">
																{m}
															</span>
														</div>
													))}
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

						{/* Columna derecha — resumen */}
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

									{/* Datos del estudiante */}
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

									{/* Curso y precio */}
									<div className="mb-4 pb-4 border-b border-gray-100 space-y-2">
										<p className="font-semibold text-lg text-gray-800 leading-tight">
											{courseInfo.name}
										</p>

										{descuento ? (
											<>
												{/* Banner de descuento */}
												<div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
													<Tag className="w-4 h-4 text-emerald-600 shrink-0" />
													<div className="text-xs">
														<p className="font-bold text-emerald-700">
															{descuento.nombre}
														</p>
														<p className="text-emerald-600">
															{descuento.porcentaje}% de descuento en la
															inscripción
														</p>
													</div>
												</div>

												{/* Precio original tachado + final */}
												<div className="flex justify-between items-baseline">
													<span className="text-sm text-gray-400">
														Precio original:
													</span>
													<span className="text-sm text-gray-400 line-through">
														ARS ${precioOriginal.toLocaleString("es-AR")}
													</span>
												</div>
												<div className="flex justify-between items-baseline">
													<span className="text-sm font-semibold text-emerald-600">
														Descuento:
													</span>
													<span className="text-sm font-bold text-emerald-600">
														− ARS ${ahorro.toLocaleString("es-AR")}
													</span>
												</div>
											</>
										) : (
											<div className="flex justify-between items-baseline">
												<span className="text-lg text-gray-500">Precio:</span>
												<span className="text-lg font-bold text-[#2a2e5b]">
													ARS ${precioOriginal.toLocaleString("es-AR")}
												</span>
											</div>
										)}
									</div>

									{/* Total */}
									<div className="mb-6">
										<div className="flex justify-between items-baseline">
											<span className="text-lg font-bold text-gray-800">
												Total a pagar:
											</span>
											<span
												className={`text-xl font-bold ${descuento ? "text-emerald-600" : "text-[#EE1120]"}`}
											>
												ARS ${precioFinal.toLocaleString("es-AR")}
											</span>
										</div>
									</div>

									<Button
										onClick={handlePayment}
										disabled={
											isProcessing ||
											precioFinal === 0 ||
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
