"use client";

import React, { useEffect } from "react";
import UserProfile from "@/components/website/userProfile/UserProfile";
import CoursesList from "@/components/website/userProfile/CoursesList";
import StudentsList from "@/components/website/userProfile/StudentsList";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/website/ui/button";
import LogoutButton from "@/components/website/userProfile/LogoutButton";
import { StudentDetails } from "@/types";

function UserDashboardPage() {
	const router = useRouter();
	const { user, userData, isLoading } = useAuth();

	// Si no esta logueado, redirigir a /login
	useEffect(() => {
		if (!isLoading && user === null) {
			router.push("/iniciar-sesion");
		}
	}, [user, router, isLoading]);

	// Si esta cargando, retornamos el esqueleto de la pagina
	if (isLoading || user === null) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8">
				<div className="max-w-7xl mx-auto px-6 space-y-8">
					<div>
						<h1 className="text-4xl font-bold text-[#1a237e] mb-2">
							Panel de Usuario
						</h1>
						<p className="text-gray-600">
							Gestiona tu perfil, cursos y alumnos
						</p>
					</div>

					<UserProfile user={userData} isLoading={isLoading} />
				</div>
			</div>
		);
	}

	return (
		<>
			<div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8">
				<div className="max-w-7xl mx-auto px-6 space-y-8">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
						{/* Título */}
						<div>
							<h1 className="text-4xl font-bold text-[#1a237e] mb-2">
								Panel de Usuario
							</h1>
							<p className="text-gray-600">
								Gestiona tu perfil, cursos y alumnos
							</p>
						</div>

						{/* Botones */}
						<div className="flex items-center gap-4">
							{/* Editar Perfil Btn*/}
							<Button
								variant="outline"
								onClick={() => router.push("/mi-cuenta/editar")}
								className="cursor-pointer"
							>
								Editar perfil
							</Button>

							{/* Cerrar sesión Btn*/}
							<LogoutButton />
						</div>
					</div>
					<UserProfile isLoading={isLoading} user={userData} />

					{userData && <CoursesList cursos={userData.cursos} />}

					{userData && (
						<StudentsList students={userData.hijos as StudentDetails[]} />
					)}
				</div>
			</div>
		</>
	);
}

export default UserDashboardPage;
