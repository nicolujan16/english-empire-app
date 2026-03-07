/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, ChangeEvent, SyntheticEvent, useEffect } from "react";
import Image from "next/image";
import {
	Trash2,
	Pencil,
	Plus,
	X,
	Save,
	Upload,
	Loader2,
	AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import defaultStaffPic from "@/assets/adminPage/default_staff_pic.png";

// --- FIRESTORE & STORAGE IMPORTS ---
import {
	collection,
	onSnapshot,
	query,
	orderBy,
	addDoc,
	deleteDoc,
	doc,
	updateDoc,
} from "firebase/firestore";
import {
	ref,
	uploadBytesResumable,
	getDownloadURL,
	deleteObject,
} from "firebase/storage";
import { db, storage } from "@/lib/firebaseConfig";

interface StaffMember {
	id: string;
	name: string;
	role: string;
	image: string;
	orden: number;
}

export default function AdminStaffPage() {
	const [staff, setStaff] = useState<StaffMember[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Estados del Modal Principal (Crear / Editar)
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [editingMemberId, setEditingMemberId] = useState<string | null>(null); // Nulo = Modo Crear

	// Estados del Formulario del Modal
	const [formData, setFormData] = useState({
		name: "",
		role: "",
		orden: "3",
	});
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [uploadProgress, setUploadProgress] = useState<number>(0);

	// Estados para el Modal de Eliminación
	const [memberToDelete, setMemberToDelete] = useState<{
		id: string;
		name: string;
		image: string;
	} | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// 1. TRAER DATOS DE FIRESTORE EN TIEMPO REAL
	useEffect(() => {
		const staffRef = collection(db, "Staff");
		const q = query(staffRef, orderBy("orden", "asc"));

		const unsubscribe = onSnapshot(
			q,
			(snapshot) => {
				const staffData: StaffMember[] = [];
				snapshot.forEach((doc) => {
					staffData.push({
						id: doc.id,
						name: doc.data().name,
						role: doc.data().role,
						image: doc.data().image || defaultStaffPic.src,
						orden: doc.data().orden,
					});
				});
				setStaff(staffData);
				setIsLoading(false);
			},
			(error) => {
				console.error("Error trayendo personal:", error);
				setIsLoading(false);
			},
		);

		return () => unsubscribe();
	}, []);

	// --- LÓGICA DE EDICIÓN ---
	const handleEditClick = (member: StaffMember) => {
		setEditingMemberId(member.id);
		setFormData({
			name: member.name,
			role: member.role,
			orden: member.orden.toString(),
		});
		setSelectedFile(null); // Reseteamos la foto, si no sube nada, mantiene la vieja
		setIsModalOpen(true);
	};

	// --- LÓGICA DE BORRADO ---
	const handleDeleteClick = (id: string, name: string, image: string) => {
		setMemberToDelete({ id, name, image });
	};

	const confirmDelete = async () => {
		if (!memberToDelete) return;
		setIsDeleting(true);

		try {
			// 1. Borramos el documento de Firestore
			await deleteDoc(doc(db, "Staff", memberToDelete.id));

			// 2. Si la imagen NO es la por defecto, la borramos del Storage para ahorrar espacio
			if (
				memberToDelete.image &&
				!memberToDelete.image.includes("default_staff_pic")
			) {
				try {
					const imageRef = ref(storage, memberToDelete.image);
					await deleteObject(imageRef);
				} catch (storageError) {
					console.error(
						"No se pudo borrar la imagen del storage, pero el doc se borró:",
						storageError,
					);
					// No bloqueamos el flujo si falla el borrado de la imagen
				}
			}
			setMemberToDelete(null);
		} catch (error) {
			console.error("Error eliminando:", error);
			alert("Hubo un error al intentar eliminar el registro.");
		} finally {
			setIsDeleting(false);
		}
	};

	// --- HANDLERS DEL FORMULARIO ---
	const handleModalChange = (e: ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			const file = e.target.files[0];
			if (file.size > 5 * 1024 * 1024) {
				alert("El archivo es demasiado grande. Máximo 5MB.");
				e.target.value = "";
				return;
			}
			setSelectedFile(file);
		}
	};

	const handleCloseModal = () => {
		setFormData({ name: "", role: "", orden: "3" });
		setSelectedFile(null);
		setUploadProgress(0);
		setEditingMemberId(null);
		setIsModalOpen(false);
	};

	// 2. SUBIR/EDITAR DATOS Y FOTO
	const handleSubmit = async (e: SyntheticEvent) => {
		e.preventDefault();
		setIsSubmitting(true);

		try {
			let finalImageUrl: string | undefined = undefined;

			// Si subieron un archivo nuevo, lo mandamos a Storage
			if (selectedFile) {
				const storageRef = ref(
					storage,
					`staff/${Date.now()}_${selectedFile.name}`,
				);
				const uploadTask = uploadBytesResumable(storageRef, selectedFile);

				finalImageUrl = await new Promise((resolve, reject) => {
					uploadTask.on(
						"state_changed",
						(snapshot) => {
							const progress =
								(snapshot.bytesTransferred / snapshot.totalBytes) * 100;
							setUploadProgress(Math.round(progress));
						},
						(error) => {
							console.error("Error subiendo imagen:", error);
							reject("Error al subir la imagen");
						},
						async () => {
							const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
							resolve(downloadURL);
						},
					);
				});
			}

			// Objeto base con los datos de texto
			const staffData: any = {
				name: formData.name,
				role: formData.role,
				orden: parseInt(formData.orden),
			};

			// Si es MODO EDICIÓN
			if (editingMemberId) {
				// Solo actualizamos la URL de la imagen si subieron una foto nueva
				if (finalImageUrl) {
					staffData.image = finalImageUrl;
				}
				const memberRef = doc(db, "Staff", editingMemberId);
				await updateDoc(memberRef, staffData);
			}
			// Si es MODO CREACIÓN
			else {
				staffData.image = finalImageUrl || defaultStaffPic.src;
				const staffRef = collection(db, "Staff");
				await addDoc(staffRef, staffData);
			}

			handleCloseModal();
		} catch (error) {
			console.error(error);
			alert("Hubo un error al guardar los datos.");
		} finally {
			setIsSubmitting(false);
			setUploadProgress(0);
		}
	};

	return (
		<div className="max-w-7xl mx-auto relative pb-20">
			{/* Header */}
			<div className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<div>
					<h1 className="text-3xl font-bold text-[#252d62] mb-2">
						Nuestro Equipo
					</h1>
					<p className="text-gray-500">
						Administra los perfiles del personal docente y administrativo.
					</p>
				</div>
				<Button
					onClick={() => {
						setEditingMemberId(null);
						setIsModalOpen(true);
					}}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white shadow-md hover:shadow-lg transition-all"
				>
					<Plus className="w-4 h-4 mr-2" />
					Añadir Personal
				</Button>
			</div>

			{/* Grid de Personal */}
			{isLoading ? (
				<div className="flex justify-center items-center h-64">
					<Loader2 className="w-10 h-10 animate-spin text-[#EE1120]" />
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
					{staff.map((member, index) => (
						<motion.div
							key={member.id}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4, delay: index * 0.05 }}
							className="bg-white rounded-xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col items-center text-center group relative overflow-hidden"
						>
							<div className="absolute top-2 left-2 bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-md opacity-50 group-hover:opacity-100 transition-opacity z-10">
								Orden: {member.orden}
							</div>
							<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#252d62] to-[#1d2355] opacity-0 group-hover:opacity-100 transition-opacity"></div>

							<div className="relative mb-5 w-24 h-24 mt-2">
								<Image
									src={member.image}
									alt={`Fotografía de ${member.name}`}
									fill
									className="rounded-full object-cover border-4 border-gray-50 shadow-sm group-hover:border-blue-50 transition-colors"
									sizes="96px"
								/>
							</div>

							<h3 className="text-lg font-bold text-[#252d62] mb-1">
								{member.name}
							</h3>
							<p className="text-sm text-gray-500 font-medium mb-6">
								{member.role}
							</p>

							<div className="flex gap-2 mt-auto w-full justify-center pt-4 border-t border-gray-50">
								<button
									onClick={() => handleEditClick(member)}
									className="p-2 text-gray-400 hover:text-[#252d62] hover:bg-blue-50 rounded-lg transition-colors flex-1 flex justify-center"
									title={`Editar perfil de ${member.name}`}
								>
									<Pencil className="w-4 h-4" />
								</button>
								<button
									onClick={() =>
										handleDeleteClick(member.id, member.name, member.image)
									}
									className="p-2 text-gray-400 hover:text-[#EE1120] hover:bg-red-50 rounded-lg transition-colors flex-1 flex justify-center"
									title={`Eliminar perfil de ${member.name}`}
								>
									<Trash2 className="w-4 h-4" />
								</button>
							</div>
						</motion.div>
					))}
					{staff.length === 0 && (
						<div className="col-span-full py-12 text-center text-gray-500">
							No hay personal registrado aún.
						</div>
					)}
				</div>
			)}

			{/* ========================================================= */}
			{/* MODAL PARA AÑADIR / EDITAR PERSONAL */}
			{/* ========================================================= */}
			<AnimatePresence>
				{isModalOpen && (
					<>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={!isSubmitting ? handleCloseModal : undefined}
							className="fixed inset-0 bg-[#252d62]/80 backdrop-blur-sm z-50 transition-opacity"
						/>

						<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
							<motion.div
								initial={{ opacity: 0, scale: 0.95, y: 20 }}
								animate={{ opacity: 1, scale: 1, y: 0 }}
								exit={{ opacity: 0, scale: 0.95, y: 20 }}
								className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col"
							>
								<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
									<h2 className="text-xl font-bold text-[#252d62]">
										{editingMemberId
											? "Editar Personal"
											: "Añadir Nuevo Personal"}
									</h2>
									<button
										onClick={!isSubmitting ? handleCloseModal : undefined}
										disabled={isSubmitting}
										className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
									>
										<X className="w-5 h-5" />
									</button>
								</div>

								<div className="p-6">
									<form
										id="staff-form"
										onSubmit={handleSubmit}
										className="space-y-4"
									>
										<div>
											<label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
												Nombre Completo
											</label>
											<input
												type="text"
												name="name"
												required
												disabled={isSubmitting}
												value={formData.name}
												onChange={handleModalChange}
												placeholder="Ej: Laura Martínez"
												className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white"
											/>
										</div>

										<div className="grid grid-cols-2 gap-4">
											<div>
												<label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
													Cargo / Rol
												</label>
												<input
													type="text"
													name="role"
													required
													disabled={isSubmitting}
													value={formData.role}
													onChange={handleModalChange}
													placeholder="Ej: Profesora"
													className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white"
												/>
											</div>
											<div>
												<label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
													Nivel de Orden
												</label>
												<input
													type="number"
													name="orden"
													min="1"
													required
													disabled={isSubmitting}
													value={formData.orden}
													onChange={handleModalChange}
													className="block w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62] bg-gray-50 focus:bg-white"
												/>
											</div>
										</div>

										<div>
											<label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
												Fotografía
											</label>
											<div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors relative">
												<div className="space-y-1 text-center">
													<Upload className="mx-auto h-8 w-8 text-gray-400" />
													<div className="flex text-sm text-gray-600 justify-center">
														<span className="relative font-medium text-[#252d62]">
															{selectedFile
																? selectedFile.name
																: editingMemberId
																	? "Subir nueva foto (opcional)"
																	: "Seleccionar archivo"}
														</span>
													</div>
													{!selectedFile && (
														<p className="text-xs text-gray-500">
															PNG o JPG hasta 5MB
														</p>
													)}
												</div>
												<input
													type="file"
													accept="image/png, image/jpeg, image/jpg"
													onChange={handleFileChange}
													disabled={isSubmitting}
													className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
												/>
											</div>

											{isSubmitting &&
												uploadProgress > 0 &&
												uploadProgress < 100 && (
													<div className="w-full bg-gray-200 rounded-full h-1.5 mt-3 overflow-hidden">
														<div
															className="bg-[#252d62] h-1.5 rounded-full transition-all duration-300"
															style={{ width: `${uploadProgress}%` }}
														></div>
														<p className="text-[10px] text-right text-gray-500 mt-1">
															Subiendo imagen... {uploadProgress}%
														</p>
													</div>
												)}
										</div>
									</form>
								</div>

								<div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
									<Button
										type="button"
										variant="outline"
										onClick={handleCloseModal}
										disabled={isSubmitting}
										className="border-gray-300 text-gray-700 hover:bg-gray-100"
									>
										Cancelar
									</Button>
									<Button
										type="submit"
										form="staff-form"
										disabled={isSubmitting || !formData.name || !formData.role}
										className="bg-[#EE1120] hover:bg-[#c4000e] text-white shadow-md min-w-[140px]"
									>
										{isSubmitting ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											<>
												<Save className="w-4 h-4 mr-2" />
												{editingMemberId ? "Actualizar" : "Guardar"}
											</>
										)}
									</Button>
								</div>
							</motion.div>
						</div>
					</>
				)}
			</AnimatePresence>

			{/* ========================================================= */}
			{/* MODAL DE CONFIRMACIÓN DE BORRADO */}
			{/* ========================================================= */}
			<AnimatePresence>
				{memberToDelete && (
					<>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={!isDeleting ? () => setMemberToDelete(null) : undefined}
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
									¿Eliminar miembro?
								</h3>
								<p className="text-sm text-gray-500 mb-6">
									Estás a punto de eliminar a{" "}
									<strong>{memberToDelete.name}</strong> del equipo. Esta acción
									no se puede deshacer.
								</p>
								<div className="flex flex-col sm:flex-row gap-3 w-full">
									<Button
										type="button"
										variant="outline"
										onClick={() => setMemberToDelete(null)}
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
