"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { CursoObject, StudentDetails } from "@/types";

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

	// Estado para guardar la selección. "self" significa que se inscribe el titular.
	const [selectedStudentDNI, setSelectedStudentId] = useState<string>("self");

	const onConfirm = () => {
		if (selectedStudentDNI === "self") {
			handleConfirmEnrollment(userData?.dni || ""); // Si es el titular, pasamos su DNI
			return;
		}
		handleConfirmEnrollment(selectedStudentDNI);
	};

	return (
		<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
			<div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
				{/* HEADER MODAL */}
				<div className="bg-[#1d2355] p-6 text-center">
					<h3 className="text-white text-2xl font-bold">
						Confirmar Inscripción
					</h3>
					<p className="text-gray-300 text-sm mt-1">
						Revisa los detalles antes de continuar
					</p>
				</div>

				{/* BODY MODAL */}
				<div className="p-8 flex flex-col gap-6 text-[#252d62] max-h-[70vh] overflow-y-auto">
					<div className="text-center border-b pb-4">
						<h4 className="text-3xl font-bold text-[#EE1120]">
							{curso.nombre}
						</h4>
						<p className="text-lg font-medium mt-1">Precio: ${curso.precio}</p>
					</div>

					<div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm md:text-base">
						<div>
							<p className="font-bold text-gray-500">Duración:</p>
							<p>{curso.duracion}</p>
						</div>
						<div>
							<p className="font-bold text-gray-500">Frecuencia:</p>
							<p>{curso.clasesSemanales} clases/semana</p>
						</div>
						<div>
							<p className="font-bold text-gray-500">Inicio:</p>
							<p>{curso.inicio}</p>
						</div>
						<div>
							<p className="font-bold text-gray-500">Fin:</p>
							<p>{curso.fin}</p>
						</div>
					</div>

					<div className="bg-gray-100 p-4 rounded-lg">
						<p className="font-bold text-[#1d2355] mb-2 text-center">
							Horarios de Clases:
						</p>
						<ul className="space-y-2">
							{curso.horarios.map((h, idx) => (
								<li
									key={idx}
									className="flex justify-between border-b border-gray-300 last:border-0 pb-1 last:pb-0"
								>
									<span className="font-medium">{h.dia}</span>
									<span>{h.hora}</span>
								</li>
							))}
						</ul>
					</div>

					{/* --- NUEVA SECCIÓN: SELECTOR DE ALUMNO --- */}
					{userData && (
						<div className="mt-2 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
							<label
								htmlFor="student-select"
								className="block text-sm font-bold text-[#252d62] mb-2"
							>
								¿A quién vas a inscribir en este curso?
							</label>
							<select
								id="student-select"
								value={selectedStudentDNI}
								onChange={(e) => setSelectedStudentId(e.target.value)}
								className="w-full h-11 px-4 text-base text-gray-900 bg-white rounded-lg border border-gray-300 focus:border-[#1d2355] focus:ring-2 focus:ring-[#1d2355]/20 outline-none transition-all cursor-pointer"
							>
								{/* Opción 1: El titular (siempre disponible si hay userData) */}
								<option value="self">
									Yo ({userData.nombre} {userData.apellido})
								</option>

								{/* Opciones extra: Los hijos (si es tutor y tiene hijos cargados) */}
								{userData.isTutor &&
									userData.hijos &&
									userData.hijos.length > 0 && (
										<optgroup label="Alumnos a cargo">
											{userData.hijos.map(
												(hijo: StudentDetails, index: number) => (
													<option key={hijo.dni || index} value={hijo.dni}>
														{hijo.nombre} {hijo.apellido} (DNI: {hijo.dni})
													</option>
												),
											)}
										</optgroup>
									)}
							</select>
						</div>
					)}
					{/* Si no hay userData (ej. usuario no logueado), podrías mostrar un mensaje pidiendo que inicie sesión aquí, aunque idealmente no debería llegar al modal sin estar logueado. */}
				</div>

				{/* FOOTER MODAL */}
				<div className="p-6 bg-gray-50 flex gap-4 justify-end border-t">
					<button
						onClick={() => setIsModalOpen(false)}
						className="px-6 py-2 rounded-lg text-gray-600 font-bold hover:bg-gray-200 transition-colors"
					>
						Cancelar
					</button>
					<button
						onClick={onConfirm}
						className="px-6 py-2 rounded-lg bg-[#EE1120] text-white font-bold hover:bg-[#b30000] shadow-md transition-colors"
					>
						Confirmar e Ir a Pagar
					</button>
				</div>
			</div>
		</div>
	);
}
