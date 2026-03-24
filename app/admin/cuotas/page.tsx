"use client";

import React, { useState, useEffect } from "react";
import {
	CreditCard,
	Plus,
	Filter,
	Search,
	BookOpen,
	Tag,
	Printer,
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

interface TagOption {
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

function calcularMesMaximo(hoy: Date): { anio: number; mes: number } {
	const dia = hoy.getDate();
	const mes = hoy.getMonth() + 1;
	const anio = hoy.getFullYear();

	if (dia >= 15) {
		if (mes === 12) return { anio: anio + 1, mes: 1 };
		return { anio, mes: mes + 1 };
	}
	return { anio, mes };
}

export default function CuotasPage() {
	const today = new Date();
	const currentYear = today.getFullYear();
	const currentMonthValue = `${currentYear}-${String(today.getMonth() + 1).padStart(2, "0")}`;

	const mesMaximo = calcularMesMaximo(today);

	const [printTrigger, setPrintTrigger] = useState(0);

	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("todos");
	const [courseFilter, setCourseFilter] = useState("todos");
	const [tagFilter, setTagFilter] = useState("todos");

	const [activeCourses, setActiveCourses] = useState<CursoOption[]>([]);
	const [activeTags, setActiveTags] = useState<TagOption[]>([]);

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
	const [preloadedDni, setPreloadedDni] = useState("");

	useEffect(() => {
		const fetchSelectOptions = async () => {
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

				const tagsSnap = await getDocs(collection(db, "EtiquetasDescuento"));
				const tagsList: TagOption[] = tagsSnap.docs.map((doc) => ({
					id: doc.id,
					nombre: doc.data().nombre,
				}));
				tagsList.sort((a, b) => a.nombre.localeCompare(b.nombre));
				setActiveTags(tagsList);
			} catch (error) {
				console.error("Error al cargar opciones de filtros:", error);
			}
		};
		fetchSelectOptions();
	}, []);

	const generateMonthOptions = () => {
		const options = [];
		for (let i = 1; i <= 12; i++) {
			const anioMes = currentYear;
			if (
				anioMes > mesMaximo.anio ||
				(anioMes === mesMaximo.anio && i > mesMaximo.mes)
			)
				break;
			const monthNumber = String(i).padStart(2, "0");
			const value = `${anioMes}-${monthNumber}`;
			const label = `${MESES_NOMBRES[i - 1]} ${anioMes}`;
			options.push({ value, label });
		}
		if (mesMaximo.mes === 1 && mesMaximo.anio > currentYear) {
			options.push({
				value: `${mesMaximo.anio}-01`,
				label: `Enero ${mesMaximo.anio}`,
			});
		}
		return options;
	};

	const monthOptions = generateMonthOptions();
	const [selAnio, selMes] = selectedMonth.split("-").map(Number);
	const mesActual = today.getMonth() + 1;
	const anioActual = today.getFullYear();
	const isFutureMonth =
		selAnio > anioActual || (selAnio === anioActual && selMes > mesActual);

	const handlePaymentSuccess = () => setRefreshTrigger((prev) => prev + 1);

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

				<div className="flex items-center gap-3">
					<Button
						onClick={() => setPrintTrigger((prev) => prev + 1)}
						variant="outline"
						className="border-gray-200 text-gray-600 hover:border-[#252d62] hover:text-[#252d62] font-semibold py-5 px-5 rounded-xl flex items-center gap-2 transition-all"
					>
						<Printer className="w-5 h-5" /> Imprimir
					</Button>

					<Button
						onClick={() => setIsModalOpen(true)}
						className="bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold py-5 px-6 rounded-xl flex items-center gap-2 shadow-md transition-all"
					>
						<Plus className="w-5 h-5" /> Registrar Pago Manual
					</Button>
				</div>
			</div>

			{/* ZONA DE FILTROS: Restaurada a tu UI original */}
			<div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-4 items-center justify-between">
				{/* Lado Izquierdo: Buscador, Mes, Curso, Etiqueta */}
				<div className="flex flex-wrap w-full xl:w-auto gap-4 flex-1">
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
				</div>

				{/* Lado Derecho: Estado (Separado por justify-between del contenedor padre) */}
				<div className="flex gap-2 w-full xl:w-auto mt-2 xl:mt-0">
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

					<div className="relative w-full md:w-56">
						<Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
						<select
							value={tagFilter}
							onChange={(e) => setTagFilter(e.target.value)}
							className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 appearance-none bg-white cursor-pointer"
						>
							<option value="todos">Todas las Etiquetas</option>
							<option value="grupo_familiar">Grupo Familiar</option>
							{activeTags.map((tag) => (
								<option key={tag.id} value={tag.nombre}>
									{tag.nombre}
								</option>
							))}
						</select>
					</div>
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="w-full md:w-auto px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 bg-white cursor-pointer font-medium"
					>
						<option value="todos">Todos los estados</option>
						<option value="pagados">Solo Pagados 🟢</option>
						<option value="pendientes">Solo Pendientes 🔴</option>
						<option value="eximidos">Solo Incobrables ⚪</option>
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
					tagFilter={tagFilter}
					refreshTrigger={refreshTrigger}
					isFutureMonth={isFutureMonth}
					setIsModalCobrarOpen={setIsModalOpen}
					printTrigger={printTrigger}
					onCobrar={(dni) => {
						setPreloadedDni(dni);
						setIsModalOpen(true);
					}}
					onCuotasGeneradas={() => setRefreshTrigger((prev) => prev + 1)}
				/>
			</div>

			{/* MODAL */}
			<RegistrarCuotaModal
				isOpen={isModalOpen}
				onClose={() => {
					setIsModalOpen(false);
					setPreloadedDni("");
				}}
				preloadedDni={preloadedDni}
				onSuccess={handlePaymentSuccess}
			/>
		</div>
	);
}
