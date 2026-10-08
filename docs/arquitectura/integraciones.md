# API e integraciones: Usuarios, Drive e IA

> Referencia vigente del código y del snapshot remoto del 7 de octubre de 2026. Consultar solo el tema que se modifica; una nota histórica no demuestra el estado de un despliegue nuevo.

| Método y ruta | Contrato y autoridad |
| --- | --- |
| GET `/api/usuarios` | Admin/Calidad, filtros search/rol/estado y proyección de perfiles |
| POST/PATCH/DELETE `/api/usuarios` | Admin, Auth administrativo + perfiles, autoprotección y último admin |
| GET/PUT `/api/configuracion/zona-horaria` | Lee solo la zona; escritura admin, clave org.zona_horaria |
| POST `/api/drive/upload` | Bearer, staff o responsable, queja resuelta por ID, folio obtenido desde DB, Analisis/ |
| POST `/api/drive/upload-public` | Sin Bearer, token activo+folio+queja Recibido, raíz del folio |
| GET `/api/drive/download?id=...` | Bearer, adjunto resuelto en DB, staff/responsable, stream y filename RFC 5987 |
| DELETE `/api/drive/delete` | Bearer, permiso según origen del adjunto, Drive primero y fila después |
| POST `/api/ai/analizar` | Bearer activo, staff o responsable de queja; módulo/entidad/tipo auto-custom |
| POST `/api/ai/test` | Admin, un proveedor/modelo por solicitud; ejecuta test en servidor |
| GET/PUT/POST `/api/configuracion/ia` | Admin activo; configuración sin secretos en respuestas, escritura, descubrimiento, conexión y memoria |

- Todas estas API usan runtime nodejs. IA analizar maxDuration=60; uploads maxDuration=120 y timeout de Drive propio de 55 s.
- Rate limits en memoria por IP/ruta: usuarios 20/min, IA analizar 10/min, IA test y configuración IA 30/min, Drive upload/upload-public/delete 30/min. No es un contador compartido entre instancias serverless.
- GET usuarios completa `ultimo_acceso` con `auth.users.last_sign_in_at` mediante Auth Admin `listUsers` paginado (1000 por lote), solo en servidor y tras autorizar admin/calidad. `lib/server/ultimoAcceso.ts` une por auth_id y devuelve únicamente el timestamp; no devuelve metadatos de Auth. El campo histórico de public.usuarios no es la fuente para perfiles ligados a Auth. Fallos de Auth devuelven 502; nunca se confunden con ausencia de ingresos. La consulta se refresca al volver a la ventana si está stale.

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
| GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY | Service Account Drive; normalizar los \\n literales. Compartir la carpeta raíz con esa cuenta |
| APPS_SCRIPT_WEBAPP_URL | Webhook opcional de extracción de contexto |
| drive_folder_id_quejas (DB) | ID de carpeta raíz para evidencias |
| org.zona_horaria (DB) | Configuración de visualización; fallback Costa Rica, no cambia automáticamente todos los RPC/fechas |
| ai_providers / ai_routing / ai_cache_ttl_minutes (DB) | Proveedores, rutas, fallback, consumo y caché IA |

`.env*`, `.next`, node_modules y .vercel están ignorados. Configurar también el entorno del despliegue; la presencia de .env.local no demuestra configuración de producción. No agregar secretos al repo. La infraestructura externa Apps Script/Drive no se verifica solo por compilar.
