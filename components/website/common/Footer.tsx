import Link from "next/link";
import Image, { StaticImageData } from "next/image";

// Assets
import logoFooter from "@/assets/logo_footer.png";
import fbIcon from "@/assets/icons/icon-fb.png";
import igIcon from "@/assets/icons/icon-ig.png";
import tiktokIcon from "@/assets/icons/icon-tiktok.png";

export default function Footer() {
	const currentYear = new Date().getFullYear();

	return (
		// CONTENEDOR PRINCIPAL
		<div className="w-full bg-[#242854] text-white flex flex-col items-center justify-center py-12 gap-8">
			{/* SECCIÓN SUPERIOR (Columnas) */}
			<footer className="flex flex-row justify-between md:justify-center w-[90%] max-w-7xl gap-8 md:gap-20 flex-wrap">
				{/* COLUMNA 1: LOGO */}
				<div className="hidden lg:flex items-center justify-center">
					<Image
						src={logoFooter}
						alt="English Empire Logo"
						className="w-auto h-auto max-w-[200px]"
					/>
				</div>

				{/* COLUMNA 2: CURSOS */}
				<nav className="flex flex-col gap-4">
					<h3 className="text-2xl md:text-4xl font-normal">Cursos</h3>
					<ul className="flex flex-col gap-2 list-none p-0">
						<FooterLink href="/cursos">Kinder</FooterLink>
						<FooterLink href="/cursos">Juniors</FooterLink>
						<FooterLink href="/cursos">Teens</FooterLink>
						<FooterLink href="/cursos">Adults</FooterLink>
						<FooterLink href="/cursos">Individuales</FooterLink>
						<FooterLink href="/cursos">Empresariales</FooterLink>
					</ul>
				</nav>

				{/* COLUMNA 3: NOSOTROS */}
				<nav className="hidden md:flex flex-col gap-4">
					<h3 className="text-2xl md:text-4xl font-normal">Nosotros</h3>
					<ul className="flex flex-col gap-2 list-none p-0">
						<FooterLink href="/nosotros">Quiénes somos</FooterLink>
						<FooterLink href="/contacto">Contacto</FooterLink>
						<FooterLink href="/postulate">Trabajá con nosotros</FooterLink>
						<FooterLink href="/nosotros">Preguntas Frecuentes</FooterLink>
					</ul>
				</nav>

				{/* COLUMNA 4: REDES */}
				<div className="flex flex-col gap-4">
					<p className="text-2xl md:text-3xl">Seguinos</p>
					<div className="flex gap-8 pt-2">
						<SocialIcon
							href="https://www.facebook.com/englishempirelr"
							icon={fbIcon}
							alt="Facebook"
						/>
						<SocialIcon
							href="https://www.instagram.com/englishempirelr/"
							icon={igIcon}
							alt="Instagram"
						/>
						<SocialIcon
							href="https://www.tiktok.com/@englishempire.lr"
							icon={tiktokIcon}
							alt="TikTok"
						/>
					</div>
				</div>
			</footer>

			{/* COPYRIGHT */}
			<div className="text-center text-lg md:text-xl opacity-80 mt-8">
				Copyright @ {currentYear} English Empire Institute
			</div>
		</div>
	);
}

/* =========================================
   SUB-COMPONENTES CON TIPADO DE TYPESCRIPT
   ========================================= */

interface FooterLinkProps {
	href: string;
	children: React.ReactNode;
}

function FooterLink({ href, children }: FooterLinkProps) {
	return (
		<li>
			<Link
				href={href}
				className="text-xl md:text-2xl hover:underline hover:text-gray-300 transition-colors"
			>
				{children}
			</Link>
		</li>
	);
}

interface SocialIconProps {
	href: string;
	icon: StaticImageData;
	alt: string;
}

function SocialIcon({ href, icon, alt }: SocialIconProps) {
	return (
		<a
			target="_blank"
			rel="noreferrer"
			href={href}
			className="hover:scale-110 transition-transform block"
		>
			<Image src={icon} alt={alt} className="w-[30px] h-auto" />
		</a>
	);
}
