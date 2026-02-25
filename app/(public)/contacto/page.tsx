"use client";

import { useState } from "react";
import { MainBanner } from "@/components/website/common/MainBanner";
import { Facebook, Instagram, MessageCircle } from "lucide-react";

// Importamos Firebase (Comentado o eliminado según pediste)
// import { addDoc, collection, getFirestore } from 'firebase/firestore'

interface ConsultaForm {
	nombre: string;
	apellido: string;
	email: string;
	telefono: string;
	consulta: string;
}

export default function ContactPage() {
	const [form, setForm] = useState<ConsultaForm>({
		nombre: "",
		apellido: "",
		email: "",
		telefono: "",
		consulta: "",
	});

	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		setForm({
			...form,
			[e.target.id]: e.target.value,
		});
	};

	const submitConsulta = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsSubmitting(true);

		// SIMULACIÓN (Mock)
		console.log("Enviando consulta...", form);
		setTimeout(() => {
			alert("Consulta cargada exitosamente (Modo Prueba)");
			setIsSubmitting(false);
			setForm({
				nombre: "",
				apellido: "",
				email: "",
				telefono: "",
				consulta: "",
			});
		}, 1500);

		/* --- LÓGICA FIREBASE FUTURA ---
    try {
      const db = getFirestore()
      await addDoc(collection(db, 'Consultas'), form)
      alert('Consulta cargada existosamente')
      // Redirigir o limpiar
    } catch (err) {
      alert('Ha ocurrido un error, intente nuevamente!')
    }
    ------------------------------- */
	};

	return (
		// Padding top compensa el Header fijo del Layout
		<div className="flex flex-col gap-10 pb-16">
			<MainBanner>Contacto</MainBanner>

			{/* SECCIÓN INFORMACIÓN Y REDES */}
			<div className="w-[90%] md:w-[80%] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8 text-[#252D52]">
				{/* Texto Izquierda */}
				<div className="flex flex-col gap-2 text-xl md:text-2xl">
					<p>¿Tenés alguna duda?</p>
					<p className="font-bold text-3xl">¡Nosotros te podemos ayudar!</p>
				</div>

				{/* Redes Derecha */}
				<div className="flex flex-col gap-4">
					<p className="text-xl md:text-2xl font-medium">
						¡Usa nuestras redes para comunicarte!
					</p>
					<div className="flex gap-8 text-4xl text-[#252D52]">
						<a
							target="_blank"
							rel="noreferrer"
							href="https://www.facebook.com/englishempirelr"
							className="hover:text-[#1877F2] hover:scale-110 transition-all"
						>
							<Facebook />
						</a>
						<a
							target="_blank"
							rel="noreferrer"
							href="https://www.instagram.com/englishempirelr/"
							className="hover:text-[#E4405F] hover:scale-110 transition-all"
						>
							<Instagram />
						</a>
						<a
							target="_blank"
							rel="noreferrer"
							href="https://wa.me/3804259004"
							className="hover:text-[#25D366] hover:scale-110 transition-all"
						>
							<MessageCircle />
						</a>
					</div>
				</div>
			</div>

			{/* FORMULARIO */}
			<div className="w-full flex justify-center mt-4">
				<form
					onSubmit={submitConsulta}
					className="w-[90%] md:w-[80%] max-w-5xl p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white shadow-xl rounded-2xl border border-gray-100"
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
							inputMode="numeric"
							className="w-full h-12 px-4 text-lg bg-[#f1f1f1] rounded-lg border border-transparent focus:border-[#1d2355] focus:bg-white focus:ring-2 focus:ring-[#1d2355]/20 outline-none transition-all"
						/>
					</div>

					{/* Consulta (Ocupa 2 columnas en desktop) */}
					<div className="flex flex-col gap-2 col-span-1 md:col-span-2">
						<label
							htmlFor="consulta"
							className="font-bold text-lg md:text-xl text-gray-700"
						>
							Consulta <span className="text-[#EE1120]">*</span>
						</label>
						<textarea
							minLength={10}
							maxLength={240}
							required
							onChange={handleInputChange}
							value={form.consulta}
							name="consulta"
							id="consulta"
							rows={6}
							className="w-full p-4 text-lg bg-[#f1f1f1] rounded-lg border border-transparent focus:border-[#1d2355] focus:bg-white focus:ring-2 focus:ring-[#1d2355]/20 outline-none transition-all resize-none"
						></textarea>
						<p className="text-right text-gray-400 text-sm">
							{form.consulta.length}/240
						</p>
					</div>

					{/* Botón */}
					<div className="col-span-1 md:col-span-2 flex justify-center mt-4">
						<button
							disabled={isSubmitting}
							className={`
                bg-[#EE1120] text-white text-2xl font-bold py-3 px-12 rounded-full shadow-lg 
                transition-all duration-300
                ${isSubmitting ? "opacity-70 cursor-wait" : "hover:bg-[#b30000] hover:scale-105 active:scale-95"}
              `}
						>
							{isSubmitting ? "Enviando..." : "Enviar"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
