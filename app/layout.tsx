import ScrollToTop from "@/components/website/common/ScrollToTop";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="es">
			<body className="antialiased text-gray-900 bg-gray-50">
				<ScrollToTop />
				<AuthProvider>{children}</AuthProvider>
			</body>
		</html>
	);
}
