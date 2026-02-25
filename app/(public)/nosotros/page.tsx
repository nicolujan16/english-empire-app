"use client";

import { useEffect, useState } from "react";
import Link from "next/link"; // Next.js Link
import Image, { StaticImageData } from "next/image"; // Next.js Image

// Componentes
import { MainBanner } from "@/components/website/common/MainBanner";
// Ojo: Asegurate de que la ruta de ProfesorCard sea correcta cuando lo migres
import ProfesorCard from "@/components/website/nosotros/ProfesorCard";

// Assets
import nosAlumnos from "@/assets/nosotros/alumnos-recibidos.png";
import nosCursos from "@/assets/nosotros/cursos.png";
import nosProfesores from "@/assets/nosotros/profesores.png";

// 1. Tipamos nuestro MOCK DATA y nuestro Estado
interface StaffMember {
	id: number | string;
	nombre: string;
	cargo: string;
	imagen: string;
}

// MOCK DATA PARA PRUEBAS (Borrar cuando conectes Firebase)
const MOCK_STAFF: StaffMember[] = [
	{
		id: 1,
		nombre: "Ana Gómez",
		cargo: "Director",
		imagen: "https://i.pravatar.cc/300?img=1",
	},
	{
		id: 2,
		nombre: "Carlos Pérez",
		cargo: "Profesor",
		imagen: "https://i.pravatar.cc/300?img=11",
	},
	{
		id: 3,
		nombre: "Lucía M.",
		cargo: "Secretaria",
		imagen: "https://i.pravatar.cc/300?img=5",
	},
	{
		id: 4,
		nombre: "Marcos R.",
		cargo: "Profesor",
		imagen: "https://i.pravatar.cc/300?img=13",
	},
];

export default function AboutPage() {
	// 2. Le decimos a useState que va a manejar un array de StaffMember
	const [staff, setStaff] = useState<StaffMember[]>([]);

	useEffect(() => {
		// Simulamos un pequeño tiempo de carga (opcional, para ver el efecto)
		setTimeout(() => {
			setStaff(MOCK_STAFF);
		}, 500);
	}, []);

	return (
		<div className="flex flex-col min-h-screen">
			{/* MAIN CONTAINER */}
			<main className="flex flex-col gap-12 pb-10">
				{/* Banner Principal */}
				<MainBanner>
					¡Aprende inglés y conviértete en un ciudadano del mundo!
				</MainBanner>

				{/* SECCIÓN ESTADÍSTICAS (Iconos) */}
				<section className="w-full grid grid-cols-1 lg:grid-cols-3">
					<StatItem
						img={nosAlumnos}
						alt="+100 Alumnos Recibidos"
						label="Alumnos Recibidos"
					/>
					<StatItem
						img={nosCursos}
						alt="12 Cursos disponibles"
						label="Cursos"
					/>
					<StatItem
						img={nosProfesores}
						alt="6 Profesores excelentes"
						label="Profesores"
					/>
				</section>

				{/* TEXTO INTRODUCTORIO */}
				<section className="w-[90%] md:w-[80%] mx-auto flex flex-col items-center gap-8 py-8 text-center text-xl md:text-2xl text-gray-700">
					<p>
						Descubre el mundo de las posibilidades en English Empire. Ofrecemos
						cursos para todas las edades y niveles, desde principiantes hasta
						expertos.
					</p>
					<p>
						Ofrecemos cursos tanto en línea como presenciales, adaptados a todas
						las edades y niveles. Con profesores altamente capacitados y
						metodología dinámica, te garantizamos una experiencia educativa
						enriquecedora.
					</p>
					<p>
						¡No pierdas la oportunidad de mejorar tus habilidades y alcanzar tus
						metas!
					</p>
					<b className="text-[#252d62] text-2xl md:text-3xl mt-4">
						¡Inscríbete hoy y comienza tu viaje hacia el éxito!
					</b>
				</section>

				{/* SECCIÓN "NUESTRO EQUIPO" (Fondo Azul) */}
				<section className="w-full bg-[#252d62] text-white text-center py-16 px-6 md:px-20 flex flex-col gap-6">
					<h3 className="text-3xl md:text-4xl font-bold">Nuestro equipo</h3>
					<p className="text-xl md:text-[27px] leading-relaxed max-w-6xl mx-auto">
						Conoce a nuestros profesores profesionales de inglés, un equipo de
						expertos en la enseñanza del idioma. Cada uno de ellos tiene años de
						experiencia y ha dedicado su carrera a ayudar a otros a alcanzar su
						máximo potencial en el aprendizaje del inglés. Y también al resto
						del equipo que contribuyen con todo el personal docente y al
						engrandecimiento institucional.
					</p>
				</section>

				{/* GRID DE PROFESORES */}
				<section className="w-[90%] md:w-[80%] mx-auto flex flex-wrap justify-center gap-10 py-8">
					{staff.length > 0 ? (
						staff.map((prof) => (
							<ProfesorCard
								key={prof.id}
								name={prof.nombre}
								role={prof.cargo}
								imgUrl={prof.imagen}
							/>
						))
					) : (
						<div className="flex justify-center items-center h-40">
							{/* Reutilizamos el loader de Tailwind de la pág de Cursos */}
							<div className="w-12 h-12 border-[5px] border-black/10 border-t-[#EE1120] rounded-full animate-spin"></div>
						</div>
					)}
				</section>

				{/* BANNER FINAL (Llamado a la acción) */}
				{/* Nota del Tech Lead: Al poner "mb-16" le damos espacio al botón flotante */}
				<div className="relative bg-[#252d62] text-center py-24 px-[10%] mt-12 mb-16">
					<p className="text-white font-bold text-2xl md:text-4xl max-w-4xl mx-auto">
						¡Permítenos inspirarte a alcanzar tus metas y superar tus
						expectativas con nuestros profesores profesionales!
					</p>

					{/* Botón Flotante */}
					<Link
						href="/cursos"
						className="
              absolute -bottom-10 left-1/2 -translate-x-1/2
              bg-[#ee1120] hover:bg-[#c4000e] transition-colors
              text-white text-2xl font-bold
              flex justify-center items-center
              w-[300px] h-[80px]
              rounded-full shadow-lg
            "
					>
						Ver cursos
					</Link>
				</div>
			</main>
		</div>
	);
}

// 3. Tipamos los Props del sub-componente
interface StatItemProps {
	img: StaticImageData; // Usamos el tipo de Next.js para imágenes locales
	alt: string;
	label: string;
}

function StatItem({ img, alt, label }: StatItemProps) {
	return (
		<div className="flex flex-col items-center gap-4 py-4 w-full">
			<Image
				src={img}
				alt={alt}
				className="w-full h-auto object-contain"
				// Agregamos max-w para que no se estire demasiado en pantallas gigantes
			/>
			<p className="text-3xl font-medium text-[#252d62] text-center">{label}</p>
		</div>
	);
}
