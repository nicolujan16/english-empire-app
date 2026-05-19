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

interface BienvenidaConLinkProps {
	nombreUsuario: string;
	resetLink: string;
}

export default function BienvenidaConLink({
	nombreUsuario = "Alumno",
	resetLink,
}: BienvenidaConLinkProps) {
	const baseUrl = "https://www.englishempire.com.ar";

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
								src="https://res.cloudinary.com/dapiwwxv7/image/upload/v1779226666/logo_1_cxxpjg.png"
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
						¡Bienvenido a English Empire Institute!
					</Heading>

					<Text style={{ color: "#333", fontSize: "16px", lineHeight: "24px" }}>
						¡Hola, <strong>{nombreUsuario}</strong>!
					</Text>

					<Text style={{ color: "#333", fontSize: "16px", lineHeight: "24px" }}>
						Tu cuenta en English Empire Institute fue creada exitosamente por
						nuestro equipo de sistemas. Ya podés acceder a tu panel de
						usuario para ver tus cursos, gestionar tus inscripciones y realizar
						el pago de tus cuotas.
					</Text>

					<Text style={{ color: "#333", fontSize: "16px", lineHeight: "24px" }}>
						Para comenzar, necesitás crear tu contraseña personal haciendo clic
						en el siguiente botón:
					</Text>

					<Button
						href={resetLink}
						style={{
							backgroundColor: "#EE1120",
							color: "#fff",
							padding: "14px 24px",
							borderRadius: "6px",
							textDecoration: "none",
							display: "block",
							textAlign: "center",
							fontWeight: "bold",
							fontSize: "16px",
							margin: "30px 0",
						}}
					>
						Crear mi contraseña
					</Button>

					<Text
						style={{ color: "#888", fontSize: "13px", lineHeight: "20px" }}
					>
						Si el botón no funciona, copiá y pegá el siguiente enlace en tu
						navegador:
					</Text>
					<Text
						style={{
							color: "#252d62",
							fontSize: "12px",
							wordBreak: "break-all",
							lineHeight: "18px",
						}}
					>
						{resetLink}
					</Text>

					<Hr style={{ borderColor: "#e5e7eb", margin: "30px 0" }} />

					<Text
						style={{ color: "#999", fontSize: "12px", lineHeight: "18px" }}
					>
						⚠️ Este enlace es de uso único y expirará en 24 horas. Si no
						solicitaste esta cuenta o creés que recibiste este correo por error,
						podés ignorarlo.
					</Text>

					<Hr style={{ borderColor: "#e5e7eb", margin: "20px 0" }} />

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
