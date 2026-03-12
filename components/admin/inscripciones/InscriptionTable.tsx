"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
	Search,
	Filter,
	Pencil,
	Trash2, // <-- Importamos Trash2
	Loader2,
	ChevronDown,
	X,
	Calendar,
	CreditCard as CreditCardIcon,
	Book,
	AlertTriangle, // <-- Para el ícono de alerta del Modal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- FIRESTORE IMPORTS ---
import {
	collection,
	onSnapshot,
	query,
	doc,
	updateDoc,
	deleteDoc, // <-- Importado
	arrayRemove, // <-- Importado
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

// IMPORTAMOS LOS COMPONENTES DE UI PARA EL MODAL
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// IMPORTAMOS EL MODAL DE EDICIÓN Y SUS TIPOS
import EditInscriptionModal, {
	Inscription,
	InscriptionStatus,
} from "./EditarInscriptionModal";

// Extendemos la interfaz para la tabla
interface InscriptionRow extends Inscription {
	paymentMethod: string;
	tipoAlumno?: string;
	fechaPromesaPago?: string;
	alumnoId?: string; // <-- Súper necesario para el borrado
	cursoId?: string; // <-- Súper necesario para el borrado
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

	// Estados del Modal de Edición
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [inscriptionToEdit, setInscriptionToEdit] =
		useState<Inscription | null>(null);

	// --- ESTADOS PARA EL MODAL DE BORRADO ---
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [inscriptionToDelete, setInscriptionToDelete] =
		useState<InscriptionRow | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	useEffect(() => {
		const inscripcionesRef = collection(db, "Inscripciones");
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
						// --- Extraemos los IDs que vimos en tu base de datos ---
						alumnoId: item.alumnoId,
						cursoId: item.cursoId,
					});
				});

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

	const uniqueCourses = [
		"Todos",
		...Array.from(new Set(inscriptions.map((i) => i.cursoNombre))),
	];
	const uniquePayments = [
		"Todos",
		...Array.from(new Set(inscriptions.map((i) => i.paymentMethod))),
	];
	const uniqueStatuses = ["Todos", "Confirmado", "Pendiente", "Cancelado"];

	const filteredInscriptions = useMemo(() => {
		return inscriptions.filter((item) => {
			const searchLower = searchTerm.toLowerCase();
			const matchesSearch =
				item.alumnoNombre.toLowerCase().includes(searchLower) ||
				item.alumnoDni.includes(searchLower) ||
				item.cursoNombre.toLowerCase().includes(searchLower);

			const matchesCourse =
				courseFilter === "Todos" || item.cursoNombre === courseFilter;
			const matchesPayment =
				paymentFilter === "Todos" || item.paymentMethod === paymentFilter;
			const matchesStatus =
				statusFilter === "Todos" || item.status === statusFilter;

			return matchesSearch && matchesCourse && matchesPayment && matchesStatus;
		});
	}, [inscriptions, searchTerm, courseFilter, paymentFilter, statusFilter]);

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
		nuevoMetodoPago?: string,
	) => {
		try {
			const docRef = doc(db, "Inscripciones", id);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const updateData: any = {
				status: nuevoEstado,
				cursoInscripcion: nuevoMonto,
			};

			if (nuevoMetodoPago) {
				updateData.paymentMethod = nuevoMetodoPago;
			}

			await updateDoc(docRef, updateData);
		} catch (error) {
			alert(`Error guardando inscripción ${error}`);
			throw error;
		}
	};
	// --- LÓGICA DE BORRADO ---
	const triggerDeleteModal = (inscription: InscriptionRow) => {
		setInscriptionToDelete(inscription);
		setIsDeleteModalOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (!inscriptionToDelete) return;
		setIsDeleting(true);

		try {
			const docRef = doc(db, "Inscripciones", inscriptionToDelete.id);
			await deleteDoc(docRef);

			if (inscriptionToDelete.alumnoId && inscriptionToDelete.cursoId) {
				const collectionName =
					inscriptionToDelete.tipoAlumno === "Titular" ? "Users" : "Hijos";
				console.log(
					"Borrando inscripción del alumno con ID:",
					inscriptionToDelete.alumnoId,
				);
				console.log("Borrando curso con ID:", inscriptionToDelete.cursoId);
				const studentRef = doc(
					db,
					collectionName,
					inscriptionToDelete.alumnoId,
				);

				await updateDoc(studentRef, {
					cursos: arrayRemove(inscriptionToDelete.cursoId),
				});
			}

			setIsDeleteModalOpen(false);
			setInscriptionToDelete(null);
		} catch (error) {
			console.error("Error eliminando inscripción:", error);
			alert("Hubo un error al intentar eliminar la inscripción.");
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<>
			<div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col max-h-screen">
				{/* HEADER OPCIONAL */}
				{showTitle && (
					<div className="p-4 sm:p-6 border-b border-gray-100 shrink-0">
						<div className="flex items-center justify-between gap-4 flex-wrap">
							<h2 className="text-lg sm:text-xl font-bold text-[#252d62]">
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
						<div className="grid grid-cols-1 sm:grid-cols-3 xl:flex gap-3 w-full xl:w-auto">
							<div className="relative w-full">
								<select
									value={courseFilter}
									onChange={(e) => setCourseFilter(e.target.value)}
									className="appearance-none w-full bg-white border border-gray-200 text-gray-700 py-2 pl-9 pr-8 rounded-md focus:outline-none focus:border-[#252d62] focus:ring-2 focus:ring-[#252d62]/20 text-sm font-medium cursor-pointer hover:border-[#252d62] transition-colors"
								>
									{uniqueCourses.map((course) => (
										<option key={`course-${course}`} value={course}>
											{course === "Todos" ? "Cursos (Todos)" : course}
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

							<div className="relative w-full">
								<select
									value={paymentFilter}
									onChange={(e) => setPaymentFilter(e.target.value)}
									className="appearance-none w-full bg-white border border-gray-200 text-gray-700 py-2 pl-9 pr-8 rounded-md focus:outline-none focus:border-[#252d62] focus:ring-2 focus:ring-[#252d62]/20 text-sm font-medium cursor-pointer hover:border-[#252d62] transition-colors"
								>
									{uniquePayments.map((payment) => (
										<option key={`pay-${payment}`} value={payment}>
											{payment === "Todos" ? "Pagos (Todos)" : payment}
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

							<div className="relative w-full">
								<select
									value={statusFilter}
									onChange={(e) => setStatusFilter(e.target.value)}
									className="appearance-none w-full bg-white border border-gray-200 text-gray-700 py-2 pl-9 pr-8 rounded-md focus:outline-none focus:border-[#252d62] focus:ring-2 focus:ring-[#252d62]/20 text-sm font-medium cursor-pointer hover:border-[#252d62] transition-colors"
								>
									{uniqueStatuses.map((status) => (
										<option key={`status-${status}`} value={status}>
											{status === "Todos" ? "Estados (Todos)" : status}
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

				{/* CONTENIDO PRINCIPAL: TABLA (DESKTOP) / CARDS (MÓVIL) */}
				<div className="flex-1 overflow-hidden flex flex-col">
					{isLoading ? (
						<div className="flex flex-col justify-center items-center h-full min-h-[300px] gap-4">
							<Loader2 className="w-10 h-10 animate-spin text-[#EE1120]" />
							<p className="text-gray-500 font-medium">
								Cargando inscripciones...
							</p>
						</div>
					) : (
						<div className="overflow-auto h-full w-full">
							{/* --- VISTA MÓVIL (Tarjetas) --- */}
							<div className="md:hidden flex flex-col p-4 gap-4 bg-gray-50/30">
								{filteredInscriptions.map((item, index) => (
									<motion.div
										key={`mobile-${item.id}`}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.2, delay: index * 0.05 }}
										className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 relative"
									>
										{/* Botones de acción en móvil (Editar y Borrar) */}
										<div className="absolute top-4 right-4 flex items-center gap-1">
											<button
												onClick={() => handleEditClick(item)}
												className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
											>
												<Pencil className="w-4 h-4" />
											</button>
											<button
												onClick={() => triggerDeleteModal(item)}
												className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
											>
												<Trash2 className="w-4 h-4" />
											</button>
										</div>

										<div className="flex items-center gap-3 mb-3 border-b border-gray-100 pb-3 pr-20">
											<div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-[#252d62] font-bold text-sm shrink-0">
												{item.alumnoNombre.charAt(0).toUpperCase()}
											</div>
											<div>
												<h3 className="font-bold text-[#252d62] text-base leading-tight">
													{item.alumnoNombre}
												</h3>
												<div className="flex items-center gap-2 mt-0.5">
													<span className="text-xs text-gray-500 font-mono">
														{item.alumnoDni}
													</span>
													<span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase font-semibold">
														{item.tipoAlumno}
													</span>
												</div>
											</div>
										</div>

										<div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
											<div className="flex flex-col">
												<span className="text-xs text-gray-400 flex items-center gap-1">
													<Book className="w-3 h-3" /> Curso
												</span>
												<span className="font-bold text-[#252d62]">
													{item.cursoNombre}
												</span>
											</div>
											<div className="flex flex-col">
												<span className="text-xs text-gray-400 flex items-center gap-1">
													<CreditCardIcon className="w-3 h-3" /> Monto
												</span>
												<span className="font-bold text-gray-900">
													${item.cursoInscripcion.toLocaleString("es-AR")}
												</span>
											</div>
											<div className="flex flex-col">
												<span className="text-xs text-gray-400 flex items-center gap-1">
													<Calendar className="w-3 h-3" /> Fecha
												</span>
												<span className="font-medium text-gray-600">
													{item.fecha.split(",")[0]}
												</span>
											</div>
											<div className="flex flex-col">
												<span className="text-xs text-gray-400 mb-1">
													Estado
												</span>
												<div>
													<span
														className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(item.status as InscriptionStatus)}`}
													>
														{item.status}
													</span>
												</div>
											</div>
										</div>
									</motion.div>
								))}
							</div>

							{/* --- VISTA DESKTOP (Tabla Clásica) --- */}
							<div className="hidden md:block w-full align-middle">
								<table className="min-w-full divide-y divide-gray-200">
									<thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
										<tr>
											<th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Fecha
											</th>
											<th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Alumno
											</th>
											<th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												DNI
											</th>
											<th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Curso
											</th>
											<th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Método de Pago
											</th>
											<th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Monto
											</th>
											<th className="px-4 lg:px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
												Estado
											</th>
											<th className="px-4 lg:px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
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
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
													{item.fecha.split(",")[0]}{" "}
												</td>
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap">
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
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
													{item.alumnoDni}
												</td>
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-[#252d62] font-bold">
													{item.cursoNombre}
												</td>
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
													{item.paymentMethod}
												</td>
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
													${item.cursoInscripcion.toLocaleString("es-AR")}
												</td>
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap">
													<div className="flex flex-col items-start gap-1">
														<span
															className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadge(item.status as InscriptionStatus)}`}
														>
															{item.status}
														</span>
														{item.status === "Pendiente" &&
															item.fechaPromesaPago && (
																<span className="text-[10px] text-gray-500 font-medium pl-1">
																	Pago: {item.fechaPromesaPago}
																</span>
															)}
													</div>
												</td>
												<td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right">
													<div className="flex items-center justify-end gap-1">
														<button
															onClick={() => handleEditClick(item)}
															className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
															title="Editar inscripción"
														>
															<Pencil className="w-4 h-4" />
														</button>
														<button
															onClick={() => triggerDeleteModal(item)}
															className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
															title="Eliminar inscripción"
														>
															<Trash2 className="w-4 h-4" />
														</button>
													</div>
												</td>
											</motion.tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{!isLoading && filteredInscriptions.length === 0 && (
						<div className="p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[300px] w-full">
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

			{/* Modal de Edición Existente */}
			<EditInscriptionModal
				isOpen={isEditModalOpen}
				onClose={() => setIsEditModalOpen(false)}
				inscriptionToEdit={inscriptionToEdit}
				onSave={handleSaveInscription}
			/>

			{/* --- NUEVO: MODAL DIALOG DE BORRADO --- */}
			<AnimatePresence>
				{isDeleteModalOpen && (
					<Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
						<DialogContent className="max-w-[95%] rounded-lg w-[425px]">
							<DialogHeader>
								<div className="flex items-center gap-3 mb-2">
									<div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
										<AlertTriangle className="w-5 h-5 text-red-600" />
									</div>
									<DialogTitle className="text-xl text-[#2a2e5b]">
										Eliminar Inscripción
									</DialogTitle>
								</div>
								<DialogDescription className="text-gray-600">
									¿Estás seguro de que deseas eliminar la inscripción de{" "}
									<span className="font-bold text-gray-900">
										{inscriptionToDelete?.alumnoNombre}
									</span>{" "}
									al curso{" "}
									<span className="font-bold text-gray-900">
										{inscriptionToDelete?.cursoNombre}
									</span>
									?
									<br />
									<br />
									Esta acción borrará el registro de pago y quitará el curso del
									perfil del alumno. Esta acción no se puede deshacer.
								</DialogDescription>
							</DialogHeader>
							<DialogFooter className="gap-2 sm:gap-0 mt-4">
								<Button
									variant="outline"
									onClick={() => setIsDeleteModalOpen(false)}
									disabled={isDeleting}
									className="border-gray-300 text-gray-700 hover:bg-gray-50"
								>
									Cancelar
								</Button>
								<Button
									onClick={handleConfirmDelete}
									disabled={isDeleting}
									className="bg-[#EE1120] hover:bg-[#c4000e] text-white flex items-center"
								>
									{isDeleting ? (
										<>
											<Loader2 className="w-4 h-4 mr-2 animate-spin" />
											Eliminando...
										</>
									) : (
										"Sí, eliminar"
									)}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				)}
			</AnimatePresence>
		</>
	);
};

export default InscriptionsTable;
