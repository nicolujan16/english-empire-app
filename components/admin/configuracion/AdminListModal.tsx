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
	ShieldCheck,
	ShieldOff,
	UserCog,
	CheckCircle2,
	AlertCircle,
} from "lucide-react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAdminAuth } from "@/context/AdminAuthContext";

interface AdminUser {
	uid: string;
	email: string;
	nombre: string;
	rol: "admin" | "secretario";
	activo?: boolean;
	esDirector?: boolean;
}

interface AdminListModalProps {
	isOpen: boolean;
	onClose: () => void;
}

function RolBadge({ rol }: { rol: string }) {
	return (
		<span
			className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
				rol === "admin"
					? "bg-purple-100 text-purple-800"
					: "bg-blue-100 text-blue-700"
			}`}
		>
			{rol === "admin" ? "Admin" : "Secretario/a"}
		</span>
	);
}

export default function AdminListModal({
	isOpen,
	onClose,
}: AdminListModalProps) {
	const { adminData } = useAdminAuth();

	const [admins, setAdmins] = useState<AdminUser[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadingUid, setLoadingUid] = useState<string | null>(null);
	const [message, setMessage] = useState({ type: "", text: "" });

	const fetchAdmins = async () => {
		setIsLoading(true);
		try {
			const snap = await getDocs(collection(db, "Admins"));
			const lista: AdminUser[] = snap.docs.map(
				(d) =>
					({
						uid: d.id,
						...d.data(),
					}) as AdminUser,
			);
			// Director siempre primero, luego por nombre
			lista.sort((a, b) => {
				if (a.esDirector) return -1;
				if (b.esDirector) return 1;
				return a.nombre.localeCompare(b.nombre);
			});
			setAdmins(lista);
		} catch (error) {
			console.error("Error al cargar admins:", error);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (isOpen) fetchAdmins();
	}, [isOpen]);

	const handleToggleActivo = async (admin: AdminUser) => {
		setLoadingUid(admin.uid);
		setMessage({ type: "", text: "" });
		try {
			const nuevoEstado = admin.activo === false ? true : false;
			await updateDoc(doc(db, "Admins", admin.uid), { activo: nuevoEstado });
			setAdmins((prev) =>
				prev.map((a) =>
					a.uid === admin.uid ? { ...a, activo: nuevoEstado } : a,
				),
			);
			setMessage({
				type: "success",
				text: `${admin.nombre} fue ${nuevoEstado ? "habilitado" : "inhabilitado"} correctamente.`,
			});
		} catch {
			setMessage({ type: "error", text: "Error al actualizar el estado." });
		} finally {
			setLoadingUid(null);
		}
	};

	return (
		<>
			<Dialog open={isOpen} onOpenChange={onClose}>
				<DialogContent className="sm:max-w-[580px] p-0 overflow-hidden">
					{/* Header */}
					<DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
						<div className="flex items-center gap-3">
							<div className="bg-[#252d62] p-2 rounded-lg">
								<UserCog className="w-4 h-4 text-white" />
							</div>
							<div>
								<DialogTitle className="text-lg font-bold text-[#252d62]">
									Gestión de accesos
								</DialogTitle>
								<p className="text-xs text-gray-500 mt-0.5">
									Habilitá, inhabilitá o eliminá cuentas del panel
								</p>
							</div>
						</div>
					</DialogHeader>

					{/* Mensaje */}
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
					<div className="overflow-y-auto max-h-[60vh] px-6 py-4 space-y-3">
						{isLoading ? (
							<div className="flex justify-center py-10">
								<Loader2 className="w-8 h-8 animate-spin text-[#252d62]" />
							</div>
						) : admins.length === 0 ? (
							<p className="text-center text-gray-500 py-10">
								No hay cuentas registradas.
							</p>
						) : (
							admins.map((admin) => {
								const esMiCuenta = admin.uid === adminData?.uid;
								const isInactive = admin.activo === false;

								return (
									<div
										key={admin.uid}
										className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
											isInactive
												? "bg-gray-50 border-gray-200 opacity-60"
												: "bg-white border-gray-100 shadow-sm"
										}`}
									>
										{/* Info */}
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 flex-wrap">
												<p className="font-semibold text-gray-900 text-sm">
													{admin.nombre}
												</p>
												{admin.esDirector && (
													<span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 uppercase tracking-wider">
														Director
													</span>
												)}
												{esMiCuenta && (
													<span className="text-xs text-gray-400 italic">
														(vos)
													</span>
												)}
												{isInactive && (
													<span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
														Inhabilitado
													</span>
												)}
											</div>
											<p className="text-xs text-gray-500 mt-0.5 truncate">
												{admin.email}
											</p>
											<div className="mt-1">
												<RolBadge rol={admin.rol} />
											</div>
										</div>

										{/* Acciones — no se pueden tocar el director ni la propia cuenta */}
										{!admin.esDirector && !esMiCuenta && (
											<div className="flex items-center gap-2 flex-shrink-0">
												<button
													onClick={() => handleToggleActivo(admin)}
													disabled={loadingUid === admin.uid}
													title={isInactive ? "Habilitar" : "Inhabilitar"}
													className={`p-2 rounded-lg transition-all ${
														isInactive
															? "bg-green-50 text-green-600 hover:bg-green-100"
															: "bg-yellow-50 text-yellow-600 hover:bg-yellow-100"
													} disabled:opacity-50`}
												>
													{loadingUid === admin.uid ? (
														<Loader2 className="w-4 h-4 animate-spin" />
													) : isInactive ? (
														<ShieldCheck className="w-4 h-4" />
													) : (
														<ShieldOff className="w-4 h-4" />
													)}
												</button>
											</div>
										)}
									</div>
								);
							})
						)}
					</div>

					{/* Footer */}
					<div className="px-6 pb-6 pt-4 border-t border-gray-100 flex justify-end">
						<button
							onClick={onClose}
							className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
						>
							Cerrar
						</button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Modal de confirmación de eliminación
			<Dialog
				open={!!confirmDelete}
				onOpenChange={() => setConfirmDelete(null)}
			>
				<DialogContent className="sm:max-w-[420px] rounded-xl">
					<DialogHeader>
						<div className="flex items-center gap-3 mb-2">
							<div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
								<AlertTriangle className="w-5 h-5 text-red-600" />
							</div>
							<DialogTitle className="text-lg text-gray-900">
								Eliminar cuenta
							</DialogTitle>
						</div>
						<p className="text-sm text-gray-600">
							¿Estás seguro de que querés eliminar la cuenta de{" "}
							<strong>{confirmDelete?.nombre}</strong>? Esta acción es
							irreversible y el usuario perderá todo acceso al panel.
						</p>
					</DialogHeader>
					<div className="flex gap-3 justify-end mt-4">
						<button
							onClick={() => setConfirmDelete(null)}
							className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
						>
							Cancelar
						</button>
						<button
							onClick={() => confirmDelete && handleDelete(confirmDelete)}
							className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
						>
							<Trash2 className="w-4 h-4" />
							Sí, eliminar
						</button>
					</div>
				</DialogContent>
			</Dialog> */}
		</>
	);
}
