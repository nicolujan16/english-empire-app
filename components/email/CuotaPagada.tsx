import * as React from "react";
import {
	Html,
	Body,
	Container,
	Text,
	Heading,
	Section,
	Button,
	Hr,
	Column,
	Row,
	Img,
	Link, // 🚀 Importamos Link
} from "@react-email/components";

interface CuotaProps {
	nombreAlumno: string;
	cursoNombre: string;
	mes: number;
	anio: number;
	montoAbonado: number;
	metodoPago: string;
	fecha: string;
	nroComprobante: string;
}

const MESES = [
	"Enero",
	"Febrero",
	"Marzo",
	"Abril",
	"Mayo",
	"Junio",
	"Julio",
	"Agosto",
	"Septiembre",
	"Octubre",
	"Noviembre",
	"Diciembre",
];

export default function CuotaPagada({
	nombreAlumno = "Alumno",
	cursoNombre = "Curso de Inglés",
	mes = 1,
	anio = 2024,
	montoAbonado = 0,
	metodoPago = "Transferencia",
	fecha = new Date().toLocaleDateString("es-AR"),
	nroComprobante = "TXN-00000000",
}: CuotaProps) {
	const baseUrl = "https://englishempire.com.ar";

	return (
		<Html>
			<Body
				style={{
					backgroundColor: "#f6f9fc",
					fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
				}}
			>
				<Container
					style={{
						backgroundColor: "#ffffff",
						padding: "40px",
						borderRadius: "8px",
						margin: "40px auto",
						maxWidth: "600px",
					}}
				>
					{/* 🚀 SECCIÓN DEL LOGO CLICKEABLE */}
					<Section style={{ textAlign: "center", marginBottom: "24px" }}>
						<Link href="https://englishempire.com.ar">
							<Img
								src={`${baseUrl}/logo.png`}
								width="180"
								height="auto"
								alt="English Empire Institute"
								style={{ margin: "0 auto", display: "block" }}
							/>
						</Link>
					</Section>

					<Heading
						style={{
							color: "#252d62",
							textAlign: "center",
							margin: "0 0 20px",
						}}
					>
						¡Pago Recibido! 🎉
					</Heading>

					<Text style={{ color: "#333", fontSize: "16px", lineHeight: "24px" }}>
						¡Hola, <strong>{nombreAlumno}</strong>!
					</Text>

					<Text style={{ color: "#333", fontSize: "16px", lineHeight: "24px" }}>
						Confirmamos la recepción de tu pago correspondiente a la cuota de{" "}
						<strong>
							{MESES[mes - 1]} {anio}
						</strong>{" "}
						para el curso <strong>{cursoNombre}</strong>.
					</Text>

					<Button
						href="https://englishempire.com.ar/mi-cuenta/pagos"
						style={{
							backgroundColor: "#EE1120",
							color: "#fff",
							padding: "12px 20px",
							borderRadius: "6px",
							textDecoration: "none",
							display: "block",
							textAlign: "center",
							fontWeight: "bold",
							margin: "30px 0",
						}}
					>
						Ver mis pagos
					</Button>

					<Hr style={{ borderColor: "#e5e7eb", margin: "30px 0" }} />

					<Text
						style={{
							fontSize: "12px",
							color: "#888",
							textTransform: "uppercase",
							letterSpacing: "1px",
							fontWeight: "bold",
							margin: "0 0 16px",
						}}
					>
						Detalle del pago
					</Text>

					<Section
						style={{
							backgroundColor: "#f0fdf4",
							border: "1px solid #86efac",
							borderRadius: "8px",
							padding: "16px",
							marginBottom: "24px",
						}}
					>
						<Text
							style={{
								margin: "0",
								fontSize: "14px",
								fontWeight: "bold",
								color: "#166534",
							}}
						>
							✓ Cuota pagada correctamente
						</Text>
						<Text
							style={{ margin: "4px 0 0", fontSize: "12px", color: "#16a34a" }}
						>
							{fecha} — {metodoPago}
						</Text>
					</Section>

					<Section style={{ marginBottom: "24px" }}>
						<Row style={{ marginBottom: "8px" }}>
							<Column style={{ width: "50%" }}>
								<Text style={{ margin: "0", fontSize: "12px", color: "#666" }}>
									N° Comprobante:
								</Text>
							</Column>
							<Column style={{ width: "50%", textAlign: "right" }}>
								<Text
									style={{
										margin: "0",
										fontSize: "12px",
										fontWeight: "bold",
										color: "#1a1a2e",
										fontFamily: "monospace",
									}}
								>
									{nroComprobante}
								</Text>
							</Column>
						</Row>
						<Row style={{ marginBottom: "8px" }}>
							<Column style={{ width: "50%" }}>
								<Text style={{ margin: "0", fontSize: "12px", color: "#666" }}>
									Alumno:
								</Text>
							</Column>
							<Column style={{ width: "50%", textAlign: "right" }}>
								<Text
									style={{
										margin: "0",
										fontSize: "12px",
										fontWeight: "bold",
										color: "#1a1a2e",
									}}
								>
									{nombreAlumno}
								</Text>
							</Column>
						</Row>
					</Section>

					<Section
						style={{
							width: "100%",
							borderCollapse: "collapse",
							border: "1px solid #e5e7eb",
							borderRadius: "4px",
							overflow: "hidden",
						}}
					>
						<Row
							style={{
								backgroundColor: "#f9fafb",
								borderBottom: "1px solid #e5e7eb",
							}}
						>
							<Column style={{ padding: "12px 16px", width: "70%" }}>
								<Text
									style={{
										margin: "0",
										fontSize: "10px",
										fontWeight: "bold",
										color: "#6b7280",
										textTransform: "uppercase",
									}}
								>
									Concepto
								</Text>
							</Column>
							<Column
								style={{
									padding: "12px 16px",
									width: "30%",
									textAlign: "right",
								}}
							>
								<Text
									style={{
										margin: "0",
										fontSize: "10px",
										fontWeight: "bold",
										color: "#6b7280",
										textTransform: "uppercase",
									}}
								>
									Importe
								</Text>
							</Column>
						</Row>
						<Row style={{ borderBottom: "1px solid #e5e7eb" }}>
							<Column style={{ padding: "16px" }}>
								<Text
									style={{ margin: "0", fontSize: "14px", color: "#1a1a2e" }}
								>
									Cuota {MESES[mes - 1]} {anio} — {cursoNombre}
								</Text>
							</Column>
							<Column style={{ padding: "16px", textAlign: "right" }}>
								<Text
									style={{
										margin: "0",
										fontSize: "14px",
										fontWeight: "bold",
										color: "#1a1a2e",
									}}
								>
									ARS ${montoAbonado.toLocaleString("es-AR")}
								</Text>
							</Column>
						</Row>
						<Row style={{ backgroundColor: "#252d62" }}>
							<Column style={{ padding: "16px" }}>
								<Text
									style={{
										margin: "0",
										fontSize: "12px",
										fontWeight: "bold",
										color: "#ffffff",
									}}
								>
									TOTAL ABONADO
								</Text>
							</Column>
							<Column style={{ padding: "16px", textAlign: "right" }}>
								<Text
									style={{
										margin: "0",
										fontSize: "14px",
										fontWeight: "bold",
										color: "#ffffff",
									}}
								>
									ARS ${montoAbonado.toLocaleString("es-AR")}
								</Text>
							</Column>
						</Row>
					</Section>

					<Section style={{ marginTop: "30px", textAlign: "center" }}>
						<Text
							style={{
								margin: "0",
								fontSize: "10px",
								color: "#aaa",
								lineHeight: "16px",
							}}
						>
							Este documento es un comprobante válido de pago emitido por
							English Empire Institute. No es válido como factura.
						</Text>
						<Text
							style={{ margin: "8px 0 0", fontSize: "10px", color: "#ccc" }}
						>
							© {new Date().getFullYear()} English Empire Institute — Todos los
							derechos reservados
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}
