# Formulario, evidencias y correo por evento — 10 noviembre

## Estado y alcance

Cliente web **local, sin publicar Vercel**. Formulario y seguimiento usan las
capas existentes; no se abren accesos públicos a DB ni Drive. El mecanismo de
correo está **activo** en DB/Edge y Apps Script v5 desde el 10 noviembre a las
17:03 de Costa Rica. Google confirmó la autorización de ejecución y Drive;
el recibo del despertador verificó HMAC y resultado accepted. El activador periódico
se conserva. No se declara lectura/ubicación en buzón ni latencia garantizada.

## Formulario y evidencias

- `publicQuejaValidation.ts` fija nombre 50, correo 254 y teléfono 25; descripción
  10.000. Cliente/API comparten validación de formato, caracteres y límites.
- `app/q/[token]/page.tsx` usa `setCustomValidity`/`reportValidity` para el aviso
  nativo junto al campo, con foco, scroll y vínculo accesible. Al corregirlo limpia
  el mensaje. No usa toast para errores de campo ni descripciones permanentes.
- `usePublicQuejaForm` no finaliza mientras haya evidencias sin confirmar. Conserva
  folio, submissionId y uploadId al reintentar; solo vuelve a subir pendientes.
  El error seguro del primer archivo fallido también aparece en el pie.
- `subirAdjuntoPublico` recupera un corte de red o HTTP 502/503/504 mediante un único
  reintento automático, con 500 ms de backoff y la misma capacidad, archivo y
  uploadId. No añade espera al camino correcto. Cancelar aborta también el backoff;
  formato, cuota, permiso, capacidad vencida, reserva pendiente y privacidad no se
  reintentan automáticamente. Nunca se da un archivo por confirmado ante un fallo.
  La suite de cliente pasó 49/49, incluyendo diez evidencias con fallo temporal,
  una sola queja y finalización únicamente después de confirmar todas.
- La comprobación real de la carpeta configurada confirmó acceso de escritura,
  tipo carpeta, sin papelera y permisos privados. Se reprodujo un falso rechazo en
  ambos PDF de requisitos: bytes `/AA` de fuentes sfnt incrustadas coincidían con
  la búsqueda de acciones. Se clasifican fuentes binarias por cabecera/directorio
  acotados y tablas head/maxp; ObjStm siempre se inspecciona, también con nombres
  escapados. Ambos documentos pasan tras el arreglo, sin subirlos ni copiar su
  contenido a fixtures. No se rebajan contenido activo, tamaño, cuotas o firmas.
  El envío de la captura conserva su folio pero quedó sin evidencias y su capacidad
  anterior venció. El propietario excluyó expresamente recuperarlo; el alcance
  continúa en los nuevos envíos. No se regenera esa capacidad ni se crea otro folio.

## Corrección del rechazo de vista inicial en PDF

El propietario reprodujo otro rechazo con un PDF exportado por el propio sistema.
Su archivo de 61.702 bytes se rechazaba antes de reservar Drive por la clave
`OpenAction`: el filtro confundía un destino de vista/zoom con una acción ejecutable.
Se reprodujo también con jsPDF, comprimido y sin comprimir, sin datos privados.

El validador permite únicamente un array acotado de destino de página y modos
XYZ/Fit/FitH/FitV/FitR/FitB/FitBH/FitBV con parámetros numéricos/null y cierre
explícito. Acciones por diccionario/referencia, JS, Launch, destinos ambiguos y
acciones comprimidas siguen rechazados. No cambia tipos de archivo, cuotas,
permisos, tamaño ni capacidades. El error genérico ya no atribuye el fallo a una
contraseña o contenido activo sin haber determinado esa causa.

La distinción entre destino y acción se describe en
[ISO 32000-1, catálogo y destinos](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf).
118/118 pruebas focalizadas verifican vistas válidas, rechazos de seguridad y un
PDF de jsPDF que recorre la API real hasta el commit con Drive/DB ficticios. El PDF
original pasó la validación corregida; el propietario reintentó el mismo envío y
confirmó éxito. La lectura remota verificó un único adjunto y finalización, sin
crear otro expediente. La verificación de checksum está en la evidencia local.
Código web local, sin despliegue Vercel.

## Seguimiento

`PublicTrackingPage` conserva consulta automática por capacidad y Actualizar estado.
Recepción/respuesta se muestran en tarjetas con fecha y contraste. Se retiraron
acciones de copiar y pegar enlaces y descarga del informe de esa vista. También se
retiraron los botones de copiar de FormulariosSettings/SeguimientoFormularioModal.
El endpoint de descarga existente conserva compatibilidad y su autorización;
retirar el botón no revoca una capacidad emitida. El informe final debe viajar
como adjunto físico en el correo, independiente del acceso de treinta días.

## Correo por evento

Migraciones aplicadas `20261110203610_quejas_urgent_mail_wake.sql` y
`20261110212506_quejas_mail_wake_setup.sql`:

- `pg_net` agenda después del commit de recepción/finalización pública o resultado
  final; un fallo del despertador no revierte la operación de negocio.
- El sobre de ejecución lleva solo propósito, reloj, nonce, carga vacía y HMAC;
  no incluye destinatario ni contenido ciudadano. Clave independiente en Vault;
  settings privados sin grants directos, RPC de máquina solo service_role.
- Claim urgente limita el lote a dos correos ciudadanos y conserva orden,
  finalización, leases, nonce, reintentos y CAS. No consume los avisos internos.
- El poll de cinco minutos continúa como recuperación y para avisos internos.
  La entrega depende también de disponibilidad y cuota de Google; no es garantía
  de recepción instantánea ni de ubicación en inbox.
- `qms_mail_setup_wake`/`qms_mail_setup_wake_result` permiten configurar por el mismo
  transporte de DB, solo contra el endpoint configurado y mientras esté apagado.
  Apps Script verifica el HMAC maestro; la activación exige recibo firmado con
  nonce correcto y Drive disponible. No se guarda la clave maestra en DB.
- Edge v17 añade claim ciudadano y autorización v2 previa al documento publicado.
  El emisor descarga/verifica el único Word/PDF antes de marcar attempting;
  conserva diario y ACK para impedir reenvíos inciertos. Ningún correo final nuevo
  se acepta sin adjunto. Seguimiento permanece solo en el acuse.

## Activación y recuperación del pendiente

Google confirmó configuración firmada, nonce y Drive listo. Se activó el destino
exacto verificado, sin claves en salida ni modificación de permisos/manifiesto.
Los dos triggers están habilitados; pg_net recibió HTTP 200 y un
`queue_wake_receipt` accepted con HMAC correcto. El recorrido real tardó unos
14 segundos entre activación y ACK del mensaje pendiente; no es un SLA.

El final ya publicado había agotado doce reintentos antes de obtener autorización.
Una consulta firmada de solo lectura del diario, bajo el lock del emisor, confirmó
ausencia de cualquier intento de entrega. Se verificó también el único Word
publicado (11.212 bytes), sin papelera y con tamaño/MIME concordantes. Se habilitó
un intento de recuperación solo para ese evento fallido, sin cambiar destinatario,
contenido, publicación ni folio. El ACK pasó a sent el 10 noviembre a las
17:03:35 de Costa Rica, tras el envío con adjunto obligatorio. Ningún evento sent o
incierto se reabrió; no hubo reenvío histórico ni correo ficticio de QA.

La inspección de recuperación de `queue_wake_setup_request` admite un eventId
validado y devuelve únicamente absent/sent/uncertain. No revela el contenido del
diario, no envía y trata todo estado no confirmado como incierto. Su acceso sigue
limitado al HMAC de máquina y al aprovisionamiento apagado.
Evidencia saneada: [activación](../supabase/backups/quejas_urgent_mail_activation_20261110.json).
El [snapshot preparado](../supabase/backups/quejas_urgent_mail_prepared_20261110.json)
conserva el estado anterior a la autorización, no el estado activo posterior.

## Seguridad y verificación

205 pruebas Node focalizadas, 40 adicionales y 52 de cliente/administración
correctas (selecciones parcialmente solapadas); 159 comprobaciones PostgreSQL
aisladas (dobles net/Vault), 63 de navegador
en 1280/390/320 con HTTP ficticio, sin expedientes ni correos reales creados para QA.
TypeScript, lint, estructura, capa visual y build Next 16.4.6 correctos. Evidencia
local en `.performance/public-mail-20261110/`; no contiene claves.
La comprobación de recuperación posterior añadió una prueba y pasó 39/39 de la
suite del emisor, incluyendo sent/attempting/uncertain/estado desconocido sin envío.
La selección posterior de correo completo pasó 83/83.

La revisión efectiva confirmó RPC nuevos sin EXECUTE anon/authenticated,
search_path vacío y acceso solo de máquina. El advisor añade únicamente el aviso
informativo esperado de RLS sin policy en settings privados cerrados; conserva
avisos globales anteriores fuera de este cambio.

Next/eslint-config-next se fijaron en 16.4.6 para retirar vulnerabilidades críticas
del árbol anterior. Auditoría npm de producción: cero críticas/altas y seis
moderadas indirectas pendientes en la cadena Google/gaxios/rimraf/glob/minimatch.
No se aplicaron overrides mayores incompatibles. Referencias de los parches de
Next: [GHSA-2464-fhr4-w9xw](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw)
y [GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr).
La versión web publicada conserva su código anterior hasta un despliegue autorizado.
La clasificación sfnt sigue el [directorio OpenType de Microsoft](https://learn.microsoft.com/en-us/typography/opentype/spec/otff);
no sustituye una validación completa de fuentes ni un servicio antimalware.
