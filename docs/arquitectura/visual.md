# Apariencia: fuentes y particularidades

La guía de trabajo canónica es [docs/visual-patterns.md](../visual-patterns.md).
Incluye controles, accesibilidad, responsive, skeletons, operaciones y configuración.
El [mapa de edición](README.md) ubica cada cambio visual. No usar inventarios CoreUI
ni prototipos con prefijo tw: como base de una vista del runtime.

## Fuentes activas

- app/layout.tsx importa únicamente app/globals.css; esta importa Tailwind v4 sin prefijo, app/styles/theme.css y app/styles/components.css.
- @theme en app/styles/theme.css define colores, fuente, escala, radios y sombras. Las recetas ui-* están en app/styles/components.css; las utilidades globales están en app/globals.css.
- Inter llega por next/font; escala actual: text-xs 14px, text-sm 15px, text-base 16px. Fuente de filas operativas: 16px.
- Marca #024796, hover #013b7d, fondo #f4f7f6, surface blanco, borde #dee2e6 y header de tabla #F0F2F5. Estado En Investigación conserva token qms-investigacion **#F57C00 con texto blanco**; sus variants están en lib/constants/estados.ts y los estilos de Badge en lib/constants/badges.ts.
- Button/campos: 40px mínimos, sm 32px; controles móviles principales 44px. Radios de botón 4px, panel/modal 6px.
- Sidebar desktop 250px/64px colapsado desde lg; móvil drawer hasta 320px sin marcos anidados. Shell h-dvh con scroll propio del main.
- Body usa select-none; tablas y contenido que debe copiarse usan select-text. globals.css define scrollbars e impresión; .informe-content delimita el informe.

## Contratos que no se deben romper

- Avatar de Header: 40px, iniciales con leading de 1 y ajuste óptico vertical de 1px; nombre/correo completos dentro del menú, sin recortar datos guardados.
- Login: conservar username/current-password y desbloqueo de readonly por foco/pointerdown; arregla la vista previa Chromium sin desactivar autocompletado.
- Antes de verificar una URL privada, solo fondo neutral; no presentar barra, login ni shell de dashboard. Login/logout usa skeleton de login cuando corresponde; datos pendientes del módulo usan solo su carga propia.
- Skeletons fijos CSS y movimiento reducido; Spinner solo en operaciones. Sin espera mínima ni círculo permanente por registro o Acta Pendiente.
- Modal mantiene dialog nativo, top layer, Tab/Shift+Tab, foco, Escape/fondo y scroll lock de modales anidados.
- Clases dark: pueden existir, pero no hay selector completo de tema integrado. QuejasSummary dibuja SVG y no carga Chart.js en el dashboard activo.

Catálogos usa `COLORES_CATALOGO` de `lib/constants/badges.ts`: primary, info, success,
warning, danger y secondary son códigos DB; sus etiquetas y estilos se resuelven
en la misma fuente. El editor y el servicio validan esas opciones antes de escribir.
No guardar nombres de variantes visuales ni hex en ese campo. La resolución de
Quejas depende de su estado, nunca del color de su badge.

Cada regla de tamaños y variantes vive en los tokens/kit; no copiar paletas o CSS
por página para resolver un ajuste local. Revisar componentes montados y el CSS
importado antes de modificar archivos similares de una etapa anterior.
