# Auditoría Visual y Arquitectónica — ECA-QMS Dashboard

Auditoría exhaustiva del sistema de estilos, componentes, coherencia, facilidad de modificación, adaptabilidad y confiabilidad del codebase.

---

## 1. DIAGNÓSTICO GENERAL — "La Triple Personalidad del CSS"

> [!CAUTION]
> El sistema tiene **3 capas de estilos que compiten entre sí**, 2 de las cuales están completamente muertas. Esto es el problema #1 de todo el proyecto visual.

| Capa | Archivo | Tamaño | ¿Se usa realmente? |
|------|---------|--------|---------------------|
| **Tailwind v4 + tokens** | [globals.css](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/app/globals.css) | 4 KB | ✅ Sí — base activa |
| **Flowbite theme tokens** | [qms-flowbite-theme.css](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/app/qms-flowbite-theme.css) | 10 KB | ❌ **No importado** en ningún componente ni layout |
| **CoreUI generated** | [coreui.generated.css](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/app/coreui.generated.css) + [adapter](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/app/coreui-adapter.css) | **113 KB + 6 KB** | ❌ **Clases `qms-cui-*` no se usan en ningún `.tsx`** |

**Resultado:** ~129 KB de CSS muerto en el repositorio. Los archivos Flowbite y CoreUI son artefactos de una exploración anterior que nunca se limpiaron.

---

## 2. SISTEMA DE TOKENS — Contradicciones Activas

> [!WARNING]
> Los tokens que **sí** están activos se contradicen entre `globals.css` (@theme) y `tailwind.config.ts`.

### 2.1 Border Radius — 3 definiciones conflictivas

| Fuente | `sm` | `md` | `lg` |
|--------|------|------|------|
| [globals.css](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/app/globals.css#L9-L16) `@theme` | 3px | 4px | 6px |
| [tailwind.config.ts](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/tailwind.config.ts#L41-L44) | **8px** | **25px** | **50px** |
| Uso real en código | `borderRadius: '4px'` hardcodeado en inline styles | `borderRadius: '0.375rem'` (6px) en Modal | `rounded-lg` (pick de Tailwind = **50px** 😱) |

**Impacto:** Cuando un componente usa `rounded-lg` de Tailwind, hereda `50px` (una píldora). Cuando usa `style={{ borderRadius: '4px' }}`, ignora todo. La intención "cuadradito" del diseño se rompe según el camino que se tome.

### 2.2 Tipografía — 2 fuentes declaradas, una tercera usada

| Fuente | Declaración |
|--------|------------|
| `tailwind.config.ts` | `fontFamily.sans = Verdana, Geneva, Tahoma` |
| `globals.css` body | `font-family: 'Inter', system-ui, -apple-system, sans-serif` |
| Componentes | Heredan del body → Inter (si está cargada) o system-ui |

**Problema:** El config dice Verdana, el CSS dice Inter, pero **Inter nunca se importa** (no hay `@import` de Google Fonts ni `next/font`). El resultado real es **system-ui** en la mayoría de sistemas.

### 2.3 Spacing — Escala personalizada inutilizable

El [tailwind.config.ts](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/tailwind.config.ts#L24-L38) redefine `spacing` con valores como `xs: 0.125rem`, `md: 0.3125rem`, `10xl: 2.5rem`. Esto **sobreescribe la escala numérica estándar de Tailwind** (`1`, `2`, `4`, `8`, etc.), lo que haría que clases como `p-4` dejen de funcionar como se espera. Sin embargo, el código real usa clases como `px-3`, `py-2`, `gap-2` que son de la escala numérica estándar y **no** usa `p-xs`, `p-md`, etc. — la personalización es inoperante.

### 2.4 Screens — Breakpoints nominalmente confusos

```
'w-400': '400px', 'w-576': '576px', 'w-600': '600px', 'w-640': '640px', ...
```

Ninguno de estos breakpoints personalizados se usa en el código. Los componentes usan `sm:`, `md:`, `lg:` — breakpoints por defecto de Tailwind.

---

## 3. COMPONENTES UI — Análisis por pieza

### 3.1 Tabla de Calificación

| Componente | Calidad | Problemas |
|-----------|---------|-----------|
| [Button.tsx](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/components/ui/Button.tsx) | ⚠️ Medio | Hover via JS `onMouseEnter/Leave` + `Object.assign` — no usa Tailwind `hover:`. Colores hardcodeados en inline styles, no tokens. |
| [Badge.tsx](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/components/ui/Badge.tsx) | ⚠️ Medio | Colores hardcodeados. Solo 7 variantes hardcodeadas, no extensible. `variant: string` sin type safety. |
| [Table.tsx](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/components/ui/Table.tsx) | ⚠️ Medio | Hover via JS (`e.currentTarget.style`). Border y bg hardcodeados. `colSpan={999}` en EmptyState. |
| [Select.tsx](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/components/ui/Select.tsx) | ✅ Bueno | Mezcla Tailwind + inline pero es limpio. forwardRef correcto. |
| [Switch.tsx](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/components/ui/Switch.tsx) | ✅ Bueno | 100% inline styles, coherente internamente. ARIA correcto. |
| [Modal.tsx](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/components/Modal.tsx) | ✅ Bueno | Esc/overlay/scroll lock. Hover en botón de cierre via JS. |
| [StatCard.tsx](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/components/StatCard.tsx) | ⚠️ Medio | Color map duplicado (existe también en `variants.ts` con valores diferentes). |
| [PageHeader.tsx](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/components/ui/PageHeader.tsx) | ⚠️ Medio | Hover JS en el link. Colores hardcodeados. |
| [Pagination.tsx](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/components/ui/Pagination.tsx) | ✅ Bueno | Limpio, compone sobre Button. |
| [EmptyState.tsx](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/components/ui/EmptyState.tsx) | ⚠️ Bajo | `colSpan={999}` es un hack. Usa `text-slate-400` (clase Tailwind) inconsistente con la paleta `#6c757d`. |
| [Icons.tsx](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/components/ui/Icons.tsx) | 🔴 Muerto | Importa de `@fortawesome/*` que **NO está en package.json**. Ningún componente lo importa. Código zombie. |
| [Sidebar.tsx](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/components/Sidebar.tsx) | ⚠️ Medio | ~100 líneas de inline styles y handlers JS para hover. Funcionalidad buena (prefetch, permisos). |
| [Header.tsx](file:///c:/Users/Soporte/Documents/Open%20Code/PruebaVercel/mi-dashboard/components/Header.tsx) | ⚠️ Alto-Medio | 353 líneas — demasiada responsabilidad (notificaciones + user menu + prefs + sonidos). Debería extraerse. |

### 3.2 El Patrón Anti-Tailwind Dominante

**134 ocurrencias** de `style={{...}}` inline en TSX y **10 pares** de `onMouseEnter/onMouseLeave` para implementar hover. Esto es un anti-patrón grave cuando ya se tiene Tailwind:

```tsx
// LO QUE SE HACE HOY (Button.tsx):
onMouseEnter={(e) => {
  const h = hoverStyles[variant]
  if (h) Object.assign(e.currentTarget.style, h)  // ← imperativo, frágil
}}

// LO QUE DEBERÍA HACERSE:
className={`bg-qms-primary hover:bg-qms-primary-dark text-white ...`}
```

**¿Por qué es un problema?**
- Los inline styles **no pueden usar pseudo-clases** (`:hover`, `:focus`, `:active`, media queries)
- Se pierde tree-shaking de CSS (Tailwind solo genera clases usadas)
- Imposibilita dark mode sin reescribir toda la lógica JS
- No es searchable — cambiar un color requiere buscar hex codes en 20+ archivos

---

## 4. COHERENCIA — Mapa de Colores Duplicados

El mismo color aparece definido en **5 lugares diferentes**, hardcodeado en docenas de archivos:

| Color | Rol | ¿Dónde se define? | ¿Dónde se hardcodea? |
|-------|-----|-------------------|---------------------|
| `#0d6efd` | Primary | `globals.css`, `tailwind.config.ts`, `qms-flowbite-theme.css` | **24 archivos .tsx** |
| `#212529` | Dark/text | `globals.css`, `tailwind.config.ts` | **18 archivos .tsx** |
| `#dee2e6` | Border | `globals.css` | **18 archivos .tsx** |
| `#6c757d` | Muted | `globals.css`, `tailwind.config.ts` | **16 archivos .tsx** |
| `#343a40` | Header | `globals.css` | En Header, Sidebar, Table |
| `#dc3545` | Danger | Solo inline | Badge, Button, Header, quejas |
| `#198754` | Success | Solo inline | Badge, StatCard, quejas |
| `#f8f9fa` | Hover-bg | Solo inline | Sidebar, Header, PageHeader, etc. |

> [!IMPORTANT]
> Si mañana necesitas cambiar el color primario de `#0d6efd` a otro, tendrías que editar **24 archivos** manualmente. Eso es exactamente lo que un design system debe evitar.

---

## 5. FACILIDAD DE MODIFICAR — Rating: 🔴 Baja

| Dimensión | Estado | Razón |
|-----------|--------|-------|
| **Cambiar un color global** | 🔴 | Requiere buscar y reemplazar hex en 20+ archivos |
| **Agregar dark mode** | 🔴 | Imposible con inline styles en JS; requiere reescritura total |
| **Agregar una variante de Badge** | 🟡 | Requiere editar el mapa hardcoded en Badge.tsx |
| **Cambiar tamaño de botón** | 🟡 | Inline styles, hay que editar el mapa en Button.tsx |
| **Agregar un breakpoint responsivo** | 🔴 | El config tiene breakpoints custom no usados + inline styles no son responsive |
| **Refactor visual completo** | 🔴 | No hay separación entre tokens y componentes |

---

## 6. ADAPTABILIDAD — Rating: 🟡 Media

| Aspecto | Estado | Notas |
|---------|--------|-------|
| **Componentes reutilizables** | ✅ | Buen catálogo: Button, Badge, Select, Table, Modal, StatCard, Pagination, EmptyState, Switch |
| **Composición** | ✅ | PageHeader acepta children, Modal tiene sizes, Pagination compone sobre Button |
| **Tipado TypeScript** | 🟡 | Button tiene tipos correctos, pero Badge acepta `variant: string` sin unión |
| **State management** | ✅ | Zustand + TanStack Query bien separados |
| **Estructura de carpetas** | ✅ | Clara: `components/ui/`, `components/quejas/`, etc. |
| **Error boundaries** | ✅ | Hay `error.tsx` y `global-error.tsx` |

---

## 7. CONFIABILIDAD — Rating: ✅ Alta (lógica), 🟡 Media (visual)

| Aspecto | Estado | Notas |
|---------|--------|-------|
| **Lógica de negocio** | ✅ | RPCs, permisos, auth, RLS, folios — todo sólido |
| **Data fetching** | ✅ | TanStack Query bien configurado, invalidación correcta |
| **Auth guard** | ✅ | AuthShell + permisos dinámicos + protección último admin |
| **Realtime** | ✅ | Suscripciones con debounce 750ms |
| **Código zombie** | 🔴 | Icons.tsx importa FontAwesome inexistente; 3 CSS no usados |
| **Hovers via JS** | 🟡 | Funcionan pero son frágiles — un re-render inesperado puede dejar el estado "stuck" |

---

## 8. VEREDICTO: ¿Puro Tailwind, Tailwind + Custom, o Híbrido?

> [!IMPORTANT]
> **Recomendación: Tailwind v4 con @theme tokens y CERO inline styles.**

### ¿Por qué NO puro Tailwind sin personalización?
- Los colores Bootstrap del proyecto (`#0d6efd`, `#212529`, `#6c757d`, `#dee2e6`) no existen en la paleta default de Tailwind → necesitas tokens personalizados
- Los border-radius "cuadraditos" son una decisión de marca → requieren override

### ¿Por qué NO inline styles?
- No soportan hover, focus, dark mode, responsive
- Imposibilitan búsqueda centralizada de tokens
- Son más lentos que CSS (aplicados en cada render)

### La estrategia ideal para este proyecto

```
┌──────────────────────────────────────────────────┐
│  globals.css → @theme                            │
│  Define tokens semánticos:                       │
│    --color-qms-primary, --color-qms-dark,        │
│    --color-qms-border, --color-qms-muted,        │
│    --color-qms-danger, --color-qms-success,      │
│    --radius-btn, --radius-card, --radius-modal   │
├──────────────────────────────────────────────────┤
│  Components → SOLO clases Tailwind              │
│    bg-qms-primary hover:bg-qms-primary-dark     │
│    text-qms-dark border-qms-border              │
│    rounded-btn rounded-card                      │
│    CERO style={{}} para colores/radios           │
├──────────────────────────────────────────────────┤
│  tailwind.config.ts → ELIMINAR overrides        │
│    Quitar spacing, borderRadius, screens custom  │
│    Quitar fontFamily (definir solo en @theme)     │
└──────────────────────────────────────────────────┘
```

---

## 9. PLAN DE ACCIÓN PROPUESTO

### Fase 1 — Limpieza inmediata (bajo riesgo, alto impacto)
- [ ] **Eliminar** `coreui.generated.css`, `coreui-adapter.css`, `qms-flowbite-theme.css` — 0 consumidores
- [ ] **Eliminar** `components/ui/Icons.tsx` — importa paquete inexistente, 0 consumidores
- [ ] **Eliminar** del `public/coreui/` los CSS no usados
- [ ] **Limpiar** `tailwind.config.ts` — quitar spacing, borderRadius, screens y fontFamily custom que no se usan

### Fase 2 — Consolidar tokens en @theme (medio riesgo)
- [ ] Ampliar `globals.css` @theme con TODOS los colores semánticos (danger, success, warning, muted, header, etc.)
- [ ] Agregar border-radius semánticos (`--radius-btn: 4px`, `--radius-card: 6px`, `--radius-modal: 6px`)
- [ ] Agregar alias de hover (`--color-qms-primary-hover`, `--color-qms-hover-bg`)
- [ ] Importar Inter desde Google Fonts o `next/font/google`

### Fase 3 — Migrar componentes base (medio riesgo, 9 archivos)
- [ ] Reemplazar `style={{...}}` + `onMouseEnter/Leave` por clases Tailwind con tokens en: Button, Badge, Table, TableRow, TableHeaderCell, TableCell, StatCard, PageHeader, EmptyState
- [ ] Unificar `Badge.variant` con union type strict
- [ ] Usar `hover:bg-qms-hover` en vez de JS imperativo

### Fase 4 — Migrar páginas (alto esfuerzo, bajo riesgo por página)
- [ ] Reemplazar hex hardcodeados por clases semánticas (`text-qms-dark`, `border-qms-border`, `bg-qms-primary`)
- [ ] Orden sugerido: page.tsx → quejas/page → mis-quejas/page → configuracion/page → ...

### Fase 5 — Refactorizar Header.tsx
- [ ] Extraer `NotificacionesDropdown` como componente
- [ ] Extraer `UserMenuDropdown` como componente
- [ ] Header queda como orquestador de ~50 líneas

---

## Open Questions

> [!IMPORTANT]
> **¿Quieres que implemente este plan?** Puedo empezar por la Fase 1 (limpieza sin riesgo) y luego ir fase por fase.

1. **¿Hay algún motivo para conservar los archivos CoreUI/Flowbite?** (Parece que fueron experimentos descartados, pero confirmo.)
2. **¿Quieres que la migración sea gradual (archivo por archivo) o en un solo batch?**
3. **¿Hay planes de dark mode a futuro?** Si sí, la Fase 2 debería incluir tokens `.dark` desde ya.
4. **¿El font definitivo es Inter, Verdana, o el system font?**
