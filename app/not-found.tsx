import Link from "next/link";
import { MapPinOff, Home } from "lucide-react";

export default function NotFound() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col items-center justify-center p-4 text-center">
			<div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl shadow-indigo-900/5 max-w-lg w-full border border-gray-100">
				{/* Icono animado/decorativo */}
				<div className="w-20 h-20 bg-indigo-50 text-[#EE1120] rounded-2xl flex items-center justify-center mx-auto mb-6 transform -rotate-6">
					<MapPinOff className="w-10 h-10" />
				</div>

				{/* Títulos */}
				<h1 className="text-6xl md:text-7xl font-black text-[#252d62] mb-2 tracking-tight">
					404
				</h1>
				<h2 className="text-2xl font-bold text-gray-800 mb-4">
					¡Oops! Te perdiste en el Instituto.
				</h2>

				{/* Mensaje */}
				<p className="text-gray-500 mb-8 leading-relaxed">
					La página que estás buscando no existe, fue movida o tal vez
					escribiste mal la dirección. No te preocupes, volvamos a territorio
					conocido.
				</p>

				{/* Botón de acción */}
				<div className="flex flex-col sm:flex-row gap-3 justify-center">
					<Link
						href="/"
						className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-900/20 active:scale-95"
					>
						<Home className="w-5 h-5" />
						Volver al Inicio
					</Link>
				</div>
			</div>

			{/* Footer pequeñito (opcional) */}
			<div className="mt-8 text-sm text-gray-400 font-medium">
				&copy; {new Date().getFullYear()} English Empire Institute
			</div>
		</div>
	);
}
