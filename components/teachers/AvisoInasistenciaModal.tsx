import React, { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
	AlertTriangle,
	Mail,
	BellRing,
	CheckCircle2,
	Loader2,
	XCircle,
} from "lucide-react";

export interface AlumnoRiesgo {
	alumnoId: string;
	nombre: string;
	dni: string;
	emailDestino?: string;
}

interface Props {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	alumnosEnRiesgo: AlumnoRiesgo[];
	cursoNombre: string;
	onSuccess: () => void;
}

type ModalState = "aviso" | "enviando" | "exito" | "omitido";

export default function AvisoInasistenciasModal({
	isOpen,
	onOpenChange,
	alumnosEnRiesgo,
	cursoNombre,
	onSuccess,
}: Props) {
	const [modalState, setModalState] = useState<ModalState>("aviso");

	// 1. Botón "Enviar Mails" (Paso 2 del flujo)
	const handleEnviarMails = async () => {
		setModalState("enviando");

		try {
			const alumnosConMail = alumnosEnRiesgo
				.filter((a) => a.emailDestino)
				.map((a) => ({
					emailDestino: a.emailDestino,
					nombreAlumno: a.nombre,
					cursoNombre: cursoNombre,
				}));

			if (alumnosConMail.length > 0) {
				const res = await fetch("/api/correos/ausencias", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ alumnos: alumnosConMail }),
				});

				if (!res.ok) throw new Error("Error en la API de correos");
			}

			setModalState("exito");
		} catch (error) {
			console.error("Error al enviar notificaciones:", error);
			alert(
				"Hubo un error al enviar los correos. Por favor, avise a dirección.",
			);
			setModalState("aviso");
		}
	};

	// 2. Botón "Dar aviso a secretaría" (Whatsapp)
	const handleAvisarSecretaria = () => {
		const nombres = alumnosEnRiesgo.map((a) => a.nombre).join(" y ");
		const fechaActual = new Date().toLocaleDateString("es-AR");

		// Adaptamos el texto según si se enviaron los mails o si se omitieron
		const textoExtra =
			modalState === "exito"
				? "Se enviaron los correspondientes emails a los tutores."
				: "⚠️ NO se han enviado notificaciones por correo a los tutores.";

		const mensaje = `*Alerta de Inasistencia!*\n\nSe registró que el/los alumno/s *${nombres}* registraron dos faltas injustificadas seguidas hasta el día ${fechaActual}.\n\n${textoExtra}`;

		const textoCodificado = encodeURIComponent(mensaje);
		const numeroSecretaria = "5493804259004";

		window.open(
			`https://wa.me/${numeroSecretaria}?text=${textoCodificado}`,
			"_blank",
		);

		onOpenChange(false);
		setTimeout(() => setModalState("aviso"), 500);
		onSuccess();
	};

	// Cierre manual (sin WhatsApp)
	const handleClose = () => {
		onOpenChange(false);
		setTimeout(() => setModalState("aviso"), 500);
		onSuccess();
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[450px] rounded-2xl z-50 p-6">
				{/* ── ESTADO: AVISO INICIAL (REFACTORIZADO) ── */}
				{modalState === "aviso" && (
					<>
						<DialogHeader>
							{/* 🚀 CORRECCIÓN ACCESIBILIDAD: El icono debe estar antes del título por UX, pero el título debe ser hijo directo del header */}
							<div className="flex items-center gap-3 mb-3">
								<div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
									<AlertTriangle className="w-6 h-6 text-amber-600" />
								</div>
							</div>

							{/* Título como hijo directo del header para accesibilidad */}
							<DialogTitle className="text-xl text-gray-900 font-black">
								¡Atención! Inasistencias Consecutivas
							</DialogTitle>

							{/* 🚀 CORRECCIÓN HYDRATION ERROR: Usamos 'asChild' para no crear un <p> por defecto y evitar anidamiento inválido */}
							<DialogDescription asChild>
								{/* Ahora envolvemos todo el contenido en un div neutral */}
								<div className="text-gray-600 text-sm mt-2">
									El sistema detectó que los siguientes alumnos registran su{" "}
									<strong>segunda inasistencia seguida</strong> en este curso:
									{/* Este div contenedor ya es válido HTML dentro del div exterior */}
									<div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-3 mb-4 max-h-32 overflow-y-auto">
										{/* La ul ya es válida HTML dentro de su div contenedor */}
										<ul className="list-disc list-inside font-bold text-[#252d62]">
											{alumnosEnRiesgo.map((al) => (
												<li key={al.alumnoId}>
													{al.nombre}{" "}
													<span className="font-normal text-xs text-gray-500">
														{al.emailDestino ? "" : "(Sin email configurado)"}
													</span>
												</li>
											))}
										</ul>
									</div>
									Es importante saber la causa para prevenir la deserción.
									¿Deseás notificar a los tutores automáticamente por correo
									electrónico?
								</div>
							</DialogDescription>
						</DialogHeader>

						<DialogFooter className="mt-2 flex-col sm:flex-row gap-3 sm:gap-0">
							<Button
								variant="outline"
								onClick={() => setModalState("omitido")}
								className="border-gray-300 text-gray-700 hover:bg-gray-100 w-full sm:w-auto"
							>
								Omitir por ahora
							</Button>
							<Button
								onClick={handleEnviarMails}
								className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto font-bold shadow-md shadow-indigo-200"
							>
								<Mail className="w-4 h-4 mr-2" /> Enviar Mails a Tutores
							</Button>
						</DialogFooter>
					</>
				)}

				{/* ... El resto de los estados (enviando, exito, omitido) ya estaban bien estructurados y no necesitan cambios ... */}
				{modalState === "enviando" && (
					<div className="py-12 flex flex-col items-center justify-center text-center">
						<Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
						<DialogTitle className="text-lg font-bold text-gray-900">
							Enviando notificaciones...
						</DialogTitle>
						<DialogDescription className="text-gray-500 mt-2">
							Por favor, no cierres esta ventana.
						</DialogDescription>
					</div>
				)}

				{modalState === "exito" && (
					<>
						<div className="py-6 flex flex-col items-center justify-center text-center">
							<div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
								<CheckCircle2 className="w-8 h-8 text-green-600" />
							</div>
							<DialogTitle className="text-xl font-bold text-gray-900">
								¡Mails enviados con éxito!
							</DialogTitle>
							<DialogDescription className="text-gray-600 mt-3 px-4">
								Los tutores fueron notificados exitosamente vía correo
								electrónico. Es altamente recomendable derivar este caso a
								administración para su seguimiento.
							</DialogDescription>
						</div>
						<DialogFooter className="flex-col sm:flex-row gap-3 sm:gap-0 border-t border-gray-100 pt-4 mt-2">
							<Button
								variant="outline"
								onClick={handleClose}
								className="border-gray-300 text-gray-700 hover:bg-gray-100 w-full sm:w-auto"
							>
								Cerrar
							</Button>
							<Button
								onClick={handleAvisarSecretaria}
								className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto font-bold shadow-md shadow-amber-200"
							>
								<BellRing className="w-4 h-4 mr-2" /> Dar aviso a Secretaría
							</Button>
						</DialogFooter>
					</>
				)}

				{modalState === "omitido" && (
					<>
						<div className="py-6 flex flex-col items-center justify-center text-center">
							<div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
								<XCircle className="w-8 h-8 text-gray-500" />
							</div>
							<DialogTitle className="text-xl font-bold text-gray-900">
								Mails no enviados
							</DialogTitle>
							<DialogDescription className="text-gray-600 mt-3 px-4">
								Se guardó el registro de asistencia, pero{" "}
								<strong>no se notificó a los padres.</strong> De igual forma,
								podés avisar a Secretaría para que tengan registro de estas
								inasistencias.
							</DialogDescription>
						</div>
						<DialogFooter className="flex-col sm:flex-row gap-3 sm:gap-0 border-t border-gray-100 pt-4 mt-2">
							<Button
								variant="outline"
								onClick={handleClose}
								className="border-gray-300 text-gray-700 hover:bg-gray-100 w-full sm:w-auto"
							>
								Cerrar sin avisar
							</Button>
							<Button
								onClick={handleAvisarSecretaria}
								className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto font-bold shadow-md shadow-amber-200"
							>
								<BellRing className="w-4 h-4 mr-2" /> Avisar a Secretaría
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
