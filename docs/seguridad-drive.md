# Drive: evidencias privadas y registro autorizado

Revisión: **9 de octubre de 2026**. Las versiones SQL usan UTC; algunas se nombran
con fecha del día siguiente. Esta guía distingue código preparado de despliegue verificado.

## Estado

El usuario autorizó la activación. Producción sirve dpl_5RVFbd1Dd4xBtK9HTh4UMGY3St8G; RPC/escritura cliente cerrados por20261009231000 y Storage histórico restringido por20261009230746. El visor conserva iframe inmediato, sin skeleton.

| Pieza | Estado / evidencia |
| --- | --- |
| RPC privado de registro | Aplicados `20261009034402 drive_attachment_server_registry` y `20261009034819 drive_attachment_public_quota_scope` |
| ACL del RPC nuevo | Invoker, `search_path` vacío, solo service role entre los roles API; anon/authenticated sin EXECUTE |
| API privada y cliente | Registro dentro de `/api/drive/upload`, retorno `{adjunto}`; cliente ya no llama RPC con un Drive ID elegido libremente. Desplegado y guard sin sesión 401 confirmado |
| Cierre del bypass anterior | Aplicado en `supabase/migrations/20261009231000_public_forms_drive_access_cutover.sql`; SELECT autenticado conservado |
| Prueba DB local | **148/148**: incluye roles, cuotas, carreras, Storage y corte compuesto atómico/rollback |

La aditiva conservó compatibilidad durante el rollout. El corte aplicado retiró
EXECUTE cliente y todos los privilegios directos de queja_adjuntos, y eliminó la
policy INSERT heredada. Se comprobaron los grants efectivos después de aplicar. La protección del formulario ciudadano
se documenta en [su propia guía](seguridad-formularios-publicos.md).

## Fuentes

- API: `app/api/drive/upload/route.ts`, `download/route.ts` y `delete/route.ts`.
- Transporte cliente: `lib/services/quejaWorkflowService.ts` y `driveClient.ts`; vista y descarga usan la API privada con Bearer QMS. El visor ya no embebe Google Drive ni depende de la cuenta Google del navegador: obtiene bytes autorizados y los presenta mediante Blob URL local revocable. El servidor usa su cuenta de servicio únicamente para consultar, tras autorizar al usuario QMS, la privacidad y la pertenencia física. No se concede acceso anónimo ni se transmite service role.
- Privacidad y pertenencia física: `lib/server/drive.ts`.
- Persistencia: las dos migraciones aditivas anteriores y el corte privado preparado.
- Evidencia sin registros: `supabase/backups/drive_registry_preflight_20261008.json`
  y `drive_registry_evidence_20261008.json`.
- Comprobación de solo lectura: `scripts/verificar-drive-registry.sql`.
- Fixtures locales: `scripts/test-drive-registry-db.mjs`; no carga `.env` ni toca producción.

## Autorización y registro

El usuario envía bytes y `queja_id`, nunca actor, carpeta, folio ni Drive ID para
registrar. El servidor verifica Bearer/perfil activo y resuelve el folio desde DB.
El actor es **usuarios.id**, ligado a Auth por `auth_id`; no usar Auth ID ni
`user_metadata` como sustitutos.

`registrar_adjunto_queja_servidor(p_actor_id,p_queja_id,p_nombre,p_storage_path,p_tamano,p_tipo_mime)`
retorna `public.queja_adjuntos`. El handler debe pasar únicamente el ID que recibió
tras subir el archivo autorizado. Tener EXECUTE service role evita RLS: el guard API
es obligatorio y el RPC vuelve a comprobar perfil activo y autoridad efectiva.

- Admin/calidad activos pueden registrar; colaborador activo solo si sigue siendo
  responsable del expediente. Sin perfil ligado a Auth, con rol desconocido, estado
  inactivo, queja ausente o responsable NULL: 42501.
- `FOR SHARE` del perfil conserva rol/actividad durante la confirmación; `FOR UPDATE`
  de la queja serializa el conteo con las reservas/commits del gateway ciudadano.
- Metadatos privados nuevos: nombre no vacío ≤255 caracteres sin controles ni rutas,
  ID Drive limpio ASCII de 10–200 caracteres, MIME válido y archivo de 1–4 MiB. La API
  limita el nombre a 150 caracteres y conserva su allowlist privada de tipos.
- Máximo diez evidencias y 40 MiB por expediente, contando archivos existentes y
  reservas públicas pendientes. Un expediente histórico que ya supera esos límites
  conserva sus archivos, pero no recibe otro hasta tener cupo.
- Las reservas no contienen `queja_id`: el conteo une `public_form_submissions`
  con `public_form_uploads` por formulario/envío. EXPLAIN remoto de solo lectura
  confirmó uso del índice UNIQUE por queja y la PK por formulario/envío.
- Reconfirmar el mismo ID Drive, actor y metadatos devuelve la misma fila sin duplicar
  el log. Intentar cambiar sus metadatos devuelve 23505; superar cuota devuelve 54000.
- Conserva `nombre`/`nombre_archivo` y `storage_path`/`url_archivo` legacy; el ID privado
  se almacena limpio, sin `drive:`. El gateway público mantiene URI tipada en reserva
  e ID limpio en la tabla de evidencias.

## Privacidad, lectura y eliminación

El servidor comprueba permisos Google paginados, incluida herencia, en raíz,
carpeta del folio, `Analisis` cuando aplica y archivo. Rechaza permiso `anyone` y
falla cerrado cuando no puede verificar. No crea enlaces públicos ni permisos anónimos.

La fila DB no basta para probar pertenencia de un ID: pudo haberse forjado antes del
corte. Antes de leer/eliminar, la API comprueba que el archivo real pertenece a
`raíz / folio / archivo` o `raíz / folio / Analisis / archivo`, sin carpetas ajenas,
archivos en papelera ni múltiples parents. La lectura además exige staff activo o
colaborador responsable. El origen físico debe preservar que evidencias del cliente
solo las elimina admin; no confiar únicamente en un `usuario_id` histórico.

Eliminar envía primero el archivo a la papelera de Drive y exige confirmar el mismo
ID con `trashed=true`; después retira la fila. Si falla la comprobación, conserva
metadatos y reservas. Un 404 genérico de Google no confirma una eliminación: en
unidades compartidas puede ocultar falta de autoridad para borrar permanentemente.
El helper no amplía permisos ni requiere `organizer`; verifica `canTrash` y confirma
la respuesta de `files.update`. Un reintento del mismo archivo ya en papelera es
idempotente. La papelera de Google permite recuperación y su retención habitual es
30 días; esta operación no borra inmediatamente los bytes de forma irreversible. Si se pierde una respuesta del registro, consultar la confirmación antes de
borrar: no compensar un archivo ya registrado. Resultado incierto conserva el archivo para
reconciliación autorizada; si existe reserva pública, conserva también esa cuota. No borrar por antigüedad ni liberar reservas en
masa. Los paths Storage históricos siguen su flujo existente.

La service account conserva los permisos Google concedidos a su identidad; configurar
variables cifradas no reduce por sí solo ese acceso externo. Compartir solo la raíz
privada necesaria con esa cuenta. No escribir claves, capacidades, nombres ciudadanos
ni cuerpos de errores Google en logs, fixtures o documentación.

## Corte y comprobación

1. Confirmar aditivas y API privada nueva desplegada. Validar flujo con fixtures locales
   y guards de producción sin crear evidencias ficticias en expedientes reales.
2. Aplicar el corte privado: revocar EXECUTE del RPC antiguo para PUBLIC/anon/authenticated
   y todos los privilegios de escritura directa de `queja_adjuntos` para esos roles.
   Conservar SELECT authenticated con las policies staff/responsable y acceso servidor.
3. Aplicar también el corte público coordinado: sus helpers antiguos podrían seguir
   insertando IDs arbitrarios mientras permanezcan ejecutables por el cliente.
4. Ejecutar `scripts/verificar-drive-registry.sql` y las comprobaciones públicas.
   Registrar versión aplicada/despliegue; actualizar este estado solo con evidencia.

Las pruebas de cuota/ACL no equivalen a antivirus, benchmark de miles de archivos o
revocación universal de todos los JWT. No hay worker automático de reconciliación Drive.

## Comprobación real de Drive — 9 de octubre de 2026

Prueba aislada con una carpeta temporal propia y bytes sintéticos, sin escrituras de
negocio: subida por el helper real correcta, permisos privados de carpeta/archivo
verificados y lectura sin credenciales rechazada con 403. La cuenta pudo enviar a
papelera (`canTrash=true`), pero no borrar permanentemente (`canDelete=false`).
Un `files.delete` del recurso temporal devolvió 404 mientras `files.get` confirmó
que aún existía; por eso el contrato exige una papelera comprobada. Los dos archivos
temporales y su carpeta quedaron en papelera; no se modificaron ACL ni expedientes.
`tests/drive-trash.test.mjs` reproduce esos límites con fixtures sin credenciales.

## Visor y apertura

El iframe Drive se monta de inmediato y mantiene un marco fijo. Cerrar/cambiar archivo desmonta la visita; pulsar otra vez el mismo archivo no reinicia el iframe. No se genera una URL blob ni se descarga todo el archivo para mostrarlo. Los archivos Storage legacy mantienen URL firmada y reintento propio. La descarga del software sigue su API autorizada.

Mejora local del **16 octubre**: al acercar el puntero, enfocar o pulsar Vista previa,
React anticipa la conexión únicamente al origen `https://drive.google.com`. No
precarga URLs de documentos ni conserva permisos, archivos o respuestas privadas.
El iframe sigue visible e inmediato, con fondo neutral para su documento inicial.
El blanco que Google dibuje dentro de su visor y el tiempo de renderizar allí el
archivo no pueden controlarse desde QMS. No se oculta hasta `onLoad` ni se añade
espera/skeleton. Suite local de visor: 9/9, con transporte sintético; no es un
benchmark de latencia real de Google. Sin cambios en API/ACL ni publicación Vercel.

El cliente Google/JWT servidor se reutiliza únicamente mientras siga la misma configuración; el SDK renueva y agrupa OAuth. No se cachean usuarios, permisos, pertenencia ni ACL: se verifican en cada operación.

## Storage histórico tras la activación

Se retiraron las policies amplias de lectura/subida; SELECT exige expediente/archivo exacto y perfil activo staff o colaborador responsable con permiso mis_quejas. No hay policy INSERT/UPDATE/DELETE cliente. Signed URLs conservan ese control. Los extras ACL de la tabla administrada no fueron revocados por el rol postgres; ver límite de propietario en la guía pública. Bucket privado confirmado. No se modificaron permisos Google ni documentos de negocio.

## Refinamiento del visor (14 de noviembre de 2026)

La vista previa Drive cambia de iframe externo a `fetchDriveBlob` autenticado. Se mantienen los guards de `/api/drive/download` y `assertDriveCaseFile`; los archivos heredados de Supabase Storage se leen con la sesión Auth QMS. Cada apertura crea una URL local temporal que se revoca al cerrar, cambiar de archivo o cambiar de usuario. Los formatos no visualizables ofrecen Descargar. Esto evita el login Google externo, pero no elimina las restricciones de la cuenta de servicio ni hace públicos los archivos. Las pruebas sintéticas no sustituyen una comprobación con cuenta real y documentos reales tras el despliegue.
