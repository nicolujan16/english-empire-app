"use client";

import React, { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Loader2,
	TrendingDown,
	GripVertical,
	Plus,
	Trash2,
	Save,
	Pencil,
	AlertCircle,
	CheckCircle2,
} from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { Reorder, AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface GestionarEgresosModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

export default function GestionarEgresosModal({
	isOpen,
	onClose,
	onSuccess,
}: GestionarEgresosModalProps) {
	const [categorias, setCategorias] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [nuevaCategoria, setNuevaCategoria] = useState("");

	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const [editValue, setEditValue] = useState("");

	const [error, setError] = useState<string | null>(null);
	const [exito, setExito] = useState(false);

	const fetchCategorias = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const docRef = doc(db, "Configuraciones", "CategoriasEgreso");
			const docSnap = await getDoc(docRef);
			if (docSnap.exists() && docSnap.data().nombres) {
				setCategorias(docSnap.data().nombres);
			} else {
				setCategorias([
					"Compra de materiales",
					"Pago de servicios",
					"Compra de uniformes",
					"Mantenimiento",
				]);
			}
		} catch (err) {
			console.error("Error al cargar categorías:", err);
			setError("No se pudieron cargar las categorías.");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (isOpen) {
			fetchCategorias();
			setExito(false);
			setNuevaCategoria("");
			setEditingIndex(null);
		}
	}, [isOpen]);

	const handleAdd = () => {
		const val = nuevaCategoria.trim();
		if (!val) return;
		if (categorias.includes(val)) {
			setError("La categoría ya existe.");
			return;
		}
		setCategorias([...categorias, val]);
		setNuevaCategoria("");
		setError(null);
	};

	const handleDelete = (index: number) => {
		const newCat = [...categorias];
		newCat.splice(index, 1);
		setCategorias(newCat);
	};

	const startEdit = (index: number, val: string) => {
		setEditingIndex(index);
		setEditValue(val);
	};

	const saveEdit = () => {
		if (editingIndex === null) return;
		const val = editValue.trim();
		if (!val) {
			handleDelete(editingIndex);
			setEditingIndex(null);
			return;
		}
		if (categorias.includes(val) && categorias.indexOf(val) !== editingIndex) {
			setError("El nombre de categoría ya existe.");
			return;
		}
		const newCat = [...categorias];
		newCat[editingIndex] = val;
		setCategorias(newCat);
		setEditingIndex(null);
		setError(null);
	};

	const handleSaveToDB = async () => {
		setIsSaving(true);
		setError(null);
		try {
			await setDoc(doc(db, "Configuraciones", "CategoriasEgreso"), {
				nombres: categorias,
			});
			setExito(true);
			setTimeout(() => {
				onSuccess();
				onClose();
			}, 1500);
		} catch (err) {
			console.error("Error al guardar categorías:", err);
			setError("Hubo un error al guardar los cambios.");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && !isSaving && onClose()}>
			<DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
				<DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 bg-gray-50/50">
					<div className="flex items-center gap-3">
						<div className="bg-[#EE1120] p-2 rounded-lg">
							<TrendingDown className="w-4 h-4 text-white" />
						</div>
						<div>
							<DialogTitle className="text-lg font-bold text-[#252d62]">
								Categorías de Egresos
							</DialogTitle>
							<p className="text-xs text-gray-500 mt-0.5">
								Administrá, ordená y agregá categorías para los egresos
							</p>
						</div>
					</div>
				</DialogHeader>

				<div className="px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
					{exito && (
						<div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-lg px-4 py-3 shrink-0">
							<CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
							<p className="text-sm font-semibold text-green-800">
								¡Categorías guardadas correctamente!
							</p>
						</div>
					)}

					{error && (
						<div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3 shrink-0">
							<AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
							<p className="text-sm font-semibold text-red-800">{error}</p>
						</div>
					)}

					<div className="flex gap-2">
						<input
							type="text"
							value={nuevaCategoria}
							onChange={(e) => setNuevaCategoria(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleAdd()}
							placeholder="Nueva categoría..."
							className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EE1120]/20 focus:border-[#EE1120] transition-all bg-white"
						/>
						<Button
							type="button"
							onClick={handleAdd}
							disabled={!nuevaCategoria.trim()}
							className="bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-none border border-gray-200 font-semibold transition-all"
						>
							<Plus className="w-4 h-4 mr-1" /> Agregar
						</Button>
					</div>

					{isLoading ? (
						<div className="flex justify-center items-center py-10">
							<Loader2 className="w-8 h-8 animate-spin text-[#EE1120]" />
						</div>
					) : (
						<div className="bg-gray-50 rounded-xl border border-gray-200 p-2 overflow-hidden flex-1 min-h-[200px]">
							{categorias.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-10 text-center px-4">
									<TrendingDown className="w-8 h-8 text-gray-300 mb-2" />
									<p className="text-sm text-gray-500 font-medium">No hay categorías configuradas</p>
									<p className="text-xs text-gray-400 mt-1">Agregá una usando el campo superior</p>
								</div>
							) : (
								<Reorder.Group
									axis="y"
									values={categorias}
									onReorder={setCategorias}
									className="space-y-2"
								>
									<AnimatePresence initial={false}>
										{categorias.map((item, index) => (
											<Reorder.Item
												key={item}
												value={item}
												className="bg-white border border-gray-200 rounded-lg shadow-sm flex items-center justify-between p-2 group cursor-grab active:cursor-grabbing relative"
												initial={{ opacity: 0, y: -10 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, scale: 0.9 }}
												transition={{ duration: 0.2 }}
											>
												<div className="flex items-center gap-3 w-full pr-16">
													<div className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing p-1">
														<GripVertical className="w-4 h-4" />
													</div>
													{editingIndex === index ? (
														<input
															type="text"
															value={editValue}
															onChange={(e) => setEditValue(e.target.value)}
															onBlur={saveEdit}
															onKeyDown={(e) => e.key === "Enter" && saveEdit()}
															autoFocus
															className="flex-1 text-sm font-semibold text-gray-900 border-b border-[#EE1120] bg-transparent outline-none focus:ring-0 px-0 py-0"
														/>
													) : (
														<span className="text-sm font-semibold text-gray-700 truncate select-none">
															{item}
														</span>
													)}
												</div>

												{editingIndex !== index && (
													<div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-white pl-2">
														<button
															onClick={() => startEdit(index, item)}
															className="p-1.5 text-gray-400 hover:text-[#EE1120] hover:bg-red-50 rounded-md transition-colors"
															title="Editar"
														>
															<Pencil className="w-3.5 h-3.5" />
														</button>
														<button
															onClick={() => handleDelete(index)}
															className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors ml-1"
															title="Eliminar"
														>
															<Trash2 className="w-3.5 h-3.5" />
														</button>
													</div>
												)}
											</Reorder.Item>
										))}
									</AnimatePresence>
								</Reorder.Group>
							)}
						</div>
					)}
					<p className="text-[10px] text-gray-400 text-center">
						Arrastrá las opciones con el ícono de la izquierda para cambiar el orden en que aparecerán al registrar un egreso.
					</p>
				</div>

				<div className="px-6 py-4 flex gap-3 justify-end border-t border-gray-100 bg-gray-50/50">
					<button
						onClick={onClose}
						disabled={isLoading || isSaving}
						className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 bg-white"
					>
						Cancelar
					</button>
					<button
						onClick={handleSaveToDB}
						disabled={isLoading || isSaving}
						className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#EE1120] text-white rounded-lg hover:bg-[#c4000e] transition-all disabled:opacity-50 shadow-sm"
					>
						{isSaving ? (
							<>
								<Loader2 className="w-4 h-4 animate-spin" />
								Guardando...
							</>
						) : (
							<>
								<Save className="w-4 h-4" />
								Guardar cambios
							</>
						)}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
