"use client";

import React from "react";
import UserProfile from "@/components/website/userProfile/UserProfile";
import CoursesList from "@/components/website/userProfile/CoursesList";
import StudentsList from "@/components/website/userProfile/StudentsList";

function UserDashboardPage() {
	return (
		<>
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

					<UserProfile />

					<CoursesList />

					<StudentsList />
				</div>
			</div>
		</>
	);
}

export default UserDashboardPage;
