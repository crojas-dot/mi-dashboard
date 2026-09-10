<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ECA-QMS — Arquitectura Completa del Sistema

Dashboard de Sistema de Gestión de Calidad (Ente Costarricense de Acreditación).

**Stack:** Next.js 16.2.12 (App Router, React 19.2.4) + Supabase (Postgres + Auth + Realtime) + TanStack Query v5 + Zustand v5 + Tailwind CSS v4 + lucide-react + sonner.

**Patrón clave:** TODAS las páginas son `'use client'`. **No hay Server Components, RSC ni Server Actions.** Los datos se fetchan en el cliente vía `supabase.from(...)` dentro de hooks de TanStack Query.

**Proyecto Supabase:** `https://fykhrrpeoehwqznccmfp.supabase.co` (anon `sb_publishable_wC5x65GrzFBd5ddHVKCQ_Q_ldub_mjv`, service_role en `.env.local`). Login = Supabase Auth (email/password), perfil en `public.usuarios.auth_id → auth.users.id`. Ver `.env.local`.

---

## 1. Frontend — Estructura de carpetas

```
app/
  layout.tsx                 root layout (providers + AuthShell; <body className="select-none">)
  page.tsx                   / Dashboard (4 KPIs usados + tareas pendientes; "Actividad Reciente" hardcodeada)
  error.tsx                  error boundary por ruta (UI de recuperación + reset)
  global-error.tsx           error boundary a nivel app (envuelve <html>)
  globals.css                Tailwind v4 CSS-first + @theme tokens + scrollbars Monday + @media print
  login/page.tsx             /login (Supabase Auth email/password)
  api/usuarios/route.ts      CRUD usuarios (service-role + rate limit 20/min)
  api/ai/analizar/route.ts        análisis IA multi-proveedor (runtime nodejs, maxDuration 60, fallback + memoria + Zero-Disk context + rate limit 10/min)
  api/ai/test/route.ts            testeo de modelos IA server-side (un modelo por request; Bearer admin + rate limit 30/min)
  api/drive/upload/route.ts       subida interna de adjuntos a Google Drive (sube a Analisis/, Bearer + streaming + rate limit 30/min + Apps Script webhook)
  api/drive/upload-public/route.ts subida pública de evidencias /q/[token] (valida token + streaming + rate limit 30/min + Apps Script webhook)
  api/drive/download/route.ts     descarga streaming desde Drive (Bearer + RFC 5987 Content-Disposition)
  api/drive/delete/route.ts       DELETE adjunto (borra fila queja_adjuntos + archivo en Drive en background; rate limit 30/min; permisos según rol/responsable)
  quejas/  page.tsx + components/NuevaQuejaModal, QuejaDetalleModal (lifecycle completo, adjuntos con delete, comentarios, derivar SACP)
  quejas/error.tsx           error boundary específico de quejas
  mis-quejas/ page.tsx + components/QuejaColaboradorPanel (panel fixed 500px expandible + tabs Detalle/Análisis/Resolución; solo quejas donde responsable_id = yo)
  configuracion/ page.tsx + components/RolesAccesos, ModoVistaActiva  (7 tabs, solo admin)
  procesos/  page.tsx + components/NuevoProcesoModal
  auditorias/page.tsx + components/NuevaAuditoriaModal  (modal de hallazgos inline, SOLO lectura)
  riesgos/   page.tsx + components/NuevoRiesgoModal      (matriz 3x3 inline)
  revision/  page.tsx + components/NuevaReunionModal     (reuniones / Revisión Dirección)
  documentos/page.tsx + components/NuevoDocumentoModal   (tabs: Todos/Maestra/Edición)
  documentos/error.tsx       error boundary específico de documentos
  reporteria/page.tsx + components/GeneradorInformeModal (informes imprimibles)
  sacp/      page.tsx + components/NuevaSACPModal        (acciones, avance % inline)
  usuarios/  page.tsx + modales (solo admin, usa /api/usuarios)
  q/[token]/ page.tsx    formulario público de quejas (sin auth, categorías fijas obligatorias + adjuntos Drive; crea queja → sube adjuntos → notifica vía notificar_queja_publica)
components/
  AuthShell.tsx              guard de auth global REDIRECCIÓN POR PERMISOS (no solo admin); salta guard para /login y /q
  Sidebar.tsx                sidebar colapsable (w-16/w-[250px]) + hover-prefetch + filtro de links por permisos — SIN bloque de usuario al pie
  Header.tsx                 título por ruta + campana notificaciones (dropdown, marcar/archivar/vaciar, beep) + menú de usuario (contraseña, prefs notif con Switch + sonido, logout)
  Modal.tsx                  modal reutilizable (sm/md/lg, Esc/overlay, header oscuro #212529)
  StatCard.tsx               tarjeta KPI (soporta dark)
  ui/  Button, Select, Badge, Switch, Table(Head/HeaderCell/Row/Cell), EmptyState, PageHeader, Pagination (import directo por archivo; NO hay barrel index.ts)
  usuarios/  UsuarioFormModal, PasswordModal, ResetPasswordModal, CambiarMiPasswordModal (autoservicio), ConfirmDialog
  configuracion/  AIProvidersManager (tab IA: CRUD proveedores + barra consumo % + fallback + modal lg + presets límites + auto-selección modelo único) — ES EL COMPONENTE EN USO
  quejas/  AdjuntoPreviewModal (Drive iframe + legacy Blob signed URL)
lib/
  supabase.ts                cliente anon singleton
  auth.ts                    signIn/signOut/getAppUser (Supabase Auth; bloquea inactivos)
  types.ts                   solo tipo Queja (resto definidos por query)
  permisos.ts                Permiso type, MODULOS_DE_RUTA, moduloDeRuta, tienePermiso (admin siempre pasa configuracion)
  providers/  QueryProvider (React Query), ToastProvider (sonner)
  queries/    queryKeys + useQuejas (incl. SLA, Estadísticas RPC, Adjuntos) + useCatalogos, useDashboard, useAuditorias, useDocumentos, useProcesos,
              useReuniones, useRiesgos, useSACP, useUsuarios, usePermisos (+fetchPermisosByRol), useNotificaciones,
              useFormulariosPublicos, useQuejaComentarios, useQuejaActividad
  server/     auth.ts (getCurrentUser Bearer), supabase-admin.ts (service client), drive.ts (JWT Service Account + buscarOCrearSubcarpeta por folio + subirArchivoASubcarpeta multipart REST + eliminarArchivoDrive), rateLimit.ts (en memoria por IP), uploadHelpers.ts (streamToBuffer + MIME allowlist + constantes)
  services/   quejaWorkflowService (crear/actualizar/transicionar 6 params/derivar/comentario/subirAdjunto/eliminarAdjunto/descargarAdjunto/reabrir), folioService, notificacionService,
              errorToast, passwordGenerator, sonidosNotificacion (8 MP3 autohospedados), aiService (analizarIA → POST /api/ai/analizar con Bearer)
  ai/         types.ts (AIProvider, AIRuta, AIRouting, ArchivoIA), aiFactory.ts (crearClienteIA multi-proveedor + blindaje Gemini + sanitización + resolverGeminiFlashAuto)
              modelDiscovery.ts (obtenerModelosDisponibles + OpenRouter free-only + DB cache), modelMemory.ts (último éxito/fallos/latencia + penalización condicional),
              modelTesting.ts (testearModelo SERVER-ONLY + prompts de prueba), modelTestingClient.ts (leer/limpiar/guardar resultados de test, client-safe)
  store/      auth-store (Zustand: user + permisos + vistaActiva + init/login/logout/setVistaActiva), sidebar-store (collapsed)
  constants/  roles.ts (ROLE_VARIANTS/LABELS 6 roles), variants.ts (prioridadVariant, estadoVariant, estadoSACPVariant, estadoDocumentoVariant), adjuntos.ts
  utils/      format.ts (formatBytes/Number/Date/DateTime), drive.ts (esDrive, getDriveFileUrl/Preview/Thumbnail)
hooks/
  useHoverPrefetch.ts        prefetch por hover (80ms debounce)
  useRealtimeSubscription.ts suscripción Realtime + invalidación de queries (750ms debounce; consumidores: /quejas, Header/notifications)
  useQuejasVistas.ts         marcar/ver quejas ya abiertas en localStorage por usuario (estilo Gmail, highlight de no vistas, "N sin ver")
supabase/  *.sql (seeds/RPC/dumps) · 001 (formulario público + alertas) · 002 (prefs notif + archivada) ·
           003 (selección sonido) · 004 (realtime + notif queja pública) · 005_seguridad_flujos_quejas.sql
           (RPC transaccionales de quejas + RLS reforzada) · 006 (permisos dinámicos rol+modulo, rol colaborador,
           quejas_actividad, estado GC) · 007 (queja_adjuntos + registrar_adjunto_queja + reabrir_queja + bucket storage)
           · 008 (drop overload viejo transicionar_queja) · 009 (transicionar_queja COMPLETA 6 params)
           · 010 (config drive_folder_id_quejas para Drive) · 011 v4 (RPCs adjuntos público+interno; dual-write nombre/nombre_archivo y storage_path/url_archivo)
           · 012 (índices de rendimiento) · 013 (RPC obtener_estadisticas_quejas) · 014 (RPC incrementar_tokens_proveedor)
           · 015 (notificación queja pública diferida: crear_queja_publica deja de notificar + nuevo RPC notificar_queja_publica)
           · alinear-login.sql · login-tabla.sql · habilitar-rls.sql · dump-schema.sql · seed-config.sql · seed-admin.sql · seed-folios.sql
           · rls-policies.sql en raíz · rls-role-based.sql (DEPRECATED, sin uso)
public/
  sounds/     8 MP3 autohospedados (notification-{info,success,popup,error} + game-{coin,void,hit,miss}) — reproducidos vía Web Audio nativa
  coreui/     CSS/vendors de CoreUI (style.css, simplebar.css, examples.css) — no usados en runtime actual
  *.svg       assets de plantilla (window, vercel, file, next, globe)
scripts/  migrar-usuarios-a-auth.mjs
```

## 2. Frontend — Detalle por página

| Ruta | Datos | Componentes clave |
|------|-------|-------------------|
| `/` | 4 KPIs (quejas ≠Cerrada, acciones ≠Cerrada, docs Borrador, riesgos Activos) + tareas pendientes (top 8 por vencimiento, de quejas por `fecha_sla` y acciones por `fecha_limite`). "Actividad Reciente" es **100% hardcodeada** | Table, Badge, PageHeader |
| `/quejas` | búsqueda folio/cliente (`useDeferredValue`), filtros estado/prioridad, paginación 25, 4 StatCards (resueltas a tiempo %, procedencia %, quejas del mes, total) vía RPC, SLA visual por prioridad vs `sla_config` (fallback 3/7d), **quejas vistas en rojo/negrita si no leídas + botón "N sin ver"**, estado `ahora` + setInterval 60s, hover-prefetch de adjuntos, realtime | NuevaQuejaModal, QuejaDetalleModal |
| `/mis-quejas` | solo quejas donde `responsable_id = yo` (paginación 25). Split-pane: tabla `min-w-[1200px]` / `min-w-[calc(100%+484px)]` + panel fixed `w-[500px]` (expande a `w-full`) con `mr-[calc(500px-16px)]` | QuejaColaboradorPanel |
| `/configuracion` | **7 tabs**: Catálogos (cascada módulo→tipo, CRUD), SLA y Plazos (`sla_config`), General (`configuraciones_sistema` update por clave), Formularios (enlaces `/q/[token]`), **Roles y Accesos** (tabla roles×módulos con Switch leer/escribir, upsert `permisos`), **Vistas** (simular rol en vivo con Switch, `setVistaActiva`), IA (`AIProvidersManager`). Guard `rol==='admin'` | RolesAccesos, ModoVistaActiva, AIProvidersManager |
| `/procesos` | tabla estática `procesos` | NuevoProcesoModal |
| `/auditorias` | `auditorias` + modal hallazgos (`hallazgos` eq auditoria_id, SOLO lectura) | NuevaAuditoriaModal |
| `/riesgos` | tabla + matriz 3x3 (nivel = prob×impacto: ≤2 Bajo, ≤4 Medio, ≤6 Alto, >6 Crítico) | NuevoRiesgoModal |
| `/revision` | reuniones (`reuniones`) + modal detalle | NuevaReunionModal |
| `/documentos` | tabs Todos/Lista Maestra(Publicado)/Edición Viva(Borrador); editar `version_actual` directo | NuevoDocumentoModal |
| `/reporteria` | wizard 3 pasos: módulo → filtros → informe con tabla/resumen por estado/distribución/vencidos + `window.print` | GeneradorInformeModal |
| `/sacp` | acciones con barra %, avance (100% → "En Validación"), cierre solo desde "En Validación" (→ "Cerrada" 100%) | NuevaSACPModal, modales inline |
| `/usuarios` | stats + filtros + CRUD vía `/api/usuarios`. Guard `rol==='admin'` | UsuarioFormModal, PasswordModal, ResetPasswordModal, ConfirmDialog |
| `/q/[token]` | formulario público sin auth (valida token en `formularios_publicos` activo; crea vía RPC `crear_queja_publica`; sube adjuntos a Drive; notifica vía `notificar_queja_publica`; muestra folio). Categoría = select FIJO obligatorio: Queja, Denuncia, Sugerencia, Reclamo, Felicitación (sin catálogo) | — |
| `/login` | login Supabase Auth (email/password); redirige a `/` si ya autenticado | — |

## 3. Backend — API routes

**Rutas:** `app/api/usuarios/route.ts`, `app/api/ai/analizar/route.ts` y `app/api/drive/{upload,upload-public,download,delete}/route.ts` (todas `runtime nodejs`; usuarios usa service-role para Supabase Auth `admin`; ai usa service-role + proveedores IA; drive usa service-role + Service Account de Google).

- **`GET /api/usuarios`** — admin o calidad. Lista `usuarios` con filtros `search`/`rol`/`estado`.
- **`POST /api/usuarios`** — solo admin. Crea auth user (`admin.createUser`, email_confirm) + fila `usuarios` con `auth_id`. Rollback: si falla insert, borra el auth user. Genera contraseña temporal (≥8, criptográfica, mayús/minús/dígito/símbolo, Fisher-Yates).
- **`PATCH /api/usuarios`** — solo admin. Autoprotección (no auto-desactivarse/auto-rol/auto-borrado) + **último-admin protection** (409 si dejaría sin admins activos). Actualiza Auth + tabla.
- **`DELETE /api/usuarios`** — solo admin. Borra auth user + fila + **último-admin protection** (409).
- **`POST /api/drive/upload`** — interno. Sube a `Analisis/` de la subcarpeta del folio; Bearer; autoriza staff O responsable; folio resuelto desde DB (nunca del cliente); máx 50 MB; webhook Apps Script.
- **`POST /api/drive/upload-public`** — público. Sube a la raíz del folio; valida token activo + queja en `Recibido`; máx 50 MB; webhook Apps Script.
- **`GET /api/drive/download?id=<fileId>`** — stream seguro `alt=media`; Bearer; resuelve adjunto por `storage_path`; autoriza staff O responsable; `Content-Disposition` RFC 5987 dual-filename.
- **`DELETE /api/drive/delete`** — borra fila `queja_adjuntos` + archivo en Drive en background. Autorización: evidencias cliente (`usuario_id NULL`) solo admin; evidencias análisis (`usuario_id` presente) staff O responsable.
- **`POST /api/ai/analizar`** — ver sección 8.

Server helpers en `lib/server/`: `getCurrentUser(request)` valida Bearer token y resuelve perfil `usuarios` por `auth_id` → `{auth_id, rol, email}`; `createServiceClient()` con service-role; `rateLimit(ip, limit, windowMs)` + `getClientIp`; `streamToBuffer`.

## 4. Base de datos (schema `public`)

Todas las tablas usan `id uuid` PK salvo indicado. Verificado con dump del dashboard real.

| Tabla | Columnas |
|-------|---------|
| `usuarios` | id, nombre, email, rol, estado, departamento, telefono, avatar_url, ultimo_acceso, created_at, auth_id (FK→auth.users.id), notif_habilitadas, notif_sonido, notif_sonido_id (CHECK 8 ids) |
| `quejas` | id, folio, cliente_nombre, email_cliente, telefono, categoria, descripcion, prioridad, estado, fecha, fecha_sla, fecha_limite_investigacion, fecha_cierre, resolucion, notas, responsable_id (FK→usuarios), derivado_sacp_id (FK→acciones) |
| `quejas_comentarios` | id, queja_id (FK→quejas), usuario_id (FK→usuarios), comentario, tipo, visible_cliente, fecha |
| `queja_adjuntos` | id, queja_id (FK→quejas), nombre, storage_path, tamano (bigint), tipo_mime, usuario_id (FK→usuarios), created_at + **columnas legacy `nombre_archivo`, `url_archivo` (NOT NULL)`** — los RPC hacen dual-write; RLS en 007 |
| `quejas_actividad` | id, queja_id (FK→quejas), tipo (default 'nota'), descripcion, usuario_id (FK→usuarios), created_at — RLS en 006 |
| `acciones` | id, folio, tipo, origen, origen_id, descripcion, responsable_id (FK→usuarios), fecha_limite, estado, prioridad, seguimiento_porcentaje, validado_por_gc, eficacia, notas, fecha_apertura |
| `auditorias` | id, folio, tipo, proceso_area, auditor_lider_id (FK→usuarios), equipo_auditor, fecha_inicio, fecha_fin, estado, objetivo, alcance, created_at |
| `hallazgos` | id, auditoria_id (FK→auditorias), tipo, descripcion, evidencia, requisito, estado, responsable_id (FK→usuarios), derivado_sacp_id (FK→acciones), created_at |
| `riesgos` | id, folio, tipo, categoria, descripcion, causa, efecto, probabilidad (int), impacto (int), nivel, responsable_id (FK→usuarios), estado, accion_mitigacion, fecha_identificacion |
| `procesos` | id, nombre_proceso, tipo, objetivo, responsable_id (FK→usuarios), documentos_vinculados, kpis, estado, created_at |
| `reuniones` | id, titulo, tipo, fecha_programada, hora, duracion, organizador_id (FK→usuarios), participantes, agenda, estado, acta_drive_id, acuerdos, created_at |
| `documentos` | id, codigo_doc, titulo, version_actual, estado, drive_file_id, drive_file_id_borrador, fecha_publicacion, created_at |
| `documento_versiones` | id, documento_id (FK→documentos), version, drive_file_id_historico, motivo_cambio, aprobado_por, fecha_version |
| `versiones_documentos` | id, documento_id (text), version, cambios, autor_id (FK→usuarios), fecha |
| `solicitudes_documentales` | id, tipo, solicitante_id (FK→usuarios), descripcion, justificacion, estado, revisor_id (FK→usuarios), nuevo_drive_file_id, fecha |
| `tareas` | id, titulo, descripcion, responsable_id (FK→usuarios), fecha_limite, estado, prioridad, origen, created_at |
| `notificaciones` | id, usuario_id (FK→usuarios), fecha, tipo, mensaje, leida, archivada, enlace, origen_id |
| `logs` | id, fecha, usuario_id (FK→usuarios), accion, modulo, detalle |
| `mail_queue` | id, destinatario, asunto, cuerpo, estado, intentos, error, fecha_envio, created_at |
| `informes_config` | id, nombre, modulo, filtros (jsonb), columnas (jsonb), creado_por (FK→usuarios), created_at |
| `catalogos` | id, tipo, valor, color, orden, activo, modulo — RLS en 005 (anon: solo `categoria_queja` activa de `quejas`) |
| `sla_config` | id, proceso, prioridad, dias_alerta (int), dias_vencimiento (int) — RLS en 005 |
| `configuraciones_sistema` | clave (PK), valor (jsonb), descripcion, categoria — RLS en 005 |
| `permisos` | rol + modulo (PK compuesta), leer, escribir — RLS en 005/006 (staff SELECT / admin write) |
| `formularios_publicos` | id, modulo (default 'quejas'), nombre, token (único, auto), activo, creado_por (FK→usuarios), created_at |

**Reglas de la DB:**
- `catalogos.modulo` = feature area (`'quejas'`, `'sacp'`, `'documentos'`, `'auditorias'`, `'riesgos'`, `'general'`); `tipo` agrupa valores (`'categoria_queja'`, `'estado_queja'`, `'prioridad'`, `'estado_sacp'`, `'tipo_sacp'`, `'estado_documento'`, `'estado_auditoria'`, `'tipo_auditoria'`...); `valor` = display; `activo` puede ser NULL/true — **siempre** filtrar con `.or('activo.is.null,activo.eq.true')`.
- RLS activo en TODAS las tablas de negocio. Desde la migración 005 también tienen RLS `catalogos`, `sla_config`, `configuraciones_sistema`, `permisos` (staff SELECT / admin write; `catalogos` además expone a `anon` solo `categoria_queja` activa). Sin RLS: `informes_config`.
- `quejas` y `quejas_comentarios`: SELECT solo staff (`app_es_staff()`) + política 006 para colaborador (solo sus quejas); **las mutaciones pasan solo por RPC** (no INSERT/UPDATE directo). `queja_adjuntos` (007): SELECT staff/colaborador-propio, INSERT solo vía RPC. `notificaciones`: SELECT/UPDATE solo propias (`usuario_id = app_usuario_actual_id()`). `formularios_publicos`: anon SELECT `activo=true`, solo admin ALL.
- Folios: funciones RPC `generar_folio_queja/sacp/auditoria/riesgo/documento` (SECURITY DEFINER, sin args) → `PREFIJO-AAAA-NNNN` (QUEJA-, SACP-, AUD-, RIESGO-, DOC-) con secuencias `seq_folio_*` (START 1 CACHE 20). Reset anual manual (ALTER SEQUENCE). Triggers de auto-folio están **comentados** — el frontend llama al RPC explícitamente.
- `transicionar_queja` (migración 009) tiene **6 params con default**: `(p_queja_id, p_nuevo_estado, p_resolucion, p_justificacion_procede, p_responsable_id, p_motivo_reapertura)`. El cliente envía **SIEMPRE los 6 (null si no aplica)** — si existieran dos overloads, PostgREST tira "Could not choose the best candidate function".
- `lib/queries/useQuejas.ts` usa `select('*', {count:'exact'})`, `or(folio.ilike/cliente_nombre.ilike)`, `eq` estado/prioridad/responsable_id, `order('fecha', desc)`, `.range(page*25, ...)`. Query de quejas usa `placeholderData: keepPreviousData` + `refetchOnMount:'always'` + `refetchOnWindowFocus:true` (a diferencia del default global).

## 5. Reglas de negocio IMPLEMENTADAS

1. **Auth:** Supabase Auth + perfil `usuarios` por `auth_id`. `signIn` bloquea si `estado !== 'activo'` ("Tu cuenta está inactiva"). `auth-store.init` hace signOut si perfil inactivo; suscribe `onAuthStateChange`.
2. **Roles y permisos (dinámicos, migración 006):** la tabla `permisos` (rol+modulo leer/escribir) SÍ se consulta: `auth-store` carga `app_mis_permisos` (RPC), `AuthShell` y `Sidebar` autorizan con `tienePermiso(permisos, modulo, ..., user.rol)`. `admin` siempre pasa para `configuracion`. **Además** `/configuracion` y `/usuarios` mantienen guard duro `rol === 'admin'`. Cuando el usuario no tiene acceso a la ruta, AuthShell redirige a `/mis-quejas` (si lo permite) o `/`.
3. **Usuarios:** autoprotección (no auto-desactivarse/eliminarse/cambiarse rol), contraseña temporal criptográfica mostrada una vez, reset de contraseña, último-admin protection en API.
4. **Folios:** generados vía RPC antes del insert en quejas, SACP, auditorías y riesgos. **NOTA:** `generar_folio_documento` existe pero NO se usa — documentos se crean con `version_actual:'1.0'`, `estado:'Borrador'`, sin folio.
5. **SLA quejas:** visual por prioridad desde `sla_config` (`proceso='quejas'`); días≤alerta verde, ≤vencimiento ámbar, >vencimiento rojo; fallback 3/7 días. Desde la migración 005 **`fecha_sla` sí se persiste** (`now() + dias_vencimiento`) al crear la queja y al cambiar prioridad.
6. **SACP:** estados `Abierta`/`En Proceso`/`En Validación`/`Cerrada`; avance 100% → "En Validación"; cierre solo desde "En Validación" (→ "Cerrada" + 100%).
7. **Riesgos:** nivel = probabilidad × impacto (1-3 × 1-3): ≤2 Bajo, ≤4 Medio, ≤6 Alto, >6 Crítico; matriz 3x3.
8. **Documentos:** estados Borrador/Publicado/Archivado/En Revisión; tabs por estado; editar solo `version_actual`.
9. **Catálogos:** CRUD con cascada módulo→tipo, filtro activo NULL, edición inline. SLA y config general editables.
10. **Reportería:** informes por módulo con resumen por estado, distribución, vencidos, e impresión CSS (`@media print` oculta aside/header, `.informe-content`).
11. **Dashboard:** 4 KPIs + tareas pendientes de quejas (≠Cerrada, vence=`fecha_sla`) y acciones (≠Cerrada, vence=`fecha_limite`). "Actividad Reciente" hardcodeada.
12. **Catálogo vacío:** modales de quejas muestran `<input>` de texto libre si el catálogo viene vacío (fallback).
13. **React Query:** global `staleTime: Infinity`, `gcTime: 30min`, `retry: 1`, sin refetch on focus/reconnect/mount; invalidación manual tras mutaciones. Excepciones: quejas (`refetchOnMount:'always'`), notificaciones (`refetchInterval: 60s`), estadísticas.
14. **Formulario público de quejas:** ruta `/q/[token]` pública (sin auth) — `AuthShell` salta el guard para `['/login', '/q']`. Valida token contra `formularios_publicos` (`activo=true`) y crea vía RPC `crear_queja_publica(...)` (SECURITY DEFINER, estado `Recibido`, **NO notifica** — migración 015). Adjuntos opcionales van a `POST /api/drive/upload-public` (FormData `file`+`folio`+`token`; sube a la subcarpeta del folio, responde `drive_file_id` + `queja_id`); luego cada archivo se registra vía RPC `registrar_adjunto_queja_publica` (migración 011, ejecutable por `anon`) que inserta en `queja_adjuntos` con `usuario_id = NULL`, exige estado `Recibido` y aplica tope de 10 evidencias. **Orden del submit** (cliente): (1) `crear_queja_publica` → folio, (2) subir/registrar todos los adjuntos, (3) `notificar_queja_publica(p_folio)` dispara la notificación al staff — así la campana suena SOLO cuando la queja ya tiene sus evidencias (o se confirma que no las hay), evitando la notificación "sin adjuntos". Si fallan N evidencias, el ciudadano igualmente ve su folio (toast avisando los fallidos).
15. **Gestión de enlaces:** tab "Formularios" en `/configuracion` (solo admin): crea enlaces con token, copia URL, activar/desactivar, eliminar. Hook `useFormulariosPublicos`.
16. **Máquina de estados queja:** `Recibido → (No Procede | En Investigación) → Resuelto → Finalizado`, con `Pendiente de Revisión GC` opcional entre En Investigación y Resuelto y reapertura desde Resuelto/Finalizado. Validada en la DB por `transicionar_queja` (6 params). Detalle en regla 27 y sección del QuejaDetalleModal.
17. **Comentarios de quejas:** `quejas_comentarios` (tipo `interno`/`cliente`, `visible_cliente`) listado y alta en `QuejaDetalleModal`. Hook `useQuejaComentarios`.
18. **Responsable:** se asigna SOLO en el flujo de "Procede" (Recibido). En "En Investigación" es fijo (no editable). `actualizarDetallesQueja` permite cambiar responsable/notas/prioridad/categoría (staff).
19. **Derivar a SACP:** botón en estados `En Investigación`/`Resuelto`; crea `acciones` con `origen='queja'`, `origen_id`, folio por RPC y guarda `quejas.derivado_sacp_id`. Idempotente.
20. **Notificaciones reales:** las mutaciones de quejas insertan notificaciones **dentro de los RPC** (`transicionar_queja`, `agregar_comentario_queja`, `notificar_queja_publica`, `procesar_alertas_quejas`) dirigidas al responsable + admin/calidad activos. **EXCEPCIÓN (migración 015):** `crear_queja_publica` ya NO notifica — solo crea la queja; la notificación de "nueva queja" la dispara por separado el RPC `notificar_queja_publica(p_folio)`, que el frontend invoca DESPUÉS de subir los adjuntos (evita la notificación "sin adjuntos"; guarda anti-duplicados por `tipo='queja_nueva' AND origen_id`). `notificacionService` lista/actualiza del Header. Campana conectada a `useNotificaciones` (no leídas, dropdown, marcar leída/todas, archivar, vaciar, refetch 60s, beep al subir).
21. **Alertas de vencimiento:** función `procesar_alertas_quejas()` (3 y 1 día antes de `fecha_limite_investigacion`) + cron diario 06:00 (solo si `pg_cron` disponible). Llena `mail_queue` sin worker (envío de email NO implementado).
22. **Indicadores en `/quejas`:** 4 StatCards vía `useQuejasEstadisticas` (RPC `obtener_estadisticas_quejas`, server-side).
23. **Menú de usuario (Header):** avatar+nombre+rol dropdown (click afuera/Escape cierra) con "Cambiar contraseña" (autoservicio `supabase.auth.updateUser`, `CambiarMiPasswordModal`), preferencias de notificación (Switch + selector de sonido con preview) y logout. El bloque de usuario al pie del Sidebar fue ELIMINADO.
24. **Centro de notificaciones:** archivar individual (botón "x" al hover) y "Vaciar" setean `notificaciones.archivada=true` (query filtra `.eq('archivada', false)`); si `notif_habilitadas=false` no se pide el badge/query (`enabled`); beep Web Audio cuando sube el conteo de no-leídas solo si `notif_sonido=true`.
25. **Sonido de notificación (8 MP3 autohospedados):** `usuarios.notif_sonido_id` (CHECK en 8 ids `notification/{info,success,popup,error}` + `game/{coin,void,hit,miss}`, lista y `playNotificationSound()` en `sonidosNotificacion.ts`); selector con preview (▶) en preferencias del menú, visible solo si el toggle de sonido está on; RPC `actualizar_mis_preferencias_notificacion` recibe `p_sonido_id`. Se reproducen decodificados vía `decodeAudioData` + `AudioContext` (sin CDN en runtime, funciona tras firewall). Migración 003 tiene el CHECK (con DROP previo del RPC por 42P13).
26. **Realtime** (`useRealtimeSubscription`): `/quejas` suscribe a `quejas` (invalida quejas+estadísticas+dashboard); `Header` suscribe a `notificaciones` por `usuario_id` (badge + beep inmediato). Debounce de 750ms antes de invalidar.
27. **Capa transaccional de quejas (migración 005):** helpers SECURITY DEFINER `app_es_staff()` / `app_es_admin()` / `app_usuario_actual_id()`. RPCs `crear_queja_interna`, `actualizar_detalles_queja`, `transicionar_queja`, `derivar_queja_a_sacp`, `agregar_comentario_queja` (validan staff, `FOR UPDATE`, escriben `logs`). Cliente: `quejaWorkflowService` (`crearQuejaInterna`, `actualizarDetallesQueja`, `transicionarQueja` con 6 params, `derivarQuejaASACP`, `agregarComentarioQueja`).
28. **Adjuntos de quejas (Google Drive vía Service Account):** los archivos NO tocan Supabase Storage (el bucket privado `quejas-adjuntos` solo retiene legacy). Todo va a Google Drive server-to-server (`GOOGLE_CLIENT_EMAIL`/`GOOGLE_PRIVATE_KEY`). La carpeta raíz se lee de `configuraciones_sistema` (clave `drive_folder_id_quejas`, string jsonb editable en `/configuracion → General`; migración 010) y el backend hace **creación perezosa** de la subcarpeta por folio (`QUEJA-2026-0045`). **La subida NO usa `drive.files.create`**: `subirArchivoASubcarpeta` arma el `multipart/related` a mano con `fetch` nativo (undici) a `upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`, `Content-Length` exacto y `AbortSignal.timeout(DRIVE_TIMEOUT_MS)` (55s); Bearer sale de `auth.getAccessToken()` **normalizado** (devuelve `string | {token}`). googleapis queda solo para JWT firmado, operaciones de carpeta, descarga y **`eliminarArchivoDrive`** (`files.delete` con `supportsAllDrives`). Metadatos en `queja_adjuntos`: `storage_path` guarda el **`drive_file_id`** (paths legacy contienen `/`, los IDs de Drive no — `esDrive(storagePath) = !storagePath.includes('/')` en `lib/utils/drive.ts`). **Estructura de carpetas**: evidencias del cliente → raíz `QUEJA-XXXX/`; evidencias de análisis → `QUEJA-XXXX/Analisis/` (creación perezosa). Endpoints y POST `/api/drive/delete` (ver sección 3). Registro en DB vía RPC `registrar_adjunto_queja`; **eliminación** vía `DELETE /api/drive/delete` (borra fila + archivo en Drive en background). Cliente `quejaWorkflowService`: `subirAdjuntoQueja` (fetch multipart al endpoint + RPC), `eliminarAdjuntoQueja` (DELETE endpoint), `descargarAdjuntoQueja` (legacy signed URL → `window.open`; Drive → fetch Bearer → Blob → ObjectURL → click `<a download>`). UI en `QuejaDetalleModal` y `QuejaColaboradorPanel`: sección "Evidencias adjuntas" visible en TODOS los estados, separa evidencias del cliente (`usuario_id NULL`) de análisis (`usuario_id` presente, badge "Análisis"); subir SOLO en "En Investigación"; **eliminar** según `puedeEliminarAdjunto` (cliente → solo admin; análisis → admin/calidad O responsable) con `ConfirmDialog`.
29. **Apps Script de extracción de contexto (Zero-Disk proactivo):** Google Apps Script que genera `.contexto_qms.txt` tras cada subida de evidencia. **Flujo**: el endpoint de upload envía `{ folderId }` a `APPS_SCRIPT_WEBAPP_URL` → el script extrae texto de los archivos según MIME → consolida `.contexto_qms.txt` → el endpoint de IA lo descarga como texto plano y lo inyecta en el prompt. **Soporte**: text/plaintext, Docs nativos, Sheets (pestañas con `|`), Slides, PDFs/Imágenes/Word (OCR vía copia a Doc con `ocr:true`), Excel, PowerPoint. **Lógica inteligente**: si no hay evidencias, elimina contextos previos y NO crea uno. Ignora `.DS_Store`, `Thumbs.db`, `desktop.ini`, `.contexto_qms.txt`, temporales Office (`~$*`). **Auto-limpieza** cron de `.contexto_qms.txt` en carpetas >15 días. **Zero-Disk blindada** (temporales en `finally` con `setTrashed`). **Env var**: `APPS_SCRIPT_WEBAPP_URL` (opcional) — si no está, el upload funciona sin pre-cargar contexto.
30. **Panel Mis Quejas (`QuejaColaboradorPanel`):** tabs Detalle/Análisis/Resolución. Detalle = datos + bloque "Justificación de Gestión de Calidad" (`queja.notas`, `[Procede] ...`) + evidencias. Análisis = Asistente IA (dual-view Lectura/Edición + chat) + agregar nota (`quejas_actividad`, tipo 'nota' vía `useQuejaActividad`) + "Evidencias de análisis" (subir en `En Investigación`) + timeline de actividad. Resolución: textarea conclusión + botón "Enviar a Revisión GC" (`En Investigación → Pendiente de Revisión GC` con `p_resolucion`; colaborador-responsable puede). Panel `fixed top-0 right-0 z-50 h-screen w-[500px]` ↔ `w-full` (isExpanded), `shadow-2xl`. NO hay botón "Iniciar investigación" — arranca sola al asignar responsable.
31. **Análisis IA dual-view (Lectura/Edición):** el resultado IA se muestra en modo **Lectura** por defecto (ReactMarkdown con `prose prose-blue`) con botón toggle a modo **Edición** (textarea plano con clases específicas). El toggle usa `modoEdicion` state. Iconos `Eye`/`Edit`. El chat muestra mensajes en burbujas (usuario azul, IA blanca con borde).
32. **Cadena de fallback IA de 3 niveles:** (1) proveedor principal + modelo configurado, (2) sub-fallback intra-proveedor (otros modelos del mismo provider), (3) fallback externo (`fallback_provider_id` + `fallback_modelo`). Cada intento crea un `AbortController` con cleanup explícito (`controller.abort()` en catch + `clearTimeout` en finally). Pausa de 200ms entre intentos.
33. **Blindaje Gemini 3 niveles:** (1) `resolverGeminiFlashAuto` en aiFactory.ts (caché 24h, regex estricta `/^models\/gemini-[0-9]+\.[0-9]+-flash$/`), (2) `crearGemini` usa variable aislada `finalModelName`, (3) `ejecutarProveedorIA` en route.ts intercepta PRIMERO `'gemini-flash-auto'`.
34. **Memoria de modelos (modelMemory.ts):** `guardarUltimoExito` (modelo + latencia + tamaño prompt), `obtenerUltimoExito` inteligente por tamaño (grande+<45s válido para grande; corto+>10s descartado para corto), `registrarFallo` con penalización condicional (timeout en prompt >10K = informativo, sin penalizar), TTL progresivo (1=30min, 2=1h, 3=4h).
35. **Testeo de modelos (server-side vía `/api/ai/test`):** el testeo ya NO corre en el cliente (evita arrastrar el SDK de IA y exponer API keys). La UI (`AIProvidersManager`) itera los modelos y hace `POST /api/ai/test` (`{ providerId, modelo }`, Bearer admin) por modelo; el endpoint resuelve el provider desde `configuraciones_sistema`, ejecuta `testearModelo` server-side y devuelve `{ modelo, ok, latenciaMs, error }`. La UI acumula y guarda el resultado en BD vía `guardarResultadoTest` (`ai_test_resultado_<id>`). Utilidades client-safe en `modelTestingClient.ts` (`obtenerResultadoTest`, `limpiarResultadoTest`, `modelosExcluidosPorTest`, `guardarResultadoTest`). UI con modal personalizado, progreso en tiempo real, Iniciar/Cancelar/Cerrar. Al sincronizar, excluye modelos con `ok:false` previo.
36. **Descubrimiento de modelos (modelDiscovery.ts):** `obtenerModelosDisponibles` vía ListModels API. OpenRouter: filtrado estricto free-only (pricing 0, excluye `~`, `:paid`, `:premium`, batch, preview/beta/exp/dev, max 50). Caché en BD (`ai_modelos_cache_<id>`). Auto-limpieza de pagados al cargar UI.
37. **Timeout dinámico (route.ts):** `getTimeoutParaPrompt(tamanoPrompt, esOpenRouter)`: <5K→10-15s, 5-20K→20-30s, ≥20K→30-45s. Límite global: 50s (corto) o 55s (≥10K). Sub-fallback: 5 modelos (corto) o 3 (grande).
38. **Fallback a prueba de fallos:** cualquier error (timeout/HTTP/red/parseo) → registro + invalidación caché + siguiente modelo. NO hay distinción por tipo. El cliente solo recibe error cuando TODAS las opciones se agotaron. Error final: `"Todos los modelos agotados (Xs). Último error: ..."`.
39. **Quejas vistas (`useQuejasVistas`):** localStorage por usuario (`eca_quejas_vistas_<id>`, máx 500 entradas). Al abrir el detalle se marca como vista (en `requestAnimationFrame`, sin bloquear); en la tabla las no vistas se resaltan (fondo azul suave + folio/cliente en negrita, estilo Gmail). Botón "N sin ver" marca todas las visibles. Se usa en `/quejas`.
40. **Roles y Accesos (tab `/configuracion`):** `RolesAccesos.tsx` edita la tabla `permisos` con Switch Ver/Editar por rol×módulo (`useActualizarPermiso` → upsert). El switch de `configuracion` para admin está bloqueado (siempre on). Cambios aplican al recargar sesión.
41. **Vistas / simulación de rol (`ModoVistaActiva`):** el admin puede activar la vista de otro rol sin salir de sesión → `auth-store.setVistaActiva(rol)` recarga los permisos de ese rol (`fetchPermisosByRol`) y los aplica en AuthShell/Sidebar; el acceso a Configuración se mantiene siempre para el admin (puede revertir).

## 6. Reglas en el esquema pero NO implementadas (gaps / deuda técnica)

- **Quejas:** `fecha_sla` y `fecha_limite_investigacion` sí se persisten (RPCs 005/009); las alertas dependen de `pg_cron`/Edge Function (mail_queue se llena, sin worker de envío).
- **SACP:** `origen`/`origen_id`/`fecha_apertura` los escribe `derivar_queja_a_sacp`; `eficacia`, `validado_por_gc`, `responsable_id`, `prioridad`, `notas` — en la interfaz pero nunca escritos.
- **Auditorías:** no hay CRUD de hallazgos; "Derivado a SACP" solo es un badge si el campo viene poblado.
- **Documentos:** `documento_versiones`/`versiones_documentos` nunca se escriben; campos Drive `drive_file_id*` sin uso; historial es placeholder.
- **Permisos:** tabla dinámica 006 SI consultada por `auth-store`/`AuthShell`/`Sidebar` vía permisos, pero `/configuracion` y `/usuarios` aún autorizan por `rol === 'admin'` (guard duro).
- **Sin escritores:** `informes_config`, `tareas`, `solicitudes_documentales`. `logs` sí lo escriben los RPC de quejas; `mail_queue` lo escribe `procesar_alertas_quejas` y `notificar_queja_publica` (sin worker).
- **RPC sin uso:** `reabrir_queja` (RPC 007) existe pero la UI usa `transicionar_queja` con `p_motivo_reapertura`.

## 7. Convenciones y gotchas

- **Estilos:** Tailwind v4 CSS-first (`@import "tailwindcss"` en `globals.css`); existe `tailwind.config.ts` pero el sistema real es v4 sin depender de él. **Look Bootstrap estandarizado "cuadradito"**: `@theme` define `--radius-*` pequeños (sm/md=0.25rem, lg=0.375rem) para radios uniformes. Mucho estilo inline con paleta fija: primario `#0d6efd`, dark `#212529`/`#2c3e50`/`#343a40`, bordes `#dee2e6`, texto `#6c757d`, fondo `#f4f7f6`. Clases `dark:` presentes en muchas páginas pero sin toggle conectado.
- **Tokens semánticos (`globals.css` @theme):** `--color-qms-primary #0d6efd`, `--color-qms-primary-dark #0b5ed7`, `--color-qms-dark #212529`, `--color-qms-muted #6c757d`, `--color-qms-border #dee2e6`, `--color-qms-header #343a40`, `--color-qms-surface #ffffff`, `--color-qms-scroll #cbd5e1`, `--color-qms-scroll-hover #94a3b8`. Los usan `/mis-quejas` y los componentes nuevos (ui/); el resto del sistema sigue con hex inline.
- **Scrollbars Monday (`globals.css`):** scrollbar global 15px; `.monday-scroll` (thumb 12px/track transparente, radius 4px, `background-clip: content-box`, horizonte con borders 6px y 20px, hover `--color-qms-scroll-hover`; Firefox `scrollbar-width: auto` + `scrollbar-color`); `.monday-scroll-no-x` oculta solo el horizontal.
- **Split-pane `/mis-quejas`:** `AuthShell` main tiene `p-4` (16px) → el panel ocupa `mr-[calc(500px-16px)]` cuando está abierto; la tabla usa `min-w-[calc(100%+484px)]` abierto / `min-w-[1200px]` cerrado para que NUNCA se encoja. Panel `fixed top-0 right-0 z-50 h-screen w-[500px]` ↔ `w-full` (isExpanded), `shadow-2xl`.
- **Select / copia:** `layout.tsx` tiene `<body className="select-none">` + excepciones `select-text` en tablas/paneles.
- **Purity lint (`react-hooks/set-state-in-effect`):** PROHIBIDO `setState` sincrónico en `useEffect`; patrones permitidos: ajuste en render con primitivos (`prevQuejaId` en QuejaColaboradorPanel/QuejaDetalleModal, `prevEditingId` en ProviderFormModal) o escrituras DOM directas a refs (`.scrollLeft` vía `syncPill`).
- **Purity lint (`react-hooks/purity`):** `Date.now()` no se puede llamar en render; en `app/quejas/page.tsx` se resuelve con `useState(() => Date.now())` + `setInterval` 60s (estado `ahora`).
- **Tipos:** `lib/types.ts` solo tiene `Queja`; cada hook declara sus tipos localmente.
- **Búsqueda con retraso:** `useDeferredValue` en quejas/usuarios.
- **Mapas de color centralizados:** `lib/constants/variants.ts` (`prioridadVariant`, `estadoVariant`, `estadoSACPVariant`, `estadoDocumentoVariant`) y `lib/constants/roles.ts` (`getRoleVariant`/`getRoleLabel`, 6 roles). Usar estos en lugar de mapas ad-hoc.
- **RPC:** `.rpc()` en la app: `folioService.generarFolio`, `crear_queja_publica` + `notificar_queja_publica` (formulario público `/q/[token]`), `actualizar_mis_preferencias_notificacion`, `app_mis_permisos` (auth-store), y el flujo de quejas vía `quejaWorkflowService` (`crear_queja_interna`, `actualizar_detalles_queja`, `transicionar_queja` 6 params siempre, `derivar_queja_a_sacp`, `agregar_comentario_queja`, `registrar_adjunto_queja` tras subir a Drive, `registrar_adjunto_queja_publica` en /q). `obtener_estadisticas_quejas` (013) retorna JSON server-side. `incrementar_tokens_proveedor` (014) atómico. Ambos RPCs de adjuntos (011 v4) hacen **dual-write** a columnas legacy (`nombre_archivo`, `url_archivo`).
- **Gotcha PostgREST:** si en la DB existen DOS overloads de un RPC y el nuevo tiene defaults, enviar menos parámetros tira "Could not choose the best candidate function" — el cliente envía SIEMPRE los 6 params de `transicionar_queja` y el overload viejo se elimina con la migración 008.
- **Gotchas Google Drive (adjuntos):** `auth.getAccessToken()` devuelve `string | {token}` — normalizar SIEMPRE (sin normalizar `Bearer [object Object]` → 401). NO subir con `drive.files.create` (multipart de gaxios lento/cuelga): usar `subirArchivoASubcarpeta` (REST con fetch nativo). La carpeta raíz debe compartirse con la Service Account como Editor. La tabla real `queja_adjuntos` tiene columnas legacy (`nombre_archivo`, `url_archivo`) NOT NULL: los RPC hacen dual-write. `DRIVE_TIMEOUT_MS = 55000`. `APPS_SCRIPT_WEBAPP_URL` (opcional): fire-and-forget tras cada subida.
- **Errores:** `errorToast.ts` (showError/showSuccess) envuelve sonner + console.error.
- **Env vars (.env.local):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` (key con `\n` literales entre comillas; compartir la carpeta raíz con el email de la SA como Editor). `APPS_SCRIPT_WEBAPP_URL` (opcional). NOTA: `.env.local` existe en el workspace; el `.gitignore` lo excluye.
- **`next.config.ts`** presente; build con `next build`, dev con `next dev`, lint con `eslint` (`npm run lint`).

## 8. Subsistema de IA Multi-Proveedor (ilimitado)

Gestor de IA dinámico, sin modelos fijos. Configuración en `configuraciones_sistema` (jsonb, RLS staff SELECT / admin write). La UI activa es `components/configuracion/AIProvidersManager.tsx` (tab IA de `/configuracion`).

- **`ai_providers`** (`AIProvider[]`): `{ id, nombre, tipo: 'gemini'|'anthropic'|'openai', base_url?, api_key, tokens_usados: number, limite_tokens: number, modelos: string[], tokens_updated_at?: string }`. `base_url` solo aplica a tipo `openai` (endpoints compatibles: OpenAI, DeepSeek, Grok xAI, OpenRouter…). `tokens_usados` odómetro mensual con auto-reset. `limite_tokens` (presets: gemini 30M, openai/Groq 6M, anthropic 250K), `modelos` array, `tokens_updated_at`.
- **`ai_routing`** (`AIRouting` = `Record<modulo, { proveedor_id, modelo_nombre, system_prompt?, fallback_provider_id?, fallback_modelo? }>`): módulos `quejas, sacp, documentos, auditorias, riesgos, revision, general`.
- **`ai_cache_ttl_minutes`** (number, default 1440 = 1 día).
- **`ai_modelos_cache_<providerId>`**, **`ai_ultimo_exito_<providerId>`**, **`ai_fallos_<providerId>`**, **`ai_test_resultado_<providerId>`**.

### Modelos y descubrimiento (`lib/ai/modelDiscovery.ts`)

- **`obtenerModelosDisponibles(provider)`** → `{ modelos, total, descartados }`: descubre vía ListModels API. OpenRouter: free-only estricto (pricing 0, excluye `~`, `:paid`, `:premium`, batch, preview/beta/exp/dev, max 50). Gemini: REST `v1beta/models`. OpenAI: `/models`. Anthropic: sin listModels (modelos fijos en DB).
- **`esOpenRouter(provider)`**, **`esModeloAuto(modelo)`**, **`obtenerModelosCache/guardarModelosCache/invalidarModelosCache`** (BD, no in-memory).

### Memoria de modelos (`lib/ai/modelMemory.ts`)

- **`guardarUltimoExito`**, **`obtenerUltimoExito`** (inteligente por tamaño: grande+<45s válido para grande; corto+>10s descartado para corto; TTL 24h), **`registrarFallo`** (penalización condicional: timeout en prompt ≥10K solo informativo; TTL 30min/1h/4h), **`obtenerModelosNoPenalizados`**, **`limpiarMemoriaModelos`**.

### Testeo de modelos (`lib/ai/modelTesting.ts` server-only + `modelTestingClient.ts` client-safe)

- **`modelTesting.ts`** (SERVER-ONLY, importa el SDK vía `aiFactory`): `testearModelo(provider, modelo, prompt)` y las constantes `PROMPT_CORTO`/`PROMPT_LARGO`.
- **`modelTestingClient.ts`** (client-safe, SIN SDK): `obtenerResultadoTest`, `limpiarResultadoTest`, `guardarResultadoTest`, `modelosExcluidosPorTest`.
- Endpoint **`POST /api/ai/test`** (Bearer admin, un modelo por request): resuelve el provider desde `configuraciones_sistema`, ejecuta `testearModelo` server-side. El SDK de IA nunca sale al navegador.

### Factory (`lib/ai/aiFactory.ts`)

`crearClienteIA(provider, modelo)` devuelve `AIClient.analizar({ prompt, system?, maxTokens?, temperature?, archivos? })`. OpenAI y Anthropic usan `fetch` nativo: OpenAI `/chat/completions` (Bearer, imágenes `image_url` data URI), Anthropic `/v1/messages` (x-api-key + anthropic-version, imágenes `image` base64). **Gemini usa el SDK `@google/generative-ai`** (`generateContent` con parts `inlineData` base64 para cualquier MIME incl. PDF). Timeout 120s. `analizar` devuelve `{ texto, uso? }` normalizando `usage` → `{ prompt_tokens, completion_tokens, total_tokens }`. `validarBaseUrl()` contra allowlist + anti-SSRF (IPs privadas).

### Blindaje Gemini (3 niveles)

1. `resolverGeminiFlashAuto` (caché 24h, regex estricta, rechaza preview/experimental).
2. `crearGemini` usa variable aislada `finalModelName`; si es `'gemini-flash-auto'` → `resolverGeminiFlashAuto`.
3. `ejecutarProveedorIA` en route.ts intercepta PRIMERO `'gemini-flash-auto'`.

### Endpoint (`app/api/ai/analizar/route.ts`)

`runtime nodejs`, `maxDuration = 60`. Recibe `{ modulo, entidad_id, tipo_consulta: 'auto'|'custom', prompt_usuario? }`. Autentica `getCurrentUser`; autoriza staff OR (si `quejas`) `responsable_id`. `resolverEntidad` busca la queja por `id` O `folio`. Lee `ai_providers`+`ai_routing`.

**Timeout dinámico** (`getTimeoutParaPrompt`): <5K→10-15s, 5-20K→20-30s, ≥20K→30-45s. **Límite global**: <10K→50s, ≥10K→55s. **Sub-fallback**: <10K→5 modelos, ≥10K→3 modelos.

**Cadena de fallback (3 niveles)**: (1) principal+configurado (usa último éxito si rápido), (2) sub-fallback intra-proveedor (`obtenerModelosNoPenalizados`, verifica tiempo global), (3) fallback externo (`fallback_provider_id`+`fallback_modelo`). Si todo falla → 502 `"Todos los modelos agotados (Xs). Último error: ..."`. **Fault-proof**: sin distinción por tipo de error.

**Auto-reset mensual**: compara mes actual vs `tokens_updated_at`; si cambió → `tokens_usados = 0` y persiste.

**Zero-Disk / Prompt Injection**: descarga `.contexto_qms.txt` de Drive como texto plano → inyecta en `promptFinal` con delimitador `--- Contexto pre-generado (.contexto_qms.txt) ---`. Si no existe o falla, continúa sin contexto.

**Presets de límites** (auto-selección en UI): gemini 30M, openai/Groq 6M, anthropic 250K.

Si `uso.total_tokens > 0` → incrementa `tokens_usados` vía RPC atómico `incrementar_tokens_proveedor` (014). Devuelve `{ analisis, tokens_consumidos }`. **Las API keys NUNCA salen del servidor**.

### UI (`components/configuracion/AIProvidersManager.tsx`, tab **IA**, solo admin)

- **Proveedores**: tabla con Nombre, Tipo, URL Base, Modelos, API Key (mostrar/ocultar), barra de consumo `w-36 h-2` (verde <70%, ámbar 70-90%, rojo >90%) + `{usados} / {límite} ({pct}%)`, botones Probar Conexión, Sincronizar Modelos (↻), Reiniciar contador, Testear Modelos (▶), Editar, Eliminar.
- **Modal estándar `size="lg"`** centrado + campos Nombre, Tipo API, URL Base (solo OpenAI), Modelos Soportados (comma-separated → `string[]`), **Límite de Tokens** (auto-rellena al cambiar Tipo API), API Key.
- **Selectores de modelo** 100% impulsados por `provider.modelos` (sin "Otro/Escribir manual"); si 1 solo modelo → auto-selección.
- **Enrutamiento por módulo** con botón "Respaldo" (fallback) expandible → selectores Proveedor Secundario + Modelo Secundario (dinámicos). Guarda en `routing[modulo].fallback_*`.
- **Sincronización inteligente**: excluye modelos `ok:false` del test previo; limpia memoria de fallos y resultados obsoletos.
- **Test de modelos**: modal con lista, progreso en tiempo real (Loader2/CheckCircle/XCircle), Iniciar/Cancelar/Cerrar.
- **TTL de caché**: selector de unidades (minutos/horas/días), persiste en `ai_cache_ttl_minutes`.

### Frontend IA (`app/mis-quejas/components/QuejaColaboradorPanel.tsx`, tab **Análisis**)

- Botón **✨ Análisis IA** (auto) + chat (prompt custom) → `modulo:'quejas'` vía `aiService.analizarIA` (POST Bearer).
- **Dual-view toggle**: Lectura (ReactMarkdown `prose prose-blue`) / Edición (`textarea` plano con clases específicas: `w-full min-h-[500px] p-6 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-blue-600 outline-none resize-y shadow-sm font-sans leading-relaxed whitespace-pre-wrap`). Iconos `Eye`/`Edit`.
- **Chat de IA**: burbujas (usuario azul, IA blanca con borde), textarea + botón "Enviar".

### Seguridad

- **Server-only guards**: `lib/server/supabase-admin.ts`, `lib/server/auth.ts`, `lib/server/drive.ts` — importan `'server-only'`. Ningún componente cliente importa de `lib/server/*`.
- **SSRF prevention**: `validarBaseUrl()` en `lib/ai/aiFactory.ts` (allowlist + IPs privadas).
- **MIME allowlist estricta**: upload interno y público — PDF, JPEG, PNG, WebP, Word, Excel, texto plano. 415 si no.
- **Último admin protection**: `/api/usuarios` PATCH y DELETE → 409 si deja sin admins activos.
- **`hacerArchivoPublico` eliminado**: removido de `lib/server/drive.ts` por riesgo de seguridad.
- **Rate limiting en memoria**: `lib/server/rateLimit.ts` por IP. Aplicado en: `/api/ai/analizar` (10/min), `/api/drive/upload*` + `/api/drive/delete` (30/min), `/api/usuarios` (20/min). 429 si se excede.
- **Streaming uploads anti-OOM**: `streamToBuffer()` lee en chunks con `reader.read()`, límite 50 MB (protección OOM en Vercel con subidas concurrentes).
- **Apps Script webhook**: endpoints de upload disparan POST fire-and-forget a `APPS_SCRIPT_WEBAPP_URL` con `{ folderId }`. No afecta la respuesta.
- **Error boundaries**: `app/error.tsx`, `app/global-error.tsx` (con `<html>`), `app/quejas/error.tsx`, `app/documentos/error.tsx`.
- Las API keys se guardan en texto plano en `configuraciones_sistema` (accesible por admin vía cliente anon RLS). El endpoint las usa solo server-side. Para secreto fuerte, mover a env/Vault.
