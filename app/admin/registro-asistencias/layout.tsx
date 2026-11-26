"use client";

/**
 * Registro de Asistencias (personal): navegación entre Calendario, Recibos y Carga de datos.
 * El acceso al panel ya lo controla AdminGuard (app/admin/layout.tsx).
 * Recibos solo aparece para el director.
 */
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Database, FileCheck2, KeyRound } from "lucide-react";
import { usePermisosAsistencia } from "@/lib/asistencia/permisos";
import { RUTA_ASISTENCIA, rutasAsistencia } from "@/lib/asistencia/rutas";

export default function RegistroAsistenciasLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const { verRecibos } = usePermisosAsistencia();

	const secciones = [
		{ href: rutasAsistencia.calendario(), label: "Calendario", icono: CalendarDays },
		...(verRecibos
			? [{ href: rutasAsistencia.recibos(), label: "Recibos", icono: FileCheck2 }]
			: []),
		{ href: rutasAsistencia.carga(), label: "Carga de datos", icono: Database },
		// Todos la ven; solo el director corrige movimientos y asigna llaveros
		{ href: rutasAsistencia.lector(), label: "Lector y llaveros", icono: KeyRound },
	];

	// En el subdominio admin. la ruta llega sin el prefijo /admin
	const ruta = pathname.startsWith("/admin") ? pathname : `/admin${pathname}`;
	const esActiva = (href: string) =>
		href === RUTA_ASISTENCIA ? ruta === RUTA_ASISTENCIA : ruta.startsWith(href);

	return (
		<div className="-m-4 md:-m-8">
			<nav className="bg-white border-b border-gray-200 px-4 md:px-8">
				<ul className="flex gap-1 overflow-x-auto max-w-7xl mx-auto">
					{secciones.map(({ href, label, icono: Icono }) => {
						const activa = esActiva(href);
						return (
							<li key={href}>
								<Link
									href={href}
									className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
										activa
											? "border-[#252d62] text-[#252d62] font-semibold"
											: "border-transparent text-gray-500 hover:text-[#252d62]"
									}`}
								>
									<Icono className="w-4 h-4" />
									{label}
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>
			{children}
		</div>
	);
}
