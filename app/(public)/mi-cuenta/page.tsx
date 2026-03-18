"use client";

import React, { useEffect } from "react";
import UserProfile from "@/components/website/userProfile/UserProfile";
import CoursesList from "@/components/website/userProfile/CoursesList";
import StudentsList from "@/components/website/userProfile/StudentsList";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import LogoutButton from "@/components/website/userProfile/LogoutButton";
import { StudentDetails } from "@/types";

function UserDashboardPage() {
	const router = useRouter();
	const { user, userData, isLoading } = useAuth();

	useEffect(() => {
		if (!isLoading && user === null) {
			router.push("/iniciar-sesion");
		}
	}, [user, router, isLoading]);

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

	const numHijos = userData?.hijos?.length || 0;
	const numCursos = userData?.cursos?.length || 0;
	const showHijosFirst = numHijos > numCursos;

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8">
			<div className="max-w-7xl mx-auto px-6 space-y-8">
				{/* Header */}
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
					<div>
						<h1 className="text-4xl font-bold text-[#1a237e] mb-2">
							Panel de Usuario
						</h1>
						<p className="text-gray-600">
							Gestiona tu perfil, cursos y alumnos
						</p>
					</div>
					<div className="flex items-center gap-4">
						<Button
							variant="outline"
							onClick={() => router.push("/mi-cuenta/editar")}
							className="cursor-pointer"
						>
							Editar perfil
						</Button>
						<LogoutButton />
					</div>
				</div>

				{/* Perfil */}
				<UserProfile isLoading={isLoading} user={userData} />

				{/* Acceso rápido a Cuotas — solo si el usuario o algún hijo tiene cursos */}
				{((userData?.cursos && userData.cursos.length > 0) ||
					(userData?.hijos as StudentDetails[])?.some(
						(h) => h.cursos && h.cursos.length > 0,
					)) && (
					<div className="bg-white rounded-xl shadow-md border border-gray-100 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
						<div>
							<h3 className="text-lg font-bold text-[#252d62]">
								Historial de pagos
							</h3>
							<p className="text-sm text-gray-500">
								Consultá el historial de inscripciones y cuotas de todos los
								alumnos a tu cargo.
							</p>
						</div>
						<Button
							onClick={() => router.push("/mi-cuenta/pagos")}
							className="bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold px-6 whitespace-nowrap cursor-pointer w-full sm:w-auto"
						>
							Ver Mis Pagos
						</Button>
					</div>
				)}

				{userData && (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
						{showHijosFirst ? (
							<>
								<StudentsList students={userData?.hijos as StudentDetails[]} />
								<CoursesList
									cursos={userData.cursos as string[]}
									cuotasPagadas={userData.cuotasPagadas}
									hijos={userData.hijos as StudentDetails[]}
									parentId={user.uid}
								/>
							</>
						) : (
							<>
								<CoursesList
									cursos={userData.cursos as string[]}
									cuotasPagadas={userData.cuotasPagadas}
									hijos={userData.hijos as StudentDetails[]}
									parentId={user.uid}
								/>
								<StudentsList students={userData?.hijos as StudentDetails[]} />
							</>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

export default UserDashboardPage;
