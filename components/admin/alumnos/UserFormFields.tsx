"use client";

import React, { ChangeEvent } from "react";
import {
	User,
	Mail,
	Phone,
	CreditCard,
	Calendar,
	UserCheck,
} from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import {
	TitularForm,
	MenorForm,
	inputBase,
	FieldGroup,
	SectionDivider,
	ReadOnlyField,
	calcularEdad,
} from "./EditUserInfoModal.types";

// ─── Formulario Titular ───────────────────────────────────────────────────────

interface TitularFormFieldsProps {
	form: TitularForm;
	onChange: (e: ChangeEvent<HTMLInputElement>) => void;
	onPhoneChange: (value?: string) => void;
	isEmailEditable: boolean;
}

export function TitularFormFields({
	form,
	onChange,
	onPhoneChange,
	isEmailEditable,
}: TitularFormFieldsProps) {
	const edad = calcularEdad(form.fechaNacimiento);

	return (
		<>
			<SectionDivider label="Datos Personales" />

			<div className="grid grid-cols-2 gap-3">
				<FieldGroup label="Nombre" icon={User}>
					<input
						type="text"
						id="nombre"
						value={form.nombre}
						onChange={onChange}
						className={inputBase}
						placeholder="Nombre"
					/>
				</FieldGroup>
				<FieldGroup label="Apellido" icon={User}>
					<input
						type="text"
						id="apellido"
						value={form.apellido}
						onChange={onChange}
						className={inputBase}
						placeholder="Apellido"
					/>
				</FieldGroup>
			</div>

			<FieldGroup label="DNI" icon={CreditCard}>
				<input
					type="number"
					id="dni"
					value={form.dni}
					onChange={onChange}
					className={`${inputBase} font-mono`}
					placeholder="Número de documento"
				/>
			</FieldGroup>

			<div className="grid grid-cols-8 gap-3">
				<div className="col-span-5">
					<FieldGroup label="Fecha de Nacimiento" icon={Calendar}>
						<input
							type="date"
							id="fechaNacimiento"
							value={form.fechaNacimiento}
							onChange={onChange}
							className={`${inputBase} px-3`}
						/>
					</FieldGroup>
				</div>
				<div className="col-span-3 flex flex-col gap-1.5">
					<label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
						Edad
					</label>
					<div className="w-full h-11 px-2 flex items-center justify-center text-sm font-black bg-gray-100 text-gray-600 rounded-lg border border-gray-200 cursor-not-allowed">
						{edad !== "" ? `${edad} años` : "—"}
					</div>
				</div>
			</div>

			<SectionDivider label="Datos de Contacto" />

			{/* 🚀 LOGICA CONDICIONAL PARA EL EMAIL */}
			{isEmailEditable ? (
				<FieldGroup label="Email (Asignar credencial de acceso)" icon={Mail}>
					<input
						type="email"
						id="email"
						value={form.email}
						onChange={onChange}
						className={inputBase}
						placeholder="correo@ejemplo.com"
					/>
				</FieldGroup>
			) : (
				<ReadOnlyField
					icon={Mail}
					label="Email (credencial de acceso)"
					value={form.email || "—"}
				/>
			)}

			<FieldGroup label="Teléfono" icon={Phone}>
				<div className="w-full h-11 px-4 bg-gray-50 rounded-lg border border-gray-200 focus-within:border-[#252d62] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#252d62]/20 transition-all flex items-center">
					<PhoneInput
						placeholder="Ingresa el número"
						value={form.telefono}
						onChange={onPhoneChange}
						defaultCountry="AR"
						international
						className="w-full"
					/>
				</div>
			</FieldGroup>
		</>
	);
}

// ─── Formulario Menor ─────────────────────────────────────────────────────────

interface MenorFormFieldsProps {
	form: MenorForm;
	onChange: (e: ChangeEvent<HTMLInputElement>) => void;
	nombreTutor?: string;
}

export function MenorFormFields({
	form,
	onChange,
	nombreTutor,
}: MenorFormFieldsProps) {
	const edad = calcularEdad(form.fechaNacimiento);

	return (
		<>
			<SectionDivider label="Datos del Alumno Menor" />

			<ReadOnlyField
				icon={UserCheck}
				label="Tutor a cargo"
				value={nombreTutor || "—"}
			/>

			<div className="grid grid-cols-2 gap-3">
				<FieldGroup label="Nombre" icon={User}>
					<input
						type="text"
						id="nombre"
						value={form.nombre}
						onChange={onChange}
						className={inputBase}
						placeholder="Nombre"
					/>
				</FieldGroup>
				<FieldGroup label="Apellido" icon={User}>
					<input
						type="text"
						id="apellido"
						value={form.apellido}
						onChange={onChange}
						className={inputBase}
						placeholder="Apellido"
					/>
				</FieldGroup>
			</div>

			<FieldGroup label="DNI" icon={CreditCard}>
				<input
					type="number"
					id="dni"
					value={form.dni}
					onChange={onChange}
					className={`${inputBase} font-mono`}
					placeholder="Número de documento"
				/>
			</FieldGroup>

			<div className="grid grid-cols-8 gap-3">
				<div className="col-span-5">
					<FieldGroup label="Fecha de Nacimiento" icon={Calendar}>
						<input
							type="date"
							id="fechaNacimiento"
							value={form.fechaNacimiento}
							onChange={onChange}
							className={`${inputBase} px-3`}
						/>
					</FieldGroup>
				</div>
				<div className="col-span-3 flex flex-col gap-1.5">
					<label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
						Edad
					</label>
					<div className="w-full h-11 px-2 flex items-center justify-center text-sm font-black bg-gray-100 text-gray-600 rounded-lg border border-gray-200 cursor-not-allowed">
						{edad !== "" ? `${edad} años` : "—"}
					</div>
				</div>
			</div>
		</>
	);
}
