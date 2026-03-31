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
	Img,
	Link,
} from "@react-email/components";

interface BienvenidaProps {
	nombreUsuario: string;
}

export default function Bienvenida({
	nombreUsuario = "Alumno",
}: BienvenidaProps) {
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
						¡Bienvenido a English Empire Institute! 🇬🇧
					</Heading>

					<Text style={{ color: "#333", fontSize: "16px", lineHeight: "24px" }}>
						¡Hola, <strong>{nombreUsuario}</strong>!
					</Text>

					<Text style={{ color: "#333", fontSize: "16px", lineHeight: "24px" }}>
						Nos hace muy felices que te hayas sumado a nuestra comunidad. Tu
						cuenta ha sido creada exitosamente y ya podés acceder a tu panel de
						usuario.
					</Text>

					<Text style={{ color: "#333", fontSize: "16px", lineHeight: "24px" }}>
						Desde tu cuenta vas a poder ver los cursos disponibles, gestionar
						tus inscripciones y realizar el pago de tus cuotas de forma rápida y
						segura.
					</Text>

					<Button
						href={`${baseUrl}/iniciar-sesion`}
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
						Ir a mi cuenta
					</Button>

					<Hr style={{ borderColor: "#e5e7eb", margin: "30px 0" }} />

					<Section style={{ textAlign: "center" }}>
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
