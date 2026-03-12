"use client";

import React, { useState, useEffect } from "react";
import {
	X,
	AlertCircle,
	CheckCircle,
	Loader2,
	Search,
	User,
	BookOpen,
	CreditCard,
	DollarSign, // <-- Importamos un ícono para el monto
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	collection,
	getDocs,
	getDoc,
	query,
	where,
	addDoc,
	updateDoc,
	doc,
	arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

interface AlumnoOption {
	id: string;
	nombre: string;
	apellido: string;
	dni: string;
	cursos: string[];
	coleccionOrigen: "Users" | "Hijos";
}

interface CuotaRecord {
	id: string;
	mes: string;
	curso: string;
	estado: "pagado" | "pendiente";
}

interface MesOption {
	value: string;
	label: string;
}

interface RegistrarPagoModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

export default function RegistrarPagoModal({
	isOpen,
	onClose,
	onSuccess,
}: RegistrarPagoModalProps) {
	const [dniSearch, setDniSearch] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const [studentFound, setStudentFound] = useState<AlumnoOption | null>(null);

	const [selectedCourse, setSelectedCourse] = useState("");
	const [historialCuotas, setHistorialCuotas] = useState<CuotaRecord[]>([]);
	const [pendingMonths, setPendingMonths] = useState<MesOption[]>([]);
	const [selectedMonth, setSelectedMonth] = useState("");

	const [paymentMethod, setPaymentMethod] = useState("");

	// NUEVO: Estado para almacenar el valor de la cuota del curso
	const [montoCuota, setMontoCuota] = useState<number>(0);

	const [isLoading, setIsLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen) {
			setDniSearch("");
			setStudentFound(null);
			setSelectedCourse("");
			setHistorialCuotas([]);
			setPendingMonths([]);
			setSelectedMonth("");
			setPaymentMethod("");
			setMontoCuota(0); // Reseteamos el monto
			setErrorMsg(null);
		}
	}, [isOpen]);

	useEffect(() => {
		if (studentFound && selectedCourse) {
			loadCourseAndStudentCuotas(studentFound.id, selectedCourse);
		}
	}, [selectedCourse, studentFound]);

	// Función auxiliar para formatear a pesos argentinos
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("es-AR", {
			style: "currency",
			currency: "ARS",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	const handleSearchStudent = async () => {
		if (!dniSearch.trim()) {
			setErrorMsg("Debes ingresar un DNI para buscar.");
			return;
		}

		setIsSearching(true);
		setErrorMsg(null);
		setStudentFound(null);
		setSelectedCourse("");

		try {
			const qUsers = query(
				collection(db, "Users"),
				where("dni", "==", dniSearch.trim()),
			);
			const qHijos = query(
				collection(db, "Hijos"),
				where("dni", "==", dniSearch.trim()),
			);

			const [snapUsers, snapHijos] = await Promise.all([
				getDocs(qUsers),
				getDocs(qHijos),
			]);

			let docData = null;
			let coleccion: "Users" | "Hijos" | null = null;

			if (!snapUsers.empty) {
				docData = snapUsers.docs[0];
				coleccion = "Users";
			} else if (!snapHijos.empty) {
				docData = snapHijos.docs[0];
				coleccion = "Hijos";
			}

			if (!docData || !coleccion) {
				setErrorMsg(
					"No se encontró ningún alumno (Titular ni Hijo) con ese DNI.",
				);
				setIsSearching(false);
				return;
			}

			const data = docData.data();
			const cursosDelAlumno = data.cursos || [];

			if (!Array.isArray(cursosDelAlumno) || cursosDelAlumno.length === 0) {
				setErrorMsg(
					`El alumno ${data.nombre} fue encontrado, pero no tiene cursos asignados.`,
				);
				setIsSearching(false);
				return;
			}

			const alumnoData: AlumnoOption = {
				id: docData.id,
				nombre: data.nombre,
				apellido: data.apellido || "",
				dni: data.dni,
				cursos: cursosDelAlumno,
				coleccionOrigen: coleccion,
			};

			setStudentFound(alumnoData);
			setSelectedCourse(cursosDelAlumno[0]);
		} catch (error) {
			console.error("Error al buscar alumno:", error);
			setErrorMsg("Error de conexión al buscar el DNI.");
		} finally {
			setIsSearching(false);
		}
	};

	const loadCourseAndStudentCuotas = async (
		alumnoId: string,
		cursoId: string,
	) => {
		try {
			const cursoRef = doc(db, "Cursos", cursoId);
			const cursoSnap = await getDoc(cursoRef);

			if (!cursoSnap.exists()) {
				setErrorMsg(
					`Error de integridad: El curso ${cursoId} no existe en la base de datos.`,
				);
				return;
			}

			const cursoData = cursoSnap.data();
			const inicioMes = cursoData.inicioMes || 1;
			const finMes = cursoData.finMes || 12;

			// NUEVO: Guardamos el valor de la cuota en el estado (valor por defecto 0 si no existe)
			setMontoCuota(cursoData.cuota || 0);

			const cuotasRef = collection(db, "Cuotas");
			const q = query(
				cuotasRef,
				where("alumnoId", "==", alumnoId),
				where("curso", "==", cursoId),
			);
			const snapCuotas = await getDocs(q);

			const historial: CuotaRecord[] = snapCuotas.docs.map((doc) => ({
				id: doc.id,
				mes: doc.data().mes,
				curso: doc.data().curso,
				estado: doc.data().estado,
			}));

			setHistorialCuotas(historial);

			const mesesPagados = new Set(
				historial.filter((c) => c.estado === "pagado").map((c) => c.mes),
			);

			const currentYear = new Date().getFullYear();
			const nombres = [
				"Enero",
				"Febrero",
				"Marzo",
				"Abril",
				"Mayo",
				"Junio",
				"Julio",
				"Agosto",
				"Septiembre",
				"Octubre",
				"Noviembre",
				"Diciembre",
			];

			const missingMonths: MesOption[] = [];
			const startIdx = inicioMes - 1;
			const endIdx = finMes - 1;

			for (let i = startIdx; i <= endIdx; i++) {
				const value = `${currentYear}-${String(i + 1).padStart(2, "0")}`;
				if (!mesesPagados.has(value)) {
					missingMonths.push({ value, label: `${nombres[i]} ${currentYear}` });
				}
			}

			setPendingMonths(missingMonths);

			if (missingMonths.length > 0) {
				setSelectedMonth(missingMonths[0].value);
			} else {
				setSelectedMonth("");
			}
		} catch (error) {
			console.error("Error al cargar cuotas y curso:", error);
			setErrorMsg("Ocurrió un error al calcular la deuda del curso.");
		}
	};

	const handleRegistrarPago = async () => {
		if (!studentFound || !selectedMonth || !selectedCourse) {
			setErrorMsg("Faltan datos para registrar el pago.");
			return;
		}

		if (!paymentMethod) {
			setErrorMsg("Por favor, selecciona un método de pago.");
			return;
		}

		setIsLoading(true);
		setErrorMsg(null);

		try {
			const oldestPendingMonth = pendingMonths[0].value;
			if (selectedMonth > oldestPendingMonth) {
				const mesNombre = pendingMonths[0].label;
				setErrorMsg(
					`Deuda previa: No puedes registrar este mes sin abonar primero ${mesNombre} de ${selectedCourse}.`,
				);
				setIsLoading(false);
				return;
			}

			const cuotaExistente = historialCuotas.find(
				(c) => c.mes === selectedMonth,
			);

			if (cuotaExistente && cuotaExistente.estado === "pendiente") {
				await updateDoc(doc(db, "Cuotas", cuotaExistente.id), {
					estado: "pagado",
					fechaPago: new Date(),
					metodoPago: paymentMethod,
					montoAbonado: montoCuota, // <-- NUEVO: Guardamos el monto pagado
				});
			} else {
				await addDoc(collection(db, "Cuotas"), {
					alumnoId: studentFound.id,
					curso: selectedCourse,
					mes: selectedMonth,
					estado: "pagado",
					fechaPago: new Date(),
					metodoPago: paymentMethod,
					montoAbonado: montoCuota, // <-- NUEVO: Guardamos el monto pagado
				});
			}

			const studentRef = doc(db, studentFound.coleccionOrigen, studentFound.id);
			await updateDoc(studentRef, {
				[`cuotasPagadas.${selectedCourse}`]: arrayUnion(selectedMonth),
			});

			onSuccess();
			onClose();
		} catch (error) {
			console.error("Error en la transacción:", error);
			setErrorMsg("Ocurrió un error en el servidor al procesar el pago.");
		} finally {
			setIsLoading(false);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
			<div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
				<div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
					<h2 className="text-xl font-bold text-[#252d62]">Registrar Pago</h2>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-600 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				<div className="p-6 space-y-6 overflow-y-auto">
					<div className="space-y-2">
						<label className="text-sm font-semibold text-gray-700">
							Buscar Alumno por DNI
						</label>
						<div className="flex gap-2">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
								<input
									type="text"
									value={dniSearch}
									onChange={(e) => setDniSearch(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleSearchStudent()}
									placeholder="Ej: 38123456"
									className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20"
								/>
							</div>
							<Button
								onClick={handleSearchStudent}
								disabled={isSearching || !dniSearch.trim()}
								className="bg-[#252d62] hover:bg-[#1a2046] text-white rounded-xl"
							>
								{isSearching ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									"Buscar"
								)}
							</Button>
						</div>
					</div>

					{studentFound && (
						<div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
							<div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-3">
								<div className="p-2 bg-blue-100 text-blue-700 rounded-full">
									<User className="w-5 h-5" />
								</div>
								<div>
									<p className="text-sm font-bold text-[#252d62]">
										{studentFound.nombre} {studentFound.apellido}
									</p>
									<p className="text-xs text-gray-500 flex items-center gap-1">
										DNI: {studentFound.dni} |{" "}
										<span className="uppercase text-blue-600 font-semibold">
											{studentFound.coleccionOrigen == "Hijos"
												? "Alumno Menor"
												: "Alumno Mayor"}
										</span>
									</p>
								</div>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
									<BookOpen className="w-4 h-4" /> Curso
								</label>
								{studentFound.cursos.length > 1 ? (
									<select
										value={selectedCourse}
										onChange={(e) => setSelectedCourse(e.target.value)}
										className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 font-medium"
									>
										{studentFound.cursos.map((c) => (
											<option key={c} value={c}>
												{c}
											</option>
										))}
									</select>
								) : (
									<div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium">
										{selectedCourse}
									</div>
								)}
							</div>

							<div className="space-y-2">
								<label className="text-sm font-semibold text-gray-700">
									Cuota a Abonar
								</label>
								{pendingMonths.length === 0 ? (
									<div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm flex items-center gap-2">
										<CheckCircle className="w-4 h-4" />
										Al día. Todas las cuotas pagadas para este curso.
									</div>
								) : (
									<select
										value={selectedMonth}
										onChange={(e) => setSelectedMonth(e.target.value)}
										className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20"
									>
										{pendingMonths.map((opt, index) => (
											<option key={opt.value} value={opt.value}>
												{opt.label} {index === 0 ? "(Próximo a vencer)" : ""}
											</option>
										))}
									</select>
								)}
							</div>

							<div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
								<div className="flex items-center gap-2">
									<div className="p-2 bg-green-100 rounded-lg">
										<DollarSign className="w-5 h-5 text-green-700" />
									</div>
									<div>
										<p className="text-sm font-medium text-gray-500">
											Monto a Cobrar
										</p>
										<p className="text-lg font-bold text-[#252d62]">
											{formatCurrency(montoCuota)}
										</p>
									</div>
								</div>
							</div>
							{pendingMonths.length > 0 && (
								<>
									<div className="space-y-2">
										<label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
											<CreditCard className="w-4 h-4" /> Método de Pago
										</label>
										<select
											value={paymentMethod}
											onChange={(e) => setPaymentMethod(e.target.value)}
											className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 font-medium bg-white"
										>
											{/* Creamos el tipico seleccione una opcion */}
											<option value="" disabled>
												-- Seleccione una opción --
											</option>
											<option value="Efectivo">Efectivo</option>
											<option value="Transferencia Bancaria (Verificada)">
												Transferencia Bancaria (Verificada)
											</option>
											<option value="Tarjeta (Posnet)">Tarjeta (Posnet)</option>
										</select>
									</div>

									{/* NUEVO: Tarjeta resumen con el monto a cobrar */}
								</>
							)}
						</div>
					)}
				</div>

				{errorMsg && (
					<div className="flex items-start gap-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
						<AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
						<p className="font-medium">{errorMsg}</p>
					</div>
				)}

				<div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 shrink-0">
					<Button
						variant="outline"
						onClick={onClose}
						className="rounded-xl"
						disabled={isLoading}
					>
						Cancelar
					</Button>
					<Button
						onClick={handleRegistrarPago}
						disabled={isLoading || !studentFound || pendingMonths.length === 0}
						className="bg-[#252d62] hover:bg-[#1a2046] text-white rounded-xl flex items-center gap-2"
					>
						{isLoading ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<CheckCircle className="w-4 h-4" />
						)}
						{isLoading ? "Procesando..." : "Confirmar Pago"}
					</Button>
				</div>
			</div>
		</div>
	);
}
