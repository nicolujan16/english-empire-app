import "./globals.css";

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="es">
			<body className="antialiased text-gray-900 bg-gray-50">{children}</body>
		</html>
	);
}
