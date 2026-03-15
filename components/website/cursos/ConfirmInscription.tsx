"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { CursoObject, StudentDetails } from "@/types";
import { X } from "lucide-react";

export default function ConfirmInscription({
	curso,
	setIsModalOpen,
	handleConfirmEnrollment,
}: {
	curso: CursoObject;
	setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
	handleConfirmEnrollment: (estudianteSeleccionado: string) => void;
}) {
	const { userData } = useAuth();

	const [selectedStudentDNI, setSelectedStudentId] = useState<string>("");

	const onConfirm = () => {
		if (selectedStudentDNI === "self") {
			handleConfirmEnrollment(userData?.dni || "");
			return;
		}

		handleConfirmEnrollment(selectedStudentDNI);
	};

	return (
		<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6 animate-in fade-in duration-200">
			<div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
				{/* HEADER MODAL */}
				<div className="bg-[#1d2355] p-5 text-center border-b-4 border-[#EE1120] relative shrink-0">
					<h3 className="text-white text-xl sm:text-2xl font-bold tracking-wide pr-6">
						Confirmar Inscripción
					</h3>
					<p className="text-gray-300 text-xs sm:text-sm mt-1">
						Revisa los detalles antes de ir al pago
					</p>

					<button
						onClick={() => setIsModalOpen(false)}
						className="absolute top-4 right-4 text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* BODY MODAL */}
				<div className="p-5 sm:p-8 flex-1 flex flex-col gap-5 text-[#252d62] overflow-y-auto">
					{/* Título del curso y Precio */}
					<div className="text-center border-b border-gray-100 pb-4">
						<h4 className="text-2xl sm:text-3xl font-extrabold text-[#252d62] leading-tight">
							{curso.nombre}
						</h4>
						<div className="flex flex-col justify-center items-center">
							<div className="mt-3 w-[300px] inline-block bg-green-50 text-green-700 px-4 py-1.5 rounded-full font-bold text-sm sm:text-base border border-green-200">
								Valor Inscripción: ${curso.inscripcion.toLocaleString("es-AR")}
							</div>
							<div className="mt-3 w-[300px] inline-block bg-green-50 text-green-700 px-4 py-1.5 rounded-full font-bold text-sm sm:text-base border border-green-200">
								Valor Cuota: ${curso.cuota1a10.toLocaleString("es-AR")}
							</div>
						</div>
					</div>

					{/* Grilla de info */}
					<div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs sm:text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
						<div>
							<p className="font-bold text-gray-400 uppercase tracking-wider mb-1">
								Duración
							</p>
							<p className="font-semibold">{curso.duracion}</p>
						</div>
						<div>
							<p className="font-bold text-gray-400 uppercase tracking-wider mb-1">
								Frecuencia
							</p>
							<p className="font-semibold">
								{curso.clasesSemanales} clases/sem
							</p>
						</div>
						<div>
							<p className="font-bold text-gray-400 uppercase tracking-wider mb-1">
								Inicio
							</p>
							<p className="font-semibold">{curso.inicio}</p>
						</div>
						<div>
							<p className="font-bold text-gray-400 uppercase tracking-wider mb-1">
								Fin
							</p>
							<p className="font-semibold">{curso.fin}</p>
						</div>
					</div>

					{/* Horarios */}
					<div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
						<p className="font-bold text-[#1d2355] mb-3 flex items-center gap-2 text-sm sm:text-base">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<circle cx="12" cy="12" r="10" />
								<polyline points="12 6 12 12 16 14" />
							</svg>
							Horarios de Cursada:
						</p>
						<ul className="space-y-2 text-sm">
							{curso.horarios.map((h, idx) => (
								<li
									key={idx}
									className="flex justify-between bg-white px-3 py-2 rounded-lg border border-blue-50 shadow-sm"
								>
									<span className="font-bold text-gray-700">{h.dia}</span>
									<span className="text-[#EE1120] font-medium">
										{h.hora || "A definir"}
									</span>
								</li>
							))}
						</ul>
					</div>

					{/* --- SELECTOR DE ALUMNO --- */}
					{userData ? (
						<div className="mt-1">
							<label
								htmlFor="student-select"
								className="block text-xs sm:text-sm font-bold text-[#252d62] mb-2"
							>
								¿A quién vas a inscribir en este curso?
							</label>
							<select
								id="student-select"
								value={selectedStudentDNI}
								onChange={(e) => setSelectedStudentId(e.target.value)}
								className={`w-full h-11 sm:h-12 px-3 sm:px-4 text-sm sm:text-base bg-white rounded-xl border-2 focus:border-[#EE1120] focus:ring-0 outline-none transition-all cursor-pointer font-medium ${
									selectedStudentDNI === ""
										? "border-gray-200 text-gray-500"
										: "border-gray-300 text-gray-900"
								}`}
							>
								{/* --- NUEVA OPCIÓN POR DEFECTO --- */}
								<option value="" disabled className="text-gray-400">
									Seleccione un alumno...
								</option>

								<option value="self" className="text-gray-900 font-medium">
									Yo ({userData.nombre} {userData.apellido})
								</option>

								{userData.hijos && userData.hijos.length > 0 && (
									<optgroup
										label="Alumnos a cargo"
										className="font-bold text-gray-900"
									>
										{userData.hijos.map(
											(hijo: StudentDetails, index: number) => (
												<option
													key={hijo.dni || index}
													value={hijo.dni}
													className="font-medium"
												>
													{hijo.nombre} {hijo.apellido} - DNI: {hijo.dni}
												</option>
											),
										)}
									</optgroup>
								)}
							</select>
						</div>
					) : (
						<div className="mt-2 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-center">
							<p className="text-red-600 font-bold text-xs sm:text-sm">
								Debes iniciar sesión para inscribirte.
							</p>
						</div>
					)}
				</div>

				{/* FOOTER MODAL */}
				<div className="p-4 justify-center sm:p-5 bg-gray-50 flex flex-col-reverse sm:flex-row gap-3 border-t border-gray-200 shrink-0">
					<button
						onClick={onConfirm}
						// --- CAMBIO: Se deshabilita si no hay usuario o si no eligió a nadie ---
						disabled={!userData || selectedStudentDNI === ""}
						className="w-full sm:w-auto px-6 py-3 sm:py-2 rounded-xl bg-[#EE1120] text-white font-bold hover:bg-[#c4000e] shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
					>
						Confirmar e Ir a Pagar
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<line x1="5" y1="12" x2="19" y2="12"></line>
							<polyline points="12 5 19 12 12 19"></polyline>
						</svg>
					</button>
				</div>
			</div>
		</div>
	);
}
