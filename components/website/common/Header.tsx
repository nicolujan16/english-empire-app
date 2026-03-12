"use client";

import { useState } from "react";
import Link from "next/link"; // Link oficial de Next.js
import Image from "next/image"; // Image oficial de Next.js

// Asegúrate de que las rutas a tus assets sean correctas según tu nueva estructura
import logo from "@/assets/logo-empire.png";
import menulistsvg from "@/assets/svgs/menu-list.svg";
import exitmenulistsvg from "@/assets/svgs/exit-menu-list.svg";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	const { user } = useAuth();

	const toggleMenu = () => {
		setIsMenuOpen(!isMenuOpen);
	};

	const handleLinkClick = () => {
		// Cerramos el menú al hacer click en un link (UX móvil)
		setIsMenuOpen(false);
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	return (
		<div className="mb-[100px]">
			<header className="fixed top-0 left-0 w-full h-[100px] z-50">
				<nav className="bg-[#f1f1f1] w-full h-full flex justify-between items-center px-3 lg:px-9 shadow-sm">
					{/* LOGO */}
					<Link
						href="/"
						onClick={handleLinkClick}
						className="shrink-0 flex items-center justify-center"
					>
						<Image
							src={logo}
							alt="English Empire Logo"
							className="w-[150px] lg:w-[200px] h-auto object-contain"
							priority // El logo es prioridad alta
						/>
					</Link>

					{/* BOTÓN HAMBURGUESA (Solo visible en Móvil) */}
					<div className="lg:hidden cursor-pointer w-[45px] h-[45px] flex items-center justify-center">
						<Image
							src={isMenuOpen ? exitmenulistsvg : menulistsvg}
							onClick={toggleMenu}
							alt="Menu Toggle"
							className="w-full h-full"
							priority // Para que el botón esté listo de inmediato
						/>
					</div>

					{/* LISTA DE NAVEGACIÓN */}
					<ul
						className={`
          /* Estilos Base */
          text-[#1d2355] font-bold text-2xl list-none
          
          /* Estilos ESCRITORIO */
          lg:flex lg:flex-row lg:items-center lg:gap-8 lg:static lg:w-auto lg:h-auto lg:bg-transparent lg:shadow-none lg:p-0

          /* Estilos MÓVIL */
          ${
						isMenuOpen
							? "flex flex-col fixed top-[100px] right-0 w-[314px] max-w-full h-[calc(100vh-100px)] bg-[#f1f1f1] overflow-y-auto z-50 items-start justify-start p-4 gap-6 shadow-xl border-t border-gray-200"
							: "hidden"
					}
        `}
					>
						<NavItem href="/" onClick={handleLinkClick}>
							Inicio
						</NavItem>
						{/* OJO ACÁ: En tu viejo código decía "/curso", en Next le pondremos "/cursos" como charlamos */}
						<NavItem href="/cursos" onClick={handleLinkClick}>
							Cursos
						</NavItem>
						<NavItem href="/nosotros" onClick={handleLinkClick}>
							Nosotros
						</NavItem>
						{/* <NavItem href="/postulate" onClick={handleLinkClick}>
							Trabaja con nosotros
						</NavItem> */}
						<NavItem href="/contacto" onClick={handleLinkClick}>
							Contacto
						</NavItem>
						<li className="w-full lg:w-auto mt-4 lg:mt-0 flex justify-center">
							<Link
								href={user ? "/mi-cuenta" : "/iniciar-sesion"}
								onClick={handleLinkClick}
								className="
                    block w-full lg:w-auto text-center
                    bg-[#d30000] text-white 
                    px-6 py-2 rounded-lg 
                    hover:bg-[#b30000] transition-colors 
                    font-medium shadow-sm hover:no-underline
                    text-lg lg:text-base
                  "
							>
								<p className="font-bold">
									{user ? "Mi Cuenta" : "Iniciar Sesión"}
								</p>
							</Link>
						</li>
					</ul>
				</nav>
			</header>
		</div>
	);
}

// Interfaz para tipar el sub-componente
interface NavItemProps {
	href: string;
	onClick: () => void;
	children: React.ReactNode;
}

function NavItem({ href, onClick, children }: NavItemProps) {
	return (
		<li className="w-full lg:w-auto flex justify-center">
			<Link
				href={href}
				onClick={onClick}
				className="block w-full py-2 px-2 hover:underline decoration-2 underline-offset-4 transition-all text-center"
			>
				{children}
			</Link>
		</li>
	);
}
