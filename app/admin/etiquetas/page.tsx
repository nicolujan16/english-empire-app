"use client";

import React, { useState, useEffect } from "react";
import {
	Tags,
	Plus,
	Loader2,
	Tag,
	Percent,
	GraduationCap,
	Users,
	AlertCircle,
	CheckCircle2,
	XCircle,
	Layers,
} from "lucide-react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";

import EtiquetaModal, {
	type EtiquetaDescuento as EtiquetaType,
} from "@/components/admin/etiquetas/CrearEtiquetasModal";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface EtiquetaDescuento {
	id: string;
	nombre: string;
	descripcion?: string;
	color: string;
	descuentoInscripcion: number | null;
	descuentoCuota: number | null;
	acumulableConGrupoFamiliar: boolean;
	activa: boolean;
	creadoEn?: { toDate: () => Date };
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLORES_BADGE: Record<string, string> = {
	emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
	blue: "bg-blue-100 text-blue-700 border-blue-200",
	violet: "bg-violet-100 text-violet-700 border-violet-200",
	amber: "bg-amber-100 text-amber-700 border-amber-200",
	rose: "bg-rose-100 text-rose-700 border-rose-200",
	cyan: "bg-cyan-100 text-cyan-700 border-cyan-200",
	gray: "bg-gray-100 text-gray-700 border-gray-200",
};

const COLORES_DOT: Record<string, string> = {
	emerald: "bg-emerald-400",
	blue: "bg-blue-400",
	violet: "bg-violet-400",
	amber: "bg-amber-400",
	rose: "bg-rose-400",
	cyan: "bg-cyan-400",
	gray: "bg-gray-400",
};

// ─── Componente de tarjeta ────────────────────────────────────────────────────

function EtiquetaCard({
	etiqueta,
	onEdit,
}: {
	etiqueta: EtiquetaDescuento;
	onEdit: (e: EtiquetaDescuento) => void;
}) {
	const badgeClass = COLORES_BADGE[etiqueta.color] ?? COLORES_BADGE.gray;
	const dotClass = COLORES_DOT[etiqueta.color] ?? COLORES_DOT.gray;

	return (
		<div
			className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 transition-all hover:shadow-md ${
				!etiqueta.activa ? "opacity-60" : ""
			}`}
		>
			{/* Cabecera */}
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-center gap-3 min-w-0">
					<div
						className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${badgeClass}`}
					>
						<Tag className="w-4 h-4" />
					</div>
					<div className="min-w-0">
						<div className="flex items-center gap-2 flex-wrap">
							<h3 className="font-bold text-[#252d62] text-sm truncate">
								{etiqueta.nombre}
							</h3>
							<span
								className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeClass}`}
							>
								<span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
								{etiqueta.activa ? "Activa" : "Inactiva"}
							</span>
						</div>
						{etiqueta.descripcion && (
							<p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
								{etiqueta.descripcion}
							</p>
						)}
					</div>
				</div>
			</div>

			{/* Descuentos */}
			<div className="grid grid-cols-2 gap-3">
				<div
					className={`rounded-xl p-3 border ${
						etiqueta.descuentoInscripcion
							? "bg-emerald-50 border-emerald-200"
							: "bg-gray-50 border-gray-100"
					}`}
				>
					<div className="flex items-center gap-1.5 mb-1">
						<GraduationCap
							className={`w-3.5 h-3.5 ${etiqueta.descuentoInscripcion ? "text-emerald-600" : "text-gray-400"}`}
						/>
						<span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
							Inscripción
						</span>
					</div>
					{etiqueta.descuentoInscripcion ? (
						<p className="text-lg font-black text-emerald-600">
							{etiqueta.descuentoInscripcion}%
							<span className="text-xs font-semibold text-emerald-500 ml-1">
								off
							</span>
						</p>
					) : (
						<p className="text-sm font-semibold text-gray-400">Sin descuento</p>
					)}
				</div>

				<div
					className={`rounded-xl p-3 border ${
						etiqueta.descuentoCuota
							? "bg-blue-50 border-blue-200"
							: "bg-gray-50 border-gray-100"
					}`}
				>
					<div className="flex items-center gap-1.5 mb-1">
						<Percent
							className={`w-3.5 h-3.5 ${etiqueta.descuentoCuota ? "text-blue-600" : "text-gray-400"}`}
						/>
						<span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
							Cuotas
						</span>
					</div>
					{etiqueta.descuentoCuota ? (
						<p className="text-lg font-black text-blue-600">
							{etiqueta.descuentoCuota}%
							<span className="text-xs font-semibold text-blue-500 ml-1">
								off
							</span>
						</p>
					) : (
						<p className="text-sm font-semibold text-gray-400">Sin descuento</p>
					)}
				</div>
			</div>

			{/* Acumulación con Grupo Familiar */}
			<div
				className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-xs font-semibold ${
					etiqueta.acumulableConGrupoFamiliar
						? "bg-violet-50 border-violet-200 text-violet-700"
						: "bg-gray-50 border-gray-200 text-gray-500"
				}`}
			>
				{etiqueta.acumulableConGrupoFamiliar ? (
					<>
						<CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
						<span>Acumulable con Descuento Grupo Familiar</span>
					</>
				) : (
					<>
						<XCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
						<span>No acumulable con Descuento Grupo Familiar</span>
					</>
				)}
			</div>
			{/* Botón editar */}
			<button
				onClick={() => onEdit(etiqueta)}
				className="w-full text-center text-xs font-bold text-[#252d62] border border-[#252d62]/20 hover:bg-[#252d62] hover:text-white rounded-xl py-2 transition-all"
			>
				Editar etiqueta
			</button>
		</div>
	);
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EtiquetasPage() {
	const [etiquetas, setEtiquetas] = useState<EtiquetaDescuento[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [etiquetaToEdit, setEtiquetaToEdit] = useState<EtiquetaType | null>(
		null,
	);

	const handleOpenCreate = () => {
		setEtiquetaToEdit(null);
		setIsModalOpen(true);
	};

	const handleOpenEdit = (e: EtiquetaType) => {
		setEtiquetaToEdit(e);
		setIsModalOpen(true);
	};

	const handleSuccess = () => {
		// Recargar etiquetas
		setIsLoading(true);
		import("firebase/firestore").then(
			({ getDocs, collection, query, orderBy }) => {
				getDocs(
					query(
						collection(db, "EtiquetasDescuento"),
						orderBy("creadoEn", "desc"),
					),
				)
					.then((snap) => {
						setEtiquetas(
							snap.docs.map((d) => ({
								id: d.id,
								...(d.data() as Omit<EtiquetaDescuento, "id">),
							})),
						);
					})
					.finally(() => setIsLoading(false));
			},
		);
	};

	useEffect(() => {
		const fetchEtiquetas = async () => {
			setIsLoading(true);
			try {
				const snap = await getDocs(
					query(
						collection(db, "EtiquetasDescuento"),
						orderBy("creadoEn", "desc"),
					),
				);
				const data: EtiquetaDescuento[] = snap.docs.map((d) => ({
					id: d.id,
					...(d.data() as Omit<EtiquetaDescuento, "id">),
				}));
				setEtiquetas(data);
			} catch (error) {
				console.error("Error cargando etiquetas:", error);
			} finally {
				setIsLoading(false);
			}
		};
		fetchEtiquetas();
	}, []);

	const etiquetasActivas = etiquetas.filter((e) => e.activa);
	const etiquetasInactivas = etiquetas.filter((e) => !e.activa);

	return (
		<>
			<div className="min-h-screen bg-gray-50 p-6 space-y-6">
				{/* Header */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-3 mb-1">
							<div className="w-10 h-10 rounded-xl bg-[#252d62] flex items-center justify-center">
								<Tags className="w-5 h-5 text-white" />
							</div>
							<h1 className="text-3xl font-bold text-[#252d62]">
								Etiquetas de Descuento
							</h1>
						</div>
						<p className="text-sm text-gray-500 ml-13">
							Gestioná las etiquetas para aplicar descuentos a alumnos según su
							origen o convenio.
						</p>
					</div>

					<Button
						className="bg-[#252d62] hover:bg-[#1a2046] text-white font-bold flex items-center gap-2 self-start sm:self-auto"
						onClick={handleOpenCreate}
					>
						<Plus className="w-4 h-4" />
						Nueva Etiqueta
					</Button>
				</div>

				{/* Stats rápidas */}
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
					<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
						<div className="bg-[#252d62]/10 p-3 rounded-xl">
							<Layers className="w-5 h-5 text-[#252d62]" />
						</div>
						<div>
							<p className="text-2xl font-black text-gray-900">
								{etiquetas.length}
							</p>
							<p className="text-xs text-gray-500 font-medium">
								Total etiquetas
							</p>
						</div>
					</div>
					<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
						<div className="bg-emerald-100 p-3 rounded-xl">
							<CheckCircle2 className="w-5 h-5 text-emerald-600" />
						</div>
						<div>
							<p className="text-2xl font-black text-gray-900">
								{etiquetasActivas.length}
							</p>
							<p className="text-xs text-gray-500 font-medium">Activas</p>
						</div>
					</div>
					<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 col-span-2 sm:col-span-1">
						<div className="bg-gray-100 p-3 rounded-xl">
							<Users className="w-5 h-5 text-gray-500" />
						</div>
						<div>
							<p className="text-2xl font-black text-gray-900">
								{etiquetasInactivas.length}
							</p>
							<p className="text-xs text-gray-500 font-medium">Inactivas</p>
						</div>
					</div>
				</div>

				{/* Contenido */}
				{isLoading ? (
					<div className="flex flex-col items-center justify-center py-20 gap-3">
						<Loader2 className="w-8 h-8 animate-spin text-[#EE1120]" />
						<p className="text-sm text-gray-400 font-medium">
							Cargando etiquetas...
						</p>
					</div>
				) : etiquetas.length === 0 ? (
					<div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 flex flex-col items-center justify-center text-center gap-4">
						<div className="bg-gray-100 p-5 rounded-full">
							<Tags className="w-10 h-10 text-gray-300" />
						</div>
						<div>
							<h3 className="text-lg font-bold text-gray-700 mb-1">
								No hay etiquetas creadas
							</h3>
							<p className="text-sm text-gray-400 max-w-sm">
								Creá la primera etiqueta de descuento para poder asignarla a
								alumnos y aplicar beneficios de forma automática.
							</p>
						</div>
						<Button
							className="bg-[#252d62] hover:bg-[#1a2046] text-white font-bold flex items-center gap-2 mt-2"
							onClick={handleOpenCreate}
						>
							<Plus className="w-4 h-4" />
							Crear primera etiqueta
						</Button>
					</div>
				) : (
					<div className="space-y-6">
						{/* Etiquetas activas */}
						{etiquetasActivas.length > 0 && (
							<div>
								<h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
									<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
									Activas ({etiquetasActivas.length})
								</h2>
								<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
									{etiquetasActivas.map((e) => (
										<EtiquetaCard
											key={e.id}
											etiqueta={e}
											onEdit={handleOpenEdit}
										/>
									))}
								</div>
							</div>
						)}

						{/* Etiquetas inactivas */}
						{etiquetasInactivas.length > 0 && (
							<div>
								<h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
									<AlertCircle className="w-3.5 h-3.5 text-gray-400" />
									Inactivas ({etiquetasInactivas.length})
								</h2>
								<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
									{etiquetasInactivas.map((e) => (
										<EtiquetaCard
											key={e.id}
											etiqueta={e}
											onEdit={handleOpenEdit}
										/>
									))}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
			<EtiquetaModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onSuccess={handleSuccess}
				etiquetaToEdit={etiquetaToEdit}
			/>
		</>
	);
}
