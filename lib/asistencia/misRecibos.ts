"use client";

/**
 * Recibos de sueldo de la persona logueada ("Mis recibos").
 *
 * Se leen de `RecibosPersonalPublicados`: un resumen (período, número, fecha, nombre
 * y total) que se publica al guardar la imagen del recibo. No tiene el detalle del
 * cálculo (porcentajes, monto fijo), que queda solo para el director en RecibosPersonal.
 *
 * - Profesoras (portal docente): los recibos con `personalId == su uid`.
 * - Secretarias (panel de admin): también por `personalId == su uid`, porque su doc
 *   de `Personal` tiene el mismo id que su cuenta del panel (`Admins`).
 *   (El filtro por email queda para recibos de secretarias cargadas antes con otro id.)
 *
 * Las reglas de Firestore solo dejan leer los propios (ver puedeVerRecibo).
 */
import { useEffect, useState } from "react";
import {
	collection,
	onSnapshot,
	query,
	where,
	type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { COL } from "./repositorio";
import type { ReciboPublicado } from "./tipos";

export type FiltroMisRecibos =
	| { por: "personalId"; valor: string }
	| { por: "email"; valor: string };

const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const aReciboPublicado = (id: string, d: DocumentData): ReciboPublicado => ({
	id,
	personalId: String(d.personalId ?? ""),
	periodo: String(d.periodo ?? ""),
	numeroTexto: typeof d.numeroTexto === "string" ? d.numeroTexto : null,
	fechaEmision: typeof d.fechaEmision === "string" ? d.fechaEmision : null,
	nombreRecibo: String(d.nombreRecibo ?? ""),
	total: numero(d.total),
	version: numero(d.version),
});

export function suscribirMisRecibos(
	filtro: FiltroMisRecibos,
	cb: (recibos: ReciboPublicado[]) => void,
	onError: (e: Error) => void,
): () => void {
	const valor = filtro.por === "email" ? filtro.valor.trim().toLowerCase() : filtro.valor;
	return onSnapshot(
		query(collection(db, COL.recibosPublicados), where(filtro.por, "==", valor)),
		(snap) =>
			cb(
				snap.docs
					.map((d) => aReciboPublicado(d.id, d.data()))
					.sort((a, b) => b.periodo.localeCompare(a.periodo)),
			),
		onError,
	);
}

export function useMisRecibos(filtro: FiltroMisRecibos | null) {
	const [estado, setEstado] = useState<{
		clave: string;
		recibos: ReciboPublicado[] | null;
		error: string | null;
	}>({ clave: "", recibos: null, error: null });

	const clave = filtro ? `${filtro.por}:${filtro.valor}` : "";

	useEffect(() => {
		if (!filtro) return;
		return suscribirMisRecibos(
			filtro,
			(recibos) => setEstado({ clave, recibos, error: null }),
			(e) =>
				setEstado({
					clave,
					recibos: [],
					error:
						"code" in e && e.code === "permission-denied"
							? "No tenés permiso para ver estos recibos."
							: "No se pudieron cargar tus recibos. Probá de nuevo más tarde.",
				}),
		);
		// `clave` resume el filtro: no hace falta volver a suscribirse si no cambió
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [clave]);

	const vigente = estado.clave === clave;
	return {
		recibos: vigente ? estado.recibos : null,
		error: vigente ? estado.error : null,
		cargando: !!filtro && (!vigente || estado.recibos === null),
	};
}
