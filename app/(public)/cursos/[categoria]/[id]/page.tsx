"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image"; // <-- Importamos el componente de Next.js

// Assets
import weekIcon from "@/assets/cursoDetails/icon_semanas.png";
import lessonsIcon from "@/assets/cursoDetails/icon_frecuencia.png";
import bannerTeens from "@/assets/cursoDetails/banner_teens.png";
import ConfirmInscription from "@/components/website/cursos/ConfirmInscription";
import { CursoObject } from "@/types";
import { useAuth } from "@/context/AuthContext";

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
			<span>{clasesSemanales} clases semanales</span>
		</div>
	</div>
);

export default function CursoDetailsPage() {
	const params = useParams();
	const router = useRouter();

	const { userData } = useAuth();

	const [isModalOpen, setIsModalOpen] = useState(false);

	const urlCategoria = params.categoria as string;
	const urlId = params.id as string;

	const curso: CursoObject = {
		id: urlId || "1",
		nombre: `Inglés ${urlCategoria ? urlCategoria.charAt(0).toUpperCase() + urlCategoria.slice(1) : "Teens"}`,
		descripcion: [
			"Nuestro curso de Inglés para adolescentes está diseñado específicamente para jóvenes de 12 a 17 años. Utilizamos una metodología dinámica que fomenta la participación activa.",
			"A través de proyectos colaborativos, uso de tecnología y debates sobre temas de actualidad, logramos que el aprendizaje sea significativo y divertido.",
			"Al finalizar cada nivel, los alumnos rinden un examen para certificar sus conocimientos con validez nacional.",
		],
		duracion: "8 Meses",
		clasesSemanales: 2,
		precio: 18500,
		cupos: 3,
		inicio: "10/03/2026",
		fin: "10/11/2026",
		categoria: urlCategoria || "Teens",
		horarios: [
			{ dia: "Martes", hora: "18:00 - 19:30" },
			{ dia: "Jueves", hora: "18:00 - 19:30" },
		],
	};

	const handleConfirmEnrollment = (studentDNI: string) => {
		router.push(`/checkout?curso=${curso.id}&alumnoDNI=${studentDNI}`);
	};

	return (
		<>
			<section className="w-full flex flex-col items-center pb-12 bg-white relative">
				<div
					className="w-[90%] h-[248px] bg-cover bg-center rounded-b-[45px] flex flex-col lg:flex-row justify-center lg:justify-start items-center lg:pl-14 gap-4 shadow-sm"
					style={{ backgroundImage: `url(${bannerTeens.src})` }}
				>
					<h1 className="text-[#f1f1f1] text-4xl lg:text-[54px] font-bold drop-shadow-md text-center lg:text-left">
						{curso.nombre}
					</h1>
					<div className="lg:hidden bg-white/90 p-4 rounded-xl shadow-lg mt-2">
						{/* Le pasamos las props al componente */}
						<DurationInfo
							duracion={curso.duracion}
							clasesSemanales={curso.clasesSemanales}
						/>
					</div>
				</div>

				<div className="w-[90%] max-w-7xl flex flex-col lg:flex-row justify-center items-start pt-12 gap-10 lg:gap-20">
					<div className="w-full lg:w-[65%] flex flex-col gap-8 text-[#252d62] text-xl lg:text-[28px] leading-relaxed text-justify lg:text-left">
						{curso.descripcion.map((parrafo, index) => (
							<p key={index}>{parrafo}</p>
						))}
					</div>

					<aside className="w-full lg:w-[35%] lg:sticky lg:top-36 flex flex-col items-center">
						<div className="bg-[#f1f1f1] w-full p-8 rounded-[20px] flex flex-col gap-6 items-center text-[#252d62] shadow-lg">
							<h2 className="text-5xl font-normal">${curso.precio}</h2>

							{curso.cupos > 0 ? (
								<button
									onClick={() => {
										if (userData) {
											setIsModalOpen(true);
										} else {
											router.push("/iniciar-sesion");
										}
									}}
									className="bg-[#EE1120] hover:bg-[#c4000e] text-white text-2xl lg:text-[32px] py-3 px-8 rounded-full w-full text-center transition-colors shadow-md"
								>
									Inscribirme
								</button>
							) : (
								<button
									disabled
									className="bg-gray-400 text-white text-2xl lg:text-[32px] py-3 px-8 rounded-full w-full text-center cursor-not-allowed"
								>
									Inscribirme
								</button>
							)}

							<i
								className={`text-lg ${curso.cupos > 0 ? "text-gray-600" : "text-red-500 font-bold"}`}
							>
								{curso.cupos > 0
									? `Cupos disponibles: ${curso.cupos}`
									: "No hay más cupos disponibles"}
							</i>

							<div className="hidden lg:flex w-full border-t-2 border-white pt-6 justify-center">
								<DurationInfo
									duracion={curso.duracion}
									clasesSemanales={curso.clasesSemanales}
								/>
							</div>

							<div className="w-full flex flex-col gap-4 border-t-2 border-white pt-6 text-lg text-center">
								<div>
									<p className="text-[#EE1120] font-bold">Fecha de inicio</p>
									<p>{curso.inicio}</p>
								</div>
								<div>
									<p className="text-[#EE1120] font-bold">
										Fecha de finalización
									</p>
									<p>{curso.fin}</p>
								</div>
							</div>
						</div>
					</aside>
				</div>
			</section>

			{/* Modal */}
			{isModalOpen && (
				<ConfirmInscription
					curso={curso}
					setIsModalOpen={setIsModalOpen}
					handleConfirmEnrollment={handleConfirmEnrollment}
				/>
			)}
		</>
	);
}
