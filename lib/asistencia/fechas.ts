/**
 * Helpers de fecha y hora. Todo en hora argentina (UTC-3, sin horario de verano).
 */
import type { DiaSemana } from "./tipos";

export const TZ = "America/Argentina/Buenos_Aires";

export const DIAS_SEMANA: { valor: DiaSemana; largo: string; corto: string }[] =
	[
		{ valor: 1, largo: "Lunes", corto: "Lun" },
		{ valor: 2, largo: "Martes", corto: "Mar" },
		{ valor: 3, largo: "Miércoles", corto: "Mié" },
		{ valor: 4, largo: "Jueves", corto: "Jue" },
		{ valor: 5, largo: "Viernes", corto: "Vie" },
		{ valor: 6, largo: "Sábado", corto: "Sáb" },
		{ valor: 7, largo: "Domingo", corto: "Dom" },
	];

/** Date → "YYYY-MM-DD" en hora AR */
export const fechaAR = (d: Date) =>
	new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

/** Date → "HH:MM" en hora AR */
export const horaAR = (d: Date) =>
	new Intl.DateTimeFormat("es-AR", {
		timeZone: TZ,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(d);

/** "YYYY-MM-DD" + "HH:MM" (hora AR) → Date */
export const fechaHoraAR = (fecha: string, hora: string) =>
	new Date(`${fecha}T${hora}:00-03:00`);

/** "YYYY-MM-DD" → 1 (lunes) … 7 (domingo) */
export const diaSemanaDeFecha = (fecha: string): DiaSemana => {
	const [a, m, d] = fecha.split("-").map(Number);
	const js = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
	return (((js + 6) % 7) + 1) as DiaSemana;
};

export const sumarDias = (fecha: string, n: number) => {
	const [a, m, d] = fecha.split("-").map(Number);
	const x = new Date(Date.UTC(a, m - 1, d + n));
	return x.toISOString().slice(0, 10);
};

export const fechaLarga = (fecha: string) => {
	const [a, m, d] = fecha.split("-").map(Number);
	const texto = new Intl.DateTimeFormat("es-AR", {
		timeZone: "UTC",
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(new Date(Date.UTC(a, m - 1, d, 12)));
	return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export const fechaCorta = (fecha: string) => {
	const [a, m, d] = fecha.split("-");
	return `${d}/${m}/${a}`;
};

export const fechaHoraCorta = (d: Date) =>
	`${fechaCorta(fechaAR(d))} ${horaAR(d)}`;

export const minutosEntre = (desde: Date, hasta: Date) =>
	Math.round((hasta.getTime() - desde.getTime()) / 60000);

export const formatMinutos = (min: number) => {
	const h = Math.floor(min / 60);
	const m = min % 60;
	if (h === 0) return `${m} min`;
	return `${h} h ${String(m).padStart(2, "0")} min`;
};

export const iniciales = (nombre: string) => {
	const partes = nombre.trim().split(/\s+/).filter(Boolean);
	if (partes.length === 0) return "?";
	if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
	return (
		partes[0].charAt(0) + partes[partes.length - 1].charAt(0)
	).toUpperCase();
};

/** true si el string es "HH:MM" válido de 24 h */
export const esHoraValida = (h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

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

/** "2026-10" → "Octubre 2026" */
export const nombrePeriodo = (periodo: string) => {
	const [anio, mes] = periodo.split("-").map(Number);
	return `${MESES[mes - 1]} ${anio}`;
};

/** "2026-12" + 1 → "2027-01" */
export const sumarMeses = (periodo: string, delta: number) => {
	const [anio, mes] = periodo.split("-").map(Number);
	const total = anio * 12 + (mes - 1) + delta;
	return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
};

/** "2026-10-05" → "Lun 05/10" */
export const fechaConDia = (fecha: string) => {
	const dia = DIAS_SEMANA.find((d) => d.valor === diaSemanaDeFecha(fecha));
	return `${dia?.corto ?? ""} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
};
