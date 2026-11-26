"use client";

/**
 * Computadoras vinculadas (solo director): las que pueden fichar con la aplicación de
 * escritorio. Se vinculan desde la propia aplicación (el director inicia sesión y toca
 * "Vincular esta computadora"); acá se ven y se desactivan.
 * Se leen por la API (la colección Dispositivos no se puede leer desde el navegador).
 */
import React, { useCallback, useEffect, useState } from "react";
import { Ban, Info, Loader2, Monitor, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebaseConfig";
import { fechaHoraCorta } from "@/lib/asistencia/fechas";
import { ModalFormulario, Vacio, mensajeDeError, type Notificar } from "../carga/ui";

interface Computadora {
	id: string;
	nombre: string;
	activo: boolean;
	creadoEn: string | null;
	ultimoContactoEn: string | null;
}

async function llamar(url: string, init?: RequestInit) {
	const token = await auth.currentUser?.getIdToken();
	if (!token) throw new Error("Tu sesión venció: volvé a iniciar sesión.");
	const r = await fetch(url, {
		...init,
		headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
	});
	const datos = await r.json().catch(() => ({}));
	if (!r.ok || datos.ok === false) throw new Error(datos.mensaje ?? "No se pudo completar la acción.");
	return datos;
}

/** "hace 3 min", "hace 2 h", o la fecha */
const contactoTexto = (isoFecha: string | null) => {
	if (!isoFecha) return "Nunca se conectó";
	const d = new Date(isoFecha);
	const min = Math.round((Date.now() - d.getTime()) / 60000);
	if (min < 2) return "Conectada ahora";
	if (min < 60) return `Hace ${min} min`;
	if (min < 24 * 60) return `Hace ${Math.round(min / 60)} h`;
	return fechaHoraCorta(d);
};

export default function TabComputadoras({ notificar }: { notificar: Notificar }) {
	const [lista, setLista] = useState<Computadora[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [cargando, setCargando] = useState(false);
	const [aDesactivar, setADesactivar] = useState<Computadora | null>(null);
	const [guardando, setGuardando] = useState(false);
	const [errorAccion, setErrorAccion] = useState<string | null>(null);

	const cargar = useCallback(async () => {
		setCargando(true);
		setError(null);
		try {
			const datos = await llamar("/api/asistencia/dispositivos");
			setLista(datos.dispositivos as Computadora[]);
		} catch (e) {
			setError(mensajeDeError(e));
		} finally {
			setCargando(false);
		}
	}, []);

	useEffect(() => {
		// Carga inicial: la lista vive en el servidor (no hay suscripción en vivo)
		cargar();
	}, [cargar]);

	const cambiarEstado = async (c: Computadora, activo: boolean) => {
		setGuardando(true);
		setErrorAccion(null);
		try {
			await llamar("/api/asistencia/dispositivos/estado", {
				method: "POST",
				body: JSON.stringify({ id: c.id, activo }),
			});
			notificar(activo ? `“${c.nombre}” puede volver a fichar.` : `“${c.nombre}” quedó desactivada.`);
			setADesactivar(null);
			await cargar();
		} catch (e) {
			if (activo) notificar(mensajeDeError(e), "error");
			else setErrorAccion(mensajeDeError(e));
		} finally {
			setGuardando(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-start gap-2.5 text-sm text-indigo-900">
				<Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" />
				<p>
					Son las computadoras que pueden registrar asistencia con la aplicación de
					escritorio. Para vincular una, abrí la aplicación en esa computadora, iniciá
					sesión como director y tocá <strong>“Vincular esta computadora”</strong>. Si
					una se pierde o se reemplaza, desactivala acá: deja de poder fichar al instante.
				</p>
			</div>

			<div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
				<div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
					<p className="text-sm text-gray-500">
						{lista ? `${lista.filter((c) => c.activo).length} activa${lista.filter((c) => c.activo).length === 1 ? "" : "s"}` : " "}
					</p>
					<Button
						variant="ghost"
						onClick={cargar}
						disabled={cargando}
						className="text-[#252d62] font-semibold flex items-center gap-1.5"
					>
						{cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
						Actualizar
					</Button>
				</div>

				{error ? (
					<p className="px-6 py-6 text-sm text-red-700">{error}</p>
				) : !lista ? (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="w-8 h-8 animate-spin text-[#252d62]" />
					</div>
				) : lista.length === 0 ? (
					<Vacio
						icono={Monitor}
						titulo="Todavía no hay computadoras vinculadas"
						texto="Vinculá la computadora de recepción desde la aplicación de escritorio."
					/>
				) : (
					<ul className="divide-y divide-gray-50">
						{lista.map((c) => (
							<li key={c.id} className={`px-6 py-4 flex items-center gap-4 ${c.activo ? "" : "opacity-60"}`}>
								<div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#252d62] flex items-center justify-center shrink-0">
									<Monitor className="w-5 h-5" />
								</div>
								<div className="flex-1 min-w-0">
									<p className="font-semibold text-gray-900 truncate">{c.nombre}</p>
									<p className="text-xs text-gray-500">
										{c.activo ? contactoTexto(c.ultimoContactoEn) : "Desactivada"}
										{c.creadoEn ? ` · vinculada el ${fechaHoraCorta(new Date(c.creadoEn))}` : ""}
									</p>
								</div>
								{c.activo ? (
									<Button
										variant="ghost"
										onClick={() => {
											setErrorAccion(null);
											setADesactivar(c);
										}}
										className="text-red-600 hover:bg-red-50 font-semibold flex items-center gap-1.5"
									>
										<Ban className="w-4 h-4" /> Desactivar
									</Button>
								) : (
									<Button
										variant="ghost"
										onClick={() => cambiarEstado(c, true)}
										disabled={guardando}
										className="text-[#252d62] hover:bg-indigo-50 font-semibold flex items-center gap-1.5"
									>
										<RotateCcw className="w-4 h-4" /> Reactivar
									</Button>
								)}
							</li>
						))}
					</ul>
				)}
			</div>

			<ModalFormulario
				abierto={!!aDesactivar}
				onCerrar={() => setADesactivar(null)}
				titulo="¿Desactivar la computadora?"
				subtitulo={aDesactivar?.nombre}
				icono={Ban}
				variante="rojo"
				textoGuardar="Desactivar"
				guardando={guardando}
				error={errorAccion}
				onGuardar={() => aDesactivar && cambiarEstado(aDesactivar, false)}
			>
				<p className="text-sm text-gray-600">
					Desde ese momento, los llaveros que se apoyen en esa computadora no se van a
					registrar. Si fue un error, la podés reactivar.
				</p>
			</ModalFormulario>
		</div>
	);
}
