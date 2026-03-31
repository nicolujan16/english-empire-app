import React, { SyntheticEvent } from "react";
import {
	Search,
	Loader2,
	AlertCircle,
	CheckCircle2,
	Users,
	Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Link from "next/link";
import { StudentData, GrupoFamiliarInfo } from "./ManualInscriptionModal"; // Importamos las interfaces del padre

interface Step1Props {
	searchDni: string;
	setSearchDni: (val: string) => void;
	isSearching: boolean;
	searchError: string;
	foundStudent: StudentData | null;
	grupoFamiliar: GrupoFamiliarInfo;
	isCheckingGrupo: boolean;
	aplicarDescuentoMesActual: boolean;
	setAplicarDescuentoMesActual: (val: boolean) => void;
	handleSearchStudent: (e: SyntheticEvent) => void;
	onNext: () => void;
	onClose: () => void;
}

export default function Step1SearchStudent({
	searchDni,
	setSearchDni,
	isSearching,
	searchError,
	foundStudent,
	grupoFamiliar,
	isCheckingGrupo,
	aplicarDescuentoMesActual,
	setAplicarDescuentoMesActual,
	handleSearchStudent,
	onNext,
	onClose,
}: Step1Props) {
	return (
		<form onSubmit={handleSearchStudent} className="space-y-6">
			<div className="space-y-4">
				<label className="block text-sm font-bold text-[#252d62]">
					1. Identificación del Alumno
				</label>
				<p className="text-sm text-gray-500">
					Ingresa el DNI para buscar si el alumno ya se encuentra en nuestra
					base de datos.
				</p>

				<div className="flex gap-3">
					<div className="relative flex-1">
						<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
							<Search className="h-4 w-4 text-gray-400" />
						</div>
						<input
							type="text"
							value={searchDni}
							onChange={(e) => setSearchDni(e.target.value)}
							placeholder="Número de DNI"
							className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-[#252d62] bg-gray-50 focus:bg-white"
							required
						/>
					</div>
					<Button
						type="submit"
						disabled={isSearching || !searchDni}
						className="bg-[#252d62] hover:bg-[#1d2355] text-white"
					>
						{isSearching ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							"Buscar"
						)}
					</Button>
				</div>

				{searchError && (
					<div className="bg-red-50 border border-red-100 p-4 rounded-lg flex flex-col gap-3">
						<div className="flex items-start gap-2">
							<AlertCircle className="w-5 h-5 text-[#EE1120] shrink-0 mt-0.5" />
							<p className="text-sm text-red-800 font-medium">{searchError}</p>
						</div>
						{searchError.includes("No se encontró") && (
							<Link href="/admin/alumnos" onClick={onClose}>
								<Button
									variant="outline"
									className="w-full text-sm border-red-200 text-[#EE1120] hover:bg-red-100"
								>
									Ir a Crear Nuevo Alumno
								</Button>
							</Link>
						)}
					</div>
				)}

				{foundStudent && (
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						className="space-y-3"
					>
						<div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-start gap-3">
							<div className="bg-white p-2 rounded-full shrink-0">
								<CheckCircle2 className="w-6 h-6 text-green-600" />
							</div>
							<div>
								<h4 className="font-bold text-green-900">
									{foundStudent.nombre} {foundStudent.apellido}
								</h4>
								<p className="text-sm text-green-700 font-mono mt-1">
									DNI: {foundStudent.dni}
								</p>
								<div className="flex gap-2 mt-2">
									<span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs font-bold rounded">
										Perfil: {foundStudent.tipo}
									</span>
									<span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs font-bold rounded">
										Edad: {foundStudent.edad} años
									</span>
								</div>
							</div>
						</div>

						{isCheckingGrupo && (
							<div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 p-3 rounded-lg">
								<Loader2 className="w-4 h-4 animate-spin text-[#252d62]" />{" "}
								Verificando beneficios del grupo familiar...
							</div>
						)}

						{!isCheckingGrupo && grupoFamiliar.aplica && (
							<motion.div
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg space-y-3"
							>
								<div className="flex items-start gap-2">
									<Users className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
									<div>
										<p className="text-sm font-bold text-emerald-800">
											¡Descuento por Grupo Familiar disponible!
										</p>
										<p className="text-xs text-emerald-700 mt-0.5">
											Al inscribir y <strong>confirmar</strong> el pago, todos
											recibirán un{" "}
											<span className="font-bold">
												10% de descuento en cuotas
											</span>
											.
										</p>
									</div>
								</div>
								<div className="space-y-1.5">
									<p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
										Miembros activos
									</p>
									{grupoFamiliar.miembrosActivos.map((m, i) => (
										<div
											key={i}
											className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-emerald-100"
										>
											<Tag className="w-3 h-3 text-emerald-500 shrink-0" />
											<span className="text-xs font-semibold text-emerald-800">
												{m.nombre}
											</span>
											<span className="text-xs text-emerald-600 ml-auto">
												{m.cursoNombre}
											</span>
										</div>
									))}
								</div>
								<label className="flex items-center gap-2.5 cursor-pointer select-none border-t border-emerald-200 pt-2">
									<input
										type="checkbox"
										checked={aplicarDescuentoMesActual}
										onChange={(e) =>
											setAplicarDescuentoMesActual(e.target.checked)
										}
										className="w-4 h-4 text-emerald-600 rounded"
									/>
									<span className="text-xs font-semibold text-emerald-800">
										Aplicar descuento en cuota del mes actual
									</span>
								</label>
							</motion.div>
						)}
					</motion.div>
				)}
			</div>
			<div className="pt-4 border-t border-gray-100 flex justify-end">
				<Button
					type="button"
					onClick={onNext}
					disabled={!foundStudent || isCheckingGrupo}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white"
				>
					Confirmar y Continuar
				</Button>
			</div>
		</form>
	);
}
