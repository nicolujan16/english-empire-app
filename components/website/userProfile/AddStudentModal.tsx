"use client";

import React, { useState, ChangeEvent, SyntheticEvent } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

// 1. Tipamos los Props que recibe el Modal
interface AddStudentModalProps {
	isOpen: boolean;
	onClose: () => void;
}

// 2. Tipamos el estado del formulario
interface StudentFormData {
	nombre: string;
	apellido: string;
	dni: string;
	edad: string;
	fechaNacimiento: string;
}

export default function AddStudentModal({
	isOpen,
	onClose,
}: AddStudentModalProps) {
	const [formData, setFormData] = useState<StudentFormData>({
		nombre: "",
		apellido: "",
		dni: "",
		edad: "",
		fechaNacimiento: "",
	});

	// 3. Tipamos el evento de los inputs
	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	// 4. Tipamos el evento del submit con SyntheticEvent
	const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();

		// Aquí normalmente llamarías a una API/Firebase para guardar al alumno
		console.log("Guardando alumno:", formData);

		// Limpiamos el formulario
		setFormData({
			nombre: "",
			apellido: "",
			dni: "",
			edad: "",
			fechaNacimiento: "",
		});

		// Cerramos el modal
		onClose();
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
							required
						/>
					</div>
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor="apellido" className="text-right">
							Apellido
						</Label>
						<Input
							id="apellido"
							name="apellido"
							value={formData.apellido}
							onChange={handleChange}
							className="col-span-3"
							required
						/>
					</div>
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor="dni" className="text-right">
							DNI
						</Label>
						<Input
							id="dni"
							name="dni"
							value={formData.dni}
							onChange={handleChange}
							className="col-span-3"
							required
						/>
					</div>
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor="edad" className="text-right">
							Edad
						</Label>
						<Input
							id="edad"
							name="edad"
							type="number"
							value={formData.edad}
							onChange={handleChange}
							className="col-span-3"
							required
						/>
					</div>
					<div className="grid grid-cols-4 items-center gap-4">
						<Label htmlFor="fechaNacimiento" className="text-right">
							Fecha Nac.
						</Label>
						<Input
							id="fechaNacimiento"
							name="fechaNacimiento"
							type="date"
							value={formData.fechaNacimiento}
							onChange={handleChange}
							className="col-span-3 text-gray-700"
							required
						/>
					</div>

					<DialogFooter className="mt-4">
						<Button type="button" variant="outline" onClick={onClose}>
							Cancelar
						</Button>
						<Button
							type="submit"
							// Usamos el color rojo de la marca o el azul oscuro
							className="bg-[#EE1120] hover:bg-[#c4000e] text-white transition-all"
						>
							Guardar
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
