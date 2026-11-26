import Link from "next/link";
import { DollarSign } from "lucide-react";
import { rutasAsistencia } from "@/lib/asistencia/rutas";

/** Aviso de precios sin cargar: esa parte del recibo sale en $0 */
export default function AvisoPreciosFaltantes({
	faltantes,
}: {
	faltantes: { secretarias: string[]; cursos: string[] };
}) {
	if (faltantes.secretarias.length === 0 && faltantes.cursos.length === 0)
		return null;

	return (
		<div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
			<DollarSign className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
			<div className="space-y-1">
				<p className="text-sm font-bold text-amber-800">
					Faltan precios para calcular los recibos del mes
				</p>
				{faltantes.secretarias.length > 0 && (
					<p className="text-xs text-amber-700">
						Sin precio por hora: {faltantes.secretarias.join(", ")}.{" "}
						<Link
							href={rutasAsistencia.carga("precios")}
							className="font-bold underline hover:text-amber-900"
						>
							Cargalo en Carga de datos → Precio/hora - Secretarias
						</Link>
					</p>
				)}
				{faltantes.cursos.length > 0 && (
					<p className="text-xs text-amber-700">
						Cursos sin alumnos, monto fijo o porcentaje cargado: {faltantes.cursos.join(", ")}.{" "}
						<Link
							href={rutasAsistencia.carga("cursos")}
							className="font-bold underline hover:text-amber-900"
						>
							Cargalo en Carga de datos → Liquidación de cursos
						</Link>
					</p>
				)}
				<p className="text-xs text-amber-700">
					Si generás el recibo igual, esa parte sale en $0.
				</p>
			</div>
		</div>
	);
}
