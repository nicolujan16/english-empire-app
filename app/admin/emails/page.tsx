"use client";

import React, { useState, useEffect } from "react";
import {
	Mail,
	Loader2,
	RefreshCw,
	AlertCircle,
	Gauge,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface MailEnviado {
	destino: string;
	tipo: "inscripcion" | "cuota" | "bienvenida" | "bienvenida-con-link" | "ausencia";
	fechaHora: { seconds: number; nanoseconds: number } | Date | string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFechaHora(raw: MailEnviado["fechaHora"]): Date {
	if (raw instanceof Date) return raw;
	if (typeof raw === "string") return new Date(raw);
	// Firestore Timestamp plain object { seconds, nanoseconds }
	if (typeof raw === "object" && "seconds" in raw) {
		return new Date(raw.seconds * 1000);
	}
	return new Date();
}

function formatFechaHora(raw: MailEnviado["fechaHora"]): string {
	const d = parseFechaHora(raw);
	return d.toLocaleString("es-AR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function isWithin24h(raw: MailEnviado["fechaHora"]): boolean {
	const d = parseFechaHora(raw);
	return Date.now() - d.getTime() < 24 * 60 * 60 * 1000;
}

const TIPO_LABELS: Record<MailEnviado["tipo"], string> = {
	inscripcion: "Inscripción",
	cuota: "Cuota",
	bienvenida: "Bienvenida",
	"bienvenida-con-link": "Bienvenida (nuevo)",
	ausencia: "Ausencia",
};

const TIPO_COLORS: Record<MailEnviado["tipo"], string> = {
	inscripcion: "bg-blue-100 text-blue-800",
	cuota: "bg-green-100 text-green-800",
	bienvenida: "bg-purple-100 text-purple-800",
	"bienvenida-con-link": "bg-indigo-100 text-indigo-800",
	ausencia: "bg-amber-100 text-amber-800",
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EmailsPage() {
	const [mails, setMails] = useState<MailEnviado[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");

	// Estados para reenvío
	const [isResendModalOpen, setIsResendModalOpen] = useState(false);
	const [resendEmail, setResendEmail] = useState("");
	const [isResending, setIsResending] = useState(false);
	const [resendError, setResendError] = useState("");
	const [resendSuccess, setResendSuccess] = useState("");

	const fetchData = async () => {
		setIsLoading(true);
		setError("");
		try {
			const docRef = doc(db, "Mails", "MailsEnviados");
			const snap = await getDoc(docRef);
			if (snap.exists()) {
				const data = snap.data();
				const enviados: MailEnviado[] = data.enviados ?? [];
				// Ordenar del más reciente al más antiguo
				const ordenados = [...enviados].sort((a, b) => {
					return parseFechaHora(b.fechaHora).getTime() - parseFechaHora(a.fechaHora).getTime();
				});
				setMails(ordenados);
			} else {
				setMails([]);
			}
		} catch (err) {
			console.error("Error cargando mails:", err);
			setError("No se pudieron cargar los datos. Revisá tu conexión.");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchData();
	}, []);

	// Mails enviados en las últimas 24hs
	const enviados24h = mails.filter((m) => isWithin24h(m.fechaHora)).length;
	const limite = 80;
	const porcentajeUsado = Math.min((enviados24h / limite) * 100, 100);
	const colorBarra =
		porcentajeUsado >= 90
			? "bg-red-500"
			: porcentajeUsado >= 70
				? "bg-amber-500"
				: "bg-green-500";

	const handleResendBienvenida = async () => {
		if (!resendEmail) return;
		setIsResending(true);
		setResendError("");
		setResendSuccess("");

		try {
			const res = await fetch("/api/correos/reenviar-bienvenida", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ emailDestino: resendEmail.trim() }),
			});
			const data = await res.json();
			if (res.ok) {
				setResendSuccess(`Correo reenviado exitosamente a ${resendEmail}`);
				setResendEmail("");
				fetchData(); // Refrescar la tabla
				setTimeout(() => {
					setIsResendModalOpen(false);
					setResendSuccess("");
				}, 2000);
			} else {
				setResendError(data.error || "Ocurrió un error al reenviar el correo.");
			}
		} catch (error) {
			console.error("Error reenviando", error);
			setResendError("Error de red al intentar reenviar el correo.");
		} finally {
			setIsResending(false);
		}
	};

	return (
		<div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
			{/* ── HEADER ────────────────────────────────────────────────────── */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
				{/* Izquierda: título */}
				<div className="flex items-center gap-3">
					<div className="p-3 bg-indigo-100 rounded-xl">
						<Mail className="w-6 h-6 text-indigo-700" />
					</div>
					<div>
						<h1 className="text-2xl font-bold text-[#252d62]">
							Correos Enviados
						</h1>
						<p className="text-gray-500 text-sm mt-1">
							Historial de emails enviados.
						</p>
					</div>
				</div>

				{/* Derecha: cuota diaria + refresh */}
				<div className="flex items-center gap-3">
					{/* Contador de cuota */}
					<div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm min-w-[220px]">
						<Gauge
							className={`w-5 h-5 shrink-0 ${
								porcentajeUsado >= 90
									? "text-red-500"
									: porcentajeUsado >= 70
										? "text-amber-500"
										: "text-green-600"
							}`}
						/>
						<div className="flex-1">
							<div className="flex items-baseline justify-between mb-1">
								<span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
									Límite diario
								</span>
								<span
									className={`text-sm font-black ${
										porcentajeUsado >= 90
											? "text-red-600"
											: porcentajeUsado >= 70
												? "text-amber-600"
												: "text-[#252d62]"
									}`}
								>
									{enviados24h}
									<span className="text-gray-400 font-medium">/{limite}</span>
								</span>
							</div>
							<div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
								<div
									className={`h-full rounded-full transition-all duration-500 ${colorBarra}`}
									style={{ width: `${porcentajeUsado}%` }}
								/>
							</div>
								<p className="text-[10px] text-gray-400 mt-1 text-right">
									En las ultimas 24hs
								</p>
						</div>
					</div>

					<Button
						onClick={() => {
							setIsResendModalOpen(true);
							setResendError("");
							setResendSuccess("");
							setResendEmail("");
						}}
						variant="default"
						className="bg-[#252d62] text-white hover:bg-[#1a2046] font-semibold py-5 px-5 rounded-xl flex items-center gap-2 transition-all"
					>
						<Mail className="w-4 h-4" />
						Reenviar Bienvenida
					</Button>

					<Button
						onClick={fetchData}
						variant="outline"
						disabled={isLoading}
						className="border-gray-200 text-gray-600 hover:border-[#252d62] hover:text-[#252d62] font-semibold py-5 px-5 rounded-xl flex items-center gap-2 transition-all"
					>
						<RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
						Actualizar
					</Button>
				</div>
			</div>

			{/* ── TABLA ─────────────────────────────────────────────────────── */}
			<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
				{isLoading ? (
					<div className="flex flex-col items-center justify-center py-20 gap-3">
						<Loader2 className="w-8 h-8 animate-spin text-[#252d62]" />
						<p className="text-sm text-gray-500">Cargando historial...</p>
					</div>
				) : error ? (
					<div className="flex flex-col items-center justify-center py-20 gap-3 text-red-600">
						<AlertCircle className="w-8 h-8" />
						<p className="text-sm font-medium">{error}</p>
					</div>
				) : mails.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
						<Mail className="w-10 h-10" />
						<p className="text-sm font-medium">No se han enviado emails todavía.</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-gray-100 bg-gray-50/80">
									<th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
										#
									</th>
									<th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
										Destinatario
									</th>
									<th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
										Tipo
									</th>
									<th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
										Fecha y hora
									</th>
									<th className="text-center px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
										Últ. 24h
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{mails.map((mail, idx) => {
									const dentro24h = isWithin24h(mail.fechaHora);
									return (
										<tr
											key={idx}
											className={`hover:bg-gray-50/60 transition-colors ${
												dentro24h ? "bg-indigo-50/30" : ""
											}`}
										>
											<td className="px-5 py-3.5 text-gray-400 font-mono text-xs">
												{mails.length - idx}
											</td>
											<td className="px-5 py-3.5 font-medium text-gray-800 truncate max-w-[220px]">
												{mail.destino}
											</td>
											<td className="px-5 py-3.5">
												<span
													className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
														TIPO_COLORS[mail.tipo] ?? "bg-gray-100 text-gray-700"
													}`}
												>
													{TIPO_LABELS[mail.tipo] ?? mail.tipo}
												</span>
											</td>
											<td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
												{formatFechaHora(mail.fechaHora)}
											</td>
											<td className="px-5 py-3.5 text-center">
												{dentro24h ? (
													<span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" title="Enviado en las últimas 24 horas" />
												) : (
													<span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-200" />
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>

						{/* Footer de la tabla */}
						<div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
							<p className="text-xs text-gray-400">
								{mails.length} correo{mails.length !== 1 ? "s" : ""} en el historial
							</p>
							<p className="text-xs text-gray-400">
								<span className="font-semibold text-indigo-600">{enviados24h}</span> enviado{enviados24h !== 1 ? "s" : ""} en las últimas 24 hs
							</p>
						</div>
					</div>
				)}
			</div>

			{/* Modal de Reenviar Bienvenida */}
			<Dialog open={isResendModalOpen} onOpenChange={setIsResendModalOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Reenviar Correo de Bienvenida</DialogTitle>
						<DialogDescription>
							Ingresa el correo electrónico del usuario para reenviarle el email de bienvenida con el enlace para crear su contraseña.
						</DialogDescription>
					</DialogHeader>
					
					<div className="flex flex-col gap-4 py-4">
						<div className="flex flex-col gap-2">
							<label htmlFor="email" className="text-sm font-semibold text-gray-700">
								Correo Electrónico
							</label>
							<input
								id="email"
								type="email"
								placeholder="usuario@ejemplo.com"
								value={resendEmail}
								onChange={(e) => setResendEmail(e.target.value)}
								className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#252d62]/20 outline-none"
								disabled={isResending}
							/>
						</div>

						{resendError && (
							<div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								{resendError}
							</div>
						)}

						{resendSuccess && (
							<div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
								<Gauge className="w-4 h-4 shrink-0" /> {/* Reutilizando Gauge de lucide-react como check */}
								{resendSuccess}
							</div>
						)}
					</div>

					<DialogFooter className="sm:justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsResendModalOpen(false)}
							disabled={isResending}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={handleResendBienvenida}
							disabled={isResending || !resendEmail}
							className="bg-[#252d62] text-white hover:bg-[#1a2046]"
						>
							{isResending ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Enviando...
								</>
							) : (
								"Reenviar"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
