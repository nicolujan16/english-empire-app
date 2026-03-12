"use client";

import React, { useState, ChangeEvent, SyntheticEvent } from "react";
import {
	collection,
	query,
	where,
	getDocs,
	addDoc,
	doc,
	updateDoc,
	arrayUnion, // <-- NUEVA IMPORTACIÓN VITAL
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAuth } from "@/context/AuthContext";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { StudentDetails } from "@/types";

interface AddStudentModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function AddStudentModal({
	isOpen,
	onClose,
}: AddStudentModalProps) {
	const { user, userData } = useAuth();

	const [formData, setFormData] = useState<StudentDetails>({
		nombre: "",
		apellido: "",
		dni: "",
		fechaNacimiento: "",
		cursos: [],
	});

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");

	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		setErrorMsg("");

		if (!user || !userData) {
			setErrorMsg("No hay sesión activa.");
			return;
		}

		const age = Math.floor(
			(new Date().getTime() - new Date(formData.fechaNacimiento).getTime()) /
				(1000 * 60 * 60 * 24 * 365.25),
		);

		if (age > 18) {
			alert(
				"Alumno mayor de edad. Se recomienda crear una cuenta propia para una mejor experiencia.",
			);
			return;
		}

		// 1. Validación Básica: Que no sea el DNI del propio padre
		if (formData.dni === userData.dni) {
			setErrorMsg(
				"El DNI del alumno no puede ser igual al del titular de la cuenta.",
			);
			return;
		}

		setIsSubmitting(true);

		try {
			const usersRef = collection(db, "Users");
			const hijosRef = collection(db, "Hijos");

			const userDniQuery = query(usersRef, where("dni", "==", formData.dni));
			const userDniSnapshot = await getDocs(userDniQuery);

			if (!userDniSnapshot.empty) {
				setErrorMsg(
					`El DNI ${formData.dni} ya pertenece a un usuario titular registrado.`,
				);
				setIsSubmitting(false);
				return;
			}

			const hijoDniQuery = query(hijosRef, where("dni", "==", formData.dni));
			const hijoDniSnapshot = await getDocs(hijoDniQuery);

			if (!hijoDniSnapshot.empty) {
				setErrorMsg(
					`El DNI ${formData.dni} ya se encuentra registrado como alumno a cargo en el instituto.`,
				);
				setIsSubmitting(false);
				return;
			}

			// 2. CREAMOS EL HIJO Y GUARDAMOS SU REFERENCIA (PARA EXTRAER EL ID)
			const nuevoHijoRef = await addDoc(hijosRef, {
				tutorId: user.uid,
				nombre: formData.nombre,
				apellido: formData.apellido,
				dni: formData.dni,
				fechaNacimiento: formData.fechaNacimiento,
				cursos: [],
			});

			// 3. ACTUALIZAMOS AL PADRE (Inyectando el nuevo ID)
			const userDocRef = doc(db, "Users", user.uid);

			// Armamos un objeto con los datos a actualizar
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const updateData: any = {
				hijos: arrayUnion(nuevoHijoRef.id), // Inyecta el ID generado por Firebase en el array
			};

			// Si el padre no era tutor previamente, le actualizamos el estado
			if (!userData.isTutor) {
				updateData.isTutor = true;
			}

			// Mandamos la actualización a Firestore en una sola operación atómica
			await updateDoc(userDocRef, updateData);

			// 4. LIMPIAMOS ESTADOS Y CERRAMOS
			setFormData({
				nombre: "",
				apellido: "",
				dni: "",
				fechaNacimiento: "",
				cursos: [],
			});
			onClose();

			// TIP PRO: Si usas un onSnapshot en tu AuthContext, el perfil se actualizará solo.
			// Si no, quizás necesites hacer un reload() o disparar un fetch manual aquí.
		} catch (error) {
			console.error("Error al guardar alumno:", error);
			setErrorMsg("Ocurrió un error al guardar el alumno. Inténtalo de nuevo.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle className="text-2xl font-bold text-[#252d62]">
						Agregar nuevo alumno
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="grid gap-4 py-4">
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor="nombre" className="text-right">
							Nombre
						</Label>
						<Input
							id="nombre"
							name="nombre"
							value={formData.nombre}
							onChange={handleChange}
							className="col-span-3"
							placeholder="Nombre del alumno"
							required
							disabled={isSubmitting}
						/>
					</div>
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor="apellido" className="text-right">
							Apellido
						</Label>
						<Input
							id="apellido"
							name="apellido"
							placeholder="Apellido del alumno"
							value={formData.apellido}
							onChange={handleChange}
							className="col-span-3"
							required
							disabled={isSubmitting}
						/>
					</div>
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor="dni" className="text-right">
							DNI
						</Label>
						<Input
							id="dni"
							name="dni"
							type="number"
							placeholder="Ej: 45123456"
							value={formData.dni}
							onChange={handleChange}
							className="col-span-3"
							required
							disabled={isSubmitting}
						/>
					</div>

					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor="fechaNacimiento" className="text-right">
							Nacimiento
						</Label>
						<Input
							id="fechaNacimiento"
							name="fechaNacimiento"
							type="date"
							value={formData.fechaNacimiento}
							onChange={handleChange}
							className="col-span-3 text-gray-700"
							required
							disabled={isSubmitting}
						/>
					</div>
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor="edad_readonly" className="text-right">
							Edad
						</Label>
						<input
							id="edad_readonly"
							type="text"
							readOnly
							value={
								formData.fechaNacimiento
									? Math.floor(
											(new Date().getTime() -
												new Date(formData.fechaNacimiento).getTime()) /
												(1000 * 60 * 60 * 24 * 365.25),
										)
									: ""
							}
							placeholder="--"
							className="w-full h-11 px-2 text-center text-sm font-bold bg-gray-200 text-gray-700 rounded-lg border border-transparent outline-none cursor-not-allowed col-span-3"
						/>
					</div>

					{errorMsg && (
						<div className="bg-red-50 text-red-600 p-2 rounded-md text-sm text-center font-medium">
							{errorMsg}
						</div>
					)}

					<DialogFooter className="mt-4">
						<Button
							type="button"
							variant="outline"
							onClick={onClose}
							disabled={isSubmitting}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							disabled={isSubmitting}
							className="bg-[#EE1120] hover:bg-[#c4000e] text-white transition-all"
						>
							{isSubmitting ? "Guardando..." : "Guardar"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
