# Formularios públicos: contrato, seguridad y operación

Ajuste del 10 noviembre: [validación nativa, evidencias y correo por evento](quejas-formulario-correo-inmediato-2026-11-10.md).
Límites compartidos 50/254/25, reintento de archivos antes de finalizar y
seguimiento sin copiar enlaces. Cliente local; despertador activo en DB/Edge/Apps Script.
Corrección posterior: PDF exportados por el sistema admiten su vista inicial
OpenAction solo como destino acotado de página/zoom; acciones ejecutables siguen
cerradas. Error genérico sin atribuir contraseñas. 118/118 pruebas y reintento real
del propietario con un único adjunto confirmado; detalle en el mismo contrato.

Revisión: **9 de octubre de 2026**. Esta guía describe el código actual y distingue
infraestructura aplicada y límites de verificación. El usuario autorizó publicar tras verificar y cerrar accesos antiguos; la activación se completó en producción el 9 de octubre.
La [evaluación inicial](evaluacion-formularios-publicos-2026-10-08.md) conserva el
análisis del flujo anterior; su propuesta Turnstile no es la decisión implementada.

## Estado de activación

| Pieza | Evidencia / estado |
| --- | --- |
| Cliente y API nuevos | Producción activa: dpl_5RVFbd1Dd4xBtK9HTh4UMGY3St8G, mi-dashboard-iota.vercel.app |
| DB aditiva | 20261008224037 y20261009031934 aplicadas; tres tablas privadas, seis RPC service-only y compatibilidad Drive |
| Vercel WAF | Live: tres POST y el prefijo /api/public/formularios/* (incluye GET/HEAD),90 solicitudes/IP/600s; misma regla Hobby, sin drafts |
| BotID Basic | Cliente/servidor Basic y OIDC habilitado; las tres operaciones sin prueba devolvieron403 verification_failed en producción |
| Variables Vercel | Variables servidor cifradas disponibles en el despliegue; flag de pruebas locales ausente |
| Cierre legacy | Aplicado 20261009231000: cinco firmas públicas y registro privado sin EXECUTE cliente; metadata anon y escritura directa de adjuntos cerradas |
| Storage histórico | Aplicado 20261009230746: bucket privado, SELECT exacto archivo/expediente/perfil activo y ninguna policy de escritura cliente |
| Pruebas | 417/417 Node, 73/73 PostgreSQL público y 148/148 Drive/Storage/corte atómico; build Vercel y nueve comprobaciones HTTP sin escrituras de negocio |

El envío ciudadano nuevo ya pasa por el gateway. Las vías antiguas no pueden
eludir BotID/cuotas desde anon/authenticated; se conserva el acceso de servidor.
El WAF cubre Vercel, y los permisos de DB cierran la alternativa directa a Supabase.
Esto no convierte Basic en detección infalible ni la revisión de archivos en antivirus.

Evidencia sin datos ciudadanos ni claves:
[activación verificada](../supabase/backups/public_activation_evidence_20261009.json).
Auditoría npm de dependencias de producción al activar:0 vulnerabilidades reportadas.
No equivale a ausencia universal de vulnerabilidades.

## Fuentes y puntos de edición

| Comportamiento | Fuente principal |
| --- | --- |
| Vista ciudadana y ciclo de envío | [app/q/[token]/page.tsx](../app/q/[token]/page.tsx), [usePublicQuejaForm.ts](../app/q/components/usePublicQuejaForm.ts) |
| DTO HTTP, validación cliente y errores | [publicQuejasClient.ts](../lib/services/publicQuejasClient.ts) |
| Validación ciudadana compartida por navegador y API | [publicQuejaValidation.ts](../lib/utils/publicQuejaValidation.ts) |
| Metadata / alta / finalización | [app/api/public/](../app/api/public/) |
| Subida y compensación Drive | [upload-public/route.ts](../app/api/drive/upload-public/route.ts), [drive.ts](../lib/server/drive.ts) |
| Límites compartidos y categorías | [publicForms.ts](../lib/constants/publicForms.ts) |
| Validación, cuerpos, capacidades y cuotas | [lib/server/publicForms/](../lib/server/publicForms/) |
| BotID cliente/servidor | [instrumentation-client.ts](../instrumentation-client.ts), [botProtection.ts](../lib/server/publicForms/botProtection.ts), [next.config.ts](../next.config.ts) |
| DB aplicada y corte | [migración del corte](../supabase/migrations/20261009231000_public_forms_drive_access_cutover.sql) y [Storage](../supabase/migrations/20261009230746_public_storage_access_hardening.sql) |

El navegador usa exclusivamente HTTP para este flujo. El gateway usa service role
solo después de verificar entrada/BotID/capacidad; RLS no sustituye ese guard.
`proxy.ts` permite rutas públicas exactas y descarta headers de identidad enviados
por el cliente. El acceso a módulos privados conserva sus guards propios.

El 16 octubre el código local extendió el mismo guard BotID Basic a los POST de
consulta y descarga de seguimiento, antes del backend/cuotas. No se publicó ni
amplió la regla WAF remota. Esta extensión no autentica al titular: la autorización
de seguimiento sigue siendo el enlace firmado vigente, que puede usar quien lo
posea. Ver [límites y activación](quejas-seguimiento-y-publicacion-2026-10-16.md).

## Contratos e invariantes

Corrección local del **16 octubre**: navegador y API usan el mismo validador puro,
incluidos controles, líneas únicas, correo y límites tras normalizar. Los códigos
cerrados `invalid_public_{nombre,email,telefono,categoria,descripcion}` identifican
el campo; la UI lo enfoca dentro del scroll y asocia su mensaje accesible. No muestra
valores ni diagnósticos remotos. Los tokens, IDs y antispam conservan sus contratos
separados. SQLSTATE 22023 solo se presenta como entrada inválida si el RPC devuelve
`PUBLIC_SUBMISSION_INPUT_INVALID`; errores internos de calendario/formato/servidor
son indisponibilidad, conservando el envío incierto para reintentar su mismo ID.
El propietario confirmó que el envío local volvió a funcionar. No se conoce el dato
exacto rechazado en la captura inicial y no se atribuye a Drive: la subida aún no
había comenzado. Verificación: 87 pruebas Node y 38 comprobaciones Chrome con
respuestas sintéticas (corrección, foco, adjuntos, error interno y reintento), sin
escrituras reales. Este ajuste sigue local, sin publicar Vercel ni modificar DB.

- GET `/api/public/formularios/[token]` exige token de 32 hex minúsculas, enlace activo y módulo Quejas; devuelve solo `nombre`, `modulo`, `uploadsAllowed`. Este indicador permite mostrar el control; la privacidad/disponibilidad de Drive se comprueba al subir.
- POST `/api/public/quejas` acepta exclusivamente `formToken`, `submissionId`, `honeypot`, `nombre`, `email`, `telefono`, `categoria`, `descripcion`. Rechaza propiedades administrativas, claves JSON duplicadas y honeypot lleno; JSON real limitado a 64 KiB, UTF-8 válido.
- Normaliza NFC, bordes y saltos CRLF; nombre obligatorio 1–50, email obligatorio válido ≤254, teléfono opcional ≤25, descripción obligatoria 1–10000. Categorías del cliente actual: Queja, Observación, Sugerencia, Reclamo, Felicitación; 'Denuncia' se retiró del catálogo y permanece solo como valor histórico en DB. No admite estado/responsable/prioridad desde el ciudadano. Las ampliaciones posteriores a la activación requieren publicar el cliente compatible para actualizar producción.
- Ajuste local del **10 noviembre**: el nombre solo admite letras (Unicode, tildes y ñ), espacios, apóstrofes, guiones y puntos; rechaza dígitos y símbolos. El teléfono solo admite dígitos, espacios y `+ - ( ) .`, con al menos seis dígitos y sin letras. Todos los campos rechazan marcas invisibles de dirección/sobreescritura (U+202A–U+202E, U+2066–U+2069), espacio de ancho cero y BOM, además de los controles C0/C1 ya bloqueados. No hay textos de ayuda permanentes bajo los campos: los límites se aplican en el control (`maxLength`) y la validación compartida los revalida al enviar. Un error de campo no se dibuja como párrafo: la vista enfoca el campo y emite un único aviso flotante sonner (`id` `public-form-error`) con el texto breve de `publicQuejaFieldMessage`; el mensaje completo permanece en un nodo `sr-only` enlazado por `aria-describedby` y el pie reserva `role="alert"` solo para errores operativos. La tarjeta ocupa el alto disponible (`100dvh − 48 px`) con el pie abajo y la descripción en seis filas. Los correos se generan como texto plano y no interpretan HTML. Verificación local: Node 887/887, TypeScript, lint, build, estructura y capa visual correctos. Sin publicar.
- UUID v4 de envío más hash del contenido normalizado reclama una única queja antes de generar folio. Mismo ID/contenido recupera la misma confirmación; distinto contenido produce 409. Con respuesta perdida, el cliente conserva ID/cuerpo y no crea otro expediente. La reclamación se anota además en sessionStorage por token (ID, borrador validado, folio y avance de finalización); si la página recarga, el formulario restituye ese intento con el ID marcado como incierto, de modo que un rechazo no libera el ID ni habilita otro folio. Los errores de la etapa de finalización no culpan los datos del ciudadano (publicFinalizationMessage).
- La respuesta de alta contiene folio, ID de queja, ID de envío, capacidad y expiración. No permite listar otras quejas ni descargar sus evidencias.
- Capacidad HMAC propia, verificación de firma y claims estrictos: propósito, formulario, envío, queja y expiración. Dura **30 minutos por emisión**, permanece solo en memoria y no usa secretos Supabase como fallback.
- Recuperar un envío antiguo revalida BotID, formulario activo y el mismo hash antes de renovar capacidad. No aceptar un token expirado ni asumir una ventana absoluta de 30 minutos desde la primera creación.
- Multipart público contiene solo `file`, `uploadToken`, `uploadId`, uno de cada; no acepta folio/queja/formulario libres. Cuerpo ≤4 MiB +128 KiB, incluso sin Content-Length.
- UploadId estable más hash/metadata identifica un archivo. Reserva y commit bloquean envío/queja, revalidan enlace activo, estado Recibido y vínculo firmado; cuentan existentes y reservas. Máximo **diez archivos y 40 MiB por expediente**, **4 MiB por archivo**.
- POST `/api/public/quejas/finalizar` requiere capacidad vigente y BotID. Finalización rechaza reservas pendientes y no duplica notificación/mail_queue. No revoca la capacidad: permite recuperar evidencia dentro de su vigencia y mientras se permita subir. No hay envío de correo confirmado por la mera inserción en mail_queue.

## Protección y límites reales

[BotID Basic de Vercel](https://vercel.com/docs/botid) es el modo gratuito, fijado en ambos extremos. Las tres operaciones POST exigen en Vercel una respuesta con isBot/isHuman booleanos y humano confirmado; bots, incluso verificados, se rechazan. Un resultado incompleto o fallo del verificador cierra con 503. Se fuerza isDevelopment=false en Vercel para impedir un bypass por NODE_ENV incorrecto.

El desarrollo sin Vercel permite pruebas. Un build/start local requiere el flag servidor PUBLIC_FORMS_LOCAL_TESTING=true y URL loopback; no se envía ese flag a Vercel ni al cliente. Fuera del runtime admitido no se omite silenciosamente BotID. Esta excepción no desactiva validaciones, cuotas, firma de capacidades ni RLS, y no demuestra detección real de bots. La excepción local nunca prevalece sobre VERCEL=1.

| Control | Límite / alcance |
| --- | --- |
| PostgreSQL intentos | 10/15 min por clave HMAC de IP; incluye reintentos de creación que llegan a este contador |
| PostgreSQL altas nuevas | 20/hora por clave HMAC de IP; cuota y creación en la misma transacción, reintento confirmado no consume otra alta |
| PostgreSQL subidas | 30/15 min por clave HMAC de IP, incluso reintentos |
| WAF Vercel | 90/10 min/IP: tres POST y metadata GET/HEAD; control grueso y contadores regionales. Supabase directo se cierra con ACL |
| Archivos públicos | PDF, JPEG, PNG; extensión, MIME, firma/estructura y límites de recursos verificados |
| Descompresión/imagen | Máximo agregado 64 MiB para datos PDF/PNG procesados; imagen no puede superar 64 MiB en raster RGBA |

PDF cifrado, acciones activas identificadas y PNG animado se rechazan. El parser es
acotado y puede rechazar formatos no soportados; **no es antivirus**. Las cuotas
compartidas de DB no prometen tráfico ilimitado. Personas detrás de una misma IP
comparten cupo; cambiar el secreto cambia sus claves HMAC. No se guarda IP literal
en las tablas de cuota. No persistir contenido ciudadano o capacidades en logs.
Estos controles no añaden MFA ni protección propia al login Supabase.

## Drive, reintentos y recuperación

El gateway reserva cuota antes de contactar Drive. Revisa permisos paginados tanto
en la raíz como en la carpeta del folio y falla cerrado si aparece `anyone`; no
crea permisos públicos. El ID se obtiene del expediente autorizado por la capacidad,
no de un folio aportado libremente. El parche mantiene ID limpio en `queja_adjuntos`
para preview/descarga/borrado actuales.

Si se pierde la respuesta del commit, consulta la reserva antes de borrar: una
escritura confirmada conserva su archivo. Si el fallo está confirmado, elimina el
archivo propio y después libera reserva. Timeout Drive sin ID o resultado DB
incierto conserva reserva/cuota; podría existir ya una escritura. No caduca sola.

No hay worker de reconciliación. Para una reserva retenida, un operador autorizado
debe contrastar su uploadId, estado DB y archivo del folio en Drive, confirmar lo
que quedó registrado y compensar solo el archivo de ese intento antes de liberar
la reserva. No liberar/borrar en masa por antigüedad. Reservas pendientes bloquean
la finalización, pero el ciudadano conserva el folio que ya recibió.

`PUBLIC_FORMS_SIGNING_SECRET` debe ser independiente y tener ≥32 bytes. Rotarlo
invalida capacidades pendientes y cambia claves de cuota; coordinar la ventana.
`PUBLIC_FORMS_ENABLED` ausente o exacto `true` habilita; otro valor cierra gateway
con 503. En Vercel cambiar env requiere redesplegar. Desactivar un enlace desde
Configuración bloquea nuevas operaciones que lo revalidan; no borra expedientes.
La FK impide eliminar formularios con envíos: desactivar es la operación prevista.

## Activación y comprobación

1. Confirmar DB aditiva/parche y variables cifradas en el entorno del despliegue; Google debe tener acceso a carpeta privada. Nunca publicar claves en Git, CLI args o evidencia.
2. Desplegar cliente/API con BotID Basic; comprobar metadata limitada, rechazo de POST sin prueba y flujo de navegador sin crear quejas ficticias en producción. Validar continuidad admin/privados y permisos de Drive.
3. Solo después aplicar el cierre preparado: cinco firmas legacy sin EXECUTE PUBLIC/anon/authenticated y tabla formularios sin lectura ciudadana; preservar service role/admin. Registrar versión remota real y mover el archivo aplicado a migrations.
4. Ejecutar [verificación gateway de lectura](../scripts/verificar-public-forms-gateway.sql) y [verificación de cierre](../scripts/verificar-public-forms-cutover.sql), comprobar REST directo rechazado y registrar URL/versión del despliegue. Si falla, cerrar formularios y reparar; el [rollback de ACL](../scripts/rollback-public-forms-cutover.sql) reabre el flujo legacy y necesita una decisión explícita.

Suites: `public-form-primitives`, `public-gateway`, `public-quejas-client` y
`public-flow-review`. [test-public-forms-db.mjs](../scripts/test-public-forms-db.mjs)
usa PostgreSQL local con fixtures sintéticos, prueba concurrencia/ACL/rollback y
cierra su cluster; no toca registros ciudadanos. El [preflight](../supabase/backups/public_forms_gateway_preflight_20261008.json)
contiene metadatos, no backup de negocio. Compilar o pasar estas pruebas no publica
Vercel ni demuestra entrega de correo, detección real de bots o ausencia universal
de malware.

Comprobación remota posterior al corte,9 octubre: seis RPC nuevos service-only; cero firmas públicas legacy ejecutables por anon/authenticated, registro privado cerrado al cliente, metadata anónima sin SELECT y cero permisos cliente de escritura de adjuntos. WAF live sin drafts. Código activo y DB coinciden.

## Recuperación de falsos rechazos locales

Actualización local del 20 octubre: un 400/422 genérico ya no libera el ID del
envío, pues puede llegar después del commit. Solo códigos cerrados de campo
identifican validación previa; un intento incierto conserva siempre su ID,
cuerpo y uploadId. La API valida el recibo interno y emite la capacidad con su
reloj, sin aceptar iat futuros ni ampliar su TTL. Recibo interno inválido devuelve
503. Con 10.000 caracteres se reprodujo creación seguida de rechazo y recuperación:
dos intentos, un folio y una finalización. El arreglo web sigue sin publicar.
Contrato, evidencia y límites en
[reintentos y dos correos](quejas-dos-correos-y-reintentos-2026-10-20.md).

El campo antispam permanece realmente oculto y con indicaciones para gestores de autocompletado. Un valor poblado sigue rechazado en servidor antes de DB/Drive con `honeypot_rejected`, distinto de `verification_failed` de BotID. Tras ese rechazo se limpia únicamente el antispam del cuerpo conservado: envío, formulario y contenido persistible mantienen su identidad/hash. Una respuesta perdida anterior impide regenerar el ID incluso si un reintento posterior recibe 400/422. No se quitan validaciones de archivos, cuotas ni permisos.

La UI conserva una sola área de estado durante los reintentos y no estira la tarjeta. Prueba Chrome temporal del 9 octubre: seis rechazos seguidos y éxito ficticio en escritorio/móvil, mismo ID y altura estable, sin escrituras reales. Suite global posterior: 412/412. Estos cambios se incluyeron en la activación autorizada del 9 octubre.

## Progreso dentro del formulario

El folio, subida por archivo y finalización se muestran dentro del mismo formulario mientras la operación está pendiente. Campos permanecen visibles e inmutables tras registrar. La tarjeta final de éxito sustituye al formulario solo después de adjuntar todos los archivos y confirmar la finalización, sin abrir otra pestaña. Un fallo conserva el folio y permite reintentar únicamente lo pendiente. El estado local de archivo subiendo es transitorio, no un estado de DB. Reintentar archivos fallidos preserva sus uploadId y no genera otro expediente. No hay pausas mínimas ni timers visuales; se espera la operación real. El área de adjuntos reserva 112 px y hace scroll interno; seleccionar archivos no añade altura. El pie sticky de envío conserva su espacio dentro del formulario y permanece visible en pantallas pequeñas. Prueba Chrome del 9 octubre con respuestas ficticias: mismo nodo form y campos durante upload detenido y fallo; tarjeta final tras recuperación; una creación, tres uploads para dos archivos y una finalización, sin escrituras reales. Uno y diez adjuntos en cinco tamaños de escritorio/móvil: 0 px de crecimiento de tarjeta y de desplazamiento de CTA, botón visible y clicable, sin desbordamiento horizontal ni crecimiento acumulado al volver a seleccionar. Confirmación centrada en escritorio,375 px y320 px, conservando el flujo de fallo/reintento. Verificación de este ajuste: 22/22 en public-quejas-client, TypeScript del build, lint y build. Verificación global antes de publicar:417/417. Diseño y flujo incluidos en el despliegue autorizado.

## Alcance y límites de la activación

La URL candidata se verificó con acceso autorizado de Vercel; el enlace público se comprobó sin credenciales: GET formulario200, metadata de token inexistente 404, tres POST sin prueba 403 y cuatro APIs privadas401. No se crearon quejas ni adjuntos de prueba en producción; un envío ciudadano humano positivo completo permanece como comprobación operativa. El flujo positivo, fallos y recuperación se probaron con navegador local sintético y DB local, sin confundirlos con una prueba positiva real de BotID.

Los grants internos de storage.objects pertenecen a supabase_storage_admin. Postgres no puede asumir ese rol: la solicitud REVOKE de TRUNCATE/REFERENCES/TRIGGER no eliminó los grants del propietario administrado. La barrera efectiva de archivos es bucket privado/RLS; REST expone CRUD, no TRUNCATE. No cambiar ownership ni elevar roles para esconder este límite. Advisors conservan avisos globales de funciones definer, extensión y protección de contraseñas; no se afirma una auditoría completa del resto del producto.
