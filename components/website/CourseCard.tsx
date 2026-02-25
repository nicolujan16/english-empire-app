import Link from "next/link";
import Image, { StaticImageData } from "next/image";

// Importamos las fotos estáticas
import individuales_photo from "@/assets/cursoDetails/individuales.png";
import empresariales_photo from "@/assets/cursoDetails/empresariales.png";

interface Curso {
	id?: string;
	nombre: string;
	categoria: string;
	edades: string;
	imagen?: string | StaticImageData; // Puede venir de Firebase (string) o ser local
}

export function CourseCard({ curso }: { curso: Curso }) {
	// 2. ESTADO DERIVADO: Calculamos la ruta y la imagen "al vuelo" sin useEffect.
	// Arrancamos con los valores por defecto
	let linkTo = `/cursos/${curso.categoria}/${curso.nombre.replace(/\s+/g, "")}`;
	let imageToRender = curso.imagen;

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
        /* Equivalente a .curso-card en Tailwind */
        grid grid-cols-[auto_1fr] items-center 
        bg-[#f1f1f1] rounded-[20px] 
        w-full max-w-[400px] 
        cursor-pointer no-underline 
        hover:shadow-lg hover:scale-[1.02] transition-all duration-300
      "
		>
			{/* IMAGEN DEL CURSO */}
			{/* Si imageToRender existe, la renderizamos */}
			{imageToRender && (
				<Image
					src={imageToRender}
					alt={`Logo del curso ${curso.nombre}`}
					// Para que no se rompa el diseño si vienen fotos de distintos tamaños
					className="w-[120px] h-full min-h-[120px] object-cover rounded-l-[20px]"
				/>
			)}

			{/* TEXTOS DEL CURSO */}
			<div className="flex flex-col items-center gap-4 text-center p-5">
				<p className="text-[#1d2355] font-bold text-xl m-0">{curso.nombre}</p>
				<p className="text-gray-600 m-0">{curso.edades}</p>
			</div>
		</Link>
	);
}
