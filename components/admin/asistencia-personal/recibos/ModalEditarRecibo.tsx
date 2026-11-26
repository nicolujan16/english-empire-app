"use client";

/**
 * Editar un recibo a mano (solo director).
 *
 * Arranca con lo que se imprimiría hoy: la edición anterior si la hay, o lo calculado.
 * Se puede cambiar todo lo que se imprime (nombre, DNI, fecha, renglones) salvo el
 * número, que es correlativo. El total es la suma de los renglones y el monto en
 * letras sale solo. Al guardar se genera el recibo con estos datos (misma numeración).
 */
import React, { useMemo, useState } from "react";
import { AlertTriangle, FilePen, Plus, RotateCcw, Trash2 } from "lucide-react";
import { formatPesos } from "@/lib/asistencia/dinero";
import { nombrePeriodo } from "@/lib/asistencia/fechas";
import type { Liquidacion } from "@/lib/asistencia/liquidacion";
import {
	impresoDesdeLiquidacion,
	totalDeLineas,
	type DatosReciboImpreso,
} from "@/lib/asistencia/reciboImpreso";
import type { EdicionRecibo, LineaRecibo, Persona, Recibo } from "@/lib/asistencia/tipos";
import { Campo, ModalFormulario, inputClase, mensajeDeError } from "../carga/ui";
import DisenoRecibo from "./DisenoRecibo";

/** Renglón mientras se edita: los montos como texto, para poder escribir "1.500,50" */
interface LineaForm {
	clave: number;
	concepto: string;
	cantidad: string;
	precio: string;
	total: string;
}

let siguienteClave = 1;
const aLineaForm = (l: LineaRecibo): LineaForm => ({
	clave: siguienteClave++,
	concepto: l.concepto,
	cantidad: l.cantidad,
	precio: String(l.precio),
	total: String(l.total),
});

/** "1.500,50" o "1500.50" → 1500.5; vacío → 0; inválido → NaN */
const leerMonto = (t: string) => {
	const s = t.trim();
	if (!s) return 0;
	const normal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
	return Number(normal);
};

const aLinea = (l: LineaForm): LineaRecibo => ({
	concepto: l.concepto.trim(),
	cantidad: l.cantidad.trim(),
	precio: Math.round(leerMonto(l.precio) * 100) / 100,
	total: Math.round(leerMonto(l.total) * 100) / 100,
});

interface Form {
	nombreRecibo: string;
	dni: string;
	fechaEmision: string;
	lineas: LineaForm[];
}

const formDesde = (d: Pick<DatosReciboImpreso, "nombreRecibo" | "dni" | "fechaEmision" | "lineas">): Form => ({
	nombreRecibo: d.nombreRecibo,
	dni: d.dni ?? "",
	fechaEmision: d.fechaEmision,
	lineas: d.lineas.map(aLineaForm),
});

export default function ModalEditarRecibo({
	periodo,
	liquidacion: l,
	persona,
	recibo,
	hoy,
	onGuardar,
	onCerrar,
}: {
	periodo: string;
	liquidacion: Liquidacion;
	persona: Persona | undefined;
	recibo: Recibo | undefined;
	hoy: string;
	onGuardar: (edicion: Omit<EdicionRecibo, "editadoEn">) => Promise<void>;
	onCerrar: () => void;
}) {
	// Lo que imprimiría el cálculo automático hoy (para "Restablecer")
	const automatico = useMemo(
		() => impresoDesdeLiquidacion(l, persona, periodo, recibo?.fechaEmision ?? hoy),
		[l, persona, periodo, recibo?.fechaEmision, hoy],
	);
	const [form, setForm] = useState<Form>(() =>
		formDesde(recibo?.edicion ?? automatico),
	);
	const [guardando, setGuardando] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const lineas = form.lineas.map(aLinea);
	const total = totalDeLineas(lineas);
	const vistaPrevia: DatosReciboImpreso = {
		numeroTexto: recibo?.numeroTexto ?? null,
		fechaEmision: form.fechaEmision || hoy,
		periodo,
		nombreRecibo: form.nombreRecibo,
		dni: form.dni.replace(/\D/g, "") || null,
		lineas,
		total,
	};

	// Validación
	const montoInvalido = form.lineas.some(
		(x) => !Number.isFinite(leerMonto(x.precio)) || !Number.isFinite(leerMonto(x.total)),
	);
	const problema = !form.nombreRecibo.trim()
		? "Completá el nombre que va en el recibo."
		: !/^\d{4}-\d{2}-\d{2}$/.test(form.fechaEmision)
			? "Elegí la fecha de emisión."
			: form.lineas.length === 0
				? "El recibo tiene que tener al menos un renglón."
				: form.lineas.some((x) => !x.concepto.trim())
					? "Hay un renglón sin concepto."
					: montoInvalido
						? "Revisá los montos: hay alguno que no es un número."
						: null;

	// Si ya estaba editado y el cálculo automático cambió desde entonces
	const calculoCambio =
		!!recibo?.edicion && recibo.totalAPagar !== l.totalAPagar;

	const setLinea = (clave: number, cambios: Partial<LineaForm>) =>
		setForm((f) => ({
			...f,
			lineas: f.lineas.map((x) => (x.clave === clave ? { ...x, ...cambios } : x)),
		}));

	const guardar = async () => {
		if (problema) {
			setError(problema);
			return;
		}
		setGuardando(true);
		setError(null);
		try {
			await onGuardar({
				nombreRecibo: form.nombreRecibo.trim(),
				dni: form.dni.replace(/\D/g, "") || null,
				fechaEmision: form.fechaEmision,
				lineas,
				total,
			});
			onCerrar();
		} catch (e) {
			setError(mensajeDeError(e));
		} finally {
			setGuardando(false);
		}
	};

	return (
		<ModalFormulario
			abierto
			onCerrar={onCerrar}
			titulo={`Editar recibo · ${l.nombre}`}
			subtitulo={`${nombrePeriodo(periodo)}${recibo?.numeroTexto ? ` · N° ${recibo.numeroTexto}` : " · el número se asigna al guardar"}`}
			icono={FilePen}
			error={error}
			guardando={guardando}
			onGuardar={guardar}
			textoGuardar="Guardar y generar recibo"
			ancho="sm:max-w-6xl"
		>
			<div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-6">
				{/* ── Formulario ── */}
				<div className="space-y-5 min-w-0">
					{calculoCambio && (
						<div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
							<AlertTriangle className="w-4 h-4 shrink-0 mt-px text-amber-600" />
							<span>
								Desde tu última edición cambió el cálculo automático: antes daba{" "}
								<strong>{formatPesos(recibo.totalAPagar)}</strong>, ahora da{" "}
								<strong>{formatPesos(l.totalAPagar)}</strong>. Si querés partir de lo
								calculado, tocá “Restablecer”.
							</span>
						</div>
					)}

					<div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_10rem_11rem] gap-4">
						<Campo label="Nombre en el recibo" hint="Como va impreso: Apellido, Nombre">
							<input
								value={form.nombreRecibo}
								onChange={(e) => setForm({ ...form, nombreRecibo: e.target.value })}
								className={inputClase}
							/>
						</Campo>
						<Campo label="DNI">
							<input
								inputMode="numeric"
								value={form.dni}
								onChange={(e) => setForm({ ...form, dni: e.target.value })}
								placeholder="Sin DNI"
								className={inputClase}
							/>
						</Campo>
						<Campo label="Fecha de emisión">
							<input
								type="date"
								value={form.fechaEmision}
								onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })}
								className={inputClase}
							/>
						</Campo>
					</div>

					{/* Renglones */}
					<div className="space-y-2">
						<div className="flex items-center justify-between gap-2">
							<label className="text-sm font-semibold text-gray-700">Renglones</label>
							<button
								type="button"
								onClick={() => setForm((f) => ({ ...f, lineas: formDesde(automatico).lineas, nombreRecibo: automatico.nombreRecibo, dni: automatico.dni ?? "" }))}
								className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#252d62]"
								title="Volver a lo que da el cálculo automático"
							>
								<RotateCcw className="w-3.5 h-3.5" /> Restablecer
							</button>
						</div>

						<div className="hidden md:grid grid-cols-[minmax(0,1fr)_7rem_8rem_8rem_2.25rem] gap-2 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
							<span>Concepto</span>
							<span>Cantidad</span>
							<span>Precio</span>
							<span>Total</span>
							<span />
						</div>
						{form.lineas.map((x) => (
							<div
								key={x.clave}
								className="grid grid-cols-2 md:grid-cols-[minmax(0,1fr)_7rem_8rem_8rem_2.25rem] gap-2 p-2 bg-gray-50 border border-gray-100 rounded-xl"
							>
								<input
									value={x.concepto}
									onChange={(e) => setLinea(x.clave, { concepto: e.target.value })}
									placeholder="Concepto"
									aria-label="Concepto"
									className={`${inputClase} col-span-2 md:col-span-1`}
								/>
								<input
									value={x.cantidad}
									onChange={(e) => setLinea(x.clave, { cantidad: e.target.value })}
									placeholder="Ej.: 8 AL"
									aria-label="Cantidad"
									className={inputClase}
								/>
								<input
									inputMode="decimal"
									value={x.precio}
									onChange={(e) => setLinea(x.clave, { precio: e.target.value })}
									placeholder="0"
									aria-label="Precio"
									className={`${inputClase} text-right`}
								/>
								<input
									inputMode="decimal"
									value={x.total}
									onChange={(e) => setLinea(x.clave, { total: e.target.value })}
									placeholder="0"
									aria-label="Total"
									className={`${inputClase} text-right font-semibold`}
								/>
								<button
									type="button"
									onClick={() =>
										setForm((f) => ({ ...f, lineas: f.lineas.filter((y) => y.clave !== x.clave) }))
									}
									className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors justify-self-end"
									aria-label="Quitar renglón"
								>
									<Trash2 className="w-4 h-4" />
								</button>
							</div>
						))}
						<button
							type="button"
							onClick={() =>
								setForm((f) => ({
									...f,
									lineas: [...f.lineas, aLineaForm({ concepto: "", cantidad: "", precio: 0, total: 0 })],
								}))
							}
							className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm font-bold text-[#252d62] hover:bg-indigo-50 transition-colors"
						>
							<Plus className="w-4 h-4" /> Agregar renglón
						</button>
						<p className="text-xs text-gray-400">
							El total de cada renglón se escribe a mano (no se multiplica solo). Para
							descontar algo, poné el total en negativo (ej.: -5000).
						</p>
					</div>

					<div className="flex items-baseline justify-between gap-3 pt-3 border-t border-dashed border-gray-200">
						<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
							Total del recibo
						</p>
						<div className="text-right">
							<p className="text-2xl font-black text-[#252d62]">{formatPesos(total)}</p>
							{total !== l.totalAPagar && (
								<p className="text-xs text-gray-400">
									Calculado automáticamente: {formatPesos(l.totalAPagar)}
								</p>
							)}
						</div>
					</div>

					<p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
						Al guardar se genera el recibo con estos datos y queda marcado como
						“Editado a mano”. El número no cambia. Si después tocás “Volver a
						generar”, se calcula de nuevo y se pierden estos cambios.
					</p>
				</div>

				{/* ── Vista previa ── */}
				<div className="xl:sticky xl:top-0 self-start">
					<p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
						Vista previa
					</p>
					<div className="border border-gray-200 rounded-lg shadow-sm overflow-hidden bg-white w-fit mx-auto">
						<div style={{ zoom: 0.62 }}>
							<DisenoRecibo datos={vistaPrevia} />
						</div>
					</div>
				</div>
			</div>
		</ModalFormulario>
	);
}
