"use client";

import { Suspense } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import Recibos from "@/components/admin/asistencia-personal/recibos/Recibos";
import { usePermisosAsistencia } from "@/lib/asistencia/permisos";

// Recibos lee ?periodo= con useSearchParams: va dentro de un Suspense
export default function Page() {
	const { verRecibos } = usePermisosAsistencia();

	if (!verRecibos) {
		return (
			<div className="max-w-md mx-auto my-16 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
				<div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
					<ShieldAlert className="w-6 h-6" />
				</div>
				<h2 className="text-lg font-bold text-[#252d62]">Solo para el director</h2>
				<p className="text-sm text-gray-500 mt-1">
					Los recibos del personal solo los puede ver y generar el director del
					instituto.
				</p>
			</div>
		);
	}

	return (
		<Suspense
			fallback={
				<div className="flex items-center justify-center h-96">
					<Loader2 className="w-10 h-10 animate-spin text-[#252d62]" />
				</div>
			}
		>
			<Recibos />
		</Suspense>
	);
}
