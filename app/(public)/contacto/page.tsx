"use client";

import { MainBanner } from "@/components/website/common/MainBanner";
import { MessageCircle, MapPin, Mail } from "lucide-react";
import { FiFacebook, FiInstagram } from "react-icons/fi";

export default function ContactPage() {
	return (
		<div className="flex flex-col pb-24 bg-gray-50 min-h-screen">
			<MainBanner>Contacto</MainBanner>

			<div className="w-[90%] md:w-[80%] max-w-6xl mx-auto mt-10 flex flex-col gap-6">
				{/* ENCABEZADO */}
				<div className="text-center flex flex-col gap-4">
					<h2 className="text-[#EE1120] font-bold tracking-widest uppercase text-sm md:text-base">
						Estamos para ayudarte
					</h2>
					<p className="font-extrabold text-3xl md:text-5xl text-[#252d62]">
						¿Tenés alguna duda?
					</p>
					<p className="text-gray-500 text-lg md:text-xl max-w-2xl mx-auto">
						Elegí el canal que te resulte más cómodo. Nuestro equipo te
						responderá a la brevedad para asesorarte en lo que necesites.
					</p>
				</div>

				{/* TARJETAS DE CONTACTO */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mt-4">
					{/* WhatsApp */}
					<a
						target="_blank"
						rel="noreferrer"
						href="https://wa.me/3804259004"
						className="group flex flex-col items-center text-center p-10 bg-white rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-2"
					>
						<div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 group-hover:bg-[#25D366] transition-colors duration-300">
							<MessageCircle className="w-10 h-10 text-[#25D366] group-hover:text-white transition-colors" />
						</div>
						<h3 className="text-2xl font-bold text-[#252d62] mb-2">WhatsApp</h3>
						<p className="text-gray-500 mb-6">
							Respuestas rápidas para consultas sobre inscripciones y horarios.
						</p>
						<span className="text-[#25D366] font-bold group-hover:underline">
							Escribinos ahora &rarr;
						</span>
					</a>

					{/* Instagram */}
					<a
						target="_blank"
						rel="noreferrer"
						href="https://www.instagram.com/englishempirelr/"
						className="group flex flex-col items-center text-center p-10 bg-white rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-2"
					>
						<div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mb-6 group-hover:bg-gradient-to-tr group-hover:from-[#FD1D1D] group-hover:to-[#833AB4] transition-all duration-300">
							<FiInstagram className="w-10 h-10 text-[#E4405F] group-hover:text-white transition-colors" />
						</div>
						<h3 className="text-2xl font-bold text-[#252d62] mb-2">
							Instagram
						</h3>
						<p className="text-gray-500 mb-6">
							Enterate de todas nuestras novedades, eventos y la vida en el
							instituto.
						</p>
						<span className="text-[#E4405F] font-bold group-hover:underline">
							Seguinos &rarr;
						</span>
					</a>

					{/* Facebook */}
					<a
						target="_blank"
						rel="noreferrer"
						href="https://www.facebook.com/englishempirelr"
						className="group flex flex-col items-center text-center p-10 bg-white rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:-translate-y-2"
					>
						<div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 group-hover:bg-[#1877F2] transition-colors duration-300">
							<FiFacebook className="w-10 h-10 text-[#1877F2] group-hover:text-white transition-colors" />
						</div>
						<h3 className="text-2xl font-bold text-[#252d62] mb-2">Facebook</h3>
						<p className="text-gray-500 mb-6">
							Sumate a nuestra comunidad para ver fotos y comunicados oficiales.
						</p>
						<span className="text-[#1877F2] font-bold group-hover:underline">
							Visitar perfil &rarr;
						</span>
					</a>
				</div>

				{/* INFO ADICIONAL (Opcional, pero queda muy bien) */}
				<div className="mt-8 bg-white p-4 md:p-12 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-center gap-10 md:gap-20">
					<div className="flex items-center gap-4 text-[#252d62]">
						<div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
							<MapPin className="w-6 h-6 text-[#EE1120]" />
						</div>
						<div>
							<p className="font-bold text-lg">Visitanos en</p>
							<p className="text-gray-600">
								Padre Caamaño 716, La Rioja, Argentina 5600
							</p>
						</div>
					</div>

					<div className="hidden md:block w-px h-16 bg-gray-200"></div>

					<div className="flex items-center gap-4 text-[#252d62]">
						<div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
							<Mail className="w-6 h-6 text-[#EE1120]" />
						</div>
						<div>
							<p className="font-bold text-lg">Envíanos un correo</p>
							<p className="text-gray-600">englishempirelr@gmail.com</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
