"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, AlertTriangle } from "lucide-react";
import CalendarioAsistencia, {
	type ClaseCalendario,
	type MontoEmpleado,
} from "@/components/admin/asistencia-personal/CalendarioAsistencia";
import AvisoPreciosFaltantes from "@/components/admin/asistencia-personal/AvisoPreciosFaltantes";
import ModalClase from "@/components/admin/asistencia-personal/calendario/ModalClase";
import { estadoRecibo, preciosFaltantes } from "@/lib/asistencia/liquidacion";
import { usePermisosAsistencia } from "@/lib/asistencia/permisos";
import { rutasAsistencia } from "@/lib/asistencia/rutas";
import { periodoDesde, useConfiguracion } from "@/lib/asistencia/useConfiguracion";
import {
	periodoActual,
	periodoValido,
	useDatosDelMes,
} from "@/lib/asistencia/useDatosDelMes";

export default function CalendarioPagina() {
	const { esDirector, verMontos } = usePermisosAsistencia();
	const { fechaInicio, periodoMinimo } = useConfiguracion();
	const router = useRouter();
	const searchParams = useSearchParams();
	// Si se vuelve desde /recibos?periodo=…, el calendario abre en ese mes
	const [periodoElegido, setPeriodo] = useState(
		() => periodoValido(searchParams.get("periodo")) ?? periodoActual(),
	);
	// Nunca antes del mes de inicio del registro
	const periodo = periodoDesde(periodoElegido, periodoMinimo);

	const {
		personal,
		cursos,
		datos,
		dictadas,
		liquidaciones,
		recibos,
		cargando,
		error,
		errorPendientes,
	} = useDatosDelMes(periodo, { esDirector, fechaInicio });
	const [claseAbierta, setClaseAbierta] = useState<ClaseCalendario | null>(null);

	const montos = useMemo(
		() =>
			Object.fromEntries(
				liquidaciones.map((l): [string, MontoEmpleado] => [l.personalId, l]),
			),
		[liquidaciones],
	);

	const estadoRecibos = useMemo(() => {
		const estados = liquidaciones.map((l) =>
			estadoRecibo(l, recibos.get(l.personalId)),
		);
		return {
			generados: estados.filter((e) => e === "generado").length,
			desactualizados: estados.filter((e) => e === "desactualizado").length,
			total: liquidaciones.length,
		};
	}, [liquidaciones, recibos]);

	const faltantes = useMemo(
		() => preciosFaltantes(liquidaciones),
		[liquidaciones],
	);
	const hayFaltantes =
		verMontos &&
		(faltantes.secretarias.length > 0 || faltantes.cursos.length > 0);

	return (
		<>
			{(error || errorPendientes || hayFaltantes) && (
				<div className="max-w-7xl mx-auto px-6 pt-6 space-y-3">
					{error && (
						<div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
							<AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
							<div>
								<p className="text-sm font-bold text-red-800">
									Hubo un problema con los datos del calendario
								</p>
								<p className="text-xs text-red-700">{error}</p>
							</div>
						</div>
					)}
					{errorPendientes && !error && (
						<div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
							<AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
							<div>
								<p className="text-sm font-bold text-amber-800">
									No se pudieron cargar las fichadas para revisar
								</p>
								<p className="text-xs text-amber-700">
									El resto del calendario está completo. {errorPendientes}
								</p>
							</div>
						</div>
					)}
					{verMontos && <AvisoPreciosFaltantes faltantes={faltantes} />}
				</div>
			)}

			<CalendarioAsistencia
				periodo={periodo}
				onCambiarPeriodo={setPeriodo}
				empleados={datos?.empleados ?? []}
				jornadas={datos?.jornadas ?? []}
				clases={datos?.clases ?? []}
				diasEspeciales={datos?.diasEspeciales ?? []}
				pendientes={datos?.pendientes ?? []}
				isLoading={cargando}
				montos={montos}
				recibos={estadoRecibos}
				verMontos={verMontos}
				fechaInicio={fechaInicio}
				onGenerarRecibos={
					verMontos ? () => router.push(rutasAsistencia.recibos(periodo)) : undefined
				}
				onEditarClase={setClaseAbierta}
			/>

			{claseAbierta && personal && cursos && (
				<ModalClase
					key={claseAbierta.id}
					clase={claseAbierta}
					dictada={dictadas.get(claseAbierta.id)}
					personal={personal}
					cursos={cursos}
					diasEspeciales={datos?.diasEspeciales ?? []}
					onCerrar={() => setClaseAbierta(null)}
				/>
			)}
		</>
	);
}
