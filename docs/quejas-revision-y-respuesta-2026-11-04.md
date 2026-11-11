# Revisión GC y respuesta al cliente separadas

Implementación del 4 de noviembre de 2026. Cliente web local, sin publicar en Vercel.
Migración aplicada y grants/RLS/funciones efectivos verificados en ECA-QMS.
Evidencia: `supabase/backups/quejas_quality_flow_activation_20261104.json`.
Los avisos del asesor de seguridad mantienen los mismos cinco tipos y recuentos
previos; esta entrega no añade funciones privilegiadas expuestas al cliente.

## Flujo y puntos de edición

### Panel del responsable y comunicación de No Procede — 10 noviembre

Mis Quejas usa el mismo marco contraído de Quejas: avance segmentado bajo el folio,
acciones primero, datos de solicitud plegados y documento dentro del marco con una
barra principal. El ajuste posterior unifica también el indicador con el ciclo de
Quejas: Evaluación, Investigación, Revisión de Calidad y Cierre. Ampliar/reducir mantiene los
nodos del editor y el borrador. En Resolución, Enviar a Revisión GC aparece debajo
de Volver al análisis en las acciones; se retira el pie que ocupaba el área de escritura.

Respuesta al cliente precarga el folio como número de oficio solo si no existe uno
guardado. La plantilla nueva usa ` - ` en el asunto y añade el contacto
`gc@eca.or.cr`. Los borradores existentes conservan sus valores editados.
Editar informe abre el editor del expediente desde esa ventana y conserva el correo.
Al guardar, actualiza la versión disponible para adjuntar/visualizar como Word. Una
selección de PDF u oficio externo se conserva hasta que el usuario elija el Word
guardado explícitamente. Visualizar sigue siendo de lectura.

Al elegir No Procede con publicación habilitada, se abre esa misma ventana directamente
en el correo, sin pestañas ni otro modal de justificación/confirmación. Publicar respuesta
valida correo, oficio y adjunto e inicia la publicación desde esa ventana. Los fundamentos
corresponden al informe: el registro conserva el motivo previo si existe o la comunicación
de no procedencia que remite al adjunto, sin copiar el correo como dictamen ni pedir
un segundo texto. Guardar borrador no cambia Recibido
ni encola correo. Confirmar la publicación valida oficio/documento y registra motivo,
respuesta, archivo y correo juntos; el estado final es No Procede. Cancelar vuelve a
elegir la decisión. El cliente anterior conserva su entrada atómica compatible.

Migración aplicada por MCP `20261110165806_quejas_no_procede_correo.sql`: añade dos
campos opcionales al borrador, sin backfill. Los puentes invoker
`qms_save_rejected_response_draft` y `qms_publish_rejected_response` conservan guard de
Calidad, revisión del caso, CAS del borrador y validación del archivo. La publicación
usa el puente atómico vigente y congela el correo en el único evento final pendiente.
No permite reemplazar una publicación ni reenviar un evento anterior/incierto.
Guardar después una respuesta aprobada limpia el motivo abandonado, sin reiniciar
la versión. Conserva RLS y grants anteriores; los puentes nuevos solo se conceden
a authenticated. Los cinco recuentos de seguridad permanecen iguales.

Edge v16 añade el contacto de Calidad a las plantillas ciudadanas predeterminadas de
acuse/final. Un correo editado se entrega exactamente como fue aprobado. Conserva
seguimiento solo en el acuse y el adjunto físico obligatorio en el final; no modifica
Apps Script, activadores, permisos ni envíos históricos. Bundle remoto leído y
comparado con el preparado. Preflight: 16 acuses y 7 finales `sent`, sin pendientes.

Verificación: 145/145 Node focalizadas; 124/124 comprobaciones PostgreSQL aisladas;
45 de Chrome sintético a 1536/390/320 px (expansión/borrador, acción GC, informe
guardado/Word real, selección externa, motivo/correo recuperados y conflicto de
publicación); 64 del bundle Edge. TypeScript, lint, build, estructura y capa visual
correctos. La selección adicional del informe mantiene el fallo previo del doble
de PDF sin `getTextWidth`; no se modificó esa implementación ni su prueba. Cero
expedientes o correos reales creados para QA. Evidencia saneada en
`supabase/backups/quejas_no_procede_activation_20261110.json`; artefactos locales en
`.performance/quejas-refinamientos-20261110/`. Web local, sin publicar en Vercel.

Corrección final del mismo día: el propietario pidió retirar también el modal extra
de No Procede; el botón de la ventana del correo es la acción final. 21 comprobaciones
de Chrome sintético en 1536/390/320 px: publicación directa, adjunto obligatorio,
doble clic sin duplicar, motivo histórico conservado, respuesta vacía histórica con
plantilla y conflicto/reintento con las revisiones originales. 13/13 pruebas de
servicio/correo, TypeScript y lint focalizado correctos. Sin cambios adicionales de
DB, Edge o Apps Script. Cero correos o escrituras reales en QA.

### Correo final con adjunto físico — ajuste del 10 noviembre

Activo y verificado en Apps Script y Edge v15: el acuse conserva el botón de seguimiento; el correo
final (incluido No Procede) no recibe `trackingUrl`, no emite una capacidad y no
añade el párrafo/botón de seguimiento. El correo editado conserva su asunto y cuerpo.
El informe se entrega como archivo Word/PDF en `MailApp.attachments`, independiente
de la caducidad del enlace ciudadano. Vencer el acceso no borra ese adjunto del correo
ni el archivo interno del expediente.

`qmsMailPollDirect_` autoriza todos los finales con `includeOfficialDocument`, sin
depender del flag opcional anterior. El emisor exige un documento publicado válido,
comprueba sus bytes antes de registrar attempting y conserva el reintento si Drive
falla. Sin documento no llama a MailApp. El diario se consulta primero para conservar
entregas/estados inciertos y evitar reenvíos; no se modifican huellas del diario.
La Edge tampoco autoriza un final sin publicación. No cambia el seguimiento público,
su plazo, permisos, ni la selección del documento por Calidad.

El propietario autorizó Google y aportó el enlace del emisor. Se actualizaron solo
cuatro funciones del HEAD de «Procesamiento Correos Quejas» por la API oficial;
manifiesto, propiedades, demás archivos y activador de cinco minutos se conservaron.
Lectura posterior exacta del código guardado y bundle de Edge v15 comprobadas.
Los siete eventos finales anteriores permanecen `sent`; no había finales pendientes
o inciertos al cambiar la plantilla, ni se reenviaron correos o ejecutó un poll de
prueba. El enlace público y sus archivos siguen su contrato anterior; el archivo
físico en el correo final es independiente de su caducidad.

Verificación local: 106/106 pruebas de transporte, adjunto, formato y deduplicación;
55 comprobaciones del bundle Edge. TypeScript y lint focalizado correctos. Evidencia
en `.performance/final-mail-20261110/` y
`supabase/backups/quejas_adjunto_final_activation_20261110.json`; cliente web sigue local.

### Fecha de cierre y estado visible del correo — 10 noviembre

Ante una consulta por correo final no recibido, los metadatos efectivos mostraron
publicación/cierre confirmados y un único envío `sent`, sin error, 4 minutos y
22 segundos después. Esa espera corresponde al activador de cinco minutos; el
diagnóstico no demuestra entrega en bandeja. No se ejecutaron reenvíos, claims ni
ACK manuales. El despertador por evento sigue preparado sin activar; este ajuste
no modifica Apps Script, activadores o configuración remota.

`CaseCompletionDate` muestra `fecha_cierre` persistida bajo el estado en Quejas y
Mis Quejas, tanto en lateral como ampliado/móvil, con zona America/Costa_Rica.
Solo Finalizado/No Procede con fecha válida la muestran; no se atribuye una fecha
de cierre al aprobar internamente ni a expedientes reabiertos.
`CaseFinalMailStatus` muestra en el panel de Calidad cola/envío/error y, si está
enviado, su timestamp separado del cierre. `useQuejaCorreos` se activa también al
consultar un expediente terminal; consulta cada 30 segundos solo mientras el envío
final está pending/leased/retry y la vista sigue activa y visible. No depende del
Realtime de quejas, pues el ACK solo modifica el outbox. Se detiene al llegar a
sent/uncertain/failed/skipped. Conserva la misma selección de columnas sin contenido,
destinatarios o claims. Publicar confirma «Correo en cola de envío» sin atribuir
entrega inmediata. No cambia workflow, RLS ni datos históricos.

Pruebas: 14/14 de cierre/seguimiento más 58 contratos vecinos ya verificados;
34 comprobaciones sintéticas de ambos módulos a 1536/390/320 px, incluyendo estados
pendiente/fallido/incierto y ausencia de fecha de envío falsa. TypeScript, lint, build y
capa visual correctos. Evidencia local en `.performance/cierre-envio-20261110/`.
Interfaz local, sin despliegue Vercel.

### Contrato vigente del 10 noviembre: correo de acompañamiento editable

La notificación al interesado es independiente de la resolución y del informe. La
matriz de Calidad (p. 16) separa el oficio de resolución de la notificación al cliente;
no exige repetir el texto del dictamen en el correo. `QuejaCorreoEditor.tsx` presenta
Para, Asunto y Mensaje, con una plantilla de `lib/utils/quejaCorreo.ts` que comienza
«Estimado(a) [nombre]:», identifica el folio y remite los resultados al informe adjunto.
El saludo puede corregirse sin inferir el género de la persona. Asunto y cuerpo son
texto editable, de 180 y 3500 unidades UTF-16 respectivamente. Se conservan párrafos;
el HTML institucional del emisor escapa su contenido. El destinatario sale del caso.

La franja superior conserva oficio, selección Word/PDF, subida y Visualizar. El Word
se genera solo desde la versión guardada del informe, sin modificarla ni repetir su
editor. El PDF conserva sus bytes. La vista previa es de lectura y no escribe.
Guardar borrador conserva por separado asunto/mensaje y respuesta pública, con la
versión original. Publicar exige ambos textos y documento, solicita confirmación y
congela el correo en el outbox en la misma transacción que la respuesta/oficio final.
Un fallo mantiene texto y selección; no sube nuevamente un Word ya confirmado.

DB aplicada por MCP: `20261110150300_quejas_correo_editable.sql`, seguida de
`20261110151342_quejas_habilitar_correo_editable.sql` después de comprobar la Edge
compatible (v13; v14 acota el lote Unicode). Las columnas opcionales `correo_asunto/correo_cuerpo` están en borrador y
outbox, sin rellenar históricos. Los puentes públicos invoker
`qms_save_response_draft_v2` y `qms_publish_approved_response_v2` usan las mismas
autorizaciones/CAS privadas; no hay escritura directa ni ejecución anónima.
El outbox no concede la lectura del mensaje a authenticated. Una comunicación final
previa o incierta no se reescribe ni se vuelve a enviar.

La Edge reclama mediante `qms_mail_claim_batch_v4` y proyecta el snapshot opcional
`correo: {subject, body}`. Sin él conserva los mensajes históricos. Con él utiliza
el texto aprobado. Desde Edge v15 solo el acuse añade el enlace privado; el final
entrega el informe físico y conserva el cuerpo aprobado sin ese añadido.
`qms_mail_authorize_v2` conserva la regla de avisos internos y comprueba aparte
destinatario/lease/estado/publicación para correos ciudadanos. El máximo reclamado
es dos para que los mensajes Unicode completos quepan en el sobre firmado de
64 KiB de Apps Script; un límite solicitado cero sigue sin reservar correos.
El contrato de adjunto físico, ACK y diario del emisor no cambia. Apps Script y
sus permisos ya autorizados no necesitan otra actualización.

Verificación: 101 comprobaciones PostgreSQL aisladas y 46 comprobaciones de navegador
a 1536/390/320 px (persistencia, Word real, PDF, edición, confirmación y reintento con
RPC/subidas ficticios); 89/89 pruebas Node focalizadas y 55 checks del bundle Edge.
TypeScript, lint, build, estructura y capa visual correctos. La suite general pasó
867/872; conserva los cinco fallos anteriores de informe/paginación documentados
el 9 noviembre, sin nuevas fallas en los contratos del correo. Evidencia de activación y seguridad en
`supabase/backups/quejas_correo_activation_20261110.json`; QA local en
`.performance/correo-editable-20261109/`. Cero correos o expedientes reales creados
para las pruebas. DB/emisor activos; interfaz web local, sin publicar Vercel.

### Composición inicial del 9 noviembre, sustituida por el editor anterior

`QuejaRespuestaClienteModal.tsx` muestra oficio, selector del expediente, subida y
Visualizar en la franja superior. Debajo presenta la plantilla institucional del
correo mediante una vista de lectura, con destinatario, asunto, folio y oficio.
Se retiran la hoja editable repetida y las dos leyendas informativas superiores.
La vista previa no emite ni consulta una capacidad privada; el enlace real se
incorpora al enviar. La plantilla corresponde al correo final con seguimiento
vigente; su asunto y párrafos se comparan con el constructor real del emisor.

El selector ofrece el Word únicamente si hay un informe guardado. Se exporta esa
versión, sin generar otra plantilla ni modificar el informe en este paso. También
permite seleccionar un archivo institucional o subir uno nuevo, incluido un PDF
firmado. Visualizar abre el informe guardado en lectura o reutiliza el visor de
adjuntos para el archivo seleccionado. No se escribe ni publica por visualizar.

Guardar borrador y publicar conservan revisión del expediente, versión del borrador,
guards de visita y confirmación final. Los borradores previos conservan su respuesta
pública. Un error mantiene selección y oficio; un archivo ya subido no se vuelve
a subir al reintentar la publicación. No se modifican DB, Edge o Apps Script.

Verificación local: **50/50** pruebas de composición, publicación, concurrencia y
contenido del correo; **41** comprobaciones sintéticas de navegador a 1536, 390 y
320 px, con exportación Word real y RPC/subidas ficticios. Se actualiza el visitante
del harness para la ranura `request`; la prueba de dos visitas usa la decisión de
procedencia vigente en lugar del antiguo botón Resolver de Calidad. No se quitan
las comprobaciones de conservación de borrador, loading y revisión. Evidencia en
`.performance/panel-reference-20261109/response-*`. Cambios locales, sin publicar.

### Ajuste posterior del 4 de noviembre: acciones directas e informe

La revisión se realiza sobre la propuesta que ya muestra el expediente. Se retiró
el modal duplicado y el botón Revisar resolución: Devolver a investigación y Aprobar
y continuar actúan desde el panel. Solo la devolución abre un formulario de motivo,
sin repetir la propuesta. Revisión/Resuelto usan ciclo horizontal y estado/plazo
en el encabezado; la derecha conserva responsable y acciones, sin el resumen repetido.

La respuesta ahora abre la hoja WYSIWYG del informe, compartida con Generar expediente
en `QuejaInformeHoja.tsx`. No se redacta el correo en un textarea. El correo mantiene
su plantilla institucional; el selector ofrece el Word del informe editado o un
archivo existente/nuevo (PDF firmado incluido). No se cambia No Procede.

Guardar borrador conserva una versión del informe con la API existente, genera/sube
su Word si se elige esa opción y guarda la referencia del documento. Esas operaciones
previas no son una transacción distribuida: un fallo posterior conserva el informe
ya guardado y muestra el error. Publicar confirma el documento exacto y usa la misma
transacción CAS final. Los textos anteriores de respuesta/borrador se preservan;
los nuevos usan una comunicación breve que remite al oficio, sin copiar notas internas.
Si se elige un archivo firmado, se envían sus bytes originales; editar la hoja no
modifica ese archivo. Una edición posterior al Word generado vuelve a seleccionar
el informe actual en esa misma sesión. Reabrir conserva la referencia guardada y
permite elegir explícitamente el Word actual para reemplazarla antes de publicar.

`integration/apps-script/quejas-mail/Codigo.gs` incorpora adjunto físico opt-in con
`QMS_MAIL_ATTACH_OFFICIAL_DOCUMENTS`. El permiso nuevo es `drive.readonly`, autorizado
por el usuario. La función de activación solo comprueba Drive y habilita el flag;
no reclama ni envía correos. La actualización remota conserva el doPost anterior,
sin activar el despertador local de correo ni reinstalar el activador.

La Edge acepta `includeOfficialDocument` únicamente dentro del sobre HMAC. Comprueba
evento final, claim/lease vigente y estado terminal, y obtiene exclusivamente el
adjunto publicado de ese expediente. No recibe IDs de Drive elegidos por el cliente.
Los emisores anteriores conservan su respuesta sin campos adicionales. Apps Script
valida ID/nombre/MIME/tamaño, descarga el archivo privado antes de registrar attempting
y lo pasa a MailApp. Un fallo de Drive permite reintentar sin marcar envío incierto;
después de MailApp se mantiene el diario y la deduplicación anteriores. No se cambia
el hash de eventos existentes ni se reenvían históricos para agregarles el adjunto.

Estado: interfaz local y ampliación de Edge publicada por el panel oficial del proyecto,
al fallar la reconexión del MCP. Código y manifiesto guardados en el emisor activo;
la comprobación final de la autorización de Google se registra al finalizar.

QA de este ajuste: suite general 829/829 y prueba adicional de lease/tipo/reapertura
32/32 en la selección Edge. Chrome sintético 29 comprobaciones a 1600/390/320 px,
incluida lectura de los bytes DOCX generados, recuperación, conflicto de informe,
selección de PDF, confirmación y una sola publicación. TypeScript, lint, build,
estructura y capa visual correctos. Cero correos o expedientes reales creados para QA.

Las secciones siguientes documentan la primera composición de esta misma entrega;
el ajuste anterior sustituye su modal de aprobación y textarea de respuesta.

- `app/quejas/components/QuejaDetalleModal.tsx`: propuesta una sola vez, de lectura,
  sin campos públicos. Aprobar y continuar pasa a Resuelto y abre
  `QuejaRespuestaClienteModal.tsx`. Devolver exige motivo y vuelve a investigación.
- `QuejaRespuestaClienteModal.tsx`: captura revisión del expediente y versión del
  borrador al abrir. Guardar conserva Resuelto; publicar requiere confirmación y
  finaliza atómicamente. Cerrar con cambios permite descartarlos o volver a guardarlos.
- `QuejaPublicacionPanel.tsx`: respuesta (10.000 caracteres), oficio, documento
  existente/nuevo y resolución aprobada en acordeón cerrado. PDF primero, sin restringir
  los formatos institucionales admitidos por Drive. No se publica la propuesta interna.
- `hooks/useQuejaAttachmentActions.ts`: devuelve el registro confirmado de la subida
  para seleccionarlo sin esperar un refresco de la lista.
- `lib/queries/useQuejaRespuestaCliente.ts`: lectura RLS de borrador, última aprobación
  y publicación. Un error bloquea la edición; no equivale a ausencia de datos.
- `lib/services/quejaWorkflowService.ts`: tres RPC versionados sin rebase ni reintentos
  silenciosos. `quejaExpedienteModel.ts` ofrece la respuesta directamente en Resuelto.
- `components/Modal.tsx`: alto documental `content` opcional para revisión breve;
  los demás editores conservan `fill` y la altura previa.

En Investigación → Pendiente de Revisión GC → Resuelto → Finalizado.
La devolución mantiene el mismo run, calendario y vencimiento de investigación;
no reinicia quince días. Aprobar no fija cierre, publica ni encola correo final.
La propuesta vigente sigue en `quejas.resolucion`; los snapshots históricos son
inmutables, tomados por DB con usuario, fecha, decisión y motivo de devolución.
La notificación al responsable reutiliza el motor vigente.

## Persistencia, permisos y concurrencia

Migración `20261104202558_quejas_revision_y_respuesta_separadas.sql`:

- `queja_gc_revisiones`: historial append-only, clave expediente/revisión origen.
- `queja_response_drafts`: respuesta, oficio, adjunto, autor, fecha y versión CAS
  propia. Guardar no cambia la revisión del expediente ni su estado.
- Puentes públicos SECURITY INVOKER `qms_review_resolution`, `qms_save_response_draft`
  y `qms_publish_approved_response`. Implementación privilegiada fuera de PostgREST
  en `qms_private`, con `search_path` vacío. Verifica Auth/perfil activo/rol y escritura
  de Quejas antes de bloquear el expediente. Sin impersonación service role.
- SELECT con RLS para admin o Calidad con lectura de Quejas. Sin escrituras directas
  de cliente, anónimo o service role en las tablas. Los helpers privados no son
  ejecutables por el cliente; solo las tres operaciones de entrada están concedidas.
- Publicar valida estado, revisión, versión del borrador, pertenencia/metadatos del
  oficio y ausencia de reserva de eliminación. Inserta publicación, transiciona y
  audita en una transacción. Nunca hace UPSERT de la respuesta publicada.

Un borrador no reserva el archivo ni impide borrarlo: se valida otra vez al publicar.
Un conflicto exige comparar/actualizar explícitamente, sin obtener otra revisión
para forzar la escritura. La UI bloquea doble envío y respuestas de otra visita/sesión.

## Compatibilidad

No Procede y el cliente publicado anterior conservan RPC y publicación conjunta.
La excepción de aprobar sin oficio exige un marcador creado en la misma transacción,
para la revisión y run exactos; un cambio de estado directo no lo obtiene.

La cola final se crea al publicar, una vez por expediente/evento. El expediente queda
Finalizado, pero el sobre de `queja_mail_outbox` conserva `estado=Resuelto`, reconocido
por el emisor vigente. No requiere cambiar Edge/Apps Script. No se ejecutó el poll
ni se enviaron correos reales en QA. Encolado no acredita entrega al buzón.

Una publicación existente se muestra de lectura y permite cerrar sin reenviar.
Tras reapertura se conserva la publicación histórica: no se implementan versiones
públicas nuevas ni reemplazo del oficio anterior. El seguimiento mantiene la restricción
vigente del run al que pertenece la publicación.

## Evidencia

- PostgreSQL 18 desechable, SQL real/datos ficticios: 71 comprobaciones. Aprobación,
  devolución/motivo/plazo/propuesta, RLS/grants/permisos, carreras CAS, borradores,
  publicación atómica, proyección pública y compatibilidad No Procede/históricos.
  Ejecutar `node scripts/test-quejas-quality-flow-db.mjs`; no lee `.env` ni usa Supabase.
- Node: 825/825 en la suite general, incluida la comprobación del alto documental.
  Servicios, lectura, validación y guards de visita tienen regresiones específicas.
- Chrome sintético: 27 comprobaciones a 1440, 390 y 320 px. Revisión sin campos,
  motivo obligatorio, avance, recuperación, subida seleccionada, confirmación,
  cancelación, error que conserva texto, doble clic y publicación de lectura.
  Cero escrituras/correos reales; no sustituye aceptación con sesión real.
- TypeScript, lint, build, estructura y capa visual correctos. Tres rechazos de
  identidad vacía comprobados en los RPC remotos con ROLLBACK y sin efectos de negocio.

Preflight efectivo sin datos de negocio:
`supabase/backups/quejas_quality_flow_preflight_20261104.json`.
No se crearon quejas, consumieron folios ni cambiaron expedientes reales para probar.
