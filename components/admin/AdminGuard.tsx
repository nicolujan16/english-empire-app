"use client";

import { useAdminAuth } from "@/context/AdminAuthContext";
import { useRouter } from "next/navigation";
import { useEffect, ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface AdminGuardProps {
	children: ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
	// Ahora usamos el contexto específico de Admin
	const { adminUser, adminData, isLoading } = useAdminAuth();
	const router = useRouter();

	useEffect(() => {
		if (!isLoading && (!adminUser || !adminData)) {
			console.log("⛔ Acceso denegado a zona admin. Redirigiendo al login...");
			router.replace("/admin-login");
		}
	}, [adminUser, adminData, isLoading, router]);

	if (isLoading) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
				<Loader2 className="w-12 h-12 animate-spin text-[#EE1120]" />
				<p className="text-xl font-medium text-[#2a2e5b]">
					Verificando credenciales de seguridad...
				</p>
			</div>
		);
	}

	// Si pasa, mostramos el panel
	if (adminUser && adminData) {
		return <>{children}</>;
	}

	return null;
}
