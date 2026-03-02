"use client";

import React, { useState, useEffect } from "react";

import "../globals.css";
// Componentes
import Slider from "@/components/website/common/Slider";

// Assets Desktop
import sliderimg1Deskt from "@/assets/sliders/desk-slide-img-1.png";
import sliderimg2Deskt from "@/assets/sliders/desk-slide-img-2.png";
import sliderimg3Deskt from "@/assets/sliders/desk-slide-img-3.png";
import cursosBannerDesk from "@/assets/sliders/banner-cursos-desk.png";
import joinusBannerDesk from "@/assets/sliders/banner-joinus-desk.png";

// Assets Mobile
import sliderimg1Mobile from "@/assets/sliders/mobile-slide-img-1.png";
import sliderimg2Mobile from "@/assets/sliders/mobile-slide-img-2.png";
import sliderimg3Mobile from "@/assets/sliders/mobile-slide-img-3.png";
import cursosBannerMobile from "@/assets/sliders/banner-cursos-mobile.png";
import joinusBannerMobile from "@/assets/sliders/banner-joinus-mobile.png";

// Icons
import utnIcon from "@/assets/icons/icon-utn.png";
import Image from "next/image";

export default function HomePage() {
	const imagesDesktop = [sliderimg1Deskt, sliderimg2Deskt, sliderimg3Deskt];
	const imagesMobile = [sliderimg1Mobile, sliderimg2Mobile, sliderimg3Mobile];

	// IMPORTANTE: Inicializamos en un valor seguro (false) para que el Servidor no llore.
	const [isScreenSmall, setIsScreenSmall] = useState(false);

	useEffect(() => {
		const handleResize = () => {
			setIsScreenSmall(window.innerWidth < 950);
		};

		// Al envolverlo en un micro-retraso (0ms), dejamos que React termine su
		// primer renderizado en paz antes de actualizar el estado.
		setTimeout(() => {
			handleResize();
		}, 0);

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	return (
		<div className="w-full flex flex-col gap-16 md:gap-24 pb-12">
			{/* SLIDER PRINCIPAL */}
			<Slider
				images={!isScreenSmall ? imagesDesktop : imagesMobile}
				text="Inscripción 2026"
				link="/cursos"
				imgAlt="Aprende inglés con los cursos personalizados de English Empire"
			/>

			{/* SECCIÓN CURSOS */}
			<section className="flex flex-col items-center gap-6 px-6 w-full max-w-7xl mx-auto">
				<h2 className="text-3xl md:text-5xl font-bold text-center text-[#1d2355]">
					Nuestros Cursos
				</h2>
				<p className="text-xl md:text-3xl text-center leading-relaxed text-gray-700 max-w-5xl">
					Creamos cursos personalizados de acuerdo a los deseos y necesidades de
					nuestros alumnos, donde nuestros docentes son la principal clave para
					lograr un marcado progreso en el menor tiempo posible.
				</p>
			</section>

			{/* BANNER CURSOS */}
			<Slider
				images={[isScreenSmall ? cursosBannerMobile : cursosBannerDesk]}
				text="Ver cursos"
				link="/cursos"
				interval={false}
				imgAlt="Aprende inglés con los cursos personalizados de English Empire"
			/>

			{/* SECCIÓN CERTIFICACIÓN */}
			<section className="flex flex-col items-center gap-8 px-6 w-full max-w-7xl mx-auto">
				<h2 className="text-2xl md:text-[40px] font-medium text-center text-[#1d2355] leading-tight">
					Certificados con{" "}
					<b className="font-bold text-[#d30000]">
						validez nacional y oficial.
					</b>
				</h2>

				<ul className="flex flex-col gap-6 w-full md:w-[90%] text-justify list-disc pl-5 marker:text-[#d30000]">
					<li className="text-lg md:text-xl text-gray-700 leading-relaxed">
						Nuestros certificados cuentan con la aprobación del Ministerio de
						Educación, lo que garantiza su reconocimiento en diversas
						universidades, instituciones y empresas. Obtén tu certificación con
						nosotros y abre las puertas a nuevas oportunidades educativas y
						profesionales.
					</li>
					<li className="text-lg md:text-xl text-gray-700 leading-relaxed">
						Ofrecemos certificaciones adaptadas a todas las edades y niveles,
						desde A1 hasta C3. Sea cual sea tu punto de partida, estamos aquí
						para guiarte en tu camino hacia el dominio del inglés.
					</li>
					<li className="text-lg md:text-xl text-gray-700 leading-relaxed">
						El prestigio de nuestra institución en la enseñanza de idiomas
						proporciona una ventaja significativa para los estudiantes,
						respaldado por nuestras reconocidas trayectorias. Tu elección de
						estudiar con nosotros no solo garantiza un aprendizaje de calidad,
						sino también el acceso a oportunidades excepcionales que
						fortalecerán tu camino académico y profesional.
					</li>
				</ul>

				{/* LOGO UTN */}
				<Image
					src={utnIcon}
					alt="UTN logo - Universidad Tecnológica Nacional"
					className="w-48 md:w-64 object-contain mt-4 opacity-90 hover:opacity-100 transition-opacity"
				/>
			</section>

			{/* BANNER JOIN US */}
			<Slider
				images={[isScreenSmall ? joinusBannerMobile : joinusBannerDesk]}
				text="Postulate"
				link="/postulate"
				interval={false}
				imgAlt="Únete a nuestro equipo, ¡postúlate!"
			/>
		</div>
	);
}
