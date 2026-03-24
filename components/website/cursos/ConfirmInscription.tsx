"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { CursoObject, StudentDetails } from "@/types";
import { X, Tag } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

// ─── Helper: descuento máximo de inscripción para un alumno ──────────────────

async function getMaxDescuentoInscripcion(
	etiquetaIds: string[],
): Promise<{ porcentaje: number; nombre: string } | null> {
	if (!etiquetaIds || etiquetaIds.length === 0) return null;

	try {
		// Traer solo etiquetas activas con descuentoInscripcion > 0
		const snap = await getDocs(
			query(collection(db, "EtiquetasDescuento"), where("activa", "==", true)),
		);

		let maxPorcentaje = 0;
		let maxNombre = "";

		snap.docs.forEach((d) => {
			if (!etiquetaIds.includes(d.id)) return;
			const pct: number = d.data().descuentoInscripcion ?? 0;
			if (pct > maxPorcentaje) {
				maxPorcentaje = pct;
				maxNombre = d.data().nombre ?? d.id;
			}
		});

		return maxPorcentaje > 0
			? { porcentaje: maxPorcentaje, nombre: maxNombre }
			: null;
	} catch {
		return null;
	}
}

// ─── Componente ───────────────────────────────────────────────────────────────

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
	const [descuento, setDescuento] = useState<{
		porcentaje: number;
		nombre: string;
	} | null>(null);
	const [isFetchingDescuento, setIsFetchingDescuento] = useState(false);

	// ── Detectar descuento cuando cambia el alumno seleccionado ──────────────
	useEffect(() => {
		if (!selectedStudentDNI || !userData) {
			setDescuento(null);
			return;
		}

		const fetchDescuento = async () => {
			setIsFetchingDescuento(true);
			try {
				let etiquetaIds: string[] = [];

				if (selectedStudentDNI === "self") {
					// Titular: etiquetas del propio userData
					etiquetaIds = userData.etiquetas ?? [];
				} else {
					// Hijo: buscar en Hijos por DNI
					const snap = await getDocs(
						query(
							collection(db, "Hijos"),
							where("dni", "==", selectedStudentDNI),
						),
					);
					if (!snap.empty) {
						etiquetaIds = snap.docs[0].data().etiquetas ?? [];
					}
				}

				const resultado = await getMaxDescuentoInscripcion(etiquetaIds);
				setDescuento(resultado);
			} catch {
				setDescuento(null);
			} finally {
				setIsFetchingDescuento(false);
			}
		};

		fetchDescuento();
	}, [selectedStudentDNI, userData]);

	const precioOriginal = curso.inscripcion;
	const precioFinal = descuento
		? Math.round(precioOriginal * (1 - descuento.porcentaje / 100))
		: precioOriginal;
	const ahorro = precioOriginal - precioFinal;

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
				{/* HEADER */}
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

				{/* BODY */}
				<div className="p-5 sm:p-8 flex-1 flex flex-col gap-5 text-[#252d62] overflow-y-auto">
					{/* Título del curso y precios */}
					<div className="text-center border-b border-gray-100 pb-4">
						<h4 className="text-2xl sm:text-3xl font-extrabold text-[#252d62] leading-tight">
							{curso.nombre}
						</h4>
						<div className="flex flex-col justify-center items-center gap-2 mt-3">
							{/* Precio inscripción — con o sin descuento */}
							<div
								className={`w-[300px] inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm sm:text-base border ${
									descuento
										? "bg-emerald-50 text-emerald-700 border-emerald-200"
										: "bg-green-50 text-green-700 border-green-200"
								}`}
							>
								{isFetchingDescuento ? (
									<span className="text-green-700">Calculando precio...</span>
								) : descuento ? (
									<>
										<span className="line-through text-gray-400 text-xs font-semibold">
											${precioOriginal.toLocaleString("es-AR")}
										</span>
										<span>
											Inscripción: ${precioFinal.toLocaleString("es-AR")}
										</span>
									</>
								) : (
									<span>
										Valor Inscripción: ${precioOriginal.toLocaleString("es-AR")}
									</span>
								)}
							</div>

							<div className="w-[300px] inline-block bg-green-50 text-green-700 px-4 py-1.5 rounded-full font-bold text-sm sm:text-base border border-green-200">
								Valor Cuota: ${curso.cuota1a10.toLocaleString("es-AR")}
							</div>
						</div>

						{/* Banner de descuento */}
						{descuento && !isFetchingDescuento && (
							<div className="mt-3 inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
								<Tag className="w-4 h-4 shrink-0" />
								<span>
									{descuento.nombre} — {descuento.porcentaje}% off · Ahorrás $
									{ahorro.toLocaleString("es-AR")}
								</span>
							</div>
						)}
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

					{/* Selector de alumno */}
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
								<option value="" disabled className="text-gray-400">
									Seleccione un alumno...
								</option>
								<option value="self" className="text-gray-900 font-medium">
									{userData.nombre} {userData.apellido} - DNI: {userData.dni}
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

				{/* FOOTER */}
				<div className="p-4 sm:p-5 bg-gray-50 flex flex-col-reverse sm:flex-row gap-3 border-t border-gray-200 shrink-0 justify-center">
					<button
						onClick={onConfirm}
						disabled={
							!userData || selectedStudentDNI === "" || isFetchingDescuento
						}
						className="w-full sm:w-auto px-6 py-3 sm:py-2 rounded-xl bg-[#EE1120] text-white font-bold hover:bg-[#c4000e] shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
					>
						{isFetchingDescuento ? "Calculando..." : "Confirmar e Ir a Pagar"}
						{!isFetchingDescuento && (
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
								<line x1="5" y1="12" x2="19" y2="12" />
								<polyline points="12 5 19 12 12 19" />
							</svg>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
