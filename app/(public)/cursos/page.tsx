"use client";

import { useState, useEffect } from "react";
import { MainBanner } from "@/components/website/common/MainBanner";
import { CourseCard } from "@/components/website/cursos/CourseCard";

// --- FIRESTORE IMPORTS ---
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

export interface Curso {
	id: string;
	nombre: string;
	categoria: string;
	edades: string;
	descripcion?: string;
	imgURL?: string;
	precio?: number;
}

const PREFERRED_CATEGORY_ORDER = [
	"Kinder",
	"Junior",
	"Teens",
	"Adultos",
	"Individuales",
	"Empresas",
];

export default function CursosPage() {
	const [cursos, setCursos] = useState<Curso[]>([]);
	const [categories, setCategories] = useState<string[]>([]);
	const [categorySelected, setCategorySelected] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(true);

	useEffect(() => {
		const fetchCursos = async () => {
			try {
				const cursosRef = collection(db, "Cursos");
				// Solo traemos los cursos que estén activos
				const q = query(cursosRef, where("active", "==", true));
				const snapshot = await getDocs(q);

				const fetchedCursos: Curso[] = [];
				const uniqueCategories = new Set<string>();

				snapshot.forEach((doc) => {
					const data = doc.data();

					// Formateador de edades (De array [4, 7] a string "4 a 7 años")
					let edadesStr = "Todas las edades";
					if (
						data.edades &&
						Array.isArray(data.edades) &&
						data.edades.length === 2
					) {
						edadesStr = `${data.edades[0]} a ${data.edades[1]} años`;
					}

					// Guardamos la categoría en nuestro Set para crear los botones sin duplicados
					if (data.categoria) {
						uniqueCategories.add(data.categoria);
					}

					fetchedCursos.push({
						id: doc.id,
						nombre: data.nombre || "Curso sin nombre",
						categoria: data.categoria || "Otros",
						edades: edadesStr,
						descripcion: data.descripcion || "",
						imgURL: data.imgURL || "",
						precio: data.precio || 0,
					});
				});

				// Ordenamos las categorías encontradas según nuestro orden preferido
				const sortedCategories = Array.from(uniqueCategories).sort((a, b) => {
					const indexA = PREFERRED_CATEGORY_ORDER.indexOf(a);
					const indexB = PREFERRED_CATEGORY_ORDER.indexOf(b);
					// Si una categoría no está en la lista preferida, la manda al final
					return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
				});

				setCursos(fetchedCursos);
				setCategories(sortedCategories);

				// Seleccionamos por defecto la primera categoría disponible (ej: Kinder)
				if (sortedCategories.length > 0) {
					setCategorySelected(sortedCategories[0]);
				}
			} catch (error) {
				console.error("Error obteniendo cursos:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchCursos();
	}, []);

	return (
		<div className="w-full">
			{/* BANNER PRINCIPAL */}
			<MainBanner>Cursos</MainBanner>

			{/* CONTENEDOR MAIN */}
			<div className="flex flex-col items-center gap-12 w-full h-auto px-2 py-12 md:p-12">
				{/* BOTONES DE CATEGORÍAS */}
				{!isLoading && categories.length > 0 && (
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
				)}

				{/* CONTENEDOR DE TARJETAS Y LOADER */}
				<div className="flex justify-center items-center flex-wrap gap-12 w-full min-h-[200px]">
					{isLoading ? (
						// LOADER CON TAILWIND
						<div className="flex flex-col justify-center items-center gap-3">
							<div className="w-12 h-12 border-[5px] border-black/10 border-t-[#EE1120] rounded-full animate-spin"></div>
						</div>
					) : cursos.length > 0 ? (
						// RENDERIZADO DE TARJETAS
						cursos
							.filter((curso) => curso.categoria === categorySelected)
							.map((curso) => <CourseCard key={curso.id} curso={curso} />)
					) : (
						// MENSAJE SI NO HAY CURSOS ACTIVOS
						<div className="text-center text-gray-500 py-10">
							<p className="text-xl">
								Pronto publicaremos nuestros nuevos cursos.
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
