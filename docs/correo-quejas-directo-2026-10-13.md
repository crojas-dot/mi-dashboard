# Correo de Quejas: Supabase y Apps Script

## Despertador local del 3 noviembre, pendiente de activación

Se prepara un POST HMAC vacío después de finalizar el formulario para despertar
al mismo emisor sin esperar el activador de cinco minutos. No envía contenido ni
reactiva el worker legacy. Requiere nuevo endpoint/configuración y publicación
explícita; el circuito remoto documentado sigue sin cambios. Ver
[contrato, configuración y límites](quejas-claridad-y-acuse-2026-11-03.md).

## Política vigente del 20 octubre: dos correos ciudadanos

Se envían `recibido` y `final`: No Procede o resolución de Calidad. El avance de
investigación se consulta por el enlace privado; los avisos internos conservan sus
hitos y destinatarios. `20261020163142` se aplicó en DB, preservando los 23 `sent`
existentes y sin reservas activas en el corte. Edge y Apps Script se actualizaron;
el cierre de verificación está en [la entrega del 20 octubre](quejas-dos-correos-y-reintentos-2026-10-20.md).

Investigación queda como historial. Solo sus `pending/retry` se retiran con
`skipped/citizen_notice_retired`; `sent/uncertain/failed/leased`, snapshots y diario
se conservan. Claims legacy/v2/v3 no entregan ese tipo ni dejan que bloquee el final.
Un recibido incierto sí mantiene su bloqueo. ACK y autorización interna no amplían
su alcance. Las evidencias siguientes conservan el contrato de su fecha.

Verificación del ajuste: **795/795** Node, **107/107** públicas, **137/137** PostgreSQL
aislado (76 previas + 61 nuevas), **41** checks de bundle Edge, lint/build/estructura/
visual correctos. El arreglo del cliente web para reintentos sigue **local, sin publicar**;
no confundir su prueba con la activación del servicio de correo independiente.

## Revisión del 19 octubre: registro, envío y presentación

Se verificó el caso reportado con lectura de DB/outbox y health HMAC, sin claim,
ACK, poll manual, quejas ni correos de prueba. Registro finalizado; recibido con un
intento, `sent`, sin error seguro y destinatario coincidente con el del formulario.
Google aceptó el aviso unos 95 segundos después del alta. Gmail institucional,
incluyendo spam/papelera y seleccionando resultados de **correo** en vez de
conversaciones, lo encontró en **Recibidos**. No se reenvió ni modificó el mensaje.
Esta evidencia verifica ese caso; no garantiza entregas futuras.

El activador existente procesa cada cinco minutos; el formulario no espera ese
envío. La pantalla confirma registro/adjuntos, nunca entrega de correo. **El seguimiento
se activó el 19 octubre**, después de coordinar DB, web, Edge y emisor. Los nuevos
avisos ciudadanos con snapshot de seguimiento incluyen el enlace privado; los
históricos sin snapshot conservan su mensaje. No reconstruir ni reenviar eventos
históricos para añadir una URL.

Refinamiento **guardado en el emisor activo el 19 octubre**: `qmsMailHtml_` conserva 760 px, encabezado blanco compacto,
marca azul institucional, folio discreto, cuerpo legible y botón condicional. Solo
cambia HTML; asunto, cuerpo canónico, snapshot, HMAC, huella, diario, claims, ACK y
activador conservan sus contratos. El recibo también se compactó y aclara la espera.

QA de correo (16 octubre): **201/201** y 18 capturas en 1040/390/320 px para tres hitos
con/sin enlace, texto largo y escape HTML; `.performance/quejas-oct16/mail-visual/`.
Recibo actualizado el 19: **142/142** en cuatro tamaños y tres estados;
`.performance/receipt-20261019/`. Node completo **719/719**, TypeScript, lint
focalizado, build, estructura y capa visual correctos en esa revisión previa.
La preparación final pasó **725/725** Node, **162/162** de selección de
seguimiento/correo/publicación, **208/208** de PostgreSQL aislado y **50**
comprobaciones sintéticas del adaptador Edge. No sustituyen la recepción real del
correo con enlace ni la consulta de un expediente por su capacidad.

### Activación coordinada del 19 octubre

- Supabase `fykhrrpeoehwqznccmfp`: migración `20261015223440` aplicada/registrada;
  cortes de publicación y workflow aplicados tras el cliente compatible.
  `publication_cut_active=true` y `legacy_client_can_execute=false`.
- Web promovida a [producción](https://mi-dashboard-iota.vercel.app), despliegue
  `dpl_2kk83rkgKrip1MwK8NNbMcw2d2MF`. Seis checks HTTP verificaron página,
  guards y rechazo de POST sin verificación; WAF conserva 90 solicitudes/IP/600 s
  y añade consulta/descarga de seguimiento.
- Edge `quejas-mail-queue` actualizada, con firma dedicada, origen canónico y
  seguimiento habilitado. Health firmado respondió 200, sin claim ni ACK manual.
- `Codigo.gs` remoto guardado y comparado con la fuente local;
  `QMS_PUBLIC_TRACKING_ORIGIN` configurado y `QMS_MAIL_ENABLED=true` guardado.
  Se conservó el activador de cinco minutos, sin ejecutar poll manual,
  reinstalarlo ni publicar de nuevo el `/exec` legacy.

La ejecución automática `qmsMailPoll` del 19 octubre a las 15:49:20, hora Costa
Rica, terminó **Completada** en 4,518 s. La lectura posterior de metadatos confirmó
nuevos avisos de recibido/investigación `sent` con snapshot `public_tracking` de
dos campos válido, sin exponer destinatarios/nonces ni emitir capacidades para
probar. Esto verifica el procesamiento automático, no el contenido visto en inbox.

No se crearon quejas ni correos de prueba, ni se reenviaron eventos anteriores.
La recepción real de un **nuevo** correo con botón y la apertura de ese trámite
siguen pendientes de aceptación; `sent` no certifica inbox. La comprobación
adicional que habría emitido una capacidad sobre un expediente real fue rechazada
por revisión automática y no se ejecutó. Ver [contrato de seguimiento](quejas-seguimiento-y-publicacion-2026-10-16.md)
y [evidencia sanitizada](../supabase/backups/public_tracking_activation_20261019.json).

Estado inicial comprobado: **13 de octubre de 2026, activo**. Vercel no participa en este
circuito de correo. En aquella entrega del 13 no se publicó una versión del frontend;
la web compatible sí se publicó en la activación del 19 descrita arriba.

## Recorrido operativo

1. La transacción de alta o cambio de estado genera el aviso en `queja_mail_outbox`.
   Desde el 20 octubre, el trigger DB decide recibido o resultado final y congela
   correo/folio/estado/oficio de ese momento. No acepta un destinatario desde HTTP.
2. Un único activador de Apps Script ejecuta `qmsMailPoll` cada cinco minutos.
3. El script pide un lote a `quejas-mail-queue`, Edge Function de Supabase que autentica
   con HMAC y llama al claim fijo de correo: v3 con seguimiento activo desde el 19,
   v2 compatible sin seguimiento. Reserva hasta cinco filas y
   entrega únicamente mensajes construidos desde snapshots DB.
4. Apps Script valida firma, correlación, lease y lote completo. Su diario privado
   bloquea duplicados; MailApp envía con nombre **QMS ECA** y la cuenta institucional.
5. El script confirma el resultado por HMAC a la misma función. `qms_mail_complete`
   exige ID/token/lease vigentes; solo entonces DB marca `sent`, `retry`, `uncertain`
   o `failed`. Las fases se entregan en orden por expediente.

La Edge Function es un adaptador de acceso, no un proveedor de correo ni un segundo
motor de reglas. En la activación inicial del 13 se conservaron la DB y sus RPC
sin cambiar esquema/RLS/grants; la ampliación del 19 sí aplicó la migración y cortes citados.
El formulario no espera al envío y no incorpora claves de este circuito.

## Fronteras de seguridad

- Apps Script guarda solo el HMAC específico del mailer, URL exacta del endpoint e ID
  del diario. **No guarda service_role, claves secretas Supabase ni acceso SQL general.**
- La credencial privilegiada permanece en Supabase. El adaptador prefiere
  `SUPABASE_SECRET_KEYS.default` vía `apikey`; conserva fallback a service_role para
  proyectos legacy. Nunca envía una clave moderna como JWT en Authorization.
- El endpoint verifica firma SHA-256, propósito, UUID, ventana temporal y contrato
  antes de consultar DB. Body limitado por bytes reales a 8 KiB; upstream/respuesta
  limitados a 64 KiB. Solo POST, sin redirects ni RPC/tabla/correo/asunto libres.
- `verify_jwt=false` corresponde al protocolo de máquina HMAC, no a un endpoint
  sin autenticación. Health también exige firma y no consulta DB ni consume nonces.
- El nonce de claim se conserva en DB; el ACK es un CAS con token/lease y un outcome/
  código permitidos. Una repetición de ACK ya consumido no autoriza reenviar.
- El lote usa lease DB de 600 s, fecha conservadora en receipt, presupuesto de poll
  de 240 s y generación propia. Ningún lock queda retenido durante HTTP, y un finally
  viejo no libera otro poll. No se repiten claims/ACK perdidos a ciegas.
- La hoja usa UUID/hash/estado/fechas; no guarda correo ni contenido. Su acceso general
  quedó **Restringido**, solo propietario. Las políticas Workspace pueden compartir
  una hoja nueva por enlace: el inicializador no garantiza ni cambia esa ACL.

Se mantienen las plantillas azules, HTML escapado y body plain. No se incluyen notas
internas, texto de investigación, archivos ni respuestas IA. El resultado final comunica
estado y oficio; el documento de resolución sigue el procedimiento institucional.

## Fuentes de edición

| Contrato | Fuente |
| --- | --- |
| Eventos, FIFO, nonce, leases, CAS y permisos | `supabase/migrations/20261011044317_quejas_mail_outbox.sql` y DB efectiva |
| Endpoint HMAC, límites y RPC permitidos | `supabase/functions/quejas-mail-queue/index.ts` |
| Validación de snapshot y plantillas canónicas | `supabase/functions/quejas-mail-queue/message.ts` |
| Auth de la función en despliegues CLI | `supabase/config.toml` |
| MailApp, diario, poll, health y activador | `integration/apps-script/quejas-mail/Codigo.gs` |
| Configuración y límites de operación | `docs/seguridad-correos-quejas.md` |

El cliente Node legacy reutiliza las plantillas canónicas y requiere transporte
`legacy` explícito para funcionar. Su flag local permanece apagado. El despliegue web
`/exec` anterior de Apps Script fue **archivado**; ya no se necesita para el poll.
El procesador Drive es otro proyecto/endpoint y no se modificó.

## Configuración aplicada

Supabase Edge: `QUEJAS_MAIL_SIGNING_SECRET` configurado; `QUEJAS_MAIL_QUEUE_ENABLED=true`.
Apps Script: `QMS_MAIL_SECRET` coincide, `QMS_MAIL_ENABLED=true`,
`QMS_MAIL_TRANSPORT=supabase`, `QMS_MAIL_QUEUE_URL` apunta al endpoint exacto de este
proyecto y el ID del diario está configurado. Valores secretos/IDs privados no se
documentan ni se guardan en Git. `QMS_MAIL_WORKER_URL` no se usa en modo directo.

Desde el 19: web y Edge comparten `PUBLIC_TRACKING_SIGNING_SECRET`,
`PUBLIC_TRACKING_ORIGIN` canónico y `PUBLIC_TRACKING_ENABLED=true`. Apps Script
solo incorpora `QMS_PUBLIC_TRACKING_ORIGIN`; no recibe la firma dedicada. La DB
congela expediente/nonce para nuevos eventos; el emisor valida el enlace recibido.
El acceso autoriza al portador y vence 30 días naturales después del primer
No Procede/Finalizado; no verifica identidad ni se renueva por consultar/reabrir.

La activación y los correos automáticos a las direcciones registradas fueron autorizados
expresamente. Se revisó el aviso pendiente inicial del operador; no se creó una queja
ficticia ni se renumeraron expedientes para probar el correo. No se vació ni reconstruyó
la cola. Los avisos que aparecieron durante la prueba respetaron el mismo flujo.

## Evidencia del 13 octubre y límites de operación

- Suite completa de aquella entrega: **517/517**. Selección final de correo: **62/62**, tras
  añadir un guard test que comprueba que activar el modo directo no reactiva Vercel, incluyendo
  interacción real entre los dos códigos con transportes/SDK ficticios, límites,
  claves modernas, fraude de firma, nonce, ACK falso, presupuesto y carreras.
- TypeScript, lint de fuentes cambiadas, auditor de estructura y build de producción
  comprobados. Compilar no publicó el frontend.
- Health real Apps Script → Supabase: HMAC/correlación correctos, inicialmente apagado.
- Primera ejecución: tres avisos aceptados por MailApp y confirmados por DB; incluyeron
  recibido, investigación y final. Todos destinados al propio operador.
- Un único activador `qmsMailPoll`, basado en tiempo, **Cada 5 minutos**. Se observó
  después una ejecución automática y otro aviso confirmado sin intervención de Codex.
- Conteo posterior: cinco avisos `sent`, cero pending/retry/leased/uncertain/failed.
  Las ejecuciones automáticas completaron también el ciclo recibido/investigación/final
  de un registro del operador. Son conteos fechados, no una garantía para futuros lotes.
- DB se consultó por metadatos/conteos/estados; no se expusieron destinatarios ni
  contenido en evidencias. Capturas/metadata locales están en `.performance/quejas-oct13/`.

`sent` significa aceptado por MailApp y confirmado en DB, no leído ni necesariamente
entregado en inbox. MailApp no ofrece exactly-once: un corte tras envío y antes de ACK
deja incertidumbre, conservando el diario y sin reenvío automático. No hay conciliación
manual integrada en UI. En el contrato del 13, el límite de tres avisos era por toda la vida del caso; reapertura
no duplica investigación/final. En este snapshot del 13 octubre faltaban avisos QMS;
se activaron el 14 mediante el mismo poll, sin pg_cron: [contrato y evidencia](avisos-internos-quejas-2026-10-14.md).

El intervalo no garantiza precisión de reloj. La cuota disponible es la compartida por
los scripts de la cuenta; no equivale a correo ilimitado. Para detener envíos, apagar
primero `QMS_MAIL_ENABLED` y retirar el activador; esperar ACKs vigentes antes de cerrar
la cola/rotar el secreto para evitar incertidumbre innecesaria.

Referencias de plataforma: [auth de Edge](https://supabase.com/docs/guides/functions/auth),
[entorno de Edge](https://supabase.com/docs/guides/functions/secrets) y
[claves modernas](https://supabase.com/docs/guides/getting-started/api-keys).

## Ajuste visual — 14 de octubre

La plantilla HTML `qmsMailHtml_` del proyecto activo se guardó y se comprobó tras
recargar el editor. La tarjeta pasa de 600 a 760 px máximos, se adapta al ancho
disponible y reduce espacios verticales; conserva el azul institucional, el folio
y el cuerpo canónico. Los dos avisos del pie se unifican. No hay recursos remotos.

Solo cambió esa función en Apps Script: el resto del código se comparó sin cambios,
sin ejecutar el poll, mandar un correo de prueba, reinstalar el activador ni
publicar Vercel. El activador existente utiliza el código guardado para próximos
avisos; correos ya recibidos conservan su diseño anterior.

QA del HTML real con mensajes sintéticos: tres tipos, escritorio 1040×620 y móvil
390×844, sin desbordamiento horizontal ni scroll vertical en esos casos normales.
Incluye texto largo y caracteres HTML escapados: 32 comprobaciones. Esta evidencia
es una renderización local; el espacio disponible y el scroll final dependen también
del cliente de correo, el zoom y el contenido. Evidencia local en
`.performance/quejas-oct14/mail-visual/`.
