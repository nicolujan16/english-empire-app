/**
 * Datos del recibo tal como se imprime (plantilla de Juan). Funciones puras.
 * Se arman desde un recibo guardado o, para la vista previa, desde la liquidación.
 */
import type { Liquidacion } from "./liquidacion";
import type {
	ClaseLiquidada,
	CursoLiquidado,
	LineaRecibo,
	Persona,
	Recibo,
	ReemplazoLiquidado,
	Rol,
} from "./tipos";

export type { LineaRecibo };

export interface DatosReciboImpreso {
	numeroTexto: string | null; // null = vista previa, el número se asigna al generar
	fechaEmision: string; // "YYYY-MM-DD"
	periodo: string; // "YYYY-MM"
	nombreRecibo: string; // "Apellido, Nombre"
	dni: string | null;
	lineas: LineaRecibo[];
	total: number;
}

const MESES = [
	"ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO",
	"AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

/** "2026-09-04" → "04 DE SEPTIEMBRE DEL 2026" */
export const fechaRecibo = (fecha: string) => {
	const [a, m, d] = fecha.split("-");
	return `${d} DE ${MESES[Number(m) - 1]} DEL ${a}`;
};

/** "2026-10" → "OCTUBRE 2026" */
export const periodoRecibo = (periodo: string) => {
	const [a, m] = periodo.split("-");
	return `${MESES[Number(m) - 1]} ${a}`;
};

const formatoNumero = new Intl.NumberFormat("es-AR", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

/** 15000 → "15.000,00" */
export const numeroRecibo = (n: number) => formatoNumero.format(n);

/** "43552355" → "43.552.355" */
export const dniConPuntos = (dni: string) =>
	dni.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** 50, 2026 → "050/26" */
export const formatearNumero = (numero: number, anio: number) =>
	`${String(numero).padStart(3, "0")}/${String(anio).slice(-2)}`;

export const nombreParaRecibo = (p: Pick<Persona, "nombre" | "apellido">) =>
	[p.apellido.trim(), p.nombre.trim()].filter(Boolean).join(", ");

/** 5760 → "96 HS"; 1270 → "21 HS 10 MIN" */
export const horasRecibo = (minutos: number) => {
	const h = Math.floor(minutos / 60);
	const m = minutos % 60;
	return m === 0 ? `${h} HS` : `${h} HS ${m} MIN`;
};

/**
 * Renglones del recibo:
 * - Secretaria: uno solo ("Secretaria", horas, precio por hora).
 * - Profesora: uno por curso, con su pago mensual: "KINDER A", "12 AL",
 *   lo que le toca por alumno (monto fijo × %) y el total. El porcentaje NO se
 *   imprime: es un dato interno del director. Después los
 *   reemplazos, agrupados por curso y valor de la clase: "REEMPLAZOS (KINDER A)"
 *   suma y "DESC. REEMPLAZOS (KINDER A)" resta (total negativo).
 * - Recibos viejos de profesora (sin `cursos`, de cuando se cobraba por clase):
 *   uno por curso y precio, con los reemplazos aparte ("REEMPLAZOS (KIDS 2)").
 */
export function lineasDelRecibo(r: {
	rol: Rol;
	totalMinutos: number | null;
	precioHora: number | null;
	clases: ClaseLiquidada[];
	cursos: CursoLiquidado[];
	reemplazos?: ReemplazoLiquidado[];
	totalAPagar: number;
}): LineaRecibo[] {
	if (r.rol === "secretaria") {
		return [
			{
				concepto: "Secretaria",
				cantidad: horasRecibo(r.totalMinutos ?? 0),
				precio: r.precioHora ?? 0,
				total: r.totalAPagar,
			},
		];
	}

	const reemplazos = r.reemplazos ?? [];
	if (
		r.cursos.length > 0 ||
		reemplazos.length > 0 ||
		!r.clases.some((c) => c.precio !== undefined)
	) {
		const lineasCursos = r.cursos.map((c) => ({
			concepto: c.cursoNombre.trim().toUpperCase(),
			cantidad: c.cantidadAlumnos !== null ? `${c.cantidadAlumnos} AL` : "",
			precio:
				c.montoFijo !== null && c.porcentaje !== null
					? Math.round(c.montoFijo * c.porcentaje) / 100
					: 0,
			total: c.total,
		}));
		return [...lineasCursos, ...lineasDeReemplazos(reemplazos)];
	}

	const grupos = new Map<string, LineaRecibo & { n: number; orden: string }>();
	r.clases.forEach((c) => {
		const precio = c.precio ?? 0;
		const curso = c.cursoNombre.trim().toUpperCase();
		const concepto = c.esReemplazo ? `REEMPLAZOS (${curso})` : curso;
		const clave = `${concepto}|${precio}`;
		const g = grupos.get(clave);
		if (g) {
			g.n++;
			g.total += precio;
		} else
			grupos.set(clave, {
				concepto,
				cantidad: "",
				precio,
				total: precio,
				n: 1,
				// Primero las clases propias, después los reemplazos; cada grupo por nombre
				orden: `${c.esReemplazo ? 1 : 0}${concepto}`,
			});
	});

	return [...grupos.values()]
		.sort((a, b) => a.orden.localeCompare(b.orden))
		.map(({ concepto, precio, total, n }) => ({
			concepto,
			cantidad: `${n} CL`,
			precio,
			total: Math.round(total * 100) / 100,
		}));
}

/** Reemplazos agrupados por curso, tipo y valor de la clase: primero los que suman */
function lineasDeReemplazos(reemplazos: ReemplazoLiquidado[]): LineaRecibo[] {
	const grupos = new Map<string, { linea: LineaRecibo; n: number; orden: string }>();
	reemplazos.forEach((r) => {
		const curso = r.cursoNombre.trim().toUpperCase();
		const concepto =
			r.tipo === "dio" ? `REEMPLAZOS (${curso})` : `DESC. REEMPLAZOS (${curso})`;
		const clave = `${concepto}|${r.monto}`;
		const signo = r.tipo === "dio" ? 1 : -1;
		const g = grupos.get(clave);
		if (g) {
			g.n++;
			g.linea.total += signo * r.monto;
		} else
			grupos.set(clave, {
				linea: { concepto, cantidad: "", precio: r.monto, total: signo * r.monto },
				n: 1,
				orden: `${r.tipo === "dio" ? 0 : 1}${concepto}`,
			});
	});
	return [...grupos.values()]
		.sort((a, b) => a.orden.localeCompare(b.orden))
		.map(({ linea, n }) => ({
			...linea,
			cantidad: `${n} CL`,
			total: Math.round(linea.total * 100) / 100,
		}));
}

/** Lo que se imprime de un recibo guardado: lo editado a mano si hay, si no lo calculado */
export const impresoDesdeRecibo = (r: Recibo): DatosReciboImpreso =>
	r.edicion
		? {
				numeroTexto: r.numeroTexto,
				fechaEmision: r.edicion.fechaEmision,
				periodo: r.periodo,
				nombreRecibo: r.edicion.nombreRecibo,
				dni: r.edicion.dni,
				lineas: r.edicion.lineas,
				total: r.edicion.total,
			}
		: {
				numeroTexto: r.numeroTexto,
				fechaEmision: r.fechaEmision ?? r.periodo + "-01",
				periodo: r.periodo,
				nombreRecibo: r.nombreRecibo || r.nombre,
				dni: r.dni,
				lineas: lineasDelRecibo(r),
				total: r.totalAPagar,
			};

/** Suma de los renglones, redondeada a centavos (el total de un recibo editado) */
export const totalDeLineas = (lineas: LineaRecibo[]) =>
	Math.round(lineas.reduce((acc, l) => acc + (Number.isFinite(l.total) ? l.total : 0), 0) * 100) /
	100;

/** Vista previa antes de generar: sin número y con la fecha de hoy */
export const impresoDesdeLiquidacion = (
	l: Liquidacion,
	persona: Persona | undefined,
	periodo: string,
	hoy: string,
): DatosReciboImpreso => ({
	numeroTexto: null,
	fechaEmision: hoy,
	periodo,
	nombreRecibo: persona ? nombreParaRecibo(persona) : l.nombre,
	dni: persona?.dni ?? null,
	lineas: lineasDelRecibo({
		rol: l.rol,
		totalMinutos: l.rol === "secretaria" ? l.totalMinutos : null,
		precioHora: l.rol === "secretaria" ? l.precioHora : null,
		clases: l.rol === "profesora" ? l.clases : [],
		cursos: l.rol === "profesora" ? l.cursos : [],
		reemplazos: l.rol === "profesora" ? l.reemplazos : [],
		totalAPagar: l.totalAPagar,
	}),
	total: l.totalAPagar,
});
