"use client";

/**
 * Precio por hora de cada secretaria, que se usa para calcular su recibo del mes
 * (precio por hora × horas trabajadas). El precio por clase de las profesoras se
 * carga en cada curso.
 */
import React, { useMemo, useState } from "react";
import { AlertCircle, Briefcase, Clock, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPesos } from "@/lib/asistencia/dinero";
import { iniciales } from "@/lib/asistencia/fechas";
import type { RepositorioCarga } from "@/lib/asistencia/repositorio";
import { nombreCompleto, type Persona } from "@/lib/asistencia/tipos";
import { Vacio, mensajeDeError, type Notificar } from "./ui";

/** "" → null; texto inválido o negativo → undefined (error) */
const leerPrecio = (texto: string): number | null | undefined => {
	const t = texto.trim().replace(",", ".");
	if (t === "") return null;
	const n = Number(t);
	return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export default function TabPreciosHora({
	personal,
	repo,
	notificar,
}: {
	personal: Persona[];
	repo: RepositorioCarga;
	notificar: Notificar;
}) {
	// Lo que Juan va escribiendo, por id. Si no hay entrada, se muestra el valor guardado.
	const [borrador, setBorrador] = useState<Record<string, string>>({});
	const [guardando, setGuardando] = useState(false);
	const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

	// Activas primero; las inactivas al final, por si tienen horas pendientes de cobrar
	const secretarias = useMemo(
		() =>
			personal
				.filter((p) => p.rol === "secretaria")
				.sort((a, b) =>
					a.activo === b.activo
						? nombreCompleto(a).localeCompare(nombreCompleto(b))
						: a.activo
							? -1
							: 1,
				),
		[personal],
	);

	const valorDe = (p: Persona) =>
		borrador[p.id] ?? (p.precioHora === null ? "" : String(p.precioHora));

	const cambios = secretarias.flatMap((p) => {
		if (borrador[p.id] === undefined) return [];
		const precio = leerPrecio(borrador[p.id]);
		return precio === p.precioHora ? [] : [{ persona: p, precio }];
	});
	const invalidos = cambios.filter((c) => c.precio === undefined);
	const sinPrecio = secretarias.filter(
		(p) => p.activo && leerPrecio(valorDe(p)) == null,
	).length;

	const guardar = async () => {
		if (invalidos.length > 0) {
			setErrorGuardar("Revisá los precios marcados: tienen que ser números positivos.");
			return;
		}
		setGuardando(true);
		setErrorGuardar(null);
		try {
			await repo.guardarPreciosHora(
				cambios.map((c) => ({
					personalId: c.persona.id,
					precioHora: c.precio ?? null,
				})),
			);
			setBorrador({});
			notificar("Precios guardados.");
		} catch (e) {
			setErrorGuardar(mensajeDeError(e));
		} finally {
			setGuardando(false);
		}
	};

	return (
		<div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
			<div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
				<div>
					<h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
						<Clock className="w-5 h-5 text-[#252d62]" /> Precio por hora de las
						secretarias
					</h2>
					<p className="text-sm text-gray-500">
						El recibo calcula precio por hora × horas trabajadas en el mes. El
						precio por clase de las profesoras se carga en cada curso, en la tab
						&quot;Cursos y profesoras&quot;.
					</p>
				</div>
				{sinPrecio > 0 && (
					<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 self-start sm:self-auto shrink-0">
						<AlertCircle className="w-3 h-3" /> {sinPrecio} sin precio
					</span>
				)}
			</div>

			{secretarias.length === 0 ? (
				<Vacio
					icono={Briefcase}
					titulo="Todavía no hay secretarias cargadas"
					texto="Agregalas en la tab “Carga de personal”."
				/>
			) : (
				<>
					<ul className="divide-y divide-gray-50">
						{secretarias.map((p) => {
							const valor = valorDe(p);
							const invalido = leerPrecio(valor) === undefined;
							return (
								<li
									key={p.id}
									className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
										p.activo ? "" : "opacity-60"
									}`}
								>
									<div className="flex items-center gap-3 min-w-0">
										<div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs shrink-0">
											{iniciales(nombreCompleto(p))}
										</div>
										<div className="min-w-0">
											<p className="font-medium text-gray-900 truncate">
												{nombreCompleto(p)}
											</p>
											<p className="text-xs text-gray-400">
												{!p.activo
													? "Inactiva"
													: p.precioHora === null
														? "Sin precio cargado"
														: `Guardado: ${formatPesos(p.precioHora)} por hora`}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-2 sm:w-56">
										<div className="relative flex-1">
											<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
												$
											</span>
											<input
												type="text"
												inputMode="decimal"
												value={valor}
												onChange={(e) =>
													setBorrador((b) => ({ ...b, [p.id]: e.target.value }))
												}
												placeholder="0"
												aria-label={`Precio por hora de ${nombreCompleto(p)}`}
												aria-invalid={invalido}
												className={`w-full pl-7 pr-3 py-2 bg-white border rounded-lg text-sm text-right text-gray-900 focus:outline-none focus:ring-2 ${
													invalido
														? "border-red-300 focus:ring-red-200"
														: "border-gray-200 focus:ring-[#252d62]/20 focus:border-[#252d62]"
												}`}
											/>
										</div>
										<span className="text-xs text-gray-400 shrink-0">/ hora</span>
									</div>
								</li>
							);
						})}
					</ul>

					<div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div className="text-sm min-h-5">
							{errorGuardar ? (
								<span className="text-red-700 flex items-center gap-1.5">
									<AlertCircle className="w-4 h-4 shrink-0" /> {errorGuardar}
								</span>
							) : cambios.length > 0 ? (
								<span className="text-gray-500">
									{cambios.length} cambio{cambios.length === 1 ? "" : "s"} sin
									guardar
								</span>
							) : null}
						</div>
						<Button
							onClick={guardar}
							disabled={cambios.length === 0 || guardando}
							className="bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold py-5 px-6 rounded-xl flex items-center gap-2 shadow-md transition-all"
						>
							{guardando ? (
								<Loader2 className="w-5 h-5 animate-spin" />
							) : (
								<Save className="w-5 h-5" />
							)}
							Guardar precios
						</Button>
					</div>
				</>
			)}
		</div>
	);
}
