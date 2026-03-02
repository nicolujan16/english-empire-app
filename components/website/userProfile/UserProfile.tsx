import React from "react";
import { User } from "lucide-react";

function UserProfile({
	isLoading = false,
	user = null,
}: {
	isLoading?: boolean;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	user: any | null;
}) {
	// // Sample user data
	// const user = {
	// 	nombre: "María",
	// 	apellido: "González Pérez",
	// 	dni: "45678912",
	// 	email: "maria.gonzalez@email.com",
	// 	phone: "+34 612 345 678",
	// 	fechaRegistro: "15 de Enero, 2024",
	// };

	// Si estamos cargando o no tenemos datos de usuario, mostramos un skeleton
	if (isLoading || user === null) {
		return (
			<div className="bg-white rounded-xl shadow-md p-8 border border-gray-100 animate-pulse">
				<div className="flex items-start space-x-6">
					<div className="flex-shrink-0">
						<div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center shadow-lg">
							<div className="w-12 h-12 bg-gray-300 rounded-full" />
						</div>
					</div>

					<div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
						{/* Nombre */}
						<div>
							<div className="h-4 w-32 bg-gray-200 rounded mb-2" />
							<div className="h-6 w-48 bg-gray-300 rounded" />
						</div>

						{/* DNI */}
						<div>
							<div className="h-4 w-16 bg-gray-200 rounded mb-2" />
							<div className="h-6 w-32 bg-gray-300 rounded" />
						</div>

						{/* Email */}
						<div>
							<div className="h-4 w-20 bg-gray-200 rounded mb-2" />
							<div className="h-6 w-56 bg-gray-300 rounded" />
						</div>

						{/* Teléfono */}
						<div>
							<div className="h-4 w-24 bg-gray-200 rounded mb-2" />
							<div className="h-6 w-40 bg-gray-300 rounded" />
						</div>

						{/* Fecha */}
						<div>
							<div className="h-4 w-36 bg-gray-200 rounded mb-2" />
							<div className="h-6 w-32 bg-gray-300 rounded" />
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Si tenemos los datos del usuario, los mostramos
	return (
		<div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
			<div className="flex items-start space-x-6">
				<div className="flex-shrink-0">
					<div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center shadow-lg">
						{isLoading ? (
							<div className="w-12 h-12 bg-gray-300 rounded-full animate-pulse" />
						) : (
							<User className="w-12 h-12 text-white" />
						)}
					</div>
				</div>

				<div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<p className="text-sm font-medium text-gray-500 mb-1">
							Nombre completo
						</p>
						<p className="text-lg font-semibold text-gray-900">
							{user.nombre} {user.apellido}
						</p>
					</div>

					<div>
						<p className="text-sm font-medium text-gray-500 mb-1">DNI</p>
						<p className="text-lg font-semibold text-gray-900">{user.dni}</p>
					</div>

					<div>
						<p className="text-sm font-medium text-gray-500 mb-1">Email</p>
						<p className="text-lg font-semibold text-gray-900">{user.email}</p>
					</div>

					<div>
						<p className="text-sm font-medium text-gray-500 mb-1">Teléfono</p>
						<p className="text-lg font-semibold text-gray-900">
							{user.telefono}
						</p>
					</div>

					<div>
						<p className="text-sm font-medium text-gray-500 mb-1">
							Fecha de Nacimiento
						</p>
						<p className="text-lg font-semibold text-gray-900">
							{/* Pasamos de formato "YYYY-MM-DD" a "DD-MM-YYYY" */}
							{user.fechaNacimiento.split("-").reverse().join("-")}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}

export default UserProfile;
