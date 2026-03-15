"use client";

import React, { useState, useEffect } from "react";
import {
	CreditCard,
	Plus,
	Filter,
	Search,
	BookOpen,
	CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CuotasTable from "@/components/admin/cuotas/CuotasTable";
import RegistrarCuotaModal from "@/components/admin/cuotas/RegistrarCuotaModal";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

interface CursoOption {
	id: string;
	nombre: string;
}

const MESES_NOMBRES = [
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

// ⚠️  MODO TEST — poner en false para volver al comportamiento real
//     Con true: el selector muestra el mes siguiente y lo selecciona por defecto,
//     ignorando la regla del día 20.
const TEST_MODE = true;

function calcularMesMaximo(hoy: Date): { anio: number; mes: number } {
	const dia = hoy.getDate();
	const mes = hoy.getMonth() + 1;
	const anio = hoy.getFullYear();

	if (dia >= 20) {
		if (mes === 12) return { anio: anio + 1, mes: 1 };
		return { anio, mes: mes + 1 };
	}

	return { anio, mes };
}

function calcularAvisoProximoMes(hoy: Date): string | null {
	const dia = hoy.getDate();
	if (dia >= 20) return null;

	const mesActualNombre = MESES_NOMBRES[hoy.getMonth()];
	const mesSiguienteNombre = MESES_NOMBRES[(hoy.getMonth() + 1) % 12];

	return `El calculo de las cuotas de ${mesSiguienteNombre} se habilitarán el 20 de ${mesActualNombre}.`;
}

export default function CuotasPage() {
	const today = new Date();
	const currentYear = today.getFullYear();
	const currentMonthValue = `${currentYear}-${String(today.getMonth() + 1).padStart(2, "0")}`;

	// En TEST_MODE simulamos que ya pasó el día 20, habilitando el mes siguiente
	const mesMaximo = TEST_MODE
		? calcularMesMaximo(new Date(today.getFullYear(), today.getMonth(), 20))
		: calcularMesMaximo(today);

	const avisoProximoMes = TEST_MODE ? null : calcularAvisoProximoMes(today);

	// En TEST_MODE arrancamos con el mes siguiente seleccionado por defecto
	const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
	const nextMonthValue = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
	const defaultMonth = TEST_MODE ? nextMonthValue : currentMonthValue;

	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("todos");
	const [courseFilter, setCourseFilter] = useState("todos");
	const [activeCourses, setActiveCourses] = useState<CursoOption[]>([]);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

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
				cursosList.sort((a, b) => a.nombre.localeCompare(b.nombre));
				setActiveCourses(cursosList);
			} catch (error) {
				console.error("Error al cargar cursos para el filtro:", error);
			}
		};
		fetchCourses();
	}, []);

	const generateMonthOptions = () => {
		const options = [];

		for (let i = 1; i <= 12; i++) {
			const anioMes =
				i === 1 && mesMaximo.mes === 1 && mesMaximo.anio > currentYear
					? mesMaximo.anio
					: currentYear;

			if (
				anioMes > mesMaximo.anio ||
				(anioMes === mesMaximo.anio && i > mesMaximo.mes)
			) {
				break;
			}

			const monthNumber = String(i).padStart(2, "0");
			const value = `${anioMes}-${monthNumber}`;
			const label = `${MESES_NOMBRES[i - 1]} ${anioMes}`;
			options.push({ value, label });
		}

		return options;
	};

	const monthOptions = generateMonthOptions();

	const handlePaymentSuccess = () => {
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

				<Button
					onClick={() => setIsModalOpen(true)}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold py-5 px-6 rounded-xl flex items-center gap-2 shadow-md transition-all"
				>
					<Plus className="w-5 h-5" />
					Registrar Pago Manual
				</Button>
			</div>

			{/* AVISO DE PRÓXIMO MES (solo visible antes del día 20, nunca en TEST_MODE) */}
			{avisoProximoMes && (
				<div className="flex items-center gap-2 text-gray-400">
					<CalendarClock className="w-3.5 h-3.5 shrink-0" />
					<p className="text-xs">{avisoProximoMes}</p>
				</div>
			)}

			{/* INDICADOR VISUAL DE TEST_MODE */}
			{TEST_MODE && (
				<div className="flex items-center gap-2 text-amber-500">
					<CalendarClock className="w-3.5 h-3.5 shrink-0" />
					<p className="text-xs font-medium">
						Modo test activo — mostrando mes siguiente. Cambiar TEST_MODE a
						false para producción.
					</p>
				</div>
			)}

			{/* ZONA DE FILTROS */}
			<div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-4 items-center justify-between">
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

					{/* SELECTOR DE CURSO */}
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

				{/* SELECTOR DE ESTADO */}
				<div className="flex gap-2 w-full xl:w-auto mt-2 xl:mt-0">
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="w-full md:w-auto px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 bg-white cursor-pointer font-medium"
					>
						<option value="todos">Todos los estados</option>
						<option value="pagados">Solo Pagados 🟢</option>
						<option value="pendientes">Solo Pendientes 🔴</option>
						<option value="eximidos">Solo Eximidos ⚪</option>
					</select>
				</div>
			</div>

			{/* TABLA */}
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

			{/* MODAL */}
			<RegistrarCuotaModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onSuccess={handlePaymentSuccess}
			/>
		</div>
	);
}
