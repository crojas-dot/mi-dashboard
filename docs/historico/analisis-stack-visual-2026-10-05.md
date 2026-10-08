> Archivo histórico archivado el 8 de octubre de 2026. Conserva la evidencia y las decisiones de su etapa; los imports/componentes descritos pueden haber sido retirados. Para editar hoy, seguir [el mapa de arquitectura](../arquitectura/README.md) y [los patrones vigentes](../visual-patterns.md).

# Análisis del Stack Visual — ECA-QMS Dashboard

> Auditoría de dependencias, CSS y clases de `mi-dashboard`.
> Estado del repo al momento del análisis: `Next.js 16.2.12 + React 19.2.4`.

---

## 1. Resumen del Stack Visual

**Confirmado: el proyecto es un stack híbrido, pero NO usa Bootstrap.** Lo que se percibe como Bootstrap es **CoreUI v5**, un framework derivado de Bootstrap 5 cuyas utilidades y componentes heredan las clases de Bootstrap (`d-flex`, `mb-*`, `card`, `btn`, `form-control`, `table`, …).

Componentes activos del stack:

| Sistema | Paquetes | Rol |
| --- | --- | --- |
| **CoreUI (derivado de Bootstrap 5)** | `@coreui/coreui@5.9.0`, `@coreui/react@5.13.0`, `@coreui/icons@3.1.0`, `@coreui/icons-react@2.3.0`, `@coreui/react-chartjs@3.0.0` | Estructura y componentes: sidebar, header, modales, tarjetas, tablas `CTable`, formularios `CForm*`, badges, dropdowns, paginación, widgets |
| **Tailwind CSS v4 (CSS-first)** | `tailwindcss@^4` + `@tailwindcss/postcss@^4` (devDeps) | Layout, geometría, espaciado, tipografía y colores en vistas nuevas y pantallas específicas |
| **Iconos (doble fuente)** | `@coreui/icons` vía adaptador `components/ui/icons.tsx` (23 archivos) + `lucide-react` (solo 1 archivo) | Iconografía de la app |
| **Gráficas** | `chart.js` + `@coreui/react-chartjs` | Dashboard |
| **CSS Modules** | 8 archivos `*.module.css` (Sidebar, Header, Modal, quejas, mis-quejas, configuracion, dashboard, AIProvidersManager) | Geometría exclusiva por pantalla |

### Cómo conviven (arquitectura real)

- `app/globals.css` es solo la **entrada**: define el orden de capas `@layer theme, base, coreui, components, utilities` e importa `tailwindcss` + `tokens.css → base.css → coreui-bridge.css`.
- `app/styles/tokens.css` define los tokens visuales del sistema en `@theme` (paleta `qms-*`, radios "cuadraditos", sombras), consumidos tanto por Tailwind (`bg-qms-surface`, `rounded-card`, …) como por CoreUI a través de variables CSS.
- El CSS completo de CoreUI (14.748 líneas) se genera **scopeado** en `app/coreui-scoped.css` bajo el selector `.coreui-scope` mediante `scripts/scope-coreui.mjs` (script `npm run styles:coreui`). Se verifica con `npm run check:styles`.
- El scope se aplica en `components/AuthenticatedLayout.tsx:10` (`<div className="coreui-scope flex h-screen overflow-hidden">`) y en la página pública `/login`.
- `app/styles/coreui-bridge.css` conecta las superficies: CoreUI lee la misma paleta que Tailwind (`--cui-body-bg → --color-qms-surface`, etc.) y **reescribe** algunas utilidades que Tailwind también define.
- `tailwind.config.ts` está prácticamente vacío (`plugins: []`): la configuración real es vía `@theme` en CSS (patrón Tailwind v4 CSS-first). Solo plugin en PostCSS: `@tailwindcss/postcss`.

> Conclusión: no hay guerra de frameworks descontrolada. El híbrido CoreUI/Bootstrap + Tailwind v4 es una **decisión de arquitectura documentada** (`docs/visual-patterns.md`: «CoreUI/Bootstrap + Tailwind v4 es una decisión de arquitectura; conservar ambas dependencias» y `components/ui/AGENTS.md`). Pero hay solapamientos e inconsistencias que conviene sanear (sección 4 y 5).

---

## 2. Evidencia de Bootstrap (CoreUI)

No existe el paquete `bootstrap` en `package.json`. Todas las clases "de Bootstrap" provienen de **CoreUI** (que es una variante de Bootstrap 5).

### Dependencias encontradas (`package.json`)

```
@coreui/coreui        ^5.9.0
@coreui/react         ^5.13.0
@coreui/icons         ^3.1.0
@coreui/icons-react   ^2.3.0
@coreui/react-chartjs ^3.0.0
```

### Componentes React de CoreUI en uso (50 archivos importan de `@coreui/react`)

`CSidebar`, `CHeader`, `CBreadcrumb`, `CModal`, `CCloseButton`, `CCard`, `CTable` (+ `CTableHead/Row/HeaderCell/Body/DataCell`), `CButton`, `CFormInput/Select/Textarea/Check/Switch/Range/Label`, `CProgress`, `CWidgetStatsF`, `CDropdown*`, `CListGroup*`, `CNav/CNavLink`, `CAlert`, `CSpinner`, `CInputGroup`, `CBadge`, `CPagination`, `CAvatar`, `CFooter`(solo en `.experiments/`).

### Clases utilitarias tipo Bootstrap detectadas en JSX

- **Layout/flexbox:** `d-flex`, `d-inline-flex`, `d-block`, `flex-wrap`, `flex-column`, `align-items-center`, `justify-content-between`, `justify-content-end`, `me-auto`, `ms-auto`, `flex-grow-1`, `flex-nowrap` — p. ej. `UserMenuDropdown.tsx:15`, `PageHeader.tsx:8-10`, `Header.tsx:202`, `Card.tsx:17`.
- **Espaciado numérico:** `mb-0/mb-2/mb-3`, `mt-2`, `p-0/p-1/p-3/p-4`, `px-3`, `py-2`, `gap-2/gap-3` — `NotificationDropdown.tsx:11-12`, `ErrorState.tsx:21-25`, `Switch.tsx:5`.
- **Texto:** `text-body-secondary`, `text-danger`, `text-decoration-none`, `text-truncate`, `text-start`, `fw-semibold`, `small`, `h6`, `d-block` — `ErrorState.tsx:21`, `UserMenuDropdown.tsx:19-27`.
- **Fondo:** `bg-body-tertiary` — `UserMenuDropdown.tsx:19`, `NotificationDropdown.tsx:11`, `login/page.tsx:46`.
- **Components classes:** `btn btn-outline-secondary`, `btn btn-outline-primary`, `badge text-bg-light border`, `table-responsive`, `border-bottom`, `min-vh-100` — `AdjuntoPreviewModal.tsx:105,123`, `QuejaColaboradorPanel.tsx:446`, `Table.tsx:4`, `login/page.tsx:46`.

### Nota importante sobre aislamiento

Todas estas clases **solo existen dentro de `.coreui-scope`** (el CSS generado las prefija con `:where(.coreui-scope) …`). Fuera del panel autenticado (y de `/login`) no aplican. Eso es lo que evita que pisen el HTML global.

---

## 3. Evidencia de Tailwind CSS v4

### Configuración encontrada

- `package.json` (devDependencies): `tailwindcss@^4`, `@tailwindcss/postcss@^4`.
- `postcss.config.mjs`: solo plugin `@tailwindcss/postcss`.
- `app/globals.css`: `@layer theme, base, coreui, components, utilities` + `@import "tailwindcss";`.
- `tailwind.config.ts`: vacío (`plugins: []`) — la configuración efectiva vive en los `@theme` de `app/styles/tokens.css` (radios, `--color-qms-*`, fondos suaves `--color-soft-*`, sombras). Estilo `Tailwind v4 CSS-first`.
- Una página importa `lucide-react` directamente: `app/q/[token]/page.tsx:5`.

### Tokens del sistema (`app/styles/tokens.css`)

`--color-qms-primary: #5856d6`, `--color-qms-dark`, `--color-qms-muted`, `--color-qms-border`, `--color-qms-surface`, `--color-qms-background`, `--color-soft-{blue,green,red,amber,purple,gray}-*`, `--radius-{xs…4xl}` redefinidos "cuadraditos" (p. ej. `--radius-md: 0.25rem`).

### Clases utilitarias Tailwind detectadas en JSX (100+ coincidencias en `app/` y `components/`)

- **Layout:** `flex`, `flex-1`, `flex-col`, `min-h-screen`, `h-screen`, `overflow-hidden`, `min-w-0`, `items-center`, `justify-between`, `justify-center` — `AuthenticatedLayout.tsx:10-14`, `AuthShell.tsx:17`, `PageHeader.tsx`.
- **Espaciado/sizing:** `p-4`, `px-3`, `py-2`, `gap-2/3/4`, `grid grid-cols-2 gap-4`, `w-full`, `w-24`, `h-8 w-8`, `max-w-[180px]`, `space-y-2`, `shrink-0`, `flew-1`, `truncate` — `configuracion/page.tsx:231-251`, `NuevaAuditoriaModal.tsx:52-54`, `AIProvidersManager.tsx:644-646`, `CambiarMiPasswordModal.tsx:51`.
- **Texto:** `font-semibold`, `font-medium`, `font-mono`, `text-xs`, `text-sm`, `text-gray-500/600/900`, `text-blue-600`, `text-red-600`, `text-qms-primary`, `text-qms-muted`, `break-all` — `AIProvidersManager.tsx:614-644`, `usuarios/*`.
- **Fondo/borde:** `bg-qms-surface`, `bg-gray-50`, `bg-soft-blue-bg`, `border-qms-border`, `border-gray-200`, `rounded-card`, `rounded-button`, `bg-qms-background` — `PasswordModal.tsx:39-47`, `ResetPasswordModal.tsx:85`.
- **Variantes:** `dark:text-gray-400` (oscuras presentes sin toggle activo), `disabled:opacity-50`, `placeholder:text-gray-400`, `focus-within:ring-2`, `focus-within:border-qms-primary`, `transition-colors` — `auditorias/page.tsx:58-59`, `AIProvidersManager.tsx:798`, `ResetPasswordModal.tsx:85`.

### Patrón del botón híbrido "clase sobre componente CoreUI"

`components/ui/Button.tsx:17` envuelve `CButton` **inyectando clases de Bootstrap + sobres de Tailwind**:

```
className={`d-inline-flex align-items-center justify-content-center gap-2 ${className}`}
```

Y en las vistas los estilos visuales Tailwind viajan en `className` de componentes CoreUI:

```tsx
<CButton color="primary" className="px-3 py-1.5 font-medium">…</CButton>
<CTable align="middle" hover className="w-full select-text">…</CTable>
```

Fuente: `configuracion/page.tsx:224-231`.

---

## 4. Análisis de Conflictos

El sistema tiene 3 mecanismos de mitigación (capas, scope `.coreui-scope`, y bridge), por lo que **no hay colisiones catastróficas**, pero sí redundancias y fricciones puntuales:

### 4.1 Colisión real resuelta a mano: `.text-sm` / `.text-xs`

Tailwind define `.text-sm = 0.875rem`. Dentro del panel, `coreui-bridge.css:13-14` lo **pisa deliberadamente**:

```css
.coreui-scope .text-sm { font-size: 1rem; }
.coreui-scope .text-xs { font-size: .875rem; }
```

Consecuencia: el mismo nombre de clase produce tamaños distintos según esté dentro o fuera de `.coreui-scope`. Funciona, pero es un token que ya no significa lo mismo en todo el sistema y sorprende al mover un fragmento entre zonas.

### 4.2 Utilidades duplicadas con el mismo efecto

Bootstrap y Tailwind definen **nombres idénticos** para espaciado y flexbox: `gap-*`, `p-*`, `px-*`, `py-*`, `mt/mb-*`, `flex-*`. En el mismo árbol se mezclan:

```tsx
<div className="d-flex flex-wrap align-items-center gap-3 mb-3">   // CoreUI + "gap" (ambos)
<div className="flex flex-wrap items-center gap-3 px-3 py-2">      // Tailwind
```

Esto duplica la forma de lograr lo mismo (`d-flex` vs `flex`; `justify-content-between` vs `justify-between`; `mb-3` vs `mb-3` de Tailwind). Circulante: `UserMenuDropdown.tsx:15-27` (Bootstrap) junto a `CambiarMiPasswordModal.tsx:51` (Tailwind) para idénticos resultados visuales.

### 4.3 Doble sistema de iconos

23 archivos usan el adaptador `@/components/ui/icons` (CoreUI). `lucide-react` queda como import residual en el formulario público `app/q/[token]/page.tsx:5`. Dos librerías de iconos = bundle y API duplicadas.

### 4.4 Paleta paralela

Cada framework tiene su propia semántica de color usada simultáneamente: `bg-body-tertiary` / `text-body-secondary` (CoreUI) conviven con `bg-gray-50` / `text-gray-500` y tokens `qms-*` (Tailwind). Un cambio de tema exige tocar ambos mundos (`--cui-*` y `--color-*`).

### 4.5 Clases "dark:" sin toggle

Decenas de variantes `dark:text-gray-400` / `dark:bg-…` en páginas, sin un toggle de modo oscuro conectado (aguas arriba se documenta así). Código CSS presente pero inerte.

### 4.6 Restos de plantilla

- `.experiments/` contiene archivos del template CoreUI (`_nav.tsx`, `Footer.tsx`) que **nadie importa** (comprobado por búsqueda).
- `public/coreui/` referido en AGENTS.md **no existe** en el workspace y nada lo importa; el CSS real viene de `app/coreui-scoped.css` generado.

### 4.7 Lo que EVITA el conflicto mayor (correcto)

1. **Scope**: todo el CSS de CoreUI va prefijado `:where(.coreui-scope)` → baja especificidad y no contamina fuera del panel.
2. **Capas**: `@layer coreui` se declara antes que `utilities`, así las utilidades Tailwind ganan en empates.
3. **Bridge**: `coreui-bridge.css` ajusta superficies y tablas (sombra `box-shadow: none` para scroll fluido, columnas fijas, etc.).

Ese diseño es sólido; los puntos 4.1–4.6 son los que conviene sanear.

---

## 5. Recomendación

**No migres a un solo framework** — la arquitectura híbrida es intencional y está documentada (`docs/visual-patterns.md`, `components/ui/AGENTS.md`), y el coste de migrar 50 archivos de `@coreui/react` a HTML/Tailwind sería alto y de bajo valor. Lo profesional es **consolidar el contrato de separación** y eliminar redundancias:

### 5.1 Fijar el principio de responsabilidad (gobernanza)

| Capa | Framework que manda |
| --- | --- |
| Componentes de UI (modal, tabla, tarjeta, botón, select, badge, paginación) | CoreUI (`CTable`, `CModal`, `CButton`, …) |
| Layout shell (sidebar, header, breadcrumb, panel) | CoreUI + CSS Modules |
| Geometría/espaciado/tipografía de una vista concreta | Tailwind quirúrgico en `className` sobre los componentes CoreUI, con el menor `style` inline posible |
| Paleta y radios | SOLO `tokens.css` (`@theme`), alimentando a ambos |

### 5.2 Acciones concretas recomendadas

1. **Unificar espaciado:** elegir un solo vocabulario (`p-*`, `m-*`, `gap-*`, `mb-*`) y eliminar gradualmente las utilidades Bootstrap `d-*` cuando haya equivalente Tailwind en el mismo componente. Priorizar **Tailwind para geometría** y dejar CoreUI solo para efectos de componente (`btn`, `card`, `table-hover`). El bridge de `text-sm/text-xs` debe quedar documentado en `visual-patterns.md` como excepción deliberada (ya lo está implícitamente) o normalizarse eligiendo una sola escala.
2. **Unificar la paleta:** mover las clases residuales Bootstrap de color (`bg-body-*`, `text-body-*`, `text-danger`) a tokens Tailwind `qms-*` o `soft-*` en los archivos nuevos; mantener `--cui-*` únicamente como vínculo interno del puente.
3. **Eliminar `lucide-react`:** el formulario `/q` debería usar `@/components/ui/icons` como el resto. Un solo set de iconos.
4. **Quitar restos:** borrar `.experiments/` y cualquier referencia a `public/coreui`.
5. **Resolver las `dark:` inertes:** o conectar el modo oscuro (gran esfuerzo, CoreUI lo soporta) o eliminar las variantes huérfanas.
6. **Automatizar la higiene:**
   - Conservar `npm run check:styles` en el pipeline (evita editar a mano `coreui-scoped.css`).
   - Añadir una regla ESLint/lint de clases para que **no entren** utilidades Bootstrap de espaciado (`mb-\d`, `d-flex`, `gap-\d`, `px-\d`) en archivos que ya son Tailwind-kit, o al menos un informe de auditoría.
   - Mantener la validación `npm test` + `npm run check:styles` + `npm run build` + `npm run audit:bundle` al tocar estilos.

### 5.3 Si algún día quisieras simplificar

- **Opción A (conservadora, recomendada):** quedarse con CoreUI como capa de componentes y Tailwind como capa de layout, sanando los puntos 4.1–4.6. Coste bajo.
- **Opción B (migración total a Tailwind):** reemplazar CTable→tablas nativas `coreui-record-table` (ya existe el patrón en Quejas/Mis Quejas), CModal→`Modal.tsx`, CButton→`Button.tsx`… Construir el resto de componentes. Es factible varias semanas y riesgo alto de regresiones visuales; solo merece la pena si CoreUI deja de dar soporte.
- **Opción C (solo Bootstrap puro):** descartar Tailwind y asumir CoreUI para todo (incluido layout). Implica reescribir todos los layout utilitarios y perder los tokens v4.

La recomendación concreta es **5.2 + opción A**, manteniendo el scope `.coreui-scope` como frontera inviolable.
```