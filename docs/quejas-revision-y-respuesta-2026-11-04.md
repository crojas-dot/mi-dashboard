# Revisión GC y respuesta al cliente separadas

Implementación del 4 de noviembre de 2026. Cliente web local, sin publicar en Vercel.
Migración aplicada y grants/RLS/funciones efectivos verificados en ECA-QMS.
Evidencia: `supabase/backups/quejas_quality_flow_activation_20261104.json`.
Los avisos del asesor de seguridad mantienen los mismos cinco tipos y recuentos
previos; esta entrega no añade funciones privilegiadas expuestas al cliente.

## Flujo y puntos de edición

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
