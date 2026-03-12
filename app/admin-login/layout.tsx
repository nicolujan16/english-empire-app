import { AdminAuthProvider } from "@/context/AdminAuthContext";

export default function AdminLoginLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
