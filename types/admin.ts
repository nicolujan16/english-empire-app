// ==========================================
// INTERFACES PARA EL PANEL DE ADMINISTRACIÓN
// ==========================================

// 1. INSCRIPCIONES (Enfoque Administrativo)
export type EstadoInscripcion = "Activa" | "Pendiente" | "Baja" | "Cancelada";
export type TipoAlumno = "Titular" | "Menor";

export interface AdminInscription {
	id: string; // ID del documento de inscripción en Firestore
	fecha: string; // Fecha en la que se realizó la pre-inscripción/pago
	alumnoNombre: string;
	alumnoDni: string;
	cursoNombre: string;
	tipo: TipoAlumno;
	estado: EstadoInscripcion;
}

// 2. PAGOS (Enfoque Financiero - Libro Contable)
export type EstadoPago = "Aprobado" | "Procesando" | "Rechazado";
export type MetodoPago =
	| "Tarjeta"
	| "Efectivo"
	| "Transferencia"
	| "MercadoPago";

export interface AdminPayment {
	id: string; // ID de transacción de Mercado Pago
	fecha: string; // Fecha en la que impactó el pago
	pagadorNombre: string; // Nombre del titular de la cuenta/tarjeta
	concepto: string; // Ej: "Inscripción - Kínder A (Tomás)"
	monto: number; // Usamos number para poder hacer sumatorias en los gráficos
	metodo: MetodoPago;
	estado: EstadoPago;
}

// 3. ALUMNOS (Enfoque Académico)
export interface AdminStudent {
	id: string; // ID del documento (ya sea de la colección Users o Hijos)
	nombre: string;
	apellido: string;
	dni: string;
	fechaNacimiento: string; // YYYY-MM-DD
	edad: number; // Dato calculado que la tabla ya recibe procesado
	cursosActivos: string[]; // Nombres de los cursos en los que está actualmente
	contactoEmergencia: string; // Teléfono (del tutor o del adulto)
	tutorNombre?: string; // Opcional: si es adulto titular, esto viene vacío o undefined
}

// 4. TUTORES (Enfoque de Contacto y Cobranza)
export type EstadoContable = "Al día" | "Moroso";

export interface AdminTutor {
	id: string; // ID del usuario (Padre/Responsable)
	nombre: string;
	apellido: string;
	dni: string;
	email: string;
	telefono: string;
	alumnosACargo: string[]; // Lista con los nombres de sus hijos (Ej: ["Tomás", "Sofía"])
	estadoContable: EstadoContable;
}
