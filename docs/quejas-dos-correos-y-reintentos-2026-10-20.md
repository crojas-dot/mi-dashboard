# Quejas: dos correos ciudadanos y recuperación del envío

Revisión: 20 de octubre de 2026. La política de correo está activa en DB, Edge y
Apps Script. La corrección web está verificada en local, **sin publicar en Vercel**.

## Contrato vigente de correo

El interesado recibe `recibido` y `final`: recepción y No Procede o resolución
aprobada por Calidad, con respuesta/oficio publicados según el contrato de
seguimiento. El enlace privado permite consultar los cambios intermedios sin
otro correo ciudadano. Los siete avisos internos conservan sus hitos y permisos.

La migración `20261020163142_quejas_two_citizen_mails` cambia el productor y los
claims legacy/v2; v3 sigue delegando en v2. Retira solo investigaciones
`pending`/`retry` mediante `skipped/citizen_notice_retired`. Conserva las enviadas,
inciertas, fallidas o reservadas y sus snapshots. El tipo histórico `investigacion`
y su índice permanecen: los lectores internos lo admiten, los nuevos mensajes y
transportes lo rechazan. Una investigación histórica no bloquea el resultado
final; una recepción sin confirmar sí. Reabrir no duplica estos correos vitalicios.

El corte pausó el emisor, exigió cero reservas activas y verificó los cuerpos
efectivos antes de aplicar la migración en transacción y registrar su versión.
Después se comprobaron 23 filas históricas `sent` conservadas, cero reservas y
las mismas ACL, RLS y policies. Autorización, ACK, snapshot de seguimiento y
elegibilidad interna conservaron sus cuerpos. Se guardó Apps Script, se publicó
solo `quejas-mail-queue` y se reactivó `QMS_MAIL_ENABLED=true`, sin reinstalar el
activador ni ejecutar un poll de prueba. La fuente Edge recargada coincide con
el bundle probado; JWT legacy sigue desactivado para su protocolo HMAC y la salud
firmada devuelve `enabled=true`.

Evidencia sin destinatarios, claves ni contenido:
[activación](../supabase/backups/two_citizen_mail_activation_20261020.json).
No hubo alta, adjunto ni correo real de prueba. La salud no demuestra entrega;
`sent` conserva el significado de aceptación registrada por el emisor.

## Rechazo después del alta y folios duplicados

La lectura remota encontró tres envíos recientes de 1.903 caracteres, dentro
del límite de 10.000, sin finalizar. No se modificaron ni fusionaron esas quejas.
El correo se encola al crear; la campana de recepción pública, al finalizar.
Una creación seguida de un fallo de respuesta puede producir correo sin campana.

Se reprodujo una ruta concreta: el RPC hacía commit, pero emitir la capacidad
con `created_at` de DB adelantado al reloj Node devolvía 400. El cliente trataba
todo 400/422 como validación previa y descartaba el `submissionId`; reintentar
podía crear otro folio. Esto demuestra una causa posible con los síntomas
observados; no hay una traza del reloj de la petición original para atribuirle
esa causa exacta.

La API valida los identificadores y el recibo interno antes de firmar. Un recibo
incorrecto produce 503, no error de campo. Calcula la emisión con el reloj Node,
limitando un `created_at` futuro al instante actual. El verificador sigue
rechazando `iat` futuros y conserva el TTL de 30 minutos. Una recuperación antigua
revalida BotID, formulario y hash antes de emitir capacidad; no repite el alta.

El cliente conserva ID, cuerpo y `uploadId` ante 400/422 genérico, respuesta
incompleta, fallo de red o confirmación incierta. Solo un código cerrado de campo
permite corregir un rechazo previo confirmado; una operación incierta nunca
libera su identidad por un error posterior. Recargar recupera el intento pendiente.
El mensaje pide reintentar el mismo envío sin culpar al texto.

No se cambió el motor de audio: finalizar permite generar la campana que faltaba.
El sonido conserva preferencias, coordinación entre pestañas y requisito de
gesto/autoplay. No se promete reproducción universal ni avisos retroactivos para
los registros inconclusos.

## Verificación y límites

- Node completo: **795/795**; API/cliente/validación pública: **107/107**. Incluye
  DB adelantada 30 segundos, recibo inválido, descripción de 10.000 caracteres,
  respuesta perdida, recarga, doble clic y preservación de IDs de adjuntos.
- PostgreSQL aislado: **137/137** (76 anteriores y 61 nuevas), con historial,
  reservas, claims legacy/v2/v3, ambos finales, reapertura, seguimiento, ACL y
  avisos internos. Clúster temporal cerrado.
- Bundle Edge: **41/41**, HMAC/salud, ambos mensajes ciudadanos, siete internos
  y rechazo del evento retirado. Sin buzones ni reservas reales.
- Navegador con página/hooks reales y backend ficticio: primer intento crea y
  responde 400; segundo recupera el mismo ID/folio. Dos intentos, un registro y
  una finalización con 10.000 caracteres. Correo/campana son contadores simulados.
- Lint, TypeScript dentro del build, build, estructura y capa visual correctos.

Evidencia local: `.performance/public-retry-20261020/` y
`.performance/two-client-mails-20261020/`. No certifica entrega real ni audio en
todos los dispositivos. La web de producción conserva el despliegue del 19 de
octubre; publicar este arreglo exige autorización explícita del propietario.
