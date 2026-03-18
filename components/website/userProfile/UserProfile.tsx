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
	if (isLoading || user === null) {
		return (
			<div className="bg-white rounded-xl shadow-md p-6 md:p-8 border border-gray-100 animate-pulse">
				{/* Mobile: columna centrada — Desktop: fila */}
				<div className="flex flex-col items-center md:flex-row md:items-start md:space-x-6">
					<div className="flex-shrink-0 mb-4 md:mb-0">
						<div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gray-200 shadow-lg" />
					</div>

					<div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
						{[...Array(5)].map((_, i) => (
							<div key={i}>
								<div className="h-4 w-32 bg-gray-200 rounded mb-2" />
								<div className="h-6 w-48 bg-gray-300 rounded" />
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white rounded-xl shadow-md p-6 md:p-8 border border-gray-100">
			{/* Mobile: columna centrada — Desktop: fila */}
			<div className="flex flex-col items-center md:flex-row md:items-start md:space-x-6">
				{/* Avatar */}
				<div className="flex-shrink-0 mb-6 md:mb-0">
					<div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center shadow-lg">
						<User className="w-10 h-10 md:w-12 md:h-12 text-white" />
					</div>
				</div>

				{/* Datos */}
				<div className="flex-1 w-full grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-6">
					<div className="col-span-2 md:col-span-1">
						<p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
							Nombre completo
						</p>
						<p className="text-base md:text-lg font-semibold text-gray-900">
							{user.nombre} {user.apellido}
						</p>
					</div>

					<div>
						<p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
							DNI
						</p>
						<p className="text-base md:text-lg font-semibold text-gray-900">
							{user.dni}
						</p>
					</div>

					<div className="col-span-2 md:col-span-1">
						<p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
							Email
						</p>
						<p className="text-base md:text-lg font-semibold text-gray-900 break-all">
							{user.email}
						</p>
					</div>

					<div>
						<p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
							Teléfono
						</p>
						<p className="text-base md:text-lg font-semibold text-gray-900">
							{user.telefono}
						</p>
					</div>

					<div>
						<p className="text-xs md:text-sm font-medium text-gray-500 mb-1">
							Fecha de Nacimiento
						</p>
						<p className="text-base md:text-lg font-semibold text-gray-900">
							{user.fechaNacimiento.split("-").reverse().join("-")}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}

export default UserProfile;
