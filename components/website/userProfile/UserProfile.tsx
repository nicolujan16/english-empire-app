import React from "react";
import { User } from "lucide-react";

function UserProfile() {
	// Sample user data
	const user = {
		name: "María",
		surname: "González Pérez",
		dni: "45678912",
		email: "maria.gonzalez@email.com",
		phone: "+34 612 345 678",
		joinDate: "15 de Enero, 2024",
	};

	return (
		<div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
			<div className="flex items-start space-x-6">
				<div className="flex-shrink-0">
					<div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center shadow-lg">
						<User className="w-12 h-12 text-white" />
					</div>
				</div>

				<div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<p className="text-sm font-medium text-gray-500 mb-1">
							Nombre completo
						</p>
						<p className="text-lg font-semibold text-gray-900">
							{user.name} {user.surname}
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
						<p className="text-lg font-semibold text-gray-900">{user.phone}</p>
					</div>

					<div>
						<p className="text-sm font-medium text-gray-500 mb-1">
							Fecha de ingreso
						</p>
						<p className="text-lg font-semibold text-gray-900">
							{user.joinDate}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}

export default UserProfile;
