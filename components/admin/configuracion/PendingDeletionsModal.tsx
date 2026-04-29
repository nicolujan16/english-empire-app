"use client";

import React, { useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Loader2,
	CheckCircle2,
	AlertCircle,
	Trash2,
	AlertTriangle,
	Check,
	X,
	FileText,
	DollarSign,
	Clock,
} from "lucide-react";
import {
	collection,
	getDocs,
	doc,
	deleteDoc,
	updateDoc,
	arrayRemove,
	query,
	orderBy,
	onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

interface PendingDeletion {
	id: string; // ID del doc en eliminacionesPendientes
	tipo: "cuota" | "inscripcion";
	idReferencia: string;
	alumnoNombre: string;
	alumnoId: string;
	alumnoTipo?: "adulto" | "menor";
	cursoNombre: string;
	cursoId?: string;
	mes?: number;
	anio?: number;
	emailSolicitante: string;
	fechaSolicitud: any;
}

interface PendingDeletionsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function PendingDeletionsModal({
	isOpen,
	onClose,
}: PendingDeletionsModalProps) {
	const [pendings, setPendings] = useState<PendingDeletion[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [confirmAction, setConfirmAction] = useState<{
		action: "accept" | "reject";
		item: PendingDeletion;
	} | null>(null);

	const [isProcessing, setIsProcessing] = useState(false);
	const [message, setMessage] = useState({ type: "", text: "" });

	useEffect(() => {
		if (!isOpen) return;
		setIsLoading(true);

		const q = query(
			collection(db, "eliminacionesPendientes"),
			orderBy("fechaSolicitud", "desc"),
		);

		const unsubscribe = onSnapshot(
			q,
			(snap) => {
				const data: PendingDeletion[] = snap.docs.map(
					(d) => ({ id: d.id, ...d.data() }) as PendingDeletion,
				);
				setPendings(data);
				setIsLoading(false);
			},
			(error) => {
				console.error("Error al obtener eliminaciones pendientes:", error);
				setIsLoading(false);
			},
		);

		return () => unsubscribe();
	}, [isOpen]);

	const handleAction = async () => {
		if (!confirmAction) return;
		setIsProcessing(true);
		setMessage({ type: "", text: "" });

		const { action, item } = confirmAction;

		try {
			if (action === "reject") {
				// Solo borrar el documento de eliminacionesPendientes
				await deleteDoc(doc(db, "eliminacionesPendientes", item.id));
				setMessage({
					type: "success",
					text: "La solicitud fue rechazada y descartada.",
				});
			} else if (action === "accept") {
				if (item.tipo === "cuota") {
					// Borrar la cuota original
					await deleteDoc(doc(db, "Cuotas", item.idReferencia));
				} else if (item.tipo === "inscripcion") {
					// Borrar la inscripción original
					await deleteDoc(doc(db, "Inscripciones", item.idReferencia));
					
					// Quitar del array cursos si tenemos el tipo
					if (item.alumnoId && item.cursoId && item.alumnoTipo) {
						const colName = item.alumnoTipo === "adulto" ? "Users" : "Hijos";
						await updateDoc(doc(db, colName, item.alumnoId), {
							cursos: arrayRemove(item.cursoId),
						});
					}
				}
				// Borrar el documento de eliminacionesPendientes
				await deleteDoc(doc(db, "eliminacionesPendientes", item.id));
				setMessage({
					type: "success",
					text: "La solicitud fue aceptada y el registro eliminado.",
				});
			}
		} catch (error) {
			console.error("Error procesando solicitud:", error);
			setMessage({
				type: "error",
				text: "Ocurrió un error al procesar la solicitud.",
			});
		} finally {
			setIsProcessing(false);
			setConfirmAction(null);
		}
	};

	return (
		<>
			<Dialog open={isOpen} onOpenChange={onClose}>
				<DialogContent className="sm:max-w-[650px] p-0 overflow-hidden">
					{/* Header */}
					<DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
						<div className="flex items-center gap-3">
							<div className="bg-amber-100 p-2 rounded-lg">
								<Trash2 className="w-5 h-5 text-amber-600" />
							</div>
							<div>
								<DialogTitle className="text-lg font-bold text-gray-900">
									Aprobaciones Pendientes
								</DialogTitle>
								<p className="text-xs text-gray-500 mt-0.5">
									Revisá y decidí sobre las solicitudes de eliminación.
								</p>
							</div>
						</div>
					</DialogHeader>

					{/* Message */}
					{message.text && (
						<div
							className={`mx-6 mt-4 flex items-center gap-2.5 rounded-lg px-4 py-3 border text-sm font-medium ${
								message.type === "success"
									? "bg-green-50 border-green-200 text-green-800"
									: "bg-red-50 border-red-200 text-red-700"
							}`}
						>
							{message.type === "success" ? (
								<CheckCircle2 className="w-4 h-4 flex-shrink-0" />
							) : (
								<AlertCircle className="w-4 h-4 flex-shrink-0" />
							)}
							<p>{message.text}</p>
						</div>
					)}

					{/* Lista */}
					<div className="overflow-y-auto max-h-[60vh] px-6 py-4 space-y-3 bg-gray-50/50">
						{isLoading ? (
							<div className="flex justify-center py-10">
								<Loader2 className="w-8 h-8 animate-spin text-gray-400" />
							</div>
						) : pendings.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-10 text-center">
								<CheckCircle2 className="w-12 h-12 text-emerald-200 mb-3" />
								<p className="text-sm font-bold text-gray-900">
									Todo al día
								</p>
								<p className="text-xs text-gray-500">
									No hay solicitudes pendientes de aprobación.
								</p>
							</div>
						) : (
							pendings.map((item) => {
								const esCuota = item.tipo === "cuota";
								return (
									<div
										key={item.id}
										className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
									>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<span
													className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${
														esCuota
															? "bg-indigo-50 text-indigo-700 border border-indigo-100"
															: "bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100"
													}`}
												>
													{esCuota ? (
														<DollarSign className="w-3 h-3" />
													) : (
														<FileText className="w-3 h-3" />
													)}
													{esCuota ? "Cuota" : "Inscripción"}
												</span>
												<span className="text-xs text-gray-400 flex items-center gap-1">
													<Clock className="w-3 h-3" />
													{item.fechaSolicitud?.toDate().toLocaleDateString("es-AR")}
												</span>
											</div>
											<h4 className="text-sm font-bold text-gray-900 truncate">
												{item.alumnoNombre}
											</h4>
											<p className="text-xs text-gray-600 mt-0.5">
												Curso: <span className="font-medium">{item.cursoNombre}</span>
												{esCuota && ` - Mes: ${item.mes}`}
											</p>
											<p className="text-[11px] text-gray-400 mt-1.5 italic">
												Solicitado por: {item.emailSolicitante}
											</p>
										</div>

										<div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
											<button
												onClick={() =>
													setConfirmAction({ action: "reject", item })
												}
												className="flex-1 sm:flex-none flex items-center justify-center p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 transition-colors"
												title="Declinar (No borrar)"
											>
												<X className="w-5 h-5" />
											</button>
											<button
												onClick={() =>
													setConfirmAction({ action: "accept", item })
												}
												className="flex-1 sm:flex-none flex items-center justify-center p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 transition-colors"
												title="Aceptar (Borrar registro)"
											>
												<Check className="w-5 h-5" />
											</button>
										</div>
									</div>
								);
							})
						)}
					</div>

					{/* Footer */}
					<div className="px-6 pb-6 pt-4 border-t border-gray-100 bg-white flex justify-end">
						<button
							onClick={onClose}
							className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
						>
							Cerrar panel
						</button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Modal de Confirmación */}
			<Dialog
				open={!!confirmAction}
				onOpenChange={() => !isProcessing && setConfirmAction(null)}
			>
				<DialogContent className="sm:max-w-[400px] rounded-xl p-6">
					<DialogHeader>
						<div className="flex items-center gap-3 mb-2">
							<div
								className={`w-10 h-10 rounded-full flex items-center justify-center ${
									confirmAction?.action === "accept"
										? "bg-emerald-100"
										: "bg-red-100"
								}`}
							>
								{confirmAction?.action === "accept" ? (
									<AlertTriangle className="w-5 h-5 text-emerald-600" />
								) : (
									<AlertCircle className="w-5 h-5 text-red-600" />
								)}
							</div>
							<DialogTitle className="text-lg text-gray-900">
								{confirmAction?.action === "accept"
									? "Aprobar eliminación"
									: "Declinar solicitud"}
							</DialogTitle>
						</div>
						<p className="text-sm text-gray-600 leading-relaxed">
							{confirmAction?.action === "accept" ? (
								<>
									¿Confirmás que querés <strong>eliminar definitivamente</strong>{" "}
									{confirmAction.item.tipo === "cuota" ? "la cuota" : "la inscripción"}{" "}
									de <strong>{confirmAction.item.alumnoNombre}</strong>? Esta acción no se
									puede deshacer.
								</>
							) : (
								<>
									¿Confirmás que querés <strong>rechazar</strong> la eliminación de{" "}
									{confirmAction?.item.tipo === "cuota" ? "la cuota" : "la inscripción"}{" "}
									de <strong>{confirmAction?.item.alumnoNombre}</strong>? La solicitud será
									descartada y el registro seguirá intacto.
								</>
							)}
						</p>
					</DialogHeader>
					<div className="flex gap-3 justify-end mt-6">
						<button
							onClick={() => setConfirmAction(null)}
							disabled={isProcessing}
							className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50"
						>
							Cancelar
						</button>
						<button
							onClick={handleAction}
							disabled={isProcessing}
							className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all shadow-sm disabled:opacity-50 ${
								confirmAction?.action === "accept"
									? "bg-emerald-600 hover:bg-emerald-700"
									: "bg-red-600 hover:bg-red-700"
							}`}
						>
							{isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
							{confirmAction?.action === "accept"
								? "Sí, aprobar y borrar"
								: "Sí, declinar"}
						</button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
