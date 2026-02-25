"use client";

import { useState, useRef, ChangeEvent, FormEvent } from "react";
import { MainBanner } from "@/components/website/common/MainBanner";

// 1. Definimos la interfaz para el estado del formulario
interface PostulationForm {
	nombre: string;
	apellido: string;
	dni: string;
	nacimiento: string;
	email: string;
	telefono: string;
	descripcion: string;
	cv: string;
}

export default function PostulationsPage() {
	// 2. Tipamos el estado del formulario usando la interfaz
	const [form, setForm] = useState<PostulationForm>({
		nombre: "",
		apellido: "",
		dni: "",
		nacimiento: "",
		email: "",
		telefono: "",
		descripcion: "",
		cv: "",
	});

	// El archivo puede ser de tipo File o null
	const [file, setFile] = useState<File | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// 3. Usamos useRef para controlar el input file sin romper React
	const fileInputRef = useRef<HTMLInputElement>(null);

	// 4. Tipamos los eventos correctamente (ChangeEvent para inputs)
	const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
		// Si hay archivos seleccionados, tomamos el primero
		if (e.target.files && e.target.files.length > 0) {
			const selectedFile = e.target.files[0];

			if (selectedFile.type === "application/pdf") {
				setFile(selectedFile);
			} else {
				alert("Solo se permiten archivos PDF");
				// Limpiamos el input file de forma segura usando la referencia
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
				setFile(null);
			}
		}
	};

	const handleInputChange = (
		e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		setForm({
			...form,
			[e.target.id]: e.target.value,
		});
	};

	// 5. Tipamos el evento del formulario (FormEvent)
	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		// Validación extra: nos aseguramos de que haya un archivo antes de enviar
		if (!file) {
			alert("Por favor, adjunta tu CV en formato PDF.");
			return;
		}

		setIsSubmitting(true);

		// SIMULACIÓN DE ENVÍO (Mock)
		console.log("Enviando formulario...", form);
		console.log("Archivo seleccionado:", file.name);

		setTimeout(() => {
			setIsSubmitting(false);
			alert("¡Postulado exitosamente! (Modo Prueba)");

			// Reset form
			setForm({
				nombre: "",
				apellido: "",
				dni: "",
				nacimiento: "",
				email: "",
				telefono: "",
				descripcion: "",
				cv: "",
			});
			setFile(null);

			// Limpiamos visualmente el input file
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}, 2000);
	};

	return (
		<div className="flex flex-col min-h-screen">
			<main className="flex-grow flex flex-col gap-6">
				<MainBanner>Trabaja con nosotros</MainBanner>

				<div className="w-full flex justify-center mb-12">
					{/* FORMULARIO */}
					<form
						onSubmit={handleSubmit}
						className="w-[90%] md:w-[80%] max-w-5xl p-6 md:p-12 grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white shadow-xl rounded-2xl border border-gray-100"
					>
						{/* Nombre */}
						<div className="flex flex-col gap-2">
							<label
								htmlFor="nombre"
								className="font-bold text-lg md:text-xl text-gray-700"
							>
								Nombre <span className="text-[#EE1120]">*</span>
							</label>
							<input
								required
								onChange={handleInputChange}
								value={form.nombre}
								type="text"
								id="nombre"
								className="w-full h-12 px-4 text-lg bg-[#f1f1f1] rounded-lg border border-transparent focus:border-[#1d2355] focus:bg-white focus:ring-2 focus:ring-[#1d2355]/20 outline-none transition-all"
							/>
						</div>

						{/* Apellido */}
						<div className="flex flex-col gap-2">
							<label
								htmlFor="apellido"
								className="font-bold text-lg md:text-xl text-gray-700"
							>
								Apellido <span className="text-[#EE1120]">*</span>
							</label>
							<input
								required
								onChange={handleInputChange}
								value={form.apellido}
								type="text"
								id="apellido"
								className="w-full h-12 px-4 text-lg bg-[#f1f1f1] rounded-lg border border-transparent focus:border-[#1d2355] focus:bg-white focus:ring-2 focus:ring-[#1d2355]/20 outline-none transition-all"
							/>
						</div>

						{/* DNI */}
						<div className="flex flex-col gap-2">
							<label
								htmlFor="dni"
								className="font-bold text-lg md:text-xl text-gray-700"
							>
								DNI <span className="text-[#EE1120]">*</span>
							</label>
							<input
								required
								onChange={handleInputChange}
								value={form.dni}
								type="number"
								id="dni"
								className="w-full h-12 px-4 text-lg bg-[#f1f1f1] rounded-lg border border-transparent focus:border-[#1d2355] focus:bg-white focus:ring-2 focus:ring-[#1d2355]/20 outline-none transition-all"
							/>
						</div>

						{/* Fecha Nacimiento */}
						<div className="flex flex-col gap-2">
							<label
								htmlFor="nacimiento"
								className="font-bold text-lg md:text-xl text-gray-700"
							>
								Fecha de nacimiento <span className="text-[#EE1120]">*</span>
							</label>
							<input
								required
								onChange={handleInputChange}
								value={form.nacimiento}
								type="date"
								id="nacimiento"
								className="w-full h-12 px-4 text-lg bg-[#f1f1f1] rounded-lg border border-transparent focus:border-[#1d2355] focus:bg-white focus:ring-2 focus:ring-[#1d2355]/20 outline-none transition-all text-gray-600"
							/>
						</div>

						{/* Email */}
						<div className="flex flex-col gap-2">
							<label
								htmlFor="email"
								className="font-bold text-lg md:text-xl text-gray-700"
							>
								Email <span className="text-[#EE1120]">*</span>
							</label>
							<input
								required
								onChange={handleInputChange}
								value={form.email}
								type="email"
								id="email"
								className="w-full h-12 px-4 text-lg bg-[#f1f1f1] rounded-lg border border-transparent focus:border-[#1d2355] focus:bg-white focus:ring-2 focus:ring-[#1d2355]/20 outline-none transition-all"
							/>
						</div>

						{/* Teléfono */}
						<div className="flex flex-col gap-2">
							<label
								htmlFor="telefono"
								className="font-bold text-lg md:text-xl text-gray-700"
							>
								Teléfono <span className="text-[#EE1120]">*</span>
							</label>
							<input
								required
								onChange={handleInputChange}
								value={form.telefono}
								type="number"
								id="telefono"
								className="w-full h-12 px-4 text-lg bg-[#f1f1f1] rounded-lg border border-transparent focus:border-[#1d2355] focus:bg-white focus:ring-2 focus:ring-[#1d2355]/20 outline-none transition-all"
							/>
						</div>

						{/* Descripción */}
						<div className="flex flex-col gap-2 col-span-1 lg:col-span-2">
							<label
								htmlFor="descripcion"
								className="font-bold text-lg md:text-xl text-gray-700"
							>
								Cuéntanos algo sobre ti{" "}
								<span className="text-[#EE1120]">*</span>
							</label>
							<textarea
								required
								onChange={handleInputChange}
								value={form.descripcion}
								name="descripcion"
								id="descripcion"
								rows={6}
								className="w-full p-4 text-lg bg-[#f1f1f1] rounded-lg border border-transparent focus:border-[#1d2355] focus:bg-white focus:ring-2 focus:ring-[#1d2355]/20 outline-none transition-all resize-y min-h-[150px]"
							></textarea>
						</div>

						{/* Archivo CV */}
						<div className="flex flex-col gap-2 col-span-1 lg:col-span-2">
							<label
								htmlFor="cv"
								className="font-bold text-lg md:text-xl text-gray-700"
							>
								Adjuntar CV (Formato PDF){" "}
								<span className="text-[#EE1120]">*</span>
							</label>
							<input
								type="file"
								accept=".pdf"
								required
								onChange={handleFileChange}
								ref={fileInputRef} // Conectamos la referencia aquí
								id="cv"
								className="
                  block w-full text-lg text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-[#1d2355] file:text-white
                  file:cursor-pointer hover:file:bg-[#252d62]
                  cursor-pointer bg-white p-2 border border-gray-200 rounded-lg
                "
							/>
						</div>

						{/* Botón Enviar */}
						<div className="col-span-1 lg:col-span-2 flex justify-center mt-6">
							<button
								type="submit"
								disabled={isSubmitting}
								className={`
                  bg-[#EE1120] text-white text-2xl font-bold py-3 px-12 rounded-full shadow-lg 
                  transition-all duration-300
                  ${isSubmitting ? "opacity-70 cursor-wait" : "hover:bg-[#b30000] hover:scale-105 active:scale-95"}
                `}
							>
								{isSubmitting ? "Enviando..." : "Enviar Postulación"}
							</button>
						</div>
					</form>
				</div>
			</main>
		</div>
	);
}
