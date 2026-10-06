# Auditoría de la arquitectura visual de ECA-QMS

**Fecha:** 5 de octubre de 2026, Costa Rica.  
**Proyecto:** `mi-dashboard`.  
**Base Git:** `b1f5ec8`, con numerosos cambios locales posteriores sin commit. Se auditó el código del workspace actual, no solamente ese commit.  
**Objetivo:** decidir cómo continuar el diseño para que sea consistente, escalable, fácil de editar y con buen rendimiento. Este documento es una evaluación; no ejecuta ni autoriza una migración.

## 1. Recomendación

**Continuar desde la base actual y ordenar el híbrido es la opción con mejor relación entre beneficio, esfuerzo y riesgo en este momento.** Mantendría CoreUI como biblioteca de componentes, los tokens como contrato de diseño y los CSS Modules para la estructura específica de cada pantalla. Tailwind puede seguir participando, pero su convivencia con CoreUI necesita reglas que el compilador y las pruebas puedan comprobar.

La base existente permite continuar el módulo de Quejas y después Documentos. Sin embargo, todavía no la describiría como una capa visual que cualquier IA puede modificar con seguridad sin conocer excepciones: hay clases con significados diferentes, colores derivados escritos a mano, adaptadores incompletos y pantallas demasiado grandes.

**Si el objetivo prioritario es terminar con un solo vocabulario de estilos, elegiría CoreUI/Bootstrap + CSS Modules y retiraría Tailwind gradualmente.** Es la alternativa de migración más cercana al sistema construido. La razón sería simplificar el mantenimiento; no hay una medición que demuestre que esa conversión acelera por sí sola la aplicación.

**No recomiendo una reescritura completa a Tailwind para este proyecto en su estado actual.** Es viable y puede conservar exactamente la estética CoreUI, pero obliga a sustituir mucha estructura y comportamiento ya existentes. Tailwind no produce una interfaz más fea por naturaleza: la calidad depende de los componentes, los tokens y el diseño que se implementen.

**TanStack Table es una decisión independiente.** Puede incorporarse al híbrido, a CoreUI/Bootstrap o a Tailwind. Conviene añadirlo para columnas configurables, ordenamiento, selección o filtros complejos; instalarlo solamente para acelerar listados de 25 filas no tiene un beneficio demostrado.

## 2. Alcance y límites de la revisión

Se revisaron dependencias, importaciones, adaptadores, shell, formularios, modales, tablas, dashboard, tokens, CSS generado, reglas de cascada, documentación y herramientas de validación. El inventario recorrió los archivos TSX y CSS de `app/` y `components/`, excluyendo `app/api/`.

Se compiló el proyecto en producción, se ejecutaron las pruebas y ESLint, se verificó el CSS generado y se midieron los archivos iniciales y diferidos de ocho rutas con el auditor de bundle del repositorio.

También se abrió el build en el navegador. La sesión disponible llegó a `/login`; allí se inspeccionaron la pantalla y los estilos calculados. **Las pantallas autenticadas se auditaron desde su código, sin una sesión para revisar todos sus estados renderizados.** No se certifican aquí el aspecto de todos los modales en móvil, la accesibilidad completa, los FPS del scroll ni los tiempos de interacción del panel autenticado.

No se hicieron escrituras de prueba sobre registros reales, cambios de esquema, cambios de permisos ni modificaciones de la interfaz. No se construyeron las dos migraciones alternativas; sus beneficios y costos son una evaluación de arquitectura, no resultados de un experimento comparativo.

## 3. Qué tiene realmente el sistema

### Dependencias instaladas

Versiones resueltas en `package-lock.json`, no versiones supuestas:

| Tecnología | Versión | Función |
| --- | --- | --- |
| Next.js | 16.3.6 | Aplicación y compilación |
| React | 19.2.4 | Componentes e interacción |
| `@coreui/react` | 5.13.0 | Componentes visuales React |
| `@coreui/coreui` | 5.9.0 | CSS de CoreUI compatible con Bootstrap |
| Tailwind CSS | 4.3.3 | Utilidades, tema y reset |
| TanStack Query | 5.101.4 | Consultas y caché; no es TanStack Table |
| TanStack Table | No instalado | Posible motor de tablas |
| `lucide-react` | 1.27.0 | Import residual de `Paperclip` en el formulario público |

No existe una dependencia directa `bootstrap`. Eso no significa que la interfaz carezca de Bootstrap: CoreUI aporta una base compatible y sus extensiones. Su documentación permite usar componentes con CSS Bootstrap, pero advierte que los componentes exclusivos de CoreUI requieren sus estilos. El sidebar actual es un ejemplo que debe conservarse o reemplazarse expresamente. [Documentación oficial de CoreUI](https://coreui.io/react/docs/getting-started/introduction/).

No recomiendo cargar simultáneamente el CSS completo de Bootstrap y el CSS completo de CoreUI para intentar estandarizar. Esa combinación introduciría otra superficie de cascada sin resolver los problemas encontrados.

### Inventario de código

| Medida | Resultado | Interpretación |
| --- | ---: | --- |
| Archivos TSX del alcance | 70 | Incluye páginas, componentes y límites de error |
| Archivos que importan `@coreui/react` | 56 | CoreUI está extendido por todo el producto |
| Nombres de componentes CoreUI importados | 61 | Inventario de declaraciones; puede incluir imports sin uso |
| Archivos que importan adaptadores `components/ui/*` | 48 | Existe una base real de reutilización |
| CSS Modules | 10 | La geometría local ya tiene un lugar definido |
| Atributos JSX `style` | 31 | No todos son deuda: incluyen tamaños y colores dinámicos |
| Ocurrencias `dark:` en TSX | 34 | Hay estilos de tema oscuro parciales |
| CSS generado de CoreUI | 14.748 líneas | Se incluye la hoja completa, scopeada |
| Tamaño de ese CSS fuente | 478.688 bytes; 47.875 bytes gzip | Medición del archivo fuente; no es su aporte exacto al bundle minificado |
| `!important` del CSS generado | 1.967 | Provienen de la biblioteca; no son 1.967 errores de la aplicación |

El inventario detectó tablas HTML nativas en Quejas y Mis Quejas. Los demás listados usan el adaptador `Table` basado en `CTable`, o componentes CoreUI directos. Ambos terminan produciendo HTML de tabla: la diferencia relevante es el comportamiento añadido, el CSS aplicado y cuántas filas se montan.

### Organización actual

```text
app/globals.css
  ├── app/coreui-scoped.css        CSS generado; no editar directamente
  ├── Tailwind + Preflight
  ├── app/styles/tokens.css        paleta y radios
  ├── app/styles/base.css          reglas generales, scroll e impresión
  └── app/styles/coreui-bridge.css adaptación de CoreUI

components/ui/*                    adaptadores visuales compartidos
components/Modal.tsx               diálogo compartido y pila de modales
components/AuthenticatedLayout.tsx estructura autenticada
*.module.css                      estructura particular de cada vista
lib/queries/*                     datos y paginación
```

Esta separación es aprovechable. El problema es que sus fronteras todavía permiten demasiadas excepciones.

## 4. Lo que ya conviene conservar

1. **Identidad visual consistente en la base:** sidebar, header, botones, campos, tarjetas y gráficos tienen componentes CoreUI reales. Una migración no debería empezar recreando todo ese trabajo.
2. **Tokens y archivos especializados:** los colores y radios principales están centralizados; el CSS global ya no es un archivo que mezcla toda la aplicación.
3. **CSS CoreUI generado y verificable:** `scripts/scope-coreui.mjs` conserva el upstream y `check:styles` detecta cambios manuales. El aislamiento mediante `.coreui-scope` protege las rutas que usan otra presentación.
4. **Componentes compartidos con comportamiento probado:** el modal administra Escape, foco y niveles de superposición; Button conserva atributos nativos y estados de carga.
5. **Listados paginados:** la configuración habitual pide 25 filas. Esto limita el trabajo del navegador sin necesitar una tabla virtualizada para cada pantalla.
6. **Gráficas separadas del renderizado inicial:** `components/dashboard/Chart.tsx` usa carga diferida y los contenedores reservan alturas de 300/240 px. Conviene mantener ese patrón.
7. **Montaje y descarga diferenciados:** `DeferredMount` conserva instancias habituales sin descargar el formulario al primer clic. Esa decisión reduce regresiones de espera al abrir expedientes.
8. **Errores y recuperación compartidos:** existen `ErrorState`, traducción de errores y límites por ruta. También hay pruebas que protegen respuestas tardías al cambiar de expediente.

Estos puntos sostienen la recomendación de consolidar lo existente. No demuestran que todas las pantallas ya sean igual de legibles o rápidas.

## 5. Hallazgos que dificultan mantener la apariencia

### F1 — Colisiones reales de espaciado: prioridad alta

`app/globals.css` declara las capas `theme → base → coreui → components → utilities`. Eso ordena las reglas normales, pero no garantiza que cualquier utilidad Tailwind gane: las utilidades CoreUI usan `!important`, y las declaraciones importantes tienen reglas de prioridad distintas. [Especificación de la cascada CSS](https://www.w3.org/TR/css-cascade-5/#layer-order).

Ejemplo comprobado:

```css
/* app/coreui-scoped.css:10650 */
:where(.coreui-scope) .p-4 {
  padding: 1.5rem !important;
}
```

En la escala actual de Tailwind, `p-4` representa 1 rem. En el login, dentro del scope, el navegador calculó **24 px**, no 16 px. También se solapan `gap-*`, `px-*`, `py-*`, `mt-*` y `mb-*`; por ejemplo `gap-3` de CoreUI es 1 rem.

**Consecuencia:** copiar una clase entre el formulario público y el panel puede cambiar su tamaño. Una IA puede pedir menos espacio y seguir viendo mucho aire porque el nombre no tiene un significado único.

**Recomendación:** escoger un propietario por vocabulario. Para mantener el híbrido, reservar el espaciado de CoreUI dentro de sus componentes y usar CSS Modules para geometría propia, o estudiar un prefijo Tailwind en una migración controlada. Tailwind documenta `prefix(tw)` para aislar clases y variables. El prefijo exige actualizar usos y referencias: no debe activarse de golpe sobre el código actual. [Prefijos de Tailwind](https://tailwindcss.com/docs/styling-with-utility-classes).

### F2 — Escala tipográfica y fuente con excepciones: prioridad alta

- `app/styles/coreui-bridge.css:111` redefine `text-sm` a 16 px y `text-xs` a 14 px dentro del scope.
- Fuera del scope, esas clases conservan la escala Tailwind de 14/12 px.
- `app/layout.tsx` carga Inter mediante `next/font`, pero el bridge establece `font-family: var(--cui-font-sans-serif)`.
- El CSS generado define esa variable como una lista de fuentes del sistema. El navegador confirmó esa fuente en el login; Inter no era la fuente calculada de sus textos.
- Mis Quejas tiene etiquetas de 11 px y texto de lectura de 15 px en su CSS Module actual. Esto puede ser una elección de densidad, pero rompe la expectativa de una escala única de 16/14 px.

**Recomendación:** decidir explícitamente entre Inter y la fuente del sistema; después mapear esa elección al token CoreUI. Definir tamaños semánticos para texto, metadatos, títulos y lectura. No corregir un problema local de tamaño redefiniendo globalmente una clase que otras pantallas interpretan de otra manera.

El tamaño de 11 px no constituye por sí solo un incumplimiento WCAG; sí merece una revisión de lectura prolongada y zoom.

### F3 — La marca no se modifica desde un único token: prioridad alta

El token principal actual es `#4257be`. El bridge conecta parte de CoreUI con él, pero mantiene derivados RGB, hover, foco y fondos suaves escritos a mano. Cambiar solamente `--color-qms-primary` puede dejar zonas de la marca con el color anterior.

También hay colores literales en CSS Modules, estados `text-gray-*`, colores CoreUI y tokens `qms-*`. No todos son incorrectos, pero no hay una política uniforme que defina cuáles se pueden usar.

**Recomendación:** definir un contrato de colores semánticos y sus derivados. Generarlos o mantenerlos como un conjunto explícito comprobable; evitar que cada pantalla calcule su propia variante de marca.

### F4 — Adaptadores útiles, pero incompletos: prioridad media-alta

`components/ui/Button.tsx` permite atributos HTML, ref y estados de carga. En cambio:

- `Badge` solo acepta variante y contenido, y fija tamaño con un estilo inline.
- `Table` no expone configuración de densidad, caption ni atributos generales de la tabla.
- `TableRow` solo acepta contenido y `onClick`.
- `TableCell` y `TableHeaderCell` no ofrecen todos los atributos nativos necesarios para casos como `colSpan`, `aria-sort` o asociaciones accesibles.
- Muchas vistas mezclan adaptadores con `CButton`, `CCard` y campos CoreUI directos.

**Consecuencia:** al necesitar una variación, resulta fácil saltarse el componente común y crear otra implementación. La frontera ESLint impide algunos imports de negocio, pero no bloquea todos los hooks o imports de consultas. `Pagination` obtiene `PAGE_SIZE` de un módulo de consultas, aunque solo necesita una constante.

**Recomendación:** ampliar contratos por necesidades reales y crear patrones de Field, Toolbar, Tabs, Section y RecordTable. Mantener las constantes visuales fuera de los módulos de consulta. No construir un componente universal con decenas de props sin uso.

### F5 — Pantallas grandes mezclan presentación y flujo: prioridad media-alta

Archivos actuales destacados: `AIProvidersManager.tsx` tiene 1.168 líneas; `GeneradorInformeModal.tsx`, 860; `QuejaDetalleModal.tsx`, 829; `QuejaColaboradorPanel.tsx`, 611.

El tamaño no es un error automático, pero concentra estados, acciones asíncronas, validaciones y varias secciones visuales. Una modificación de cabecera o tipografía obliga a leer más negocio del necesario.

**Recomendación:** extraer secciones de presentación que reciban datos y callbacks. Conservar los estados y los controles de respuesta tardía en el propietario del expediente. Dividir por responsabilidad, no por bloques arbitrarios de líneas.

### F6 — Accesibilidad pendiente de estandarizar: prioridad alta

La revisión de código encontró:

- Filas con `onClick` sin manejo de teclado en Mis Quejas y Revisión. En Quejas hay además un botón de folio que puede ofrecer acceso por teclado: no se debe asumir que todas las filas tienen la misma carencia.
- Campos del formulario público con etiquetas sin `htmlFor` ni una asociación explícita equivalente.
- Pestañas de Documentos con roles ARIA, pero sin el patrón completo de navegación por flechas y relación tab/panel.
- Acciones solo con icono que necesitan nombres accesibles uniformes.
- Un panel lateral distinto del modal compartido: su manejo de foco y la interacción con el fondo requieren comprobación específica.

TanStack Table no resolvería esto automáticamente: la aplicación sigue siendo responsable del HTML y las interacciones.

Contrastes calculados de tokens, en sRGB, sin opacidad adicional:

| Texto / fondo | Relación | Evaluación para texto normal |
| --- | ---: | --- |
| `#4257be` / blanco | 6,29:1 | Supera 4,5:1 |
| `#6c757d` / blanco | 4,69:1 | Supera 4,5:1, con poco margen |
| `#3399ff` / `#e7f1ff` | 2,58:1 | No alcanza 4,5:1 |
| `#e55353` / blanco | 3,69:1 | No alcanza 4,5:1 |
| `#1b9e3e` / blanco | 3,50:1 | No alcanza 4,5:1 |

Son comprobaciones de pares de tokens, no una declaración de que todos los badges fallan. CoreUI usa texto oscuro en varias variantes de badge. Sí hay texto de éxito verde sobre blanco en el código del formulario público. Revisar cada contexto y opacidad antes de corregir. WCAG AA pide normalmente 4,5:1 para texto normal y 3:1 para texto grande. [Contraste mínimo, W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Para acciones compactas, comprobar el área real clicable: el mínimo de referencia WCAG 2.2 es 24×24 CSS px, con excepciones de separación. No confundir el tamaño del icono con el del botón. [Tamaño de objetivos, W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).

### F7 — Optimizaciones CSS que no equivalen a virtualización: prioridad media

El bridge aplica `contain: paint` y `overscroll-behavior: contain` a `.monday-scroll`. También elimina las sombras internas de celdas CoreUI y mantiene scroll inmediato. Son decisiones razonables que deben conservarse hasta comparar un reemplazo.

Sin embargo, `contain: paint` no elimina filas del DOM ni reduce una consulta. En Mis Quejas, `content-visibility: auto` está en el `tbody` completo; no implementa virtualización fila por fila. El comentario que afirma que las filas fuera de viewport no se renderizan es demasiado amplio.

**Recomendación:** describir el efecto real de cada regla y probarla en los navegadores admitidos. No presentar comentarios de rendimiento como mediciones de FPS.

### F8 — Documentación y herramienta visual desactualizadas: prioridad media-alta

`ANALISIS-STACK-VISUAL.md` declara Next 16.2.12, ocho CSS Modules, 50 archivos CoreUI y una paleta anterior. El inventario actual da 16.3.6, diez CSS Modules, 56 archivos y marca `#4257be`. Este reporte sustituye esas cifras para la presente decisión.

`docs/visual-patterns.md` sigue siendo útil, pero debe explicar el efecto de `!important`, no solamente el orden de capas. `contextovisual.md` también conserva descripciones de estructura que han cambiado.

`scripts/visual-check.mjs` referencia `@fontsource/inter`, `app/coreui.generated.css` y `app/coreui-adapter.css`; los tres destinos no existen en el workspace. La herramienta aislada de revisión visual necesita mantenimiento antes de confiar en ella como prueba reproducible.

Las pruebas actuales protegen comportamiento y algunos contratos HTML. No hay en esa suite una comparación completa de capturas, zoom, fuentes y tamaños en todos los módulos.

### F9 — Fronteras públicas y tema oscuro parciales: prioridad media

El formulario público utiliza principalmente Tailwind y no monta el scope CoreUI. Aun así, importa el adaptador `Loader2`, que devuelve `CSpinner`; `AuthShell` también lo utiliza antes de montar el scope. El estilo de esos indicadores depende de comprobar que sus reglas estén disponibles en esa frontera.

Hay 34 ocurrencias `dark:` en TSX, además de reglas oscuras generadas por CoreUI. No se encontró una redefinición `@custom-variant dark` en los estilos propios. Tailwind activa esa variante por `prefers-color-scheme` de forma predeterminada, mientras CoreUI tiene reglas que dependen de `data-coreui-theme`. Por eso, la ausencia de un botón de tema no vuelve inertes las clases Tailwind: pueden producir textos claros en superficies que siguen siendo claras. Es un riesgo concreto de combinación que debe comprobarse en pantalla con la preferencia oscura del sistema. [Modo oscuro oficial de Tailwind](https://tailwindcss.com/docs/dark-mode).

## 6. Cobertura por área

| Área | Base observada | Qué revisar antes de ampliarla |
| --- | --- | --- |
| Shell / menú / header | CoreUI + CSS Modules | Unificar alturas, breakpoints y reserva del riel; probar ambos colapsos y móvil |
| Dashboard | CoreUI + Chart.js diferido | Mantener alturas y leyendas; usar resúmenes textuales equivalentes a los gráficos |
| Quejas | Tabla nativa + modal CoreUI | Preservar densidad, folio accesible, estados de error y flujo transaccional |
| Mis Quejas | Tabla nativa + panel lateral | Textos largos, zoom, truncamiento de badges, foco y lectura prolongada |
| Configuración | CoreUI directo + CSS Module | Homogeneizar formularios, tablas y pestañas; dividir IA por secciones |
| Documentos | Table compartida + pestañas manuales | Buen candidato para un patrón reutilizable de listado y columnas, cuando se complete su lógica |
| Procesos / Auditorías / Riesgos / SACP / Revisión | Adaptadores y CoreUI | Compartir filtros, densidad y acciones; revisar filas interactivas y controles de error secundarios |
| Reportería | Modal y tablas CoreUI | Probar impresión/PDF antes de cambiar el reset o las hojas globales |
| Usuarios | Adaptadores + widgets CoreUI | Mantener estados busy, formularios y acciones accesibles |
| Login | CoreUI dentro del scope | Fuente y espaciado confirmados en navegador; proporciones del bloque de acceso |
| Formulario público | Principalmente Tailwind | Etiquetas, contraste, loaders y equivalencia de tokens con el panel |

## 7. Rendimiento medido del estado actual

Build local de producción, Next 16.3.6, medido mediante `scripts/audit-bundle.mjs`. Unidades: **KiB gzip estimados por archivo**, con chunks únicos por ruta.

| Ruta | JS inicial | CSS inicial | JS diferido |
| --- | ---: | ---: | ---: |
| Dashboard `/` | 264,0 | 55,4 | 114,5 |
| `/login` | 242,0 | 54,4 | 39,1 |
| `/quejas` | 266,9 | 57,6 | 39,1 |
| `/mis-quejas` | 295,1 | 58,7 | 39,1 |
| `/configuracion` | 266,9 | 56,8 | 39,1 |
| `/documentos` | 253,5 | 56,8 | 39,1 |
| `/sacp` | 251,4 | 56,8 | 39,1 |
| `/usuarios` | 253,9 | 56,8 | 39,1 |

No sumar las rutas para estimar una sesión: comparten archivos. La medición excluye fuentes, imágenes, respuestas de datos y costos de ejecución. El JS diferido puede descargarse al montar una sección; no implica necesariamente que espere hasta un clic.

El reporte del auditor está en `.performance/visual-bundle-2026-10-05.json`. El inventario de fuente está en `.performance/visual-source-2026-10-05.json`; estos archivos auxiliares pueden estar ignorados por Git. Las cifras importantes se incluyen aquí para que el Markdown sea autosuficiente.

**Lo que se puede concluir:** hay margen para estudiar el CSS global completo y la ruta Mis Quejas, que tiene el mayor JS inicial entre las rutas medidas. `optimizePackageImports` ya incluye los cuatro paquetes CoreUI solicitados anteriormente. Esa opción optimiza imports JavaScript; no recorta automáticamente la hoja CSS completa.

**Lo que no se puede concluir:** que cambiar de framework reducirá determinado porcentaje de tiempo, que el sistema cumple un número de FPS o que soporta una cantidad concreta de usuarios simultáneos. El CSS escogido no resuelve la concurrencia de escrituras ni la capacidad de la base de datos.

## 8. Comparación de las tres opciones

| Criterio | A. Híbrido ordenado | B. CoreUI/Bootstrap + CSS Modules | C. Tailwind + componentes React |
| --- | --- | --- | --- |
| Aprovecha el trabajo actual | Alto | Alto | Menor |
| Fidelidad al aspecto actual | Alta | Alta si conserva CoreUI | Posible, requiere reconstruir |
| Vocabularios de utilidades | Dos; necesitan separación | Uno | Uno |
| Componentes listos existentes | Se conservan | Se conservan | Se sustituyen o adaptan |
| Esfuerzo de transición | Bajo-medio | Medio | Alto |
| Riesgo de regresión de interacción | Bajo al cambiar por secciones | Medio | Alto |
| Control de una identidad propia | Alto con tokens y módulos | Alto con tokens y módulos | Alto con un sistema de componentes |
| Facilidad para una IA | Buena si se eliminan ambigüedades | Buena si el contrato es uniforme | Buena si los patrones están encapsulados |
| Potencial de reducir CSS | Parcial | Parcial; depende del build CSS | Mayor margen al retirar la hoja CoreUI completa |
| Mejora de velocidad demostrada | Ninguna adicional todavía | No medida | No medida |
| Compatible con TanStack Table | Sí | Sí | Sí |

### A. Continuar con el híbrido

**Pros:** conserva la apariencia, los componentes y los flujos existentes; permite avanzar los módulos sin una reescritura; conserva la flexibilidad de Tailwind para el formulario público y otros layouts; los tokens y adaptadores ya existen.

**Contras:** dos resets y vocabularios exigen disciplina; hay que entender el scope, las capas y los importantes; cambiar tokens todavía no alcanza todas las variantes; sin reglas comprobables, cada nueva pantalla puede aumentar la mezcla.

**Recomendación en este caso:** convertir la convivencia en un contrato verificable. Resolver primero F1–F4, actualizar documentación y establecer un catálogo de ejemplos. CSS Modules deben controlar la geometría local cuando una clase compartida resulte ambigua. Si se elige prefijar Tailwind, hacerlo por un plan que preserve capturas y referencias a variables.

**Costo:** bajo-medio por cambios acotados; no es cero. La normalización de clases puede afectar muchas pantallas. No estimaría horas sin completar un piloto.

### B. CoreUI/Bootstrap en toda la presentación

Para este proyecto hay dos interpretaciones: conservar CoreUI como biblioteca sobre la base Bootstrap, o retirar CoreUI y usar Bootstrap puro con otra capa React. **La primera es la recomendable** si se decide eliminar Tailwind. La segunda amplía mucho el alcance por el sidebar y otros componentes propios.

**Pros:** una escala de utilidades y breakpoints; menos sorpresas de cascada; más afinidad con el diseño administrativo que ya se usa; menores cambios de comportamiento que una migración a Tailwind.

**Contras:** convertir clases arbitrarias y variantes Tailwind implica trabajo real; Bootstrap no cubre toda la geometría particular sin CSS propio; CoreUI completo continúa aportando un CSS amplio; los overrides de marca y el mantenimiento de adaptadores siguen siendo necesarios.

**Recomendación en este caso:** conservar los componentes React CoreUI, migrar geometría a CSS Modules y utilidades CoreUI, y convertir `@theme` a tokens CSS comunes cuando se pueda retirar el compilador Tailwind. Revisar también formulario público, impresión y resets. No añadir Bootstrap JS encima del comportamiento React existente.

CoreUI/Bootstrap permite estudiar una compilación Sass selectiva para reducir CSS, pero esa optimización tiene su propio costo: lista de componentes, utilidades y dependencias de estilos que deben conservarse. No bastaría con borrar selectores aparentemente sin uso. [Optimización oficial de Bootstrap](https://getbootstrap.com/docs/5.3/customize/optimize/).

**Costo:** medio para retirar Tailwind manteniendo CoreUI; alto si se exige además retirar CoreUI. Es la segunda opción recomendada para el caso actual.

### C. Tailwind en toda la presentación

**Pros:** un solo vocabulario de utilidades; tema centralizado; control detallado del layout; posibilidad de retirar el CSS completo CoreUI; independencia visual de su estructura de componentes.

**Contras:** Tailwind es una herramienta de estilos, no reemplaza por sí misma sidebar, diálogos, dropdowns, foco, teclado y pestañas; hay que elegir primitivas React accesibles o implementar esas responsabilidades. Se afectarían los 56 archivos que importan CoreUI, además de estilos y adaptadores. Preservar la apariencia actual exige trabajo de diseño y pruebas.

**Recomendación en este caso:** mantener las interfaces de los adaptadores y sustituir su implementación por etapas; fijar tokens y ejemplos antes de convertir páginas; reemplazar el modal y el shell con pruebas de comportamiento; conservar Chart.js si no hay una necesidad funcional de cambiarlo. La carga CSS y JS de las nuevas primitivas debe medirse.

Tailwind incluye Preflight al importar su hoja principal. Sus resets de márgenes, bordes y encabezados deben considerarse al reconstruir componentes o retirar CoreUI. [Preflight oficial](https://tailwindcss.com/docs/preflight).

**Costo:** alto. Lo elegiría para una renovación deliberada del sistema de componentes o un producto nuevo, no como una optimización rápida de este panel.

## 9. TanStack Table: utilidad real y condiciones

TanStack Table gestiona estado y procesamiento de tablas y deja a la aplicación el HTML y los estilos. Es compatible con Bootstrap, Tailwind y un diseño propio. La documentación actual `latest` identifica **v9**; no se debe copiar indiscriminadamente un ejemplo de v8 al iniciar una integración nueva. [Descripción oficial actual](https://tanstack.com/table/latest/docs/overview).

### Cuándo sí aporta valor

- Definiciones tipadas de columnas compartidas y fáciles de editar.
- Ordenamiento por varias columnas, filtros por columna y visibilidad configurable.
- Selección de registros y acciones masivas cuando el negocio las soporte.
- Anchos, orden o columnas fijadas cuando sean requisitos reales.
- Un patrón de DataTable reutilizable para Documentos y otros módulos.

### Qué no resuelve por instalarlo

- La lentitud de una consulta, una RPC o una carga de adjuntos.
- La apariencia de celdas, botones o filtros.
- La sincronización correcta de ediciones concurrentes.
- La descarga masiva de registros ni un DOM excesivo por sí solo.
- La navegación accesible o una cuadrícula editable similar a Excel sin implementar esas funciones.

**Paginación y virtualización son decisiones diferentes.** La virtualización utiliza una integración adicional, por ejemplo TanStack Virtual; el motor de tablas no equivale automáticamente a renderizar solo filas visibles. [Guía de virtualización](https://tanstack.com/table/v8/docs/guide/virtualization).

El sistema ya pagina habitualmente 25 registros desde el backend. Si se incorpora TanStack Table, conservar la paginación del servidor y la identidad estable `row.id = registro.id`. El ordenamiento/filtro que afecte todo el conjunto debe enviarse al backend: ordenar únicamente la página visible produce resultados incompletos. No descargar todo el historial solo para que la biblioteca lo ordene en el navegador. Los conceptos de paginación manual se describen en la guía de v8, pero sus APIs deben contrastarse con la versión elegida. [Paginación de TanStack](https://tanstack.com/table/v8/docs/guide/pagination).

**Piloto recomendado:** un listado con necesidad concreta de columnas configurables, preferiblemente Documentos al desarrollar ese módulo. Mantener `<table>` y la clase visual actual cuando corresponda; TanStack puede producir ese mismo HTML. Medir transferencia, render y facilidad para añadir una columna. No sustituir de una vez todas las tablas de Quejas, permisos, configuración y reportería.

## 10. Contrato visual recomendado para humanos e IA

La facilidad de mantenimiento debería venir de reglas explícitas y componentes pequeños, no de asumir que todas las IA interpretarán correctamente un archivo grande.

| Necesidad | Lugar único propuesto | Regla |
| --- | --- | --- |
| Colores y radios | Tokens | Cada color tiene una función; sus derivados están documentados |
| Fuente y escala | Tokens + bridge | Una elección de fuente y tamaños semánticos |
| Densidad de registros | RecordTable | Valores compact/regular explícitos, sin cambiar `p-4` global |
| Campos y errores | Field + adaptadores | Label, ayuda, error y atributos accesibles juntos |
| Cabeceras y acciones | Toolbar / encabezados locales | Variantes acotadas; evitar cabeceras duplicadas |
| Pestañas | Tabs | Presentación y teclado coherentes |
| Secciones de expediente | Componentes de presentación | Datos y callbacks por props; sin consultas propias innecesarias |
| Estado de tablas | Motor / hook de tabla | Separado del CSS y de las mutaciones de negocio |
| Modales | Modal compartido | Conservar foco, Escape, pila y guardados |
| Gráficas | Chart + chartKit | Colores semánticos, altura reservada y descripción equivalente |

Un catálogo de ejemplos debe mostrar al menos: listado, formulario, expediente, confirmación, carga, vacío, error, pestañas y menú en móvil. Los comentarios útiles explican una restricción real —por ejemplo por qué el panel no se descarga al primer clic— y no describen cada etiqueta JSX.

Las reglas automáticas deberían detectar colores arbitrarios nuevos, imports de negocio en adaptadores, estilos inline evitables y uso de vocabularios de espaciado incompatibles. Excepciones legítimas como tamaños dinámicos deben poder declararse.

## 11. Plan de decisión y evolución

### Paso 1 — Estabilizar la base antes de otra migración

Crear una referencia revisada de las pantallas y sus estados; reparar la herramienta de fixtures o usar pruebas visuales mantenidas; resolver la elección de fuente; documentar las colisiones; completar los adaptadores que obligan a salirse del patrón.

La referencia debe incluir viewport de escritorio y móvil, zoom de 200%, textos largos, catálogos vacíos, error de red, tabla paginada, panel expandido, sidebar colapsado/oculto y modales anidados. No cambiar toda la tipografía o densidad para hacer pasar las pruebas.

### Paso 2 — Probar la simplificación en una sección

Comparar una sección con híbrido ordenado frente a la misma sección con CoreUI + CSS Modules sin utilidades Tailwind. Criterios: cuántos archivos necesita un cambio visual, cuántas excepciones se añaden, diferencias de apariencia y peso de los archivos producidos.

Si mantener dos vocabularios sigue exigiendo overrides frecuentes, avanzar hacia B. Si la separación funciona y no aumenta la complejidad, continuar A. No tomar esa decisión por una preferencia general del desarrollador por un framework.

### Paso 3 — Añadir TanStack Table por requisitos

Seleccionar un módulo y una necesidad concreta; fijar la versión, definir columnas y adaptar la consulta paginada; conservar permisos y handlers; medir antes/después. La introducción del motor puede hacerse sin migrar el tema visual.

### Paso 4 — Mantener controles de regresión

Los builds deben seguir compilando, las pruebas deben conservarse y las capturas revisadas deben proteger apariencia y densidad. Como objetivos futuros de experiencia pueden usarse INP ≤200 ms y CLS ≤0,1, evaluados en el percentil 75, pero **no están medidos ni certificados en esta auditoría**. Evaluarlos en Vercel con datos reales de usuarios, junto con trazas del navegador para scroll y apertura de expedientes. [INP](https://web.dev/articles/inp), [CLS](https://web.dev/articles/cls).

No asigno porcentajes de mejora ni plazos de migración: faltan prototipos comparables y un inventario de aceptación visual acordado. El costo relativo A < B < C corresponde al código actual y a conservar su aspecto y comportamiento.

## 12. Verificaciones ejecutadas

| Comprobación | Resultado |
| --- | --- |
| `npm run build` | Correcto; producción y TypeScript sin errores |
| `npm test` | 70 aprobadas, 0 fallos |
| `npm run lint` | Correcto |
| `npm run check:styles` | El CSS scopeado coincide con CoreUI instalado |
| `npm run audit:bundle` | Ocho rutas medidas; tabla incluida en este documento |
| Inventario TSX/CSS | Conteos mediante AST TypeScript y lectura de archivos |
| Navegador de producción local | Login observado; `p-4 = 24 px` y fuente del sistema confirmados |
| Contraste de tokens | Cálculo sRGB de los pares indicados; no auditoría completa de cada estado |
| Inspección autenticada de todos los módulos | Pendiente de sesión y recorrido visual |

Los resultados de compilación y pruebas no sustituyen la revisión visual autenticada. Tampoco validan la concurrencia de la infraestructura.

## 13. Preguntas para las otras IA que revisen este reporte

1. ¿La evidencia `p-4 = 24 px` cambia la recomendación de mantener la mezcla de utilidades? ¿Qué frontera concreta proponen?
2. ¿Prefieren ordenar el híbrido o retirar Tailwind gradualmente conservando CoreUI? Justificar con archivos afectados y riesgo de interacción.
3. ¿Qué responsabilidad visual debe quedar en los adaptadores y cuál en CSS Modules?
4. ¿Qué necesidad concreta justificaría TanStack Table en el primer módulo? ¿Cómo mantendrían paginación y filtros del servidor?
5. ¿Qué medición permite distinguir ahorro de transferencia de mejora real en apertura, scroll y edición?
6. Si recomiendan Tailwind completo, ¿cómo reemplazarían sidebar, modales anidados, foco, dropdowns e impresión sin perder comportamiento?
7. ¿Qué hallazgos consideran prioritarios antes de terminar Quejas y continuar Documentos?

**Punto de decisión propuesto:** aprobar primero la normalización de contratos y pruebas visuales, continuar la funcionalidad de Quejas, y reservar una migración completa para cuando un piloto demuestre una ventaja concreta de mantenimiento o rendimiento.
