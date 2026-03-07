"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Filter, Pencil, Loader2, ChevronDown, X } from "lucide-react";
import { motion } from "framer-motion";

// --- FIRESTORE IMPORTS ---
import {
	collection,
	onSnapshot,
	query,
	doc,
	updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

// IMPORTAMOS EL MODAL Y SUS TIPOS
import EditInscriptionModal, {
	Inscription,
	InscriptionStatus,
} from "./EditarInscriptionModal";

// Extendemos la interfaz para la tabla
interface InscriptionRow extends Inscription {
	paymentMethod: string;
	tipoAlumno?: string;
	fechaPromesaPago?: string;
}

interface InscriptionsTableProps {
	showTitle?: boolean; // Prop opcional, por defecto true
}

const InscriptionsTable = ({ showTitle = true }: InscriptionsTableProps) => {
	// Estados de Filtros
	const [searchTerm, setSearchTerm] = useState<string>("");
	const [courseFilter, setCourseFilter] = useState<string>("Todos");
	const [paymentFilter, setPaymentFilter] = useState<string>("Todos");
	const [statusFilter, setStatusFilter] = useState<string>("Todos");

	// Estados de Datos
	const [inscriptions, setInscriptions] = useState<InscriptionRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Estados del Modal
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [inscriptionToEdit, setInscriptionToEdit] =
		useState<Inscription | null>(null);

	// 1. TRAER DATOS DE FIRESTORE EN TIEMPO REAL
	useEffect(() => {
		const inscripcionesRef = collection(db, "Inscripciones");
		// Traemos ordenado por fecha de creación en la BD (si tuvieras un campo Timestamp real sería ideal)
		const q = query(inscripcionesRef);

		const unsubscribe = onSnapshot(
			q,
			(snapshot) => {
				const data: InscriptionRow[] = [];

				snapshot.forEach((docSnap) => {
					const item = docSnap.data();

					// Formateo seguro de fecha
					let fechaFormateada = "Sin fecha";
					if (item.fecha) {
						if (typeof item.fecha.toDate === "function") {
							fechaFormateada = item.fecha
								.toDate()
								.toLocaleDateString("es-AR", {
									day: "2-digit",
									month: "2-digit",
									year: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								});
						} else if (typeof item.fecha === "string") {
							fechaFormateada = item.fecha;
						}
					}

					// Promesa de pago
					let formattedPromesa = undefined;
					if (item.fechaPromesaPago) {
						const [year, month, day] = item.fechaPromesaPago.split("-");
						if (day && month && year) {
							formattedPromesa = `${day}/${month}/${year}`;
						} else {
							formattedPromesa = item.fechaPromesaPago;
						}
					}

					data.push({
						id: docSnap.id,
						fecha: fechaFormateada,
						alumnoNombre: item.alumnoNombre || "Sin nombre",
						alumnoDni: item.alumnoDni || "Sin DNI",
						cursoNombre: item.cursoNombre || "Sin curso",
						cursoInscripcion: item.cursoInscripcion || 0,
						status: item.status || "Pendiente",
						paymentMethod: item.paymentMethod || "No especificado",
						tipoAlumno: item.tipoAlumno || "Desconocido",
						fechaPromesaPago: formattedPromesa,
					});
				});

				// Invertimos asumiendo que vienen por ID y queremos los últimos arriba (fallback si no hay Timestamp 'createdAt')
				setInscriptions(data.reverse());
				setIsLoading(false);
			},
			(error) => {
				console.error("Error trayendo inscripciones:", error);
				setIsLoading(false);
			},
		);

		return () => unsubscribe();
	}, []);

	// 2. OPCIONES DINÁMICAS PARA SELECTS
	const uniqueCourses = [
		"Todos",
		...Array.from(new Set(inscriptions.map((i) => i.cursoNombre))),
	];
	const uniquePayments = [
		"Todos",
		...Array.from(new Set(inscriptions.map((i) => i.paymentMethod))),
	];
	const uniqueStatuses = ["Todos", "Confirmado", "Pendiente", "Cancelado"]; // Fijos por negocio

	// 3. LÓGICA DE FILTRADO
	const filteredInscriptions = useMemo(() => {
		return inscriptions.filter((item) => {
			// Filtro de texto (Search)
			const searchLower = searchTerm.toLowerCase();
			const matchesSearch =
				item.alumnoNombre.toLowerCase().includes(searchLower) ||
				item.alumnoDni.includes(searchLower) ||
				item.cursoNombre.toLowerCase().includes(searchLower);

			// Filtros de Dropdown
			const matchesCourse =
				courseFilter === "Todos" || item.cursoNombre === courseFilter;
			const matchesPayment =
				paymentFilter === "Todos" || item.paymentMethod === paymentFilter;
			const matchesStatus =
				statusFilter === "Todos" || item.status === statusFilter;

			return matchesSearch && matchesCourse && matchesPayment && matchesStatus;
		});
	}, [inscriptions, searchTerm, courseFilter, paymentFilter, statusFilter]);

	// 4. ESTILOS Y ACCIONES
	const getStatusBadge = (estado: InscriptionStatus) => {
		const styles: Record<string, string> = {
			Confirmado: "bg-green-100 text-green-800 border-green-200",
			Pendiente: "bg-yellow-100 text-yellow-800 border-yellow-200",
			Cancelado: "bg-red-100 text-red-800 border-red-200",
		};
		return styles[estado] || styles["Pendiente"];
	};

	const handleEditClick = (inscription: InscriptionRow) => {
		setInscriptionToEdit(inscription);
		setIsEditModalOpen(true);
	};

	const handleSaveInscription = async (
		id: string,
		nuevoEstado: InscriptionStatus,
		nuevoMonto: number,
	) => {
		try {
			const docRef = doc(db, "Inscripciones", id);
			await updateDoc(docRef, {
				status: nuevoEstado,
				cursoInscripcion: nuevoMonto,
			});
		} catch (error) {
			console.error("Error guardando inscripción:", error);
			throw error;
		}
	};

	return (
		<>
			<div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full min-h-[500px]">
				{/* HEADER OPCIONAL */}
				{showTitle && (
					<div className="p-6 border-b border-gray-100 shrink-0">
						<div className="flex items-center justify-between gap-4 flex-wrap">
							<h2 className="text-xl font-bold text-[#252d62]">
								Inscripciones Recientes
							</h2>
						</div>
					</div>
				)}

				{/* BARRA DE FILTROS SUPERIOR */}
				<div className="p-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
					<div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
						{/* Buscador */}
						<div className="relative w-full xl:w-96 group">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<Search className="h-4 w-4 text-gray-400 group-focus-within:text-[#252d62] transition-colors" />
							</div>
							<input
								type="text"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="text-black block w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] sm:text-sm transition-all"
								placeholder="Buscar alumno, DNI o curso..."
							/>
							{searchTerm && (
								<button
									onClick={() => setSearchTerm("")}
									className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
								>
									<X className="h-4 w-4" />
								</button>
							)}
						</div>

						{/* Selects de Filtros */}
						<div className="flex flex-wrap gap-3 w-full xl:w-auto">
							{/* Filtro Curso */}
							<div className="relative flex-1 sm:flex-none">
								<select
									value={courseFilter}
									onChange={(e) => setCourseFilter(e.target.value)}
									className="appearance-none w-full sm:w-auto bg-white border border-gray-200 text-gray-700 py-2 pl-9 pr-8 rounded-md focus:outline-none focus:border-[#252d62] focus:ring-2 focus:ring-[#252d62]/20 text-sm font-medium cursor-pointer hover:border-[#252d62] transition-colors"
								>
									{uniqueCourses.map((course) => (
										<option key={`course-${course}`} value={course}>
											{course === "Todos" ? "Todos los Cursos" : course}
										</option>
									))}
								</select>
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
									<Filter className="h-3.5 w-3.5" />
								</div>
								<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
									<ChevronDown className="h-4 w-4" />
								</div>
							</div>

							{/* Filtro Pago */}
							<div className="relative flex-1 sm:flex-none">
								<select
									value={paymentFilter}
									onChange={(e) => setPaymentFilter(e.target.value)}
									className="appearance-none w-full sm:w-auto bg-white border border-gray-200 text-gray-700 py-2 pl-9 pr-8 rounded-md focus:outline-none focus:border-[#252d62] focus:ring-2 focus:ring-[#252d62]/20 text-sm font-medium cursor-pointer hover:border-[#252d62] transition-colors"
								>
									{uniquePayments.map((payment) => (
										<option key={`pay-${payment}`} value={payment}>
											{payment === "Todos" ? "Todos los Pagos" : payment}
										</option>
									))}
								</select>
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
									<Filter className="h-3.5 w-3.5" />
								</div>
								<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
									<ChevronDown className="h-4 w-4" />
								</div>
							</div>

							{/* Filtro Estado */}
							<div className="relative flex-1 sm:flex-none">
								<select
									value={statusFilter}
									onChange={(e) => setStatusFilter(e.target.value)}
									className="appearance-none w-full sm:w-auto bg-white border border-gray-200 text-gray-700 py-2 pl-9 pr-8 rounded-md focus:outline-none focus:border-[#252d62] focus:ring-2 focus:ring-[#252d62]/20 text-sm font-medium cursor-pointer hover:border-[#252d62] transition-colors"
								>
									{uniqueStatuses.map((status) => (
										<option key={`status-${status}`} value={status}>
											{status === "Todos" ? "Todos los Estados" : status}
										</option>
									))}
								</select>
								<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
									<Filter className="h-3.5 w-3.5" />
								</div>
								<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
									<ChevronDown className="h-4 w-4" />
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* TABLA & LOADER */}
				<div className="overflow-x-auto flex-1">
					{isLoading ? (
						<div className="flex flex-col justify-center items-center h-full min-h-[300px] gap-4">
							<Loader2 className="w-10 h-10 animate-spin text-[#EE1120]" />
							<p className="text-gray-500 font-medium">
								Cargando inscripciones...
							</p>
						</div>
					) : (
						<table className="w-full">
							<thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
								<tr>
									<th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
										Fecha
									</th>
									<th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
										Alumno
									</th>
									<th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
										DNI
									</th>
									<th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
										Curso
									</th>
									<th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
										Método de Pago
									</th>
									<th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
										Monto
									</th>
									<th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
										Estado
									</th>
									<th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
										Acciones
									</th>
								</tr>
							</thead>
							<tbody className="bg-white divide-y divide-gray-100">
								{filteredInscriptions.map((item, index) => (
									<motion.tr
										key={item.id}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.2, delay: index * 0.02 }}
										className="hover:bg-blue-50/50 transition-colors duration-150"
									>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
											{item.fecha}
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="flex items-center">
												<div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-[#252d62] font-bold text-xs mr-3 shrink-0">
													{item.alumnoNombre.charAt(0).toUpperCase()}
												</div>
												<div className="flex flex-col">
													<span className="text-sm font-bold text-[#252d62]">
														{item.alumnoNombre}
													</span>
													<span className="text-[10px] text-gray-400 uppercase font-semibold">
														{item.tipoAlumno}
													</span>
												</div>
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
											{item.alumnoDni}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-[#252d62] font-bold">
											{item.cursoNombre}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
											{item.paymentMethod}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
											${item.cursoInscripcion.toLocaleString("es-AR")}
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="flex flex-col items-start gap-1">
												<span
													className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadge(item.status)}`}
												>
													{item.status}
												</span>
												{item.status === "Pendiente" &&
													item.fechaPromesaPago && (
														<span className="text-[10px] text-gray-500 font-medium pl-1">
															Paga el: {item.fechaPromesaPago}
														</span>
													)}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-right">
											<div className="flex items-center justify-end gap-2">
												<button
													onClick={() => handleEditClick(item)}
													className="p-1.5 text-gray-400 hover:text-[#EE1120] hover:bg-gray-100 rounded-lg transition-colors group"
													title="Editar inscripción"
												>
													<Pencil className="w-4 h-4" />
												</button>
											</div>
										</td>
									</motion.tr>
								))}
							</tbody>
						</table>
					)}

					{!isLoading && filteredInscriptions.length === 0 && (
						<div className="p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
							<Search className="h-10 w-10 text-gray-300 mb-3" />
							<p className="text-lg font-bold text-[#252d62]">
								No se encontraron inscripciones
							</p>
							<p className="text-sm mt-1 text-gray-500">
								Ajusta tus filtros de búsqueda.
							</p>
						</div>
					)}
				</div>
			</div>

			{/* INSTANCIAMOS EL MODAL AQUÍ */}
			<EditInscriptionModal
				isOpen={isEditModalOpen}
				onClose={() => setIsEditModalOpen(false)}
				inscriptionToEdit={inscriptionToEdit}
				onSave={handleSaveInscription}
			/>
		</>
	);
};

export default InscriptionsTable;
