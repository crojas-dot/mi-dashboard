# Resolución y revisión de Calidad — 3 noviembre de 2026

Estado: ajuste local, sin publicación. Afecta la edición de Resolución en Mis
Quejas y la lectura de expedientes en **Pendiente de Revisión GC**.

## Edición de Resolución

- La barra de formato comienza inmediatamente bajo las pestañas. Se retiran el
  título repetido y el párrafo de introducción; la aclaración de que se envía a
  Calidad, sin notificar al cliente, acompaña al botón de envío.
- Asistencia comparte la fila de pestañas (Ayuda en móvil). Su contenido permanece
  plegado y solo ocupa espacio al abrirlo. No solicita IA hasta una acción explícita.
- La propuesta anterior queda desplegable durante investigación. Fuera de edición,
  el documento registrado permanece abierto para lectura.
- Se conservan el único Tiptap, formatos explícitos, límite de 10.000, revisión
  capturada, bloqueo de envío y borradores entre pestañas/ampliación/reducción y
  ante errores. El cambio no convierte un borrador en una escritura automática.

## Revisión de GC

- La propuesta del responsable es el primer bloque visible. No se antepone el
  resumen de resultado público que el propietario retiró en la revisión anterior.
- **Solicitud y antecedentes** conserva descripción completa, evaluación de
  procedencia, análisis registrado y archivos. Empieza plegado y su apertura se
  reinicia al cambiar de expediente. Los textos y formatos se muestran íntegros;
  no se generan subtítulos, viñetas o resúmenes que reinterpreten lo guardado.
- El ciclo pasa a una fila horizontal sobre el documento, liberando la columna
  izquierda. Con el ajuste local del 5 de noviembre, en el modal de gestión de Quejas los
  datos de la solicitud ocupan ese lateral izquierdo como panel estático y el avance del
  proceso queda en la línea horizontal superior con su línea de progreso en el token azul
  del estado activo (`bg-qms-primary`); el estado, plazo, responsable y acción continúan a la
  derecha. En anchos pequeños se conserva la barra compacta con su acción existente.
- El encabezado existente mantiene folio, persona y tipo y muestra la fecha real
  de recepción en estas vistas. El contacto completo sigue en su desplegable.
  No se restaura la prioridad histórica como un supuesto nivel de urgencia.
- Actividad conserva el historial con sus autores/fechas disponibles. Los checks
  del ciclo siguen siendo una proyección del estado, sin fabricar un timeline de
  aprobaciones ni fechas ausentes.

El resto de estados de Quejas mantiene Descripción al principio y su ciclo lateral.
Mis Quejas conserva el ciclo lateral al consultar Análisis y usa el horizontal
al preparar Resolución.

## Fuentes y contratos

`CaseWorkspace.cyclePlacement` comparte únicamente la geometría entre ambos
consumidores. El modo `top` usa dos columnas en escritorio y mantiene los mismos
nodos de documento/editores; el modo `side` conserva las tres columnas existentes.
`CaseRequestHeader.showReceivedAt` presenta el campo `fecha` ya disponible.

La composición vive en `app/mis-quejas/components/QuejaColaboradorPanel.tsx` y
`app/quejas/components/QuejaDetalleModal.tsx`; la geometría en
`app/quejas/components/QuejaExpedientePanels.tsx`. No cambian consultas, permisos,
mutaciones, expected revisions, estados, DB, correo ni publicación al cliente.

## Evidencia visual

Verificación final: **808/808** pruebas Node, TypeScript dentro del build, lint,
build de producción, estructura y capa visual correctos. La suite incluye orden
de lectura durante revisión, integridad del relato, ausencia de escrituras al
consultar y retorno a Descripción/ciclo lateral en los demás estados.

Fixture local con páginas, componentes, CSS y Tiptap reales, datos ficticios y red
externa bloqueada. A 1920 × 1000 px:

| Medida | Antes | Después |
| --- | --- | --- |
| Espacio entre pestañas y editor | 219px | 58px |
| Inicio del editor desde arriba | 394px | 277px |
| Inicio de propuesta de GC | 1422px | 220px |
| Ancho de documento en revisión | 960px | 1140px |

29 comprobaciones de navegador cubren lo anterior, asistencia cerrada, documento
anterior plegado, antecedentes consultables, conservación de borrador y conflicto,
acción Revisar resolución y ausencia de desborde a 390/320 px. No hubo sesión real,
escritura de negocio ni consultas a expedientes reales. Evidencia reproducible:
`.performance/quejas-review-20261103/verify.mjs`, `before.json`, `evidence.json` y capturas.

## Ajustes locales posteriores

- Resolución de Mis Quejas fija el ancho del selector de formato según el ancho de
  wrapper solicitado; antes el ancho predeterminado del control ocupaba toda la barra
  y desplazaba los botones. La barra ahora envuelve controles en anchos menores.
- Al devolver una propuesta, Gestión de Calidad registra el motivo en la actividad
  del expediente. Mis Quejas ofrece **Ver nota de devolución** bajo la acción de
  volver al análisis y muestra el motivo más reciente desde esa misma actividad,
  sin duplicar la nota ni cambiar la persistencia del workflow.

## Estabilidad del modal — 9 noviembre de 2026

Ajuste local, sin publicar. El botón **Asistencia** conserva su lugar junto a las
pestañas, pero abre una región independiente debajo. El `details` anterior tomaba
el ancho completo de la fila flexible al abrirse, reducía las pestañas a cero y
deformaba los controles. La ayuda interactiva aparece solo durante investigación
autorizada; los estados de lectura conservan el documento registrado. Cerrar la
visita o cambiar de expediente restablece la ayuda sin trasladar consultas ni
borradores a otro caso. El chat envuelve sus controles si no caben juntos.

El área editable de Tiptap ocupa ahora todo el alto disponible del lienzo `fill`
sin paginación: se puede comenzar a escribir al pulsar su espacio en blanco. El
foco global conserva su anillo en botones, selectores y otros campos; solo el
contenido `.tiptap` omite la sombra que dibujaba una línea bajo el texto al editar.
Los callbacks del editor se actualizan al confirmar el render, sin mutar una ref
durante su evaluación ni emitir cambios al sincronizar props.

Los controles del encabezado de Quejas se adaptan al ancho real del workspace
mediante el contenedor nombrado de `Modal`, conservando el folio legible en un
lateral de 40vw a 1024px. Los textos accesibles de los pasos completados quedan
anclados a su propio paso; antes escapaban de la región de scroll horizontal y
provocaban desborde del diálogo en 320px.

Verificación con páginas, componentes, CSS y Tiptap reales, datos ficticios y
conexiones externas bloqueadas: **505/505** comprobaciones en **142 vistas**.
Cubre Recibido, En Investigación, Pendiente de Revisión GC, Resuelto, Finalizado
y No Procede en ambos módulos, vistas lateral/ampliada y anchos 320, 390, 1024,
1366 y 1920px; incluye devolución, procedencia, respuesta, actividad, reapertura,
escritura multilínea, ayuda/chat durante carga y error, foco de teclado y
conservación del borrador al cambiar de pestaña/ampliar/reducir.

Las seis suites de paneles/guards/ciclo/publicación pasan **98/98**. La selección
con editor pasa **110/113**: las tres pruebas anteriores de paginación/viewport
siguen fallando por expectativas que ya diferían del editor antes de este ajuste.
La suite global queda en **856/861**, incluyendo otros dos fallos anteriores en las pruebas del informe:
confirmación de salida y doble de PDF sin `getTextWidth`. Se conservan como
pendientes; no se debilitaron esas pruebas para aceptar el cambio visual.
Lint, build con TypeScript, estructura y capa visual verificados. Otras **6/6**
comprobaciones confirman que abrir/cerrar el informe paginado limpia sus estilos
y permite editar después una resolución normal sin la línea de foco. Evidencia local:
`.performance/quejas-layout-20261109/check-layout.cjs`, `layout-evidence.json`,
logs y capturas. No hubo escrituras de negocio, envíos de correo ni cambios de DB.
