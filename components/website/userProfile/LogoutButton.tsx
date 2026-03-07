"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { LogOut } from "lucide-react"; // Un ícono lindo para el botón

export default function LogoutButton() {
	const { logout } = useAuth();
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);
	const [isLoggingOut, setIsLoggingOut] = useState(false);

	const handleLogout = async () => {
		setIsLoggingOut(true);
		try {
			await logout(); // Limpiamos el AuthContext y Firebase
			setIsOpen(false);
			router.push("/"); // Lo pateamos al login
		} catch (error) {
			console.error("Error al cerrar sesión:", error);
			setIsLoggingOut(false);
		}
	};

	return (
		<>
			{/* El botón que se muestra en tu UI */}
			<Button
				variant="outline"
				onClick={() => setIsOpen(true)}
				className="flex items-center gap-2 text-gray-700 hover:text-[#EE1120] hover:bg-red-50 border-gray-200 transition-colors cursor-pointer"
			>
				<LogOut className="w-4 h-4" />
				Cerrar Sesión
			</Button>

			{/* El Modal de Confirmación */}
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className="sm:max-w-[400px] rounded-sm">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-[#252d62]">
							¿Cerrar sesión?
						</DialogTitle>
						<DialogDescription className="text-gray-500 mt-2">
							Estás a punto de salir de tu panel de English Empire. Tendrás que
							volver a ingresar tu email y contraseña para entrar.
						</DialogDescription>
					</DialogHeader>

					<DialogFooter className="mt-6 flex gap-2 sm:justify-end">
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsOpen(false)}
							disabled={isLoggingOut}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={handleLogout}
							disabled={isLoggingOut}
							className="bg-[#EE1120] hover:bg-[#c4000e] text-white"
						>
							{isLoggingOut ? "Saliendo..." : "Sí, salir"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
