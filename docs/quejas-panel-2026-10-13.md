# Quejas: lectura y procesamiento del expediente

## Limpieza compartida de lectura — 10 noviembre

Quejas y Mis Quejas conservan una selección discreta de fila mediante
`ui-case-row` y `aria-selected`, independiente del puntero y de la marca de lectura.
Por preferencia posterior del propietario, la fila usa
`qms-row-selected`: #F0F4F7,
sin el contorno de la revisión intermedia ni cambio de alto.
Cerrar el panel elimina la selección. Ambas tablas admiten Enter/Espacio sin
interceptar el teclado de controles internos.

El contacto conserva nombre, correo, teléfono, fecha y tipo; se retira el rótulo
redundante «Datos de la solicitud». Por corrección posterior, el contacto se muestra
únicamente al ampliar: el modal contraído pasa de las acciones a Descripción, sin
desplegable de cliente ni espacio reservado. Su región permanece montada y oculta
para conservar los nodos y borradores del documento al ampliar/reducir.
El responsable aparece antes de las acciones de Calidad. Área afectada
vuelve al extremo derecho del encabezado Descripción en ambos tamaños; el control
de gestión conserva revisión/permisos y Mis Quejas solo consulta el valor.
`components/quejas/AreaAfectada.tsx` comparte esa presentación sin cargar el catálogo
en la consulta del responsable. `ListaAdjuntos` comparte tarjetas de superficie
suave, sin marco ni separador interior, con iconos estáticos y acciones accesibles;
listar sigue sin descargar miniaturas ni archivos.

Verificación de la revisión inicial: 104/104 pruebas focalizadas y 993 comprobaciones sintéticas adicionales en ambos módulos,
seis estados y cinco anchos (1920/1536/1200/390/320 px), incluidos selección sin
hover, geometría, lectura de área, adjuntos y borrador/asistencia de Resolución.
La batería anterior de referencia conserva 287 comprobaciones correctas. Sin
escrituras de negocio ni correos; evidencia en `.performance/quejas-visual-20261110/`.
TypeScript, lint, build, estructura y capa visual correctos. Web sin publicar.

Revisión intermedia de contacto/contorno: 47/47 pruebas focalizadas, TypeScript y
lint del panel correctos; 18 escenarios sintéticos sobre ambos módulos, tres estados
y anchos 1536/390/320 px. Comprueba ausencia del contacto al contraer, conservación
al ampliar, borde sin relleno ni cambio de alto, limpieza al cerrar y borrador de
Resolución al ampliar/reducir. Evidencia en `.performance/quejas-border-20261110/`.
Sin publicación web ni escrituras de negocio.

Revisión previa según la guía de colores ECA: fondo gris muy claro, sin contorno.
29 comprobaciones sintéticas en Quejas y Mis Quejas a 1536/390 px verifican el color
RGB efectivo (240, 239, 239), ausencia del marco, cierre y contacto contraído;
compilación de CSS y capa visual correctas. Evidencia en
`.performance/quejas-gray-20261110/`. Cambio local, sin publicar.

En la revisión previa, las etiquetas de estado adoptaban ese mismo gris ECA mediante la variante compartida
`neutral` de `badges.ts` y el token `qms-neutral-soft`. Incluye listas, paneles,
seguimiento público y otros módulos; texto oscuro y colores de plazo conservados.
13/13 pruebas focalizadas y nueve muestras del Badge real en navegador verifican
seis estados grises y plazos verde/ámbar/rojo; CSS compilado y lint correctos.
Evidencia en `.performance/estado-gris-20261110/`; web local sin publicar.

### Estados con sus colores y plazo con semáforo

Por petición posterior del propietario, Quejas y Mis Quejas recuperan los fondos
de estado que ya existían: `estado_color` de cada registro tiene prioridad sobre
el mapa histórico de `estados.ts`. Se conserva la paleta original de Badge, con
texto blanco u oscuro según su contraste. No se copian colores de la imagen de
referencia ni se modifican códigos, nombres, catálogos o datos persistidos.

`QuejaPlazoIndicator` sustituye el badge de plazo en ambas tablas y paneles por
punto y texto: verde vigente, ámbar en alerta y rojo vencido. Completado/sin plazo
son grises. Reutiliza `getQuejaDeadline`/`caseDeadline`; no recalcula fechas ni
reinicia plazos. Mis Quejas muestra Plazo con su fecha original en el título.
El seguimiento público y los demás módulos conservan su presentación propia.
Verificación: 65/65 pruebas focalizadas, TypeScript, lint, build, estructura y capa
visual correctos. 379 comprobaciones de navegador en 36 escenarios (ambos módulos,
seis estados, 1536/390/320 px) verifican prioridad del color del catálogo, puntos
de plazo sin fondo y geometría contraída/ampliada. Datos ficticios, sin escrituras
ni correos; evidencia en `.performance/estados-semaforo-20261110/`.
Cambios locales, sin publicar.

El visor Google sigue abriendo inmediatamente su iframe. Una prueba aislada con
un PDF público confirmó que su scrollport pinta el pulgar negro al 50 % y no cambia
con `color-scheme: normal/light/dark` en el iframe. Su CSS pertenece a Google;
ninguna regla del padre puede sustituir esos colores internos. No se añadió una
barra decorativa, filtro sobre el documento ni reemplazo del lector sin resolver
la preferencia del propietario. Contraste persistente del visor: pendiente.

## Respuesta al cliente — 10 noviembre

El documento se elige/sube/visualiza arriba. Debajo se edita el correo de
acompañamiento personalizado (asunto y mensaje), separado de la resolución y del
informe. Generar expediente y el atajo Editar informe abren el mismo editor; volver
conserva el correo y el documento seleccionado. Oficio nuevo precarga el folio,
asunto nuevo usa guion y la plantilla incluye `gc@eca.or.cr`. No Procede comparte
la ventana directamente en el correo, sin pestañas ni modal posterior de justificación.
Publicar respuesta es la acción final. Los fundamentos van en el informe; el registro
conserva el motivo previo o la comunicación que remite al adjunto. Guardado y publicación
congelan el correo autorizado; [contrato y activación](quejas-revision-y-respuesta-2026-11-04.md).
Interfaz local, DB y emisor actualizados; sin publicación web.

La fecha persistida de cierre se muestra bajo el estado en Quejas y Mis Quejas,
en ambos tamaños. Calidad ve además el estado del correo final y su hora de envío;
la consulta se actualiza solo mientras esté pendiente, sin reenviar. Detalle y
diagnóstico en el mismo contrato del 10 noviembre.

Mis Quejas contraído comparte el marco, separadores y avance segmentado de Quejas.
Ambas vistas usan el mismo ciclo del expediente: etapa actual y segmentos al contraer,
recorrido horizontal al ampliar, incluido Cierre al finalizar. Ampliar no remonta el editor. En Resolución,
Enviar a Revisión GC pasa debajo de Volver al análisis en las acciones, liberando
el pie del editor. QA sintética a 1536/390/320 px y límites de activación en el contrato.

Unificación del ciclo del 10 noviembre: ambos paneles usan `CaseCycle process`
y `currentOnly` en el encabezado contraído. Se verificó el mismo texto, segmentos y
colores en seis estados, sin checks en el contraído; Finalizado muestra Cierre,
paso 4 de 4. Recorrido horizontal ampliado conservado. 17/17 pruebas de panel y
22 comprobaciones sintéticas de navegador, sin escrituras reales; lint focalizado
correcto. Interfaz local, sin publicar.

## Dos disposiciones de Quejas — ajuste local del 9 noviembre

Sobre la base restaurada por el propietario, `QuejaDetalleModal` adopta únicamente
las dos disposiciones de sus referencias:

- Contraído: paso actual con segmentos de avance; dentro del marco desplazable,
  Siguiente paso, Datos de la solicitud plegados y documento, en ese orden.
- Ampliado: ciclo horizontal completo y, desde 1100 px útiles, solicitud a la
  izquierda, documento sin límite adicional de ancho y acciones a la derecha.
  Con menos espacio las secciones se apilan sin desbordar el diálogo.
- Estado usa una etiqueta neutra y vencimiento conserva su badge de color. Durante investigación,
  Calidad espera la propuesta y dispone del acceso a Derivar a SACP. El área
  afectada acompaña los datos de la solicitud; mantiene sus handlers y revisión.

La variante se activa solo en Quejas. Mis Quejas conserva la composición anterior;
filtros, respuesta al cliente, persistencia y transiciones no se modifican. Ampliar
o reducir mantiene una sola instancia del documento y sus borradores. No Procede
proyecta evaluación y cierre, sin atribuir investigación o revisión inexistentes.

Verificación local: **37/37** pruebas focalizadas; **287** comprobaciones sintéticas
de navegador sobre los seis estados en anchos CSS 1536, 1200, 390 y 320 px, con
componentes y CSS reales, datos ficticios y sin escrituras de negocio ni correos.
Evidencia en `.performance/panel-reference-20261109/`. Este ajuste no está publicado.

Refinamiento de alineación: en Quejas y Mis Quejas, el texto del primer paso de la
barra superior se alinea con Descripción en escritorio, dejando el círculo en el
margen izquierdo del documento. Los pasos ocupan la columna central.
La barra replica las columnas del documento y reserva el espacio del scrollbar;
cuando los pasos no caben, se desplazan dentro de esa columna. Verificación:
**51/51** pruebas focalizadas y diez escenarios de navegador entre ambos módulos,
en anchos CSS 1536, 1920, 1200, 390 y 320 px, sin desborde del diálogo.

Las etiquetas de estado usan un gris azulado suave (`Badge neutral`, tokens
`qms-primary-soft` y `qms-dark`) en Quejas y Mis Quejas: listas, modales,
comunicaciones y seguimiento público. La misma receta se aplica en Dashboard,
SACP, Documentos, Auditorías, Revisión, Procesos, Usuarios, Configuración y la
vista previa del informe. Plazos y alertas conservan sus colores semánticos;
los códigos, etiquetas y colores guardados del catálogo no se cambian.
Verificado con **57/57** pruebas focalizadas, TypeScript, lint, build, estructura
y capa visual; QA sintética de **36** etiquetas en listas y modales de ambos
módulos, cubriendo los seis estados sin escrituras de negocio. Sigue local.

## Revisión local del 3 noviembre

El expediente comienza con Descripción; el resumen superior de resultado público
se retiró por petición del propietario. Solo sin ampliar deja un margen inferior
del mismo fondo del lienzo, sin franja blanca. Mis Quejas reúne el contexto en
Análisis y conserva un solo editor en Resolución; IA queda como ayuda opcional.
Detalle y límites: [claridad y acuse por evento](quejas-claridad-y-acuse-2026-11-03.md).
Esta revisión sustituye la composición de tres pestañas descrita históricamente
más abajo y permanece local, sin publicar.

Refinamiento posterior: [Resolución y revisión GC](quejas-resolucion-y-revision-gc-2026-11-03.md).
Resolución sitúa el editor bajo las pestañas. GC comienza con la propuesta y pliega
los antecedentes; ambas vistas usan ciclo horizontal en ese contexto, manteniendo
el resto del expediente y su workflow.

## Lienzo compartido — refinamiento local del 19 octubre

Este ajuste posterior al despliegue de seguimiento permanece **local**, sin publicar
Vercel, migrar DB ni ampliar permisos o transiciones. Refina la composición de ambas
vistas y separa la selección del área de la administración de su catálogo.

- `CaseWorkspace` comparte la hoja central blanca, márgenes y laterales discretos.
  Ancho máximo 1440 px; tres columnas desde 1100 px de espacio útil. Conserva el
  lateral 40vw/100dvh y la tabla disponible; móvil/ampliado conservan modalidad nativa.
- `CaseRequestHeader` vuelve al mini desplegable nativo **Datos de la solicitud**
  debajo del encabezado del folio, fuera de la hoja central, en Quejas y Mis Quejas.
  Cerrado conserva persona y tipo; al abrir muestra correo, teléfono, recepción y
  tipo con sus etiquetas. Su detalle tiene scroll acotado a 45dvh e incorpora una
  ranura para el catálogo; no añade una tarjeta de datos al documento.
  La apertura se reinicia al cambiar de expediente, sin desmontar el editor.
  Se recuperan la altura y los márgenes del lateral; el lienzo compartido conserva
  Descripción y el área en una misma fila cuando caben, adaptándose al ancho.
  Calidad selecciona el área directamente; el responsable solo consulta el área.
- El encabezado principal muestra **Folio** y el consecutivo con peso semibold,
  iconos de 20 px y **Actividad** con texto azul, sin fondo resaltado. Estos ajustes de `Modal`
  se limitan a `variant="workspace"`; no cambian la altura ni los encabezados de
  decisión, visor u otros diálogos. Se conservan nombres accesibles, navegación,
  ampliación y cierre; el título completo sigue disponible si se recorta.
- `AreaQuejaControl` abre directamente una lista de botones en un único popup,
  sin `Select` anidado ni botón Guardar selección. Elegir guarda el área con el
  snapshot de revisión/oficio/observación que abrió la edición; elegir la misma
  área solo cierra. Una opción histórica sigue visible aunque ya no esté activa
  en el catálogo. Carga, error o guardado no ofrecen opciones habilitadas.
- `AreaQuejaCatalogo` se abre dentro de Datos de la solicitud, separado del área
  del documento. Refinamiento local del 20 octubre: ancho máximo 448 px, sin tarjeta
  gris; `AreaCatalogoPicker` muestra «Área del catálogo» como un desplegable compacto.
  Cada fila tiene tres puntos al final; Editar/Eliminar o Restaurar aparecen únicamente
  al abrir sus acciones. Operan sobre el snapshot de esa fila, sin exigir elegirla
  antes ni usar la selección de otra. Elegir aquí nunca asigna el expediente.
  Admin y Calidad reales pueden añadir; Editar, Eliminar y Restaurar se reservan al admin real.
  Eliminar pide confirmación y cambia `activo=false`; Restaurar usa `activo=true`.
  No existe DELETE ni se renombra el texto
  histórico de los expedientes. Cambiar el catálogo no asigna una opción al caso.
- `getCaseRoleCycle` proyecta el estado sin crear IDs ni aprobaciones: Calidad ve
  evaluación, revisión y cierre; el responsable, asignación, investigación y propuesta
  enviada. Durante investigación Calidad espera al responsable. No Procede omite
  investigación y revisión; desconocidos no aparentan progreso. El historial real
  sigue en Actividad.
- Mis Quejas incorpora sus pestañas, análisis y resolución a la misma hoja, con
  secciones separadas por líneas y Tiptap amplio, sin tarjetas anidadas. El estado y
  plazo compactos quedan fuera del scroll. Las pestañas permanecen accesibles al
  desplazar; cambiar de documento comienza arriba sin desmontar editores ni borrar
  borradores. `documentKey` solo controla esta posición de lectura.
- Los adjuntos conservan `layout="cards"`, con tarjetas de hasta 224 px, iconos
  estáticos de 32 px y acciones visibles para teclado/táctil. No se descargan
  miniaturas; preview, descarga y eliminación conservan sus contratos y permisos.

Fuentes compartidas: `app/quejas/components/QuejaExpedientePanels.tsx` y
`quejaExpedienteModel.ts`; consumidores `QuejaDetalleModal.tsx` y
`app/mis-quejas/components/QuejaColaboradorPanel.tsx`. Los handlers conservan revisión
capturada, bloqueo de navegación, guards por visita, errores y propuesta separada
de la comunicación pública. La suite focalizada verificó **104/104**, la completa
**731/731**; TypeScript, lint acotado, build, estructura y capa visual correctos. Sus visitantes
JSX recorren las nuevas ranuras de presentación sin cambiar sus aserciones.

QA del lienzo mediante CUA: componentes, Tiptap, fuente y CSS reales con datos ficticios y
conexiones externas bloqueadas. Escritorio 1280×720 y viewport CSS de 390/320×844
en iframe local (no emulación de dispositivo). Evidencia y capturas en
`.performance/case-canvas-20261019/` (14 escenarios registrados); no certificar con ello producción ni servicios
de correo/Drive. Se comprobaron datos desplegables, selector de área, decisión de
tamaño fijo/Cancelar, reapertura lateral, edición, transferencia a propuesta,
conflicto sintético, pestañas fijas y borradores conservados.

La revisión intermedia del encabezado/adjuntos conservó **75/75** pruebas focalizadas
y TypeScript/lint correctos. Su QA en `.performance/case-header-20261019/` verificó
datos directamente en el primer encabezado; esa composición fue descartada después
por el propietario y no representa el contrato visual vigente.

La restauración del mini desplegable conserva **75/75** pruebas focalizadas;
TypeScript, lint acotado, build, estructura y capa visual correctos. QA de componentes
reales con datos ficticios en `.performance/case-dropdown-20261019/`: lateral de
512 px sin recomponer la tabla, ampliado sin desborde horizontal, desplegable por
clic/teclado, laterales fijos al desplazar, cierre/reapertura lateral y borrador de
Mis Quejas conservado al ampliar/reducir y consultar los datos. Viewports CSS
320×844 para Quejas y 390×844 para Mis Quejas en iframe local, sin emulación de
dispositivo. Las capturas del encabezado intermedio no sustituyen esta evidencia.
No se publicó este ajuste en Vercel.

El refinamiento posterior de encabezado y catálogo pasó **103/103** pruebas
focalizadas, TypeScript, lint acotado, build, estructura y capa visual. Evidencia
en `.performance/case-areas-20261019/`: componentes/CSS reales, datos ficticios y
persistencia simulada, sin conexiones externas. QA de Folio/iconos/Actividad,
selección directa que actualiza el área, alta/renombre/desactivación/reactivación
del catálogo sin reasignar la queja, y controles a 320×844 en Quejas/Mis Quejas
(viewport CSS en iframe, sin emulación de dispositivo). Las suites incluyen conflicto
de snapshot, RLS rechazada, doble envío y respuestas de otra visita/ámbito. No se
ejecutaron escrituras de prueba remotas ni se publicó en Vercel.

La iteración compacta anterior del 20 octubre limitó el catálogo a 448 px, filas de unos
40 px y acciones de 32 px de alto. Dos áreas ocupan unos 130 px; el formulario se
coloca en la misma fila desde 400 px útiles y se adapta debajo en móvil. Sin cambios
de handlers, consultas, permisos o guardados. Pruebas de catálogo/servicio **24/24**,
lint acotado, build con TypeScript y capa visual correctos. QA de componentes reales
con datos ficticios en `.performance/case-areas-compact-20261020/`: ampliado, lateral,
edición/Cancelar y viewport CSS 320×844 en iframe, sin emulación de dispositivo.
No se publicó en Vercel.

Iteración intermedia del 20 octubre (sustituida por el menú por fila): las filas del catálogo se sustituyeron por un
Select etiquetado «Área del catálogo». Renombrar/Eliminar actúan únicamente sobre
la opción elegida; Eliminar confirma antes de guardar `activo=false`, y Restaurar
usa `activo=true`. Elegir una opción no escribe ni asigna el expediente; una visita
nueva reinicia la selección. Refrescar el catálogo durante la edición no cambia
el snapshot capturado del nombre/estado. Catálogo y servicio **28/28**, TypeScript,
lint acotado y build correctos. QA local con componentes reales y datos ficticios
en `.performance/case-areas-dropdown-20261020/`: selección, confirmación, eliminación
reversible y disposición de controles en escritorio y viewport CSS 320×844 en
iframe, sin emulación de dispositivo. Sin escrituras remotas ni publicación.

Refinamiento vigente del 20 octubre: `AreaCatalogoPicker` mantiene la lista compacta
y coloca tres puntos al final de cada fila. Editar/Eliminar o Restaurar se muestran
solo para esa fila; no quedan botones de administración permanentes. Captura el
snapshot al abrir las acciones, sin usar el área seleccionada ni adoptar un refresco
para forzar la escritura. El popup usa top layer, altura acotada y desplazamiento
local para mantener visibles selección, foco y menú. Escape cierra acciones y luego
lista; Tab fuera de las acciones las cierra sin sacar el foco de la siguiente fila.
Se conservan permisos, confirmación y eliminación reversible. **81/81** pruebas
focalizadas de catálogo, servicio, selección, expediente y Mis Quejas; TypeScript,
lint, build, estructura y capa visual correctos. QA con componentes/CSS reales,
datos ficticios y persistencia simulada: lateral, ampliado, edición, eliminación,
restauración, Escape y viewport CSS 320×844 en iframe, sin emulación de dispositivo.
Capturas en `.performance/case-areas-ellipsis-20261020/`. Sin escrituras remotas ni
publicación en Vercel.

## Evidencia de las revisiones anteriores

Revisión local: **13 octubre 2026**. Sustituye la geometría del panel del 12 octubre.
Esta entrega no publica el frontend en Vercel ni cambia permisos, DB o correo activo.

## Panel y tabla

`QuejaDetalleModal` usa `Modal variant="workspace"`: en escritorio es un diálogo
nativo no modal, fijo a la derecha, de **40vw y 100dvh**. No oscurece ni vuelve inerte
la tabla. Móvil y modo ampliado usan modalidad nativa y mantienen foco/scroll lock.
Cerrar y abrir otra visita restablece la vista lateral; anterior/siguiente conservan
la ampliación solo dentro de la misma visita abierta.

El buscador y filtros conservan su ancho/distribución. Solo se recorta la ventana de
la tabla; el ancho original de sus columnas se conserva mediante su mínimo relativo.
El scroll horizontal permite alcanzar las columnas bajo el panel, y el vertical
recorre la página de 25 filas. La tabla sigue disponible para seleccionar registros;
una edición, comentario pendiente o subida bloquea cambiar de caso hasta terminarla
o cancelarla. Se mantienen los guards de visita, revisión y ámbito del QueryClient.

No hay footer en la lectura del expediente. En el panel compacto, estado, plazo y
acción permanecen arriba junto al ciclo; en la vista amplia, ciclo y estado/acción
son columnas sticky. El centro tiene el mayor ancho y usa scroll propio. El ciclo
marca en verde las etapas anteriores según el estado actual; no fabrica fechas ni
aprobaciones. No Procede omite investigación/revisión/resolución. Actividad conserva
el historial real, comentarios y estados de comunicación, cargados solo al abrirla.

En la vista amplia con solicitud en lateral, el ciclo pasa a la línea horizontal
superior y los datos de la solicitud ocupan el lateral izquierdo; el estado, plazo,
responsable y acción permanecen a la derecha. El catálogo de áreas ya no se monta en
el expediente ampliado de gestión. Ver
[expediente del modal de gestión: solicitud a la izquierda y avance en la línea superior](quejas-panel-2026-10-13.md#expediente-del-modal-de-gestión-solicitud-a-la-izquierda-y-avance-en-la-línea-superior-5-de-noviembre).

Los adjuntos usan `ListaAdjuntos layout="cards"`, con iconos estáticos de formato,
nombre completo accesible, tamaño y acciones originales. No descargan miniaturas,
consultan Drive ni montan visores al listar. Mis Quejas conserva su lista por defecto.

## Superficie de lectura (16 octubre)

Jerarquía visual del workspace: el centro es la única hoja. Una superficie blanca
con borde y sombra agrupa las secciones separadas por líneas finas
(`CaseSection variant="document"`), y las barras laterales de ciclo y acción se
muestran sin tarjeta propia (`variant="plain"`), solo etiqueta y contenido sobre el
lienzo. Así la lectura tiene un único punto de énfasis en lugar de tres cajas
equivalentes. Las secciones del centro comparten el mismo tratamiento, sin énfasis
especial ni nuevos tokens. No cambia geometría, permisos, workflow ni los contratos
probados.

## Documento de decisión

`Modal variant="document"` tiene encabezado blanco, ancho XL y altura fija de 90dvh
desde la primera apertura. Elegir Procede/No Procede no cambia sus dimensiones.
La elección inicial se centra en el lienzo: Procede azul y No Procede rojo, en dos
columnas iguales. Al elegir desaparece y se muestra el editor; una leyenda gris en
la esquina superior derecha indica la decisión. La leyenda permite volver a elegir
sin perder texto ni revisión. Cancelar/Guardar aparecen al pie tras elegir; Cancelar
vuelve a los botones Procede/No Procede sin cerrar ni perder el borrador. La X cierra
la decisión; Escape/fondo se consumen sin cerrarla. Antes de elegir no se puede
guardar ni redactar. La instancia oculta conserva carga, borrador e historial.

`RichTextEditor layout="fill"` conserva toolbar y ayuda, desplazando únicamente el
documento. El lienzo de desplazamiento queda con `overscroll-contain` y capa compuesta
(`will-change: transform`), igual que el scrollport del expediente, para que el editor
de decisión/resolución no anide un scrollbar personalizado ni sienta el scroll lento.
Al elegir, enfoca el editor cuando está listo, sin temporizadores. El
control de estilo usa `Select` canónico; botones y flecha se alinean.
Placeholder y primer párrafo comparten padding y márgenes. La versión instalada de
Tiptap inicia su selector con editor nulo; el estado inicial usa el editor real hasta
la primera transacción, sin marcar el borrador como modificado por montar/sincronizar.
El responsable de «Procede» vive en un selector discreto del encabezado (100 px en
móvil, 150 px desde sm); no ocupa una franja debajo del documento. El nombre completo
queda accesible aunque la etiqueta visual se recorte. El selector busca por nombre y
correo sin distinguir mayúsculas/tildes, sobre los usuarios activos/asignables ya
cargados; escribir no hace nuevas consultas. El popover permanece en el DOM del
diálogo y usa top layer para evitar recortes; lista acotada con scroll. Flechas/Enter
seleccionan; Escape/Tab cierran solo el desplegable.

Guardar «Procede» sin responsable muestra error y abre/enfoca el buscador antes de
cualquier escritura. La selección se comprueba contra la lista elegible vigente,
sin dar por válida una copia anterior del usuario. El error se limpia al seleccionar
y no reabre el desplegable al volver a elegir decisión. El oficio de «No Procede» y
de resolución sigue siendo obligatorio en su región inferior; no cambió su contrato.

Un cambio de viewport no promociona el workspace encima de un editor/visor abierto.
El observer de diálogos sincroniza el modo después del cierre/retirada del superior.
Solo los modales bloquean el scroll; los locks anidados se liberan al cerrar el último.
Escape desde Tiptap cierra únicamente su diálogo salvo en la decisión, que exige X.
Cerrar el editor conserva el
borrador/revisión de ese expediente; guardar limpia solo una escritura confirmada.
Devolver a investigación usa también la revisión capturada, sin adoptar una más nueva.

## Diario de correo

El estado operativo vive en `queja_mail_outbox` de Supabase. La hoja privada de Apps
Script es un diario mínimo de deduplicación del emisor, sin destinatarios ni contenido:
UUID, hash, estado y fechas. Evita reenvío si MailApp aceptó el correo pero se perdió
la confirmación a DB. No es una segunda tabla de Quejas ni se consulta al abrir el panel.
Conservarla mientras se use este protocolo; retirarla requiere sustituir su garantía
en el emisor. Detalle: [correo directo](correo-quejas-directo-2026-10-13.md).

## Campos graduales y observaciones

Datos de la solicitud conserva sus nombres y datos automáticos en el mini
desplegable bajo el folio. El área afectada acompaña Descripción, con etiqueta
permanente **Área afectada** y texto vacío **Seleccionar área afectada**. En el
contrato local del 19 octubre, abrirla muestra directamente las opciones: elegir
guarda sin otro desplegable ni confirmación adicional; elegir el valor actual
cierra sin escribir. La revisión se captura antes de abrir y el guardado conserva
oficio/observación históricos porque el RPC actualiza los tres campos. Conflictos
no adoptan otra revisión para forzar el reintento. Solo se puede editar mientras
el expediente está en **Recibido**; al pasar a otro estado, el área queda de solo
lectura y cualquier borrador abierto se descarta. Mis Quejas mantiene el área de
solo lectura, sin conceder al responsable funciones de catálogo.

La gestión del catálogo de áreas vive en Configuración (módulo `quejas`, tipo
`area_afectada`, vía `quejaAreaCatalogService`); el expediente solo conserva el control
de asignación junto a Descripción (`AreaQuejaControl`), que guarda el snapshot de la
queja sin tocar el catálogo. **Añadir** incorpora una opción reutilizable sin asignarla al expediente;
admin y Calidad reales conservan esta operación. Solo el admin real ve los tres
puntos por fila y ejecuta Editar, Eliminar o Restaurar desde ese menú. Abrir sus
acciones no selecciona ni asigna el área, y guarda el snapshot capturado de esa fila.
Eliminar de la lista exige confirmación, conserva los expedientes anteriores y
permite restaurar; no hay borrado físico. Las áreas retiradas se identifican como
«eliminada» en el selector de administración. Una opción
histórica o renombrada no reescribe el área que ya guardó una queja.

`lib/services/quejaAreaCatalogService.ts` concentra `actualizarAreaCatalogo`: limita
la escritura a `valor` o `activo`, una propiedad por operación, y compara el snapshot
de `id`/módulo/tipo/valor/activo. La ausencia de la fila esperada produce conflicto,
sin releer valores para forzar la escritura. Es una comparación optimista parcial,
no una nueva revisión versionada ni una migración de permisos; RLS sigue autorizando
los accesos a la DB. Conserva el resto de los atributos del catálogo.

Los guards de visita/ámbito evitan que respuestas tardías editen otro borrador. Una
escritura confirmada cancela lecturas anteriores antes de actualizar e invalidar
las claves compartidas; no sustituye las opciones recién añadidas por una lectura
vieja. Durante la operación se bloquean cambios incompatibles de expediente o área.

El registro grande con tres campos se retiró de la lectura principal. Oficio se
escribe al declarar No Procede (explicativo) o resolver/aprobar en GC (resolución).
Un oficio ya registrado se lee junto a la resolución, incluso tras reapertura.
La recepción no solicita ni muestra un oficio vacío. Mis Quejas conserva una lectura
compacta de los campos existentes, sin repetir fecha/tipo o dejar editor sin consumidores.

Actividad tiene una sola sección **Observaciones**: cuadro de cinco filas arriba,
tipo/visibilidad actuales y entradas de seguimiento debajo. La observación histórica
se conserva una vez, identificada como anterior sin inventar su autor o fecha. El
contrato persistido sigue siendo `quejas_comentarios`, con guards de doble envío,
visita y borrador vigentes. Las notas de investigación de Mis Quejas permanecen
separadas. Reportería reúne histórico y seguimiento bajo las mismas RLS: ver
[lectura y límites del informe](reporteria-observaciones-2026-10-13.md).

## Fuentes y comprobación

- `components/Modal.tsx`: modalidades, marco, foco y scroll anidado.
- `app/quejas/page.tsx`: ventana de tabla y bloqueo de cambio de expediente.
- `app/quejas/components/QuejaDetalleModal.tsx`: lectura, diálogo y handlers existentes.
- `app/quejas/components/ResponsablePicker.tsx`: búsqueda/selección local del encabezado.
- `app/quejas/components/AreaQuejaControl.tsx`: selección directa junto a Descripción.
- `app/quejas/components/AreaQuejaCatalogo.tsx`: gestión del catálogo dentro de Datos de la solicitud.
- `lib/services/quejaAreaCatalogService.ts`: actualización parcial del catálogo con comparación del snapshot.
- `QuejaExpedientePanels.tsx`: presentación del ciclo/plazo; no escribe workflow.
- `components/ui/RichTextEditorBody.tsx`: lienzo y alineación del editor real.
- `components/quejas/ListaAdjuntos.tsx`: lista compartida y tarjetas opcionales.

Pruebas de revisión/visita, modalidades, editor y visor se mantienen en
`tests/entity-request-guard.test.mjs`, `visual-contracts.test.mjs`,
`rich-text-editor.test.mjs` y `adjunto-preview-layer.test.mjs`. La comprobación visual
usa los componentes/página reales con red y datos ficticios en `.performance/`, sin
enviar correo ni mutar expedientes de producción. Resultado: **530/530** en la suite
completa y **66/66** en la selección de panel/editor/visitas. QA de navegador en
1600×1000 y 390×844 comprobó 40% y altura completa, filtros/columnas sin cambiar
dimensiones, tabla operativa con ambos scrolls, reapertura lateral, columnas sticky,
geometría estable al elegir decisión, placeholder/toolbar, lienzo y Escape/resize
anidados. TypeScript, lint acotado, estructura, capa visual y build de producción
pasaron. Compilar no publicó el frontend.

Ajuste posterior de elección centrada/leyenda gris: **50/50** pruebas pertinentes,
TypeScript y lint acotado pasaron. QA actual de navegador comprobó además el selector
inicial centrado, editor oculto antes de decidir, desaparición de botones, leyenda
gris en el encabezado, cambio de decisión sin perder texto ni dimensiones y bloqueo
del guardado durante la elección. La suite completa/build de arriba corresponde a
la verificación previa de la geometría del panel.

Selector de responsable: `tests/responsable-picker.test.mjs` verifica filtrado,
teclado, cierre, error y foco. `entity-request-guard.test.mjs` comprueba que no haya
escrituras sin responsable y que asignarlo conserve el borrador/revisión original.
Selección actual: **48/48**; TypeScript, lint acotado, estructura y capa visual pasan.
QA de navegador con 76 usuarios ficticios comprobó búsqueda de nombre sin tildes y
correo, error/apertura/foco al guardar sin asignación, lista con scroll, selección por
Enter, Escape sin cerrar el documento, encabezado compacto y popover dentro del
viewport móvil. Sin publicar Vercel ni modificar DB.

Campos graduales/Observaciones: **557/557** en la suite completa actual, incluyendo
preservación del snapshot al editar área, guards de catálogo/visita y reportería.
QA con página y componentes reales, datos ficticios y red externa bloqueada: **66
comprobaciones** en escritorio y móvil, incluyendo área en encabezado, creación
en un solo panel, conservación de observación histórica, compositor antes del
seguimiento y cierre/foco del desplegable sin cerrar el expediente. TypeScript,
lint acotado, estructura y capa visual pasan. Build de producción pasó al permitir
la descarga de Inter de Google Fonts; el primer intento sin acceso de red falló
solo al descargar esa fuente. Sin despliegue ni mutaciones de expedientes reales.

Revisión posterior de etiquetas/cancelación: **72/72** pruebas de panel, área,
responsable, modal y visor; QA actual **76 comprobaciones**. Verifica la selección
vacía explícita, etiqueta visible con valor guardado, Cancelar en ambos caminos,
conservación del documento y cierre por X en escritorio/móvil. La suite completa y
build citados arriba son el baseline previo a este ajuste; no se publicaron cambios.

Corrección de alta de áreas: **44/44** pruebas de área y guards de expediente.
Incluye varias altas sin asignar, lista conservada al reabrir, duplicados, selección
final y conservación de oficio/revisión/observaciones. El navegador usa TanStack
Query real y un servicio local ficticio para comprobar también recarga con un
QueryClient nuevo, sin usar la sesión ni datos de producción. TypeScript y lint
acotado pasan; no hay cambios de DB ni despliegue.

Lectura de contenido (14 octubre): `lib/utils/quejaContent.ts` es compartido por
QuejaDetalleModal y QuejaColaboradorPanel. El motor conserva en notas plain una
copia literal `[Procede] ` de la justificación que también existe como campo
separado. El lector oculta solo esa copia completa cuando coincide exactamente;
conserva análisis diferente, historia de reapertura y contenido con formato explícito.
No deduce Markdown por asteriscos ni cambia filas en DB. Justificación y resolución
se presentan con sus formatos declarados, sin una sección de análisis vacía.
QA local del panel real: 16 comprobaciones en 1600×1000 y 390×844, justificación
una sola vez con negrita real, resolución/oficio conservados y sin overflow
horizontal. Datos sintéticos y red externa bloqueada; no modifica expedientes reales.

## Comunicación final de Calidad — ampliación local del 15 octubre

El responsable prepara su conclusión en Mis Quejas y la envía a revisión. La
comunicación final y la no procedencia corresponden a Calidad o administrador
reales. Las acciones terminales de Quejas no se ofrecen al colaborador responsable.
La propuesta interna conserva su editor/formato; nunca se copia automáticamente en
la respuesta ciudadana.

Cuando el seguimiento privado está habilitado, el mismo documento de altura fija
ofrece las pestañas accesibles «Documento interno»/«Revisión interna» y «Respuesta
al cliente». La segunda contiene una redacción plain independiente de hasta
10.000 caracteres, el oficio emitido por ECA y la selección explícita de su archivo.
El encabezado indica que esa respuesta y el archivo serán visibles para el cliente.
El lienzo conserva espacio de escritura; a poca altura desplaza solo su contenido y
mantiene las acciones de guardar visibles.

Solo son elegibles adjuntos institucionales Drive del propio expediente, con autor
registrado; las evidencias ciudadanas y paths Storage históricos no se ofrecen
como oficio. Calidad puede adjuntar en recepción, investigación y revisión, incluso
desde el documento. Subir no selecciona ni publica automáticamente el archivo.
Mientras haya una subida/eliminación no se permite aprobar la publicación.

`useQuejaPublicacion.ts` consulta únicamente `{enabled}` mediante la API privada,
con cancelación, caché TanStack de 30 segundos y ámbito del QueryProvider. Un `false`
confirmado mantiene el contrato anterior. Un error o una respuesta desconocida
bloquea la aprobación y ofrece reintento; nunca se interpreta como permiso para
evadir los campos públicos obligatorios.

`resolverQuejaConDocumento` llama al nuevo RPC
`qms_resolve_complaint_with_document`: respuesta/archivo y transición se guardan en
una sola operación con la revisión que abrió el editor. La DB verifica otra vez rol,
archivo y revisión. El servicio valida campos antes de escribir; conflictos y
respuestas tardías conservan el borrador/ámbito original, sin leer una revisión
nueva para forzar el guardado. Cancelar una decisión vuelve a Procede/No Procede
conservando sus borradores, y la X sigue siendo el cierre del documento.

Esta integración permanece local y depende de la migración/API/flags compatibles;
no se ha publicado en Vercel ni activado por editar estos archivos. Pruebas nuevas
en `tests/queja-publicacion.test.mjs`: campos requeridos, pertenencia de archivo,
compatibilidad legacy, disponibilidad fallida, revisión capturada y borradores de
otra visita. Las suites anteriores de guards y contratos visuales conservan sus
comprobaciones, usando explícitamente el modo anterior donde corresponde.

## Scroll ampliado (2 de noviembre)

Al ampliar el workspace a todo el ancho, el contenedor `[data-case-scroll]` de
`CaseWorkspace` sigue siendo el único dueño del scroll vertical. Se promueve a capa
compuesta con `will-change: transform`; sin esa promoción Chrome podía resolver el
scroll y el repintado de Descripción en el hilo principal sobre una superficie mucho
mayor, y el desplazamiento se percibía lento. La promoción no bastó, así que el
lienzo quedó fuera de la barra personalizada: las reglas `::-webkit-scrollbar` de
`app/globals.css` se aplican con `:not([data-case-scroll]):not([data-case-scroll] *)`
y el expediente conserva la barra nativa `solid-color` mediante `scrollbar-width:
thin` y `scrollbar-color`. Una barra pintada por `::-webkit-scrollbar` no puede
actualizar el pulgar en el compositor —Chromium la trata como scrollbar «themed» y la
repinta en el hilo principal—, y ese trabajo retrasaba el desplazamiento del modal
ampliado. El resto del panel conserva la píldora Monday. Los laterales sticky de
`CaseWorkspace` también llevan capa propia para que el compositor reubique su offset
durante el scroll. No cambian geometría, modalidad nativa, borradores ni permisos; la
barra del expediente deja de tener el resaltado al pasar el puntero, que la barra
nativa no expone. La promoción de los laterales sticky se mantiene: es justamente lo que
explica la diferencia reportada respecto al modal no ampliado —sin ellos, el modal de 40 vw
no tiene laterales sticky (están ocultos) y por eso movía la Descripción igual de rápido—.

El amplio sigue siendo el caso más costoso: al aplanar el modal se muestra la hoja con la
descripción a todo el ancho, y por eso conviene una segunda garantía de capa compuesta antes
de considerar el tema resuelto. No cambian geometría, modalidad nativa, borradores ni permisos.
La comprobación local del 2 de noviembre conserva Node 798/798, con aserciones nuevas en
`tests/visual-contracts.test.mjs` (scrollport, fondo opaco y velo del backdrop) y
`tests/tailwind-ui-kit.test.mjs` (exclusión de `::-webkit-scrollbar` en el lienzo),
y TypeScript, lint, build, estructura y capa visual correctos. El cambio permanece
local y no se publicó en Vercel.

## Espacio inferior en el documento (4 de noviembre)

Con el modal abierto (semidesplegado o ampliado) el final del documento —la descripción y,
seguido, las evidencias— quedaba pegado al borde inferior del lienzo en cuanto el contenido
terminaba. Se añadió `pb-6` al sheet del documento (`main[data-case-document]` dentro de
`CaseWorkspace`), de modo que la descripción y el resto del documento siempre terminan con
un mini espacio en blanco antes del borde inferior. No cambia la geometría del contenido,
solo el aire inferior. Verifica el ajuste con el modal abierto y scrollea hasta el final.

## Scroll del editor del expediente (4 de noviembre)

El editor con `layout="fill"` (decisión de procedencia, justificación, resolución interna)
y el lienzo del informe con `layout="content"` (`data-informe-scroll`, documento editable
para Word) comparten el mismo patrón de scroll: `overscroll-contain` y capa compuesta
(`will-change: transform`) sobre el contenedor con scroll, igual que el scrollport del
expediente. El editor de decisión/resolución ya tenía el canvas fijo y la mejora; el
informe la incorporó en su contenedor (`QuejaInformeModal`) para que el documento largo
no sienta el scroll lento. No cambia contenido, permisos, workflow ni exportación.

## Encabezado fijo del expediente (4 de noviembre)

El resumen `data-case-summary` («Datos de la solicitud») pasa a `sticky top-0 z-10` dentro
del contenedor de scroll del modal, con su propio fondo, para que los datos queden fijos al
deslizar el documento. No reorganiza el orden de los elementos; solo los pega arriba. El
encabezado del modal de decisión/editor ya era no scrolleante por su layout de columna con
header `shrink-0`; el del workspace se corrigió en el contenedor de scroll.

Verifica el ajuste con el expediente abierto y scrollando hasta el final: el resumen debe
quedar visible pegado arriba y el contenido debe deslizar bajo él.

## Fuente única export/Respuesta (4 de noviembre)

Al declarar No Procede o resolver desde el editor, la respuesta al cliente se alimenta del
mismo documento interno que se publica (la justificación o la resolución); no se exige un
texto paralelo en el panel de publicación, y si no existe respuesta previa se comparte la
fuente. El export del informe y la publicación del workflow no duplican la redacción: el
texto una sola vez, en el documento.

## Acciones del editor en el header (4 de noviembre)

Los botones «Guardar Cambios» y «Exportar a Word (.docx)» del informe se movieron al
`headerActions` del Modal (nivel superior del editor); la fila de estado de contenido se
eliminó por completo, subiendo el editor y ganando campo para el lienzo. El contenedor de
scroll perdió su padding superior (`pb-6` en el fondo) para que el lienzo quede pegado al
header sin espacio intermedio. No cambia contrato, permisos, workflow ni exportación.

## Exportar a PDF del informe (4 de noviembre)

Se añadió el botón «Exportar a PDF (.pdf)» en el mismo `headerActions`, junto al de Word,
con el generador `lib/utils/quejaInformePdf.ts` (texto + títulos en negrita, sin recursos
externos). El flujo de descarga es el mismo que el de Word: blob → object URL → anchor.
No cambia permisos, workflow ni el contrato de guardado/exportación.

## Expediente del modal de gestión: solicitud a la izquierda y avance en la línea superior (5 de noviembre)

Ajuste local, sin publicar en Vercel. Refina la composición del modal de gestión de Quejas
tras el pedido del propietario: mover los datos de la solicitud y el avance del proceso.

- En el modal de gestión de Quejas los **datos de la solicitud pasan al lateral izquierdo** como
  panel estático: `CaseRequestHeader` con `variant="panel"` (`data-case-request`, título «Datos
  de la solicitud») con persona, correo, teléfono, fecha de recepción y tipo recibido. La
  variante lateral con desplegable (`variant="details"`) se conserva para el panel del
  responsable (Mis Quejas). Los datos del panel se apilan en filas y los nombres/correos
  extensos pueden partirse dentro del panel sin desbordarlo. Mis Quejas no incorpora el
  catálogo de áreas.
- El **avance del proceso se ubica en la línea horizontal superior** (`data-case-top-cycle`) con
  el ciclo proyectado horizontalmente siempre con mini línea; la **línea de progreso** entre
  etapas se pinta con el token azul del estado activo (`bg-qms-primary`; la etapa previa/
  completada se marca en verde). El layout con solicitud lateral pasa a tres columnas desde
  1100 px con la columna de solicitud de 220 px y 12 px de margen izquierdo: solicitud
  (izquierda) | documento
  (centro, máximo 960 px como en Mis Quejas) | acción (derecha). La hoja queda centrada en
  el lienzo ampliado, ligeramente desplazada a la izquierda. La línea del ciclo comparte esa
  cuadrícula, comienza alineada con el borde izquierdo de la hoja de Descripción y muestra
  «Estado del trámite» en el espacio reservado a la izquierda. Todas las etiquetas del ciclo
  permanecen visibles al lado de su círculo, en una sola fila; el paso activo usa el color
  primario y los completados conservan el check verde con texto atenuado. Quejas y Mis Quejas
  usan el mismo espaciado compacto y largo fijo de conectores. Mis Quejas conserva las líneas
  entre pasos en la barra superior expandida y en la franja
  compacta que se muestra cuando el ancho del modal no alcanza el breakpoint de escritorio.
- La disposición del modal de gestión no depende del modo expandido: el staff usa la línea
  superior de forma estable. Mis Quejas conserva la misma estructura en ambas pestañas:
  solicitud en el lateral izquierdo, avance horizontal alineado sobre la hoja central y acción
  a la derecha.

- El catálogo de áreas salió del expediente ampliado de gestión y se administra desde
  Configuración (módulo `quejas`, tipo `area_afectada` vía `quejaAreaCatalogService`); el
  control junto a Descripción (`AreaQuejaControl`) solo asigna/lee el área.

Verificación local del 5 de noviembre: Node 831/831, TypeScript, lint, build, estructura y
capa visual correctos; nuevo contrato en `tests/visual-contracts.test.mjs` («el expediente
ampliado con solicitud en lateral deja el avance en la línea superior»). Local, sin publicar.
