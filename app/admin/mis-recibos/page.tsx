"use client";

/**
 * Mis recibos (panel de admin): las secretarias ven sus recibos de sueldo.
 * Se buscan por el uid de su cuenta del panel: es el mismo id que su doc de `Personal`.
 */
import React from "react";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import MisRecibos from "@/components/recibos-personal/MisRecibos";
import { useAdminAuth } from "@/context/AdminAuthContext";

export default function MisRecibosPage() {
	const { adminUser } = useAdminAuth();
	const uid = adminUser?.uid ?? null;

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
				filtro={uid ? { por: "personalId", valor: uid } : null}
				textoVacio="Todavía no tenés recibos. Cuando el director genere tu recibo del mes, va a aparecer acá."
			/>
		</div>
	);
}
