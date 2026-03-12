"use client";

import React, { useState, useEffect } from "react";
import MetricsCard from "@/components/admin/MetricsCard";
import { Users, UserPlus, DollarSign, BookOpen, Loader2 } from "lucide-react";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	LineChart,
	Line,
} from "recharts";
import { motion } from "framer-motion";
import InscriptionsTable from "@/components/admin/inscripciones/InscriptionTable";
// import { useAdminAuth } from "@/context/AdminAuthContext";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

interface ChartData {
	mes: string;
	inscripciones: number;
	ingresos: number;
}

export default function AdminDashboardPage() {
	// const { adminData } = useAdminAuth();

	const [isLoading, setIsLoading] = useState(true);
	const [metrics, setMetrics] = useState({
		totalAlumnos: 0,
		nuevasInscripcionesMes: 0,
		ingresosMes: 0,
		cursosActivos: 0,
	});
	const [chartData, setChartData] = useState<ChartData[]>([]);

	useEffect(() => {
		const fetchDashboardData = async () => {
			try {
				setIsLoading(true);
				const today = new Date();
				const currentYear = today.getFullYear();
				const currentMonthIndex = today.getMonth(); // 0 = Enero, ..., 11 = Diciembre
				const currentMonthString = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, "0")}`;

				// 1. OBTENER CURSOS ACTIVOS
				const qCursos = query(
					collection(db, "Cursos"),
					where("active", "==", true),
				);
				const snapCursos = await getDocs(qCursos);
				const cursosCount = snapCursos.size;

				// 2. OBTENER ALUMNOS ACTIVOS (Con cursos asignados)
				const qUsers = query(
					collection(db, "Users"),
					where("cursos", "!=", []),
				);
				const qHijos = query(
					collection(db, "Hijos"),
					where("cursos", "!=", []),
				);
				const [snapUsers, snapHijos] = await Promise.all([
					getDocs(qUsers),
					getDocs(qHijos),
				]);
				const alumnosCount = snapUsers.size + snapHijos.size;

				// 3. INICIALIZAR ESTRUCTURA PARA LOS GRÁFICOS (12 Meses)
				const mesesNombres = [
					"Ene",
					"Feb",
					"Mar",
					"Abr",
					"May",
					"Jun",
					"Jul",
					"Ago",
					"Sep",
					"Oct",
					"Nov",
					"Dic",
				];
				const yearData: ChartData[] = mesesNombres.map((mes) => ({
					mes,
					inscripciones: 0,
					ingresos: 0,
				}));

				let ingresosMesActual = 0;
				let inscripcionesMesActual = 0;

				// 4. PROCESAR CUOTAS (Ingresos Mensuales)
				const qCuotas = query(
					collection(db, "Cuotas"),
					where("estado", "==", "pagado"),
				);
				const snapCuotas = await getDocs(qCuotas);

				snapCuotas.forEach((doc) => {
					const data = doc.data();
					const mesCuota = data.mes; // Ej: "2026-03"
					const monto = data.montoAbonado || 0;

					if (mesCuota === currentMonthString) {
						ingresosMesActual += monto;
					}

					// Sumar al gráfico si es del año actual
					if (mesCuota && mesCuota.startsWith(String(currentYear))) {
						const mesIndex = parseInt(mesCuota.split("-")[1]) - 1;
						if (mesIndex >= 0 && mesIndex < 12) {
							yearData[mesIndex].ingresos += monto;
						}
					}
				});

				// 5. PROCESAR INSCRIPCIONES (Nuevas altas y cobros de inscripción)
				const snapInscripciones = await getDocs(
					collection(db, "Inscripciones"),
				);

				snapInscripciones.forEach((doc) => {
					const data = doc.data();
					// Convertir el Timestamp de Firebase a Date nativo
					const fechaInscripcion = data.fecha?.toDate
						? data.fecha.toDate()
						: new Date(data.fecha);
					const costoInscripcion = data.cursoInscripcion || 0;

					if (fechaInscripcion.getFullYear() === currentYear) {
						const mesIndex = fechaInscripcion.getMonth();
						yearData[mesIndex].inscripciones += 1;
						yearData[mesIndex].ingresos += costoInscripcion; // Sumamos la inscripción a los ingresos de ese mes

						if (mesIndex === currentMonthIndex) {
							inscripcionesMesActual += 1;
							ingresosMesActual += costoInscripcion;
						}
					}
				});

				// 6. ACTUALIZAR ESTADOS
				setMetrics({
					totalAlumnos: alumnosCount,
					cursosActivos: cursosCount,
					ingresosMes: ingresosMesActual,
					nuevasInscripcionesMes: inscripcionesMesActual,
				});

				// Opcional: Filtrar el gráfico para mostrar solo hasta el mes actual, o todos los meses
				// Por ahora dejamos los 12 meses fijos para que el gráfico quede visualmente completo
				setChartData(yearData);
			} catch (error) {
				console.error("Error cargando métricas del dashboard:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchDashboardData();
	}, []);

	if (isLoading) {
		return (
			<div className="flex h-[70vh] items-center justify-center">
				<Loader2 className="w-10 h-10 animate-spin text-[#252d62]" />
			</div>
		);
	}

	return (
		<>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
				<MetricsCard
					icon={Users}
					label="Total Alumnos Activos"
					value={metrics.totalAlumnos.toString()}
					trend="En todos los cursos"
				/>
				<MetricsCard
					icon={UserPlus}
					label="Nuevas Inscripciones del Mes"
					value={`+${metrics.nuevasInscripcionesMes}`}
					trend="Alta de nuevos alumnos"
				/>
				<MetricsCard
					icon={DollarSign}
					label="Ingresos Mensuales"
					value={`$${metrics.ingresosMes.toLocaleString("es-AR")}`}
					trend="Cuotas + Inscripciones"
				/>
				<MetricsCard
					icon={BookOpen}
					label="Cursos Activos"
					value={metrics.cursosActivos.toString()}
					trend="Catálogo habilitado"
				/>
			</div>

			{/* Charts Section */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
				{/* Enrollment Chart */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.2 }}
					className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
				>
					<h3 className="text-lg font-bold text-[#252d62] mb-6">
						Inscripciones del Año
					</h3>
					<ResponsiveContainer width="100%" height={300}>
						<BarChart data={chartData}>
							<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
							<XAxis
								dataKey="mes"
								tick={{ fill: "#6b7280", fontSize: 12 }}
								axisLine={{ stroke: "#e5e7eb" }}
							/>
							<YAxis
								tick={{ fill: "#6b7280", fontSize: 12 }}
								axisLine={{ stroke: "#e5e7eb" }}
							/>
							<Tooltip
								contentStyle={{
									backgroundColor: "#fff",
									border: "1px solid #e5e7eb",
									borderRadius: "8px",
									boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
								}}
							/>
							<Legend wrapperStyle={{ paddingTop: "20px" }} iconType="circle" />
							<Bar
								dataKey="inscripciones"
								fill="#252d62"
								radius={[8, 8, 0, 0]}
								name="Inscripciones"
							/>
						</BarChart>
					</ResponsiveContainer>
				</motion.div>

				{/* Revenue Chart */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.3 }}
					className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
				>
					<h3 className="text-lg font-bold text-[#252d62] mb-6">
						Ingresos Anuales Brutos (ARS)
					</h3>
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={chartData}>
							<CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
							<XAxis
								dataKey="mes"
								tick={{ fill: "#6b7280", fontSize: 12 }}
								axisLine={{ stroke: "#e5e7eb" }}
							/>
							<YAxis
								tick={{ fill: "#6b7280", fontSize: 12 }}
								axisLine={{ stroke: "#e5e7eb" }}
							/>
							<Tooltip
								contentStyle={{
									backgroundColor: "#fff",
									border: "1px solid #e5e7eb",
									borderRadius: "8px",
									boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
								}}
								formatter={(value: number | undefined) =>
									value !== undefined ? `$${value.toLocaleString("es-AR")}` : ""
								}
							/>
							<Legend wrapperStyle={{ paddingTop: "20px" }} iconType="circle" />
							<Line
								type="monotone"
								dataKey="ingresos"
								stroke="#252d62"
								strokeWidth={3}
								dot={{ fill: "#252d62", r: 5 }}
								activeDot={{ r: 7 }}
								name="Ingresos"
							/>
						</LineChart>
					</ResponsiveContainer>
				</motion.div>
			</div>

			<InscriptionsTable />
		</>
	);
}
