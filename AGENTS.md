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
  layout.tsx                 root layout (providers + AuthShell)
  page.tsx                   / Dashboard
  login/page.tsx             /login (Supabase Auth email/password)
  api/usuarios/route.ts      CRUD usuarios (service-role)
  api/drive/upload/route.ts       subida interna de adjuntos a Google Drive (Bearer)
  api/drive/download/route.ts     descarga streaming de adjuntos desde Drive (Bearer)
  api/drive/upload-public/route.ts subida pública de evidencias /q/[token] (valida token)
  api/ai/analizar/route.ts        análisis IA multi-proveedor (runtime nodejs, maxDuration 60, Strategy Pattern + timeout dinámico + fallback a prueba de fallos + memoria de modelos)
  quejas/  page.tsx + NuevaQuejaModal, QuejaDetalleModal (decisión de procedencia, adjuntos, responsable fijo en investigación, reapertura, comentarios, derivar SACP)
  mis-quejas/ page.tsx + QuejaColaboradorPanel (panel fixed 500px expandible + tabs Detalle/Análisis/Resolución; solo quejas donde soy responsable; análisis IA con ReactMarkdown vista previa + textarea edición)
  configuracion/ page.tsx     catálogos + SLA + config + Formularios (solo admin)
  procesos/  page.tsx + NuevoProcesoModal
  auditorias/page.tsx + NuevaAuditoriaModal  (modal de hallazgos inline)
  riesgos/   page.tsx + NuevoRiesgoModal     (matriz 3x3 inline)
  revision/  page.tsx + NuevaReunionModal    (reuniones / Revisión Dirección)
  documentos/page.tsx + NuevoDocumentoModal  (tabs: Todos/Maestra/Edición)
  reporteria/page.tsx + GeneradorInformeModal (informes imprimibles)
  sacp/      page.tsx + NuevaSACPModal       (acciones, avance % inline)
  usuarios/  page.tsx + modales (solo admin, usa /api/usuarios)
  q/[token]/ page.tsx    formulario público de quejas (sin auth, categorías fijas obligatorias)
components/
  AuthShell.tsx              guard de auth global (redirige a /login; salta guard para /login y /q)
  Sidebar.tsx                sidebar colapsable + hover-prefetch (admin-only sección) — SIN bloque de usuario al pie
  Header.tsx                 título por ruta + campana (notificaciones reales, dropdown, archivar, vaciar, beep) + menú de usuario (avatar → cambiar contraseña, preferencias notif con Switch, logout)
  Modal.tsx                  modal reutilizable (sm/md/lg, Esc/overlay)
  StatCard.tsx               tarjeta KPI (soporta dark)
  ui/  Badge, Button, Select, Table, EmptyState, PageHeader, Skeleton, StatusDot, FieldGroup, Switch
  usuarios/  UsuarioFormModal, PasswordModal, ResetPasswordModal, CambiarMiPasswordModal (autoservicio), ConfirmDialog
  configuracion/  AIProvidersManager (tab IA: CRUD proveedores + barra consumo % + fallback + modal lg + presets límites + auto-selección modelo único)
  quejas/  AdjuntoPreviewModal (Drive iframe + legacy Blob)
lib/
  supabase.ts                cliente anon singleton
  auth.ts                    signIn/signOut/getAppUser (Supabase Auth)
  types.ts                   solo tipo Queja (resto definidos por query)
  providers/  QueryProvider (React Query), ToastProvider (sonner)
  queries/    queryKeys + useQuejas (incl. useSLAConfig, useQuejasEstadisticas, useQuejaAdjuntos), useCatalogos, useDashboard,
              useAuditorias, useDocumentos, useProcesos, useReuniones, useRiesgos, useSACP, useUsuarios,
              useFormulariosPublicos, useQuejaComentarios, useQuejaActividad, useNotificaciones
  server/     auth.ts (getCurrentUser Bearer), supabase-admin.ts (service client), drive.ts (getDriveClient JWT Service Account + buscarOCrearSubcarpeta por folio)
  services/   quejaWorkflowService (transicionarQueja 6 params, adjuntos storage, reabrirQueja), folioService, notificacionService,
              errorToast, passwordGenerator, sonidosNotificacion, aiService (analizarIA)
              + capa legacy SIN uso: queja/auditoria/documento/proceso/reunion/riesgo/sacp/user Service
  ai/         types.ts (AIProvider, AIRuta, AIRouting, ArchivoIA), aiFactory.ts (crearClienteIA multi-proveedor + blindaje Gemini + sanitización modelo + resolverGeminiFlashAuto con caché 24h)
              modelDiscovery.ts (obtenerModelosDisponibles multi-proveedor + OpenRouter free-only estricto + DB cache), modelMemory.ts (guardarUltimoExito/obtenerUltimoExito/registrarFallo/obtenerModelosNoPenalizados + latencia + penalización condicional por tamaño de prompt), modelTesting.ts (testearModelo/testearProveedor con progreso en tiempo real + persistencia en BD)
  store/      auth-store (Zustand), sidebar-store, theme-store (HUÉRFANO, sin toggle)
hooks/
  useHoverPrefetch.ts        prefetch por hover en Sidebar (80ms debounce)
  useRealtimeSubscription.ts suscripción Realtime + invalidación de queries (consumidores: /quejas y Header)
supabase/  *.sql (seeds/RPC/dumps) · 001 (formulario público + alertas) · 002 (prefs notif + archivada) ·
           003 (selección sonido) · 004 (realtime + notif queja pública) · 005_seguridad_flujos_quejas.sql
           (RPC transaccionales de quejas + RLS reforzada) · 006 (permisos dinámicos rol+modulo, rol colaborador,
           quejas_actividad, estado GC) · 007 (queja_adjuntos + registrar_adjunto_queja + reabrir_queja + bucket
           storage)            · 008 (drop overload viejo transicionar_queja) · 009 (transicionar_queja COMPLETA 6 params)
           · 010 (config drive_folder_id_quejas para Drive) · 011 v4 (RPCs adjuntos público+interno alineados a la
           tabla real: dual-write nombre/nombre_archivo y storage_path/url_archivo)
           · rls-policies.sql en raíz
```

## 2. Frontend — Detalle por página

| Ruta | Datos | Componentes clave |
|------|-------|-------------------|
| `/` | 4 KPIs (quejas ≠Cerrada, acciones ≠Cerrada, docs Borrador, riesgos Activos) + tareas pendientes (top 8 por vencimiento). "Actividad Reciente" es **100% hardcodeada** | Table, Badge, StatCard |
| `/quejas` | búsqueda folio/cliente, filtros estado/prioridad, paginación 25, SLA visual por prioridad vs `sla_config`; estado `ahora` + setInterval 60s para Date.now (purity lint) | NuevaQuejaModal, QuejaDetalleModal |
| `/configuracion` | 4 tabs: Catálogos (cascada módulo→tipo, CRUD), SLA y Plazos (`sla_config`), General (`configuraciones_sistema` update por clave), Formularios (enlaces `/q/[token]`). Guard `rol==='admin'` | — |
| `/procesos` | tabla estática `procesos` | NuevoProcesoModal |
| `/auditorias` | `auditorias` + modal hallazgos (`hallazgos` eq auditoria_id, SOLO lectura) | NuevaAuditoriaModal |
| `/riesgos` | tabla + matriz 3x3 (nivel = prob×impacto: ≤2 Bajo, ≤4 Medio, ≤6 Alto, >6 Crítico) | NuevoRiesgoModal |
| `/revision` | reuniones (`reuniones`) + modal detalle | NuevaReunionModal |
| `/documentos` | tabs Todos/Lista Maestra(Publicado)/Edición Viva(Borrador); editar `version_actual` directo | NuevoDocumentoModal |
| `/reporteria` | wizard 3 pasos: módulo → filtros → informe con tabla/resumen por estado/distribución/vencidos + `window.print` | GeneradorInformeModal |
| `/sacp` | acciones con barra %, avance (100% → "En Validación"), cierre solo desde "En Validación" (→ "Cerrada" 100%) | NuevaSACPModal, modales inline |
| `/usuarios` | stats + filtros + CRUD vía `/api/usuarios`. Guard `rol==='admin'` | UsuarioFormModal, PasswordModal, ResetPasswordModal, ConfirmDialog |
| `/q/[token]` | formulario público de quejas sin auth (valida token en `formularios_publicos` activo; crea vía RPC `crear_queja_publica`; muestra folio). Categoría = select FIJO obligatorio: Queja, Denuncia, Sugerencia, Reclamo, Felicitación (sin catálogo) | — |
| `/mis-quejas` | solo quejas donde `responsable_id = yo`. Toggle de páginas (ver sección 5 regla 30). Panel fixed 500px + expandir | QuejaColaboradorPanel |

## 3. Backend — API routes

**Rutas:** `app/api/usuarios/route.ts` y `app/api/drive/*` (todas `runtime nodejs`; usuarios usa service-role para operar Supabase Auth `admin`; drive usa service-role para leer config/autorizar + Service Account de Google).

- **GET** — admin o calidad. Lista `usuarios` con filtros `search`/`rol`/`estado`.
- **POST** — solo admin. Crea auth user (`admin.createUser`, email_confirm) + fila `usuarios` con `auth_id`. Rollback: si falla insert, borra el auth user. Genera contraseña temporal (≥8 o random).
- **PATCH** — solo admin. Autoprotección: no puedes auto-desactivarte, auto-cambiarte el rol ni auto-borrate. Actualiza Auth + tabla.
- **DELETE** — solo admin. Borra auth user + fila.

Server helpers en `lib/server/`: `getCurrentUser(request)` valida Bearer token y resuelve perfil `usuarios` por `auth_id` → `{auth_id, rol, email}`; `createServiceClient()` con service-role.

## 4. Base de datos (schema `public`)

Todas las tablas usan `id uuid` PK salvo indicado. Verificado con dump del dashboard real.

| Tabla | Columnas |
|-------|---------|
| `usuarios` | id, nombre, email, rol, estado, departamento, telefono, avatar_url, ultimo_acceso, created_at, auth_id (FK→auth.users.id), notif_habilitadas, notif_sonido, notif_sonido_id (CHECK 8 ids) |
| `quejas` | id, folio, cliente_nombre, email_cliente, telefono, categoria, descripcion, prioridad, estado, fecha, fecha_sla, fecha_limite_investigacion, fecha_cierre, resolucion, notas, responsable_id (FK→usuarios), derivado_sacp_id (FK→acciones) |
| `quejas_comentarios` | id, queja_id (FK→quejas), usuario_id (FK→usuarios), comentario, tipo, visible_cliente, fecha |
| `queja_adjuntos` | id, queja_id (FK→quejas), nombre, storage_path, tamano (bigint), tipo_mime, usuario_id (FK→usuarios), created_at — RLS en 007 (staff SELECT todo; colaborador solo sus quejas; INSERT solo vía RPC) |
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
- RLS activo en TODAS las tablas de negocio (quejas, acciones, auditorias, documentos, procesos, riesgos, reuniones, etc.). Desde la migración 005 también tienen RLS `catalogos`, `sla_config`, `configuraciones_sistema`, `permisos` (staff SELECT / admin write; `catalogos` además expone a `anon` solo `categoria_queja` activa). Sin RLS: `informes_config`.
- `quejas` y `quejas_comentarios`: SELECT solo staff (`app_es_staff()`) + política 006 para colaborador (solo sus quejas); **las mutaciones pasan solo por RPC** (no hay INSERT/UPDATE directo). `queja_adjuntos` (007): SELECT staff/colaborador-propio, INSERT solo vía RPC `registrar_adjunto_queja`. `notificaciones`: SELECT/UPDATE solo propias (`usuario_id = app_usuario_actual_id()`). `formularios_publicos`: anon SELECT `activo=true`, solo admin ALL.
- Folios: funciones RPC `generar_folio_queja/sacp/auditoria/riesgo/documento` (SECURITY DEFINER, sin args) → formato `PREFIJO-AAAA-NNNN` (QUEJA-, SACP-, AUD-, RIESGO-, DOC-) con secuencias `seq_folio_*` (START 1 CACHE 20). Reset anual manual (ALTER SEQUENCE). Triggers de auto-folio están **comentados** — el frontend llama al RPC explícitamente.
- `transicionar_queja` (migración 009) tiene **6 params con default**: `(p_queja_id, p_nuevo_estado, p_resolucion, p_justificacion_procede, p_responsable_id, p_motivo_reapertura)`. El cliente envía **SIEMPRE los 6 (null si no aplica)** — si existieran dos overloads (el viejo de 3 params fue eliminado en 008), PostgREST tira "Could not choose the best candidate function".
- `lib/queries/useQuejas.ts` usa `select('*', {count:'exact'})`, `or(folio.ilike/cliente_nombre.ilike)`, `eq` estado/prioridad, `order('fecha', desc)`, `.range(page*25, ...)`.

## 5. Reglas de negocio IMPLEMENTADAS

1. **Auth:** Supabase Auth + perfil `usuarios` por `auth_id`. `signIn` bloquea si `estado !== 'activo'` ("Tu cuenta está inactiva"). `auth-store.init` hace signOut si perfil inactivo; suscribe `onAuthStateChange`.
2. **Roles:** solo `admin` y `calidad` en la UI. Guard admin en `/configuracion` y `/usuarios` (`user?.rol !== 'admin'` → redirect `/`). Sidebar oculta sección Administración para no-admin. API usuarios: GET admin/calidad, POST/PATCH/DELETE solo admin.
3. **Usuarios:** autoprotección (no auto-desactivarse/eliminarse/cambiarse rol), contraseña temporal generada y mostrada una vez, reset de contraseña.
4. **Folios:** generados vía RPC antes del insert en quejas, SACP, auditorías y riesgos. **NOTA:** `generar_folio_documento` existe pero NO se usa — documentos se crean con `version_actual:'1.0'`, `estado:'Borrador'`, sin folio.
5. **SLA quejas:** visual por prioridad desde `sla_config` (`proceso='quejas'`); días≤alerta verde, ≤vencimiento ámbar, >vencimiento rojo; fallback 3/7 días. Desde la migración 005 **`fecha_sla` sí se persiste** (`now() + dias_vencimiento`) al crear la queja y al cambiar prioridad; la migración hace backfill de expedientes previos.
6. **SACP:** estados `Abierta`/`En Proceso`/`En Validación`/`Cerrada`; avance 100% → "En Validación"; cierre solo desde "En Validación" (→ "Cerrada" + 100%).
7. **Riesgos:** nivel = probabilidad × impacto (1-3 × 1-3): ≤2 Bajo, ≤4 Medio, ≤6 Alto, >6 Crítico; matriz 3x3.
8. **Documentos:** estados Borrador/Publicado/Archivado/En Revisión; tabs por estado; editar solo `version_actual`.
9. **Catálogos:** CRUD con cascada módulo→tipo, filtro activo NULL, edición inline. SLA y config general editables.
10. **Reportería:** informes por módulo con resumen por estado, distribución, vencidos, e impresión CSS (`@media print` oculta aside/header, `.informe-content`).
11. **Dashboard:** 4 KPIs + tareas pendientes de quejas (≠Cerrada, vence=fecha_sla) y acciones (≠Cerrada, vence=fecha_limite).
12. **Catálogo vacío:** modales de quejas muestran `<input>` de texto libre si el catálogo viene vacío (fallback).
13. **React Query:** `staleTime: Infinity`, `gcTime: 30min`, `retry: 1`, sin refetch on focus; invalidación manual tras mutaciones.
14. **Formulario público de quejas:** ruta `/q/[token]` pública (sin auth) — `AuthShell` salta el guard para `['/login', '/q']`. El formulario valida el token contra `formularios_publicos` (`activo=true`) y crea la queja vía RPC `crear_queja_publica(...)` (SECURITY DEFINER, estado `Recibido`). No abre INSERT directo a `anon`. Los adjuntos opcionales (input múltiple) van al endpoint `POST /api/drive/upload-public` (FormData `file`+`folio`+`token`: valida token activo + queja en `Recibido`, sube a Drive en la subcarpeta del folio y responde `drive_file_id` + `queja_id`); luego cada archivo se registra vía RPC `registrar_adjunto_queja_publica` (migración 011, ejecutable por `anon`) que inserta en `queja_adjuntos` con `usuario_id = NULL`, exige estado `Recibido` y aplica tope de 10 evidencias. Si fallan N evidencias, el ciudadano igualmente ve su folio (toast avisando los fallidos).
15. **Gestión de enlaces:** tab "Formularios" en `/configuracion` (solo admin): crea enlaces con token, copia URL, activar/desactivar, eliminar. Hook `lib/queries/useFormulariosPublicos.ts`.
16. **Máquina de estados queja:** `Recibido → (No Procede | En Investigación) → Resuelto → Finalizado`, con `Pendiente de Revisión GC` opcional entre En Investigación y Resuelto y reapertura desde Resuelto/Finalizado. Validada en la DB por el RPC `transicionar_queja` (6 params, rechaza transiciones inválidas). **Recibido (admin/calidad)**: botones Procede/No Procede; "No Procede" exige justificación → `p_resolucion`; "Procede" exige justificación (→ `p_justificacion_procede`, se guarda en `notas` como `[Procede] ...`) + responsable (→ `p_responsable_id`) y setea `fecha_limite_investigacion = now()+15d`. "En Investigación → Resuelto" exige `p_resolucion` (staff) y el responsable queda FIJO (no editable). "GC → Resuelto/En Investigación" solo staff. "Resuelto → Finalizado" solo staff. Reapertura (Resuelto/Finalizado → En Investigación) solo staff con `p_motivo_reapertura` obligatorio (→ `notas` como `[Reapertura] ...`, nuevo plazo 15 días). Flujo disparado desde `QuejaDetalleModal` vía `quejaWorkflowService`.
17. **Comentarios de quejas:** `quejas_comentarios` (tipo `interno`/`cliente`, `visible_cliente`) listado y alta en `QuejaDetalleModal`. Hook `lib/queries/useQuejaComentarios.ts`.
18. **Responsable:** se asigna SOLO en el flujo de "Procede" (Recibido). En "En Investigación" es fijo (no editable); en el resto de estados el selector de responsable solo está en Recibido. `actualizarDetallesQueja` permite cambiar responsable/notas/prioridad/categoría (staff).
19. **Derivar a SACP:** botón en estados `En Investigación`/`Resuelto`; crea `acciones` con `origen='queja'`, `origen_id`, folio por RPC y guarda `quejas.derivado_sacp_id`. Idempotente.
20. **Notificaciones reales:** las mutaciones de quejas insertan notificaciones **dentro de los RPC** (`transicionar_queja`, `agregar_comentario_queja`, `crear_queja_publica`, `procesar_alertas_quejas`) dirigidas al responsable + admin/calidad activos. `notificacionService.ts` (crearNotificacion/listar/marcar/archivar) se usa para listar y actualizar del Header. Campana conectada a `useNotificaciones` (no leídas, dropdown, marcar leída/todas, archivar, vaciar, refetch 60s).
21. **Alertas de vencimiento:** función `procesar_alertas_quejas()` (3 y 1 día antes de `fecha_limite_investigacion`) + cron diario 06:00 (solo si `pg_cron` está disponible; si no, queda pendiente Edge Function). Insertar filas en `mail_queue` sin worker (envío de email NO implementado).
22. **Indicadores en `/quejas`:** 4 StatCards (resueltas a tiempo %, procedencia %, quejas del mes, total) vía `useQuejasEstadisticas`.
23. **Menú de usuario (Header):** avatar+nombre+rol ahora es un dropdown (click afuera/Escape cierra) con "Cambiar contraseña" (autoservicio vía `supabase.auth.updateUser`, `CambiarMiPasswordModal`), preferencias de notificación (Switch `components/ui/Switch.tsx`, RPC `actualizar_mis_preferencias_notificacion`) y logout. El bloque de usuario al pie del Sidebar fue ELIMINADO.
24. **Centro de notificaciones:** archivar individual (botón "x" al hover) y "Vaciar" (todas visibles) setean `notificaciones.archivada=true` (query filtra `.eq('archivada', false)`); si `notif_habilitadas=false` no se pide el badge/query (`enabled`); beep Web Audio cuando sube el conteo de no-leídas solo si `notif_sonido=true`.
25. **Sonido de notificación (8 MP3 reales autohospedados):** `usuarios.notif_sonido_id` (CHECK en 8 ids `notification/{info,success,popup,error}` + `game/{coin,void,hit,miss}`, lista y `playNotificationSound()` en `lib/services/sonidosNotificacion.ts`); selector con preview (▶) dentro de las preferencias del menú de usuario, visible solo si el toggle de sonido está on; RPC `actualizar_mis_preferencias_notificacion` recibe `p_sonido_id`. Los mp3 son los originales de react-sounds (`public/sounds/*.mp3`, 4 notificación + 4 juego) descargados del CDN y autocontenidos — se reproducen decodificados vía `decodeAudioData` + `AudioContext` (sin CDN en runtime, funciona tras firewall). Migración 003 tiene el CHECK de 8 ids (con DROP previo del RPC por 42P13).
26. **Realtime** (`useRealtimeSubscription` en `hooks/`): `/quejas` suscribe a `quejas` (invalida quejas+estadísticas+dashboard); `Header` suscribe a `notificaciones` por `usuario_id` (badge + beep inmediato). Migración 004 habilita realtime para quejas y notificaciones y además `crear_queja_publica` ahora notifica a todos los admin/calidad activos (`tipo='queja_nueva'`) + inserta `mail_queue`.
27. **Capa transaccional de quejas (migración 005):** helpers SECURITY DEFINER `app_es_staff()` / `app_es_admin()` / `app_usuario_actual_id()`. RPCs `crear_queja_interna`, `actualizar_detalles_queja`, `transicionar_queja`, `derivar_queja_a_sacp`, `agregar_comentario_queja` (validan staff, `FOR UPDATE`, escriben `logs`). Cliente: `lib/services/quejaWorkflowService.ts` (`crearQuejaInterna`, `actualizarDetallesQueja`, `transicionarQueja` con 6 params, `derivarQuejaASACP`, `agregarComentarioQueja`). `derivar_queja_a_sacp` solo en `En Investigación`/`Resuelto` y es idempotente.
28. **Adjuntos de quejas (Google Drive vía Service Account):** los archivos NO tocan Supabase Storage (el bucket privado `quejas-adjuntos` solo retiene adjuntos legacy previos; sin INSERT nuevo). Todo va a Google Drive server-to-server con credenciales `GOOGLE_CLIENT_EMAIL`/`GOOGLE_PRIVATE_KEY` (.env.local). La carpeta raíz se lee dinámicamente de `configuraciones_sistema` (clave `drive_folder_id_quejas`, string jsonb editable desde `/configuracion → General`; migración 010) y el backend hace **creación perezosa** de la subcarpeta por folio (`QUEJA-2026-0045`: busca con `supportsAllDrives`; si no existe, la crea) — helper compartido `lib/server/drive.ts`. **La subida NO usa `drive.files.create` de googleapis**: su ensamblador multipart/gaxios resultó lentísimo (minutos para archivos pequeños, con Buffer o con stream); `subirArchivoASubcarpeta` arma el `multipart/related` a mano y lo envía con `fetch` nativo (undici) a `upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true` con `Content-Length` exacto y `AbortSignal.timeout(120s)`; el Bearer sale de `auth.getAccessToken()` **normalizado** (devuelve `string | {token}` — sin normalizar se manda `Bearer [object Object]` → 401). googleapis queda solo para JWT firmado, operaciones de carpeta y descarga. Metadatos en `queja_adjuntos`: `storage_path` guarda el **`drive_file_id`** (paths legacy contienen `/`, los IDs de Drive no — así los distingue el cliente). Endpoints: `POST /api/drive/upload` (interna: Bearer vía `getCurrentUser`, autoriza staff O responsable de la queja, folio resuelto desde la DB — nunca del cliente, máx 50 MB) y `GET /api/drive/download?id=<fileId>` (stream seguro `alt=media` con `Readable.toWeb`: valida Bearer, resuelve el adjunto por `storage_path`, verifica staff o responsable, streamea con `Content-Disposition`/`Content-Type` sin exponer el enlace real de Drive; 404 si Drive ya no tiene el archivo). Registro en DB siempre vía RPC `registrar_adjunto_queja` (staff o colaborador-responsable, escribe `logs`; sin INSERT directo por RLS) con `p_storage_path = drive_file_id`. Cliente `quejaWorkflowService`: `subirAdjuntoQueja` (fetch multipart al endpoint + RPC) y `descargarAdjuntoQueja` con lógica mixta (legacy: signed URL 60s → `window.open`; Drive: fetch Bearer → Blob → ObjectURL → click `<a download>` invisible). UI en `QuejaDetalleModal`: sección "Evidencias adjuntas" visible en TODOS los estados (incluye las públicas con `usuario_id NULL`), subir archivo SOLO en "En Investigación"; hook `useQuejaAdjuntos`.
29. **Panel Mis Quejas (`QuejaColaboradorPanel`):** tabs Detalle/Análisis/Resolución. Detalle muestra datos + bloque "Justificación de Gestión de Calidad" (`queja.notas`, contiene `[Procede] ...`). Análisis = actividad (`quejas_actividad`, notas tipo 'nota' vía `useQuejaActividad`). Resolución: textarea conclusión + botón "Enviar a Revisión GC" (`En Investigación → Pendiente de Revisión GC` con `p_resolucion`; colaborador-responsable puede). NO hay botón "Iniciar investigación" — la investigación arranca sola cuando admin/calidad asigna responsable (15 días).
30. **Análisis IA dual-view (Lectura/Edición):** el resultado del análisis IA se muestra en modo **Lectura** por defecto (ReactMarkdown con clases `prose prose-blue`) con botón toggle a modo **Edición** (textarea plano). El toggle usa `modoEdicion` state. El usuario puede editar el resultado antes de copiar/guardar. Se importa `ReactMarkdown` de `react-markdown` y se usan iconos `Eye`/`Edit` de lucide-react para el toggle.
31. **Cadena de fallback IA de 3 niveles:** (1) proveedor principal + modelo configurado (con `skipRetryOnSaturation` cuando hay fallback), (2) sub-fallback intra-proveedor: otros modelos del mismo provider (for...of secuencial sobre `provider.modelos`), (3) fallback externo: proveedor secundario (`fallback_provider_id` + `fallback_modelo`). Timeout de 15s por llamada. 404 se considera error recuperable. Logs: `[api/ai] Interceptado en route.ts`, `[api/ai] Comodín resuelto (cache/API/fallback)`, `[api/ai] Principal falló, intentando sub-modelo: ...`.
32. **Blindaje Gemini 3 niveles:** (1) `resolverGeminiFlashAuto` en aiFactory.ts (caché 24h, regex estricta `/^models\/gemini-[0-9]+\.[0-9]+-flash$/`, rechaza preview/experimental), (2) `crearGemini` usa variable aislada `finalModelName` (no muta `cleanModel`), (3) `ejecutarProveedorIA` en route.ts intercepta PRIMERO `'gemini-flash-auto'` antes de la factoría. Si el cache contiene `'gemini-flash-auto'` → lo reemplaza por `'gemini-1.5-flash'`.
33. **Memoria de modelos (modelMemory.ts):** `guardarUltimoExito` guarda modelo + latencia + tamaño del prompt. `obtenerUltimoExito` es inteligente por tamaño: si el éxito fue con prompt grande y latencia <45s, es válido para prompts grandes; si era corto y latencia >10s, se descarta. `registrarFallo` tiene penalización condicional: timeout en prompt grande (>10K) solo registro informativo sin penalizar. TTL progresivo: 1 fallo=30min, 2=1h, 3=4h.
34. **Testeo de modelos (modelTesting.ts):** `testearProveedor` ejecuta hasta 20 modelos con 2 prompts (corto + largo), guarda resultados en BD (`ai_test_resultado_<id>`). UI con modal personalizado, progreso en tiempo real, botones Iniciar/Cancelar/Cerrar. Al sincronizar, excluye modelos con `ok: false` en test previo.
35. **Descubrimiento de modelos (modelDiscovery.ts):** `obtenerModelosDisponibles` descubre modelos vía ListModels API. OpenRouter: filtrado estricto free-only (pricing.prompt=0 && pricing.completion=0, excluye `~`, `:paid`, `:premium`, batch, preview/beta/exp/dev, max 50). Caché en BD (`ai_modelos_cache_<id>`). Auto-limpieza de modelos pagados al cargar UI.
36. **Timeout dinámico (route.ts):** `getTimeoutParaPrompt(tamanoPrompt, esOpenRouter)`: <5K→10-15s, 5-20K→20-30s, ≥20K→30-45s. Límite global: 50s (prompt corto) o 55s (prompt ≥10K). Sub-fallback: 5 modelos (corto) o 3 (grande).
37. **Fallback a prueba de fallos:** Cualquier error (timeout, HTTP, red, parseo) → registro + invalidación caché + siguiente modelo. NO hay distinción por tipo de error. El cliente solo recibe error cuando TODAS las opciones se agotaron. Error final: `"Todos los modelos agotados (Xs). Último error: ..."`.

## 6. Reglas en el esquema pero NO implementadas (gaps / deuda técnica)

- **Quejas:** `fecha_sla` y `fecha_limite_investigacion` sí se persisten (RPCs 005/009); las alertas dependen de `pg_cron`/Edge Function (mail_queue se llena, sin worker de envío).
- **SACP:** `origen`/`origen_id`/`fecha_apertura` los escribe `derivar_queja_a_sacp`; `eficacia`, `validado_por_gc`, `responsable_id`, `prioridad`, `notas` — en la interfaz pero nunca escritos.
- **Auditorías:** no hay CRUD de hallazgos; "Derivado a SACP" solo es un badge si el campo viene poblado.
- **Documentos:** `documento_versiones`/`versiones_documentos` nunca se escriben; campos Drive `drive_file_id*` sin uso; historial es placeholder.
- **Permisos:** tabla dinámica 006 (rol+modulo leer/escribir) SI consultada por `auth-store` vía RPC `app_mis_permisos`, pero la UI sigue autorizando por `rol === 'admin'`.
- **Sin escritores:** `informes_config`, `tareas`, `solicitudes_documentales`. `logs` sí lo escriben los RPC de quejas (crear/transición/derivar/adjunto/reapertura); `mail_queue` lo escribe `procesar_alertas_quejas` y `crear_queja_publica` (sin worker de envío).
- **Capa muerta:** `lib/services/*Service.ts` (queja, auditoria, documento, proceso, reunion, riesgo, sacp, user, notificacion) no es importada por ninguna página (páginas usan hooks + supabase directo; el flujo de quejas usa `quejaWorkflowService`). `reabrir_queja` (RPC 007) existe pero la UI usa `transicionar_queja` con `p_motivo_reapertura`. `theme-store` sin consumidores; `theme-toggle.tsx` no existe.

## 7. Convenciones y gotchas

- **Estilos:** Tailwind v4 CSS-first (`@import "tailwindcss"` en `globals.css`); existe `tailwind.config.ts` pero el sistema real es v4 sin depender de él. Mucho estilo inline con paleta fija: primario `#0d6efd`, dark `#212529`/`#2c3e50`/`#343a40`, bordes `#dee2e6`, texto `#6c757d`. Clases `dark:` presentes en muchas páginas pero sin toggle conectado.
- **Tokens semánticos (`/mis-quejas` y `globals.css` @theme):** `--color-qms-primary #0d6efd`, `--color-qms-primary-dark #0b5ed7`, `--color-qms-dark #212529`, `--color-qms-muted #6c757d`, `--color-qms-border #dee2e6`, `--color-qms-header #343a40`, `--color-qms-surface #ffffff`, `--color-qms-scroll #cbd5e1`, `--color-qms-scroll-hover #94a3b8`. Solo `/mis-quejas` los usa; el resto del sistema sigue con hex inline.
- **Scrollbars Monday (`globals.css`):** `.monday-scroll` (thumb 12px ancho / 28px alto horizontal, radius 4px, `background-clip: content-box`, `:horizontal` top/bottom 6px y left/right 20px, hover `var(--color-qms-scroll-hover)`; Firefox `scrollbar-width: auto` + `scrollbar-color`); `.monday-scroll-no-x` oculta solo el scrollbar horizontal. Scrollbar global 15px.
- **Split-pane `/mis-quejas`:** `AuthShell` main tiene `p-4` (16px) → el panel ocupa `mr-[calc(500px-16px)]` cuando está abierto; la tabla usa `min-w-[calc(100%+484px)]` abierto / `min-w-[1200px]` cerrado para que NUNCA se encoja. Panel `fixed top-0 right-0 z-50 h-screen w-[500px]` ↔ `w-full` (isExpanded), `shadow-2xl`.
- **Select / copia:** `layout.tsx` tiene `<body className="select-none">` + excepciones `select-text` en tablas/paneles.
- **Purity lint (`react-hooks/set-state-in-effect`):** PROHIBIDO `setState` sincrónico en `useEffect`; patrones permitidos: ajuste en render con primitivos (`prevQuejaId` en QuejaColaboradorPanel/QuejaDetalleModal) o escrituras DOM directas a refs (`.scrollLeft` vía `syncPill`).
- **Tipos:** `lib/types.ts` solo tiene `Queja`; cada hook declara sus tipos localmente.
- **Búsqueda con retraso:** `useDeferredValue` en quejas/usuarios.
- **RPC:** `.rpc()` en la app: `folioService.generarFolio`, `crear_queja_publica` (formulario público `/q/[token]`), `actualizar_mis_preferencias_notificacion` (preferencias del usuario autenticado), y el flujo de quejas vía `quejaWorkflowService` (`crear_queja_interna`, `actualizar_detalles_queja`, `transicionar_queja` con 6 params siempre, `derivar_queja_a_sacp`, `agregar_comentario_queja`, `registrar_adjunto_queja` tras subir a Drive) y `registrar_adjunto_queja_publica` (migración 011, `RETURNS uuid`: registra las evidencias del formulario público como `anon` con `usuario_id NULL`, exige estado `Recibido`, tope 10). Ambos RPCs de adjuntos (011 v4) hacen **dual-write** a las columnas legacy reales de la tabla (`nombre_archivo`, `url_archivo`) además de las estándar — la tabla `queja_adjuntos` en producción NO coincide con el CREATE del 007 del repo. `reabrir_queja` (007) sin uso en la UI.
- **Gotcha PostgREST:** si en la DB existen DOS overloads de un RPC y el nuevo tiene defaults, enviar menos parámetros tira "Could not choose the best candidate function" — el cliente envía SIEMPRE los 6 params de `transicionar_queja` (null si no aplica) y el overload viejo se elimina con la migración 008.
- **Gotchas Google Drive (adjuntos):** `auth.getAccessToken()` devuelve `string | {token}` — normalizar SIEMPRE antes de armar headers crudos (sin normalizar sale `Bearer [object Object]` → 401 "Expected OAuth 2 access token"). NO subir archivos con `drive.files.create` (multipart de gaxios lento/cuelga): usar `subirArchivoASubcarpeta` (REST con fetch nativo). La carpeta raíz debe compartirse con la Service Account como Editor. La tabla real `queja_adjuntos` tiene columnas legacy (`nombre_archivo`, `url_archivo`) NOT NULL: los RPC hacen dual-write; el script 011 v4 incluye detector WARNING para columnas NOT NULL sin default no mapeadas.
- **Purity lint (`react-hooks/purity`):** `Date.now()` no se puede llamar en render; en `app/quejas/page.tsx` se resuelve con `useState(() => Date.now())` + `setInterval` 60s.
- **Errores:** `errorToast.ts` (showError/showSuccess) envuelve sonner + console.error.
- **Env vars (.env.local):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (esta última es del proyecto real, ref `fykhrrpeo...`), `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` (Service Account de Google Drive, key con `\n` literales entre comillas; compartir la carpeta raíz con el email de la SA como Editor).

## 8. Subsistema de IA Multi-Proveedor (ilimitado)

Gestor de IA dinámico, sin modelos fijos. Configuración en `configuraciones_sistema` (jsonb, RLS staff SELECT / admin write):

- **`ai_providers`** (`lib/ai/types.ts` `AIProvider[]`): `{ id, nombre, tipo: 'gemini'|'anthropic'|'openai', base_url?, api_key, tokens_usados: number, limite_tokens: number, modelos: string[], tokens_updated_at?: string }`. `base_url` solo aplica a tipo `openai` y permite endpoints compatibles (OpenAI, DeepSeek, Grok xAI, OpenRouter…). `tokens_usados` es un **odómetro mensual** que se **reinicia automáticamente al mes** (ver más abajo). `limite_tokens` define el techo para la barra de consumo visual (presets: gemini 30M, openai/Groq 6M, anthropic 250K). `modelos` es array de strings con los modelos soportados por ese proveedor. `tokens_updated_at` guarda timestamp del último reset/conteo para el auto-reset mensual.
- **`ai_routing`** (`AIRouting` = `Record<modulo, { proveedor_id, modelo_nombre, system_prompt?, fallback_provider_id?, fallback_modelo? }>`): mapea cada módulo QMS → proveedor + **nombre de modelo exacto** + (opcional) **system prompt de especialización** + **enrutamiento en cascada (fallback)** con proveedor y modelo secundarios. Módulos válidos: `quejas, sacp, documentos, auditorias, riesgos, revision, general`.
- **`ai_cache_ttl_minutes`** (number, default 1440 = 1 día): TTL para caché de modelos descubiertos. UI con selector de unidades (minutos/horas/días).
- **`ai_modelos_cache_<providerId>`** (`{ modelos: string[], timestamp }`): caché de modelos descubiertos por proveedor.
- **`ai_ultimo_exito_<providerId>`** (`{ modelo, timestamp, latenciaMs, tamanoPrompt }`): último modelo exitoso por proveedor, con latencia y tamaño del prompt.
- **`ai_fallos_<providerId>`** (`{ modelo, fallos, ultimo_fallo }[]`): contador de fallos por modelo con TTL progresivo.
- **`ai_test_resultado_<providerId>`** (`{ timestamp, resultados: [{ modelo, ok, latenciaMs, error }] }`): resultados de tests de modelos.

### Modelos y descubrimiento (`lib/ai/modelDiscovery.ts`)

- **`obtenerModelosDisponibles(provider)`** → `{ modelos, total, descartados }`: descubre modelos vía ListModels API. Para OpenRouter: **filtrado estricto free-only** (pricing.prompt=0 && pricing.completion=0, excluye `~` prefix, `:paid`, `:premium`, batch, preview/beta/exp/dev, max 50 modelos). Para Gemini: REST `v1beta/models`. Para OpenAI: `/models`. Para Anthropic: no listModels (modelos fijos en DB).
- **`esOpenRouter(provider)`**: detecta OpenRouter por `base_url` o `nombre`.
- **`esModeloAuto(modelo)`**: detecta strings `*-auto` o `auto`.
- **`obtenerModelosCache/guardarModelosCache/invalidarModelosCache`**: gestiona `ai_modelos_cache_<id>` en BD (no in-memory).

### Memoria de modelos (`lib/ai/modelMemory.ts`)

- **`guardarUltimoExito(admin, providerId, modelo, latenciaMs?, tamanoPrompt?)`**: guarda en `ai_ultimo_exito_<id>`. Limpia fallos del modelo.
- **`obtenerUltimoExito(admin, providerId, tamanoPromptActual?)`**: lee último éxito. **Inteligente por tamaño**: si el éxito fue con prompt grande (>10K) y latencia <45s, es válido para prompts grandes; si era corto y latencia >10s, se descarta para prompts cortos. TTL 24h.
- **`registrarFallo(admin, providerId, modelo, contexto?)`**: incrementa contador. **Penalización condicional**: si `contexto.esTimeout && contexto.tamanoPrompt >= 10000`, solo registro informativo sin penalizar (timeout en prompt grande no es culpa del modelo). TTL progresivo: 1 fallo=30min, 2=1h, 3=4h.
- **`obtenerModelosNoPenalizados(admin, providerId, modelos)`**: filtra modelos penalizados por tiempo.
- **`limpiarMemoriaModelos(admin, providerId, modelosActuales)`**: elimina registros de modelos que ya no existen.

### Testeo de modelos (`lib/ai/modelTesting.ts`)

- **`testearModelo(provider, modelo, promptPrueba)`**: ejecuta 1 prompt, retorna `{ ok, latenciaMs, error }`.
- **`testearProveedor(admin, provider, opciones?)`**: testea hasta 20 modelos con 2 prompts (corto + largo). Accepta `onProgress(modelo, resultado)` para UI en tiempo real y `signal` para cancelación. Guarda en `ai_test_resultado_<id>`.
- **`obtenerResultadoTest/admin, providerId)`**: lee resultados del test.
- **`limpiarResultadoTest(admin, providerId, modelosActuales)`**: limpia modelos obsoletos.
- **`modelosExcluidosPorTest(admin, providerId, modelos)`**: filtra modelos con `ok: false` del test previo.

### Factory (`lib/ai/aiFactory.ts`)

`crearClienteIA(provider, modelo)` devuelve `AIClient.analizar({ prompt, system?, maxTokens?, temperature?, archivos? })`. OpenAI y Anthropic usan `fetch` nativo (sin SDK): OpenAI `/chat/completions` (Bearer, imágenes vía `image_url` data URI; PDFs no visionables se notifican como texto), Anthropic `/v1/messages` (x-api-key + anthropic-version, imágenes vía `image` base64). **Gemini usa el SDK oficial `@google/generative-ai`** (`new GoogleGenerativeAI(api_key)`, `getGenerativeModel({ model: finalModelName, systemInstruction })` + `generateContent` con parts `inlineData` base64 para cualquier MIME incl. PDF); el SDK no expone `listModels`, así que el diagnóstico de modelos habilitados se hace vía `fetch` al REST `v1beta/models?key=`. `archivos: ArchivoIA[] = { nombre, mime, buffer }`. Timeout 120s. Cada `analizar` devuelve `{ texto, uso? }` normalizando `usage` nativo (OpenAI `usage`, Anthropic `usage.input/output_tokens`, Gemini `usageMetadata`) a `{ prompt_tokens, completion_tokens, total_tokens }`.

### Blindaje Gemini (3 niveles de protección)

1. **`resolverGeminiFlashAuto`** (exportada, caché 24h): resuelve `gemini-flash-auto` → modelo flash estable real. Filtro estricto con regex `/^models\/gemini-[0-9]+\.[0-9]+-flash$/` (rechaza preview, experimental, omni, lite). Cache resetea en fallback. Si el cache contiene `'gemini-flash-auto'` lo reemplaza por `'gemini-1.5-flash'`.
2. **`crearGemini`**: usa variable aislada `finalModelName` (no muta `cleanModel`). Si es `'gemini-flash-auto'` → llama a `resolverGeminiFlashAuto`. Nunca pasa el string literal al SDK.
3. **`ejecutarProveedorIA` en route.ts**: intercepta PRIMERO `'gemini-flash-auto'` antes de que llegue a la factoría. Reasigna `modelo` y loguea `[api/ai] Interceptado en route.ts`.

### Endpoint (`app/api/ai/analizar/route.ts`)

`runtime nodejs`, `maxDuration = 60`. Recibe `{ modulo, entidad_id, tipo_consulta: 'auto'|'custom', prompt_usuario? }`. Autentica con `getCurrentUser`; autoriza staff OR (si módulo `quejas`) el `responsable_id` de la queja. `resolverEntidad` busca la queja por `id` O `folio` (el panel envía el UUID). Lee `ai_providers`+`ai_routing`, resuelve proveedor/modelo/system_prompt.

**Timeout dinámico por tamaño del prompt** (`getTimeoutParaPrompt`):
| Tamaño prompt | OpenRouter | Otros |
|---|---|---|
| <5,000 chars | 10s | 15s |
| 5,000–20,000 | 20s | 30s |
| ≥20,000 | 30s | 45s |

**Límite global dinámico** (`TIMEOUT_GLOBAL_*_MS`):
- Prompt <10K → 50s
- Prompt ≥10K → 55s (máximo seguro bajo maxDuration=60s)

**Sub-fallback dinámico** (`MAX_SUBFALLBACK_*`):
- Prompt <10K → max 5 sub-modelos
- Prompt ≥10K → max 3 sub-modelos (reduce intentos para no agotar tiempo global)

**Cadena de fallback a prueba de fallos** (3 niveles):

1. **Proveedor principal + modelo configurado** (usa último éxito si es rápido; timeout dinámico).
2. **Sub-fallback intra-proveedor**: si el principal falla, itera sobre `obtenerModelosNoPenalizados` (max 5 o 3 según prompt). **Cualquier error** → registro + invalidación caché + siguiente modelo. Verifica tiempo global antes de cada intento.
3. **Fallback externo**: proveedor secundario (`fallback_provider_id` + `fallback_modelo`). Verifica tiempo global antes de intentar.
4. Si todo falla → `502` con `"Todos los modelos agotados (Xs). Último error: ..."`.

**Fault-proof**: NO hay distinción por tipo de error (4xx/5xx/timeout/red/parseo). Cualquier excepción → registro + fallback. El cliente solo recibe error cuando **todas las opciones se agotaron**.

**Auto-reset mensual**: al iniciar request, compara mes actual vs `tokens_updated_at`; si cambió mes → `tokens_usados = 0`, actualiza `tokens_updated_at`, persiste en BD. **Sin CRON job** — se ejecuta en cada request.

**Zero-Disk / Prompt Injection**: descarga `.contexto_qms.txt` de Drive como **texto plano** → inyecta directo en prompt (`promptFinal`). **Eliminada** subida a Gemini Files API (`GoogleAIFileManager`), archivos temporales y `/tmp`. Unificada ruta para todos los proveedores.

**Presets de límites** (auto-selección en UI): gemini 30M, openai/Groq 6M, anthropic 250K.

Si `uso.total_tokens > 0`, **incrementa `tokens_usados`** y actualiza `tokens_updated_at` en `ai_providers` (read-modify-write jsonb con service client). Devuelve `{ analisis, tokens_consumidos }`. **Las API keys NUNCA salen del servidor**.

### UI (`components/configuracion/AIProvidersManager.tsx`, tab **IA**, solo admin)

- **Modal estándar `size="lg"`** centrado + scroll interno (`max-h-[90vh]`).
- **Campos**: Nombre, Tipo API (selector), URL Base (solo OpenAI), **Modelos Soportados** (comma-separated → `string[]`), **Límite de Tokens** (se **auto-rellena** al cambiar Tipo API: gemini 30M, openai 6M, anthropic 250K), API Key.
- **Barra de consumo visual** en tabla: progress bar `w-36 h-2` con colores Tailwind (verde <70%, ámbar 70-90%, rojo >90%) + texto `{usados} / {límite} ({pct}%)`. Botón **Probar Conexión** por fila y en modal (fetch a `/models` o `/v1beta/models?key=` con API Key, toast éxito/error).
- **Auto-guardado en BD** al crear/actualizar/eliminar.
- **Selectores de modelo**: dropdown 100% impulsado por `provider.modelos` (sin "Otro/Escribir manual"). Si proveedor tiene 1 solo modelo → **auto-selección**.
- **Enrutamiento en cascada (fallback)** en tabla "Enrutamiento por módulo": botón "Respaldo" expande fila → selectores Proveedor Secundario + Modelo Secundario (cargado dinámicamente del proveedor elegido). Guarda en `routing[modulo].fallback_provider_id` y `fallback_modelo`.
- **Auto-selección modelo**: al cambiar Proveedor (principal o fallback), si tiene 1 solo modelo → setea `modelo_nombre` automáticamente.
- **Sincronización inteligente**: al sincronizar, excluye modelos con `ok: false` en test previo. Limpia memoria de fallos y resultados de modelos obsoletos.
- **Test de modelos**: botón ▶ abre modal personalizado con lista de modelos, progreso en tiempo real (Loader2/CheckCircle/XCircle), botones Iniciar/Cancelar/Cerrar. `testearProveedor` ejecuta secuencialmente con `onProgress`. Modelos fallidos se excluyen de la lista.
- **Auto-limpieza OpenRouter**: al cargar, detecta modelos `~`/`:paid` → re-silencia silenciosamente.
- **TTL de caché**: configuración con selector de unidades (minutos/horas/días), persiste en `ai_cache_ttl_minutes`.

### Frontend IA (`app/mis-quejas/components/QuejaColaboradorPanel.tsx`, tab **Análisis**)

- Botón **✨ Análisis IA** (auto) + chat (prompt custom) → `modulo:'quejas'`.
- **Borrador editable**: `<textarea>` con clases `w-full min-h-[500px] p-6 border border-gray-300 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-blue-600 outline-none resize-y shadow-sm font-sans leading-relaxed whitespace-pre-wrap` enlazado a `aiResult`/`setAiResult` (texto plano, **sin `react-markdown`**).

### Seguridad

Las API keys se guardan en texto plano en `configuraciones_sistema` (accesible por admin vía cliente anon RLS). El endpoint las usa solo server-side. Si se requiere secreto fuerte, mover a variables de entorno/Vault y referenciar por id.
