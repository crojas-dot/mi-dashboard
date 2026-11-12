# Mis Quejas: guardar resolución sin enviarla

Guardar está junto a Asistencia. Conserva texto y formato del borrador en el
expediente para retomarlo después; no cambia el estado, calendario, revisión de
Queja ni propuesta enviada, y no encola avisos o correo. No hay autoguardado.
Enviar a Revisión GC sigue siendo la acción independiente que entrega la propuesta.

## Persistencia y autorización

Migración **20261112030353** aplicada a ECA-QMS el 12 noviembre UTC (11 local).
`queja_resolution_drafts` mantiene una fila por expediente, versión, revisión de
origen, contenido/formato, autor operativo y fecha real. Admite hasta 10.000
caracteres en plain/markdown; permite guardar vacío para limpiar un borrador previo.

RLS permite leer solo a perfiles activos autorizados: admin, Calidad con escritura
de Quejas, o colaborador con escritura de Mis Quejas y responsable propio, mientras
el caso esté En Investigación. Anon no tiene SELECT; authenticated no tiene escritura
directa. Los RPC públicos `qms_save_resolution_draft` y `qms_submit_resolution_draft`
son invoker; delegan en la implementación privada con guard explícito y search_path
vacío. No se reabren funciones legacy ni permisos de casos/adjuntos.

Guardar compara revisión del expediente y versión del borrador bajo lock, en ese
orden. Enviar verifica ambos y llama al workflow existente en la misma transacción.
Un conflicto conserva el texto del usuario; no se obtiene una revisión nueva para
forzar la escritura. Cambiar estado o responsable retira el borrador mediante
trigger. La propuesta anterior permanece en `quejas.resolucion`, sin sobrescribirla
al guardar; una devolución nueva comienza sin recuperar un borrador de otra etapa.

## Cliente y revisión de visita

`useQuejaResolucionDraft` lee solo al investigar, con la clave
`['quejas','resolucion-borrador',id]`, señal de cancelación y sin Realtime adicional.
La primera lectura confirmada hidrata la visita. Mientras falta, no se permite
escribir encima de un borrador desconocido; un fallo ofrece Reintentar borrador.
Un refetch posterior no reemplaza texto ni versión capturados.

Guardar y Enviar comparten el lock síncrono del workflow. Durante el guardado se
bloquea el doble envío; el editor conserva su nodo. Guardar es azul solo con cambios;
tras confirmación remota muestra check y el encabezado pasa a ofrecer Editar, con la
fecha real en su título. Editar devuelve al modo de escritura: Guardar y Asistencia
reaparecen y el lienzo deja de ser solo lectura. Reabrir carga el guardado en ese
mismo modo de lectura.
Una respuesta tardía actualiza la caché de origen solo si sigue vigente el ámbito,
sin modificar otra visita o identidad. El borrador guardado permite navegar entre
expedientes; los cambios nuevos sin guardar conservan el bloqueo previo.

En el piloto visual exclusivo de Mis Quejas, «Ver caso completo» usa el botón
secundario del kit, blanco con borde; enviar a GC conserva el primario institucional.
Guardar y Asistencia permanecen juntos en escritura. El documento crece sin scroll
interno: el expediente mantiene un único desplazamiento principal.

Notas de investigación vive en una tarjeta compacta bajo el cliente: cantidad,
última fecha o Sin notas todavía. Ver notas abre un diálogo centrado con las notas
completas y el campo para agregar; cerrar conserva la nota aún no enviada en la
visita. Cada nota propia de esta investigación ofrece un menú de tres puntos con
Editar y Eliminar (confirmación en línea; Escape o pulsar fuera cierra el menú); las
notas de devolución de Calidad solo se leen y conservan su historial. El centro queda
reservado al editor de resolución: el ciclo horizontal vive en el encabezado
principal del modal, sin consumir otra franja. El lienzo ya no contiene listas de
adjuntos y crece con su contenido, sin scroll interior ni altura fija. El
expediente conserva un único desplazamiento principal; la columna izquierda
no tiene scrollbar propia ni recorta la tarjeta de archivos. En la columna izquierda se muestra primero **Adjuntos del análisis**, seguido de
**Notas de investigación**, con cantidad, último nombre y acceso a un diálogo centrado;
la tarjeta solo permite consultar el listado, sin subir archivos desde ahí.
La carga (arrastrar o seleccionar varios) se realiza exclusivamente dentro del
diálogo de adjuntos. El diálogo muestra únicamente adjuntos del responsable,
permite previsualizar, descargar y eliminar con confirmación al tener permisos
vigentes. La subida se hace secuencialmente con el servicio actual y conserva los
bloqueos de operaciones; el selector cancelado no cierra la visita. Ver caso
completo presenta únicamente adjuntos del cliente, evitando duplicados con el
diálogo del análisis. No se modifican consultas, servicios, RLS ni el visor. El
envío a GC permanece en Acción actual, sin otro botón debajo del
editor. Si la última decisión de Calidad es una devolución y la queja está de nuevo
En Investigación, el control se llama «Reenviar a Revisión GC» y el mensaje
con el motivo aparece bajo los botones de Acción actual. Una investigación
inicial muestra «Enviar a Revisión GC» sin mensaje. Al reenviar, la transición
a Pendiente de Revisión GC retira el aviso y el botón de la acción actual;
el historial conserva el motivo anterior. Una aprobación posterior impide
que una devolución histórica aparezca al reabrir. La devolución de Calidad
refresca el historial de actividad compartido. El aviso lateral muestra siempre el motivo de la devolución más reciente:
si supera 140 caracteres se presenta un extracto con «Ver más». Si hay dos o
más devoluciones, «Ver más» aparece incluso cuando el último motivo es corto.
Ese mismo modal presenta los motivos completos y sus fechas en orden descendente
(del más nuevo al más antiguo), sin sobrescribir el historial y sin cargar datos
adicionales. Cuando el expediente vuelve a revisión GC, no se muestra el aviso. Ampliar, consultar y cerrar paneles no remonta el editor ni cambia su
revisión o borrador.

## Notas de investigación

La tarjeta y el diálogo reutilizan `quejas_actividad`; el alta sigue siendo el
insert existente. Editar o eliminar solo alcanza notas propias de la investigación
en curso: RLS no expone UPDATE/DELETE, así que `qms_update_investigation_note` y
`qms_delete_investigation_note` (invoker) delegan en `qms_private` con
`search_path` vacío. El guard exige identidad operativa activa, acceso al
expediente, responsable vigente, estado En Investigación, autor propio de la nota y
contenido esperado (CAS). Las notas de devolución, aprobación y cierre del trámite
no se reescriben, ni siquiera por admin, y el texto nuevo tampoco puede imitar esos
avisos. La fecha original de la nota se conserva.

La migración **20261112054513** existe y pasó 55 comprobaciones PostgreSQL aisladas,
pero **no está aplicada** en ECA-QMS: sin ella la UI muestra un error seguro al
editar o eliminar y no debe reintentarse con otra revisión. La lectura, el alta y
los contadores existentes no dependen de esta migración.

## Fuentes y verificación

- UI: `app/mis-quejas/components/QuejaColaboradorPanel.tsx`.
- Paneles: `QuejaNotasPanel.tsx` en la misma carpeta; los adjuntos reutilizan
  `components/quejas/ListaAdjuntos.tsx`.
- Lectura: `lib/queries/useQuejaResolucionDraft.ts`.
- Mutaciones: `guardarResolucionBorrador` / `enviarResolucionBorradorRevision` en
  `lib/services/quejaWorkflowService.ts`.
- Notas: `lib/services/quejaInvestigacionService.ts`, `lib/utils/quejaInvestigacionNotas.ts`;
  SQL `supabase/migrations/20261112054513_quejas_notas_investigacion.sql` y verificación
  `scripts/test-investigation-notes-db.mjs` (sin aplicar en ECA-QMS).
- SQL: `supabase/migrations/20261112030353_quejas_borrador_resolucion.sql`.
- Activación: `supabase/backups/quejas_resolution_draft_activation_20261111.json`.

48 comprobaciones PostgreSQL aisladas verifican RLS/grants, perfiles/identidades,
casos ajenos, inactivos, estados, límites, CAS, carrera de dos computadoras,
guardado sin transición y limpieza al enviar/reasignar. Node verifica servicios,
carga, reanudación, errores/conflictos, exclusión y respuesta tardía entre visitas.
24 comprobaciones de navegador con datos sintéticos a 1920/390/320px verifican
guardado/reapertura, formato, errores/conflicto y hover/controles sin desbordar.
Las lecturas remotas comprueban metadatos y rechazo sin usuario; asesores antes y
después conservan sus hallazgos previos. No se crearon quejas ni se enviaron correos.
DB activa; cambios web locales, sin publicar.

El refinamiento posterior del lienzo pasó 120 pruebas Node y 42 comprobaciones de
Chrome a 1920/1536/390/320px: notas/evidencias, alta de nota, contador y acciones de
archivos con permisos existentes, conservación del editor/borradores y el entonces
vigente Guardado neutral. TypeScript, lint, capa visual, estructura y build
correctos. Evidencia sintética local en `.performance/mis-quejas-panels-20261111/`.

El ajuste del 12 noviembre pasó la suite completa (932 pruebas Node), TypeScript,
lint, estructura, capa visual y build: diálogo centrado de notas con menú de tres
puntos para editar/eliminar notas propias, «Editar» tras guardar con lienzo de solo
lectura, adjuntos debajo del lienzo dentro de la tarjeta y selector de archivos
cancelable sin cerrar el expediente. La migración de notas añadió 55 comprobaciones
PostgreSQL aisladas sobre RLS/grants, autor propio, responsables, estados, CAS,
límites y escritura directa bloqueada; no se ejecutó SQL contra ECA-QMS.


La vista contraída vuelve a mostrar el resumen del proceso y sus cuatro líneas
bajo el encabezado. En la vista ampliada, ambas pantallas comparten el mismo
progreso con cuatro líneas dentro del encabezado, alineado al ancho útil del
lienzo central (se descuenta el gutter real del scroll). No altera los estados.


## Piloto visual exclusivo de Mis Quejas (12 noviembre 2026)

El HTML externo es referencia de ergonomía, no código de producción. Se conserva
Lucide outline, los colores institucionales ECA, los componentes y la gestión de
adjuntos únicamente en su modal (filas, nombres completos, vista previa y acciones).
La tipografía System UI se aplica solo al workspace opt-in de Mis Quejas. El editor
utiliza 17px, interlineado 1.625, gris #1f2937 y máximo 768px útiles centrados,
incluyendo el texto de lectura y su placeholder. Controles de 15px, secundarios
existentes de 14px y título de resolución de 18px.

La geometría opt-in usa 240px/centro/260px desde 1100px de contenedor y
280px/centro/300px desde 1360px. El ancho del proceso, márgenes y gutters
coinciden con el documento; los laterales y el encabezado continúan sticky,
sin scroll anidado. Quejas no activa esta configuración visual.

Corrección visual posterior: se declaró explícitamente la fuente nativa System UI
sobre el texto Tiptap y el contenido de lectura, además del placeholder, para que
no dependan de Inter global. Tamaño e interlineado pasan a 16px y 1.6, exactamente
como el elemento `.editor-area` de `ejemploparaqms(1).html`.


Ajuste al ejemplo de tres columnas: se pasa de 16px/1.6 a 17px/1.625,
separación de 16px entre párrafos (sin alterar párrafos de listas) y ancho
útil de texto 768px. El contenedor TipTap incluye padding lateral de 40px
en escritorio, por lo que su ancho exterior máximo es 848px. El placeholder
y la resolución final conservan el mismo estilo. Sin cambios en Quejas ni
en la gestión de adjuntos.


## Clon visual limitado a Mis Quejas (12 noviembre 2026)

Se ajustó el piloto a los colores exactos del HTML entregado: fuente
System UI, texto #1f2937 (17px, interlineado 1.625), secundario #6b7280,
fondo #f3f4f6, tarjetas blancas con borde #e5e7eb, botones primarios
#2563eb y hover #1d4ed8, secundarios blancos y borde #d1d5db.
«En Investigación» es azul oscuro #1e3a8a solo como presentación de esta
pantalla. Se respeta el ancho útil de lectura 768px, los párrafos a 16px
de separación, y el patrón de botones/tablas/iconos Lucide sin emojis.
El cambio se configura con variables CSS locales de `mis-quejas-reading`:
el tema global de ECA-QMS y el flujo de procesos no cambiaron.
