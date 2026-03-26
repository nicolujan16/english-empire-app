import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
	try {
		const data = await resend.emails.send({
			from: "English Empire Institute <pagos@englishempire.com.ar>",
			to: ["nico240501@gmail.com"],
			subject: "¡Prueba de Dominio Superada! 🚀🇬🇧",
			html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #252d62;">¡Hola desde tu propio dominio!</h2>
          <p>Si estás leyendo esto en tu bandeja de entrada, significa que la configuración DNS fue un éxito rotundo.</p>
          <p>Ya estamos listos para automatizar todo el instituto.</p>
        </div>
      `,
		});

		return NextResponse.json({ success: true, data });
	} catch (error) {
		console.error("Error enviando el mail:", error);
		return NextResponse.json({ success: false, error }, { status: 500 });
	}
}
