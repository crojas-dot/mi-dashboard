# Correo automático de Quejas mediante Apps Script

Contrato vigente: **20 de octubre de 2026, dos correos ciudadanos**.
Migración `20261020163142` aplicada; se conservaron los 23 registros `sent` existentes
y no había reservas activas en el corte. Edge y Apps Script se actualizaron para
rechazar el tipo ciudadano retirado. La verificación final y el arreglo web de
reintentos —local, sin publicar— se registran en
[la entrega del 20 octubre](quejas-dos-correos-y-reintentos-2026-10-20.md).

Activación inicial: **13 de octubre de 2026**. La DB crea los eventos y Apps Script
envía/confirma mediante una Edge Function de Supabase, **sin Vercel en el correo**.
Diario privado, HMAC y un activador de cinco minutos comprobados. Envíos al operador
confirmados por MailApp/DB; también se observó una ejecución automática.
Ver [estado operativo y fuentes](correo-quejas-directo-2026-10-13.md).

## Dos comunicaciones ciudadanas por expediente

- `recibido`: confirmación de alta y folio, al correo registrado.
- `final`: resolución de Calidad o no procedencia. `Finalizado` y reapertura no
  generan otro correo ciudadano. El avance intermedio se consulta mediante el enlace privado.

`investigacion` conserva su ID y sus filas históricas, pero no se genera ni reclama
para entregar. La migración omite solo sus `pending/retry` con
`skipped/citizen_notice_retired`; conserva `sent/uncertain/failed/leased`, snapshots
y diario. Este retiro administrativo no se habilita como resultado de ACK.

Los eventos los crea la DB junto a las operaciones de negocio. La cola conserva el
destinatario y los datos de ese momento: no permite elegir correo desde un body HTTP.
No se envían notas internas, investigación, observaciones, evidencia ni respuestas IA.
La comunicación final informa folio, estado y oficio; el enlace permite consultar
la respuesta y el oficio publicados por Calidad. Solo se entrega contenido público
explícito; nunca se reutilizan notas internas como respuesta al interesado.

La activación inicial del 13 octubre empezó con eventos futuros. El ajuste del 20
no hace backfill ni reenvía correos anteriores; tampoco reclasifica el historial.

## Flujo y límites

Apps Script consulta `quejas-mail-queue` de Supabase cada cinco minutos. La función
valida HMAC SHA-256, propósito, tamaño, UUID y fecha antes de acceder a DB. Solo ofrece
claim/authorize/ACK/health; no acepta correo, asunto, contenido, tabla o RPC libres. Claim reserva
hasta cinco snapshots con lease de 600 s y nonce en DB; ACK exige ID/token/lease vigentes.
Apps Script valida firma/correlación/lote completo, envía localmente con MailApp y confirma
por la misma función. No hay HTTP de vuelta a `/exec` ni llamada a Vercel.

Cada correo va a un único destinatario. No hay mailer público de correo/asunto libre,
ni credenciales Supabase en Apps Script. El secreto de correo es independiente de
service role, de BotID y de las capacidades del formulario. Cambiar/removerlo impide
operaciones posteriores sin reabrir accesos legacy.

HMAC autentica; HTTPS cifra. Apps Script acepta solamente la URL exacta del endpoint
del proyecto Supabase, sin redirects ni credenciales generales de la DB. La Edge Function
mantiene esas credenciales en Supabase y expone solo las operaciones de cola. El despliegue
HTTP anterior del mailer fue archivado; el conversor de Drive conserva su otro endpoint.

Google publica para Workspace **1.500 destinatarios diarios por usuario**, 2.000 dentro
del dominio y seis minutos por ejecución. Estas cuotas se comparten con otros scripts
de la misma cuenta y pueden variar; una edición Standard no significa envío ilimitado.
La cuota también se consume por avisos internos y otros scripts; dos correos
ciudadanos no equivalen a una capacidad fija de expedientes por día.
Consultar [cuotas oficiales](https://developers.google.com/apps-script/guides/services/quotas)
y [MailApp.getRemainingDailyQuota](https://developers.google.com/apps-script/reference/mail/mail-app).

El intervalo de cinco minutos supone latencia de notificación deliberada; no retrasa
la respuesta del formulario ni su subida de archivos. El trigger no tiene precisión
de reloj ni constituye un SLA de entrega. El envío queda fuera del request ciudadano.

## Idempotencia honesta

Una hoja **privada** `_qms_mail_delivery` guarda UUID, hash, estado y timestamps, nunca
correo ni contenido. LockService serializa la decisión; el script escribe `attempting`
antes de llamar MailApp, luego `sent` tras confirmar. El mismo evento enviado otra vez
devuelve `already_sent` si conserva exactamente el mismo mensaje.

MailApp no ofrece clave idempotente ni una transacción con PostgreSQL. Un corte tras
enviar y antes de confirmar puede dejar `attempting`/`uncertain`. Los timeouts, recibos
inválidos y leases vencidos se ponen en revisión manual; **no se reenvían a ciegas**.
Esto prioriza evitar duplicados y puede requerir reconciliación manual de un correo
que finalmente no salió. `sent` significa aceptado por MailApp, no leído ni entregado
en la bandeja del destinatario; no hay seguimiento de rebotes instalado.

Solo se reintentan automáticamente rechazos firmados previos al envío: cuota agotada,
lock ocupado, configuración deshabilitada o ledger no disponible. Un fallo de ACK no
se confunde con envío confirmado. No borrar IDs del ledger mientras pueda haber un
evento pendiente/leased/retry/uncertain; conservar el diario o archivar manteniendo
su búsqueda de IDs. Limitar acceso al archivo a propietario y administradores designados.

## Configuración sin secretos en Git

En Supabase Edge (nunca en cliente ni código):

| Variable | Uso |
| --- | --- |
| `QUEJAS_MAIL_QUEUE_ENABLED` | Solo `true` habilita claim/ACK; health firmado también opera apagado |
| `QUEJAS_MAIL_SIGNING_SECRET` | Secreto aleatorio independiente, mínimo 32 bytes |
| `SUPABASE_SECRET_KEYS` / `SUPABASE_SERVICE_ROLE_KEY` | Credenciales automáticas de Edge; preferir clave moderna, nunca copiarlas a Apps Script |

Propiedades privadas del proyecto Apps Script:

| Propiedad | Uso |
| --- | --- |
| `QMS_MAIL_ENABLED` | Activación explícita, solo `true` |
| `QMS_MAIL_SECRET` | Mismo secreto del worker, no mostrar en logs |
| `QMS_MAIL_TRANSPORT` | `supabase` en el circuito activo |
| `QMS_MAIL_QUEUE_URL` | URL exacta de quejas-mail-queue del proyecto |
| `QMS_MAIL_LEDGER_SPREADSHEET_ID` | Hoja privada dedicada al diario |
| `QMS ECA (no requiere propiedad)` | QMS ECA |
| `QMS_MAIL_REPLY_TO` | Buzón de respuesta institucional opcional |

El remitente real es la cuenta que autoriza/ejecuta el deployment MailApp: `name` y
`replyTo` no cambian `From`. Se necesita elegir esa cuenta y verificar quién es el
propietario del script. El propietario eligió un Apps Script nuevo e independiente para los correos. El proyecto
actual de conversión no cambia ni comparte su endpoint/secreto con el mailer.

## Despliegue y operación

Ampliación activa del 14 octubre: [avisos internos](avisos-internos-quejas-2026-10-14.md).
Usan el transporte/diario existentes y UUID por evento/usuario, separados de los dos
eventos ciudadanos. Claim v2 (0–5) procesa avisos aunque no pueda reservar correo;
autorización HMAC antes de enviar comprueba destinatario, lease y vigencia. No hay
texto del expediente ni CC/BCC. No activar backfill histórico ni ampliar destinatarios
con roles simulados. El contrato legacy sigue rechazando los nuevos tipos.

1. Mantener Codigo.gs en el proyecto independiente, dejando intacto el conversor.
2. Elegir la cuenta institucional remitente; autorizar los scopes mínimos de MailApp,
   URL Fetch, diario Sheets y trigger. El mailer independiente no necesita scopes de conversión.
3. Con el secreto configurado y envío apagado, ejecutar `qmsMailInitializeLedger`: crea
   el libro y guarda su ID, o reutiliza el ID existente. Verificar/restringir su ACL;
   la política de Workspace puede permitir al dominio por enlace incluso en Mi unidad.
4. Configurar HMAC en ambos lados y desplegar la función Supabase con claim/ACK apagados.
   Health firmado comprueba conexión sin reservar filas. Revisar metadatos/grants y cola
   pendiente antes de activar; no reactivar el HTTP anterior ni el worker de Vercel.
5. Configurar transporte/URL exacta en Apps Script, activar ambos flags con autorización
   y comprobar envíos controlados. No hace falta desplegar Next para este circuito.
6. Comprobar recibido → final (incluido No Procede), ausencia del correo intermedio,
   duplicados y cuota; comprobar la
   independencia del conversor de PDF/Word. Solo entonces instalar el trigger con
   `qmsMailInstallTrigger` y revisar contadores/cola sin PII.

Apagar primero el flag de Apps Script/retirar su activador impide nuevos envíos; esperar
confirmaciones vigentes antes de cerrar la cola/rotar secretos evita incertidumbre. No
borra trazabilidad. La cola DB
tiene escritura service-only y lectura GC de campos de estado seguros, sujetos a RLS. Ni el navegador ni un admin por API REST
pueden llamar claim/complete directamente.

Los correos ciudadanos se entregan en orden recibido → final. Un recibido incierto
o fallido sigue bloqueando el final hasta revisión del administrador; una investigación
histórica ya no lo bloquea ni se reenvía. Los avisos internos conservan su elegibilidad.
No hay UI de conciliación integrada: consultar estado con campos seguros/RLS y revisar el
buzón/diario antes de resolver una incertidumbre manualmente. La cola inició vacía, sin backfill.

El archivo listo para el proyecto separado es integration/apps-script/quejas-mail/Codigo.gs.
El remitente visible está fijado en QMS ECA; MailApp usa la cuenta propietaria como
dirección real. Se genera HTML con la paleta azul, folio y texto escapado, más body
plaintext. Sin imágenes ni recursos remotos. Campos firmados incluyen folio, que queda
incluido en el hash del diario. El transporte directo está activado y probado en remoto;
el intervalo aproximado y cuotas siguen aplicándose.
Referencia de name/htmlBody/body: https://developers.google.com/apps-script/reference/mail/mail-app.

## Seguimiento privado — ampliación local del 15 octubre

Esta ampliación de código todavía no está activada ni publicada. Solo los snapshots
ciudadanos nuevos que incluyan `public_tracking` reciben un enlace. `null` conserva
exactamente asunto, texto, propiedades y hash de entrega anteriores. Los siete avisos
internos nunca incluyen capacidades ciudadanas. No hay reenvío ni modificación de
mensajes históricos.

Con `PUBLIC_TRACKING_ENABLED=true`, Edge usa `qms_mail_claim_batch_v3`; el flag ausente
o distinto conserva v2. Antes de reclamar valida `PUBLIC_TRACKING_SIGNING_SECRET`
(clave independiente de correo, mínimo 32 bytes) y `PUBLIC_TRACKING_ORIGIN` (origen
HTTPS canónico, sin barra final, ruta ni query). El servidor web usa la misma clave
dedicada. La clave nunca se copia a Apps Script ni al cliente. El enlace contiene una
capacidad HMAC v2 de propósito separado con expediente/nonce, sin fecha fija firmada.
La clave va en el fragmento `#clave=…`, no en la query enviada al servidor. DB controla
la vigencia en cada consulta/descarga: durante la tramitación y hasta 30 días naturales
desde el primer cierre formal (Finalizado o No Procede). No se renueva por consultar,
reabrir o reenviar. Conocer el folio no autoriza. [Contrato de caducidad](quejas-seguimiento-y-publicacion-2026-10-16.md).

Apps Script requiere `QMS_PUBLIC_TRACKING_ORIGIN` con el mismo origen. Rechaza un
dominio/ruta/fragmento distinto antes de escribir en el diario o llamar a MailApp.
El HTML mantiene 760 px, texto escapado y ningún recurso remoto; añade el botón
«Consultar mi trámite» y una indicación de confidencialidad. El cuerpo de texto
también contiene el enlace. El correo final dirige a la respuesta y al oficio
publicados en el seguimiento; no expone notas internas ni amplía scopes de Drive.

El snapshot y el enlace permanecen estables entre claims. El snapshot nuevo
contiene solo `queja_id/nonce`; DB conserva las fechas del
acceso por separado. Firmar un correo reclamado tarde no restablece ese acceso ni
hace fallar el lote por una fecha vencida. El emisor reproduce su mismo hash.
La activación requiere coordinar la página/API compatibles, los flags, la migración y ambas configuraciones
del emisor. No alternar el modo ni rotar clave/origen sobre eventos ya intentados:
puede producir un conflicto de contenido en el diario, que bloquea el reenvío. Una
rotación futura exige versión de clave y conciliación de la cola; no borrar el diario
ni reintentar incertidumbre para ocultar ese conflicto. Mantener apagado el seguimiento
hasta completar esa verificación no afecta el circuito de correo actual.

Pruebas sintéticas: `public-tracking-capability.test.mjs` y
`queja-mail-tracking.test.mjs`, además de las suites de correo existentes. Comprueban
firma/propósito/canonización, snapshot mínimo, compatibilidad de hashes con el paso del tiempo,
configuración inválida antes del claim, allowlist de enlaces y HTML sin inyección.
