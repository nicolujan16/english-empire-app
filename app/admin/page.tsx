"use client";

import React, { useState, useEffect } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useRouter } from "next/navigation";
import MetricsCard from "@/components/admin/MetricsCard";
import {
	Users,
	UserPlus,
	TrendingUp,
	TrendingDown,
	BookOpen,
	Loader2,
	Scale,
	Clock,
	AlertTriangle,
	CalendarDays,
} from "lucide-react";
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
import {
	collection,
	getDocs,
	query,
	where,
	Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

interface ChartData {
	mes: string;
	inscripciones: number;
	ingresos: number;
	egresos: number;
}

const MESES_NOMBRES = [
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

export default function AdminDashboardPage() {
	const router = useRouter();
	const { adminUser, adminData, isLoading: authLoading } = useAdminAuth();

	// 🚀 ESTADOS PARA EL FILTRO DE FECHA (Por defecto: mes y año actual)
	const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
	const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

	const [isLoading, setIsLoading] = useState(true);
	const [metrics, setMetrics] = useState({
		totalAlumnos: 0,
		nuevasInscripcionesMes: 0,
		ingresosMes: 0,
		egresosMes: 0,
		cursosActivos: 0,
		cuotasPendientes: 0,
		cuotasAtrasadas: 0,
	});
	const [chartData, setChartData] = useState<ChartData[]>([]);

	// 🚀 Años disponibles para el filtro (ej: desde 2024 hasta el año actual + 1)
	const currentRealYear = new Date().getFullYear();
	const yearsOptions = Array.from(
		{ length: 5 },
		(_, i) => currentRealYear - 2 + i,
	);

	useEffect(() => {
		// 1. Candado de Autenticación
		if (authLoading) return;
		if (!adminUser || adminData?.rol !== "admin") {
			if (adminData?.rol == "secretario") {
				router.push("/admin/inscripciones");
				return;
			}
			router.push("/admin-login");
			return;
		}

		// 2. Carga de datos basada en los filtros
		const fetchDashboardData = async () => {
			try {
				setIsLoading(true);

				// 🚀 Usamos los valores del filtro en lugar del Date actual
				const currentYear = selectedYear;
				const currentMonthIndex = selectedMonth;

				const yearData: ChartData[] = MESES_NOMBRES.map((mes) => ({
					mes,
					inscripciones: 0,
					ingresos: 0,
					egresos: 0,
				}));

				// ── 1. Cursos activos ──────────────────────────────────────────
				const snapCursos = await getDocs(
					query(collection(db, "Cursos"), where("active", "==", true)),
				);

				// ── 2. Alumnos activos ─────────────────────────────────────────
				const [snapUsers, snapHijos] = await Promise.all([
					getDocs(query(collection(db, "Users"), where("cursos", "!=", []))),
					getDocs(query(collection(db, "Hijos"), where("cursos", "!=", []))),
				]);

				// ── 3. Cuotas pagadas ──────────────────────────────────────────
				const snapCuotas = await getDocs(
					query(collection(db, "Cuotas"), where("estado", "==", "Pagado")),
				);

				let ingresosMesActual = 0;

				snapCuotas.forEach((doc) => {
					const data = doc.data();
					const mes: number = data.mes;
					const anio: number = data.anio;
					const monto: number = data.montoPagado ?? 0;

					if (anio === currentYear) {
						const mesIndex = mes - 1;
						if (mesIndex >= 0 && mesIndex < 12) {
							yearData[mesIndex].ingresos += monto;
						}
						if (mesIndex === currentMonthIndex) {
							ingresosMesActual += monto;
						}
					}
				});

				// ── 4. Cuotas pendientes y atrasadas ───────────────────────────
				const snapPendientes = await getDocs(
					query(
						collection(db, "Cuotas"),
						where("estado", "==", "Pendiente"),
						where("anio", "==", currentYear),
					),
				);

				let cuotasPendientes = 0;
				let cuotasAtrasadas = 0;

				snapPendientes.forEach((doc) => {
					const data = doc.data();
					cuotasPendientes++;
					// Se considera atrasada si el mes de la cuota es menor al mes filtrado
					if (data.mes < currentMonthIndex + 1) {
						cuotasAtrasadas++;
					}
				});

				// ── 5. Inscripciones confirmadas ───────────────────────────────
				let inscripcionesMesActual = 0;

				const snapInscripciones = await getDocs(
					query(
						collection(db, "Inscripciones"),
						where("status", "==", "Confirmado"),
					),
				);

				snapInscripciones.forEach((doc) => {
					const data = doc.data();
					const fechaRaw = data.fecha as Timestamp;
					const fecha = fechaRaw?.toDate?.() ?? new Date(data.fecha);
					const costo: number = data.cursoInscripcion ?? 0;

					if (fecha.getFullYear() === currentYear) {
						const mesIndex = fecha.getMonth();
						yearData[mesIndex].inscripciones += 1;
						yearData[mesIndex].ingresos += costo;

						if (mesIndex === currentMonthIndex) {
							inscripcionesMesActual += 1;
							ingresosMesActual += costo;
						}
					}
				});

				// ── 6. Ingresos especiales ─────────────────────────────────────
				const snapIngresosEspeciales = await getDocs(
					collection(db, "IngresosEspeciales"),
				);

				snapIngresosEspeciales.forEach((doc) => {
					const data = doc.data();
					const fechaRaw = data.fecha as Timestamp;
					const fecha = fechaRaw?.toDate?.() ?? new Date(data.fecha);
					const monto: number = data.monto ?? 0;

					if (fecha.getFullYear() === currentYear) {
						const mesIndex = fecha.getMonth();
						yearData[mesIndex].ingresos += monto;
						if (mesIndex === currentMonthIndex) {
							ingresosMesActual += monto;
						}
					}
				});

				// ── 7. Egresos ─────────────────────────────────────────────────
				let egresosMesActual = 0;

				const snapEgresos = await getDocs(collection(db, "Egresos"));

				snapEgresos.forEach((doc) => {
					const data = doc.data();
					const fechaRaw = data.fecha as Timestamp;
					const fecha = fechaRaw?.toDate?.() ?? new Date(data.fecha);
					const monto: number = data.monto ?? 0;

					if (fecha.getFullYear() === currentYear) {
						const mesIndex = fecha.getMonth();
						yearData[mesIndex].egresos += monto;
						if (mesIndex === currentMonthIndex) {
							egresosMesActual += monto;
						}
					}
				});

				setMetrics({
					totalAlumnos: snapUsers.size + snapHijos.size,
					cursosActivos: snapCursos.size,
					nuevasInscripcionesMes: inscripcionesMesActual,
					ingresosMes: ingresosMesActual,
					egresosMes: egresosMesActual,
					cuotasPendientes,
					cuotasAtrasadas,
				});

				setChartData(yearData);
			} catch (error) {
				console.error("Error cargando métricas del dashboard:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchDashboardData();
		// 🚀 Agregamos selectedYear y selectedMonth a las dependencias para que se dispare al cambiar
	}, [authLoading, adminUser, adminData, router, selectedYear, selectedMonth]);

	if (authLoading || isLoading) {
		return (
			<div className="flex h-[70vh] items-center justify-center">
				<Loader2 className="w-10 h-10 animate-spin text-[#252d62]" />
			</div>
		);
	}

	const balanceMes = metrics.ingresosMes - metrics.egresosMes;

	return (
		<div className="space-y-6">
			{/* 🚀 FILTRO SUPERIOR */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
				<div>
					<h2 className="text-xl font-bold text-[#1a237e]">
						Resumen Financiero
					</h2>
					<p className="text-sm text-gray-500">
						Métricas según el período seleccionado
					</p>
				</div>

				<div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
					<CalendarDays className="w-4 h-4 text-gray-500 ml-2" />
					<select
						value={selectedMonth}
						onChange={(e) => setSelectedMonth(Number(e.target.value))}
						className="bg-transparent text-sm font-semibold text-[#252d62] outline-none cursor-pointer pl-1 pr-2 py-1"
					>
						{MESES_NOMBRES.map((mes, index) => (
							<option key={mes} value={index}>
								{mes}
							</option>
						))}
					</select>
					<span className="text-gray-300">|</span>
					<select
						value={selectedYear}
						onChange={(e) => setSelectedYear(Number(e.target.value))}
						className="bg-transparent text-sm font-semibold text-[#252d62] outline-none cursor-pointer pl-2 pr-2 py-1"
					>
						{yearsOptions.map((year) => (
							<option key={year} value={year}>
								{year}
							</option>
						))}
					</select>
				</div>
			</div>

			{/* ── Fila 1: métricas principales ── */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<MetricsCard
					icon={Users}
					label="Alumnos activos"
					value={metrics.totalAlumnos.toString()}
					trend="En todos los cursos"
				/>
				<MetricsCard
					icon={UserPlus}
					label="Inscripciones del mes"
					value={`+${metrics.nuevasInscripcionesMes}`}
					trend={`En ${MESES_NOMBRES[selectedMonth]}`}
				/>
				<MetricsCard
					icon={BookOpen}
					label="Cursos activos"
					value={metrics.cursosActivos.toString()}
					trend="Catálogo habilitado"
				/>
				<MetricsCard
					icon={Clock}
					label="Cuotas pendientes"
					value={metrics.cuotasPendientes.toString()}
					trend={`${metrics.cuotasAtrasadas} atrasadas`}
				/>
			</div>

			{/* ── Fila 2: balance del mes ── */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
				>
					<div className="flex items-center justify-between mb-3">
						<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
							Ingresos ({MESES_NOMBRES[selectedMonth]})
						</p>
						<div className="bg-green-50 p-2 rounded-lg">
							<TrendingUp className="w-4 h-4 text-green-600" />
						</div>
					</div>
					<p className="text-2xl font-bold text-green-600">
						${metrics.ingresosMes.toLocaleString("es-AR")}
					</p>
					<p className="text-xs text-gray-400 mt-1">
						Cuotas + inscripciones + especiales
					</p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.15 }}
					className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
				>
					<div className="flex items-center justify-between mb-3">
						<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
							Egresos ({MESES_NOMBRES[selectedMonth]})
						</p>
						<div className="bg-red-50 p-2 rounded-lg">
							<TrendingDown className="w-4 h-4 text-red-500" />
						</div>
					</div>
					<p className="text-2xl font-bold text-red-500">
						${metrics.egresosMes.toLocaleString("es-AR")}
					</p>
					<p className="text-xs text-gray-400 mt-1">Gastos registrados</p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
					className={`rounded-xl border shadow-sm p-5 ${
						balanceMes >= 0
							? "bg-[#252d62] border-[#252d62]"
							: "bg-red-600 border-red-600"
					}`}
				>
					<div className="flex items-center justify-between mb-3">
						<p className="text-xs font-semibold text-white/70 uppercase tracking-wider">
							Balance de {MESES_NOMBRES[selectedMonth]}
						</p>
						<div className="bg-white/10 p-2 rounded-lg">
							<Scale className="w-4 h-4 text-white" />
						</div>
					</div>
					<p className="text-2xl font-bold text-white">
						{balanceMes >= 0 ? "+" : ""}${balanceMes.toLocaleString("es-AR")}
					</p>
					<p className="text-xs text-white/60 mt-1">
						{balanceMes >= 0 ? "Resultado positivo" : "Resultado negativo"}
					</p>
				</motion.div>
			</div>

			{/* ── Fila 3: alerta cuotas atrasadas ── */}
			{metrics.cuotasAtrasadas > 0 && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.25 }}
					className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3"
				>
					<AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
					<div>
						<p className="text-sm font-bold text-red-800">
							{metrics.cuotasAtrasadas} cuota
							{metrics.cuotasAtrasadas !== 1 ? "s" : ""} atrasada
							{metrics.cuotasAtrasadas !== 1 ? "s" : ""}
						</p>
						<p className="text-xs text-red-600">
							Hay alumnos con cuotas de meses anteriores sin pagar. Revisá la
							sección de Cuotas.
						</p>
					</div>
				</motion.div>
			)}

			{/* ── Fila 4: gráficos ── */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.3 }}
					className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
				>
					<h3 className="text-lg font-bold text-[#252d62] mb-6">
						Inscripciones en {selectedYear}
					</h3>
					<ResponsiveContainer width="100%" height={280}>
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
								}}
							/>
							<Legend wrapperStyle={{ paddingTop: "16px" }} iconType="circle" />
							<Bar
								dataKey="inscripciones"
								fill="#252d62"
								radius={[6, 6, 0, 0]}
								name="Inscripciones"
							/>
						</BarChart>
					</ResponsiveContainer>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.4 }}
					className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
				>
					<h3 className="text-lg font-bold text-[#252d62] mb-6">
						Ingresos vs Egresos {selectedYear} (ARS)
					</h3>
					<ResponsiveContainer width="100%" height={280}>
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
								}}
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								formatter={(value: any) => [
									`$${Number(value).toLocaleString("es-AR")}`,
								]}
							/>
							<Legend wrapperStyle={{ paddingTop: "16px" }} iconType="circle" />
							<Line
								type="monotone"
								dataKey="ingresos"
								stroke="#16a34a"
								strokeWidth={3}
								dot={{ fill: "#16a34a", r: 4 }}
								activeDot={{ r: 6 }}
								name="Ingresos"
							/>
							<Line
								type="monotone"
								dataKey="egresos"
								stroke="#EE1120"
								strokeWidth={3}
								dot={{ fill: "#EE1120", r: 4 }}
								activeDot={{ r: 6 }}
								name="Egresos"
							/>
						</LineChart>
					</ResponsiveContainer>
				</motion.div>
			</div>
		</div>
	);
}
