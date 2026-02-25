import { Metadata } from "next";

import Header from "@/components/website/common/Header";
import Footer from "@/components/website/common/Footer";

export const metadata: Metadata = {
	title: "English Empire Institute - Abriendo las puertas hacia el futuro",
	description:
		"English Empire Institute - Tu academia de inglés de confianza. Cursos de todos los niveles con profesores nativos.",
};

export default function PublicLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col min-h-screen">
			<Header />
			<main className="flex-grow bg-white pb-12">{children}</main>
			<Footer />
		</div>
	);
}
