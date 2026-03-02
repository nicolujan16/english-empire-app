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
				<AuthProvider>{children}</AuthProvider>
			</body>
		</html>
	);
}
