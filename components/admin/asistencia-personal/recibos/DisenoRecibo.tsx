/**
 * El recibo impreso, igual a la plantilla de Juan. Hoja A4 a 595 × 842 px.
 * Se usa para generar la imagen que se guarda (capturarRecibo) y para la vista previa.
 * Usa estilos fijos (no depende del tema del panel) para que la imagen salga siempre igual.
 */
import React from "react";
import { montoEnLetras } from "@/lib/asistencia/numeroALetras";
import {
	dniConPuntos,
	fechaRecibo,
	numeroRecibo,
	periodoRecibo,
	type DatosReciboImpreso,
} from "@/lib/asistencia/reciboImpreso";
import { fuenteRecibo, fuenteTitulo } from "./fuentesRecibo";

const NAVY = "#1f2858";
const PIE = "#575b87";
const PIE_CRUCE = "#3e4270";
const ONDA_IZQUIERDA = "M0 62 C 70 66 150 100 205 160 L 0 160 Z";
const ONDA_DERECHA = "M140 160 C 250 70 420 18 595 10 L 595 160 Z";

export const ANCHO_RECIBO = 595;
export const ALTO_RECIBO = 842;

const th: React.CSSProperties = {
	fontWeight: 700,
	fontSize: 16.5,
	color: NAVY,
	padding: "0 0 9px",
	lineHeight: 1.1,
};

const td: React.CSSProperties = {
	fontSize: 13,
	color: "#1f2937",
	padding: "12px 0 10px",
	borderBottom: `1.5px solid ${NAVY}`,
};

export default function DisenoRecibo({ datos }: { datos: DatosReciboImpreso }) {
	return (
		<div
			className={fuenteRecibo.className}
			style={{
				width: ANCHO_RECIBO,
				minHeight: ALTO_RECIBO,
				background: "#ffffff",
				color: "#1f2937",
				display: "flex",
				flexDirection: "column",
				position: "relative",
				overflow: "hidden",
				boxSizing: "border-box",
			}}
		>
			<div style={{ padding: "18px 58px 0" }}>
				{/* Encabezado */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src="/logo-empire.png"
						alt="English Empire Institute"
						width={266}
						height={133}
						style={{ width: 266, height: 133, marginLeft: -22 }}
					/>
					<p
						className={fuenteTitulo.className}
						style={{
							fontSize: 40,
							letterSpacing: "0.07em",
							color: NAVY,
							margin: 0,
						}}
					>
						RECIBO
					</p>
				</div>
				<div style={{ height: 4, background: NAVY, marginTop: 4 }} />

				{/* Datos */}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "flex-start",
						marginTop: 26,
						gap: 16,
					}}
				>
					<div>
						<p style={{ fontWeight: 700, fontSize: 18, color: NAVY, margin: 0 }}>
							Datos
						</p>
						<p
							style={{
								fontStyle: "italic",
								fontSize: 14,
								margin: "6px 0 0",
								color: "#374151",
							}}
						>
							{datos.nombreRecibo}
						</p>
						{datos.dni && (
							<p style={{ fontSize: 14, margin: "4px 0 0", color: "#374151" }}>
								{dniConPuntos(datos.dni)}
							</p>
						)}
					</div>
					<div
						style={{
							textAlign: "right",
							fontSize: 14,
							fontWeight: 700,
							color: NAVY,
							lineHeight: 1.6,
							textTransform: "uppercase",
						}}
					>
						<p style={{ margin: 0 }}>
							RECIBO N° {datos.numeroTexto ?? "—"}
						</p>
						<p style={{ margin: 0 }}>{fechaRecibo(datos.fechaEmision)}</p>
						<p style={{ margin: 0, fontSize: 12, color: NAVY }}>
							PERÍODO: {periodoRecibo(datos.periodo)}
						</p>
					</div>
				</div>

				{/* Detalle */}
				<table
					style={{
						width: "100%",
						borderCollapse: "collapse",
						marginTop: 30,
						tableLayout: "fixed",
					}}
				>
					<colgroup>
						<col style={{ width: "40%" }} />
						<col style={{ width: "19%" }} />
						<col style={{ width: "20%" }} />
						<col style={{ width: "21%" }} />
					</colgroup>
					<thead>
						<tr style={{ borderBottom: `1.5px solid ${NAVY}` }}>
							<th style={{ ...th, textAlign: "left", fontSize: 18 }}>Concepto</th>
							<th style={{ ...th, textAlign: "center" }}>Cantidad</th>
							<th style={{ ...th, textAlign: "center" }}>Precio</th>
							<th style={{ ...th, textAlign: "center" }}>Total</th>
						</tr>
					</thead>
					<tbody>
						{datos.lineas.map((l, i) => (
							<tr key={i}>
								<td style={{ ...td, paddingRight: 8 }}>{l.concepto}</td>
								<td style={{ ...td, textAlign: "center" }}>{l.cantidad}</td>
								<td style={{ ...td, textAlign: "center" }}>
									{numeroRecibo(l.precio)}
								</td>
								<td style={{ ...td, textAlign: "center" }}>
									{l.total < 0 ? "- " : ""}$ {numeroRecibo(Math.abs(l.total))}
								</td>
							</tr>
						))}
					</tbody>
				</table>

				{/* Total */}
				<div
					style={{ display: "flex", justifyContent: "flex-end", marginTop: 26 }}
				>
					<div
						style={{
							width: 236,
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							borderTop: `1.5px solid ${NAVY}`,
							borderBottom: `1.5px solid ${NAVY}`,
							padding: "10px 4px 8px 10px",
							fontWeight: 800,
							fontSize: 15,
							color: NAVY,
						}}
					>
						<span>TOTAL</span>
						<span>$ {numeroRecibo(datos.total)}</span>
					</div>
				</div>

				{/* Monto en letras */}
				<div style={{ width: 280, marginTop: 16 }}>
					<p
						style={{
							margin: 0,
							fontWeight: 700,
							fontSize: 11,
							lineHeight: 1.35,
							textAlign: "center",
							color: "#111827",
							paddingBottom: 3,
							borderBottom: "1px solid #111827",
						}}
					>
						{montoEnLetras(datos.total)}
					</p>
				</div>
			</div>

			{/* Pie con la onda */}
			<div style={{ flex: 1, minHeight: 40 }} />
			<div style={{ position: "relative", height: 160 }}>
				<svg
					viewBox="0 0 595 160"
					width={ANCHO_RECIBO}
					height={160}
					style={{ position: "absolute", inset: 0, display: "block" }}
					aria-hidden
				>
					<defs>
						<clipPath id="recibo-onda-derecha">
							<path d={ONDA_DERECHA} />
						</clipPath>
					</defs>
					<path d={ONDA_IZQUIERDA} fill={PIE} />
					<path d={ONDA_DERECHA} fill={PIE} />
					{/* Donde se cruzan las dos ondas queda más oscuro */}
					<path
						d={ONDA_IZQUIERDA}
						fill={PIE_CRUCE}
						clipPath="url(#recibo-onda-derecha)"
					/>
				</svg>
				<p
					style={{
						position: "absolute",
						right: 30,
						bottom: 40,
						margin: 0,
						color: "#ffffff",
						fontWeight: 700,
						fontSize: 15,
						letterSpacing: "0.02em",
					}}
				>
					ABRIENDO LAS PUERTAS AL FUTURO
				</p>
			</div>
		</div>
	);
}
