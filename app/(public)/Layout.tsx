import { Metadata } from "next";
// import Header from "@/components/website/common/Header"; // Ajusta tus rutas si es necesario
// import Footer from "@/components/website/common/Footer";

// ¡El reemplazo perfecto para react-helmet!
export const metadata: Metadata = {
	title: "English Empire Institute - Academia de Inglés",
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
			{/* <Header /> */}

			{/* El children es tu page.tsx. Le ponemos flex-grow para empujar el footer abajo */}
			<main className="flex-grow bg-white">{children}</main>

			{/* <Footer /> */}
		</div>
	);
}
