import {
	collection,
	query,
	where,
	getDocs,
	addDoc,
	serverTimestamp,
	doc,
	updateDoc,
	getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { type Descuento } from "@/lib/cuotas";

// --- Interfaces Auxiliares ---
export interface CursoParaCuota {
	id: string;
	nombre: string;
	cuota1a10: number;
	cuota11enAdelante: number;
	finMes: number;
}

export interface AlumnoParaCuota {
	id: string;
	dni: string;
	nombre: string;
	apellido: string;
	tipo: "adulto" | "menor" | string;
	etiquetas?: string[];
}

const DESCUENTO_GRUPO_FAMILIAR: Descuento[] = [
	{
		porcentaje: 10,
		detalle: "Grupo Familiar",
	},
];

export const calcularMontoPrimerMes = (
	fecha: Date,
	cuota1a10: number,
): number => {
	return fecha.getDate() >= 15 ? cuota1a10 * 0.5 : cuota1a10;
};

// ─── 1. Crear Primera Cuota (y mes siguiente si aplica) ───────────────

export const crearPrimeraCuota = async (
	inscripcionId: string,
	alumno: AlumnoParaCuota,
	curso: CursoParaCuota,
	descuentosBase: Descuento[],
) => {
	const cuotasRef = collection(db, "Cuotas");

	// Evitar duplicados
	const qExistente = query(
		cuotasRef,
		where("inscripcionId", "==", inscripcionId),
		where("esPrimerMes", "==", true),
	);
	const snap = await getDocs(qExistente);
	if (!snap.empty) return;

	const hoy = new Date();
	const montoPrimerMes = calcularMontoPrimerMes(hoy, curso.cuota1a10);

	const alumnoTipoNormalizado =
		alumno.tipo.toLowerCase() === "titular" ||
		alumno.tipo.toLowerCase() === "adulto"
			? "adulto"
			: "menor";

	// 🚀 LÓGICA DE ETIQUETAS: Buscar descuento para CUOTAS
	const descuentosFinales = [...descuentosBase];

	if (alumno.etiquetas && alumno.etiquetas.length > 0) {
		try {
			const promesasEtiquetas = alumno.etiquetas
				.map((item: string) => {
					if (typeof item === "string")
						return getDoc(doc(db, "EtiquetasDescuento", item.trim()));
					return null;
				})
				.filter(Boolean);

			const snapsEtiquetas = await Promise.all(promesasEtiquetas);

			let maxDescCuota = 0;
			let nombreMejorEtiqueta = "";

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			snapsEtiquetas.forEach((snapE: any) => {
				if (snapE && snapE.exists()) {
					const dataE = snapE.data();
					const descCuota = Number(dataE.descuentoCuota) || 0;

					if (descCuota > maxDescCuota) {
						maxDescCuota = descCuota;
						nombreMejorEtiqueta = dataE.nombre || "Etiqueta Especial";
					}
				}
			});

			// Si encontramos un descuento en cuota mayor a 0, lo pusheamos al array con toda su info
			if (maxDescCuota > 0) {
				descuentosFinales.push({
					porcentaje: maxDescCuota,
					detalle: `${nombreMejorEtiqueta}`,
				});
			}
		} catch (error) {
			console.error("Error al procesar etiquetas en cuotasService:", error);
		}
	}

	const datosComunesAlumno = {
		inscripcionId,
		alumnoId: alumno.id,
		alumnoTipo: alumnoTipoNormalizado,
		alumnoNombre: `${alumno.nombre} ${alumno.apellido}`.trim(),
		alumnoDni: alumno.dni,
		cursoId: curso.id,
		cursoNombre: curso.nombre,
		cuota1a10: curso.cuota1a10,
		cuota11enAdelante: curso.cuota11enAdelante,
		estado: "Pendiente",
		fechaPago: null,
		montoPagado: null,
		metodoPago: null,
		descuentos: descuentosFinales,
	};

	// Cuota Mes Actual
	await addDoc(cuotasRef, {
		...datosComunesAlumno,
		mes: hoy.getMonth() + 1,
		anio: hoy.getFullYear(),
		esPrimerMes: true,
		montoPrimerMes,
		creadoEn: serverTimestamp(),
		actualizadoEn: serverTimestamp(),
	});

	// Cuota Mes Siguiente (Si pasó el día 20)
	if (hoy.getDate() >= 20) {
		const fechaSiguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
		const mesSiguiente = fechaSiguiente.getMonth() + 1;
		const anioSiguiente = fechaSiguiente.getFullYear();

		const qSiguiente = query(
			cuotasRef,
			where("inscripcionId", "==", inscripcionId),
			where("mes", "==", mesSiguiente),
			where("anio", "==", anioSiguiente),
		);
		const snapSiguiente = await getDocs(qSiguiente);
		if (!snapSiguiente.empty) return;

		if (mesSiguiente <= curso.finMes) {
			await addDoc(cuotasRef, {
				...datosComunesAlumno,
				mes: mesSiguiente,
				anio: anioSiguiente,
				esPrimerMes: false,
				montoPrimerMes: null,
				creadoEn: serverTimestamp(),
				actualizadoEn: serverTimestamp(),
			});
		}
	}
};

// ─── 2. Aplicar Descuento al Grupo Familiar ───────────────────────────

export const aplicarDescuentoAlGrupo = async (
	alumnoId: string,
	alumnoTipo: "adulto" | "menor" | string,
	tutorIdDelGrupo: string,
	aplicarMesActual: boolean = true,
) => {
	const hoy = new Date();
	const mesActual = hoy.getMonth() + 1;
	const anioActual = hoy.getFullYear();
	const mesSig = hoy.getMonth() + 2 > 12 ? 1 : hoy.getMonth() + 2;
	const anioSig =
		hoy.getMonth() + 2 > 12 ? hoy.getFullYear() + 1 : hoy.getFullYear();

	const mesesAProcesar = [
		{ mes: mesSig, anio: anioSig },
		...(aplicarMesActual ? [{ mes: mesActual, anio: anioActual }] : []),
	];

	const alumnoIdsGrupo: string[] = [];
	const esMenor = alumnoTipo.toLowerCase() === "menor";

	if (!esMenor) {
		// Titular: buscar hijos con cursos activos
		const snap = await getDocs(
			query(collection(db, "Hijos"), where("tutorId", "==", alumnoId)),
		);
		for (const h of snap.docs) {
			if ((h.data().cursos ?? []).length > 0) alumnoIdsGrupo.push(h.id);
		}
	} else {
		// Menor: buscar al titular + hermanos
		const tutorSnap = await getDoc(doc(db, "Users", tutorIdDelGrupo));
		if (tutorSnap.exists() && (tutorSnap.data().cursos ?? []).length > 0) {
			alumnoIdsGrupo.push(tutorIdDelGrupo);
		}
		const hSnap = await getDocs(
			query(collection(db, "Hijos"), where("tutorId", "==", tutorIdDelGrupo)),
		);
		for (const h of hSnap.docs) {
			if (h.id !== alumnoId && (h.data().cursos ?? []).length > 0) {
				alumnoIdsGrupo.push(h.id);
			}
		}
	}

	// Actualizar las cuotas de todo el grupo
	for (const idMiembro of alumnoIdsGrupo) {
		for (const { mes, anio } of mesesAProcesar) {
			const cuotasSnap = await getDocs(
				query(
					collection(db, "Cuotas"),
					where("alumnoId", "==", idMiembro),
					where("mes", "==", mes),
					where("anio", "==", anio),
					where("estado", "==", "Pendiente"),
				),
			);

			for (const cuotaDoc of cuotasSnap.docs) {
				const descActuales: Descuento[] = cuotaDoc.data().descuentos ?? [];
				if (descActuales.some((d) => d.detalle === "Grupo Familiar")) continue;

				await updateDoc(doc(db, "Cuotas", cuotaDoc.id), {
					descuentos: [...descActuales, ...DESCUENTO_GRUPO_FAMILIAR],
					actualizadoEn: serverTimestamp(),
				});
			}
		}
	}
};
