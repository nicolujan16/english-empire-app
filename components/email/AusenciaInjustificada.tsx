import * as React from "react";
import {
	Html,
	Body,
	Container,
	Text,
	Heading,
	Section,
	Hr,
	Img,
	Link,
	Button,
} from "@react-email/components";

interface AusenciaInjustificadaProps {
	nombreAlumno: string;
	cursoNombre: string;
	fecha: string;
}

export default function AusenciaInjustificada({
	nombreAlumno = "Alumno",
	cursoNombre = "Curso",
	fecha = new Date().toLocaleDateString("es-AR"),
}: AusenciaInjustificadaProps) {
	const baseUrl = "https://englishempire.com.ar";

	const wppNumber = "5493804259004";
	const wppLink = `https://wa.me/${wppNumber}`;

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
					{/* Logo */}
					<Section style={{ textAlign: "center", marginBottom: "24px" }}>
						<Link href={baseUrl}>
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
						Aviso de Inasistencias ⚠️
					</Heading>

					<Text
						style={{
							color: "#888",
							fontSize: "12px",
							textAlign: "right",
							margin: "0 0 20px",
						}}
					>
						{fecha}
					</Text>

					<Text style={{ color: "#333", fontSize: "16px", lineHeight: "24px" }}>
						Estimado Tutor,
					</Text>

					<Text style={{ color: "#333", fontSize: "16px", lineHeight: "24px" }}>
						Nos comunicamos desde <strong>English Empire Institute</strong> para
						informarle que hemos registrado que <strong>{nombreAlumno}</strong>{" "}
						ha estado ausente en sus últimas dos clases del curso{" "}
						<strong>{cursoNombre}</strong>.
					</Text>

					<Text style={{ color: "#333", fontSize: "16px", lineHeight: "24px" }}>
						Para nosotros es muy importante acompañar el proceso de aprendizaje
						de nuestros alumnos. Sabemos que los imprevistos ocurren, por lo que
						les pedimos que se pongan en contacto con nosotros a la brevedad
						para informarnos si existe algún inconveniente con el que podamos
						ayudar.
					</Text>

					<Text
						style={{
							color: "#333",
							fontSize: "16px",
							lineHeight: "24px",
							textAlign: "center",
						}}
					>
						Pueden responder directamente a este correo o comunicarse con
						Secretaría haciendo clic en el siguiente botón:
					</Text>

					<Section style={{ textAlign: "center", margin: "30px 0" }}>
						<Button
							href={wppLink}
							style={{
								backgroundColor: "#25D366",
								color: "#ffffff",
								padding: "14px 24px",
								borderRadius: "8px",
								textDecoration: "none",
								fontWeight: "bold",
								display: "inline-block",
								fontSize: "16px",
							}}
						>
							<Img
								src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1280px-WhatsApp.svg.png"
								width="20"
								height="20"
								alt="WhatsApp"
								style={{
									display: "inline-block",
									verticalAlign: "middle",
									marginRight: "8px",
								}}
							/>
							<span style={{ verticalAlign: "middle" }}>Comunicarse</span>
						</Button>
					</Section>

					<Hr style={{ borderColor: "#e5e7eb", margin: "30px 0" }} />

					<Section style={{ textAlign: "center" }}>
						<Text
							style={{
								margin: "0 0 16px",
								fontSize: "14px",
								color: "#666",
								lineHeight: "20px",
							}}
						>
							Atentamente,
							<br />
							<strong>El equipo de English Empire Institute</strong>
						</Text>

						<Text
							style={{
								margin: "0",
								fontSize: "12px",
								color: "#888",
								lineHeight: "16px",
							}}
						>
							Si tenés alguna duda o necesitás ayuda, no dudes en contactarnos.
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
