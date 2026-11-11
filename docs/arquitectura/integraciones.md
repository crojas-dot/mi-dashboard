# API e integraciones: Usuarios, formularios públicos, Drive e IA

10 noviembre: Edge v17 y Apps Script v5 activos con despertador ciudadano desde
pg_net. Autorización Google/Drive, recibo HMAC accepted y ACK sent del final pendiente
con Word verificados. [Protocolo y estado](../quejas-formulario-correo-inmediato-2026-11-10.md).

10 noviembre, Edge v16 verificada: las plantillas predeterminadas de recepción/final
añaden `gc@eca.or.cr`; el correo editado conserva su contenido exacto. Mantiene el
adjunto físico final obligatorio y seguimiento solo en el acuse. Sin actualización
adicional de Apps Script, permisos, activadores o reenvíos. La respuesta de No Procede
usa el mismo snapshot de correo mediante publicación transaccional.
[Contrato y evidencia](../quejas-revision-y-respuesta-2026-11-04.md).

10 noviembre, ajuste del correo final activado: Apps Script adjunta obligatoriamente
el Word/PDF publicado y deja el envío pendiente si no puede obtenerlo. Edge v15 emite
el enlace de seguimiento solo en el acuse de recibo; el correo final no depende del
acceso que vence a los 30 días. HEAD del emisor y bundle remoto leídos y verificados;
sin cambios de permisos/manifiesto, activadores, DB o reenvíos. [Contrato y evidencia](../quejas-revision-y-respuesta-2026-11-04.md).

10 noviembre: el correo final puede usar asunto/mensaje de acompañamiento editados
y aprobados por Calidad. `quejas-mail-queue/message.ts` consume el snapshot opcional
del claim v4; no sustituye la respuesta pública ni el informe. La Edge conserva
HMAC, tracking y adjunto único publicado. Limita el reclamo a dos mensajes para el
sobre de 64 KiB; la autorización v2 valida por separado envíos ciudadanos/internos.
El emisor Apps Script conserva su HTML, permisos, diario y ACK. No hay reenvío ni
cambio de huellas históricas. [Contrato y activación](../quejas-revision-y-respuesta-2026-11-04.md).

19 octubre, **activo en producción**: `/q/seguimiento` es una página estática genérica. Los POST públicos
exactos `/api/public/seguimiento` y `/api/public/seguimiento/documento` requieren una
capacidad firmada y DB vigente, con cuota/no-store y guard BotID Basic antes
del backend. El enlace autoriza al portador; no verifica identidad/control del correo.
La firma v2 identifica expediente/nonce; la DB autoriza cada consulta/descarga y
vence el acceso 30 días naturales después del primer cierre No Procede/Finalizado,
sin renovar por consultas o reaperturas. No anticipar una fecha fija al recibir.
GET privado `/api/quejas/seguimiento`
exige staff; POST exige admin y relación formulario/consecutivo. No hay búsqueda pública
por folio. Web/Edge comparten clave dedicada; Apps Script solo recibe el origen permitido.
La configuración incompleta con el flag activo devuelve error, nunca false para usar
el flujo antiguo. El correo envía el enlace, con descarga del oficio desde el seguimiento;
no amplía permisos Drive del emisor. Web publicada y promovida:
`dpl_2kk83rkgKrip1MwK8NNbMcw2d2MF`,
[dominio canónico](https://mi-dashboard-iota.vercel.app). DB, Edge y Apps Script
compatibles quedaron activados; los dos cortes SQL se verificaron después del cliente.
La regla WAF existente conserva 90 solicitudes/IP/600 s y añade ambos POST de
seguimiento. Las seis comprobaciones HTTP de producción verificaron disponibilidad,
guards y rechazo público sin verificación; no certifican una consulta real con
capacidad ni la recepción del botón en un buzón. No se reenviaron eventos históricos.
[Fuentes y evidencia de activación](../quejas-seguimiento-y-publicacion-2026-10-16.md).

> Contratos de código revisados el 8 de octubre de 2026; el inventario general conserva el snapshot remoto del 7 de octubre, con la ampliación pública indicada abajo. El estado de producción se registra por separado en [la guía del formulario público](../seguridad-formularios-publicos.md).

| Método y ruta | Contrato y autoridad |
| --- | --- |
| GET `/api/usuarios` | Admin/Calidad, filtros search/rol/estado y proyección de perfiles |
| POST/PATCH/DELETE `/api/usuarios` | Admin, Auth administrativo + perfiles, autoprotección y último admin |
| GET/PUT `/api/configuracion/zona-horaria` | Lee solo la zona; escritura admin, clave org.zona_horaria |
| GET/PUT/DELETE `/api/configuracion/logo` | GET para cualquier perfil activo (el logo del shell no es sensible); PUT/DELETE admin, sube a storage.branding y conserva en org.logo_url solo la URL vigente |
| POST `/api/drive/upload` | Bearer, staff o responsable, queja resuelta por ID, folio obtenido desde DB, Analisis/ |
| GET `/api/public/formularios/[token]` | Sin Bearer; enlace exacto activo de Quejas, devuelve solo nombre/modulo/uploadsAllowed |
| POST `/api/public/quejas` | BotID Basic, JSON ciudadano estricto, cuotas PostgreSQL, creación idempotente y capacidad firmada |
| POST `/api/drive/upload-public` | BotID Basic y capacidad firmada; reserva DB antes de Drive, vínculo exacto formulario/envío/queja y archivo validado |
| POST `/api/public/quejas/finalizar` | BotID Basic y capacidad vigente; finalización y notificación idempotentes |
| GET `/api/drive/download?id=...` | Bearer, adjunto resuelto en DB, staff/responsable, stream y filename RFC 5987 |
| DELETE `/api/drive/delete` | Bearer, permiso según origen del adjunto, Drive primero y fila después |
| POST `/api/ai/analizar` | Bearer activo, staff o responsable de queja; módulo/entidad/tipo auto-custom |
| POST `/api/ai/test` | Admin, un proveedor/modelo por solicitud; ejecuta test en servidor |
| GET/PUT/POST `/api/configuracion/ia` | Admin activo; configuración sin secretos en respuestas, escritura, descubrimiento, conexión y memoria |

- Todas estas API usan runtime nodejs. IA analizar maxDuration=60; uploads maxDuration=120 y timeout de Drive propio de 55 s.
- Rate limits privados en memoria por IP/ruta: usuarios 20/min, IA analizar 10/min, IA test y configuración IA 30/min, Drive upload/delete 30/min. No son contadores compartidos entre instancias serverless. El gateway público usa contadores PostgreSQL separados: 10 intentos/15 min, 20 altas nuevas/hora y 30 subidas/15 min; clave HMAC de IP, sin IP literal en esas tablas.
- GET usuarios completa `ultimo_acceso` con `auth.users.last_sign_in_at` mediante Auth Admin `listUsers` paginado (1000 por lote), solo en servidor y tras autorizar admin/calidad. `lib/server/ultimoAcceso.ts` une por auth_id y devuelve únicamente el timestamp; no devuelve metadatos de Auth. El campo histórico de public.usuarios no es la fuente para perfiles ligados a Auth. Fallos de Auth devuelven 502; nunca se confunden con ausencia de ingresos. La consulta se refresca al volver a la ventana si está stale.

### Gateway del formulario público

El cliente `/q/[token]` usa solo HTTP mediante `publicQuejasClient.ts`; no invoca RPC
ni registra evidencias desde el navegador. `lib/server/publicForms/` comparte
validación, cuerpos limitados, BotID, capacidad temporal y respuestas seguras. Los
RPC `public_form_*` son invoker y exclusivos de service role; el handler debe
verificar cada solicitud antes de usarlos. `proxy.ts` permite solo las rutas
públicas concretas y retira headers de identidad del cliente.

BotID está fijado en **Basic**, gratuito en Vercel, tanto en
`instrumentation-client.ts` como en `botProtection.ts`; `next.config.ts` usa
`withBotId`. No se configura Cloudflare ni Deep Analysis. Se aplica el patrón
oficial de Vercel: solo `isBot === true` se rechaza; los bots verificados y los
resultados incompletos no bloquean. `verifyPublicBot` omite el SDK fuera del
runtime de Vercel (`VERCEL === '1'`), así que un build local no bloquea envíos
legítimos ni demuestra el bloqueo de bots en producción. La aditiva, el gateway
publicado y el cierre de accesos legacy están aplicados desde el 9 octubre;
el seguimiento y sus cortes internos se activaron el 19. Consultar
[la evidencia pública](../seguridad-formularios-publicos.md).

### Transporte y editor de Usuarios

`lib/services/apiClient.ts` comparte transporte HTTP con Usuarios e IA. Lee el token
local para enviarlo; la API verifica identidad activa/rol de nuevo. Las lecturas usan
`lib/queries/useUsuarios.ts`; las escrituras del directorio usan `usuariosService.ts`.
Los modales y confirmación de estado comparten `useOperationLock` para impedir
doble envío antes del siguiente render. No cerrar ni regenerar el borrador durante
una escritura. Un fallo de red conserva datos/contraseña; un fallo del listado tras
guardar se anuncia aparte. El guard real admin deshabilita la lectura de la página
antes de estar inicializado; no convierte una simulación de vista en autorización.

### Subsistema de IA

Edición visual: `components/configuracion/ia/ProviderEditorModal.tsx`,
`ModuleRoutingEditor.tsx` y `ModelTestModal.tsx`; tipos/configuración/actualización
inmutable permanecen en esa carpeta. `AIProvidersManager.tsx` conserva la
orquestación y revisión de las escrituras. No importar SDK servidor en esas vistas.

- Tipos/configuración en `lib/ai/types.ts`, `aiFactory.ts`, `modelDiscovery.ts`, `modelMemory.ts`, `modelTesting.ts`, `modelTestingClient.ts`.
- `ai_providers`: id/nombre/tipo/base_url opcional/api_key/modelos/tokens_usados/limite_tokens/tokens_updated_at. `ai_routing`: proveedor/modelo/system_prompt y proveedor/modelo de fallback por módulo.
- Proveedores: Gemini, Anthropic y estándar OpenAI (compatible con OpenAI, Groq, DeepSeek, Mistral, Together, OpenRouter, etc., según allowlist). El servidor valida HTTPS/host permitido y rechaza IPs privadas; no cualquier URL escrita en UI se acepta.
- Análisis recibe `{modulo,entidad_id,tipo_consulta:'auto'|'custom',prompt_usuario?}`. Resuelve entidad por tabla; para quejas permite ID/folio, combina campos con contexto externo y devuelve análisis/tokens.
- Presupuesto total: 50 s corto, 55 s grande desde el inicio (incluye autenticación/contexto). Máximo de request 60 s. Timeout por modelo: <5k chars 10/15 s, <20k 20/30 s, >=20k 30/45 s (OpenRouter/otros). Grande para fallback>=10k chars.
- Cadena: modelo principal/configurado o éxito útil recordado → otros modelos del proveedor (máx 5 corto/3 grande) → proveedor externo. Usa controller por intento, presupuesto restante, `esperarConSignal` y `tiempoDisponible`; pausa 200 ms entre alternativas.
- Memoria: éxito por latencia/tamaño hasta 24 h; fallos con penalización 30 min/1 h/4 h; timeout de prompt grande puede registrarse sin penalizar modelo. Config/claves `ai_ultimo_exito_*`, `ai_fallos_*`.
- Descubrimiento actual vía ListModels/REST para Gemini, OpenAI compatibles **y Anthropic**. OpenRouter limita a gratuitos y descarta variantes no admitidas; caché por `ai_modelos_cache_*`, TTL configurado en minutos (default 1440). No describir Anthropic como lista fija.
- Resolución de modelos auto/Gemini usa los helpers de factory y la interceptación del endpoint; revisar código/regex antes de fijar nombres de modelo o expandir alias.
- `modelTesting.ts` ejecuta pruebas servidor; `modelTestingClient.ts` es una utilidad histórica; el gestor activo administra resultados `ai_test_resultado_*` mediante `lib/services/aiConfigService.ts` y su API admin. UI itera POST /api/ai/test, presenta progreso/resultado y permite cancelar su flujo.
- Gestor activo: CRUD de proveedores, prueba de conexión, sincronización/test, modelos únicos auto-seleccionados, presets 30M/6M/250k tokens, barra de consumo y routing/fallback. El límite configurado presenta consumo; no hay una condición de bloqueo por cuota en el endpoint analizar actual.
- Reset mensual compara `tokens_updated_at`; incremento posterior por RPC `incrementar_tokens_proveedor`, exclusivo service role, JSON validado y fila bloqueada FOR UPDATE. No llamar ese RPC desde el navegador.
- `.contexto_qms.txt` se descarga de Drive y se añade como contexto al prompt. El endpoint puede continuar sin él; no guarda evidencias en disco. Ese texto externo no es una autorización ni una protección infalible contra prompt injection.
- IA visible en Mis Quejas: análisis automático, chat custom, lectura Markdown y textarea de edición. El resultado se mantiene en estado del panel; no hay historial IA persistente completo.
- El gestor activo usa `/api/configuracion/ia` para leer/guardar, descubrir modelos, probar conexión y limpiar memoria. La API exige perfil activo admin, usa service role y responde sin claves guardadas (`api_key` vacío, `has_api_key` como indicador). La clave nueva que el admin teclea sí viaja al servidor al guardar/probar. **Aislamiento aplicado y probado**: se eliminó la lectura heredada y RLS rechaza acceso directo a `ai_*` para authenticated incluso admin; la API autorizada usa service role. Los propietarios del proyecto/roles privilegiados conservan acceso administrativo a la DB.

## Contrato del gestor IA

- Transporte cliente en `lib/services/aiConfigService.ts`; autorización/validación en `app/api/configuracion/ia/route.ts` y `lib/server/aiSettings.ts`. Ningún componente importa factory/discovery/memory ni credenciales de servidor.
- JSON limitado realmente a 1 MiB, claves permitidas, respuestas no-store. URL HTTPS en allowlist compartida sin credenciales/query/hash/puertos alternos; discovery rechaza redirects. Nunca reutilizar una clave guardada en otro tipo/URL.
- Guardado con revisión explícita de configuración (excluye consumo), clave vacía conserva la anterior, contador actual conservado y reset por IDs explícitos. UPDATE condicional compara xmin leído en la misma petición; conflicto/carrera produce 409 sin actualizar revisión y reintentar silenciosamente. No depende de un RPC nuevo.
- El editor mantiene borrador y revisión si falla, bloquea doble guardado y prueba el borrador actual. La carga inicial y el test se abortan al desmontar. Test limitado a 20 modelos; conserva los no probados, no persiste tras cancelar y termina loading aunque guardar falle. Errores de modelos se sanitizan.
- El límite de consumo configurado es informativo: no afirmar que el endpoint de análisis impide superar la cuota.

## Variables y configuración externa

| Variable / clave | Uso |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY | Cliente público y validación de Bearer en servidor |
| SUPABASE_SERVICE_ROLE_KEY | Exclusivamente servidor; administración Auth/DB y rutas autorizadas |
| PUBLIC_FORMS_SIGNING_SECRET | Secreto propio de al menos 32 bytes para capacidades e IP HMAC; sin fallback a claves Supabase |
| PUBLIC_FORMS_ENABLED | Ausente o exacto `true` habilita el gateway; cualquier otro valor lo cierra con 503. Cambiar env de Vercel requiere redesplegar |
| PUBLIC_TRACKING_SIGNING_SECRET | Firma dedicada compartida solo por servidor web y Edge; independiente de claves Supabase y HMAC del mailer |
| PUBLIC_TRACKING_ORIGIN / PUBLIC_TRACKING_ENABLED | Origen canónico exacto y flag `true` de seguimiento, configurados en web y Edge desde el 19 octubre; cambiar entorno web requiere redesplegar |
| QMS_PUBLIC_TRACKING_ORIGIN (Apps Script) | Origen permitido del enlace recibido; el script no guarda la clave de firma ni emite capacidades |
| GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY | Service Account Drive; normalizar los \\n literales. Compartir la carpeta raíz con esa cuenta |
| APPS_SCRIPT_WEBAPP_URL | Webhook opcional de extracción de contexto |
| drive_folder_id_quejas (DB) | ID de carpeta raíz para evidencias |
| org.zona_horaria (DB) | Configuración de visualización; fallback Costa Rica, no cambia automáticamente todos los RPC/fechas |
| org.logo_url (DB) | URL pública del objeto vigente en el bucket branding; vacío o un valor que no sea http(s) equivale a la inicial «E» |
| ai_providers / ai_routing / ai_cache_ttl_minutes (DB) | Proveedores, rutas, fallback, consumo y caché IA |

`.env*`, `.next`, node_modules y .vercel están ignorados. Configurar también el entorno del despliegue; la presencia de .env.local no demuestra configuración de producción. No agregar secretos al repo. La infraestructura externa Apps Script/Drive no se verifica solo por compilar.

### Correo ciudadano Quejas (activo desde 13 octubre)

Despertador **local del 3 noviembre, sin activar**: `public/quejas/finalizar`
programa `wakeQuejaMail` tras commit con `after()`. Payload vacío y HMAC exclusivo;
Apps Script despierta su poll directo con el mismo lease/diario. Variables de
servidor `QUEJAS_MAIL_WAKE_ENABLED`, `QUEJAS_MAIL_WAKE_URL`, `QUEJAS_MAIL_WAKE_SECRET`;
script `QMS_MAIL_WAKE_SECRET`. No reactiva el worker legacy ni sustituye el trigger
de cinco minutos. El transporte HTTP acotado se comparte en `quejaMailTransport.ts`.
Activación y límites en [su contrato](../quejas-claridad-y-acuse-2026-11-03.md).

Desde el 20 octubre, el contrato ciudadano tiene dos eventos: `recibido` y `final`
(No Procede o resolución de Calidad). DB aplicó `20261020163142`, conservando los
23 `sent` existentes y sin leases activos en el corte; Edge y Apps Script se actualizaron.
`investigacion` solo permanece en historial: no se genera/reclama y no bloquea el
final. Solo sus pendientes/reintentables se omiten con `citizen_notice_retired`;
las reservas e incertidumbres previas se conservan. Avisos internos intactos.
Ver [corte y verificación](../quejas-dos-correos-y-reintentos-2026-10-20.md).

DB encola snapshots; Apps Script consulta/manda/confirma por Edge HMAC de Supabase
`quejas-mail-queue`, sin Vercel. Credenciales generales solo en Edge; script tiene HMAC
específico, URL exacta, diario privado y un activador cada cinco minutos. Nonce DB,
FIFO, lease y CAS conservan autorización/concurrencia. ACK falso/timeout no se anuncia
como envío exitoso ni habilita reenvío ciego. No modifica APPS_SCRIPT_WEBAPP_URL ni el
conversor Drive. Ver [contratos/evidencia](../correo-quejas-directo-2026-10-13.md) y
[límites](../seguridad-correos-quejas.md).

El endpoint `/api/quejas/correos` quedó de compatibilidad, apagado por defecto y requiere
transporte legacy explícito. El `/exec` anterior fue archivado. Actividad de Quejas
consulta únicamente el estado de la cola; no activa envíos ni permite conciliarlos.

Desde el 14 octubre el mismo transporte incorpora [avisos internos](../avisos-internos-quejas-2026-10-14.md).
Edge usó claim v2 (0–5); desde el 19 octubre selecciona v3 cuando seguimiento está
activo y añade el snapshot privado opcional. Conserva v2 y los mensajes históricos
sin enlace; procesa los plazos incluso sin capacidad de MailApp. GAS verifica pertinencia de cada aviso interno con
`authorize_request` firmado antes de escribir attempting/enviar. La respuesta previa
del diario prevalece ante ACK perdido; no reinterpretar sent/uncertain como omitido.
`skipped/obsolete_notice` sigue siendo ACK solo interno; el retiro administrativo
ciudadano no amplía ese contrato. El endpoint legacy sigue ciudadano; no acepta
los nuevos tipos. Sin nuevos secretos, scopes, triggers ni dependencia de Vercel.

La ampliación del 19 sí incorpora la firma dedicada de seguimiento en web/Edge y
el origen permitido en Apps Script. `Codigo.gs` guardado se comparó con el remoto,
`QMS_MAIL_ENABLED=true` quedó guardado y se conservó el único activador de cinco
minutos, sin poll manual ni nueva publicación del `/exec` archivado. El envío
continúa DB → Edge → Apps Script, sin worker de Vercel. Evidencia sanitizada:
[`public_tracking_activation_20261019.json`](../../supabase/backups/public_tracking_activation_20261019.json).
