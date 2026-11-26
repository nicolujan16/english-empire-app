# Guía de estilo: Sistema de asistencia (basada en el panel admin de English Empire)

> **Para Claude Code:** este proyecto tiene que verse como el panel de administración de `english-empire-app`. Todo lo de esta guía sale del código real de ese panel. No inventes colores, radios ni patrones nuevos: si algo no está acá, copiá el patrón más parecido que sí esté.

---

## 1. Stack visual

- **Tailwind CSS v4** (`@import "tailwindcss"` + `@theme inline`). No hay `tailwind.config`.
- **shadcn/ui** (variante mínima) en `components/ui/`: `button`, `dialog`, `input`, `label` y `avatar`. Copialos tal cual desde `english-empire-app/components/ui/`, junto con `lib/utils.ts` (`cn()` = `clsx` + `tailwind-merge`).
- **Dependencias:** `@radix-ui/react-dialog`, `@radix-ui/react-slot`, `@radix-ui/react-avatar`, `class-variance-authority`, `clsx`, `tailwind-merge`, `framer-motion` y `lucide-react`.
- **Fuente:** `Arial, Helvetica, sans-serif`, definida en `globals.css`. No se usan Google Fonts.
- **Logo:** `assets/logo-empire.png`. Va sobre una caja blanca redondeada dentro del sidebar azul.

## 2. Colores

### 2.1 Marca (se usan como valores arbitrarios de Tailwind)

| Token | Hex | Uso |
|---|---|---|
| **Navy** | `#252d62` | Color principal: sidebar, títulos, íconos, botones primarios, textos de montos y totales y bordes de botones outline. |
| Navy hover | `#1a2046` | Hover de los botones navy. |
| Navy oscuro | `#1a2248` | Fondo de tooltips. |
| **Rojo** | `#EE1120` | CTA principal de la página (la acción "fuerte"), cerrar sesión y alertas destructivas. |
| Rojo hover | `#c4000e` | Hover de los botones rojos. |
| Índigo | `#4338ca` | Acento secundario: hovers de cards clickeables y links internos. |
| Texto de diálogo | `#2a2e5b` | Títulos de diálogos de confirmación. |

### 2.2 Neutros
- **Fondo de la app:** `bg-gray-50`. **Superficies:** `bg-white`.
- **Bordes:** `border-gray-100` en cards y `border-gray-200` en inputs y selects.
- **Texto:**
  - Principal: `text-gray-900`.
  - Secundario: `text-gray-500`.
  - Terciario y hints: `text-gray-400`.
  - Labels: `text-gray-700`.
- **Filas:** separador `divide-gray-50` y hover `hover:bg-gray-50`.

### 2.3 Colores semánticos (badges, alertas y estados)
Siempre fondo claro con texto oscuro del mismo tono: `bg-{c}-50 text-{c}-700 border border-{c}-100`.

| Significado | Clases |
|---|---|
| Éxito / Presente / OK | `bg-green-50 text-green-700 border-green-100` |
| Advertencia / Tarde / Revisar | `bg-amber-50 text-amber-700 border-amber-100` |
| Error / Ausente | `bg-red-50 text-red-700 border-red-100` |
| Info / Navy suave | `bg-indigo-50 text-[#252d62] border-indigo-100` |
| Neutro / Inactivo | `bg-gray-100 text-gray-500` |
| Categorías extra | `bg-blue-50 text-blue-700`, `bg-purple-50 text-purple-700` |

### 2.4 Estados propios del sistema de asistencia
Mantener **siempre** este mapeo, en el kiosco y en el panel:

| Estado | Badge | Ícono lucide |
|---|---|---|
| Jornada completa | `bg-green-50 text-green-700 border-green-100` | `CheckCircle2` |
| Jornada sin salida (incompleta) | `bg-amber-50 text-amber-700 border-amber-100` | `AlertTriangle` |
| Clase dada | `bg-green-50 text-green-700 border-green-100` | `UserCheck` |
| Clase por reemplazo | `bg-indigo-50 text-indigo-700 border-indigo-100` | `Repeat` |
| Llegada tarde | `bg-amber-50 text-amber-700 border-amber-100` | `Clock` |
| Sin registro (día pasado) | `bg-amber-50 text-amber-700 border-amber-100` | `AlertTriangle` |
| Programada (día futuro) | `bg-gray-100 text-gray-500` | `CalendarDays` |
| Anulada | `bg-gray-100 text-gray-400 line-through` | `Ban` |
| Fichada offline | `bg-gray-100 text-gray-600` | `WifiOff` |
| Día especial / clase excluida | `bg-sky-50 text-sky-700 border-sky-100` (celda del calendario: `bg-sky-50/50`) | `CalendarOff` |
| Clase "cuenta igual" (override de Juan) | texto `text-indigo-600` debajo de la clase | – |
| Mes confirmado | `bg-green-50 text-green-700 border-green-200` | `Lock` |

### 2.5 `globals.css`
Copialo idéntico desde `english-empire-app/app/globals.css`. Ahí están:
- El `@theme inline` con las variables de shadcn.
- `--primary: 235 66% 30%`.
- `--destructive: 0 100% 41%`.
- `--radius: 0.5rem`.
- La scrollbar `.sidebar-scroll`.
- El `body` con Arial.

El `<body>` del layout raíz lleva `className="antialiased text-gray-900 bg-gray-50"`.

---

## 3. Radios, sombras y espaciado

| Elemento | Radio | Sombra |
|---|---|---|
| Ítems del sidebar, inputs de filtros, selects, botones chicos | `rounded-lg` | – |
| Cards, KPIs, contenedores de tabla, barra de filtros, botones de acción de página, inputs de modal | `rounded-xl` | `shadow-sm` |
| Cards grandes, cards clickeables y modales | `rounded-2xl` | `shadow-sm` → `hover:shadow-md` (clickeables), `shadow-xl` (modales) |
| Badges de estado | `rounded-full` (en tablas) o `rounded-md` (en listas y detalle) | – |
| Avatares de iniciales | `rounded-full` | – |

- **Padding de página:** el layout da `p-4 md:p-8`. Dentro de la página: `p-6 space-y-6`.
- **Padding de cards:** `p-5` (KPIs y cards de lista) o `p-6` (cards de contenido).
- **Gaps:** `gap-3` (controles), `gap-4` (grids de KPIs) y `gap-5` (grids de cards).

## 4. Tipografía

| Uso | Clases |
|---|---|
| Título de página | `text-2xl font-bold text-[#252d62]` (en vistas destacadas: `text-3xl font-black`) |
| Subtítulo de página | `text-sm text-gray-500` |
| Título de card/sección | `text-lg font-bold text-gray-900` o `text-xl font-bold text-[#252d62]` |
| Label de KPI | `text-xs font-semibold text-gray-500 uppercase tracking-wider` |
| Valor de KPI | `text-2xl font-bold text-[#252d62]` (o `text-gray-900`) |
| Header de tabla | `text-xs font-semibold text-gray-500 uppercase tracking-wider` |
| Celdas | `text-sm text-gray-600` y dato principal `font-medium text-gray-900` |
| Montos y totales | `font-bold text-[#252d62]` |
| Labels de formulario | `text-sm font-semibold text-gray-700` |
| Badges | `text-xs font-semibold` (tablas) o `text-xs font-bold` (detalle) |
| Microtexto (DNI, ids) | `text-[10px] text-gray-400 font-mono` |
| Etiqueta mini | `text-[10px] font-bold uppercase tracking-wider` |

**Idioma de la UI:** español rioplatense con voseo ("Seleccioná", "Probá", "Ingresá"). Hay que mantenerlo en todos los textos.

---

## 5. Layout

### 5.1 Estructura
```tsx
<div className="bg-gray-50 flex relative">
  <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
  {isSidebarOpen && (
    <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
  )}
  <div className="flex-1 lg:ml-64 flex flex-col min-w-0 w-full">
    <Header setIsSidebarOpen={setIsSidebarOpen} />
    <main className="p-4 md:p-8 flex-1 overflow-x-hidden">{children}</main>
  </div>
</div>
```

### 5.2 Sidebar
- **Contenedor:** `fixed left-0 top-0 h-screen w-64 bg-[#252d62] text-white flex flex-col shadow-xl z-50 transition-transform duration-300 ease-in-out print:hidden`. En mobile se muestra con `-translate-x-full` / `translate-x-0`; en desktop queda fijo con `lg:translate-x-0`.
- **Logo:** `p-4 border-b border-white/10`, y la imagen con `w-full h-auto bg-white rounded-lg`.
- **Nav:** `flex-1 py-4 px-3 overflow-y-auto sidebar-scroll` con la lista en `space-y-1.5`.
- **Ítem:**
  - Base: `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group`.
  - Activo: `bg-white/15 text-white shadow-sm`, con el ícono en `scale-110`.
  - Inactivo: `text-white/80 hover:bg-white/10 hover:text-white`, con el ícono en `group-hover:scale-110`.
  - Ícono `w-5 h-5` y label `font-medium text-sm`.
- **Entrada animada:** cada ítem es `motion.li` con `initial={{opacity:0,x:-20}}`, `animate={{opacity:1,x:0}}` y `transition={{duration:0.3, delay:index*0.05}}`.
- **Separador inferior:** `border-t border-white/10`.
- **Cerrar sesión:** `hover:bg-[#EE1120]/20 hover:text-[#EE1120]`, con el ícono en `group-hover:-translate-x-1`.
- **Configuración:** ícono con `group-hover:rotate-90`.
- **Caja "Sesión actual":** `py-2 px-4 rounded-lg bg-white/5 border border-white/10`, con el label `text-xs text-white/60 uppercase tracking-wider` y el nombre en `text-sm font-semibold truncate`.

### 5.3 Header
- **Contenedor:** `bg-white border-b border-gray-200 shadow-sm sticky top-0 print:hidden`, con el contenido en `px-8 py-4 flex items-center justify-between`.
- **Saludo:** `text-2xl font-bold text-[#252d62]` ("Hola, Juan"), con el subtítulo en `text-sm text-gray-500 mt-0.5`.
- **Botón hamburguesa (solo mobile):** `lg:hidden bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 w-10 h-10`.
- **Avatar:** `w-10 h-10 border-2 border-[#252d62]/20`, con el fallback en `bg-[#252d62] text-white font-bold tracking-widest text-sm` (dos iniciales).

---

## 6. Componentes y patrones

### 6.1 Encabezado de página
```tsx
<div className="flex items-center justify-between gap-3">
  <div className="flex items-center gap-3">
    <div className="bg-[#252d62] p-2.5 rounded-lg">
      <CalendarDays className="w-5 h-5 text-white" />
    </div>
    <div>
      <h1 className="text-2xl font-bold text-[#252d62]">Asistencia del personal</h1>
      <p className="text-sm text-gray-500">Revisá y confirmá el registro del mes</p>
    </div>
  </div>
  <div className="flex items-center gap-3">{/* acciones */}</div>
</div>
```

### 6.2 Botones
Se usa el `Button` de shadcn y se pisan los colores con `className`. Los botones de acción de página son "gorditos", con `py-5 rounded-xl font-bold`.

| Tipo | Clases |
|---|---|
| **CTA principal (rojo)** | `bg-[#EE1120] hover:bg-[#c4000e] text-white font-bold py-5 px-6 rounded-xl flex items-center gap-2 shadow-md transition-all` |
| **Primario navy** | `bg-[#252d62] hover:bg-[#1a2046] text-white font-semibold py-5 px-5 rounded-xl flex items-center gap-2` |
| **Outline navy** | `variant="outline"` + `border-[#252d62] text-[#252d62] hover:bg-[#252d62]/5 font-bold py-5 px-5 rounded-xl` |
| **Suave navy** (en cards) | `bg-indigo-50 text-[#252d62] hover:bg-[#252d62] hover:text-white rounded-xl font-bold py-2.5` |
| **Ghost** | `variant="ghost"` + `font-bold text-gray-500 hover:bg-gray-100` |
| **Cancelar** (en diálogos) | `variant="outline"` + `border-gray-300 text-gray-700 hover:bg-gray-50` |
| **Deshabilitado** | `bg-gray-50 text-gray-400 cursor-not-allowed` (o `disabled:opacity-50`) |

- Íconos dentro de botones: `w-4 h-4` (chicos) o `w-5 h-5` (de página).
- Mientras carga, el botón muestra `<Loader2 className="w-4 h-4 animate-spin" />`.
- **Una sola acción roja por pantalla**: es la acción principal.

### 6.3 KPI cards
```tsx
<div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
  <div className="flex items-center justify-between mb-3">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Horas del mes</p>
    <div className="bg-[#252d62]/10 p-2 rounded-lg"><Clock className="w-4 h-4 text-[#252d62]" /></div>
  </div>
  <p className="text-2xl font-bold text-[#252d62]">142 h 30 min</p>
  <p className="text-xs text-gray-400 mt-1">Secretarias</p>
</div>
```
- Grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`.
- Para la caja del ícono se alternan `bg-[#252d62]/10` (navy), `bg-blue-50`/`text-blue-600`, `bg-green-50`/`text-green-600` y `bg-purple-50`/`text-purple-600`.

### 6.4 Barra de filtros
- **Contenedor:** `bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col xl:flex-row gap-3`.
- **Búsqueda:** `relative flex-1`, con el ícono `Search` en `absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`.
- **Input y select:** `text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#252d62]/20 focus:border-[#252d62]`. Al input de búsqueda se le suma `pl-9`.
- **Grupo segmentado:** `flex items-center gap-1 bg-gray-50 rounded-lg p-1`.
  - Opción activa: `bg-white shadow-sm text-[#252d62] font-semibold`.
  - Opción inactiva: `text-gray-500 hover:text-gray-700`.

### 6.5 Tablas
```tsx
<div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
  <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
    <p className="text-sm text-gray-500">12 empleadas</p>
    <p className="text-sm font-bold text-[#252d62]">Total: …</p>
  </div>
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-white sticky top-0 z-10 shadow-sm">
        <tr className="border-b border-gray-100">
          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        <tr className="hover:bg-gray-50 transition-colors">
          <td className="px-6 py-4 font-medium text-gray-900">…</td>
        </tr>
      </tbody>
    </table>
  </div>
  {/* paginación */}
  <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">…</div>
</div>
```
Las columnas numéricas van con `text-right` y los totales con `font-bold text-[#252d62]`.

### 6.6 Badges
```tsx
// En tablas
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">
  <CheckCircle2 className="w-3 h-3" /> Completa
</span>
// En listas y detalle
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
  <Clock className="w-3.5 h-3.5" /> Tarde
</span>
// Chip de horario
<span className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
  <Clock className="w-3 h-3" /> 18:00 hs
</span>
```

### 6.7 Cards de lista (clickeables)
- **Card:** `bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group`.
- **Ícono en caja:** `w-12 h-12 bg-indigo-50 text-[#252d62] rounded-xl flex items-center justify-center`.
- **Flecha:** `w-7 h-7 rounded-full bg-gray-50 group-hover:bg-indigo-50`, con el ícono `ChevronRight` pasando de `text-gray-400` a `group-hover:text-[#4338ca]`.
- **Footer de la card:** `pt-3 border-t border-gray-50`.

### 6.8 Modales
Hay dos variantes, las dos en uso en el panel.

**A. Modal de detalle con header navy** (`Dialog` de shadcn):
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl">
    <DialogTitle className="sr-only">Detalle</DialogTitle>
    <div className="bg-[#252d62] p-6 text-white">
      <h3 className="text-xl font-black mb-1 flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-indigo-300" /> Lunes 26 de octubre
      </h3>
      <p className="text-indigo-200 text-sm font-medium">Resumen del día</p>
    </div>
    <div className="p-2 bg-gray-50 max-h-[50vh] overflow-y-auto">{/* filas bg-white rounded-xl border border-gray-100 shadow-sm p-3 */}</div>
    <div className="p-4 border-t border-gray-100 bg-white flex justify-between gap-3">{/* acciones */}</div>
  </DialogContent>
</Dialog>
```

**B. Modal de formulario:**
- **Overlay:** `fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4`.
- **Caja:** `bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]`.
- **Header:** `flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50`, con el título en `text-xl font-bold text-[#252d62]` y el botón de cerrar (`X`) en `text-gray-400 hover:text-gray-600`.
- **Cuerpo:** `p-6 space-y-6 overflow-y-auto`.
- **Inputs:** `w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#252d62]/20`.

**Diálogo de confirmación:**
- Ícono en un círculo de `w-10 h-10 rounded-full`: `bg-red-100` + `text-red-600` si la acción es destructiva, `bg-amber-100` + `text-amber-600` si es una advertencia.
- Título en `text-xl text-[#2a2e5b]`.
- Footer con Cancelar (outline gris) y la acción (rojo o navy).

### 6.9 Avisos inline
- **Advertencia:** `p-4 bg-amber-50 border border-amber-200 rounded-xl`, con el ícono `AlertTriangle` en `text-amber-600`, el título en `text-sm font-bold text-amber-800` y el texto en `text-xs text-amber-700`.
- **Éxito:** `p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm flex items-center gap-2`.
- **Info:** `p-4 bg-blue-50/50 border border-blue-100 rounded-xl`.

### 6.10 Tooltip
Va con `position: fixed` y se posiciona con `getBoundingClientRect()`, para escapar de contenedores con `overflow: auto`:
- **Caja:** `bg-[#1a2248] text-white rounded-xl shadow-xl p-3`, con el título en `text-xs font-bold` y el texto en `text-xs text-white/80`.
- **Flecha:** `w-2 h-2 bg-[#1a2248] rotate-45`.

### 6.11 Estados de carga y vacío
- **Cargando:** `<div className="flex items-center justify-center h-96"><Loader2 className="w-10 h-10 animate-spin text-[#252d62]" /></div>`.
- **Vacío:**
  - Contenedor: `flex flex-col items-center justify-center py-16 text-center`.
  - Ícono dentro de `bg-gray-100 p-4 rounded-full` (`w-8 h-8 text-gray-400`).
  - Texto principal en `text-gray-500 font-medium` y la sugerencia en `text-gray-400 text-sm mt-1`.

### 6.12 Avatar de iniciales (en listas)
`w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs`. Si se usa en un lugar destacado, va en `bg-[#252d62] text-white`.

---

## 7. Animación (framer-motion)

- **Entrada de vista:** `initial={{opacity:0, x:-20}} animate={{opacity:1, x:0}}`. Si es un drill-down hacia el detalle, se usa `x:20`.
- **Grids y listas:** `initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay: idx*0.05}}`.
- **Dropdowns:** `initial={{opacity:0, y:10, scale:0.95}}` con `transition={{duration:0.15}}`, dentro de `AnimatePresence`.
- **Transiciones CSS:** `transition-colors`, `transition-all duration-200` y `transition-shadow`.
- Todo sutil: nada de rebotes ni animaciones largas.

## 8. Íconos (lucide-react)
- **Tamaños:** `w-3 h-3`, `w-3.5 h-3.5` (badges), `w-4 h-4` (inline y botones), `w-5 h-5` (nav y header) y `w-6 h-6` (cajas grandes).
- **Íconos ya usados** que conviene reutilizar: `CalendarDays`, `Clock`, `UserCheck`, `UserX`, `Users`, `Briefcase`, `GraduationCap`, `AlertTriangle`, `CheckCircle2`, `Loader2`, `Search`, `Filter`, `Printer`, `Download`, `Mail`, `ChevronLeft`, `ChevronRight`, `ArrowLeft`, `Pencil`, `Plus`, `X`, `Settings`, `LogOut`.
- **Íconos nuevos** para asistencia: `Repeat` (reemplazo), `WifiOff` (offline), `Lock` (mes confirmado), `Ban` (anulado), `Nfc` (kiosco) y `FileCheck2` (recibos).

## 9. Impresión
Sidebar, header y controles llevan `print:hidden`. Si una vista se imprime (resúmenes, por ejemplo), hay que asegurarse de que quede legible sin colores de fondo.

---

## 10. Kiosco (pantalla de fichaje)

La pantalla de fichaje no usa sidebar ni header, pero mantiene la misma identidad:

- **Reposo:**
  - Fondo `bg-[#252d62]` a pantalla completa y texto blanco.
  - Logo en una caja `bg-white rounded-2xl`.
  - Reloj con `text-7xl font-black tabular-nums`, fecha en `text-indigo-200`.
  - Instrucción "Acercá tu llavero" en `text-2xl font-bold`, con el ícono `Nfc` pulsando suave.
- **Resultado:** una card blanca `rounded-2xl shadow-xl` centrada.
  - Avatar de iniciales navy de 80 px.
  - Nombre en `text-3xl font-black text-gray-900`.
  - Cargo como badge (*Secretaria* `bg-indigo-50 text-[#252d62]`, *Profesora* `bg-purple-50 text-purple-700`).
  - Una línea principal grande con el chip semántico de la sección 2.4.
- **Error:** la misma card con una franja superior `bg-[#EE1120]`, ícono `AlertTriangle` y el texto claro.
- **Indicadores:** en una esquina, como píldoras `bg-white/10 rounded-full px-3 py-1 text-xs`: estado del lector, conexión y la cantidad pendiente (`WifiOff`).