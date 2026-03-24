# English Empire Institute - ERP & LMS Platform

Plataforma integral de gestión educativa, administrativa y financiera desarrollada a medida para el instituto de idiomas **English Empire**. Este sistema centraliza la operativa diaria del instituto, ofreciendo portales dedicados para la administración, el equipo docente y los alumnos/tutores.

## 🚀 Características Principales

El sistema está dividido en tres ecosistemas principales con Control de Acceso Basado en Roles (RBAC):

### 🛡️ Portal de Administración
- **Gestión Académica:** ABM de cursos, control de cupos, rangos de edades, horarios dinámicos y categorización.
- **Gestión de Usuarios:** Administración de alumnos titulares y menores a cargo (Grupo Familiar).
- **Módulo Financiero Core:** - Generación automática de cuotas mensuales.
  - Gestión de pagos manuales, ingresos especiales y egresos con soporte para **pagos divididos (Split Payments)**.
  - Sistema avanzado de **Etiquetas de Descuento** (ej. Becas, Hermanos, Convenios) con cálculo inteligente de máximo beneficio.
- **Gestión Docente:** Alta de profesores y asignación/desasignación de cursos en tiempo real.

### 🧑‍🏫 Portal Docente
- **Dashboard Personalizado:** Los profesores visualizan únicamente los cursos que tienen asignados.
- **Registro de Clases:** Creación de instancias de clases por día (ID idempotente para evitar duplicados).
- **Asistencia Digital:** Toma de lista interactiva con estados definidos (Presente, Tarde, Ausente) y guardado atómico.

### 🎓 Portal de Usuarios (Alumnos / Tutores)
- **Inscripciones Inteligentes:** Proceso de inscripción automatizado que valida la edad del alumno y aplica descuentos correspondientes.
- **Pasarela de Pagos:** Integración completa con **Mercado Pago** (Checkout Pro y Webhooks) para abonar inscripciones y cuotas.
- **Historial Transparente:** Acceso a comprobantes de pago, estado de cuenta y visualización en tiempo real del registro de asistencia de los alumnos a cargo.

## 💻 Stack Tecnológico

**Frontend:**
- [Next.js](https://nextjs.org/) (App Router)
- [React 18](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/) (Animaciones fluidas)
- [Shadcn UI](https://ui.shadcn.com/) & [Lucide React](https://lucide.dev/) (Componentes e iconografía)

**Backend & Base de Datos:**
- [Firebase Firestore](https://firebase.google.com/docs/firestore) (Base de datos NoSQL en tiempo real)
- [Firebase Authentication](https://firebase.google.com/docs/auth) (Gestión de sesiones y seguridad)
- [Firebase Storage](https://firebase.google.com/docs/storage) (Alojamiento de imágenes y comprobantes)

**Pagos & APIs:**
- [Mercado Pago SDK](https://www.mercadopago.com.ar/developers/)

## ⚙️ Arquitectura y Diseño

- **Single Source of Truth:** Diseño de base de datos NoSQL optimizado para lecturas rápidas y consistencia de datos (ej. historiales de asistencia inmutables).
- **Subdominios (Middleware):** Enrutamiento gestionado vía Middleware de Next.js para separar el tráfico entre `admin.`, `teachers.` y el dominio principal.
- **UI/UX:** Interfaces diseñadas con foco en la usabilidad en dispositivos móviles (Mobile-first para el portal docente) y prevención de errores mediante tooltips y estados derivados.

## 🛠️ Instalación y Configuración Local

1. Clonar el repositorio:
```bash
git clone https://github.com/tu-usuario/english-empire.git
cd english-empire
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar las variables de entorno. Crea un archivo `.env.local` en la raíz del proyecto basado en el siguiente esquema:
```env
# Firebase Client (Públicas)
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id

# Mercado Pago
MP_ACCESS_TOKEN=tu_access_token_de_produccion_o_prueba
NEXT_PUBLIC_APP_URL=http://localhost:3000
WEBHOOK_URL=tu_url_de_ngrok_o_produccion
```

4. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

El proyecto estará disponible en `http://localhost:3000`.
