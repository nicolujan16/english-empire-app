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
	RefreshCw,
	Loader2,
	CheckCircle2,
	AlertCircle,
	AlertTriangle,
	X,
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

	// ── Generar Cuotas Faltantes ─────────────────────────────────────────
	const [isGenerarModalOpen, setIsGenerarModalOpen] = useState(false);
	const [generarStep, setGenerarStep] = useState<"selection" | "loading" | "result">("selection");
	const [generarMes, setGenerarMes] = useState(today.getMonth() + 1);
	const [generarAnio, setGenerarAnio] = useState(2026);
	const [generarResult, setGenerarResult] = useState<{
		ok: boolean;
		mes: number;
		anio: number;
		creadas: number;
		omitidas: number;
		errores: number;
		error?: string;
	} | null>(null);

	const openGenerarModal = () => {
		setGenerarStep("selection");
		setGenerarMes(today.getMonth() + 1);
		setGenerarAnio(2026);
		setGenerarResult(null);
		setIsGenerarModalOpen(true);
	};

	const handleConfirmGenerar = async () => {
		setGenerarStep("loading");
		try {
			const res = await fetch(`https://testcrearcuotas-sls2yii7ua-rj.a.run.app/?mes=${generarMes}&anio=${generarAnio}`);
			const data = await res.json();
			setGenerarResult(data);
		} catch (error) {
			setGenerarResult({
				ok: false,
				mes: generarMes,
				anio: generarAnio,
				creadas: 0,
				omitidas: 0,
				errores: 0,
				error: String(error),
			});
		} finally {
			setGenerarStep("result");
			// Refrescar tabla para mostrar cuotas nuevas
			setRefreshTrigger((prev) => prev + 1);
		}
	};

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

					{/* OCULTO TEMPORALMENTE PARA PRUEBAS
					<Button
						onClick={openGenerarModal}
						variant="outline"
						className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 font-semibold py-5 px-5 rounded-xl flex items-center gap-2 transition-all"
					>
						<RefreshCw className="w-4 h-4" /> Generar Cuotas Faltantes
					</Button>
					*/}

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
			{/* MODAL: Generar cuotas faltantes */}
			{isGenerarModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div
						className="absolute inset-0 bg-black/40 backdrop-blur-sm"
						onClick={() => generarStep !== "loading" && setIsGenerarModalOpen(false)}
					/>
					<div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5">
						{generarStep !== "loading" && (
							<button
								onClick={() => setIsGenerarModalOpen(false)}
								className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
							>
								<X className="w-5 h-5" />
							</button>
						)}

						{generarStep === "selection" && (
							<>
								<div className="flex flex-col items-center text-center gap-3">
									<div className="bg-amber-100 p-4 rounded-full">
										<RefreshCw className="w-8 h-8 text-amber-500" />
									</div>
									<h2 className="text-xl font-bold text-[#252d62]">Generar Cuotas Faltantes</h2>
								</div>
								<p className="text-sm text-gray-600 text-center leading-relaxed">
									Seleccioná el mes y año para el cual querés generar las cuotas faltantes.
								</p>
								
								<div className="flex gap-4">
									<div className="flex-1 space-y-2 text-left">
										<label className="text-sm font-semibold text-gray-700">Mes</label>
										<select 
											value={generarMes} 
											onChange={(e) => setGenerarMes(Number(e.target.value))}
											className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20"
										>
											{MESES_NOMBRES.map((nombre, i) => (
												<option key={i + 1} value={i + 1}>{nombre}</option>
											))}
										</select>
									</div>
									<div className="flex-1 space-y-2 text-left">
										<label className="text-sm font-semibold text-gray-700">Año</label>
										<select 
											value={generarAnio} 
											onChange={(e) => setGenerarAnio(Number(e.target.value))}
											className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#252d62]/20"
										>
											<option value={2024}>2024</option>
											<option value={2025}>2025</option>
											<option value={2026}>2026</option>
											<option value={2027}>2027</option>
										</select>
									</div>
								</div>

								<div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
									<AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
									<p className="text-xs text-amber-800 leading-relaxed text-left">
										<span className="font-bold">Nota:</span> Esta operación puede demorar. Solo se crearán las cuotas que aún no existan para el período seleccionado.
									</p>
								</div>

								<div className="flex gap-3 pt-1">
									<Button
										variant="outline"
										onClick={() => setIsGenerarModalOpen(false)}
										className="flex-1 py-5 rounded-xl font-semibold border-gray-200 text-gray-600 hover:border-gray-300"
									>
										Cancelar
									</Button>
									<Button
										onClick={handleConfirmGenerar}
										className="flex-1 py-5 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2 shadow-sm transition-all"
									>
										<RefreshCw className="w-4 h-4" /> Generar
									</Button>
								</div>
							</>
						)}

						{generarStep === "loading" && (
							<div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
								<Loader2 className="w-12 h-12 text-[#252d62] animate-spin" />
								<h3 className="text-lg font-bold text-[#252d62]">Generando cuotas...</h3>
								<p className="text-sm text-gray-500">
									Esto puede tardar unos segundos dependiendo de la cantidad de alumnos. Por favor, no cierres esta ventana.
								</p>
							</div>
						)}

						{generarStep === "result" && generarResult && (
							<div className="flex flex-col items-center text-center gap-4">
								{generarResult.ok ? (
									<div className="bg-green-100 p-4 rounded-full mb-2">
										<CheckCircle2 className="w-10 h-10 text-green-600" />
									</div>
								) : (
									<div className="bg-red-100 p-4 rounded-full mb-2">
										<AlertCircle className="w-10 h-10 text-red-600" />
									</div>
								)}
								
								<h2 className="text-xl font-bold text-[#252d62]">
									{generarResult.ok ? "¡Proceso Completado!" : "Error en el Proceso"}
								</h2>

								{generarResult.ok ? (
									<div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm">
										<div className="flex justify-between py-2 border-b border-gray-200">
											<span className="text-gray-600">Período:</span>
											<span className="font-bold text-[#252d62]">
												{MESES_NOMBRES[generarResult.mes - 1]} {generarResult.anio}
											</span>
										</div>
										<div className="flex justify-between py-2 border-b border-gray-200">
											<span className="text-gray-600">Cuotas creadas:</span>
											<span className="font-bold text-green-600">+{generarResult.creadas}</span>
										</div>
										<div className="flex justify-between py-2 border-b border-gray-200">
											<span className="text-gray-600">Ya existían (omitidas):</span>
											<span className="font-bold text-gray-500">{generarResult.omitidas}</span>
										</div>
										<div className="flex justify-between py-2">
											<span className="text-gray-600">Errores al crear:</span>
											<span className={`font-bold ${generarResult.errores > 0 ? "text-red-500" : "text-gray-500"}`}>
												{generarResult.errores}
											</span>
										</div>
									</div>
								) : (
									<div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl border border-red-100 w-full text-left">
										<p className="font-bold mb-1">Hubo un problema al contactar el servidor:</p>
										<p className="text-xs break-words">{generarResult.error || "Error desconocido"}</p>
									</div>
								)}

								<Button
									onClick={() => setIsGenerarModalOpen(false)}
									className="w-full py-5 rounded-xl font-bold bg-[#252d62] hover:bg-[#1a2044] text-white mt-2"
								>
									Cerrar
								</Button>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
