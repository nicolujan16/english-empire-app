"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image, { StaticImageData } from "next/image"; // Importamos Image

interface SliderProps {
	// Como ahora usamos <Image>, lo ideal es pasarle estrictamente los objetos importados
	images: StaticImageData[];
	text: string;
	link: string;
	interval?: boolean;
	imgAlt?: string;
}

export default function Slider({
	images,
	text,
	link,
	interval = true,
	imgAlt = "",
}: SliderProps) {
	const [currentImage, setCurrentImage] = useState(0);
	const intervalDuration = 6000;

	useEffect(() => {
		if (!interval || images.length <= 1) return;

		const intervalId = setInterval(() => {
			setCurrentImage((prevImage) => (prevImage + 1) % images.length);
		}, intervalDuration);

		return () => clearInterval(intervalId);
	}, [images.length, intervalDuration, interval]);

	return (
		<div className="relative flex flex-col justify-center w-full h-auto">
			{/* MAGIA DE NEXT.JS AQUÍ */}
			<Image
				src={images[currentImage]}
				alt={imgAlt}
				// w-full y h-auto hacen que sea responsive, Next.js hace el resto
				className="
          w-full 
          h-auto 
          max-h-[calc(90vh-115px)] 
          object-cover 
          rounded-b-[40px] md:rounded-b-[80px]
          transition-opacity duration-500 ease-in-out
        "
				// Opcional pero recomendado para la primera imagen del slider:
				priority={true}
			/>

			{/* BOTÓN DE INSCRIPCIÓN (CTA) */}
			<Link
				href={link}
				className="
          absolute 
          -bottom-[30px] md:-bottom-[40px] 
          left-1/2 
          -translate-x-1/2 
          flex justify-center items-center
          w-[260px] h-[60px] md:w-[300px] md:h-[80px]
          text-2xl md:text-4xl font-bold
          bg-[#EE1120] text-white rounded-full shadow-lg 
          hover:bg-[#c4000e] hover:scale-105 active:scale-95
          transition-all duration-300
        "
			>
				{text}
			</Link>
		</div>
	);
}
