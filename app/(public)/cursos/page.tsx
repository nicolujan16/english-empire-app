"use client";

import { useState, useEffect } from "react";
import { MainBanner } from "@/components/website/common/MainBanner";
// Ojo: Asegúrate de que la ruta de CourseCard sea correcta cuando lo migremos
import { CourseCard } from "@/components/website/cursos/CourseCard";

// 1. Definimos las Interfaces de TypeScript
export interface Curso {
	id: string;
	nombre: string;
	categoria: string;
	edades: string;
	descripcion?: string;
}

// 2. MOCK DATA: Nuestra "Base de datos" temporal
const mockCategories = [
	"Kinders",
	"Juniors",
	"Teens",
	"Adults",
	"Individuales",
	"Empresariales",
];

const mockCursos: Curso[] = [
	{
		id: "1",
		edades: "4 y 5 años",
		categoria: "Kinders",
		nombre: "Kinder 1",
		descripcion:
			"¡Bienvenidos a nuestras clases de inglés para niños! Aprendemos jugando.",
	},
	{
		id: "2",
		edades: "6 a 8 años",
		categoria: "Juniors",
		nombre: "Junior A",
	},
	{
		id: "3",
		edades: "Todas las edades!",
		categoria: "Individuales",
		nombre: "Clases Individuales",
		descripcion: "Clases 1 a 1 personalizadas para tu ritmo y necesidades.",
	},
	{
		id: "4",
		edades: "Todas las edades!",
		categoria: "Empresariales",
		nombre: "Clases Empresariales",
	},
];

export default function CursosPage() {
	// 3. Estados con sus tipos
	const [cursos, setCursos] = useState<Curso[]>([]);
	const [categories, setCategories] = useState<string[]>([]);
	const [categorySelected, setCategorySelected] = useState<string>("Kinders");
	const [isLoading, setIsLoading] = useState<boolean>(true);

	// 4. Simulamos la llamada a Firebase
	useEffect(() => {
		const fetchData = async () => {
			// Simulamos que la red tarda 800ms para ver tu loader
			setTimeout(() => {
				setCategories(mockCategories);
				setCursos(mockCursos);
				setIsLoading(false);
			}, 800);
		};

		fetchData();
	}, []);

	return (
		<div className="w-full">
			{/* BANNER PRINCIPAL */}
			<MainBanner>Cursos</MainBanner>

			{/* CONTENEDOR MAIN (Reemplaza a .cursos-main) */}
			<div className="flex flex-col items-center gap-12 w-full h-auto px-6 py-12 md:p-12">
				{/* BOTONES DE CATEGORÍAS */}
				<div className="w-full flex justify-center gap-4 md:gap-8 flex-wrap">
					{categories.map((category) => (
						<button
							key={category}
							onClick={() => setCategorySelected(category)}
							className={`
                text-lg py-2 px-5 rounded-2xl border-none cursor-pointer transition-colors font-medium
                ${
									category === categorySelected
										? "text-[#f1f1f1] bg-[#252d62] shadow-md"
										: "text-[#252d62] bg-[#f1f1f1] hover:bg-gray-200"
								}
              `}
						>
							{category}
						</button>
					))}
				</div>

				{/* CONTENEDOR DE TARJETAS Y LOADER */}
				<div className="flex justify-center items-center flex-wrap gap-12 w-full max-w-5xl min-h-[300px]">
					{isLoading ? (
						// LOADER CON TAILWIND (Reemplaza a .spinner y .loader)
						<div className="flex flex-col justify-center items-center gap-3">
							<div className="w-12 h-12 border-[5px] border-black/10 border-t-[#EE1120] rounded-full animate-spin"></div>
						</div>
					) : (
						// RENDERIZADO DE TARJETAS
						cursos
							.filter((curso) => curso.categoria === categorySelected)
							.map((curso) => <CourseCard key={curso.id} curso={curso} />)
					)}
				</div>
			</div>
		</div>
	);
}
