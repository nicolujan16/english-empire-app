"use client";

import React, { useState, useEffect } from "react";
import { CreditCard, Plus, Filter, Search, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import CuotasTable from "@/components/admin/cuotas/CuotasTable";
import RegistrarPagoModal from "@/components/admin/cuotas/RegistrarPagoModal"; // Asegúrate de que esta ruta sea correcta
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

interface CursoOption {
	id: string;
	nombre: string;
}

export default function CuotasPage() {
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("todos");

	// NUEVO ESTADO PARA EL FILTRO DE CURSO
	const [courseFilter, setCourseFilter] = useState("todos");
	const [activeCourses, setActiveCourses] = useState<CursoOption[]>([]);

	// ESTADOS PARA EL MODAL DE PAGO
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [refreshTrigger, setRefreshTrigger] = useState(0); // Para forzar el re-render de la tabla

	const today = new Date();
	const currentYear = today.getFullYear();
	const currentMonthValue = `${currentYear}-${String(today.getMonth() + 1).padStart(2, "0")}`;
	const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);

	// Cargar cursos dinámicamente para el filtro
	useEffect(() => {
		const fetchCourses = async () => {
			try {
				const qCursos = query(
					collection(db, "Cursos"),
					where("active", "==", true),
				);
				const cursosSnap = await getDocs(qCursos);
				const cursosList: CursoOption[] = cursosSnap.docs.map((doc) => ({
					id: doc.id,
					nombre: doc.data().nombre,
				}));
				// Ordenar alfabéticamente
				cursosList.sort((a, b) => a.nombre.localeCompare(b.nombre));
				setActiveCourses(cursosList);
			} catch (error) {
				console.error("Error al cargar cursos para el filtro:", error);
			}
		};
		fetchCourses();
	}, []);

	const generateCurrentYearMonths = () => {
		const options = [];
		const mesesNombres = [
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

		for (let i = 1; i <= 12; i++) {
			const monthNumber = String(i).padStart(2, "0");
			const value = `${currentYear}-${monthNumber}`;
			const label = `${mesesNombres[i - 1]} ${currentYear}`;

			options.push({ value, label });
		}

		return options;
	};

	const monthOptions = generateCurrentYearMonths();

	// Función que se ejecuta cuando el pago es exitoso
	const handlePaymentSuccess = () => {
		// Incrementamos el trigger para que CuotasTable lo note y vuelva a hacer fetch
		setRefreshTrigger((prev) => prev + 1);
	};

	return (
		<div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
			{/* HEADER */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
				<div className="flex items-center gap-3">
					<div className="p-3 bg-green-100 rounded-xl">
						<CreditCard className="w-6 h-6 text-green-700" />
					</div>
					<div>
						<h1 className="text-2xl font-bold text-[#252d62]">
							Gestión de Cuotas
						</h1>
						<p className="text-gray-500 text-sm mt-1">
							Control mensual de pagos, morosidad y cobros en efectivo.
						</p>
					</div>
				</div>

				{/* BOTÓN REGISTRAR PAGO MANUAL */}
				<Button
					onClick={() => setIsModalOpen(true)}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold py-5 px-6 rounded-xl flex items-center gap-2 shadow-md transition-all"
				>
					<Plus className="w-5 h-5" />
					Registrar Pago Manual
				</Button>
			</div>

			{/* ZONA DE FILTROS */}
			<div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-4 items-center justify-between">
				{/* GRUPO IZQUIERDO DE FILTROS */}
				<div className="flex flex-wrap w-full xl:w-auto gap-4">
					{/* BUSCADOR */}
					<div className="relative w-full md:w-64">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
						<input
							type="text"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							placeholder="Buscar alumno o DNI..."
							className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20"
						/>
					</div>

					{/* SELECTOR DE MES */}
					<div className="relative w-full md:w-48">
						<Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
						<select
							value={selectedMonth}
							onChange={(e) => setSelectedMonth(e.target.value)}
							className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 appearance-none bg-white cursor-pointer"
						>
							{monthOptions.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.value === currentMonthValue
										? `${opt.label} (Actual)`
										: opt.label}
								</option>
							))}
						</select>
					</div>

					{/* NUEVO SELECTOR DE CURSO */}
					<div className="relative w-full md:w-56">
						<BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
						<select
							value={courseFilter}
							onChange={(e) => setCourseFilter(e.target.value)}
							className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 appearance-none bg-white cursor-pointer"
						>
							<option value="todos">Todos los Cursos</option>
							{activeCourses.map((curso) => (
								<option key={curso.id} value={curso.id}>
									{curso.nombre}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* SELECTOR DE ESTADO (SEMÁFORO) */}
				<div className="flex gap-2 w-full xl:w-auto mt-2 xl:mt-0">
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="w-full md:w-auto px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 bg-white cursor-pointer font-medium"
					>
						<option value="todos">Todos los estados</option>
						<option value="pagados">Solo Pagados 🟢</option>
						<option value="pendientes">Solo Pendientes 🔴</option>
					</select>
				</div>
			</div>

			{/* CONTENEDOR DE LA TABLA */}
			<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px] flex flex-col relative">
				<CuotasTable
					searchTerm={searchTerm}
					selectedMonth={selectedMonth}
					statusFilter={statusFilter}
					courseFilter={courseFilter}
					refreshTrigger={refreshTrigger}
					setIsModalCobrarOpen={setIsModalOpen}
				/>
			</div>

			{/* MODAL DE REGISTRO DE PAGO */}
			<RegistrarPagoModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onSuccess={handlePaymentSuccess}
			/>
		</div>
	);
}
