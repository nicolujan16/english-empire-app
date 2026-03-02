"use client";

import { useState, ChangeEvent, SyntheticEvent, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

// --- IMPORTACIONES DE FIREBASE ---
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

interface HijoForm {
	nombre: string;
	apellido: string;
	dni: string;
	fechaNacimiento: string;
}

interface RegisterForm {
	nombre: string;
	apellido: string;
	dni: string;
	fechaNacimiento: string;
	email: string;
	password: string;
	isTutor: boolean;
	hijos: HijoForm[];
	cursos: string[];
	telefono: string;
}

export default function RegisterPage() {
	const router = useRouter();
	const { user, register } = useAuth();

	useEffect(() => {
		if (user) {
			router.push("/mi-cuenta");
		}
	}, [router, user]);

	const [form, setForm] = useState<RegisterForm>({
		nombre: "",
		apellido: "",
		dni: "",
		fechaNacimiento: "",
		email: "",
		password: "",
		isTutor: false,
		hijos: [],
		cursos: [],
		telefono: "",
	});

	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [errorMsg, setErrorMsg] = useState<string>("");

	const calcularEdad = (fecha: string): number | string => {
		if (!fecha) return "";
		const birthDate = new Date(fecha);
		const today = new Date();
		let age = today.getFullYear() - birthDate.getFullYear();
		const monthDifference = today.getMonth() - birthDate.getMonth();
		if (
			monthDifference < 0 ||
			(monthDifference === 0 && today.getDate() < birthDate.getDate())
		) {
			age--;
		}
		return age;
	};

	const edadPadre = calcularEdad(form.fechaNacimiento);

	const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
		setForm({ ...form, [e.target.id]: e.target.value });
	};

	const handlePhoneChange = (value?: string) => {
		setForm({ ...form, telefono: value || "" });
	};

	const handleTutorToggle = (e: ChangeEvent<HTMLInputElement>) => {
		const checked = e.target.checked;
		setForm({
			...form,
			isTutor: checked,
			hijos: checked
				? [{ nombre: "", apellido: "", dni: "", fechaNacimiento: "" }]
				: [],
		});
	};

	const handleHijoChange = (
		index: number,
		field: keyof HijoForm,
		value: string,
	) => {
		const nuevosHijos = [...form.hijos];
		nuevosHijos[index] = { ...nuevosHijos[index], [field]: value };
		setForm({ ...form, hijos: nuevosHijos });
	};

	const agregarOtroHijo = () => {
		setForm({
			...form,
			hijos: [
				...form.hijos,
				{ nombre: "", apellido: "", dni: "", fechaNacimiento: "" },
			],
		});
	};

	const handleRegister = async (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsLoading(true);
		setErrorMsg("");

		if (typeof edadPadre === "number") {
			if (edadPadre < 18) {
				setErrorMsg("El titular de la cuenta debe ser mayor de 18 años.");
				setIsLoading(false);
				return;
			}
			if (edadPadre > 120) {
				setErrorMsg(
					"Edad del titular no válida. Verifica la fecha de nacimiento.",
				);
				setIsLoading(false);
				return;
			}
		}

		if (!form.telefono) {
			setErrorMsg("El número de teléfono es obligatorio.");
			setIsLoading(false);
			return;
		}

		if (form.password.length < 6) {
			setErrorMsg("La contraseña debe tener al menos 6 caracteres.");
			setIsLoading(false);
			return;
		}

		if (form.isTutor) {
			for (const hijo of form.hijos) {
				if (
					!hijo.nombre ||
					!hijo.apellido ||
					!hijo.dni ||
					!hijo.fechaNacimiento
				) {
					setErrorMsg(
						"Por favor, completa todos los datos de los alumnos a cargo.",
					);
					setIsLoading(false);
					return;
				}
			}
		}

		try {
			const usersRef = collection(db, "Users");
			const hijosRef = collection(db, "Hijos");

			const dniQuery = query(usersRef, where("dni", "==", form.dni));
			const dniSnapshot = await getDocs(dniQuery);

			const dniHijosQuery = query(hijosRef, where("dni", "==", form.dni));
			const dniHijosSnapshot = await getDocs(dniHijosQuery);

			if (!dniSnapshot.empty || !dniHijosSnapshot.empty) {
				setErrorMsg("Ya existe una cuenta registrada con el DNI del titular.");
				setIsLoading(false);
				return;
			}

			const phoneQuery = query(
				usersRef,
				where("telefono", "==", form.telefono),
			);
			const phoneSnapshot = await getDocs(phoneQuery);

			if (!phoneSnapshot.empty) {
				setErrorMsg("Este número de teléfono ya está asociado a otra cuenta.");
				setIsLoading(false);
				return;
			}

			if (form.isTutor && form.hijos.length > 0) {
				for (const hijo of form.hijos) {
					const hijoDniQuery = query(hijosRef, where("dni", "==", hijo.dni));
					const hijoDniSnapshot = await getDocs(hijoDniQuery);

					if (!hijoDniSnapshot.empty) {
						setErrorMsg(
							`El DNI ${hijo.dni} del alumno a cargo ya se encuentra registrado en el instituto.`,
						);
						setIsLoading(false);
						return;
					}

					if (hijo.dni === form.dni) {
						setErrorMsg(
							`El DNI del alumno a cargo no puede ser igual al del titular.`,
						);
						setIsLoading(false);
						return;
					}
				}
			}

			const userCredential = await register({
				email: form.email,
				pass: form.password,
				userData: {
					nombre: form.nombre,
					apellido: form.apellido,
					dni: form.dni,
					fechaNacimiento: form.fechaNacimiento,
					edadTitular: edadPadre,
					isTutor: form.isTutor,
					hijos: [], // ¡VACÍO!
					cursos: [],
					telefono: form.telefono,
				},
			});

			if (form.isTutor && form.hijos.length > 0) {
				const nuevoPadreUid = userCredential.user.uid;
				for (const hijo of form.hijos) {
					await addDoc(hijosRef, {
						tutorId: nuevoPadreUid,
						nombre: hijo.nombre,
						apellido: hijo.apellido,
						dni: hijo.dni,
						fechaNacimiento: hijo.fechaNacimiento,
						cursos: [], // Arranca sin cursos
					});
				}
			}

			router.push("/mi-cuenta");

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (error: any) {
			console.error("Error en registro:", error);
			if (error.code === "auth/email-already-in-use") {
				setErrorMsg("Este email ya está registrado. Intenta iniciar sesión.");
			} else {
				setErrorMsg(
					"Hubo un error al crear la cuenta. Verifica tus datos o tu conexión.",
				);
			}
		} finally {
			setIsLoading(false);
		}
	};

	const inputStyles =
		"w-full h-11 px-4 text-base text-gray-900 placeholder:text-gray-400 bg-[#f1f1f1] rounded-lg border border-transparent focus:border-[#1d2355] focus:bg-white focus:ring-2 focus:ring-[#1d2355]/20 outline-none transition-all";

	const phoneContainerStyles = `w-full h-11 px-4 text-base bg-[#f1f1f1] rounded-lg border border-transparent focus-within:border-[#1d2355] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#1d2355]/20 transition-all flex items-center phone-input-container`;

	return (
		<div className="flex flex-col gap-4">
			<style jsx global>{`
				.phone-input-container .PhoneInputInput {
					border: none;
					background: transparent;
					outline: none;
					color: #111827;
					font-size: 1rem;
				}
				.phone-input-container .PhoneInputCountry {
					margin-right: 0.75rem;
				}
			`}</style>

			<div className="text-center">
				<h1 className="text-2xl font-bold text-[#252d62] m-0">
					Crea tu cuenta
				</h1>
				<p className="text-gray-500 mt-1 text-base m-0">
					Únete a English Empire
				</p>
			</div>

			<form onSubmit={handleRegister} className="flex flex-col gap-3">
				{/* Tus datos (Titular) */}
				<div className="flex items-center gap-2 mb-1">
					<div className="h-px bg-gray-200 flex-grow"></div>
					<span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
						Tus Datos (Titular)
					</span>
					<div className="h-px bg-gray-200 flex-grow"></div>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<div className="flex flex-col gap-1">
						<label htmlFor="nombre" className="font-bold text-gray-700 text-sm">
							Nombre
						</label>
						<input
							type="text"
							id="nombre"
							required
							value={form.nombre}
							onChange={handleInputChange}
							className={inputStyles}
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label
							htmlFor="apellido"
							className="font-bold text-gray-700 text-sm"
						>
							Apellido
						</label>
						<input
							type="text"
							id="apellido"
							required
							value={form.apellido}
							onChange={handleInputChange}
							className={inputStyles}
						/>
					</div>
				</div>

				<div className="grid grid-cols-8 gap-3">
					<div className="col-span-4 flex flex-col gap-1">
						<label htmlFor="dni" className="font-bold text-gray-700 text-sm">
							DNI
						</label>
						<input
							type="number"
							id="dni"
							required
							value={form.dni}
							onChange={handleInputChange}
							className={`${inputStyles} px-3`}
						/>
					</div>

					<div className="col-span-4 flex flex-col gap-1">
						<label
							htmlFor="telefono"
							className="font-bold text-gray-700 text-sm"
						>
							Teléfono
						</label>
						<div className={phoneContainerStyles}>
							<PhoneInput
								id="telefono"
								placeholder="Ingresa tu número"
								value={form.telefono}
								onChange={handlePhoneChange}
								defaultCountry="AR"
								international
								className="w-full"
							/>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-8 gap-3">
					<div className="col-span-5 flex flex-col gap-1">
						<label
							htmlFor="fechaNacimiento"
							className="font-bold text-gray-700 text-sm"
						>
							Nacimiento
						</label>
						<input
							type="date"
							id="fechaNacimiento"
							required
							value={form.fechaNacimiento}
							onChange={handleInputChange}
							className={`${inputStyles} px-3`}
						/>
					</div>
					<div className="col-span-3 flex flex-col gap-1">
						<label htmlFor="edad" className="font-bold text-gray-700 text-sm">
							Edad
						</label>
						<input
							type="text"
							readOnly
							value={edadPadre !== "" ? `${edadPadre} años` : ""}
							placeholder="--"
							className="w-full h-11 px-2 text-center text-sm font-bold bg-gray-200 text-gray-700 rounded-lg border border-transparent outline-none cursor-not-allowed"
						/>
					</div>
				</div>

				{/* Sección Tutor */}
				<div className="mt-2 bg-[#f8f9fa] border border-gray-200 rounded-xl p-3 flex flex-col gap-3 transition-all">
					<label className="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							checked={form.isTutor}
							onChange={handleTutorToggle}
							className="w-5 h-5 text-[#EE1120] rounded border-gray-300 focus:ring-[#EE1120] cursor-pointer"
						/>
						<span className="font-bold text-[#252d62]">
							Soy tutor / Inscribo a un menor
						</span>
					</label>

					{form.isTutor &&
						form.hijos.map((hijo, index) => {
							const edadHijo = calcularEdad(hijo.fechaNacimiento);
							return (
								<div
									key={index}
									className="flex flex-col gap-3 pt-3 border-t border-gray-200 mt-1"
								>
									<p className="text-sm font-bold text-[#EE1120] m-0">
										Datos del Alumno{" "}
										{form.hijos.length > 1 ? `#${index + 1}` : ""}
									</p>
									<div className="grid grid-cols-2 gap-3">
										<input
											type="text"
											required
											value={hijo.nombre}
											onChange={(e) =>
												handleHijoChange(index, "nombre", e.target.value)
											}
											placeholder="Nombre del alumno"
											className={inputStyles}
										/>
										<input
											type="text"
											required
											value={hijo.apellido}
											onChange={(e) =>
												handleHijoChange(index, "apellido", e.target.value)
											}
											placeholder="Apellido del alumno"
											className={inputStyles}
										/>
									</div>
									<input
										type="number"
										required
										value={hijo.dni}
										onChange={(e) =>
											handleHijoChange(index, "dni", e.target.value)
										}
										placeholder="DNI"
										className={`col-span-4 ${inputStyles} px-3`}
									/>
									<div className="grid grid-cols-8 gap-3">
										<input
											type="date"
											required
											value={hijo.fechaNacimiento}
											onChange={(e) =>
												handleHijoChange(
													index,
													"fechaNacimiento",
													e.target.value,
												)
											}
											className={`col-span-5 ${inputStyles} px-3`}
										/>
										<input
											type="text"
											readOnly
											value={edadHijo !== "" ? `${edadHijo} años` : ""}
											placeholder="Edad"
											className="col-span-3 w-full h-11 px-2 text-center text-sm font-bold bg-gray-200 text-gray-700 rounded-lg border border-transparent outline-none cursor-not-allowed"
										/>
									</div>
								</div>
							);
						})}

					{form.isTutor && (
						<button
							type="button"
							onClick={agregarOtroHijo}
							className="text-sm font-bold text-[#252d62] hover:text-[#EE1120] self-start mt-1 transition-colors"
						>
							+ Agregar otro alumno
						</button>
					)}
				</div>

				{/* Datos de Acceso */}
				<div className="flex items-center gap-2 mt-1 mb-1">
					<div className="h-px bg-gray-200 flex-grow"></div>
					<span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
						Datos de Acceso
					</span>
					<div className="h-px bg-gray-200 flex-grow"></div>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="email" className="font-bold text-gray-700 text-sm">
						Email (Para iniciar sesión)
					</label>
					<input
						type="email"
						id="email"
						required
						value={form.email}
						onChange={handleInputChange}
						placeholder="tu@email.com"
						className={inputStyles}
					/>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="password" className="font-bold text-gray-700 text-sm">
						Contraseña
					</label>
					<input
						type="password"
						id="password"
						required
						minLength={6}
						value={form.password}
						onChange={handleInputChange}
						placeholder="Mínimo 6 caracteres"
						className={inputStyles}
					/>
				</div>

				{errorMsg && (
					<div className="bg-red-50 border border-red-200 text-red-600 p-2 rounded-lg text-sm text-center font-medium">
						{errorMsg}
					</div>
				)}

				<button
					type="submit"
					disabled={isLoading}
					className={`w-full bg-[#EE1120] text-white text-lg font-bold py-2 rounded-full shadow-lg mt-2 transition-all duration-300 ${isLoading ? "opacity-70 cursor-wait" : "hover:bg-[#b30000] hover:scale-105 active:scale-95"}`}
				>
					{isLoading ? "Verificando datos..." : "Registrarme"}
				</button>
			</form>

			<div className="w-full border-t border-gray-200 mt-1 pt-3">
				<p className="text-center text-sm text-gray-600 m-0">
					¿Ya tienes cuenta?{" "}
					<Link
						href="/iniciar-sesion"
						className="text-[#EE1120] font-bold hover:underline"
					>
						Ingresa aquí
					</Link>
				</p>
			</div>
		</div>
	);
}
