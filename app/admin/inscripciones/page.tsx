"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button"; // Asegúrate de que la ruta apunte bien a tus botones
import ManualInscriptionModal from "@/components/admin/inscripciones/ManualInscriptionModal";
import InscriptionsTable from "@/components/admin/inscripciones/InscriptionTable";

export default function AdminInscripcionesPage() {
	const [isModalOpen, setIsModalOpen] = useState(false);

	return (
		<div className="max-w-7xl mx-auto">
			{/* Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
				<div>
					<h1 className="text-3xl font-bold text-[#252d62] mb-2">
						Historial de Inscripciones
					</h1>
					<p className="text-gray-500">
						Gestiona las altas, bajas y estados de pago de los alumnos.
					</p>
				</div>
				<Button
					onClick={() => setIsModalOpen(true)}
					className="bg-[#EE1120] hover:bg-[#c4000e] text-white shadow-md hover:shadow-lg transition-all"
				>
					<Plus className="w-4 h-4 mr-2" />
					Inscribir manualmente
				</Button>
			</div>

			{/* Tabla de Datos */}
			<InscriptionsTable showTitle={false}></InscriptionsTable>

			{isModalOpen && (
				<ManualInscriptionModal
					isOpen={isModalOpen}
					onClose={() => setIsModalOpen(false)}
				/>
			)}
		</div>
	);
}
