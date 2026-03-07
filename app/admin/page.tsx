"use client";

import React from "react";
import MetricsCard from "@/components/admin/MetricsCard";
// import InscriptionsTable from '@/components/admin/InscriptionsTable'; // <-- Descomentar cuando la creemos
import { Users, UserPlus, DollarSign, BookOpen } from "lucide-react";
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

const enrollmentData = [
	{ mes: "Enero", inscripciones: 45, ingresos: 11200 },
	{ mes: "Febrero", inscripciones: 52, ingresos: 12800 },
	{ mes: "Marzo", inscripciones: 38, ingresos: 9500 },
	{ mes: "Abril", inscripciones: 61, ingresos: 15200 },
	{ mes: "Mayo", inscripciones: 48, ingresos: 12000 },
	{ mes: "Junio", inscripciones: 55, ingresos: 13700 },
];

export default function AdminDashboardPage() {
	return (
		<>
			{/* Metrics Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
				<MetricsCard
					icon={Users}
					label="Total Alumnos Activos"
					value="450"
					trend="+12% vs mes anterior"
				/>
				<MetricsCard
					icon={UserPlus}
					label="Nuevas Inscripciones del Mes"
					value="+25"
					trend="+8% vs mes anterior"
				/>
				<MetricsCard
					icon={DollarSign}
					label="Ingresos Mensuales"
					value="$12,500"
					trend="+15% vs mes anterior"
				/>
				<MetricsCard
					icon={BookOpen}
					label="Cursos Activos"
					value="18"
					trend="3 nuevos este mes"
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
						Inscripciones por Mes
					</h3>
					<ResponsiveContainer width="100%" height={300}>
						<BarChart data={enrollmentData}>
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
						Ingresos Mensuales (ARS)
					</h3>
					<ResponsiveContainer width="100%" height={300}>
						<LineChart data={enrollmentData}>
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

			{/* Inscriptions Table (Placeholder) */}
			<InscriptionsTable />
		</>
	);
}
