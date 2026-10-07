<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ECA-QMS — guía vigente de arquitectura y trabajo

Última revisión: **7 de octubre de 2026**, después de corregir la doble transición de recarga. El snapshot remoto de Supabase del 6 de octubre verificó 33 tablas públicas con RLS, migraciones, vistas, ACL de RPC críticos, políticas heredadas y ausencia de `cron.job`; esta corrección visual/proveedores no cambia Auth ni DB.

Esta guía describe el **código local actual** y el estado remoto observado; no demuestra que Vercel ya tenga desplegado este checkout. Los cambios recientes de frontend/sesión requieren un nuevo despliegue para aparecer allí. La migración de seguridad `20261006232152` sí figura aplicada en Supabase. Conservar capacidades existentes y distinguir implementación, verificación histórica y pendientes.

## 1. Reglas para trabajar en este repositorio

- Leer `docs/visual-patterns.md` antes de cambiar apariencia y el `AGENTS.md` del subdirectorio aplicable. Conservar el bloque de Next.js que encabeza este archivo.
- Consultar las guías de la versión instalada en `node_modules/next/dist/docs/` antes de escribir código Next.js. La convención vigente es `proxy.ts`, no introducir `middleware.ts` junto a él.
- Usar los imports `@/` y las capas existentes. No añadir dependencias visuales, duplicar tokens ni introducir Server Actions o una segunda arquitectura de datos para una vista aislada.
- Para Supabase usar `.agents/skills/supabase/SKILL.md`; antes de autorar esquema, políticas, índices o SQL de seguridad, leer `.agents/skills/supabase-postgres-best-practices/SKILL.md` y las referencias pertinentes.
- Consultar esquema, políticas y privilegios efectivos antes de cambiar la DB. Los SQL históricos y este archivo pueden quedar atrás del servidor. RLS habilitada no demuestra autorización correcta.
- Respetar cambios ajenos en el working tree. No convertir una corrección visual en una ampliación de permisos.
- No copiar claves, tokens, contraseñas, datos privados ni valores de `.env.local` a documentación, consola, prompts, pruebas o artefactos. Documentar nombres de variables y claves de configuración, no sus secretos.
- En precarga y `useQuery`, una `queryFn` recibe `QueryFunctionContext`. Pasar **solo `context.signal`** a `.abortSignal(...)`; no registrar directamente una función cuyo argumento opcional sea `AbortSignal` o filtros de negocio.
- Mantener los guards de sesión/perfil/rol en cada API. El registro `API_WITH_ROUTE_AUTH` evita validación duplicada; solo incorporar un método después de comprobar su guard y probar el rechazo de tokens inválidos.
- No volver a conceder acceso autenticado a RPC legacy de quejas cerrados para resolver rápidamente un error. Migrar el cliente a los wrappers con revisión esperada; ver sección 6.
- Registrar como pendiente lo que exista solo en DB, en un componente no montado o en una utilidad sin consumidores. No presentarlo como función activa del producto.
- Al añadir una ruta privada, registrarla en `MODULOS_DE_RUTA` y comprobar lectura/escritura, API y RLS. El guard cliente de una ruta no mapeada solo exige sesión; no inventa un permiso de módulo.
- No montar hijos privados para disimular una espera: usar los skeletons de presentación, sin datos anteriores. No añadir demoras mínimas, spinners por registro, consultas para animaciones ni caché global infinita.
- Una revisión esperada o el ámbito de sesión/usuario no se pueden actualizar silenciosamente para hacer pasar una operación rechazada. Preservar conflictos, estado inactivo, separación de caché y marca de cierre pendiente.

## 2. Stack y límites de ejecución

| Capa | Implementación actual |
| --- | --- |
| Framework | Next.js **16.2.12**, App Router; React **19.2.4** |
| Datos | Supabase JS **2.111.0**, Postgres, Auth y Realtime |
| Caché | TanStack Query **5.101.4** |
| Estado de UI/sesión | Zustand **5.0.14** |
| Apariencia | Tailwind CSS v4, instalado **4.3.3**; CSS-first, sin prefijo en el runtime |
| Controles/iconos/avisos | Kit propio, lucide-react, sonner |
| Gráficos | SVG en el dashboard activo; Chart.js 4.5.1 instalado para componentes analíticos no montados allí |
| Integraciones | Google Drive con Service Account, webhook Apps Script, proveedores IA compatibles con OpenAI/Gemini/Anthropic |

- Todas las páginas de negocio y de login/formulario público son Client Components (`'use client'`). Leen datos con hooks/servicios del cliente; Reportería y algunos editores conservan consultas directas en componentes.
- `app/layout.tsx` es el wrapper de servidor normal de Next: exporta metadata y usa `next/font/google` (Inter). Monta `AuthShell` y `ToastProvider`. Un único `QueryProvider` se monta dentro de AuthShell alrededor de todas sus ramas, manteniendo el guard fuera del key de datos. No hace consultas de negocio.
- Las API, `proxy.ts` y `lib/server/*` corren en servidor. No hay Server Actions ni un flujo de consultas de negocio mediante Server Components.
- `lib/supabase.ts` es el cliente público singleton. `createServiceClient()` vive en `lib/server/supabase-admin.ts`, es server-only y evita persistir/refrescar sesiones.
- URL del proyecto: `https://fykhrrpeoehwqznccmfp.supabase.co`. El MCP de Supabase está configurado en Codex para ese proyecto; su instalación/configuración OAuth no pertenece al código de la aplicación.

## 3. Mapa de código

| Ubicación | Responsabilidad |
| --- | --- |
| `app/layout.tsx`, `components/AuthShell.tsx` | Providers, inicialización de Auth, redirecciones por sesión/permisos |
| `lib/auth.ts`, `lib/store/auth-store.ts`, `lib/authRoute.ts`, `lib/authLogoutIntent.ts` | Login, restauración verificada, decisión de ruta, descarte de respuestas tardías y cierre pendiente por pestaña |
| `components/SessionScreen.tsx` | Transición neutral de sesión, skeleton de login contextual, recuperación y acceso denegado |
| `components/AuthenticatedLayout.tsx`, `Sidebar.tsx`, `Header.tsx` | Shell responsive, menú, breadcrumbs, notificaciones y menú del usuario |
| `app/page.tsx`, `components/dashboard/QuejasSummary.tsx` | Dashboard activo por bloques y estadísticas SVG de quejas |
| `app/<modulo>/page.tsx` y `components/` de la ruta | Listados operativos, estados de UI y modales de cada módulo |
| `app/configuracion/page.tsx`, `app/configuracion/components/` | Navegación y siete secciones de configuración |
| `components/configuracion/AIProvidersManager.tsx`, `AIProviderList.tsx` | Gestor IA activo y presentación de proveedores |
| `components/header/` | Dropdowns de notificaciones y usuario |
| `components/usuarios/` | Formularios de usuarios, contraseña temporal/reset/autoservicio y confirmaciones |
| `components/quejas/` | Lista compartida de adjuntos y preview Drive/legacy |
| `components/ui/` | Kit activo: Button, Input, Textarea, Select, Field, Badge, Switch, Table, Pagination, ErrorState, EmptyState, PageHeader, DeferredMount, Skeleton, LoadingSkeleton, Spinner, OperationLoading |
| `lib/queries/` | Hooks TanStack, claves de caché, paginación y lecturas |
| `lib/services/` | Workflow de quejas, configuración, IA cliente, folios, notificaciones, sonidos y mensajes |
| `lib/server/` | Auth Bearer, permisos, cliente privilegiado, último acceso de Auth, Drive, límites, multipart, presupuestos de tiempo y registro de API con guard propio |
| `lib/ai/` | Clientes/modelos, descubrimiento, memoria, testing servidor y resultados client-safe |
| `lib/store/` | Auth/permisos/vista, sidebar y una infraestructura de acción de header todavía no consumida por el Header actual |
| `hooks/` | Precarga, Realtime, quejas vistas, breakpoints; guard de visitas disponible pero aún no integrado en los paneles de quejas |
| `lib/constants/`, `lib/errors/`, `lib/utils/`, `lib/timeZone.ts` | Roles/variantes/límites, errores seguros, formatos, logger y utilidades |
| `app/globals.css`, `app/styles/components.css` | Entrada CSS real, tokens y recetas `ui-*` |
| `supabase/*.sql`, `supabase/migrations/`, `supabase/backups/` | SQL históricos, migración reciente aplicada y metadatos de seguridad antes/después |
| `tests/`, `scripts/` | Pruebas Node con dobles de red, regresión SQL transaccional y auditorías visuales/bundle |

Los `*.styles.ts` con `tw:`, `components/ui/tailwind/`, `app/styles/tokens.css`, `app/styles/ui-kit.css`, `.experiments/` y assets `public/coreui/` son material de prototipos/referencia. La existencia del archivo no implica que participe del runtime.

## 4. Autenticación, roles y permisos

### Identidades y sesión

- Supabase Auth usa email/password. **`auth.users.id` se relaciona con `usuarios.auth_id`; no con `usuarios.id`.** Los responsables y autores de negocio referencian `usuarios.id`.
- `lib/auth.ts` contiene `signIn`, `signOut`, `getAppUser`. El perfil determina rol/estado; una cuenta que no sea `activo` se rechaza. El rol operativo llamado «superadmin» por el usuario es `admin`; no hay un rol `superadmin` integrado. No usar `user_metadata` editable como autorización.
- `lib/supabase.ts` usa el cliente JS estándar; el SDK administra persistencia/refresco de tokens del navegador. El store Zustand no es la autoridad de los datos. La aplicación no implementa una capa de sesión SSR con cookies HttpOnly ni un guard de páginas privadas en el proxy: las páginas prerenderizan una presentación neutra y las API validan Bearer en servidor.
- El store contiene `user`, `permisos`, `vistaActiva`, `loading`, `initialized`, `signingOut` y preferencias. `app_mis_permisos` carga permisos propios; errores producen lista vacía. `fetchPermisosByRol` es para simulación visual.

### Inicio, restauración y cierre: orden obligatorio

| Operación | Flujo real y condición para publicar contenido |
| --- | --- |
| Inicio sin credenciales | `init` se ejecuta una vez, registra listener y lee `getSession`. Sin sesión termina la inicialización y la ruta privada redirige a login |
| Restaurar una sesión | `getSession` detecta credenciales → `getUser` confirma identidad coincidente → perfil y permisos en paralelo → exigir perfil activo y revisión de sesión vigente → publicar usuario/permisos juntos |
| Login explícito | Email normalizado trim/lowercase → `signInWithPassword` → perfil activo → `getUser` y permisos en paralelo → comparar authId con resultado del login y revisión vigente → publicar → `router.replace('/')` |
| Evento de Auth | Callback síncrono, sin esperar otras llamadas SDK. Ignora INITIAL_SESSION porque init ya tiene lector; difiere resolución con setTimeout(0) para salir del bloqueo de Auth |
| Refresh/foco de la misma identidad | SIGNED_IN/TOKEN_REFRESHED no reinician permisos, vista o caché si el usuario ya está resuelto |
| Cambio de identidad / SIGNED_OUT | Incrementar revisión y retirar perfil anterior. Descartar respuestas tardías de identidad, perfil, permisos, login y vista; el nuevo usuario se publica solo al resolver sus comprobaciones |
| Logout | Marcar cierre pendiente → incrementar revisión y retirar user/permisos/vista inmediatamente → desmontar ámbito privado de caché → esperar `signOut` → finalizar estado cerrado |
| Recarga durante logout | Detectar marca antes de leer getSession y continuar cerrando. Los eventos automáticos no pueden restaurar el perfil anterior |

`lib/authLogoutIntent.ts` guarda solo `qms:logout-pending=true` en sessionStorage por pestaña, además del bloqueo en memoria: no guarda tokens ni identidad. Un cierre inesperadamente fallido conserva la marca; completar logout o un login explícito confirmado la retira. Si Storage no está disponible, el bloqueo en memoria solo protege el documento actual. Un login no se inicia mientras el cierre está en curso.

### Decisión de ruta y presentación de sesión

`AuthShell` consume `authRoute`; la redirección es asíncrona y **la decisión de render debe bloquear también la espera de `router.replace`**. Nunca devolver los hijos privados porque todavía no existe user. Esto evita el dashboard desnudo antes de login y al salir.

| Estado | Qué se monta |
| --- | --- |
| No inicializado / loading | Transición neutral en URL privada, también en HTML inicial; login solo en su URL o durante cierre. No anticipar ningún módulo |
| Ruta privada sin usuario | Skeleton de login mientras redirige a `/login` |
| Login con usuario validado | Transición neutral mientras redirige a `/`; el dashboard carga sus datos después de autorizar |
| Ruta con permiso de lectura | AuthenticatedLayout y después los hijos privados |
| Ruta sin lectura | Redirigir a `/mis-quejas` o `/` únicamente si tienen lectura; transición neutral durante la redirección |
| Sin destino autorizado | Explicación estática de acceso denegado y acción Cerrar sesión; no montar módulos ni crear bucles |
| `/login` o `/q` por segmento | Contenido público al completar el bootstrap; no exige iniciar sesión para usar el formulario ciudadano |

- `SessionScreen` usa una transición neutral (solo fondo, sin barra ni animación) mientras restaura una URL privada. Login/logout/destino confirmado a login usan la silueta de login. No existe workspace global; tras validar solo se monta la carga propia del módulo solicitado. No incluye nombres, cifras, datos previos, enlaces ni controles operativos. Mensajes normales solo para lector de pantalla; tras 10 s muestra Reintentar, que recarga y vuelve a validar. No abre el panel ni agrega una espera mínima. Ver contrato visual en sección 10.
- `/configuracion` y `/usuarios` conservan además guard duro `user.rol === 'admin'`, incluso al simular otro rol.
- El cierre inmediato de la UI no equivale a invalidación instantánea de todos los JWT ya emitidos. Las API actuales validan `getUser(token)` y perfil activo, sin comprobación adicional de `auth.sessions.session_id`. La duración/revocación de tokens depende de Auth; no prometer revocación universal inmediata. Fuente: [sesiones de Supabase](https://supabase.com/docs/guides/auth/sessions).

### Permisos de presentación

- `permisos` tiene PK `(rol, modulo)`, columnas `leer` y `escribir`.
- Módulos de ruta: `dashboard`, `quejas`, `mis_quejas`, `documentos`, `sacp`, `riesgos`, `auditorias`, `revision`, `procesos`, `usuarios`, `configuracion`, `reporteria`.
- `tienePermiso` exige lectura y, cuando se solicita, escritura. Su excepción explícita de admin es **Configuración**; no asumir que el helper frontend concede todos los módulos a admin.
- Sidebar filtra enlaces con esos permisos. No todas las páginas ocultan sus botones de escritura cuando `escribir=false`; una operación puede terminar rechazada por RLS.
- Roles con etiquetas/colores en `lib/constants/roles.ts`: admin, calidad, colaborador, coordinador, revisor, usuario. Las comprobaciones operativas de las API de Usuarios y del workflow reconocen principalmente admin/calidad/colaborador; no confundir los seis rótulos con seis roles completamente implementados.
- `setVistaActiva` cambia permisos visibles y el ámbito de caché, no el usuario de Auth ni el rol de DB. No usar esa simulación para ampliar privilegios.
- Los roles de Postgres `anon`/`authenticated`/`service_role` y los roles operativos del perfil son capas distintas. El backend y los RPC resuelven el perfil real; «authenticated» por sí solo no significa admin ni autorización para todos los módulos.

### Autenticación y autorización de API

- `getAuthToken` lee Bearer. `getCurrentUser` valida con `auth.getUser(token)`, consulta `usuarios` por `auth_id`, exige `estado='activo'` y devuelve `{id, auth_id, rol, email}`.
- `proxy.ts` cubre `/api/:path*`, elimina `x-user-id`, `x-user-role`, `x-user-email` aportados por el cliente y devuelve 401 sin Bearer en API privadas.
- `/api/drive/upload-public` es la excepción pública exacta; el endpoint valida token/folio/archivo.
- Los métodos de `lib/server/apiAuthentication.ts` validan sesión dentro del handler una sola vez: Usuarios GET/POST/PATCH/DELETE, IA analizar/test POST, zona horaria GET/PUT, Drive upload POST/download GET/delete DELETE.
- Una API o un método no registrado conserva el guard completo del proxy. En ese caso, los encabezados de identidad verificados se reenvían como **request headers**, no a la respuesta del navegador.
- Los handlers registrados no confían en encabezados de identidad. No quitar su guard por asumir que el proxy ya consultó Auth.
- `checkModuleAccess(usuariosId, rolReal, modulo, requireWrite)` es un helper server-only disponible: compara perfil activo/rol real, permite admin y consulta permisos con lectura antes de escritura. No está aplicado como middleware universal de todos los endpoints.
- Los endpoints con service role deben autorizar explícitamente usuario/rol/entidad: service role evita RLS y no sustituye la validación del llamador.

### Protección implementada y límites de acceso

| Capa | Implementado hoy | Alcance que no debe atribuirse a esa capa |
| --- | --- | --- |
| Guard cliente | Bloqueo de montaje, permisos de lectura, transición neutra y aislamiento entre sesiones | No autoriza una solicitud directa al Data API o a una API |
| API privadas | Bearer validado por Auth, perfil activo, roles/entidad según handler; identidad falsificada por headers descartada | `checkModuleAccess` no está integrado universalmente |
| RPC versionados de quejas | Staff/responsable real, revisión esperada, bloqueo/transición en DB | No conceder EXECUTE legacy ni reintentar con una revisión nueva para forzar un cambio |
| RLS/ACL | Reglas por fila, columnas protegidas, vistas invoker y RPC internos cerrados | 33/33 con RLS no demuestra políticas estrictas en todas las áreas |
| Rate limit propio | Por IP y scope en API seleccionadas, limpieza cada 30 s y máximo 10 000 entradas en memoria | No es distribuido entre instancias Vercel; no cubre el endpoint de login externo de Supabase |
| Sesión/contraseña | Email/password, rechazo de inactivos, autoservicio de contraseña y administración Auth en servidor | No hay flujo 2FA/MFA, captchaToken/reCAPTCHA/Turnstile ni bloqueo persistente propio por intentos de login en este checkout |

No se ha auditado aquí la configuración completa del servicio Auth (cuotas de login, expiraciones, restricciones de sesión o CAPTCHA del proyecto). La integración del cliente no prueba esos ajustes. Mantener cualquier configuración futura de seguridad fuera de componentes puramente visuales y verificar su enforcement en servidor/proveedor.

### RLS real, verificada en el servidor

Las **33 tablas públicas** tienen RLS habilitada. Su alcance efectivo es desigual:

| Área | Autorización real actual |
| --- | --- |
| Usuarios | Propio (también inactivo para que login lea el motivo), staff activo y lectura de módulo; colaboradores pueden ver autores de comentarios de sus quejas visibles. UPDATE propio solo activo y por columnas seguras |
| Columnas de Usuarios | Cliente puede cambiar nombre, teléfono, avatar, último acceso y preferencias; no `rol`, `estado`, `auth_id`, `id`, email, departamento ni created_at. Administración por API/service role |
| Quejas/comentarios | SELECT staff admin/calidad activos; colaborador activo con `mis_quejas` y responsable propio. Mutaciones del workflow mediante RPC |
| Adjuntos | SELECT staff o colaborador responsable. **Existe además una política heredada INSERT para staff**; no afirmar que RLS prohíbe todo INSERT directo, aunque la aplicación use RPC |
| Actividad de quejas | Lectura/escritura por permiso `quejas`, o por `mis_quejas` y queja propia |
| Permisos | Lectura staff activo; escrituras admin activo |
| Documentos/Auditorías | SELECT por lectura del módulo; INSERT/UPDATE/DELETE por lectura+escritura; admin activo conserva autoridad |
| Informes guardados | RLS activa; lectura por Reportería, creación/edición del propio autor con escritura, override admin y DELETE solo admin |
| Notificaciones | SELECT/UPDATE propias, usando la identidad operativa activa |
| Catálogos/SLA | Escritura admin, pero conviven políticas SELECT amplias para authenticated. Catálogos anon: solo categoría de quejas activa |
| Configuraciones | Escritura admin. **La política heredada `configuraciones_sistema_select USING(true)` permite lectura a authenticated**; el guard de Configuración no elimina esa exposición |
| Formularios públicos | Anon lee activos. Hay políticas heredadas INSERT/UPDATE/DELETE `true` para authenticated además de la política admin; el límite admin de la UI no se cumple completamente en DB |
| Acciones, Riesgos, Procesos, Reuniones, Hallazgos, versiones/solicitudes documentales y Tareas | Políticas ALL heredadas basadas en `auth.role()='authenticated'`; no están alineadas universalmente con permisos por módulo ni estado activo |
| Logs/mail_queue | Políticas INSERT para authenticated; no hay lectura general por cliente |
| Motor QMS | Reglas/calendarios legibles por sesión, ejecuciones por quejas visibles y eventos por expedientes visibles. Auditoría de configuración solo admin |
| Tablas internas cerradas | `folios_quejas_anuales` y `qms_deadline_notices` tienen RLS sin políticas de cliente; acceden funciones/roles privilegiados |

Las políticas permisivas se combinan con OR. Añadir una política estricta no corrige otra antigua amplia. No afirmar que todas las claves IA están privadas: están en `configuraciones_sistema`, cuya lectura heredada es un pendiente de seguridad.

## 5. Datos, caché, navegación y errores

### Lecturas y claves

- `queryKeys.ts` centraliza prefijos. Invalidar el prefijo del módulo tras mutar; el dashboard comparte prefijo `['dashboard']` para todos sus recursos.
- `QueryProvider` crea un cliente por ámbito `usuarioId:rolReal:vistaActiva` y vacía el anterior al desmontar. Es un wrapper incondicional dentro de AuthShell: solo ScopedQueryProvider lleva key, por lo que el cambio de ámbito no remonta el guard ni reinicia sus efectos. Navegación y redirecciones del mismo ámbito conservan caché; usuario/rol/vista distintos la separan. El init del store ya era idempotente: no atribuir al antiguo remount una validación remota duplicada sin medirla.
- `cacheConfig.ts` usa el primer elemento de la clave. Catálogos/SLA/permisos se mapean a configuración; `quejas_actividad` a quejas.

| Prefijo | staleTime | gcTime |
| --- | --- | --- |
| Dashboard / default | 60 s | 5 min |
| Quejas / actividad de quejas | 30 s | 3 min |
| Notificaciones | 15 s | 1 min |
| Configuración, catálogos, SLA, permisos | 10 min | 30 min |

- Global: `refetchOnWindowFocus=false`, `refetchOnMount=true` y `refetchOnReconnect=true` (solo obsoletos), `retryRead` con máximo un reintento recuperable y ninguno para 401/403/validación; mutaciones sin retry.
- Quejas/listado y estadísticas conservan `refetchOnMount:'always'` y focus=true. Notificaciones hacen polling cada 60 s y pueden deshabilitar la consulta por preferencias.
- Hooks analíticos no montados actualmente y zona horaria tienen TTL propios de 5 min; no asumir que el TTL global reemplaza cada override.
- `pagination.ts`: páginas de 25, count exacto, filtro de estado antes de range, orden principal descendente + `id` ascendente. Se usa en Auditorías, Documentos, Procesos, Reuniones, Riesgos y SACP.
- Quejas: filtros folio/cliente, estado, prioridad, responsable; count exacto; `fecha desc, id asc`; `keepPreviousData`. Búsqueda con `useDeferredValue` y página de 25.
- Usuarios: API y parámetros normalizados; `usuariosQueryKey()` es la clave compartida entre página y precarga.
- `useHoverPrefetch`: intención de 80 ms por hover/foco/tacto del Sidebar, uno o varios configs, deduplicación en vuelo y caché fresca respetada por TanStack. El dashboard precarga sus cuatro recursos, no una consulta incompatible distinta. Mis Quejas precarga su clave con responsableId propio; sin id no consulta. Reportería no inserta datos ficticios en caché.
- Cancelación real con `.abortSignal(signal)` está integrada en recursos del dashboard, actividad del dashboard y algunas lecturas analíticas. **No todos los hooks operativos/paginados propagan aún el signal al transporte**.
- `containsPattern()` existe para escapar literales en `or().ilike`, pero las búsquedas actuales de Quejas y la API de Usuarios aún interpolan texto directamente en la gramática. Es un pendiente, no una corrección ya activa.

### Realtime

- Publication `supabase_realtime`: acciones, auditorias, documentos, hallazgos, notificaciones, procesos, queja_adjuntos, quejas, quejas_actividad, quejas_comentarios, reuniones, riesgos.
- Consumidores activos principales: listado de Quejas, Header para notificaciones por usuario y QuejasSummary para estadísticas. Estar publicado no implica que cada página ya tenga suscripción.
- `useRealtimeSubscription` escucha `*`, filtra los eventos solicitados y usa debounce de 750 ms para invalidar prefijos. Por código, el default efectivo incluye INSERT/UPDATE/DELETE, pese al comentario antiguo del hook.
- El hook actual no agrega resincronización explícita de datos al reconectar el canal ni deduplicación de prefijos solapados. Al desmontar elimina canal/cancela el timer; las pruebas de esos bordes siguen pendientes.

### Errores y operaciones concurrentes

- `lib/errors/userError.ts` y `httpError.ts`: mensajes seguros, recuperación, SQLSTATE/HTTP y conservación del status en los consumidores que los usan. No enviar diagnostics SQL/URLs/credenciales crudos a la UI.
- `errorToast.ts` envuelve sonner con mensajes seguros. `useApiError` normaliza `{message,status,details}` (details solo código seguro) y registra contexto; está disponible, no migró automáticamente cada pantalla.
- `logger.ts`: niveles ERROR/WARN/INFO/DEBUG, timestamp ISO, módulo/acción/usuario/status/código, detección server/client. Usa consola también en producción; Sentry/LogRocket no están integrados. Dashboard y caché lo consumen; persisten console.* legacy en otros módulos.
- Boundaries: `app/error.tsx`, `app/global-error.tsx` (html/body), `app/quejas/error.tsx`, `app/documentos/error.tsx`; mostrar recuperación/refetch o reset.
- `createRequestScope`/`useEntityRequestGuard` modelan una visita A→B→A distinta y descartan respuestas tardías. **No están conectados todavía a los handlers de los paneles de quejas**. Esos paneles resetean UI al cambiar ID, pero no garantizan aislamiento de todas las respuestas IA/subidas/transiciones en vuelo.

### Reglas de rendimiento que deben conservarse

- Mostrar caché fresca al volver a un módulo y refrescar según sus reglas; no borrar datos globalmente al navegar. Cambiar de usuario/rol real/vista sí cambia el ámbito y vacía la caché anterior.
- Compartir claves y queryFn entre precarga y vista: el dashboard usa cuatro recursos compartidos para indicadores/tareas, frente a seis lecturas anteriores. Estadísticas de Quejas y actividad son consultas adicionales independientes; no afirmar que toda la página hace únicamente cuatro requests.
- Resolver identidad antes de datos de perfil; paralelizar solo lecturas independientes. Cada bloque de dashboard se revela al completar sus dependencias: tareas necesitan Quejas+Acciones; indicadores necesitan sus cuatro recursos; QuejasSummary y actividad tienen sus propios estados.
- Eliminar la doble comprobación de Auth solo para métodos registrados que ya tienen guard completo. No reutilizar una autorización guardada entre requests ni sacrificar comprobación de perfil activo para ahorrar latencia.
- Páginas operativas de 25 y consultas de resumen acotadas; reportería lee lotes de 500 con tope de 5000. Último acceso usa Auth Admin paginado por lotes de 1000, sin una solicitud por perfil. Ese escaneo puede crecer con el directorio Auth y no es un indicador de presencia en vivo.
- `DeferredMount` aplaza montaje de modales/secciones y conserva borradores después de abrir; no es descarga diferida. Mantener hooks enabled por apertura/sección cuando ya lo implementen; evitar consultas de paneles invisibles.
- Precarga del Sidebar por intención hover/foco/tacto: 80 ms, deduplicación en vuelo, claves reales y filtro propio en Mis Quejas. No precargar todas las páginas/datos al iniciar ni fabricar filas vacías en caché para aparentar carga.
- Skeletons y spinners son CSS con movimiento reducido, cantidad fija de formas y sin queries/timers JS por registro. No poner relojes/spinners permanentes por fila ni una duración mínima de espera.
- La comprobación actual verifica reutilización, cantidad de consultas y aislamiento; **no hay un benchmark autenticado completo con miles de registros ni una garantía de latencia constante**. Medir Network/React Profiler en producción antes de optimizar nuevos cuellos de botella, diferenciar dev de build de producción y no cambiar TTL a infinito para esconderlos.

### Auditoría de negocio y diagnóstico técnico

| Fuente | Qué contiene / quién la consume |
| --- | --- |
| `logs` | Auditoría de operaciones de los RPC legacy/workflow que la escriben: fecha, usuario, acción, módulo y detalle **text**. No es una captura universal de cada API o cambio |
| `quejas_actividad` | Historia operativa del expediente; panel de colaborador y las últimas cinco entradas del dashboard |
| `qms_config_audit` | Historia de configuración versionada/catálogos, actor y motivo, `old_value/new_value` JSONB; acceso de administración en DB, sin visor completo montado |
| `qms_case_events` | Eventos de apertura/cierre/resolución generados por triggers QMS; distintos de quejas_actividad |
| `qms_stage_runs.snapshot` | Copia inmutable de regla/calendario usados en un plazo; sirve para explicar su cálculo |
| Logger de aplicación | Contexto seguro con timestamp/entorno/módulo/acción/usuario/status/código en consola cliente o servidor; QueryProvider, Auth y dashboard registran errores. No persiste automáticamente en DB ni en una plataforma de observabilidad |
| Supabase/Vercel | Herramientas externas para logs/asesores. No hay un conector de esas fuentes a un visor dentro del panel actual |
| `/auditorias` | Auditorías de calidad y hallazgos de negocio; no es un diagnóstico de seguridad, errores de runtime o salud de la DB |

Los boundaries muestran recuperación y los servicios usan mensajes sanitizados donde están integrados; todavía hay consumidores/console.* legacy. Login conserva un mensaje compuesto con `error.message` del SDK en `signIn`; no afirmar que todos los errores visibles ya pasan por `getUserError`.

El «Estado del sistema» estilo Wordfence, alertas de errores inesperados, controles de 2FA/CAPTCHA y métricas reales dentro del panel siguen **propuestos, sin UI/backend integrado**. JSONB ya existe en configuración/snapshots/auditoría QMS, pero no hay una tabla nueva de telemetría, ingesta de errores ni limpieza anual automática instalada. Definir cobertura, acceso, redacción de datos sensibles y retención antes de implementarlos; no inventar diagnósticos ni usar logs de auditoría de negocio como temporales descartables.

## 6. Páginas y lógica de negocio

| Ruta | Qué monta y hace hoy | Límite / pendiente |
| --- | --- | --- |
| `/` | PageHeader, QuejasSummary lazy/Suspense, indicadores por módulo, ocho expedientes próximos y actividad real | No monta los tabs analíticos alternativos |
| `/quejas` | Tabla con filtros, paginación, categorías/estados/prioridades, antigüedad SLA, vistas locales, precarga de adjuntos, alta y detalle | Edición y transición por wrappers QMS con revisión esperada; SLA visual aún legacy |
| `/mis-quejas` | Filtra responsable_id=usuario real, tabla y panel fixed con Detalle/Análisis/Resolución | No permite adoptar otro responsable simulando rol |
| `/configuracion` | Siete secciones agrupadas en Organización/Acceso/Servicios; solo admin | Editor de SLA legacy no publica versiones QMS |
| `/procesos` | Listado paginado y alta nombre/tipo/objetivo/estado | Documentos vinculados/KPIs no constituyen un gestor completo |
| `/auditorias` | Listado paginado, alta y modal de hallazgos asociados | Hallazgos de solo lectura, sin CRUD/derivación UI |
| `/riesgos` | Listado paginado, alta y matriz 3×3 | No hay motor completo de seguimiento de mitigaciones |
| `/revision` | Reuniones paginadas, alta y detalle | Acta Drive/acuerdos no tienen workflow documental completo |
| `/documentos` | Todos/Maestra(Publicado)/Edición(Borrador), alta y cambio directo de version_actual | Historial placeholder, sin versionado/Drive completo |
| `/sacp` | Listado paginado, alta, porcentaje de seguimiento y cierre | Validación avanzada/eficacia y campos administrativos incompletos |
| `/usuarios` | Solo admin, búsqueda diferida/rol/estado, alta/edición/eliminación/reset mediante API | Diferencias entre roles ofrecidos y persistencia; validación compartida no integrada |
| `/reporteria` | Wizard módulo→filtros→tabla/resumen/distribución/vencidos e impresión | No guarda informes_config ni envía/exporta documentos por un servicio |
| `/q/[token]` | Formulario ciudadano sin sesión, valida enlace, crea queja y adjunta evidencias | Tipo/área nuevos de DB no integrados en este formulario |
| `/login` | Email/password Supabase + resolución de perfil y acceso | No signup/recuperación pública completos en la UI actual |

### Dashboard activo

- `useDashboardIndicadores`/`useDashboardTareas` usan `useQueries` y **comparten cuatro consultas** bajo `['dashboard','recurso',nombre]`: Quejas, Acciones, Documentos y Riesgos.
- Quejas y Acciones devuelven count exacto + ocho filas ordenadas por vencimiento; Documentos y Riesgos usan HEAD/count. Las tareas combinan las dos listas y eligen los ocho vencimientos más próximos, poniendo sin fecha al final.
- Indicadores: Quejas fuera de Finalizado/No Procede/Cerrada, SACP no Cerrada, documentos Borrador y riesgos Activo.
- Un fallo/lentitud de Documentos no bloquea las tareas de Quejas/SACP. `DashboardLoading.tsx` muestra skeletons proporcionales al contenido (summary/modules/table/activity), con role=status y texto solo para lectores de pantalla, respetando movimiento reducido. Formas de cantidad fija, sin animaciones por registro ni tarjetas anidadas. Cada bloque se revela en cuanto está listo; reintento por bloque.
- Los listados/lecturas de detalle y las operaciones comparten el contrato de carga descrito en sección 10.
- Actividad: últimas cinco filas de `quejas_actividad`, orden `created_at desc, id`; **no está hardcodeada**.
- QuejasSummary dibuja SVG para resolución dentro de plazo, procedencia y volumen total/mes; usa `obtener_estadisticas_quejas` y permiso de quejas. El RPC es SECURITY INVOKER y respeta RLS.
- `fetchDashboard`/`useDashboard` permanecen por compatibilidad, pero no son los hooks montados por la página activa.
- GeneralTab/QuejasTab/SacpTab/DocumentosTab/RiesgosTab, ModuleTabs, Chart/ChartCanvas y hooks de análisis existen como implementación alternativa con kit `tw:`. No afirmar que están activos ni importarlos como patrón visual nuevo.

### Workflow de quejas: cliente versionado y reglas vigentes

El cliente presenta `Recibido → No Procede | En Investigación → [Pendiente de Revisión GC] → Resuelto → Finalizado`; permite reapertura desde estados admitidos por DB. Reglas visibles:

- No Procede exige resolución/justificación; Procede exige justificación y responsable antes de iniciar investigación.
- Durante investigación el detalle presenta responsable fijo; un helper de selección permite actualizarlo en otras situaciones no Recibido. No afirmar que es inmutable en toda la DB.
- El colaborador escribe conclusión y envía a Pendiente de Revisión GC; GC aprueba Resuelto o devuelve a En Investigación. Finalización/reapertura son de staff; la DB decide permisos y transiciones.
- Comentarios internos/cliente y flag visible_cliente van por `agregar_comentario_queja`; el flag no implementa un portal de seguimiento ciudadano.
- Derivación a SACP en investigación/resuelto, idempotente por RPC: crea acción de origen queja y guarda derivado_sacp_id.
- Antigüedad visible del listado se calcula desde `fecha` con `sla_config` por prioridad (fallback 3/7 días); **no es la presentación del motor QMS de etapas**. `ahora` se captura con useState al montar; no hay actualmente interval de 60 s en esa página.
- `useQuejasVistas` persiste por usuario en localStorage, máximo 500 registros. Abrir marca en requestAnimationFrame; botón de no vistas marca las de la página. Ambos listados distinguen visualmente las no leídas.
- Mis Quejas conserva tabla min-width 1200px; panel fixed de ancho completo en móvil y 500px desde lg, expandible a ancho completo. Solo desde lg reserva margen `calc(500px - 16px)`; la tabla mantiene su ancho mínimo extra de 484px al abrir.

`quejaWorkflowService.ts` usa `qms_update_details(p_id,p_expected,p_categoria,p_prioridad,p_owner,p_notes)` y `qms_transition(p_id,p_expected,p_state,p_resolution,p_justification,p_owner,p_reopen)` con **la revisión que el usuario editó**. `Queja.revision` es obligatorio y se valida antes de enviar. Los códigos estables del workflow están en `CODIGOS_ESTADO_QUEJA`; los argumentos opcionales siempre se envían como null cuando no aplican.

El resultado actualizado reemplaza el expediente abierto solo si conserva el mismo id, y luego invalida los listados. Un conflicto 40001 avisa que otro usuario modificó el registro y exige revisar/refrescar; nunca leer una revisión fresca para reintentar silenciosamente ni reabrir permisos legacy. `reabrirQueja` usa también qms_transition con motivo. Las funciones legacy siguen cerradas para authenticated y son invocadas únicamente por los wrappers. Los atributos nuevos y el SLA visual todavía necesitan integración aparte.

### Formulario público y archivos

- Formulario público consulta `formularios_publicos` por token/activo. La UI actual exige una categoría fija: Queja, Denuncia, Sugerencia, Reclamo, Felicitación; no usa catálogo ni el tipo separado nuevo.
- Orden: `crear_queja_publica` devuelve folio → subir cada evidencia a `/api/drive/upload-public` → registrar con `registrar_adjunto_queja_publica` → `notificar_queja_publica(p_folio)`. El ciudadano recibe su folio aunque fallen evidencias; la UI avisa cuántas fallaron.
- Creación pública no dispara por sí sola la notificación legacy; se difiere hasta después de las evidencias. El RPC de notificación evita duplicados por tipo queja_nueva + origen_id, inserta notificaciones staff y mail_queue. No hay entrega de correo implementada.
- Registro público exige queja Recibido y aplica el tope de diez adjuntos; `usuario_id=NULL` identifica evidencia del ciudadano.
- Archivos nuevos van a **Google Drive**, no a Storage. Carpeta raíz configurable por `drive_folder_id_quejas`; subcarpeta por folio. Evidencias del ciudadano en raíz del folio; investigación interna en `Analisis/`.
- Límite vigente: **4 MiB por archivo** (`MAX_FILE_BYTES`); cuerpo multipart acotado a ese límite +128 KiB antes de interpretar FormData, incluso sin Content-Length. No restaurar el antiguo límite de 50 MB.
- MIME permitidos: PDF, JPEG, PNG, WebP, Word DOC/DOCX, Excel XLS/XLSX y texto. Vacío=400, exceso=413, MIME fuera de allowlist=415.
- Upload Drive usa multipart/related con fetch/undici, Content-Length y timeout de 55 s; normaliza accessToken string/objeto. googleapis sirve para JWT, carpetas, descarga y eliminación.
- Los metadatos conservan dual-write legacy: nombre/nombre_archivo, storage_path/url_archivo. `esDrive(path)` detecta ID sin `/`; paths con `/` siguen el bucket privado legacy `quejas-adjuntos`.
- Descarga Drive: fetch Bearer al endpoint, streaming→Blob→ObjectURL→download. Legacy: URL firmada 60 s. Preview: iframe Drive o blob/URL legacy; depende también de los permisos de Google.
- Evidencias visibles en todos los estados; subida de investigación solo durante En Investigación. Eliminación del ciudadano solo admin; de análisis staff o responsable, con confirmación.
- Eliminación segura actual: **borrar Drive primero, luego la fila**. Si Drive falla se conserva la fila y responde 502; Drive 404 se trata como éxito para reintentar una fila cuyo archivo ya desapareció. No es una eliminación fire-and-forget.
- `programarContextoDrive` usa `next/server.after`, webhook opcional con `{folderId}`, hasta tres intentos, timeout 8 s y pausas crecientes. El extractor Apps Script es externo; el repositorio integra su invocación, no su implementación/despliegue.

### Configuración y catálogos

- `app/configuracion/page.tsx` organiza navegación/guard/montaje. Paneles: General, Catálogos, SLA, Roles, Vistas, Formularios, IA. `DeferredMount` monta una sección al visitarla y conserva borradores; hooks de editores usan enabled=active. IA se monta al abrir y su gestor mantiene carga propia.
- Servicios de escritura en `configuracionService.ts`; validaciones en `lib/utils/configuracion.ts`. General conserva el tipo JSON del valor y excluye `ai_*`; zona horaria tiene editor/endpoint propios.
- Catálogos: cascada modulo→tipo, orden/color/activo. En selectores activos usar `.or('activo.is.null,activo.eq.true')`; el editor muestra también inactivos.
- La DB agregó `codigo` y `valor_interno`: código/interno son inmutables; etiqueta/color editables. `qms_catalog_guard` impide DELETE, cambio de módulo/tipo y creación/desactivación arbitraria de estados.
- El servicio/UI legacy aún intenta borrar filas y no integra completamente códigos internos. Al corregirlo, ofrecer desactivación/historial; no quitar el trigger para hacer funcionar el botón.
- SLA legacy escribe `sla_config`: días enteros, alerta>=0, vencimiento>=1 y alerta<=vencimiento. **No publica `qms_stage_versions` ni calendarios**; ver motor real de DB.
- Roles y Accesos hace upsert por rol/módulo; requiere Ver antes de Editar y bloquea Configuración para admin. Los permisos del store se recargan al recuperar sesión/vista, no hay suscripción dedicada a cambios de permisos.
- Formularios: crear/copy URL/activar/desactivar/eliminar con confirmación; verificar RLS heredada amplia antes de asumir que solo admin puede mutarlos por Data API.
- Zona horaria: clave `org.zona_horaria`, fallback America/Costa_Rica; GET para cualquier perfil activo, PUT admin, validación Intl. La configuración se usa en análisis/helpers conectados; no todos los widgets ni el motor QMS usan esa clave.

### Otros módulos

- SACP: alta con folio, tipo, descripción y fecha límite; estado Abierta, avance 0. Avance 100→En Validación. El botón de cierre se muestra desde En Validación y escribe Cerrada/100; la UI no sustituye una máquina de estados transaccional de DB.
- Origen/origen_id se escriben en derivación desde quejas. Eficacia, validado_por_gc, notas, responsabilidad y prioridad no tienen edición completa en el flujo actual de SACP.
- Riesgos: probabilidad×impacto con escala 1–3. <=2 Bajo, <=4 Medio, <=6 Alto, >6 Crítico; matriz 3×3. Alta directa de atributos y nivel.
- Auditorías: alta con folio (manual o RPC), tipo/área/fechas/objetivo/alcance. Hallazgos asociados solo se listan; badge derivado_sacp_id no implementa derivación.
- Documentos: alta con código/título, versión 1.0 y Borrador; `generar_folio_documento` existe pero no se usa aquí. Cambiar versión solo actualiza `documentos.version_actual`; el historial muestra un placeholder y no inserta versiones.
- Revisión por Dirección: altas/listado/detalle de reuniones, agenda/fechas. Acta Pendiente/Registrada con texto e icono estático; no usar spinner para un estado permanente. No se implementa un gestor de actas o acuerdos con Drive completo.
- Reportería: módulos Quejas/SACP/Documentos/Auditorías/Riesgos/Revisión; filtros de fechas/estado/prioridad/tipo. Lee lotes de 500 ordenados por id, tope 5000 filas y exige restringir filtros al superarlo. `window.print`/CSS de impresión; no persiste informes_config.
- Usuarios: GET API permite admin/Calidad (directorio de responsables); POST/PATCH/DELETE solo admin. Alta Auth+perfil y rollback de Auth al fallar el INSERT; comprobación de auto-desactivación/auto-rol/auto-borrado y del último admin activo (409). Esta última usa COUNT antes de la escritura, sin bloqueo transaccional de ambos administradores; no garantiza por sí sola el caso concurrente. Cambios Auth/perfil son llamadas separadas, no una transacción distribuida.
- UI de usuarios/reset usa `generatePassword()` criptográfico con composición. **Fallback de la API actual es `crypto.randomUUID().slice(0,16)`**, no ese mismo generador. API reconoce admin/calidad/colaborador y normaliza otros valores a calidad. `validarUsuarioInput` existe pero el route actual no lo usa; no afirmar validación completa antes de tocar Auth.
- Cambio de contraseña propia: `supabase.auth.updateUser`, sin service role en navegador.

## 7. API de servidor e integraciones IA

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

- Todas estas API usan runtime nodejs. IA analizar maxDuration=60; uploads maxDuration=120 y timeout de Drive propio de 55 s.
- Rate limits en memoria por IP/ruta: usuarios 20/min, IA analizar 10/min, IA test 30/min, Drive upload/upload-public/delete 30/min. No es un contador compartido entre instancias serverless.
- GET usuarios completa `ultimo_acceso` con `auth.users.last_sign_in_at` mediante Auth Admin `listUsers` paginado (1000 por lote), solo en servidor y tras autorizar admin/calidad. `lib/server/ultimoAcceso.ts` une por auth_id y devuelve únicamente el timestamp; no devuelve metadatos de Auth. El campo histórico de public.usuarios no es la fuente para perfiles ligados a Auth. Fallos de Auth devuelven 502; nunca se confunden con ausencia de ingresos. La consulta se refresca al volver a la ventana si está stale.

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
- `modelTesting.ts` ejecuta pruebas servidor; `modelTestingClient.ts` solo administra resultados `ai_test_resultado_*`. UI itera POST /api/ai/test, presenta progreso/resultado y permite cancelar su flujo.
- Gestor activo: CRUD de proveedores, prueba de conexión, sincronización/test, modelos únicos auto-seleccionados, presets 30M/6M/250k tokens, barra de consumo y routing/fallback. El límite configurado presenta consumo; no hay una condición de bloqueo por cuota en el endpoint analizar actual.
- Reset mensual compara `tokens_updated_at`; incremento posterior por RPC `incrementar_tokens_proveedor`, exclusivo service role, JSON validado y fila bloqueada FOR UPDATE. No llamar ese RPC desde el navegador.
- `.contexto_qms.txt` se descarga de Drive y se añade como contexto al prompt. El endpoint puede continuar sin él; no guarda evidencias en disco. Ese texto externo no es una autorización ni una protección infalible contra prompt injection.
- IA visible en Mis Quejas: análisis automático, chat custom, lectura Markdown y textarea de edición. El resultado se mantiene en estado del panel; no hay historial IA persistente completo.
- **Claves IA no son totalmente server-only**: el gestor las lee de DB y prueba/sincroniza modelos desde el navegador admin. La política SELECT heredada de configuraciones amplía todavía más esa exposición. Para aislar secretos hace falta una migración de almacenamiento/acceso y endpoint, no una máscara visual.

## 8. Esquema real de Supabase

Este inventario incluye columnas y PK verificadas, no datos de personas ni secretos. `NOT NULL` indica restricción observada; las columnas sin esa marca admiten NULL. Los campos no equivalen a funciones UI implementadas.

### Tablas de negocio y soporte

| Tabla | PK | Columnas / tipos |
| --- | --- | --- |
| `acciones` | `(id)` | id uuid NOT NULL, folio text NOT NULL, tipo text, origen text, origen_id text, descripcion text, responsable_id uuid, fecha_limite timestamp with time zone, estado text, prioridad text, seguimiento_porcentaje integer, validado_por_gc boolean, eficacia text, notas text, fecha_apertura timestamp with time zone |
| `auditorias` | `(id)` | id uuid NOT NULL, folio text NOT NULL, tipo text, proceso_area text, auditor_lider_id uuid, equipo_auditor text, fecha_inicio timestamp with time zone, fecha_fin timestamp with time zone, estado text, objetivo text, alcance text, created_at timestamp with time zone |
| `catalogos` | `(id)` | id uuid NOT NULL, tipo text NOT NULL, valor text NOT NULL, color text, orden integer, activo boolean, modulo text NOT NULL, codigo text NOT NULL, valor_interno text |
| `configuraciones_sistema` | `(clave)` | clave text NOT NULL, valor jsonb NOT NULL, descripcion text, categoria text |
| `documento_versiones` | `(id)` | id uuid NOT NULL, documento_id uuid, version text, drive_file_id_historico text, motivo_cambio text, aprobado_por text, fecha_version timestamp with time zone |
| `documentos` | `(id)` | id uuid NOT NULL, codigo_doc text, titulo text NOT NULL, version_actual text, estado text, drive_file_id text, drive_file_id_borrador text, fecha_publicacion timestamp with time zone, created_at timestamp with time zone |
| `folios_quejas_anuales` | `(anio)` | anio integer NOT NULL, ultimo integer NOT NULL |
| `formularios_publicos` | `(id)` | id uuid NOT NULL, modulo text NOT NULL, nombre text NOT NULL, token text NOT NULL, activo boolean NOT NULL, creado_por uuid, created_at timestamp with time zone NOT NULL |
| `hallazgos` | `(id)` | id uuid NOT NULL, auditoria_id uuid, tipo text, descripcion text, evidencia text, requisito text, estado text, responsable_id uuid, derivado_sacp_id uuid, created_at timestamp with time zone |
| `informes_config` | `(id)` | id uuid NOT NULL, nombre text NOT NULL, modulo text NOT NULL, filtros jsonb, columnas jsonb, creado_por uuid, created_at timestamp with time zone |
| `logs` | `(id)` | id uuid NOT NULL, fecha timestamp with time zone, usuario_id uuid, accion text, modulo text, detalle text |
| `mail_queue` | `(id)` | id uuid NOT NULL, destinatario text, asunto text, cuerpo text, estado text, intentos integer, error text, fecha_envio timestamp with time zone, created_at timestamp with time zone |
| `notificaciones` | `(id)` | id uuid NOT NULL, usuario_id uuid, fecha timestamp with time zone, tipo text, mensaje text, leida boolean, enlace text, origen_id text, archivada boolean NOT NULL |
| `permisos` | `(rol, modulo)` | rol text NOT NULL, modulo text NOT NULL, leer boolean NOT NULL, escribir boolean NOT NULL |
| `procesos` | `(id)` | id uuid NOT NULL, nombre_proceso text, tipo text, objetivo text, responsable_id uuid, documentos_vinculados text, kpis text, estado text, created_at timestamp with time zone |
| `queja_adjuntos` | `(id)` | id uuid NOT NULL, queja_id uuid NOT NULL, nombre_archivo text NOT NULL, url_archivo text, tipo_archivo text, tamano integer, subido_por uuid, fecha_subida timestamp with time zone, nombre text NOT NULL, storage_path text NOT NULL, tipo_mime text NOT NULL, usuario_id uuid, created_at timestamp with time zone NOT NULL |
| `quejas` | `(id)` | id uuid NOT NULL, folio text NOT NULL, cliente_nombre text NOT NULL, email_cliente text, telefono text, categoria text, descripcion text, prioridad text, estado text, fecha_sla timestamp with time zone, fecha timestamp with time zone, notas text, resolucion text, responsable_id uuid, derivado_sacp_id uuid, fecha_cierre timestamp with time zone, fecha_limite_investigacion timestamp with time zone, reabierta boolean, motivo_reapertura text, revision bigint NOT NULL, tipo text, area_afectada text, fecha_recepcion_gc date, numero_oficio_resolucion text, observaciones text |
| `quejas_actividad` | `(id)` | id uuid NOT NULL, queja_id uuid NOT NULL, tipo text NOT NULL, descripcion text NOT NULL, usuario_id uuid, created_at timestamp with time zone NOT NULL |
| `quejas_comentarios` | `(id)` | id uuid NOT NULL, queja_id uuid, usuario_id uuid, comentario text, tipo text, visible_cliente boolean, fecha timestamp with time zone |
| `reuniones` | `(id)` | id uuid NOT NULL, titulo text, tipo text, fecha_programada timestamp with time zone, hora text, duracion text, organizador_id uuid, participantes text, agenda text, estado text, acta_drive_id text, acuerdos text, created_at timestamp with time zone |
| `riesgos` | `(id)` | id uuid NOT NULL, folio text NOT NULL, tipo text, categoria text, descripcion text, causa text, efecto text, probabilidad integer, impacto integer, nivel text, responsable_id uuid, estado text, accion_mitigacion text, fecha_identificacion timestamp with time zone |
| `sla_config` | `(id)` | id uuid NOT NULL, proceso text NOT NULL, prioridad text, dias_alerta integer, dias_vencimiento integer NOT NULL |
| `solicitudes_documentales` | `(id)` | id uuid NOT NULL, tipo text, solicitante_id uuid, descripcion text, justificacion text, estado text, revisor_id uuid, nuevo_drive_file_id text, fecha timestamp with time zone |
| `tareas` | `(id)` | id uuid NOT NULL, titulo text, descripcion text, responsable_id uuid, fecha_limite timestamp with time zone, estado text, prioridad text, origen text, created_at timestamp with time zone |
| `usuarios` | `(id)` | id uuid NOT NULL, nombre text NOT NULL, email text NOT NULL, rol text NOT NULL, estado text, departamento text, telefono text, avatar_url text, ultimo_acceso timestamp with time zone, created_at timestamp with time zone, auth_id uuid, notif_habilitadas boolean NOT NULL, notif_sonido boolean NOT NULL, notif_sonido_id text NOT NULL |
| `versiones_documentos` | `(id)` | id uuid NOT NULL, documento_id text, version text, cambios text, autor_id uuid, fecha timestamp with time zone |

### Motor de etapas / calendarios

| Tabla | PK | Columnas / tipos |
| --- | --- | --- |
| `qms_calendars` | `(id)` | id bigint NOT NULL, weekdays integer[] NOT NULL, holidays jsonb NOT NULL, timezone text NOT NULL, created_at timestamp with time zone NOT NULL, created_by uuid |
| `qms_case_events` | `(id)` | id bigint NOT NULL, module text NOT NULL, case_id uuid NOT NULL, kind text NOT NULL, occurred_at timestamp with time zone NOT NULL, provenance text NOT NULL |
| `qms_config_audit` | `(id)` | id bigint NOT NULL, entity text NOT NULL, old_value jsonb, new_value jsonb NOT NULL, reason text, actor_id uuid, created_at timestamp with time zone NOT NULL |
| `qms_deadline_notices` | `(id)` | id uuid NOT NULL, run_id uuid NOT NULL, offset_days integer NOT NULL, due_at timestamp with time zone NOT NULL, processed_at timestamp with time zone |
| `qms_stage_runs` | `(id)` | id uuid NOT NULL, case_id uuid NOT NULL, stage_id text NOT NULL, rule_id bigint, calendar_id bigint, snapshot jsonb NOT NULL, started_at timestamp with time zone NOT NULL, expires_at timestamp with time zone, attention_at timestamp with time zone, ended_at timestamp with time zone, end_event text, provenance text NOT NULL |
| `qms_stage_versions` | `(id)` | id bigint NOT NULL, stage_id text NOT NULL, duration integer NOT NULL, day_type text NOT NULL, alerts integer[] NOT NULL, expiration_action text NOT NULL, created_at timestamp with time zone NOT NULL, created_by uuid |
| `qms_stages` | `(id)` | id text NOT NULL, process_id text NOT NULL, name text NOT NULL, start_event text NOT NULL, end_event text NOT NULL |

### Vistas

Las tres vistas tienen `security_invoker=true` y aplican los permisos del llamador:

| Vista | Función |
| --- | --- |
| `qms_current_stages` | Etapas con su regla/version actual (`id, process_id, name, start_event, end_event, rule`) |
| `qms_quejas` | Queja con revision, código/nombre/color de estado y plazo vigente: `plazo_vence, plazo_etapa, plazo_situacion, plazo_dias` |
| `qms_work_items` | Expedientes unificados por módulo: folio/título/categoría/estado/color/prioridad/due/situation/days/stage |

### Relaciones e índices

- `usuarios.auth_id` tiene UNIQUE y FK a `auth.users.id` **ON DELETE SET NULL**. Un perfil UUID no es el UUID de Auth; no compararlos como si fueran iguales.
- Responsables/organizadores/autores referencian `usuarios.id`; hallazgos referencian auditoría y acción; adjuntos/actividad/comentarios referencian queja.
- Adjuntos y actividad se eliminan por cascade al borrar queja. `documento_versiones.documento_id` es UUID/FK con cascade; `versiones_documentos.documento_id` es **texto y sin esa FK**.
- `acciones.origen_id` es texto y una relación lógica. `quejas.derivado_sacp_id` existe como UUID, pero no tiene FK observada en este snapshot; no inventar una constraint por inferirla del nombre.
- Etapas: stage_versions→stage; runs→queja (FK diferida), regla y calendario; notices→run. Eventos QMS guardan module/case_id sin una FK única para todos los módulos.
- Índices principales ya cubiertos: UNIQUE de usuarios.auth_id/email; usuarios `(rol,estado)`; permisos PK `(rol,modulo)`; quejas estado/fecha/fecha_sla/responsable/derivado, folio UNIQUE y trigramas GIN para folio/cliente; documentos estado/código; FK/autores de comentarios y catálogo modulo/tipo.
- `idx_usuarios_auth_id` se retiró por redundancia con UNIQUE en la limpieza 016. No recrear índices equivalentes solo por tener nombres distintos.
- `pg_trgm` está instalado en public. Hay dos familias de tablas de versiones de documentos; no elegir una sin revisar escritores/lectores y diseñar su unificación.
- Adjuntos reales: `tamano` es **integer**, `url_archivo` admite NULL, `nombre_archivo` sigue NOT NULL. También sobreviven tipo_archivo/subido_por/fecha_subida junto a columnas nuevas; el RPC mantiene compatibilidad.
- Nuevos campos de Quejas reales: tipo, area_afectada, fecha_recepcion_gc (DATE), numero_oficio_resolucion, observaciones, revision bigint, reabierta y motivo_reapertura. La interface cliente y formularios no están migrados por completo.

## 9. Lógica del motor QMS que ya existe en DB

Esta capa se aplicó en la migración remota `etapas_versionadas`. **Existe y ejecuta triggers aunque la UI todavía use flujos legacy.**

- `qms_stages` define etapas de proceso con eventos de inicio/fin. Etapas de quejas actuales: evaluación (`Recibido`) e investigación (`En Investigación`).
- `qms_publish_stage` y `qms_publish_calendar` solo admin autenticado, con advisory lock, `p_expected` y conflicto SQLSTATE 40001. Agregan nuevas versiones y auditoría en `qms_config_audit`, no reemplazan silenciosamente la historia.
- Duración 1–3660; tipo business_days/calendar_days; alertas únicas positivas dentro de duración; acción notify_quality/mark_only. Calendario: días ISO 1–7 sin duplicados, feriados fecha+descripción, máximo 1000.
- `qms_due` cuenta desde el día posterior al inicio, usa calendario y días laborables/naturales, desplaza el vencimiento hasta un día permitido y devuelve el fin de ese día (un microsegundo antes del siguiente) en **America/Costa_Rica**. No confundir con simples N×24 horas.
- Trigger `qms_queja_stage BEFORE INSERT OR UPDATE` llama `qms_sync_queja`. Cada UPDATE incrementa revision; si no cambia estado conserva fecha_sla/fecha_limite_investigacion anteriores.
- Al cambiar estado cierra runs anteriores. Para Recibido/En Investigación toma la última regla/calendario, guarda snapshot inmutable en `qms_stage_runs` y calcula expires_at/attention_at/notices.
- Evaluación escribe fecha_sla; investigación escribe fecha_limite_investigacion. Cambiar prioridad/notas sin cambiar estado **no recalcula** esos plazos por sla_config: el trigger conserva el snapshot vigente.
- Alertas se programan a las 06:00 locales según offsets y, para notify_quality, al vencer. `qms_process_notices` procesa hasta 250 pendientes con FOR UPDATE/SKIP LOCKED, solo runs abiertos, notifica staff activo y responsable y marca processed_at.
- `qms_process_notices` y el procesador legacy `procesar_alertas_quejas` están reservados a postgres/service role. La comprobación de octubre no encontró `cron.job` ni Edge Functions desplegadas; no afirmar que la ejecución automática está instalada.
- Triggers `qms_*_event` en quejas, acciones, documentos y riesgos registran aperturas/cierres (y Resuelto en quejas) en qms_case_events. No afirmar que esos eventos son el mismo listado que quejas_actividad.
- `qms_catalog_audit` audita catálogos y protege códigos/estructura/historia.
- `qms_transition` y `qms_update_details` exigen revisión de la fila y aplican autorización staff/responsable; resuelven códigos del catálogo y retornan datos de qms_quejas.
- `qms_dashboard(text)` agrega buckets, estados/categorías, etapas, cronología y atención con vistas invoker. **No es el RPC usado por la página `/` actual.**

El SLA visual por antigüedad, el editor sla_config y los widgets que usan fecha_sla en la UI son una capa anterior. Antes de cambiarlos, reconciliar visualización y escritura con estos snapshots; no ajustar el trigger para mantener una UI vieja engañosa.

### Folios

- `generar_folio_queja()` vigente usa `folios_quejas_anuales(anio,ultimo)`, UPSERT por año con incremento y hora Costa Rica. Devuelve **`AAAA-NNN`** con mínimo tres dígitos, sin truncar a partir de 1000. No agrega `QUEJA-`.
- El contador anual de quejas avanza por fila/año; no necesita reset manual de la antigua secuencia para enero.
- SACP/Auditorías/Riesgos/Documentos conservan generadores por secuencias y prefijos `SACP-`, `AUD-`, `RIESGO-`, `DOC-` con año y cuatro dígitos. Los modales correspondientes (excepto Documentos) pueden aceptar folio manual o generar por RPC.
- `siguiente_folio_queja()` y el formato Q-AAAA-NNNNN son legacy; el cliente actual usa el generador a través del workflow/RPC de creación.
- No generar un folio de queja adicional en frontend antes de `crear_queja_interna`/pública: la creación lo resuelve en DB.

### RPC: uso y acceso relevantes

| RPC | Cliente actual / DB |
| --- | --- |
| `crear_queja_interna` | Usado por alta interna; staff activo y folio/SLA legacy con trigger QMS vigente |
| `crear_queja_publica` | Usado por formulario público; activo/token, devuelve folio, notif diferida |
| `*_con_atributos`, `actualizar_atributos_queja` | Existen en DB/017 para tipo/área/oficio/fecha/observaciones; no están integrados en los formularios actuales |
| `actualizar_detalles_queja`, `transicionar_queja` | Funciones legacy internas cerradas para anon y authenticated; service/owner o wrappers internos |
| `qms_update_details`, `qms_transition` | Wrappers usados por el cliente para editar, asignar responsable, transicionar y reabrir; autorización staff/responsable y revisión esperada |
| `derivar_queja_a_sacp`, `agregar_comentario_queja`, `registrar_adjunto_queja` | Usados, autenticados y con validación de dominio |
| `registrar_adjunto_queja_publica`, `notificar_queja_publica` | Acceso público intencional para submit ciudadano |
| `actualizar_mis_preferencias_notificacion` | Propio activo, authenticated; retorna perfil |
| `obtener_estadisticas_quejas` | Invoker, authenticated/service, conteos bajo RLS; usado por QuejasSummary |
| `incrementar_tokens_proveedor` | Invoker, solo service_role, contador con bloqueo de fila; backend IA |
| `app_*`, `current_*`, `es_admin` | Helpers de identidad/permisos; la identidad operativa excluye inactivos |
| `qms_publish_*`, `qms_due`, `qms_business_day`, `qms_classify`, `qms_dashboard` | Motor/calendario/analítica de DB, integración de UI incompleta |

No conservar overloads ambiguos con defaults para PostgREST. Revisar firmas/ACL en pg_proc, no asumir acceso porque la función aparece listada en el MCP.

## 10. Capa visual vigente

- `app/layout.tsx` importa **solo `app/globals.css`**, que importa Tailwind sin prefijo y `app/styles/components.css`. CSS excluye .performance/.experiments/tests del escaneo.
- Fuente Inter mediante next/font. Tokens `@theme`: primario **#024796**, hover/dark #013b7d, oscuro #212529, fondo #f4f7f6, surface blanco, borde #dee2e6, cabecera de tabla **#F0F2F5**.
- Escala redefinida: text-xs 14 px, text-sm 15 px, contenido text-base 16 px. Botones/campos min-height 40 px, sm 32 px. Radios button 4 px, card/modal 6 px; evitar píldoras/redondeados enormes ajenos al kit.
- Recetas `@utility ui-*`: botones variantes/tamaños, campos, textarea, panel y tabla. `focus-ring` global mantiene teclado visible.
- Imports directos por archivo, sin barrel UI; los componentes transmiten props HTML/ARIA/ref. Controles nuevos deben usar Button/Input/Textarea/Select/Field del kit activo.
- Table activa: texto base 16 px, celdas py-4 (16 px arriba/abajo), header sm semibold py-3.5. Conservar los pesos suaves de folios, tamaños de fila y tratamiento de sin leer de Quejas; no aplicar la negrita/rojo del documento antiguo indiscriminadamente.
- TableRow con onClick tiene tabIndex y Enter/Espacio, sin interceptar controles hijos. Las tablas manuales de quejas conservan su implementación propia; no asumir todas sus filas ya cumplen ese contrato.
- Modal nativo `<dialog>`: sm 500 px, md 600 px, lg 700 px, altura 90dvh, header oscuro, showModal/top layer, Esc/backdrop, Tab/Shift+Tab dentro del diálogo, foco y scroll lock compartido para modales anidados. Variante drawer: lateral izquierdo de hasta 320px, altura 100dvh y sin marcos/padding anidados. No reemplazarlo por div fijo sin reproducir accesibilidad.
- Sidebar desktop a partir de lg, ancho 250 px o 64 px colapsado, tres grupos (Gestión/Seguimiento/Administración), sin ficha de usuario al pie. En móvil usa Modal variant="drawer", cierre X en su propia marca y scroll solo en nav; `useMobileNavigation` usa breakpoint 1023.98 px.
- `useIsMobile` existe con breakpoint 991.98 px pero no es el hook que gobierna el shell actual.
- Header claro: marca/breadcrumbs, campana y usuario; dropdowns controlados, click externo/Escape. Preferencias de sonido/notif, contraseña propia, logout. Acciones de página permanecen en PageHeader/vistas; infraestructura header-action todavía no se consume allí.
- Perfil del Header con avatar de 40px y flecha de ancho estable; nombre completo, correo y rol dentro del menú de 320px, con texto multilínea. Notificaciones en panel de 400px, mensajes de 14px, fechas de 12px y contador visual `99+` (cantidad exacta accesible). En móvil ambos paneles se ajustan al viewport. Archivo y apertura tienen botones independientes; Escape restaura foco. Ver `docs/visual-patterns.md`.
- Shell: h-dvh/overflow hidden, main con min-h-0 y scroll vertical propio, p-3 sm:p-4. Enlaces de salto al contenido y modal móvil para navegación.
- Responsive: QuejasToolbar usa container queries (una fila desde 860px disponibles; buscador completo, filtros iguales y botón completo por debajo), controles de 44px en móvil; PageHeader y Pagination comparten reglas móviles. Table mantiene mínimo 640px con scroll local; filtros de Usuarios en grid y pestañas de Documentos con wrap.
- Body select-none; tablas y contenido que debe copiarse usan select-text. Scrollbars Monday y reglas de impresión en globals.css; .informe-content es el área imprimible.
- Clases dark: sobreviven, pero no hay un selector de tema completo integrado al menú actual.
- QuejasSummary SVG evita cargar Chart.js. Si se integra la analítica alternativa, ChartCanvas carga Chart.js vía next/dynamic y debe adaptarse al kit/runtime; no introducir CoreUI/Bootstrap ni paletas duplicadas.

### Login y transiciones

- Login azul de marca, tarjeta max-w-md, logo, formulario email/password y ayuda de contacto administrativo. No hay signup ni recuperación pública completa; cambio de contraseña propia y reset administrativo son flujos separados.
- `ui-login-field` conserva texto/placeholder de 16px, fuente heredada y estilo de primera línea. Ambos campos empiezan readonly y se habilitan con foco o pointerdown capturado por el formulario: evita la vista previa interna de Chromium que mostraba el correo pequeño antes de enfocar.
- Conservar `autoComplete="username"` y `current-password`, labels asociados, required, navegación por Tab y error inline con role=alert. No desactivar el gestor de contraseñas para arreglar apariencia ni guardar credenciales en preferencias/caché de negocio.
- El botón Ingresar usa el Spinner compartido solo mientras ejecuta login. Restauración privada/redirección interna usa transición neutral; cierre y acceso a login usan su skeleton; no reintroducir la tarjeta central «Verificando sesión» ni mostrar el dashboard anterior mientras se comprueba Auth.
- `SessionScreen` tiene neutral por defecto: solo el fondo y un estado accesible oculto, sin barra, animación, formulario ni panel genérico. AuthShell elige login solo en su URL sin usuario, durante logout o al redirigir a login. Una sesión válida va directamente a la ruta solicitada y muestra únicamente su skeleton de datos si está pendiente. `data-session-layout` identifica neutral/login para regresión. La recuperación de 10 s mantiene el guard cerrado.

### Contrato único de carga

| Componente / variante | Uso activo |
| --- | --- |
| `Skeleton` | Forma decorativa, color primario al 7%, opción circular, sin datos ni lógica de permisos |
| `LoadingSkeleton table` | Quejas, Mis Quejas, Documentos, Auditorías, Riesgos, Revisión, Procesos, SACP, Usuarios, Catálogos, SLA, Roles y Formularios de Configuración |
| `LoadingSkeleton form` | Ajustes generales/zona horaria, guard de Configuración y formulario público |
| `LoadingSkeleton cards` | Carga inicial de proveedores IA |
| `LoadingSkeleton list` | Hallazgos, actividad, comentarios y evidencias; actividad del dashboard |
| `DashboardLoading` | Formas específicas para círculos/gráficos de Quejas y seguimiento por módulo; table/activity delegan al componente compartido |
| `Spinner` | Guardar, subir/descargar archivos, sincronizar, probar modelos y analizar con IA. Cajas centradas de 14/16/24px |
| `OperationLoading` | Generar informe o preparar preview: icono y texto centrados dentro del área correspondiente |

- Cantidad fija: cinco filas de tabla, tres tarjetas/elementos de lista; no dibujar un placeholder por registro real. Pulsación CSS de 2.4 s y giro solo con `motion-safe`; respetar movimiento reducido. No timers JS para animar, librerías visuales nuevas ni queries propias.
- Skeletons anuncian estado para lector de pantalla, con formas aria-hidden y sin mensajes normales visibles. No contienen cifras, nombres, contenido de cuenta o controles utilizables.
- Dentro de un panel ya enmarcado usar `framed={false}`. El contenedor de carga es relativo para que sr-only no genere scroll externo; tablas skeleton recortan el mínimo de 640px sin ensanchar el documento.
- `Button loading` deshabilita, marca aria-busy y anuncia loadingLabel; usa el mismo Spinner, con caja estable y botón relativo para su texto oculto. En spinners manuales de operaciones comunicar el estado en el control/contenedor; no copiar SVG/Loader2 con otros tamaños o posiciones.
- No usar círculo para cargar una página, para Acta Pendiente ni como animación permanente por fila. Datos en caché/refresco de fondo no deben sustituirse por un skeleton completo cuando ya están disponibles.
- No añadir una duración mínima, overlay modal de carga ni esperar a todas las consultas de todos los módulos para revelar un bloque listo. Mostrar errores con recuperación real en vez de conservar indefinidamente una carga.

### Notificaciones y sonido

- Badge no leídas, marcar una/todas, archivar individual/vaciar (archivada=true), query filtra archivada=false.
- Preferencias deshabilitan la consulta/badge; sonido solo al aumentar conteo después de la carga inicial. La suscripción del Header sigue presente aunque la consulta esté disabled.
- Sonidos locales Web Audio/decodeAudioData en `public/sounds/`: notification/info, success, popup, error; game/coin, void, hit, miss. Preview del selector, sin CDN.
- `notif_sonido_id` tiene CHECK de ocho IDs. La escritura de preferencias usa los tres parámetros de su RPC.
- Enlace de una notificación puede llevar origen_id como `?abrir=...`; verificar consumidores de esa query antes de afirmar que todas las rutas abren automáticamente el detalle.

## 11. Lo que falta / discrepancias conocidas

| Prioridad | Pendiente confirmado |
| --- | --- |
| Alta | Restringir lectura heredada de configuraciones_sistema y aislar claves IA; máscara/admin guard frontend no es seguridad del Data API |
| Alta | Alinear formularios públicos y tablas con ALL authenticated a permisos/estado reales; políticas permisivas antiguas siguen activas |
| Alta | Reconciliar Catálogos con codigo/valor_interno y trigger que prohíbe DELETE/cambios estructurales; editor legacy conserva esas acciones |
| Media | Integrar atributos nuevos de Quejas y actualizar tipo/interface/formularios; no confundir tipo del registro con categoría interna |
| Media | Integrar motor de etapas/calendarios/plazos, su editor versionado y vistas qms en la UI; SLA por prioridad/antigüedad sigue siendo legacy |
| Media | Instalar/verificar programador de avisos y worker de correo. No hay cron.job ni Edge Functions observadas; mail_queue no equivale a correo enviado |
| Media | Integrar guard de visitas en respuestas IA/chat/subidas/transiciones; A→B→A sigue necesitando protección |
| Media | Propagar signals y escapar búsquedas en todos los hooks operativos; mejorar resincronización/lotes de Realtime |
| Media | Completar validación de usuarios antes de efectos Auth/DB y unificar roles ofrecidos/persistidos. usuarioInput y generador de contraseñas no están plenamente integrados en API |
| Media | Decidir e implementar MFA/2FA, CAPTCHA y protección de intentos/sesiones si se incorporan; actualmente no hay flujo integrado ni contador distribuido de login |
| Media | Perfilar navegación autenticada, tiempos de red y memoria con volumen real; las comprobaciones existentes no miden una carga de miles de registros |
| Producto | CRUD hallazgos/derivación, eficacia/validación SACP, historial/versionado y Drive documental, actas/acuerdos completos |
| Producto | Persistencia de informes_config/tareas/solicitudes documentales; no hay escritores frontend completos para esas capacidades |
| Producto | Estado del sistema/visor de salud y errores reales, controles de seguridad y observabilidad: propuestos, sin ingesta ni dashboard integrado |
| Producto | Telemetría JSONB y retención/limpieza anual: sin implementación programada; no borrar auditoría o expedientes al introducir una política de logs |
| Producto | Fondo personalizado desde el menú y selector de tema completo: no están implementados en el runtime actual |
| Mantenimiento | Componentes/prototipos analíticos y utilidades sin consumidores; no tratarlos como UI activa |

Esta actualización de AGENTS es documentación. No modifica esas capacidades, corrige políticas por sí sola ni autoriza ejecutar dumps, seeds o migraciones antiguas indiscriminadamente.

## 12. Migraciones, entorno y verificación

### Historial y fuentes

- `supabase/001`–`017`, seeds, dumps y scripts de RLS en raíz contienen historia manual. No representan exactamente todo el esquema remoto.
- Historial remoto observado: `20260917190526 add_missing_performance_indexes`, `20260917191058 add_trigram_index_for_search`, `20260923213259 etapas_versionadas`, `20260924043528 017_atributos_reales_quejas`, `20261006232152 seguridad_fases_1_3`.
- La migración reciente aplicada/local es `supabase/migrations/20261006232152_seguridad_fases_1_3.sql`: RLS/ACL de Usuarios/Documentos/Auditorías/Informes, identidad activa, RPC internos sin anon, estadísticas invoker, contador IA service-only y search_path.
- `supabase/backups/seguridad_fases_1_3_antes.json` y `_despues.json` son metadatos de políticas/ACL/funciones, no backup de datos del negocio ni credenciales.
- El DDL de etapas versionadas existe en remoto y no tiene una migración completa equivalente en la carpeta local actual; reconciliar esa historia antes de pretender recrear la DB desde el repo.
- `scripts/auditoria-fases-1-3.sql` consulta esquema/índices/políticas; `scripts/verificar-seguridad-db.sql` prueba roles/ACL/RLS con fixtures y ROLLBACK. Revisar objetivo/proyecto antes de cualquier SQL con escritura.
- `supabase/schema-actual.txt`, dumps y el antiguo `rls-role-based.sql` son snapshots/referencias; no reaplicarlos como estado deseado.
- `SUPABASE_PHASE3_RLS.sql` se incorporó al integrar commits remotos: es un borrador histórico incompatible con esta DB. No ejecutarlo ni convertirlo en migración sin corregir identidad Auth/perfil, permisos y duplicaciones.
- `docs/auditoria-fases-1-3.md` conserva resultados/cambios anteriores y la corrección de AbortSignal/performance.
- En esta actualización se releyeron metadatos por MCP, sin INSERT/UPDATE/DELETE ni migraciones: RLS 33/33; tres vistas invoker; legacy actualizar/transicionar sin EXECUTE para anon/authenticated; wrappers QMS para authenticated; contador IA solo service_role entre los roles de cliente; estadísticas sin anon. Se confirmaron las políticas `true` heredadas de Configuraciones/Formularios y ausencia de `cron.job`. La confirmación de estos puntos no sustituye revisar todas las políticas o ejecutar una auditoría exhaustiva nueva.
- El esquema detallado de sección 8 y el resto de reglas de DB conservan el snapshot de la auditoría de octubre. No se extrajeron registros de personas, tokens, claves IA ni secretos para redactar esta guía.

### Variables y servicios externos

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

### Comandos y alcance de verificación

```sh
npm run dev
npm run build
npm run start
npm run lint
npx tsc --noEmit
node --test --test-force-exit tests/*.test.mjs
node scripts/check-visual-layer.mjs
```

- Scripts package.json: dev/start/build/lint/test. `npm test` usa node --test sin force-exit; algunos fallos previos dejan timers abiertos. Usar force-exit para obtener el diagnóstico completo, no para ocultar resultados.
- Pruebas por cambio: configuración/visuales/errores/datos/runtime/seguridad según alcance. `tests/load-module.mjs` transpila módulos reales con mocks y transporte controlado; las pruebas JS no usan credenciales reales.
- La ejecución global documentada en la auditoría anterior fue **88/125, con 37 fallos históricos**. Es una referencia de aquella revisión, no el conteo ni el resultado global del checkout después de añadir pruebas nuevas. La suite completa no se volvió a ejecutar en las últimas correcciones visuales/sesión. No regenerar fixtures ni instalar dependencias de prototipos para ocultar fallos; comparar cada fallo con la referencia.

Última selección de regresión de sesión/cargas: **53/53**, con este alcance:

| Archivo / selección | Casos | Qué se verificó |
| --- | --- | --- |
| `tests/auth-visibility.test.mjs` | 22 | Montaje privado, redirecciones, transición neutral privada y carga única del módulo solicitado, identidad remota, cambio de usuario, logout inmediato/recarga/fallo, respuestas tardías, recuperación y consultas paralelas sin publicación parcial e init idempotente |
| `tests/optimization-phases.test.mjs` | 12 | Errores seguros/logger, cuenta activa, permisos, guard API, caché y cargas independientes/cancelación del dashboard |
| `tests/usuarios-acceso-workflow.test.mjs` | 7 | Último acceso Auth paginado, autorización/error API, privacidad de metadatos, revisión esperada y wrappers de quejas |
| `tests/error-security.test.mjs` | 7 | Mensajes/reintentos, atributos y límites de API/identidad |
| `tests/navigation-prefetch.test.mjs` | 2 | Hover/foco/tacto con clave propia; sin identidad no consultar ni precargar rutas no permitidas |
| Tres casos seleccionados de `tests/data-reliability.test.mjs` | 3 | Caché fresca/invalidada sin duplicados, remontaje y orden estable de paginación. No equivale a aprobar todo ese archivo |

```sh
node --test tests/auth-visibility.test.mjs tests/optimization-phases.test.mjs tests/usuarios-acceso-workflow.test.mjs tests/error-security.test.mjs tests/navigation-prefetch.test.mjs
node --test --test-name-pattern="hover reutiliza|QueryProvider recupera|Quejas pagina" tests/data-reliability.test.mjs
```

- La regresión previa de fases/runtime fue 17/17. `tests/dashboard-runtime-regression.test.mjs` cubre QueryFunctionContext/AbortSignal, reintento SDK, cuatro requests compartidos, precarga, módulo lento y guard de métodos API; esos resultados pertenecen a la comprobación de esa corrección.
- Último build de código: Next.js producción y TypeScript correctos. Lint sin errores, con dos advertencias históricas por cilFolder/cilUser sin usar en `.experiments/src/_nav.tsx`. No declarar «lint sin advertencias».
- Verificación en navegador temporal con datos sintéticos: al navegar y pasar pending/ready se conserva la misma referencia de QueryClient y su caché; usuario/vista nuevos crean otro cliente vacío y limpian el anterior. El contador de init no aumenta y el guard no se remonta por scope. La fixture se retiró antes del build; no se usó sesión real ni se consultaron datos de negocio.
- Verificación de cargas: las diez páginas principales se renderizaron con queries pendientes simuladas usando los componentes reales; todas con skeleton y sin spinner inicial. Los diez HTML prerenderizados del build conservan presentación neutra y no incluyen el shell privado antes de Auth.
- En producción local se comprobó redirección al login en navegador, y el HTML inicial de `/`, `/quejas`, `/usuarios`, `/login`. Skeletons table/form/cards/list revisados en escritorio y móviles 320/375px sin desbordamiento horizontal; círculos de botones/operaciones centrados. Previews temporales eliminados, viewport restaurado y pestañas de prueba cerradas.
- Historial de entrada: cb160e6 eliminó workspace antes de validar y se verificó desplegado el 6 de octubre. La corrección del 7 elimina además login durante una recarga privada, todo workspace global y la barra redundante: neutral → validación → módulo solicitado. No añade requests de identidad ni demoras; comprobar neutral en HTML inicial privado y login únicamente en /login antes del acceso.
- Comprobaciones remotas previas: consultas anónimas sin datos del dashboard y pruebas transaccionales de wrappers bajo admin/rol no autorizado, conflicto 40001 y denegación legacy con ROLLBACK. No equivalen a un recorrido autenticado de toda la aplicación ni a una auditoría completa nueva de RLS.
- Después de cambios de código cliente, Ctrl+F5 descarta chunks/timers antiguos. No borrar .next/node_modules o reiniciar servicios del usuario como primera respuesta a un error.
- Cambio solo de Markdown: verificar enlaces/rutas, consistencia con código/DB y `git diff --check`; no requiere otro build de la aplicación.
- Revalidar esta guía después de cambios de RPC/RLS, rutas, queries montadas o estilos. Actualizar implementado vs pendiente y fecha/snapshot; no sostener afirmaciones antiguas porque figuraban en AGENTS.

### Continuidad y despliegue

- Los cambios de una sesión de trabajo pueden seguir sin commit/push. Consultar `git status` y conservar el trabajo existente antes de editar o integrar cambios remotos.
- Compilar localmente no actualiza Vercel ni prueba sus variables de entorno. Tras un despliegue solicitado, verificar URL de producción, login, recarga de ruta privada, logout, permisos y APIs; no afirmar despliegue completado sin evidencia.
- Validación manual todavía útil: recorrido autenticado en producción y con volumen real, cuenta desactivada con token previo, concurrencia entre usuarios, envío ciudadano con evidencias/token activo, reconexión y diagnóstico de errores de servicios externos. El documento y los skeletons no sustituyen esas comprobaciones.
