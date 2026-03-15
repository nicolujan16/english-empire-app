"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

import weekIcon from "@/assets/cursoDetails/icon_semanas.png";
import lessonsIcon from "@/assets/cursoDetails/icon_frecuencia.png";
import bannerFallback from "@/assets/cursoDetails/banner_cursos.png";
import ConfirmInscription from "@/components/website/cursos/ConfirmInscription";
import { CursoObject } from "@/types";
import { useAuth } from "@/context/AuthContext";

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
// Importamos el ícono User para el nuevo modal
import { Loader2, User } from "lucide-react";

const NOMBRES_MESES = [
	"Enero",
	"Febrero",
	"Marzo",
	"Abril",
	"Mayo",
	"Junio",
	"Julio",
	"Agosto",
	"Septiembre",
	"Octubre",
	"Noviembre",
	"Diciembre",
];

const getNombreMes = (
	mes: string | number | undefined,
	fallback: string,
): string => {
	if (typeof mes === "number" && mes >= 1 && mes <= 12) {
		return NOMBRES_MESES[mes - 1];
	}
	return typeof mes === "string" ? mes : fallback;
};

const DurationInfo = ({
	duracion,
	clasesSemanales,
}: {
	duracion: string;
	clasesSemanales: number;
}) => (
	<div className="flex flex-col gap-4 text-lg text-[#252d62]">
		<div className="flex items-center gap-2">
			<Image
				src={weekIcon}
				alt="Duración"
				width={30}
				height={30}
				className="w-[30px] h-auto"
			/>
			<span>{duracion}</span>
		</div>
		<div className="flex items-center gap-2">
			<Image
				src={lessonsIcon}
				alt="Clases"
				width={30}
				height={30}
				className="w-[30px] h-auto"
			/>
			<span>
				{clasesSemanales}{" "}
				{clasesSemanales === 1 ? "clase semanal" : "clases semanales"}
			</span>
		</div>
	</div>
);

function CursoDetailsPage() {
	const params = useParams();
	const router = useRouter();
	const { userData } = useAuth();

	const [curso, setCurso] = useState<CursoObject | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// Estado para el modal de inscripción normal (usuario logueado)
	const [isModalOpen, setIsModalOpen] = useState(false);

	// NUEVO: Estado para el modal de advertencia de autenticación (usuario NO logueado)
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

	const urlCategoria = params.categoria as string;
	const urlId = params.id as string;

	useEffect(() => {
		const fetchCursoDetails = async () => {
			if (!urlId) return;

			try {
				const docRef = doc(db, "Cursos", urlId);
				const docSnap = await getDoc(docRef);

				if (docSnap.exists()) {
					const data = docSnap.data();

					let cantClases = 0;
					if (data.horarios) {
						if (Object.keys(data.horarios)[0] === "A definir") {
							cantClases = 2;
						} else {
							cantClases = Object.keys(data.horarios).length;
						}
					}

					let descripcionArray = ["Sin descripción disponible."];
					if (data.descripcion) {
						descripcionArray = (data.descripcion as string)
							.split("\n")
							.filter((parrafo) => parrafo.trim() !== "");
					}

					const cursoData: CursoObject = {
						id: docSnap.id,
						nombre: data.nombre || "Curso sin nombre",
						descripcion: descripcionArray,
						duracion: "Anual",
						clasesSemanales: cantClases > 0 ? cantClases : 2,
						inscripcion: data.inscripcion,
						cuota1a10: data.cuota1a10,
						cuota11enAdelante: data.cuota11enAdelante,
						inicio: getNombreMes(data.inicioMes || data.inicio, "Marzo"),
						fin: getNombreMes(data.finMes || data.fin, "Diciembre"),
						categoria: data.categoria || urlCategoria,
						horarios: data.horarios
							? Object.entries(data.horarios).map(([dia, hora]) => ({
									dia,
									hora: hora as string,
								}))
							: [{ dia: "A definir", hora: "" }],
						imgURL: bannerFallback.src,
					};

					setCurso(cursoData);
				} else {
					console.error("No se encontró el curso!");
				}
			} catch (error) {
				console.error("Error trayendo detalles del curso:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchCursoDetails();
	}, [urlId, urlCategoria]);

	const handleConfirmEnrollment = (studentDNI: string) => {
		if (curso) {
			router.push(`/checkout?curso=${curso.id}&alumnoDNI=${studentDNI}`);
		}
	};

	if (isLoading) {
		return (
			<div className="w-full min-h-[60vh] flex flex-col items-center justify-center bg-white">
				<Loader2 className="w-12 h-12 animate-spin text-[#EE1120]" />
				<p className="mt-4 text-gray-500 font-medium">
					Cargando información del curso...
				</p>
			</div>
		);
	}

	if (!curso) {
		return (
			<div className="w-full min-h-[60vh] flex flex-col items-center justify-center bg-white text-center px-4">
				<h2 className="text-3xl font-bold text-[#252d62] mb-2">
					Curso no encontrado
				</h2>
				<p className="text-gray-500 mb-6">
					El curso que estás buscando no existe o fue removido.
				</p>
				<button
					onClick={() => router.push("/cursos")}
					className="bg-[#EE1120] text-white px-6 py-2 rounded-full"
				>
					Volver a Cursos
				</button>
			</div>
		);
	}

	return (
		<>
			<section className="w-full flex flex-col items-center pb-12 bg-white relative">
				<div
					className="w-[90%] h-[248px] bg-cover bg-center rounded-b-[45px] flex flex-col lg:flex-row justify-center lg:justify-start items-center lg:pl-14 gap-4 shadow-sm relative overflow-hidden"
					style={{
						backgroundImage: `url(${curso.imgURL})`,
					}}
				>
					<div className="absolute inset-0 bg-black/40 z-0"></div>

					<h1 className="relative z-10 text-[#f1f1f1] text-4xl lg:text-[54px] font-bold drop-shadow-lg text-center lg:text-left px-4">
						{curso.nombre}
					</h1>

					<div className="relative z-10 lg:hidden  p-4 rounded-xl shadow-lg mt-2">
						<div className="flex flex-wrap text-lg gap-4 md:gap-20 text-white text-xl">
							<div className="flex items-center gap-2">
								<Image
									src={weekIcon}
									alt="Duración"
									width={30}
									height={30}
									className="w-[30px] h-auto"
								/>
								<span>{curso.duracion}</span>
							</div>
							<div className="flex items-center gap-2">
								<Image
									src={lessonsIcon}
									alt="Clases"
									width={30}
									height={30}
									className="w-[30px] h-auto"
								/>
								<span>
									{curso.clasesSemanales}{" "}
									{curso.clasesSemanales === 1
										? "clase semanal"
										: "clases semanales"}
								</span>
							</div>
						</div>
					</div>
				</div>

				<div className="w-[90%] max-w-7xl flex flex-col lg:flex-row justify-center items-start pt-12 gap-10 lg:gap-20">
					<div className="w-full lg:w-[65%] flex flex-col gap-6 text-[#252d62] text-xl lg:text-[24px] leading-relaxed text-justify lg:text-left">
						{curso.descripcion.map((parrafo, index) => (
							<p key={index}>{parrafo}</p>
						))}
					</div>

					<aside className="w-full lg:w-[35%] lg:sticky lg:top-36 flex flex-col items-center">
						<div className="bg-[#f1f1f1] w-full p-8 rounded-[20px] flex flex-col gap-6 items-center text-[#252d62] shadow-lg border border-gray-200">
							<h2 className="text-5xl font-bold">
								${curso.inscripcion.toLocaleString("es-AR")}
							</h2>

							<p className="text-gray-500 font-medium -mt-4 text-sm text-center">
								Valor de la inscripción
							</p>

							<button
								onClick={() => {
									if (userData) {
										setIsModalOpen(true);
									} else {
										// NUEVA LÓGICA: Si no hay usuario, abrimos el nuevo modal en vez de redirigir directo
										setIsAuthModalOpen(true);
									}
								}}
								className="bg-[#EE1120] hover:bg-[#DD1120] cursor-pointer text-white text-2xl lg:text-[32px] py-3 px-8 rounded-full w-full text-center transition-colors shadow-md mt-2"
							>
								Inscribirme
							</button>

							<div className="hidden lg:flex w-full border-t border-gray-300 pt-6 justify-center">
								<DurationInfo
									duracion={curso.duracion}
									clasesSemanales={curso.clasesSemanales}
								/>
							</div>

							<div className="w-full flex flex-col gap-4 border-t border-gray-300 pt-6 text-lg text-center">
								<div>
									<p className="text-[#EE1120] font-bold">Fecha de inicio</p>
									<p className="font-medium">{curso.inicio}</p>
								</div>
								<div>
									<p className="text-[#EE1120] font-bold">
										Fecha de finalización
									</p>
									<p className="font-medium">{curso.fin}</p>
								</div>
							</div>
						</div>
					</aside>
				</div>
			</section>

			{/* Modal Normal (Usuario Logueado) */}
			{isModalOpen && (
				<ConfirmInscription
					curso={curso}
					setIsModalOpen={setIsModalOpen}
					handleConfirmEnrollment={handleConfirmEnrollment}
				/>
			)}

			{/* NUEVO: Modal de Autenticación (Usuario No Logueado) */}
			{isAuthModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
					<div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
						<div className="p-8 text-center space-y-5">
							<div className="w-20 h-20 bg-blue-50 text-[#252d62] rounded-full flex items-center justify-center mx-auto shadow-inner">
								<User className="w-10 h-10" />
							</div>
							<div>
								<h3 className="text-2xl font-bold text-[#252d62] mb-2">
									¡Hola!
								</h3>
								<p className="text-gray-500 leading-relaxed">
									Para inscribirte en <strong>{curso.nombre}</strong> necesitas
									acceder a tu cuenta de English Empire.
								</p>
							</div>
						</div>

						<div className="p-6 bg-gray-50 flex flex-col gap-3 border-t border-gray-100">
							<button
								onClick={() => router.push("/iniciar-sesion")}
								className="w-full bg-[#252d62] hover:bg-[#1a2046] text-white font-bold py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
							>
								Ya tengo cuenta (Iniciar Sesión)
							</button>

							<button
								onClick={() => router.push("/registrarse")}
								className="w-full bg-white border-2 border-[#252d62] text-[#252d62] hover:bg-blue-50 font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]"
							>
								Crear una cuenta nueva
							</button>

							<button
								onClick={() => setIsAuthModalOpen(false)}
								className="w-full text-gray-500 hover:text-gray-800 font-semibold py-2 mt-2 transition-colors"
							>
								Cancelar
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

export default CursoDetailsPage;
