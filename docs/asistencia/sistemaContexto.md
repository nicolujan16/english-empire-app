# Sistema de asistencia del personal: English Empire Institute

> **⚠️ Documento histórico (proyecto `asistencia-english-empire`, ya integrado en esta app).**
> Las **reglas de negocio** siguen vigentes: §1 (cómo se cobra), §5 (llaveros NFC), §8 (fichadas, reemplazos, totales y recibos), §9 (API del kiosco) y §10 (UI del kiosco).
> Lo que **ya no aplica** es la arquitectura: no hay un Firebase propio ni un login aparte. Las profesoras son `Teachers`, los cursos son los de `Cursos`, el director es `Admins.esDirector`, y `Recibos` pasó a llamarse `RecibosPersonal`.
> Para el modelo actual, las rutas y los permisos, ver **[../registro-asistencias.md](../registro-asistencias.md)**.

> **Para Claude Code:** este documento es el contexto completo del proyecto. Leelo entero antes de escribir código, junto con **`STYLE.md`** (guía visual) y el componente de referencia **`CalendarioAsistencia.tsx`**. Si aparece una duda de negocio que no está resuelta acá, preguntale a Nicolás antes de asumir. La sección 16 lista lo que sigue abierto.

---

## 1. Contexto

- **English Empire Institute** es un instituto de inglés de La Rioja, Argentina, dirigido por **Juan** (director y contador). Nicolás es el único desarrollador.
- El instituto ya tiene su plataforma (`english-empire-app`, Next.js + Firebase `english-empire-2026`), que está en uso.
- **Este proyecto es un sistema aparte:** registra la asistencia de **secretarias** y **profesoras** con **llaveros NFC** que acercan a un dispositivo fijo en recepción. Con esos registros, Juan revisa y corrige la actividad y, a fin de mes, genera el **recibo de cada persona con lo que cobra**:
  - **Secretarias:** horas trabajadas × **su precio por hora** (cada secretaria tiene el suyo). **Siempre** cuenta desde que llegan hasta que se van, también en días especiales.
  - **Profesoras:** un **pago mensual fijo** por cada curso del que son titulares: monto fijo × cantidad de alumnos × su porcentaje. No depende de cuántas clases dieron (las clases quedan como control).
  - **Reemplazos:** si una clase la da alguien que no es titular del curso, el **valor de la clase** se le resta a la titular y se le suma a la reemplazante. Valor de la clase = pago mensual de la titular en ese curso ÷ clases del curso en el mes según sus horarios (**contando los feriados**, dentro de la vigencia). Ej.: $100.000 en octubre con 4 miércoles → $25.000 por clase. Si el curso tiene varias titulares, cada una pierde su parte y la reemplazante cobra la suma. Solo cuentan las clases que cuentan para el recibo (Activa, no excluidas por un día especial salvo "contar igual").
  - **Días especiales:** las clases que caen dentro de un día especial (completo o parcial) **no cuentan** ni se cobran, salvo que Juan marque "contar igual".

### Principio rector
**El sistema propone y Juan decide.** Todo tiene que ser simple, flexible y editable por Juan, con un motivo registrado en cada cambio. Ante la duda entre automatizar un caso raro o dejar que Juan lo corrija a mano, elegí lo segundo.

### Independencia total
- **Repo propio y proyecto Firebase propio.**
- **No hay ninguna conexión con la base ni con el código de `english-empire-app`.** El personal y los cursos se cargan en este sistema desde su propio panel.
- Lo único que se reutiliza del repo del instituto es lo visual: los componentes de `components/ui`, `globals.css` y el logo.

## 2. Qué NO es

- **No es una liquidación de sueldos completa.** Calcula lo que cobra cada persona (horas × precio por hora, o la suma de las clases dadas), pero no maneja descuentos, aportes, adelantos ni datos fiscales.
- **No registra alumnos.**
- **No usa foto ni biometría.**

---

## 3. Arquitectura

```
[Llavero NTAG215] ── toque ──► [Celular/tablet Android con NFC en recepción]
                                  /kiosco (Chrome + Fully Kiosk)
                                       │ POST /api/fichar (Bearer token del dispositivo)
                                       ▼
┌──────────── Repo: english-empire-asistencia (Next.js, un sitio Netlify) ────────────┐
│  /api/*  ── Admin SDK ──►  Firebase propio (Auth + Firestore)                       │
│  Panel   ── client SDK + reglas ──►  (Juan: personal, cursos, calendario, recibos)  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

- **Kiosco:** no usa el client SDK. Solo llama a la API con su token.
- **Panel:** login propio de Juan (Firebase Auth email/contraseña). Lee y escribe con el client SDK, protegido por reglas.
- **Subdominio:** a definir (ej. `asistencia.englishempire.com.ar`).

## 4. Stack

- **Base:** Next.js 16.4 (App Router, con `cacheComponents` activado), React 19.3, TypeScript y Tailwind v4. Esta versión de Next tiene cambios: leer la guía de `node_modules/next/dist/docs/` antes de usar una API (ver `AGENTS.md`).
- **UI:** shadcn/ui, framer-motion y lucide-react. `components/ui/*`, `lib/utils.ts` y `globals.css` se copian del repo del instituto (ver `STYLE.md`).
- **Firebase:** `firebase` (client: Auth y Firestore para el panel) y `firebase-admin` (servidor).
- **PDF:** `@react-pdf/renderer` (a confirmar). **Emails:** `resend`. **Tests:** Vitest para la lógica pura (todavía no está instalado).
- **Con `cacheComponents`:** un Client Component que lee `new Date()` al renderizar llama antes a `use(io())` (de `next/cache`) y va dentro de un `<Suspense>`; lo mismo para `useSearchParams()`.

### Configuración y variables de entorno
- **Client SDK:** la configuración web está en `firebaseConfig.ts` (proyecto `asistencia-english-empire`). Son valores públicos por diseño; la seguridad la dan las reglas.
- **Servidor** (cuando exista la API del kiosco y el envío de recibos):
```
FIREBASE_PROJECT_ID=  FIREBASE_CLIENT_EMAIL=  FIREBASE_PRIVATE_KEY=
RESEND_API_KEY=  RESEND_FROM=
```
- `FIREBASE_PRIVATE_KEY` y `RESEND_API_KEY` van marcadas como secretas en Netlify. En la clave hay que reemplazar `\\n` por saltos de línea reales.
- `.env.local` apunta a un **proyecto Firebase de prueba**. Nunca asumir que coincide con producción.
- Ojo: en el Admin SDK, **`snap.exists` es una propiedad, sin paréntesis.**

---

## 5. Hardware y lectura de llaveros

- **Llaveros:** NTAG215 (13,56 MHz). Se identifican por su **UID de fábrica** (7 bytes). **No se graba nada en el llavero.**
- **Dispositivo:** celular o tablet **Android con NFC**, con Chrome y **Fully Kiosk Browser**, abierto en `/kiosco` y siempre enchufado. **iOS/Safari no soporta Web NFC.**
- **Web NFC (`NDEFReader`):**
  - `reading.serialNumber` devuelve el UID con formato `"04:a2:3b:1c:5d:6e:80"`.
  - Requiere HTTPS y la página visible en primer plano.
  - La primera vez hay que tocar un botón "Activar lector". Con el permiso concedido (`navigator.permissions.query({ name: "nfc" })`), se puede iniciar al cargar.
  - Si un llavero da `readingerror`, hay que formatearlo una vez con NFC Tools escribiéndole cualquier registro.
- **Alternativa (opcional):** un lector USB de 13,56 MHz que emula teclado, escribe el UID y después Enter. Se captura con un input oculto que mantiene el foco. Puede emitir el UID en decimal o con los bytes invertidos.
- **UID canónico:** hexadecimal en mayúsculas sin separadores (`04A23B1C5D6E80`). Toda entrada pasa por `normalizarUid(raw)`, aislada y testeada.

---

## 6. Reglas transversales del modelo

- **Colecciones en PascalCase, plural y en español.** Fechas de auditoría `creadoEn` y `actualizadoEn` (Timestamp).
- **Fechas de calendario** como string `"YYYY-MM-DD"` en **hora argentina**. Las horas como `"HH:MM"` (24 h).
- **Tipos** en minúscula (`"secretaria"`); **estados** con mayúscula inicial y case-sensitive (`"Activa"`).
- **Desnormalizar los nombres** en los registros para ahorrar lecturas.
- **Nunca se borra un registro de asistencia:** se pasa a `estado: "Anulada"`.
- **Cada edición de Juan exige un motivo** y agrega una entrada al `historial`.
- **Toda lectura de un llavero en el kiosco genera una `Fichada`**, sin excepción: llaveros desconocidos o dados de baja, días especiales, toques repetidos, todo.

```ts
interface CambioHistorial {
  campo: string;
  antes: unknown;
  despues: unknown;
  motivo: string;          // obligatorio
  por: string;             // uid de Juan
  en: Timestamp;           // Timestamp.now(): serverTimestamp() NO funciona dentro de arrays
}
```

## 7. Colecciones (14)

### 7.1 `Personal/{autoId}`
```ts
interface Personal {
  nombre: string;
  apellido: string;
  email: string;
  dni: string | null;               // solo dígitos ("43552355"); va impreso en el recibo
  rol: "secretaria" | "profesora";
  activo: boolean;
  llaveroUid: string | null;
  jornadaAbiertaId: string | null;  // técnico, solo secretarias: entrada sin salida
  ultimaFichadaEn: Timestamp | null;// técnico: antirrebote
  precioHora: number | null;        // solo secretarias: se carga en Carga de datos → Precio/hora - Secretarias
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}
```

### 7.2 `Cursos/{autoId}`
```ts
interface Curso {
  nombre: string;
  activo: boolean;
  profesoraIds: string[];           // ids de Personal (rol profesora), para array-contains
  profesoraNombres: string[];       // desnormalizado, mismo orden
  horarios: HorarioCurso[];
  fechaInicio: string;              // "YYYY-MM-DD": no se esperan clases antes
  fechaFin: string;                 // "YYYY-MM-DD": ni después
  cantidadAlumnos: number | null;   // entero
  montoFijo: number | null;         // monto fijo por alumno, por mes
  porcentajes: Record<string, number>; // por id de profesora (0 a 100)
  // precioPorClase: campo viejo, ya no se usa
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}
interface HorarioCurso {
  dia: 1 | 2 | 3 | 4 | 5 | 6 | 7;   // 1 = lunes … 7 = domingo
  inicio: string;                   // "18:00"
  fin: string;                      // "19:30" (obligatorio)
}
```
- Si un curso tiene varias profesoras, todas son titulares del curso.
- Si una de ellas da la clase, **no** se considera reemplazo.

### 7.3 `DiasEspeciales/{autoId}`
Puede haber varios en una misma fecha (por ejemplo, la salida al cine de un curso a la tarde y otro evento a la mañana).
```ts
interface DiaEspecial {
  fecha: string;                    // "YYYY-MM-DD"
  descripcion: string;              // "Feriado: Día de la Soberanía", "Salida al cine"
  todoElDia: boolean;
  desde: string | null;             // "14:00" si es parcial
  hasta: string | null;             // "18:00" si es parcial
  cursoIds: string[];               // [] = afecta a TODOS los cursos
  creadoPor: string;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}
```

**Regla:** una clase queda **excluida** del recuento si se cumplen las tres condiciones:
1. Existe un `DiaEspecial` en su misma fecha.
2. El curso está alcanzado: `cursoIds` está vacío o incluye ese curso.
3. El horario coincide: `todoElDia` es `true`, o el turno de la clase se superpone con el rango `[desde, hasta)`.

**Cómo se aplica la regla:**
- **Se calcula al momento de contar, no se guarda.** Así Juan puede cargar un día especial después de que pasó y los totales se recalculan solos.
- **No afecta a las secretarias:** sus jornadas cuentan siempre.
- Si una profe ficha en un día especial, la `Fichada` y la `ClaseDictada` igual se registran. En el panel aparece como **"Excluida (día especial)"**.
- Juan puede forzar que una clase cuente con `contarIgual: true` en la `ClaseDictada`, con motivo obligatorio.

### 7.4 `Llaveros/{uid}`
El ID del doc es el UID canónico.
```ts
interface Llavero {
  uid: string;
  numero: string | null;            // etiqueta física "03", la carga Juan
  personalId: string | null;
  estado: "SinAsignar" | "Asignado" | "Baja";
  creadoEn: Timestamp;
  ultimoUsoEn: Timestamp | null;
}
```
- Cuando un llavero desconocido se acerca al kiosco, el doc se crea solo con estado `SinAsignar`.
- Al asignarlo, se actualizan `Llaveros` y `Personal.llaveroUid` **en un mismo batch**.

### 7.5 `Fichadas/{idLocal}`: registro crudo, INMUTABLE
El ID es el `idLocal` (uuid) que genera el kiosco, así los reintentos offline no duplican.
```ts
interface Fichada {
  llaveroUid: string;
  personalId: string | null;
  personalNombre: string | null;
  resultado: "entrada" | "salida" | "clase" | "sin_clase" | "ya_registrado"
           | "llavero_desconocido" | "llavero_baja" | "personal_inactivo";
  fecha: string;
  horaEfectiva: Timestamp;          // la que cuenta
  horaServidor: Timestamp;
  horaDispositivo: Timestamp;
  fueOffline: boolean;
  dispositivoId: string;
  jornadaId?: string;
  claseDictadaId?: string;
  resuelta: boolean;                // único campo editable, para "sin_clase"
}
```

### 7.6 `Jornadas/{autoId}`: secretarias, editable por Juan
```ts
interface Jornada {
  personalId: string;
  personalNombre: string;
  fecha: string;                    // fecha de la entrada
  entrada: Timestamp;
  salida: Timestamp | null;
  minutos: number | null;           // se recalcula SIEMPRE al editar
  incompleta: boolean;              // salida olvidada
  estado: "Activa" | "Anulada";
  origen: "fichada" | "manual";
  fueOffline: boolean;
  fichadaEntradaId?: string;
  fichadaSalidaId?: string;
  historial: CambioHistorial[];
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}
```

### 7.7 `ClasesDictadas/{cursoId}_{YYYY-MM-DD}_{HHMM}`: profesoras, editable por Juan
El ID determinístico hace la escritura idempotente y permite cruzarla con las clases esperadas.
```ts
interface ClaseDictada {
  cursoId: string;
  cursoNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  profesoraDictoId: string;
  profesoraDictoNombre: string;
  esReemplazo: boolean;
  titularIds: string[];             // las del curso en ese momento
  llegada: Timestamp | null;
  minutosTarde: number | null;
  estado: "Activa" | "Anulada";
  contarIgual: boolean;             // override de Juan sobre un día especial
  origen: "fichada" | "manual";
  fueOffline: boolean;
  fichadaId?: string;
  historial: CambioHistorial[];
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}
```
- **Las "clases esperadas" no se guardan.** Se calculan a partir de `Cursos.horarios` (y su vigencia) para cada día del mes, y se cruzan por ID con `ClasesDictadas`.
- Una clase esperada de un día pasado que no tiene `ClaseDictada` es una clase **"Sin registro"**.

### 7.8 `Reemplazos/{autoId}`
```ts
interface Reemplazo {
  fecha: string;
  cursoId: string;
  cursoNombre: string;
  horaInicio: string;
  reemplazanteId: string;
  reemplazanteNombre: string;
  motivo?: string;
  creadoPor: string;
  creadoEn: Timestamp;
}
```

### 7.9 `Cierres/{YYYY-MM}` (reservado)
```ts
interface Cierre {
  confirmado: boolean;
  confirmadoEn: Timestamp;
  confirmadoPor: string;
  bloqueado: boolean;               // opcional: impide ediciones hasta que Juan desbloquee
}
```
- **Hoy no se escribe.** Los recibos se generan de a una persona (§8.5), así que no hay un "confirmar el mes" único.
- Queda para el bloqueo de mes, si se implementa.

### 7.10 `Recibos/{personalId}_{YYYY-MM}`
```ts
interface Recibo {
  personalId: string;
  nombre: string;
  rol: "secretaria" | "profesora";
  periodo: string;                  // "YYYY-MM"
  numero: number;                   // correlativo del año de emisión
  numeroTexto: string;              // "050/26"
  fechaEmision: string;             // "YYYY-MM-DD", la del día en que se generó
  nombreRecibo: string;             // "Apellido, Nombre", como va impreso
  dni: string | null;
  // Secretarias
  totalMinutos?: number;
  precioHora?: number | null;       // el que tenía al generar
  // Profesoras
  totalClases?: number;
  clases?: ClaseLiquidada[];        // las clases que dio y cuentan (control de asistencia)
  cursos?: CursoLiquidado[];        // lo que cobra: pago mensual de cada curso
  reemplazos?: ReemplazoLiquidado[]; // lo que suma (dio) o resta (la reemplazaron)
  totalAPagar: number;              // en pesos, redondeado a centavos
  version: number;                  // sube cada vez que se regenera
  imagenVersion: number | null;     // versión que tiene imagen guardada en RecibosImagenes
  generadoEn: Timestamp;
  generadoPor: string;              // uid de Juan
  enviadoEn?: Timestamp;
  enviadoA?: string;
}

interface ClaseLiquidada {
  claseId: string;                  // = id de ClasesDictadas
  fecha: string;
  cursoId: string;
  cursoNombre: string;
  horaInicio: string;
  horaFin: string;
  esReemplazo: boolean;
  precio?: number;                  // solo en recibos viejos (se cobraba por clase)
}
interface CursoLiquidado {          // array `cursos` del recibo de una profesora: lo que cobra
  cursoId: string;
  cursoNombre: string;
  cantidadAlumnos: number | null;
  montoFijo: number | null;
  porcentaje: number | null;
  total: number;                    // 0 si falta algún dato
}
interface ReemplazoLiquidado {      // array `reemplazos` del recibo de una profesora
  claseId: string;
  fecha: string;
  cursoId: string;
  cursoNombre: string;
  tipo: "dio" | "recibio";          // dio = suma · recibio = la reemplazaron, resta
  otraId: string;                   // la titular (dio) o la reemplazante (recibio)
  otraNombre: string;
  clasesDelMes: number;             // divisor usado
  monto: number;                    // valor de la clase, positivo (0 si faltan datos)
}
```
- `totalAPagar` de una profesora = suma de `cursos[].total` + reemplazos que dio − reemplazos que recibió.
- Se genera **de a una persona** desde `/recibos`, en una transacción que sube la `version`.
- **Número:** la primera vez toma el siguiente de `Contadores/recibos-YYYY` (correlativo por año, se reinicia cada año). Si se regenera, conserva el número.
- Regenerar pisa el documento entero: la versión nueva todavía no tiene imagen ni fue enviada.

### 7.13 `RecibosImagenes/{personalId}_{YYYY-MM}`
```ts
interface ReciboImagen {
  personalId: string;
  periodo: string;
  version: number;                  // de qué versión del recibo es
  imagen: string;                   // data URL JPG ("data:image/jpeg;base64,…"), < 1 MB
  generadaEn: Timestamp;
}
```
- Es la imagen del recibo con el diseño de Juan, la que van a ver las profesoras y secretarias.
- Va aparte de `Recibos` para que los listados no descarguen las imágenes.
- **Se guarda en Firestore, no en Storage.** Storage pide el plan Blaze, y una hoja A4 en JPG pesa unos 150 KB, muy por debajo del límite de 1 MB por documento.

### 7.14 `Contadores/{id}` (técnico)
- `recibos-YYYY`: `{ ultimo: number }`, el último número de recibo usado en ese año. Solo puede avanzar.

### 7.11 `Administradores/{uid}` (técnico)
```ts
interface Administrador { nombre: string; email: string; rol: "director"; activo: boolean; }
```
La cuenta de Juan se crea con `scripts/crear-director.ts`, que da de alta el usuario en Auth y su doc.

### 7.12 `Dispositivos/{id}` (técnico, solo Admin SDK)
```ts
interface Dispositivo { nombre: string; tokenHash: string; activo: boolean; ultimoContactoEn: Timestamp | null; creadoEn: Timestamp; }
```
Se crea con `scripts/crear-dispositivo.ts`, que guarda el sha256 e imprime el token **una sola vez**.

---

## 8. Reglas de negocio

### 8.1 Fichada de secretaria (un toque alterna entrada y salida)
Se resuelve en una **transacción**:
1. **Antirrebote:** si `ultimaFichadaEn` es de hace menos de 60 segundos, el toque queda registrado como `ya_registrado` y no cambia nada más.
2. Si `jornadaAbiertaId` apunta a una jornada **de hoy**, el toque es una **salida**: se setean `salida` y `minutos`, y `jornadaAbiertaId` vuelve a `null`.
3. Si apunta a una jornada **de otro día**, esa jornada pasa a `incompleta: true` y el toque se trata como una **entrada nueva**.
4. Si no hay jornada abierta, el toque es una **entrada**.
5. Puede haber varias jornadas el mismo día (turno partido). **Los días especiales no las afectan.**

### 8.2 Fichada de profesora (un toque = una clase)
1. **Candidatas de hoy:**
   - Los `Reemplazos` de hoy en los que ella es la reemplazante.
   - Los turnos de hoy de los cursos con `profesoraIds` que la incluyen, siempre que el curso esté `activo` y hoy esté dentro de su vigencia.
2. **Ventana de cada turno:** desde `ANTICIPO_MIN` antes del inicio (45 minutos por defecto, configurable) hasta el `fin`.
3. Se elige el turno cuya ventana contiene el momento actual y que todavía no tiene una `ClaseDictada` activa. Si hay varios, gana el que empieza antes.
4. Se crea la `ClaseDictada`:
   - `minutosTarde`: `max(0, llegada − inicio)`.
   - `esReemplazo`: `true` si vino de un `Reemplazo`.
5. Si ya estaba registrada: `ya_registrado`. Si no hay candidata: `sin_clase` ("Quedó registrado, Juan lo va a revisar").
6. Si la clase cae en un día especial, se registra igual y el kiosco lo indica ("Día especial: no cuenta para el recibo").

### 8.3 Reemplazos
- **Camino A:** se carga el `Reemplazo` antes de la clase y el kiosco ya le muestra el curso a la reemplazante.
- **Camino B:** no se cargó nada. La reemplazante queda como `sin_clase` y Juan lo resuelve desde el calendario (crea o reasigna la `ClaseDictada`, con motivo).
- En el recibo, la clase figura para `profesoraDictoId` (control) y, si no es titular, genera el traspaso del valor de la clase (ver §1, Reemplazos). Se calcula en `traspasosDelMes` (`lib/asistencia/liquidacion.ts`).

### 8.4 Hora y zona horaria
- Netlify corre en UTC. Todo cálculo de fecha y hora se hace con `America/Argentina/Buenos_Aires`, en helpers puros: `fechaAR`, `horaAR`, `diaSemanaAR` (1 = lunes) y `minutosDelDiaAR`.
- **`horaEfectiva`:**
  - Online: se usa la hora del servidor.
  - Offline: se usa la `horaDispositivo`, siempre que sea de las últimas 48 horas (si es más vieja, se registra igual, pero marcada para revisión).

### 8.5 Totales, montos, "a revisar" y recibos
- **Secretaria:**
  - **Minutos:** suma de las jornadas `Activa` del mes con salida. Las `incompleta` no suman hasta que Juan las complete.
  - **A cobrar:** `precioHora × minutos / 60`, redondeado a centavos.
- **Profesora:**
  - **Clases que cuentan:** `ClasesDictadas` en estado `Activa`, con `profesoraDictoId` igual a ella y que **no** están excluidas por un día especial, salvo que tengan `contarIgual: true`.
  - **A cobrar:** por cada curso activo del que es titular y cuya vigencia toca el mes: `montoFijo × cantidadAlumnos × porcentaje / 100`. Es fijo: no depende de las clases dadas. Las clases que cuentan van al recibo como control.
  - **Estimado por clase** (solo en el formulario del curso, no va al recibo): pago mensual ÷ clases del curso en el mes, contando los días de la semana de sus horarios dentro del mes y la vigencia (feriados incluidos).
- **Precios faltantes:** si falta un precio, esa parte se calcula en $0 y el panel lo avisa con links a Carga de datos (Precio/hora - Secretarias o Cursos y profesoras). No bloquea.
- **"A revisar"** incluye:
  - Las jornadas incompletas.
  - Las clases de días pasados sin registro (que no estén excluidas por día especial).
  - Las fichadas `sin_clase` o de llaveros desconocidos no resueltas.
- **El "a revisar" no bloquea:** Juan puede generar los recibos igual; `/recibos` lo avisa.
- **Generación de recibos:**
  1. Desde el calendario, "Generar recibos" lleva a `/recibos?periodo=YYYY-MM`, con la vista previa de todos.
  2. Juan genera **cada recibo por separado**.
  3. Cada recibo tiene un estado:
     - **Sin generar:** todavía no existe.
     - **Generado:** coincide con lo que se calcula hoy.
     - **Desactualizado:** el registro cambió después de generarlo (cambió el total, las horas, el precio o las clases). Se vuelve a generar.
- **El cálculo vive en un solo lugar** (`lib/asistencia/liquidacion.ts`), así la tabla del calendario y los recibos muestran lo mismo.
- **El precio de cada clase se toma al generar el recibo.** Si después cambia el precio de un curso y se regenera un mes viejo, se recalcula con el precio nuevo.

---

## 9. API

### Kiosco
**Auth:** `Authorization: Bearer <token>`. El servidor calcula el sha256 y busca un `Dispositivos` activo con ese hash. Si no lo encuentra, responde 401.

**`POST /api/fichar`**
```ts
// Request
{ idLocal: string; uid: string; horaDispositivo: string /* ISO */; offline: boolean }

// Response
type RespuestaFichada =
  | { ok: true; tipo: "entrada"; nombre: string; cargo: "Secretaria"; hora: string }
  | { ok: true; tipo: "salida"; nombre: string; cargo: "Secretaria"; hora: string; duracion: string }
  | { ok: true; tipo: "clase"; nombre: string; cargo: "Profesora"; hora: string; curso: string;
      horario: string; esReemplazo: boolean; minutosTarde: number; diaEspecial?: string }
  | { ok: true; tipo: "sin_clase"; nombre: string; cargo: "Profesora"; hora: string; mensaje: string }
  | { ok: true; tipo: "ya_registrado"; nombre: string; mensaje: string }
  | { ok: false; motivo: "llavero_desconocido" | "llavero_baja" | "personal_inactivo" | "dispositivo_invalido" | "error";
      mensaje: string };
```
- **Idempotencia:** si ya existe `Fichadas/{idLocal}`, se devuelve la respuesta reconstruida.
- **Siempre se escribe la `Fichada`**, también en los casos de error de negocio.
- **Validación:** se valida la forma del request, el `uid` se normaliza en el servidor y nunca se exponen stack traces.

**`GET /api/ping`** responde `{ ok: true, horaServidor }` y de paso actualiza `ultimoContactoEn`.

### Panel
- **Lectura y escritura:** el client SDK, protegido por reglas.
- **API routes:** solo para lo que necesita el servidor. Validan el ID token con `verifyIdToken` y chequean `Administradores`.
  - `POST /api/recibos/enviar`: genera el PDF y lo envía con Resend.
  - `POST /api/recibos/generar` (opcional): genera y guarda el PDF.

---

## 10. UI del kiosco (`/kiosco`)
Respetar la sección 10 de `STYLE.md`.

- **Una sola pantalla a pantalla completa:** reposo con reloj y "Acercá tu llavero", y el resultado durante 4 o 5 segundos con nombre, cargo y la línea principal.
- **Errores:** en rojo, con un mensaje claro. **Feedback:** sonido o vibración distintos para éxito y error.
- **Offline:**
  - Una cola persistente (IndexedDB, o localStorage con try/catch).
  - Reintenta cada 15 segundos y al recibir el evento `online`.
  - Muestra el badge "Sin conexión · N pendientes".
- **Pantalla encendida:** Wake Lock API.
- **`/kiosco/configurar`:** se accede con un toque largo en el logo y un PIN. Ahí se pega el token y se prueba la lectura.

## 11. Panel de Juan

### Rutas
| Ruta | Qué es |
|---|---|
| `/login` | Login con email y contraseña (Firebase Auth). Si ya hay sesión de director, pasa directo al calendario. |
| `/` | **Calendario** (pantalla principal). Acepta `?periodo=YYYY-MM`. |
| `/recibos` | Vista previa y generación de recibos de un mes (`?periodo=YYYY-MM`). |
| `/carga` | **Carga de datos**: pestañas Carga de personal, Precio/hora - Secretarias, Cursos y profesoras, Carga de asistencia manual (correcciones con motivo e historial) y Feriados / Fechas especiales. Acepta `?tab=personal\|precios\|cursos\|registros\|feriados`. |

- **Acceso:** las rutas del panel están en el grupo `app/(panel)`. Su layout (`components/panel/PanelShell.tsx`) exige una sesión de director activo en `Administradores`. Sin sesión, manda a `/login`; con una cuenta que no es director, muestra "No podés entrar al panel".
- **Layout:** header blanco con el saludo ("Hola, Juan"), la navegación entre secciones (en pantallas chicas, solo íconos) y "Salir". **Todavía no hay sidebar** como en el panel del instituto.

### Calendario (`/`)
- Usa `CalendarioAsistencia.tsx`, que es presentacional: la página (`app/(panel)/calendarioPagina.tsx`) carga los datos del mes con `useDatosDelMes` y los pasa.
- **Datos que recibe:** `empleados`, `jornadas`, `clases` (`ClaseCalendario[]`, con `titularIds` y `contarIgual`), `diasEspeciales`, `pendientes`, `montos` (precio y total a cobrar por persona) y `recibos` (cuántos están generados o desactualizados).
- **Personal que aparece:** las personas activas y las inactivas que tuvieron actividad en el mes.
- **Tabla de resumen:** nombre, cargo, total del mes (horas o clases), **precio** (por hora, o por clase o promedio) y **total a cobrar**.
- **Botón de abajo:** "Generar recibos" lleva a `/recibos?periodo=…`.
- **Clases desde el calendario** (`onEditarClase`, modal en `components/panel/calendario/ModalClase.tsx`):
  - Una clase de hoy o de un día pasado **sin registro** (o anulada) muestra el botón **Asignar**: Juan elige quién la dio (titulares primero; si elige a otra, queda como reemplazo) y un motivo. Se guarda con `crearClaseManual` (`origen: "manual"`), igual que desde Carga de datos.
  - Una clase ya dada muestra el lápiz: cambiar quién la dio, marcar "contar igual" o anularla, siempre con motivo y con el historial a la vista.
- **Callbacks sin conectar** (`onAgregarJornada`, `onEditarJornada`, `onAgregarDiaEspecial`, `onEditarDiaEspecial`, `onResolverPendiente`): esos botones no aparecen. Las jornadas se corrigen en Carga de datos → Registro de asistencia.
- **Exclusión:** el componente exporta `diaEspecialQueExcluye(clase, dias)`, la lógica de §7.3. La liquidación la reutiliza; también hay que usarla en el servidor si algún día los recibos se generan ahí.

### Recibos (`/recibos`)
- Indicadores: total a pagar del mes, recibos generados, para regenerar y sin generar.
- Avisos: registros "a revisar" del calendario y precios faltantes.
- Una tarjeta por persona con la vista previa del recibo. En el caso de las profesoras, se puede desplegar el detalle de cada clase cobrada.
- Cada tarjeta tiene su estado y dos botones:
  - **Ver detalle:** abre el recibo con el diseño de Juan. Si ya está generado y al día, muestra la imagen guardada; si no, una vista previa sin número. Se puede descargar.
  - **Generar recibo** / **Volver a generar:**
    1. Guarda los datos con su número (transacción).
    2. Dibuja el recibo fuera de pantalla, lo convierte en JPG en el navegador (`html-to-image`) y lo guarda en `RecibosImagenes`.
    3. Si el paso 2 falla, la tarjeta avisa "falta la imagen" y ofrece **Guardar imagen**, que reintenta solo ese paso.

### Pendiente
- **Llaveros:** los `SinAsignar` aparecen solos; Juan les pone número y persona, los da de baja o los reasigna.
- **Días especiales:** alta, edición y baja, de día completo o parcial, para todos los cursos o solo algunos.
- **Reemplazos:** carga rápida para hoy o los próximos días, con su listado.
- **Recibos:** PDF, descarga, envío por email y estado de envío.
- **Dispositivos:** último contacto del kiosco y desactivar un token.

### Lecturas
- Se carga por mes con `where("fecha", ">=", "YYYY-MM-01")` y `where("fecha", "<=", "YYYY-MM-último")`. Personal y Cursos se leen enteros, en vivo.
- **Fichadas pendientes:** `where("resultado", "in", ["sin_clase", "llavero_desconocido"])` más el rango de fecha. Necesita el índice compuesto `Fichadas (resultado, fecha)`, creado en la consola de Firebase. Si falta el índice, el calendario sigue funcionando sin pendientes y muestra un aviso.
- **Recibos del mes:** `where("periodo", "==", "YYYY-MM")`.

## 12. Recibo
- **Diseño:** el de la plantilla de Juan, en `components/panel/recibos/DisenoRecibo.tsx` (A4 a 595 × 842 px):
  - **Encabezado:** logo (`public/logo-empire.png`), "RECIBO" y una línea navy gruesa.
  - **Datos:** "Apellido, Nombre" y DNI a la izquierda; N°, fecha de emisión ("04 DE SEPTIEMBRE DEL 2026") y período a la derecha.
  - **Tabla:** Concepto / Cantidad / Precio / Total.
  - **Cierre:** el TOTAL, el monto en letras ("PESOS … CON 00 CENTAVOS") y la onda del pie con "ABRIENDO LAS PUERTAS AL FUTURO".
- **Tipografías del recibo:** Archivo Black ("RECIBO") y League Spartan (el resto), con `next/font/google`, que las sirve desde el propio sitio. Solo se usan en el recibo; el panel sigue con Arial.
- **Renglones:**
  - **Secretaria:** uno solo: "Secretaria", las horas ("96 HS" o "21 HS 10 MIN"), el precio por hora y el total.
  - **Profesora:** uno por curso: "KINDER A (60%)", "12 AL", lo que le toca por alumno (monto fijo × %) y el total. Después los reemplazos, agrupados por curso y valor de la clase: "REEMPLAZOS (KINDER A)" suma y "DESC. REEMPLAZOS (KINDER A)" resta (total en negativo). Los recibos viejos (por clase) se siguen mostrando con un renglón por curso y precio.
- **Funciones puras:** el monto en letras está en `lib/asistencia/numeroALetras.ts`; el armado de los datos y renglones, en `lib/asistencia/reciboImpreso.ts`.
- **Contenido:**
  - **Secretarias:** nombre, período, horas trabajadas, precio por hora y total a cobrar.
  - **Profesoras:** nombre, período, clases dadas, el pago mensual de cada curso (alumnos × monto × %), total a cobrar y el detalle de cada clase (fecha, curso, horario y si fue reemplazo).
- **Formato guardado:** imagen JPG en `RecibosImagenes` (ver §7.13). Por ahora no se manda por email: la idea es que cada persona pueda ver sus recibos más adelante.
- **Destinatario:** `Personal.email`.

---

## 13. Reglas de Firestore
Están en `firestore.rules`. No se usa Firebase CLI: Nicolás las copia a mano en la consola.

- **Helper:** `isDirector()` devuelve verdadero si existe `Administradores/{request.auth.uid}` con `rol == "director"` y `activo == true` (**booleano**, no el texto `"true"`).
- **Nunca se borra un registro:** `delete` está prohibido en `Personal`, `Cursos`, `Jornadas`, `ClasesDictadas`, `Llaveros`, `Cierres` y `Recibos`. `DiasEspeciales` y `Reemplazos` sí se pueden borrar.
- **Validaciones** (todas exigen `isDirector()`):
  - `Personal`: nombre, apellido, email, `dni` nulo o de 7 u 8 dígitos, `rol` válido, `activo` booleano y `precioHora` nulo o número ≥ 0.
  - `Cursos`: nombre, `activo`, listas de profesoras del mismo largo, al menos un horario, vigencia válida, `montoFijo` nulo o número ≥ 0, `cantidadAlumnos` nulo o entero ≥ 0 y `porcentajes` un mapa.
  - `Jornadas` y `ClasesDictadas`:
    - Desde el panel solo se crean con `origen: "manual"`.
    - Al editarlas, el `historial` solo puede crecer y cada cambio nuevo lleva motivo y `por == request.auth.uid`.
    - En `ClasesDictadas`, el id tiene que coincidir con `cursoId_fecha_HHMM`.
  - `DiasEspeciales`: fecha, descripción y, si es parcial, `desde < hasta`.
- **`Fichadas`:** `read` solo si `isDirector()`; `update` solo del campo `resuelta`; `create` y `delete` prohibidos (solo escribe el Admin SDK).
- **`Administradores`:** `read` solo del propio documento; `write: if false` (se crea desde la consola o el script).
- **`Dispositivos`:** `read, write: if false`.
- **`RecibosImagenes`:** `read` y `write` solo si `isDirector()`; la imagen tiene que ser un JPG en data URL de menos de 1.000.000 de caracteres. No se borra.
- **`Contadores`:** solo `isDirector()`; `ultimo` es entero y solo puede avanzar.
- **Cuando las profesoras y secretarias puedan ver sus recibos**, hay que sumar reglas de lectura para que cada una vea solo los suyos.
- **Índices** (creados en la consola): `Fichadas (resultado ASC, fecha ASC)`.

## 14. Convenciones de trabajo
- **Forma de trabajo:** de a un issue por vez. Nicolás hace sus propias modificaciones entre sesiones.
- **Entregas:** componentes completos y listos para pegar. Si hace falta agregar props o funciones nuevas a algo que ya existe, avisarlo antes.
- **Lecturas:** minimizar las lecturas de Firebase y desnormalizar al escribir.
- **Commits:** convencionales (`feat:`, `fix:`, `refactor:`...).
- **Lógica de dominio:** va en funciones puras en `lib/asistencia/`, con tests en Vitest. Incluye:
  - Clases esperadas del mes.
  - Ventana de clase.
  - Exclusión por día especial.
  - Alternancia entrada/salida.
  - Helpers de hora AR.
  - `normalizarUid`.
  - Formato de duración y totales del mes.
- **Estilo:** todo según `STYLE.md`.

### Estructura del código
| Archivo | Qué tiene |
|---|---|
| `firebaseConfig.ts` / `lib/firebase.ts` | Inicialización del client SDK; exporta `db` y `auth`. |
| `lib/sesion.ts` | Login, logout, verificación de director y el hook `useSesion`. |
| `lib/asistencia/tipos.ts` | Tipos de dominio (la UI trabaja con `Date`, no con `Timestamp`). |
| `lib/asistencia/fechas.ts` | Helpers de fecha y hora AR, períodos y formato de duración. |
| `lib/asistencia/dinero.ts` | `formatPesos` y redondeo a centavos. |
| `lib/asistencia/repositorio.ts` | Lecturas y escrituras de Carga de datos (personal, precios por hora, cursos, jornadas, clases, días especiales). |
| `lib/asistencia/feriados.ts` | Puro: feriados nacionales y de La Rioja predeterminados, combinados con los días guardados. |
| `lib/asistencia/calendario.ts` | Puro: clases esperadas del mes cruzadas con las dictadas y conteo de lo que hay "a revisar". |
| `lib/asistencia/liquidacion.ts` | Puro: lo que cobra cada persona y el estado de su recibo. |
| `lib/asistencia/repositorioCalendario.ts` | Suscripción a los datos del mes y `generarRecibo`. |
| `lib/asistencia/useDatosDelMes.ts` | Hook compartido por el calendario y los recibos. |
| `lib/asistencia/reciboImpreso.ts` / `numeroALetras.ts` | Puro: datos y renglones del recibo impreso, y el monto en letras. |
| `components/panel/recibos/DisenoRecibo.tsx` / `capturarRecibo.tsx` | El diseño del recibo y su conversión a JPG. |
| `components/panel/…` | `PanelShell` (guard y header), `carga/*`, `recibos/*`. |

---

## 15. Plan por fases

**Fase 0: Setup**
- [x] Proyecto Firebase `asistencia-english-empire` (Auth email/contraseña y Firestore).
- [ ] Proyecto Firebase de prueba.
- [x] Scaffold de Next con TypeScript y Tailwind. `components/ui/*`, `lib/utils.ts` y `globals.css` copiados.
- [ ] Vitest y tests de la lógica pura. Falta también el logo.
- [x] `lib/firebase.ts` (client) y `lib/asistencia/*`.
- [ ] `lib/firebaseAdmin.ts`.
- [ ] Scripts `crear-director.ts` y `crear-dispositivo.ts`. Hoy el director se crea a mano desde la consola.
- [x] Reglas e índices.

**Fase 1: Panel base**
- [x] Login y layout (header con navegación; falta el sidebar).
- [x] Personal y Cursos (con precio por clase), en Carga de datos.
- [x] Precio por hora de cada secretaria (tab de Carga de datos).
- [x] Feriados nacionales/provinciales y días especiales del instituto (tab de Carga de datos).
- [ ] Llaveros.

**Fase 2: Kiosco**
- [ ] `POST /api/fichar` (toda la sección 8) y `GET /api/ping`.
- [ ] `/kiosco`: Web NFC, input de teclado, cola offline y `/kiosco/configurar`.
- [ ] Probar en el celular real con llaveros reales.

**Fase 3: Control**
- [x] Calendario con `CalendarioAsistencia.tsx` conectado a Firestore, con días especiales, precios y total a cobrar.
- [x] Correcciones con historial en Carga de datos → Registro de asistencia.
- [x] Asignar o corregir clases desde el calendario (`onEditarClase`).
- [ ] Conectar el resto de los callbacks del calendario (jornadas, días especiales, pendientes).
- [ ] Pantallas de reemplazos y días especiales.

**Fase 4: Recibos**
- [x] Cálculo de lo que cobra cada persona y vista previa en `/recibos`.
- [x] Generación por persona, con versión y estado "desactualizado".
- [x] Diseño del recibo (plantilla de Juan), imagen JPG guardada, numeración correlativa por año y "Ver detalle" con descarga.
- [ ] Acceso de profesoras y secretarias a sus propios recibos.

**Fase 5: Deploy.** Netlify, subdominio y configuración del dispositivo en el instituto.

**Opcional:** bloqueo de mes.

## 16. Decisiones pendientes
1. ¿Quién carga reemplazos? Por defecto, solo Juan.
2. Confirmar con Juan los 45 minutos de anticipo de la ventana de clase.
3. Una profe con dos clases seguidas, ¿ficha una vez por clase? Por defecto, sí.
4. La plantilla del recibo (diseño de Canva).
5. Si se usa lector USB, en qué formato emite el UID.
6. El subdominio definitivo.
7. ¿El precio de cada clase se congela cuando se registra la clase (guardándolo en la `ClaseDictada`) o se toma del curso al generar el recibo, como ahora?
8. ¿Hace falta un botón "Generar todos" en `/recibos`, o se mantiene de a una persona?
9. ¿Los recibos de personas sin actividad en el mes (total $0) se generan igual?