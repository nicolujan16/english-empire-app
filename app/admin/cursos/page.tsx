"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
	Trash2,
	Pencil,
	Clock,
	Users,
	Plus,
	Loader2,
	AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button"; // Ajustá si es necesario
import cursoDefaultIMG from "@/assets/cursoDetails/cursoDefaultImg.jpg";

import AddCursoModal, {
	AdminCourse,
} from "@/components/admin/cursos/AddCursoModal";

// --- FIRESTORE & STORAGE IMPORTS ---
import {
	collection,
	onSnapshot,
	query,
	deleteDoc,
	doc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebaseConfig";

export default function AdminCoursesPage() {
	const [courses, setCourses] = useState<AdminCourse[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Estados para controlar el AddCursoModal
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [courseToEdit, setCourseToEdit] = useState<AdminCourse | null>(null);

	// Estados para el Modal de Eliminación
	const [courseToDelete, setCourseToDelete] = useState<{
		id: string;
		name: string;
		image: string;
	} | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// 1. TRAER DATOS EN TIEMPO REAL
	useEffect(() => {
		const coursesRef = collection(db, "Cursos");
		const q = query(coursesRef);

		const unsubscribe = onSnapshot(
			q,
			(snapshot) => {
				const coursesData: AdminCourse[] = [];
				snapshot.forEach((doc) => {
					const data = doc.data();
					coursesData.push({
						id: doc.id,
						nombre: data.nombre || "",
						categoria: data.categoria || "",
						descripcion: data.descripcion || "",
						edades: data.edades || [0, 99],
						horarios: data.horarios || {},
						imgURL: data.imgURL || cursoDefaultIMG.src,
						cuota: data.cuota || 0,
						inscripcion: data.inscripcion,
						active: data.active !== undefined ? data.active : true,
						inicio: data.inicio,
						fin: data.fin,
					});
				});
				setCourses(coursesData);
				setIsLoading(false);
			},
			(error) => {
				console.error("Error trayendo cursos:", error);
				setIsLoading(false);
			},
		);

		return () => unsubscribe();
	}, []);

	// --- LÓGICA DE APERTURA DE MODALES ---
	const handleAddNew = () => {
		setCourseToEdit(null); // Null significa crear
		setIsModalOpen(true);
	};

	const handleEditClick = (course: AdminCourse) => {
		setCourseToEdit(course); // Pasamos la data vieja
		setIsModalOpen(true);
	};

	const handleDeleteClick = (id: string, name: string, image: string) => {
		setCourseToDelete({ id, name, image });
	};

	// --- BORRADO REAL EN FIREBASE ---
	const confirmDelete = async () => {
		if (!courseToDelete) return;
		setIsDeleting(true);

		try {
			await deleteDoc(doc(db, "Cursos", courseToDelete.id));

			if (
				courseToDelete.image &&
				!courseToDelete.image.includes("cursoDefaultImg")
			) {
				try {
					const imageRef = ref(storage, courseToDelete.image);
					await deleteObject(imageRef);
				} catch (error) {
					console.error("No se pudo borrar la imagen del storage:", error);
				}
			}
			setCourseToDelete(null);
		} catch (error) {
			console.error("Error eliminando:", error);
			alert("Hubo un error al intentar eliminar el registro.");
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className="max-w-7xl mx-auto relative pb-20">
			{/* Header */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
				<div>
					<h1 className="text-3xl font-bold text-[#252d62] mb-2">
						Gestión de Cursos
					</h1>
					<p className="text-gray-500">
						Administra los programas educativos y sus detalles.
					</p>
				</div>
				<Button
					onClick={handleAddNew}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-sm hover:shadow-md flex items-center gap-2"
				>
					<Plus className="w-5 h-5" />
					Nuevo Curso
				</Button>
			</div>

			{/* Grid de Cursos */}
			{isLoading ? (
				<div className="flex justify-center items-center h-64">
					<Loader2 className="w-10 h-10 animate-spin text-[#EE1120]" />
				</div>
			) : (
				<div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
					{courses.map((course, index) => (
						<motion.div
							key={course.id}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4, delay: index * 0.1 }}
							className={`bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border ${
								course.active ? "border-gray-100" : "border-red-200 opacity-70"
							} flex flex-col sm:flex-row group`}
						>
							{/* Image */}
							<div className="sm:w-2/5 h-48 sm:h-auto relative overflow-hidden bg-gray-100">
								<Image
									src={course.imgURL}
									alt={`Imagen representativa del curso ${course.nombre}`}
									fill
									className="object-cover transition-transform duration-500 group-hover:scale-105"
									sizes="(max-width: 640px) 100vw, 40vw"
								/>
								{!course.active && (
									<div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
										Inactivo
									</div>
								)}
								<div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent sm:hidden opacity-0"></div>
							</div>

							{/* Content */}
							<div className="p-6 flex-1 flex flex-col justify-between">
								<div>
									<div className="flex justify-between items-start mb-2 gap-2">
										<h3 className="text-xl font-bold text-[#252d62] leading-tight w-full">
											{course.nombre}
										</h3>

										<span className="inline-block px-3 py-1 bg-blue-50 text-[#252d62] text-sm font-semibold rounded-full whitespace-nowrap">
											Cuota: ${course.cuota.toLocaleString("es-AR")}
										</span>
									</div>

									<div className="space-y-2 mt-4">
										<div className="flex items-center text-gray-600 text-sm">
											<Users className="w-4 h-4 mr-2 text-gray-400" />
											<span>
												Edades: {course.edades[0]} a {course.edades[1]} años
											</span>
										</div>
										<div className="flex items-center text-gray-600 text-sm">
											<Clock className="w-4 h-4 mr-2 text-gray-400" />
											<span
												className="truncate"
												title={Object.keys(course.horarios).join(", ")}
											>
												Horario: {Object.keys(course.horarios)[0]}{" "}
												{Object.values(course.horarios)[0]}{" "}
												{Object.keys(course.horarios).length > 1 ? "(+)" : ""}
											</span>
										</div>
									</div>
								</div>

								{/* Acciones */}
								<div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-50">
									<button
										onClick={() => handleEditClick(course)}
										className="p-2 text-gray-400 hover:text-[#252d62] hover:bg-blue-50 rounded-lg transition-colors"
										title={`Editar curso ${course.nombre}`}
									>
										<Pencil className="w-5 h-5" />
									</button>
									<button
										onClick={() =>
											handleDeleteClick(course.id, course.nombre, course.imgURL)
										}
										className="p-2 text-gray-400 hover:text-[#EE1120] hover:bg-red-50 rounded-lg transition-colors"
										title={`Eliminar curso ${course.nombre}`}
									>
										<Trash2 className="w-5 h-5" />
									</button>
								</div>
							</div>
						</motion.div>
					))}

					{courses.length === 0 && (
						<div className="col-span-full py-12 text-center text-gray-500">
							No hay cursos registrados.
						</div>
					)}
				</div>
			)}

			{/* IMPORTAMOS Y USAMOS EL MODAL EXTERNO */}
			<AddCursoModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				courseToEdit={courseToEdit}
			/>

			{/* MODAL DE CONFIRMACIÓN DE BORRADO */}
			<AnimatePresence>
				{courseToDelete && (
					<>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={!isDeleting ? () => setCourseToDelete(null) : undefined}
							className="fixed inset-0 bg-[#252d62]/80 backdrop-blur-sm z-50 transition-opacity"
						/>
						<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
							<motion.div
								initial={{ opacity: 0, scale: 0.95, y: 20 }}
								animate={{ opacity: 1, scale: 1, y: 0 }}
								exit={{ opacity: 0, scale: 0.95, y: 20 }}
								className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col p-6 text-center"
							>
								<div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
									<AlertTriangle className="h-6 w-6 text-red-600" />
								</div>
								<h3 className="text-lg font-bold text-gray-900 mb-2">
									¿Eliminar curso?
								</h3>
								<p className="text-sm text-gray-500 mb-6">
									Estás a punto de eliminar el curso{" "}
									<strong>{courseToDelete.name}</strong>. Esta acción no se
									puede deshacer.
								</p>
								<div className="flex flex-col sm:flex-row gap-3 w-full">
									<Button
										type="button"
										variant="outline"
										onClick={() => setCourseToDelete(null)}
										disabled={isDeleting}
										className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
									>
										Cancelar
									</Button>
									<Button
										type="button"
										onClick={confirmDelete}
										disabled={isDeleting}
										className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-md"
									>
										{isDeleting ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											"Sí, eliminar"
										)}
									</Button>
								</div>
							</motion.div>
						</div>
					</>
				)}
			</AnimatePresence>
		</div>
	);
}
