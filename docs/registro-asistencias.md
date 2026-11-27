# Registro de Asistencias (personal)

Asistencia de **secretarias** y **profesoras** (llaveros NFC) y los **recibos** de lo que cobra cada una.
Antes era un proyecto aparte (`asistencia-english-empire`, con su propio Firebase). Ahora vive dentro del panel de admin y usa la base `english-empire-2026`.

Las reglas de negocio (cómo se cobra, reemplazos, días especiales, fichadas, kiosco) siguen siendo las del documento original del sistema, copiado en [asistencia/sistemaContexto.md](asistencia/sistemaContexto.md), junto con su guía visual [asistencia/style.md](asistencia/style.md). Acá está **lo que cambió al integrarlo**.

## Rutas

| Ruta | Qué es | Quién la ve |
|---|---|---|
| `/admin/registro-asistencias` | Calendario del mes (`?periodo=YYYY-MM`) | Todos. Las secretarias lo ven sin métricas, sin montos y sin la parte de recibos |
| `/admin/registro-asistencias/recibos` | Vista previa y generación de recibos | Solo director |
| `/admin/registro-asistencias/carga` | Carga de datos (`?tab=`) | Director: las 5 tabs. Secretarias: `registros` y `feriados` |

**Inicio del registro:** `ConfiguracionAsistencia/general.fechaInicio` ("YYYY-MM-DD"). La elige el director en Carga de datos; por defecto es `2026-11-01`.
- Antes de esa fecha no se esperan clases ni hay pendientes "sin registro", y el calendario y los recibos no dejan ir a meses anteriores.
- La carga manual no acepta días anteriores.
- No cambia los montos: el pago mensual y el valor por clase de los reemplazos salen de los horarios del mes completo.

**Motivo de cada corrección:** al cargar a mano una clase de su titular, el motivo se pide como "Motivo del registro manual" (ej.: se olvidó el llavero). Si la dio otra profesora (reemplazo), o si se edita algo ya registrado, se pide como "Motivo del cambio".

Los permisos de pantalla están en `lib/asistencia/permisos.ts`. **La protección real está en `firestore.rules`** (`isDirector()`).
"Director" = `Admins/{uid}.esDirector == true`. Cualquier otro usuario del panel (secretario o admin) ve la versión reducida.

## Modelo de datos

### Personas
- **Secretarias** → `Personal/{uid}`: `nombre, apellido, email, dni, rol: "secretaria", activo, llaveroUid, jornadaAbiertaId, ultimaFichadaEn`.
  - Son las cuentas del panel con `rol: "secretario"` (`Admins/{uid}`): el doc de `Personal` tiene **el mismo id** que su cuenta, igual que las profesoras con `Teachers`.
  - **Traer secretarias del panel** (Carga de personal): aparece mientras haya cuentas de secretario sin su doc en `Personal`. El director revisa el nombre y el apellido (en `Admins` están juntos y se separan por la última palabra) y se crean de una vez. El DNI se carga después.
  - Una secretaria nueva desde Carga de personal crea su cuenta del panel (Auth + `Admins` con rol secretario + mail para la contraseña) con `lib/services/adminsServices.ts`.
  - El email no se cambia desde el registro, porque es el de la cuenta. El `activo` del registro (si puede fichar) es independiente del `activo` de `Admins` (si puede entrar al panel).
- **Profesoras** → `Teachers/{uid}`: son las mismas cuentas del portal docente. No hay colección aparte.
  - Si se da de alta una profesora desde Carga de personal, se crea la cuenta (Auth + `Teachers` + mail para la contraseña) con `lib/services/teachersServices.ts`, igual que en Configuración.
  - El email no se cambia desde el registro, porque es el de la cuenta.
  - Sus cursos se asignan desde Carga de personal (ícono de libro o celda "Cursos"). El modal escribe en `Teachers.cursosAsignados`, igual que Configuración → Gestionar profesores, y guarda al instante.
  - El rol no cambia después del alta: secretarias y profesoras viven en colecciones distintas.
- **`PersonalLiquidacion/{personalId}`** → `{ precioHora }`. Solo director. Va aparte porque las secretarias leen `Personal`.

### Cursos
- **`Cursos/{id}`** → los de Admin → Cursos. El registro solo los lee:
  - **Horarios:** se interpretan del mapa de texto (`{"Lunes": "18:00 - 19:30, 20:00 - 21:00"}`) en `lib/asistencia/cursosInstituto.ts`. Los horarios sin hora de fin o "A definir" **no generan clases esperadas**, y la tab Liquidación de cursos lo avisa.
  - **Vigencia:** sale de `inicioMes`/`finMes`, con el año del mes que se está mirando.
- **Profesoras del curso** → `Teachers.cursosAsignados`, la misma asignación de Configuración → Gestionar profesores. Cobran su pago mensual.
- **Días de cada una** → `Teachers.diasAsignados = { [cursoId]: [1, 3] }` (1 = lunes … 7 = domingo). Se reparten en Liquidación de cursos (`lib/asistencia/titulares.ts`):
  - Las **titulares de una clase** son las profesoras del curso que tienen ese día. Un día puede tener varias (dan juntas).
  - Si una profesora tiene el curso pero **no tiene días cargados** para ese curso, da todos los días. Así siguen funcionando las asignaciones anteriores y las que se hacen desde Configuración (que asigna el curso entero). El curso avisa "Falta repartir los días" si tiene dos o más profesoras en esa situación, y "Sin profesora" si queda un día sin titular.
  - Si da la clase una profesora que no tiene ese día, **es reemplazo**, aunque sea del curso. Su llavero le da "sin clase" ese día y el director la asigna desde el calendario.
  - Si una clase es reemplazo se calcula con las titulares actuales (no con lo que se guardó al registrarla): al repartir los días se recalcula todo el mes, y los recibos ya generados quedan "desactualizados".
  - Quitar un curso desde Carga de personal o Liquidación de cursos borra también sus días. Desde Configuración → Gestionar profesores no: si se vuelve a asignar, recupera los días viejos.
- **`CursosLiquidacion/{cursoId}`** → `{ montoFijo, porcentajes: {teacherUid: %}, cantidadAlumnosManual }`. Solo director.
  - Va aparte porque `Cursos` es de lectura pública.
  - **Alumnos:** se cuentan los inscriptos (`Users` + `Hijos` con el curso en `cursos`, usando `getCountFromServer`). Si `cantidadAlumnosManual` no es null, se usa esa.

### Registros y recibos
| Colección | Quién | Notas |
|---|---|---|
| `Jornadas`, `ClasesDictadas`, `DiasEspeciales`, `Fichadas`, `Reemplazos` | Todo el panel | Cada corrección exige motivo y queda en `historial` |
| `RecibosPersonal/{personalId}_{YYYY-MM}` | Solo director | Antes `Recibos`. Tiene el cálculo (con porcentajes) y la `edicion` a mano |
| `RecibosPersonalImagenes/{id}` | Director + la dueña | Imagen JPG del recibo. Antes `RecibosImagenes` |
| `RecibosPersonalPublicados/{id}` | Director + la dueña | Resumen para "Mis recibos": período, número, fecha, nombre y total. Se publica junto con la imagen |
| `Contadores/recibos-YYYY`, `Llaveros`, `Cierres` | Director | |
| `ConfiguracionAsistencia/general` | Lee todo el panel, escribe el director | `fechaInicio` del registro |
| `Dispositivos` | Solo servidor | Tokens del kiosco |

Los nombres están centralizados en `COL` (`lib/asistencia/repositorio.ts`).

## Código

- `lib/asistencia/`: lógica pura (calendario, liquidación, feriados, recibo impreso) más los dos repositorios de Firestore y el hook `useDatosDelMes`.
- `components/admin/asistencia-personal/`: calendario, carga de datos y recibos.
- `app/admin/registro-asistencias/`: páginas y navegación de la sección.

## Puesta en marcha

1. Publicar `firestore.rules` en la consola de Firebase. Incluye un arreglo en `Admins`: un secretario ya no puede ponerse `esDirector: true`.
2. Crear el índice compuesto `Fichadas (resultado ASC, fecha ASC)`. Si falta, el calendario funciona igual, pero sin las fichadas para revisar, y muestra un aviso con el link para crearlo.
3. Verificar que el doc de `Admins` del director tenga `esDirector: true`.

## Lector y llaveros (`/admin/registro-asistencias/lector`)

La ve todo el panel; solo el director edita. Las secretarias **no tienen horario fijo**: cobran por las horas entre su entrada y su salida (las registra el lector o se cargan a mano).

- **Historial de registros:**
  - Muestra cada entrada y salida de secretarias (una fila por movimiento, sacada de `Jornadas`), cada clase registrada de profesoras (`ClasesDictadas`) y los avisos del lector (`Fichadas` que no generaron un movimiento: toque repetido, sin clase, llavero sin asignar…).
  - Filtros por fechas, tipo y persona.
  - Cada fila indica si vino del lector o se cargó a mano, y si está corregida, anulada o sin salida.
- **El director corrige movimientos de a uno** (`lib/asistencia/repositorioLector.ts`), siempre con motivo:
  - Agregar una entrada (hoy queda abierta para que el llavero la cierre) o una salida (cierra la última entrada sin salida del día).
  - Corregir la hora de una entrada o de una salida.
  - Anular una entrada (anula la jornada) o una salida (la jornada queda sin salida).
  - Marcar avisos como revisados.
  - Las clases se corrigen desde el calendario.
- **Llaveros:** aparecen solos la primera vez que se apoyan en el lector (`Llaveros/{UID de fábrica}`, con el número grabado 101…110). El director los asigna, los quita, los da de baja o los reactiva; el kiosco también puede asignarlos.
  - **Cargados de antemano** (botón temporal "Crear llaveros 101 a 110"): `Llaveros/num-101`… con `pendienteDeLectura: true`, porque todavía no se conoce su UID. Se pueden asignar igual.
  - **Regla para el kiosco:** si lee un UID desconocido cuyo número grabado tiene un pendiente (`num-{numero}`), en una transacción:
    1. Crear `Llaveros/{UID}` con los datos del pendiente (número, estado, `personalId`).
    2. Si estaba asignado, cambiar el `llaveroUid` de la persona (en `Personal` o `Teachers`) a ese UID.
    3. Borrar el pendiente.
    4. Seguir con el fichaje normal.

    Si el llavero no tiene el número grabado, se crea como llavero nuevo sin asignar.

## API para la aplicación de escritorio

La aplicación de escritorio no escribe en Firestore. Manda cada toque al servidor, y la lógica está en `lib/asistencia/servidor/fichar.ts` (las reglas de bloques en `lib/asistencia/bloques.ts`).

**Token de la computadora:**
- Es aleatorio (`eedisp_…`, 32 bytes) y se entrega una sola vez al vincular la computadora.
- En `Dispositivos` se guarda solo su huella SHA-256 (`tokenHash`), con `nombre`, `activo`, `creadoEn` y `ultimoContactoEn`. Las reglas no dejan leer ni escribir esa colección desde el navegador.

| Ruta | Auth | Qué hace |
|---|---|---|
| `POST /api/fichar` | `Bearer <token de la PC>` | Body: `{ idLocal, uid, numero?, horaDispositivo (ISO), offline }`. Devuelve `RespuestaFichada`. Los resultados de negocio van con 200; 401 = PC no vinculada o desactivada; 400 = pedido mal formado; 503 = reintentar |
| `GET /api/ping` | `Bearer <token de la PC>` | Prueba la conexión y actualiza el último contacto |
| `GET /api/asistencia/dispositivos` | `Bearer <ID token del director>` | Lista las computadoras |
| `POST /api/asistencia/dispositivos` | `Bearer <ID token del director>` | `{ nombre }` → vincula una PC y devuelve `{ id, nombre, token }` una sola vez |
| `POST /api/asistencia/dispositivos/estado` | `Bearer <ID token del director>` | `{ id, activo }` → desactiva o reactiva una PC |

**Comportamiento de `/api/fichar`:**
- Cada toque deja una `Fichada` en `Fichadas/{idLocal}`, con la respuesta guardada. Si se reenvía el mismo `idLocal`, devuelve la misma respuesta sin duplicar nada.
- Un toque offline usa la hora de la computadora; si es de hace más de 48 h, o del futuro, queda marcado con `revisarHora`.
- Llavero desconocido: se registra solo. Si coincide con un pendiente `num-{numero}`, se vincula.
- Secretarias: entrada y salida en `Jornadas`.
- Profesoras: un toque por bloque crea las `ClasesDictadas` del bloque. Solo cuentan las clases de los días que da ella.
- Antirrebote de 60 s.
- **Todavía no contempla `Reemplazos`:** una reemplazante queda como "sin clase" y el director lo corrige desde el calendario.
- Las computadoras se administran en la web: Lector y llaveros → Computadoras (solo el director).

## Auditoría (solo para el desarrollador)

Cada carga o corrección manual (jornadas, movimientos, clases, días especiales, llaveros, avisos revisados) escribe en el mismo batch un doc en `AuditoriaAsistencia`: acción, colección, id, motivo, detalle, `porUid`, `porEmail` y fecha.
- Las reglas permiten crearlo solo firmado por quien hace el cambio, y **nadie lo puede leer desde la app**: se consulta desde la consola de Firebase.
- **Importante:** si se publica una versión de la app con auditoría sin haber publicado las reglas nuevas, las cargas manuales fallan (el batch entero se rechaza).

## Cómo se calcula lo que cobra una profesora (`lib/asistencia/pagoCursos.ts`)

1. **Pago mensual** (lo que paga Juan) = monto fijo × cantidad de alumnos × porcentaje.
   - No usa los horarios ni depende de las clases que dio.
   - Si es titular de varios cursos, se suma lo de cada uno.
   - Ej.: Kinder A con Fio: 49.000 × 8 × 45% = **176.400**.
2. **Pago por clase (estimado)** = pago mensual ÷ clases que **ella** tiene en el curso en el mes.
   - Las clases del mes son los días del mes que caen en los días de la semana que da ella en el curso (todos los del curso si no se repartieron).
   - Cada día cuenta una vez, aunque tenga dos horarios, y aunque el horario no tenga hora de fin.
   - Los feriados se cuentan igual.
   - Ej.: lunes y miércoles en noviembre 2026 = 5 + 4 = 9 → 176.400 ÷ 9 = **19.600**. Si Fio da solo los lunes: 176.400 ÷ 5 = **35.280**.
   - Solo se usa para el valor de un reemplazo: se le descuenta a la titular y lo cobra la reemplazante.

## Mis recibos (cada persona ve los suyos)

- **Profesoras:** en el inicio del portal docente, sección "Mis recibos de sueldo". Se buscan por `personalId == uid` (su doc de `Teachers`).
- **Secretarias:** en el panel de admin, "Mis recibos" (solo para el rol `secretario`, en `/admin/mis-recibos`). Se buscan por `personalId == uid` de su cuenta del panel (es el id de su doc de `Personal`). Las reglas también aceptan el email de la cuenta, para recibos de secretarias cargadas antes con otro id.
- Se leen de `RecibosPersonalPublicados`, que no tiene porcentajes ni montos fijos. Se publica recién cuando se guarda la imagen, así que siempre corresponde a una imagen lista.

## Recibo impreso y edición a mano

- El recibo no imprime el porcentaje de la profesora. Cada curso es un renglón: "KINDER A", "8 AL", lo que le toca por alumno y el total.
- **Editar recibo:** el director puede cambiar todo lo que se imprime (nombre, DNI, fecha de emisión y renglones), salvo el número, que es correlativo.
  - El total es la suma de los renglones; para descontar algo se pone el total en negativo.
  - Se guarda en `RecibosPersonal.edicion` y se genera la imagen con eso.
  - El recibo queda marcado "Editado a mano", y lo que se paga es `edicion.total` (`totalDelRecibo`).
- Lo calculado se guarda igual: si después cambia el registro, el recibo aparece "desactualizado".
  - "Volver a generar" descarta la edición, previa confirmación.
  - "Editar recibo" la mantiene y avisa si el cálculo cambió.
- Las reglas (`puedeVerRecibo` en `firestore.rules`) solo dejan leer los propios. Las secretarias tienen que estar activas en `Admins`.
- Código: `lib/asistencia/misRecibos.ts` y `components/recibos-personal/MisRecibos.tsx`.

## Pendiente (fases del sistema original)

- Kiosco (`/kiosco`) y API (`POST /api/fichar`, `GET /api/ping`): se hacen en esta misma app, reutilizando `lib/firebaseAdmin.ts`.
- Pantalla de llaveros, reemplazos y días especiales parciales.
- Envío de recibos por email.
