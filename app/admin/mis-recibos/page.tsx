"use client";

/**
 * Mis recibos (panel de admin): las secretarias ven sus recibos de sueldo.
 * Se buscan por el email de la cuenta con la que entraron al panel, que tiene que
 * ser el mismo con el que el director las cargó en Registro de Asistencias → Carga
 * de personal.
 */
import React from "react";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import MisRecibos from "@/components/recibos-personal/MisRecibos";
import { useAdminAuth } from "@/context/AdminAuthContext";

export default function MisRecibosPage() {
	const { adminUser } = useAdminAuth();
	const email = adminUser?.email ?? null;

	return (
		<div className="space-y-6 max-w-7xl mx-auto">
			<motion.div
				initial={{ opacity: 0, x: -20 }}
				animate={{ opacity: 1, x: 0 }}
				className="flex items-center gap-3"
			>
				<div className="bg-[#252d62] p-2.5 rounded-lg">
					<FileText className="w-5 h-5 text-white" />
				</div>
				<div>
					<h1 className="text-2xl font-bold text-[#252d62]">Mis recibos</h1>
					<p className="text-sm text-gray-500">
						Tus recibos de sueldo, para ver y descargar
					</p>
				</div>
			</motion.div>

			<MisRecibos
				filtro={email ? { por: "email", valor: email } : null}
				textoVacio="Todavía no tenés recibos. Cuando el director genere tu recibo del mes, va a aparecer acá."
			/>
		</div>
	);
}
