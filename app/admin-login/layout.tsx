import { AdminAuthProvider } from "@/context/AdminAuthContext";

export const metadata = {
	title: "Panel de Administración | English Empire",
	description:
		"Acceso exclusivo para administradores de English Empire Institute",
};

export default function AdminLoginLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
