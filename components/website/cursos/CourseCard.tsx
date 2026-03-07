import Link from "next/link";
import Image, { StaticImageData } from "next/image";
import { Users, ArrowRight, Image as ImageIcon } from "lucide-react";

// Importamos las fotos estáticas
import individuales_photo from "@/assets/cursoDetails/individuales.png";
import empresariales_photo from "@/assets/cursoDetails/empresariales.png";

// 1. Tipamos correctamente los datos, asegurándonos de usar 'imgURL'
export interface Curso {
	id?: string;
	nombre: string;
	categoria: string;
	edades: string;
	imgURL?: string | StaticImageData; // Corregido de 'imagen' a 'imgURL'
	descripcion?: string;
}

export function CourseCard({ curso }: { curso: Curso }) {
	// 2. ESTADO DERIVADO: Calculamos la ruta y la imagen "al vuelo"
	let linkTo = `/cursos/${curso.categoria}/${curso.id}`;
	let imageToRender = curso.imgURL;

	// Sobreescribimos si es un caso especial
	if (curso.categoria === "Individuales") {
		linkTo = "/individuales";
		imageToRender = individuales_photo;
	} else if (curso.categoria === "Empresariales") {
		linkTo = "/empresariales";
		imageToRender = empresariales_photo;
	}

	return (
		<Link
			href={linkTo}
			className="
        group flex flex-row items-stretch
        bg-white rounded-2xl overflow-hidden
        min-w-[250px] max-w-[500px] w-[450px] h-[200px]
        cursor-pointer no-underline 
        border border-gray-100 shadow-sm
        hover:shadow-xl hover:-translate-y-1 transition-all duration-300
      "
		>
			{/* IMAGEN DEL CURSO */}
			<div className="relative w-[45%] shrink-0 h-full bg-gray-50 overflow-hidden">
				{imageToRender ? (
					<Image
						src={imageToRender}
						alt={`Portada del curso ${curso.nombre}`}
						fill
						className="object-cover group-hover:scale-105 transition-transform duration-500"
						sizes="130px"
					/>
				) : (
					// Fallback por si algún curso no tiene imagen cargada
					<div className="w-full h-full flex items-center justify-center text-gray-300">
						<ImageIcon className="w-8 h-8" />
					</div>
				)}
			</div>

			{/* TEXTOS DEL CURSO */}
			<div className="flex flex-col justify-center flex-1 p-5 relative">
				<h3 className="text-[#252d62] font-bold text-[1.35rem] leading-tight mb-2">
					{curso.nombre}
				</h3>

				<div className="flex items-center text-gray-500 text-sm font-medium mb-3">
					<Users className="w-4 h-4 mr-2 text-[#EE1120]" />
					<span>{curso.edades}</span>
				</div>

				{/* Call to action sutil */}
				<div className="mt-auto flex items-center text-[#EE1120] font-bold text-sm">
					<span>Ver detalles</span>
					<ArrowRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
				</div>

				{/* Borde decorativo lateral (opcional, le da un toque distintivo) */}
				<div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-gray-100 rounded-l-full group-hover:bg-[#EE1120] transition-colors duration-300"></div>
			</div>
		</Link>
	);
}
