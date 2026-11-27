"use client";

/**
 * Modal del calendario para una clase:
 * - Sin registro (o anulada): asignar quién la dio. Sirve para cargar una clase
 *   pasada que nadie fichó.
 * - Dada "en su turno" (secretaria que también es profesora y estaba en su turno, sin
 *   registro guardado): confirmar quién la dio o marcar que no la dio nadie.
 * - Ya registrada: cambiar quién la dio, marcar "contar igual" o anularla.
 * La puede haber dado una profesora o una secretaria: si no es titular de ese día, es
 * reemplazo (cobra el valor de la clase, y si era su turno ese tiempo no va a sus horas).
 * Siempre con motivo, que queda en el historial: "Motivo del registro manual" si se
 * carga una clase que dio su titular, "Motivo del cambio" si fue otra (reemplazo)
 * o si se edita una clase ya registrada.
 */
import React, { useState } from "react";
import { CalendarOff, Clock, GraduationCap, Repeat, UserPlus } from "lucide-react";
import {
	diaEspecialQueExcluye,
	type ClaseCalendario,
	type DiaEspecialCalendario,
} from "@/components/admin/asistencia-personal/CalendarioAsistencia";
import {
	Campo,
	CampoMotivo,
	Historial,
	Interruptor,
	ModalFormulario,
	inputClase,
	mensajeDeError,
} from "@/components/admin/asistencia-personal/carga/ui";
import { fechaLarga } from "@/lib/asistencia/fechas";
import { repositorioFirestore } from "@/lib/asistencia/repositorio";
import {
	nombreCompleto,
	type ClaseDictada,
	type Curso,
	type Persona,
} from "@/lib/asistencia/tipos";

export default function ModalClase({
	clase,
	dictada,
	personal,
	cursos,
	diasEspeciales,
	onCerrar,
}: {
	clase: ClaseCalendario;
	/** La ClaseDictada de Firestore, si existe (con historial) */
	dictada: ClaseDictada | undefined;
	personal: Persona[];
	cursos: Curso[];
	diasEspeciales: DiaEspecialCalendario[];
	onCerrar: () => void;
}) {
	// Si está anulada, se "asigna" de nuevo: crearClaseManual la reactiva con su historial
	const editar = !!dictada && dictada.estado === "Activa";
	// Sin registro guardado, pero cuenta como dada: era su turno de secretaria
	const enSuTurno = !dictada && clase.dictada?.enSuTurno === true ? clase.dictada : null;
	const curso = cursos.find((c) => c.id === clase.cursoId);
	// Las titulares de ese día según la asignación actual (lo guardado puede ser viejo)
	const titularIds = clase.titularIds;

	const [profesoraId, setProfesoraId] = useState(
		editar
			? dictada.profesoraDictoId
			: (enSuTurno?.profesoraId ?? clase.titularIds[0] ?? ""),
	);
	const [contarIgual, setContarIgual] = useState(dictada?.contarIgual ?? false);
	const [anular, setAnular] = useState(false);
	const [motivo, setMotivo] = useState("");
	const [guardando, setGuardando] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Puede darla cualquiera: profesoras (y secretarias que también lo son) o secretarias
	const activas = personal.filter((p) => p.activo);
	const esDocente = (p: Persona) => p.rol === "profesora" || p.tambienProfesora === true;
	const titulares = activas.filter((p) => titularIds.includes(p.id));
	const otras = activas.filter((p) => esDocente(p) && !titularIds.includes(p.id));
	const secretarias = activas.filter((p) => !esDocente(p) && !titularIds.includes(p.id));
	// Si la que la dio ya no está activa, igual tiene que aparecer en la lista
	const actualInactiva =
		editar && !activas.some((p) => p.id === dictada.profesoraDictoId)
			? personal.find((p) => p.id === dictada.profesoraDictoId)
			: undefined;
	const elegida = personal.find((p) => p.id === profesoraId);

	const seraReemplazo = !!profesoraId && !titularIds.includes(profesoraId);
	// Cargar a mano una clase que dio su titular (ej.: se olvidó el llavero) no es un
	// cambio de profesora: es un registro manual. Si la dio otra, sí es un cambio (reemplazo).
	const esRegistroManual = !editar && !anular && !seraReemplazo;
	const puedeAnular = editar || !!enSuTurno;
	const diaEspecial = diaEspecialQueExcluye(clase, diasEspeciales);
	const puedeGuardar = !!motivo.trim() && (anular || !!profesoraId);

	const guardar = async () => {
		const profesora = personal.find((p) => p.id === profesoraId);
		setGuardando(true);
		setError(null);
		try {
			if (editar && anular) {
				await repositorioFirestore.anularClase(dictada, motivo.trim());
			} else if (enSuTurno && anular) {
				const dio = personal.find((p) => p.id === enSuTurno.profesoraId);
				if (!curso || !dio)
					throw new Error("No se encontró el curso o la persona de esta clase.");
				await repositorioFirestore.anularClaseEnSuTurno({
					curso,
					fecha: clase.fecha,
					horaInicio: clase.horaInicio,
					horaFin: clase.horaFin,
					profesora: dio,
					motivo: motivo.trim(),
				});
			} else if (editar) {
				if (!profesora) throw new Error("Elegí quién dio la clase.");
				await repositorioFirestore.editarClase(
					dictada,
					{ profesora, contarIgual, titularIds },
					motivo.trim(),
				);
			} else {
				if (!profesora) throw new Error("Elegí quién dio la clase.");
				if (!curso)
					throw new Error(
						"No se encontró el curso de esta clase. Revisalo en Carga de datos.",
					);
				await repositorioFirestore.crearClaseManual({
					curso,
					fecha: clase.fecha,
					horaInicio: clase.horaInicio,
					horaFin: clase.horaFin,
					profesora,
					motivo: motivo.trim(),
				});
			}
			onCerrar();
		} catch (e) {
			setError(mensajeDeError(e));
		} finally {
			setGuardando(false);
		}
	};

	return (
		<ModalFormulario
			abierto
			onCerrar={onCerrar}
			titulo={editar ? "Editar clase" : "Registrar clase"}
			subtitulo={`${clase.cursoNombre} · ${fechaLarga(clase.fecha)}`}
			icono={editar ? GraduationCap : UserPlus}
			error={error}
			guardando={guardando}
			onGuardar={guardar}
			puedeGuardar={puedeGuardar}
			variante={anular ? "rojo" : "navy"}
			textoGuardar={
				anular ? "Anular clase" : editar ? "Guardar cambios" : "Registrar clase"
			}
		>
			<div className="flex flex-wrap items-center gap-2">
				<span className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
					<Clock className="w-3 h-3" /> {clase.horaInicio}–{clase.horaFin}
				</span>
				<span className="text-xs text-gray-500">
					Titular:{" "}
					{clase.titularNombres.length > 0
						? clase.titularNombres.join(", ")
						: "sin profesora asignada"}
				</span>
			</div>

			{!editar && (
				<p className="text-sm text-gray-600">
					{enSuTurno
						? `Cuenta como dada por ${enSuTurno.profesoraNombre}: estaba en su turno de secretaria a esa hora, y ese tiempo no se le paga como horas. Si la dio otra persona, elegila; si no la dio nadie, anulala.`
						: dictada
							? "Esta clase estaba anulada. Elegí quién la dio para volver a registrarla."
							: "Nadie registró esta clase. Elegí quién la dio y queda cargada como si hubiera fichado."}
				</p>
			)}

			{puedeAnular && (
				<Interruptor
					activo={anular}
					onChange={setAnular}
					label="Anular esta clase (no la dio nadie)"
				/>
			)}

			{!anular && (
				<>
					<Campo label="¿Quién dio la clase?">
						<select
							value={profesoraId}
							onChange={(e) => setProfesoraId(e.target.value)}
							className={inputClase}
							autoFocus
						>
							<option value="" disabled>
								Elegí quién la dio
							</option>
							{actualInactiva && (
								<option value={actualInactiva.id}>
									{nombreCompleto(actualInactiva)} (inactiva)
								</option>
							)}
							{titulares.length > 0 && (
								<optgroup label="Titulares del curso">
									{titulares.map((p) => (
										<option key={p.id} value={p.id}>
											{nombreCompleto(p)}
										</option>
									))}
								</optgroup>
							)}
							{otras.length > 0 && (
								<optgroup label="Otras profesoras (reemplazo)">
									{otras.map((p) => (
										<option key={p.id} value={p.id}>
											{nombreCompleto(p)}
										</option>
									))}
								</optgroup>
							)}
							{secretarias.length > 0 && (
								<optgroup label="Secretarias (reemplazo)">
									{secretarias.map((p) => (
										<option key={p.id} value={p.id}>
											{nombreCompleto(p)}
										</option>
									))}
								</optgroup>
							)}
						</select>
					</Campo>

					{seraReemplazo && (
						<div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 flex items-center gap-2">
							<Repeat className="w-4 h-4 shrink-0" />
							<span>
								No es titular de ese día: la clase queda como <strong>reemplazo</strong>.
								El valor de la clase se le descuenta a la titular y lo cobra quien la dio.
								{elegida?.rol === "secretaria" &&
									" Si fue durante su turno, ese tiempo no se le paga como horas de secretaria."}
							</span>
						</div>
					)}

					{diaEspecial && (
						<div className="p-3 bg-sky-50 border border-sky-100 rounded-xl text-xs text-sky-800 flex items-start gap-2">
							<CalendarOff className="w-4 h-4 shrink-0 text-sky-600" />
							<span>
								Cae en <strong>{diaEspecial.descripcion}</strong>: no cuenta para
								el recibo
								{editar
									? ", salvo que marques “Contar igual”."
									: ". Si querés que cuente, después editala y marcá “Contar igual”."}
							</span>
						</div>
					)}

					{editar && (
						<Interruptor
							activo={contarIgual}
							onChange={setContarIgual}
							label="Contar igual aunque caiga en un día especial"
						/>
					)}
				</>
			)}

			<CampoMotivo
				value={motivo}
				onChange={setMotivo}
				label={esRegistroManual ? "Motivo del registro manual" : "Motivo del cambio"}
				placeholder={
					anular
						? "Ej.: la clase se suspendió"
						: esRegistroManual
							? "Ej.: se olvidó el llavero"
							: seraReemplazo
								? "Ej.: reemplazó a la titular, que estaba enferma"
								: "Ej.: se cargó a la profesora equivocada"
				}
			/>

			{dictada && <Historial items={dictada.historial} />}
		</ModalFormulario>
	);
}
