> **Estado vigente (2026-10-05): migración completada.** React + Tailwind tw:, sin dependencias CoreUI/Bootstrap. Esta fase/inventario es histórico; seguir [patrones actuales](docs/visual-patterns.md) y el [reporte final](docs/tailwind-migration-complete.md).

# ECA-QMS — Auditoría de la Capa Visual (contexto visual)

> **Paso 5 parcial:** generadores y verificación CoreUI retirados; Card viejo
> eliminado por falta de consumidores. El CSS legado y otros adaptadores todavía
> se usan; react/coreui ya no están declarados y quedan imports sin resolver.
> Ver [estado actual de limpieza](docs/cleanup-step5-status.md).

> **2026-10-05 — Migración autorizada:** mantener esta identidad visual mientras
> se sustituye CoreUI/Bootstrap progresivamente con el kit Tailwind propio.
> Los pasos 1/2/3 están implementados; Sidebar/Header/Layout ya usan solo Tailwind.
> Ver [guía de migración](docs/tailwind-migration.md).
> El inventario híbrido siguiente documenta las vistas todavía pendientes.

**Edición visual:** `app/globals.css` organiza la cascada; `app/styles/tokens.css` define la paleta y radios, `base.css` las reglas generales y `coreui-bridge.css` la adaptación. Seguir [la guía de patrones](docs/visual-patterns.md).

> Estado del código local (rama `main`, trabajo sin commit posterior al commit `b1f5ec8`).
> Última auditoría: 16/9/2026. Objetivo: servir de referencia única de la identidad visual actual.

> Mantenimiento y rendimiento (17/9/2026): ver [Patrones del panel híbrido](docs/visual-patterns.md) para ejemplos de estructura, carga diferida, caché, modales y comandos de validación. Se conserva la identidad visual descrita aquí.

---

## 1. Stack visual (resumen)

| Área | Tecnología | Detalle |
|------|-----------|---------|
| Framework | Next.js 16.3.6 (App Router, Turbopack en dev) | Todas las páginas `'use client'` |
| Iconos | **`@coreui/icons`** + `@coreui/icons-react` (CIcon) | Mapeados a nombres tipo lucide en `components/ui/icons.tsx` |
| Componentes | **`@coreui/react` 5.13.0** | Var. ~50 componentes distintos en uso |
| CSS base | **`@coreui/coreui` 5.9.0** → `app/coreui-scoped.css` (14.748 líneas, scopeadas) | Generado con `scripts/scope-coreui.mjs` |
| CSS utilitario | **Tailwind CSS v4** (CSS-first, importado tras CoreUI) | `@import "tailwindcss"` + `@theme` de tokens |
| Gráficas | **`chart.js` 4.5.1** + `@coreui/react-chartjs` 3.0.0 | Solo dashboard (`/`) |
| CSS Modules | Varios co-locados (`*.module.css`) | Layouts de página, Shell, panel Mis Quejas |
| Toasts | **sonner** 2.0.7 (`lib/providers/ToastProvider.tsx`) | Tema claro, abajo a la derecha |
| Fuente | **Inter** (via `next/font/google`) + `--cui-font-sans-serif` de CoreUI | |

Dep. visual completas en `package.json`: `@coreui/react`, `@coreui/coreui`, `@coreui/icons`, `@coreui/icons-react`, `@coreui/react-chartjs`, `chart.js`, `lucide-react` (solo `/q/[token]`).

---

## 2. Orden de carga de estilos (`app/globals.css`)

```css
@layer theme, base, coreui, components, utilities;
@import "./coreui-scoped.css" layer(coreui);   /* CSS CoreUI scopeado */
@import "tailwindcss";                          /* utilidades Tailwind v4 */
```

- Capa **`coreui`**: variables `--cui-*` y componentes Bootstrap/CoreUI con todos sus selectores precedidos por `:where(.coreui-scope)` (o `.coreui-scope` para `:root/body/html` y `body:has(.coreui-scope) > .sidebar-backdrop`).
- Capa **`utilities`** (Tailwind): puede sobreescribir lo anterior con `!` (ej. `!rounded-lg`, `!border-qms-border`).
- `@layer` explícito en la primera línea para que la cascada de capas sea la esperada (coreui antes de utilities).

---

## 3. Tokens de diseño (`@theme` en `app/styles/tokens.css`)

### 3.1 Radios de borde — look "cuadradito" uniforme

| Token | Valor | Uso típico |
|-------|-------|-----------|
| `--radius-sm` | 0.1875rem (3px) | — |
| `--radius-md` | 0.25rem (4px) | inputs, botones, badges |
| `--radius-lg` | 0.375rem (6px) | tarjetas, modales, tablas |
| `--radius-xl` | 0.5rem (8px) | paneles flotantes, iconos de sección |
| `--radius-2xl` | 0.625rem (10px) | excepcional |
| `--radius-button` | 0.25rem | botones |
| `--radius-card` / `--radius-modal` | 0.375rem | tarjetas / modales |

Los radios reales renderizados los dan CoreUI (`--cui-border-radius` ≈ 0.375rem) + estas utilidades.

### 3.2 Paleta de marca (tokens `--color-qms-*`, usables como `text-qms-*`, `bg-qms-*`, `border-qms-*`)

| Token | Valor | Token | Valor |
|-------|-------|-------|-------|
| `qms-primary` | `#5856d6` (púrpura CoreUI) | `qms-background` | `#f3f4f7` |
| `qms-primary-dark`/`-hover` | `#4644ab` | `qms-header` | `#343a40` |
| `qms-dark` | `#212631` | `qms-surface` | `#ffffff` |
| `qms-muted` | `#6c757d` | `qms-border` | `#dbdfe6` |
| `qms-danger` | `#e55353` | `qms-success` | `#1b9e3e` |
| `qms-warning` | `#f9b115` | `qms-info` | `#3399ff` |
| `qms-purple` | `#5856d6` | `qms-hover-bg` | `#f8f9fa` |
| `qms-scroll` | `#cbd5e1` | `qms-scroll-hover` | `#94a3b8` |

### 3.3 Fondos suaves (badges/estados) — tokens `--color-soft-*`

`soft-blue` (#e7f1ff / #3399ff) · `soft-green` (#e8f5ee / #198754) · `soft-red` (#fdeeee / #dc3545) · `soft-amber` (#fff3cd / #856404) · `soft-purple` (#f1ecf9 / #6f42c1) · `soft-gray` (#f8f9fa / #495057).

### 3.4 Sombras

`--shadow-sm: 0 1px 2px rgba(0,0,0,.05)` · `--shadow: 0 .125rem .25rem rgba(0,0,0,.075)` · `--shadow-md: 0 .5rem 1rem rgba(0,0,0,.15)` · `--shadow-lg: 0 1rem 3rem rgba(0,0,0,.175)`.

### 3.5 Variables CoreUI clave (definidas en `coreui-scoped.css`)

`--cui-primary: #5856d6` · `--cui-secondary: #6b7785` · `--cui-success: #1b9e3e` · `--cui-info: #39f` · `--cui-warning: #f9b115` · `--cui-danger: #e55353` · `--cui-light/#f3f4f7` · `--cui-dark/#212631` · `--cui-body-bg: #ffffff` · `--cui-tertiary-bg: #f3f4f7` · `--cui-border-color: #dbdfe6` · escalas de gris `#f3f4f7 → #212631`.

---

## 4. Shell de la aplicación

`app/layout.tsx`: `<body className="{inter} select-none">` → `QueryProvider` → `AuthShell` → `children` + `ToastProvider`.

`components/AuthShell.tsx` (rutas públicas `/login` y `/q/*` sin shell):
```tsx
<AuthenticatedLayout>
  <LegacyViewBoundary>{children}</LegacyViewBoundary>
</AuthenticatedLayout>
```
- **Shell migrado:** Sidebar/Header/AuthenticatedLayout usan únicamente `tw:`. Ver sus archivos y `docs/tailwind-migration.md` para el layout completo.
- **`coreui-scope`**: marcador solo dentro de LegacyViewBoundary y los modales pendientes. Ya no envuelve el menú ni el header.
- **`select-none`** global en body; excepciones con `select-text` en tablas y en el cuerpo del panel de Mis Quejas.

---

## 5. Sidebar (`components/Sidebar.tsx` + `Sidebar.module.css`)

- `CSidebar` colorScheme **dark**, `unfoldable={collapsed}` en escritorio, overlay en móvil (`useMobileNavigation` = `(max-width: 991.98px)`).
- **Tres estados**: expandido (250px), colapsado (unfoldable, solo iconos), oculto por completo (`styles.hidden` display:none).
- **Persistencia** en `localStorage` (`eca_qms_sidebar`) vía `lib/store/sidebar-store.ts`: `collapsed`, `hidden`, `expandedGroups`, `mobileOpen`.
- Estructura: `CSidebarHeader` con brand (`E` en caja 32px borde 2px radius 6px + "ECA QMS"), nav por secciones (`Gestión de calidad`, `Seguimiento`, `Administración`), `CNavGroup` plegables con hover-prefetch de queries, `CSidebarFooter` con `CSidebarToggler`.
- Rutas filtradas por permisos dinámicos (`tienePermiso` + `moduloDeRuta`).
- CSS: `.navSections` scroll delgado (6px, thumb `#ffffff40`), `.nav-link` ellipsis, bullets en subitems, `prefers-reduced-motion` sin transición.

---

## 6. Header (`components/Header.tsx` + `Header.module.css`)

- `CHeader` de 64px con toolber y **breadcrumb** de 48px de alto (`Inicio / {módulo}`).
- Toggler hamburguesa: **desktop** alterna `hidden`; **móvil** alterna `mobileOpen`.
- Título del módulo según ruta (`titles`).
- **Slot de acción "+ Nuevo"**: `lib/store/header-action-store.ts` + `hooks/useHeaderAction.ts` — cada página registra `useHeaderAction({ label, onClick })` y el Header renderiza un `CButton color="primary"` con icono `cilPlus` al fila derecha del breadcrumb. Se limpia al desmontar.
- Derecha: `NotificationDropdown` (campana con badge de no leídas) + `UserMenuDropdown` (avatar con iniciales, nombre, rol, cambiar contraseña, preferencias de notificación con Switch + selector de sonido + preview, logout).
- Cierran con click-fuera/Escape.

### Dropdowns (`components/header/`)
- **NotificationDropdown**: `CDropdown` alineado al final, ancho `min(380px, calc(100vw - 32px))`, header con acciones "Leer todas"/"Vaciar", lista `CListGroup flush`, máx 15 items, no-leídas con `bg-primary-subtle` y texto `fw-semibold`, botón de archivar al hover, badgel count rojo pill en la campana.
- **UserMenuDropdown**: `CDropdown` ancho `min(340px, ...)`, `CAvatar color="primary"`, roles con `Badge` (`admin→blue, calidad→green, coordinador→amber, revisor→purple, usuario→gray`), prefs de notificación (Switches), selector de sonido + botón ▶ preview, logout en rojo.

---

## 7. Catálogo de componentes

### 7.1 Wrappers propios (`components/ui/`)

| Componente | Implementación | API |
|-----------|---------------|-----|
| `Button` | `CButton` + `CSpinner` | `variant: primary/secondary/danger/ghost`, `size: sm/md`, `loading`, `disabled` |
| `Badge` | `CBadge` | `variant` → color: `red→danger, amber/orange→warning, green→success, blue→info, purple→primary, gray→secondary`; tamaño 0.875rem |
| `Select` | `CFormSelect` (forwardRef) | `size: sm/lg` |
| `Switch` | `CFormSwitch` | `checked/onChange/disabled/label` |
| `Pagination` | `CPagination` + `CPaginationItem` | `page/count/busy/onChange`; 25 por página (`PAGE_SIZE`) |
| `PageHeader` | Contenedor flex `justify-content-end` | `backHref` (botón atrás) + `children` (acciones); **sin título propio** — retorna null sin hijos |
| `EmptyState` | `CTableRow`/`CTableDataCell colSpan=999` | fila de "sin datos" centrada |
| `Card` | `CCard` + `CCardHeader` + `CCardBody` | `title`, `action` (slot derecho), `bodyClassName` (default `p-4`) |
| `Table`* | `CCard`>`CCardBody p-0`>`div.table-responsive`>`CTable hover` | exporta `Table/TableHead/TableHeaderCell/TableRow/TableCell` |
| `icons.tsx` | `CIcon` de `@coreui/icons` | ~58 iconos expuestos con nombres tipo lucide |

### 7.2 `StatCard` (`components/StatCard.tsx`) — KPI
- Envuelve **`CWidgetStatsF`**. Colores: `blue→info, amber→warning, green→success, red→danger, purple→primary`. Icono + título + valor (`fs-3`) + footer (subtítulo/trend). Opcional `onClick` con keyboard access.

### 7.3 `Modal` (`components/Modal.tsx` + `Modal.module.css`) — modal reutilizable
- **CModal** centrado (`alignment="center"`, `scrollable`, `backdrop="static"`, `portal={false}`), tamaño sm/md/lg/xl, **encabezado** con título (1.25rem/500) y cerrar.
- Gestión de **z-index y bloqueo de scroll por pila**: módulo almacén externo (`useSyncExternalStore`) que registra/des-registra cada modal abierto; cada nivel z-index `1055 + level*20`, backdrop `1050 + level*20`; Escape/blur overlay solo en el modal superior; quita `modal-open`/`overflow:hidden` solo al cerrar el último.
- Scroll del body optimizado (`overscroll-behavior: contain`, `scroll-behavior:auto`, `overflow-anchor:none`) + reglas `@media print` para imprimir el contenido.

### 7.4 Componentes CoreUI usados directamente (inventario por frecuencia)

Uso frecuente: `CButton`(30) · `CFormInput`(18) · `CFormLabel`(17) · `CTableRow`(15) · `CTableBody`(13) · `CCard`(10) · `CFormTextarea`(9) · `CTableDataCell`(8) · `CTable/CTableHead/CTableHeaderCell`(7) · `CCardBody`(6) · `CSpinner`(4) · `CCardHeader`(4) · `CProgress`(3) · `CFormSelect`(3) · `CNav/CNavLink`(3) · `CWidgetStatsF`(3) · `CFormCheck`(3) · `CAlert`(3).

Puntual: `CDropdown*`, `CListGroup*`, `CCloseButton`, `CBadge`, `CCardFooter`, `CCardGroup` (login), `CModal*`, `CSidebar*`, `CNavTitle/CNavGroup`, `CAvatar`, `CFormRange`, `CInputGroup*`, `CPagination*`, `CHeaderToggler`, `CBreadcrumb*`, `CFormSwitch`, `CHeader`.

### 7.5 Iconos (`components/ui/icons.tsx`)
- ~58 exportables tipo lucide (`Check`, `Plus`, `Trash2`, `Search`, `Users`, `Bell`, `History`, `Maximize/Minimize`, etc.) construidos con `CIcon` sobre `cil*` de `@coreui/icons`.
- Tamaño por defecto 20px, clase `qms-icon` (`fill: currentColor; display:inline-block; flex-shrink:0`).
- `Loader2` → `CSpinner`; iconos inline en páginas también usan `CIcon` directo con `cil*` (Header menú/campana, Sidebar, quejas stats, dashboard, login).

---

## 8. Iconografía / gráficas

- **Dashboard `/`** (`app/page.tsx` + `dashboard.module.css` + componentes en `components/dashboard/`): panel analítico CoreUI estricto. **Sin cards KPI de cabecera** — las métricas van integradas como `PanelMetric` (borde-left grueso por color: `border-start-4 border-start-{success|warning|danger|info|primary|secondary}` + `small` uppercase + valor `fs-5`). Tabs de módulos = **`CNav variant="underline-border"`** nativo de CoreUI (activo con subrayado `--cui-primary`, sin CSS propio). Layout `CRow/CCol` (`lg={8}/lg={4}`, `lg={6}/lg={6}`, `xs={12}`) con tarjetas `CCard mb-4` + `CCardHeader` (`h2 fs-5`) + `CCardBody`. Gráficas vía **`CChart` dinámico** (`ssr:false`, `wrapper:false`) con `animation:false` y `maintainAspectRatio:false`, only `CChartLine`/`CChartBar`/`CChartDoughnut`; alturas `.chartLarge` 300px / `.chartMedium` 240px / `.donut` 200×200 con total al centro y leyenda con puntos de 12px radius 2px. **Colores desde `getStyle` de `@coreui/utils`** (`cuiColors.ts`, lee `--color-qms-*` del scope `.coreui-scope`; fallbacks documentados): success `#1b9e3e`, info `#3399ff`, primary `#4257be`, warning `#f9b115`, danger `#e55353`, secondary `#6c757d` (`--color-qms-muted`), muted `--cui-secondary-color`, grid `--cui-border-color-translucent`. Barras horizontales (`indexAxis:'y'`) ordenadas mayor→menor con pocos colores; barras apiladas para SLA por prioridad; donut solo con ≤5-6 categorías (si no, barra horizontal); líneas ≤3 series, tensión suave, puntos discretos. Tablas "requieren atención" = `CTable hover responsive` con folio en link primary 700, badges `prioridadVariant`/`estado*Variant`. Estados vacíos: "No hay datos suficientes para mostrar esta tendencia.".

---

## 9. Patrones por página

Convención común de página (`.page`): `margin:-16px; padding:24px; min-height:calc(100%+32px); background:var(--cui-tertiary-bg); font-size:16px;` para "pintar" todo el area del `<main>` del shell.

| Ruta | Composición visual |
|------|--------------------|
| `/` | Dashboard analítico con **navegación interna por tabs CoreUI `CNav variant="underline-border"`** (General / Quejas / SACP / Documentos / Riesgos). **Sin cards KPI de cabecera** — las métricas son `PanelMetric` (border-start) integrados en los encabezados de los paneles. **General**: "Vencimientos próximos" (barras horizontales por rango de días: ≤7 peligro, 8-15 ámbar, 16-30 info, >30 secondary) + "Distribución de pendientes" (donut Quejas/SACP/Docs/Riesgos con total al centro + leyenda) + "Evolución de la gestión" (línea recibidas/resueltas 12 meses + métricas del mes y diferencia) + tabla CTable "Expedientes que requieren atención" (Expediente/Tipo/Estado/Vencimiento/Prioridad) + timeline "Actividad reciente". **Quejas**: línea "Recibidas vs resueltas" (métricas del mes del `obtener_estadisticas_quejas`) + donut "Situación actual" agrupado en ≤5 macrogrupos (Recibidas / En gestión / Pendientes de revisión / Cerradas-Resueltas / No procede; >5 → barra horizontal) + texto con total/procedencia + "Cumplimiento SLA" (barras apiladas por prioridad: A tiempo/En alerta/Vencidas + métricas) + "Quejas por categoría" (barras horizontales) + tabla CTable "Quejas que requieren atención" (Folio/Cliente/Estado/SLA/Vencimiento) con link "Ver todas las quejas". **SACP**: línea "creadas por mes" + donut "por estado" + "Cumplimiento de plazos" (Vencidas/Próximas/A tiempo/Cumplidas) + "por tipo" + tabla atención. **Documentos**: donut "por estado" (Publicado/Borrador/En Revisión/Archivado) + línea "Cambios documentales por mes" (`versiones_documentos`) + "por tipo" + "en Borrador por mes" + tabla atención. **Riesgos**: línea "identificados por mes" + donut "Estado de tratamiento" + "por nivel" (Crítico/Alto/Medio/Bajo) + "por proceso" + tabla "Riesgos prioritarios" (P×I). Layout `CRow/CCol` `lg={8}/lg={4}` y `lg={6}/lg={6}`; paneles `CCard mb-4` + header `h2 fs-5`; colores semánticos vía `getStyle` (`cuiColors.ts`) — verde `#1b9e3e` (acierto/resuelto), azul `#3399ff` (informativo), primary `#4257be` (activo), ámbar `#f9b115` (advertencia), rojo `#e55353` (vencido/crítico), gris `#6c757d` (neutral/cerrado). Estados vacíos elegantes. Botón **Actualizar** con spinner. Componentes: `components/dashboard/` (ModuleTabs, GeneralTab, QuejasTab, SacpTab, DocumentosTab, RiesgosTab, Chart, chartKit, cuiColors); datos de `useDashboard` + `useQuejasAnalisis` + `useQuejasEstadisticas` + `useModulosAnalisis` (nuevo, solo lectura) | Componentes propios de dashboard |
| `/quejas` | **Página operativa compacta sin KPIs** (migrados al Dashboard → tab Quejas). CCard "Registro de quejas" con filtros (`CInputGroup` búsqueda + 2 `Select`), **tabla HTML nativa** (`.tableWrap max-height:65vh`), encabezado `sticky`, filas clicables, folio como botón link-color-primary (700), **filas no leídas** fondo `#f0f3ff` + texto semibold, badge "N sin ver" en header (`cilLowVision`). Paginación en footer. SLA por prioridad con Badge (≥alerta verde, ≥vencimiento ámbar, >vencimiento rojo). Acción global "+ Nuevo" vía `useHeaderAction` |
| `/mis-quejas` | Split-pane: tabla nativa `coreui-record-table` (`min-w-[1200px]`, con panel `min-w-[calc(100%+584px)]`) en contenedor `monday-scroll` con borde `qms-border` rounded, más **panel fixed derecho de 600px** (QuejaColaboradorPanel) que reserva `mr-[calc(600px-16px)]`. Paginación abajo |
| `/configuracion` | Layout 230px + 1fr (`sticky` nav). `CNav variant="pills"` vertical con 7 tabs icon+label. Header de sección con icono 44px `primary-bg-subtle` radius 8. Tabs: Catálogos, SLA y Plazos, General, Formularios, Roles y Accesos, Vistas, IA. Tablas `CTable hover` en `.table-responsive` con borde + radius 6px. Editor inline grid con fondo `tertiary-bg` |
| `/documentos` | Tabs `CNav` (Todos / Lista Maestra / Edición Viva) + tabla de documentos (estado con Badge `estadoDocumentoVariant`). Error boundary propio |
| `/sacp` | Tabla de acciones con barra de avance `CProgress` y estados Badge `estadoSACPVariant` |
| `/riesgos` | Tabla + `CProgress` por nivel; matriz 3x3 (prob×impacto) |
| `/auditorias` | Tabla de auditorías + modal hallazgos (solo lectura) |
| `/revision` | Tabla de reuniones + modal detalle |
| `/procesos` | Tabla de procesos |
| `/reporteria` | Wizard 3 pasos + informe imprimible (`@media print` oculta aside/header) |
| `/usuarios` | 4 `CWidgetStatsF` + tabla + CRUD vía modales |
| `/login` | `coreui-scope` + `CCardGroup` 850px 2 columnas: formulario (izquierda) + panel brand **`bg-primary` white** 38% (oculto < md). `CAlert` para errores |
| `/q/[token]` | **Ruta pública FUERA de `coreui-scope`**: Tailwind puro, con iconos del adaptador local tras la optimización; conserva `lucide-react` únicamente para el icono `Paperclip`. Formulario de queja pública con categorías fijas y adjuntos |

### 9.1 Tablas
Dos estrategias conviven:
1. **`CTable`** de CoreUI (wrappers `Table.tsx` o directas) — la mayoría de módulos.
2. **Tabla HTML nativa** para listados de alto volumen (`/quejas`, `/mis-quejas`) con clases `.coreui-record-table` / `.tableWrap` — mas fluida en scroll.

Optimizaciones de scroll en `app/styles/coreui-bridge.css` (ver §11).

### 9.2 Formularios y modales de creación
Todos los `Nueva*Modal`/`*Modal` usan `Modal.tsx` con grids de formulario Bootstrap (`CFormLabel`, `CFormInput`, `CFormSelect`, `CFormTextarea`), selects de catálogos y botones `Button` (loading con spinner). Modales de detalle con tabs, timeline, adjuntos y actions según permisos.

### 9.3 Panel Mis Quejas (`QuejaColaboradorPanel.tsx` + `.module.css`)
- Panel **fixed** `inset: 0 0 0 auto; width:min(600px,100vw); height:100dvh; z-index:1040`, sombra `-8px 0 32px #21263114`, animación de entrada 160ms (si `prefers-reduced-motion: no-preference`).
- Toolbar (44px) + header de identidad (h1 24px + icono 48px) + tabs (Detalle / Análisis / Resolución) + body scroll con botones estandarizados 36px.
- Secciones tipo tarjeta `.section` (pad 20, radius 6, borde `--cui-border-color`), metadatos en grid 2 col, nota GC con `border-left: 3px solid var(--cui-primary)`, timeline con bullets 32px `primary-bg-subtle`, markdown IA con estilos `.markdown` (p~1.7).

---

## 10. Complementos visuales

- **Toasts** (`ToastProvider.tsx`): `sonner` bottom-right, `theme:"light"`, `closeButton`, `duration:4000`, `gap:12`; clases `!rounded-lg !border !border-qms-border !bg-qms-surface !shadow-md`; iconos semánticos coloreados vía CSS en `app/styles/coreui-bridge.css` (`success→qms-success`, `error→qms-danger`, `warning→qms-warning`, `info→qms-info`). Helpers `showError/showSuccess` (`lib/services/errorToast.ts`).
- **Badges de estado** (`lib/constants/variants.ts`): `prioridadVariant`, `estadoVariant`, `estadoSACPVariant`, `estadoDocumentoVariant` — mapas ad-hoc a colores `Badge`.
- **Roles** (`lib/constants/roles.ts`): `ROLE_VARIANTS` y `ROLE_LABELS` (blue/green/amber/purple/gray).
- **Scrollbars**: globales 8px (thumb `#b4bac4`, radius 4) + `.monday-scroll` específico en listas; `.monday-scroll-no-x` oculta scrollbar horizontal.
- **A11y**: `:focus-visible` outline 2px `qms-primary`; `::selection` rgba(88,86,214,.2); `aria-` en elementos interactivos; `@media print` limpio.

---

## 11. Rendimiento visual ya aplicado

1. **`coreui-scoped.css` scopeado** para no contaminar `utility`/`components` de Tailwind (generado, no editable a mano).
2. **Hover/striped/active de tablas sin `box-shadow: inset`** (ahora `background-color` directo con `!important`).
3. **`scroll-behavior: auto !important`** en `.coreui-scope` y contenedores (CoreUI trae `smooth`, percibido como lento).
4. **`overscroll-behavior: contain`** + `-webkit-overflow-scrolling: touch` en `.monday-scroll`/`.table-responsive`.
5. **`contain: paint`** en `.monday-scroll`.
6. Tablas nativas para los listados más grandes (`/quejas`, `/mis-quejas`).
7. Encabezados de tabla `sticky` con `transform: translateZ(0)`.
8. Cualquier futuro `npm install` debe **mantener** estas deps; el bundle JS pesado actual es: CoreUI (componentes + CSS) + chart.js.

---

### 11.1 Contrato de rendimiento y mantenimiento

- **Importaciones CoreUI:** `next.config.ts` centraliza `experimental.optimizePackageImports` para `@coreui/react`, `@coreui/icons-react`, `@coreui/icons` y `@coreui/react-chartjs`. Conservar los imports públicos y todas las dependencias de UI; Next optimiza las exportaciones utilizadas.
- **Gráficas del dashboard:** `app/page.tsx` declara `CChartBar` y `CChartDoughnut` con `next/dynamic` y `ssr: false`. No reintroducir imports estáticos de estos componentes ni de Chart.js en esta página; `ChartOptions` debe seguir siendo un import de tipo. Las gráficas se solicitan al montarse en el cliente; esto separa su JavaScript, no elimina su coste de ejecución.
- **Sin saltos de diseño al cargar:** `app/dashboard.module.css` mantiene los contenedores `.chart` (320px de alto) y `.donut` (190 × 190px). El aviso de carga es accesible y visualmente oculto.
- **Listados grandes:** `/quejas` y `/mis-quejas` conservan `<table className="coreui-record-table …">` dentro de un contenedor `.monday-scroll`. No sustituirlos por `CTable`. `app/styles/coreui-bridge.css` centraliza `contain: paint`, `overscroll-behavior: contain`, scroll inmediato y el tratamiento del encabezado sticky. Aplicar el aislamiento al contenedor desplazable, no a las filas.
- **Apariencia independiente:** los tokens viven en `app/styles/tokens.css` y las excepciones por módulo en sus archivos `.module.css`. `quejas.module.css` conserva el espaciado de 12px en encabezados y 14px verticales en celdas por encima de la regla compartida. No modificar `coreui-scoped.css` generado para ajustar una vista.
- **Validación:** ejecutar `npm run build` para comprobar producción y `npm test` para las pruebas existentes. Medir carga y scroll en producción antes de atribuir una mejora numérica a estos cambios.

## 12. Script de generación (`scripts/scope-coreui.mjs`)

Lee `node_modules/@coreui/coreui/dist/css/coreui.css`, con PostCSS:
- Quita `@charset` y `sourceMappingURL`.
- Mantiene `@keyframes` íntegros.
- Reescribe selectores: `:root|html|body` → `.coreui-scope`; `body X` → `.coreui-scope X`; `.sidebar-backdrop` → `body:has(.coreui-scope) > .sidebar-backdrop`; el resto → `:where(.coreui-scope) X`.
- Escribe `app/coreui-scoped.css` con cabecera "Generated by scripts/scope-coreui.mjs. Do not edit directly."

Regenerar tras actualizar `@coreui/coreui`: `node scripts/scope-coreui.mjs`.

---

## 13. Notas / deuda visual

- `app/q/[token]` mezcla identidad (usa lucide-react y Tailwind sin scope) — conviviría mejor traduciendo sus iconos a `icons.tsx` y envolviéndolo en `.coreui-scope` para estética uniforme.
- `tailwind.config.ts` está vacío (solo plugins) — la configuración real vive en `@theme` de `app/styles/tokens.css` (Tailwind v4 CSS-first).
- `dark:` presente en algunas páginas pero sin toggle conectado (estética light por defecto).
- El hover del `CWidgetStatsF` hereda estilos CoreUI; en pantallas <1300px las stats van a 2 col y <480px a 1 col.
- La identidad de "cuadradito" se obtiene por radios pequeños (`--radius-md/lg` + `--cui-border-radius`) más que por clases Tailwind.
