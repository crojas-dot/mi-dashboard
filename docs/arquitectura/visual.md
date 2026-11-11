# Apariencia: fuentes y particularidades

9 noviembre, local: [estabilidad de Quejas y Mis Quejas](../quejas-resolucion-y-revision-gc-2026-11-03.md#estabilidad-del-modal--9-noviembre-de-2026).
Asistencia sale del flex de las pestañas y se limita a investigación editable;
el lienzo `fill` de Tiptap admite escritura en toda su superficie sin el anillo
interno que aparecía bajo el texto. El encabezado responde al ancho del workspace
y los textos accesibles del ciclo permanecen dentro de su scroll. QA sintética
505/505, sin publicación; límites de las pruebas del informe en la referencia.

4 noviembre, local: [revisión GC y respuesta al cliente](../quejas-revision-y-respuesta-2026-11-04.md)
separadas. Revisión breve con alto según contenido, respuesta/oficio/documento y
consulta de resolución plegada en la siguiente etapa. `Modal height="content"`
es opcional para documentos; los demás editores conservan su altura previa.

5 noviembre, editor del informe de Quejas: variante `Modal variant="report"` de
94vw/1450px por 94dvh, con encabezado fijo, barra Tiptap compacta y una sola región
desplazable para la hoja A4. Su hoja y reglas de metadatos/secciones están aisladas
en `QuejaInformeHoja.module.css`; no aplicar al resto de editores ni a `document`.
Word/PDF mantienen A4 y presentan títulos/metadatos con estilos de informe.

16 octubre, local: Mis Quejas reutiliza el workspace/ciclo/plazo de Quejas, con lienzo
Tiptap y asistencia secundaria; la publicación de Calidad separa documento interno y
respuesta pública. Seguimiento utiliza el mismo kit en una página genérica adaptable.
Validado en escritorio y 390/320 px. [Contrato, capturas y estado](../quejas-seguimiento-y-publicacion-2026-10-16.md).

La guía de trabajo canónica es [docs/visual-patterns.md](../visual-patterns.md).
Incluye controles, accesibilidad, responsive, skeletons, operaciones y configuración.
El [mapa de edición](README.md) ubica cada cambio visual. No usar inventarios CoreUI
ni prototipos con prefijo tw: como base de una vista del runtime.

## Fuentes activas

- app/layout.tsx importa únicamente app/globals.css; esta importa Tailwind v4 sin prefijo, app/styles/theme.css y app/styles/components.css.
- @theme en app/styles/theme.css define colores, fuente, escala, radios y sombras. Las recetas ui-* están en app/styles/components.css; las utilidades globales están en app/globals.css.
- Inter llega por next/font; escala actual: text-xs 14px, text-sm 15px, text-base 16px. Fuente de filas operativas: 16px.
- Marca #024796, hover #013b7d, fondo #f4f7f6, surface blanco, borde #dee2e6 y header de tabla #F0F2F5. Quejas/Mis Quejas leen `estado_color` del catálogo para el fondo de Badge y conservan el mapa histórico como fallback; paleta en lib/constants/badges.ts. Los demás estados neutros conservan `qms-neutral-soft` (aprox. #F0EFEF) y texto `qms-dark` (#212529). QuejaPlazoIndicator comparte el semáforo de plazo (punto y texto sin fondo; gris cuando no hay plazo activo). Los colores persistidos, fechas y reglas no cambian.
- Button/campos: 40px mínimos, sm 32px; controles móviles principales 44px. Radios de botón 4px, panel/modal 6px.
- Sidebar desktop 250px/64px colapsado desde lg; móvil drawer hasta 320px sin marcos anidados. Shell h-dvh con scroll propio del main.
- Marca del Sidebar: el hueco de 40px (mismo tamaño y padding que el avatar de Header) muestra el logo institucional sin fondo ni máscara circular —un PNG conserva su transparencia— o, si no hay logo, la inicial «E» dentro de un círculo azul; `EmpresaLogo` vuelve a la inicial si la URL falla. La fila de marca mide h-14 y, en el menú de escritorio, la línea divisoria es un hr corto e independiente de la que usa el encabezado móvil. El recorte del editor es cuadrado y sin esquinas redondeadas, para que la vista previa coincida con el resultado.
- Body usa select-none; tablas y contenido que debe copiarse usan select-text. globals.css define scrollbars e impresión; .informe-content delimita el informe.

## Contratos que no se deben romper

- Avatar de Header: 40px, iniciales con leading de 1 y ajuste óptico vertical de 1px; nombre/correo completos dentro del menú, sin recortar datos guardados.
- Login: conservar username/current-password y desbloqueo de readonly por foco/pointerdown; arregla la vista previa Chromium sin desactivar autocompletado.
- Antes de verificar una URL privada, solo fondo neutral; no presentar barra, login ni shell de dashboard. Login/logout usa skeleton de login cuando corresponde; datos pendientes del módulo usan solo su carga propia.
- Skeletons fijos CSS y movimiento reducido; Spinner solo en operaciones. Sin espera mínima ni círculo permanente por registro o Acta Pendiente.
- Modal mantiene dialog nativo, top layer, Tab/Shift+Tab, foco y scroll lock de modales anidados. Escape/fondo cierran por defecto; dismissOnEscape/dismissOnBackdrop permiten exigir X en una vista concreta.
- Clases dark: pueden existir, pero no hay selector completo de tema integrado. QuejasSummary dibuja SVG y no carga Chart.js en el dashboard activo.

Catálogos usa `COLORES_CATALOGO` de `lib/constants/badges.ts`: primary, info, success,
warning, danger y secondary son códigos DB; sus etiquetas y estilos se resuelven
en la misma fuente. El editor y el servicio validan esas opciones antes de escribir.
No guardar nombres de variantes visuales ni hex en ese campo. La resolución de
Quejas depende de su estado, nunca del color de su badge.

Cada regla de tamaños y variantes vive en los tokens/kit; no copiar paletas o CSS
por página para resolver un ajuste local. Revisar componentes montados y el CSS
importado antes de modificar archivos similares de una etapa anterior.

## Visor de evidencias

Drive conserva su visor nativo inmediato, sin skeleton ni descarga previa en QMS. Marco fijo y espacio completo desde el primer render; cada visita se desmonta al cerrar/cambiar archivo. Repetir el mismo clic conserva el iframe. Storage legacy usa su URL firmada, carga centrada y reintento. Comprobación local del 9 octubre: Chrome temporal + React StrictMode, 20 clics repetidos, 10 reaperturas y 3 cambios sin errores; red Google ficticia, sin datos reales ni solicitudes a producción.

## Formulario público

El marco de /q/[token] usa un único ancho máximo local de 896 px, también en carga,
error y confirmación. Cuatro campos iniciales en dos columnas desde sm, una columna
móvil, descripción de cinco filas ampliable. Encabezado compacto de 20 px alineado al contenido.
Adjuntar usa Button secondary, icono, hover/foco, mínimo 44 px y contador anunciado;
el input oculto abre el selector. Acción y contador comparten una fila, sin un panel
vacío. La lista aparece al seleccionar y crece hasta dos filas (104 px); el resto
hace scroll accesible. Nombres recortados conservan el valor completo en title y
en la acción de quitar. Añadir archivos después de las dos primeras filas no la estira.

La tarjeta conserva altura natural hasta 100dvh − 48 px. En pantallas bajas solo
los campos hacen scroll; el pie shrink-0 conserva espacio propio y no se superpone
a descripción/adjuntos. Sustituye el pie sticky anterior. El contador es texto visible
y anunciado; no se reserva altura de estado para un error vacío. La verificación
del 14 octubre tiene 124 comprobaciones en cuatro tamaños y reducción de altura:
geometría estable con diez archivos, teclado, error, reintento y finalización con
página/hook/cliente reales y API sintética. [Contrato y evidencia](../formulario-publico-visual-2026-10-14.md).
Este ajuste no cambia cuotas, validaciones, BotID ni el contrato del gateway.

Envío público: el mismo form conserva campos, folio, progreso y reintentos durante la subida. Estados Pendiente/Subiendo/Adjuntado/No adjuntado por archivo; reintento usa el mismo envío. La confirmación publicada el 19 octubre usa encabezado compacto, folio y próximo paso en dos columnas desde sm, una columna móvil; evidencia se informa una sola vez. Distingue registro confirmado, espera del correo y disponibilidad del enlace. Aparece únicamente con todos los archivos adjuntados, finalización confirmada y operación terminada. Un archivo fallido o una finalización pendiente conserva el formulario para reintentar. Reintentar solo el enlace mantiene la tarjeta confirmada. No abre otra pestaña ni añade esperas visuales.

El recibo local del 20 octubre sustituye esa distribución por la jerarquía del
correo: cabecera blanca de marca, folio azul en línea, cuerpo de una columna y
pie discreto, sin check circular ni recuadro interior. Conserva ancho y contrato
de finalización/seguimiento. Sigue sin publicar; ver
[formulario y evidencia visual](../formulario-publico-visual-2026-10-14.md).

Seguimiento: el enlace privado abre la consulta automáticamente. Sin él se muestran
instrucciones y una opción secundaria para pegar el enlace completo, sin contraseña
ni consecutivo manual. Mientras la configuración esté apagada/incompleta se informa
que la consulta en línea no está habilitada. Verificación local del 16 octubre:
74 comprobaciones en 1440/1280/375/320 px; no activa servicios remotos.

Quejas (13 octubre): Modal variant=workspace abre a la derecha, 40vw y 100dvh; escritorio
no es modal y deja la tabla operativa. Solo se recorta la ventana de la tabla, sin cambiar
columnas ni filtros. Móvil y ampliado conservan modalidad nativa. Al cerrar/reabrir vuelve
al lateral. Ciclo/estado/acción son sticky; no hay footer de lectura. Actividad conserva
sheet de 420 px. El encabezado del workspace identifica **Folio** y consecutivo con
peso semibold; sus iconos miden 20 px y Actividad usa texto azul sin fondo resaltado. La variante
se limita al workspace sin agrandar los otros diálogos. Decisiones/revisión usan document XL (1040 px, 90dvh fijos), encabezado
blanco, elección azul/roja inicial centrada que cede el espacio al editor; decisión
en gris arriba a la derecha y guardado en el footer. Tres columnas desde
1100 px útiles al ampliar. Quejas y Mis Quejas comparten CaseWorkspace, con ancho
máximo de 1440 px y el mismo margen, fondo y laterales discretos. El centro es la única hoja de la lectura (superficie
blanca con borde y sombra, secciones con líneas finas); las barras laterales de
ciclo y acción no llevan tarjeta propia. El scrollport del expediente se promueve a
capa compuesta (`will-change: transform`) con fondo opaco, queda excluido de las reglas
`::-webkit-scrollbar` y usa la barra nativa `solid-color` de ancho normal y gutter
estable, que Chromium actualiza en el
compositor; los laterales sticky llevan capa propia para que su offset no dependa del
hilo principal. Al ampliar a todo el ancho el diálogo no compone un velo sobre su fondo
opaco. [Contrato actual](../quejas-panel-2026-10-13.md).
La revisión local del 3 noviembre deja margen inferior del mismo fondo del lienzo
solo sin ampliar (12px en móvil, 16px desde sm), con un marco de 1px y las mismas
esquinas redondeadas arriba y abajo. El marco contiene el scrollport, sin montar
otro editor al alternar de modo;
los scrolls interiores de los modales usan 16px y puntas cuadradas, conservando
la excepción nativa del scrollport principal. El resumen superior de resultado se
retiró por petición del propietario: la lectura general comienza con Descripción,
sin etiqueta Cliente encima. En Pendiente de Revisión GC se prioriza la propuesta
y Solicitud y antecedentes queda desplegable; el ciclo va en horizontal. Mis Quejas
también usa ciclo horizontal en Resolución, con barra de formato justo bajo las
pestañas y Asistencia como acción secundaria. [Contrato de revisión](../quejas-resolucion-y-revision-gc-2026-11-03.md).
Mis Quejas conserva solo Análisis y
Resolución, con un editor de propuesta. [Detalle y límites](../quejas-claridad-y-acuse-2026-11-03.md).
RichTextEditor carga Tiptap lazy con toolbar accesible, listas dentro del padding y
240 px mínimos. RichTextContent muestra plain literal y markdown con subconjunto
seguro sin HTML/enlaces/imágenes. CaseRequestHeader conserva el mini desplegable
nativo **Datos de la solicitud** debajo del encabezado del folio y fuera del lienzo,
en ambas vistas. Cerrado muestra persona/tipo; al abrir ofrece correo, teléfono,
recepción y tipo, con etiquetas y scroll de hasta 45dvh. Su apertura se reinicia solo
al cambiar de expediente, sin remontar el documento. No existe una ranura de datos
en el encabezado de Modal; se recupera la geometría lateral con su altura completa.
La variante intermedia con datos inline fue descartada y su QA no certifica esta
composición. La restauración conserva su evidencia fechada en
`.performance/case-dropdown-20261019/`; no certifica el ajuste posterior de áreas.

Ajuste local del 5 de noviembre: en el modal de gestión de Quejas los datos de la
solicitud pasan al lateral izquierdo como panel estático (`data-case-request`) y el avance
del proceso a la línea horizontal superior (`data-case-top-cycle`) con la línea de progreso
en el token azul del estado activo (`bg-qms-primary`). La disposición del staff no depende
del modo expandido. El catálogo de áreas sale del expediente ampliado y se administra desde
Configuración. Detalle: [panel y procesamiento](../quejas-panel-2026-10-13.md).

El layout de tres columnas amplía la columna de solicitud a 280 px para que los datos del
solicitante tengan espacio suficiente sin romper los textos, reduce el padding izquierdo
del contenedor para empujar esa caja hacia el borde sin aplastar la columna central, y
restaura la columna central (Descripción) a su tamaño anterior.

- `AreaQuejaControl` edita el área junto a Descripción con una lista de opciones
directamente seleccionables en un solo popup, sin Select anidado ni Guardar selección.
Elegir guarda el snapshot capturado de revisión/oficio/observación; elegir la misma
área cancela sin escribir. Mis Quejas la presenta solo para lectura. Las opciones
no se habilitan durante carga, fallo o guardado; el área histórica se conserva aunque
ya no esté activa. La gestión del catálogo vive en Configuración (módulo `quejas`,
tipo `area_afectada`); el expediente solo conserva el control de asignación.
`AreaQuejaCatalogo` es compacto (448 px máximos), sin tarjeta gris; AreaCatalogoPicker
despliega las áreas con tres puntos al final de cada fila. Editar/Eliminar o Restaurar
aparecen solo al abrir sus acciones, sobre el snapshot de esa fila aunque otra esté
seleccionada. El popup usa top layer y scroll local; Escape cierra primero acciones
y luego lista, devolviendo foco sin cerrar el expediente. Añadir para
admin/Calidad reales; Editar, Eliminar y Restaurar solo para admin real. Eliminar
requiere confirmación y desactiva la opción; Restaurar la reactiva, sin DELETE ni
reescritura de expedientes históricos. Seleccionar en este catálogo no asigna la
queja. El servicio
quejaAreaCatalogService actualiza una propiedad por operación y compara el snapshot
de valor/activo, con RLS vigente; un conflicto no se reintenta con valores nuevos.
Administrar el catálogo no asigna el área de la queja. Oficio se escribe en su etapa de
decisión/resolución; Observaciones unifica el compositor superior y seguimiento de
Actividad, conservando el texto histórico. RegistroQuejaGC es una utilidad histórica
sin montaje actual; no atribuirle la lectura activa de Mis Quejas. Límite editor 10.000.

Refinamiento local del 19 octubre, posterior al despliegue: el ciclo visible se adapta
al trabajo. Calidad muestra evaluación/revisión/cierre y espera al responsable durante
investigación; Mis Quejas muestra asignación/investigación/propuesta enviada. Deriva del
estado vigente, no inventa aprobaciones ni cambia IDs, permisos o plazos. Las pestañas
del responsable y Tiptap pertenecen a la misma hoja, sin tarjetas anidadas. Este ajuste
visual no se ha publicado en Vercel.

El refinamiento posterior de Folio/Actividad y selección/gestión de áreas del
19 octubre también sigue local. QA prevista en `.performance/case-areas-20261019/`,
pendiente de verificación; los resultados anteriores mantienen fecha y alcance.

La referencia nueva del 12 octubre sustituye la restauración del 10: sin pestañas,
lectura de solicitud separada de Actividad; editor en diálogo de decisión.
Ver [contrato y evidencia](../quejas-panel-y-correo-2026-10-12.md). Escape desde un
contenteditable cierra solo su diálogo salvo en la decisión de procedencia, que exige
X; Cancelar vuelve a elegir sin perder borrador. Los selects conservan su manejo nativo.
