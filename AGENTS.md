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
  api/usuarios/route.ts      ÚNICA ruta API (CRUD usuarios, service-role)
  quejas/  page.tsx + NuevaQuejaModal, QuejaDetalleModal (máquina de estados, comentarios, responsable, notas, derivar SACP)
  configuracion/ page.tsx     catálogos + SLA + config + Formularios (solo admin)
  procesos/  page.tsx + NuevoProcesoModal
  auditorias/page.tsx + NuevaAuditoriaModal  (modal de hallazgos inline)
  riesgos/   page.tsx + NuevoRiesgoModal     (matriz 3x3 inline)
  revision/  page.tsx + NuevaReunionModal    (reuniones / Revisión Dirección)
  documentos/page.tsx + NuevoDocumentoModal  (tabs: Todos/Maestra/Edición)
  reporteria/page.tsx + GeneradorInformeModal (informes imprimibles)
  sacp/      page.tsx + NuevaSACPModal       (acciones, avance % inline)
  usuarios/  page.tsx + modales (solo admin, usa /api/usuarios)
  q/[token]/ page.tsx    formulario público de quejas (sin auth)
components/
  AuthShell.tsx              guard de auth global (redirige a /login; salta guard para /login y /q)
  Sidebar.tsx                sidebar colapsable + hover-prefetch (admin-only sección) — SIN bloque de usuario al pie
  Header.tsx                 título por ruta + campana (notificaciones reales, dropdown, archivar, vaciar, beep) + menú de usuario (avatar → cambiar contraseña, preferencias notif con Switch, logout)
  Modal.tsx                  modal reutilizable (sm/md/lg, Esc/overlay)
  StatCard.tsx               tarjeta KPI (soporta dark)
  ui/  Badge, Button, Select, Table, EmptyState, PageHeader, Skeleton, StatusDot, FieldGroup, Switch
  usuarios/  UsuarioFormModal, PasswordModal, ResetPasswordModal, CambiarMiPasswordModal (autoservicio), ConfirmDialog
lib/
  supabase.ts                cliente anon singleton
  auth.ts                    signIn/signOut/getAppUser (Supabase Auth)
  types.ts                   solo tipo Queja (resto definidos por query)
  providers/  QueryProvider (React Query), ToastProvider (sonner)
  queries/    queryKeys + useQuejas (incl. useSLAConfig, useQuejasEstadisticas), useCatalogos, useDashboard,
              useAuditorias, useDocumentos, useProcesos, useReuniones, useRiesgos, useSACP, useUsuarios,
              useFormulariosPublicos, useQuejaComentarios, useNotificaciones
  server/     auth.ts (getCurrentUser Bearer), supabase-admin.ts (service client)
  services/   folioService, notificacionService, errorToast, passwordGenerator
              + capa legacy SIN uso: queja/auditoria/documento/proceso/reunion/riesgo/sacp/user Service
  store/      auth-store (Zustand), sidebar-store, theme-store (HUÉRFANO, sin toggle)
hooks/
  useHoverPrefetch.ts        prefetch por hover en Sidebar (80ms debounce)
  useRealtimeSubscription.ts DEFINIDO pero SIN consumidores
supabase/  *.sql (seeds/RPC/dumps) · 001_quejas_formulario_publico_y_alertas.sql (PENDIENTE de aplicar) · 002_notificaciones_y_preferencias_usuario.sql (PENDIENTE de aplicar) · 003_seleccion_sonido_notificacion.sql (PENDIENTE de aplicar) · 004_realtime_y_notificacion_queja_publica.sql (PENDIENTE de aplicar) · rls-policies.sql en raíz
```

## 2. Frontend — Detalle por página

| Ruta | Datos | Componentes clave |
|------|-------|-------------------|
| `/` | 4 KPIs (quejas ≠Cerrada, acciones ≠Cerrada, docs Borrador, riesgos Activos) + tareas pendientes (top 8 por vencimiento). "Actividad Reciente" es **100% hardcodeada** | Table, Badge, StatCard |
| `/quejas` | búsqueda folio/cliente, filtros estado/prioridad, paginación 25, SLA visual por prioridad vs `sla_config` | NuevaQuejaModal, QuejaDetalleModal |
| `/configuracion` | 3 tabs: Catálogos (cascada módulo→tipo, CRUD), SLA y Plazos (`sla_config`), General (`configuraciones_sistema` update por clave). Guard `rol==='admin'` | — |
| `/procesos` | tabla estática `procesos` | NuevoProcesoModal |
| `/auditorias` | `auditorias` + modal hallazgos (`hallazgos` eq auditoria_id, SOLO lectura) | NuevaAuditoriaModal |
| `/riesgos` | tabla + matriz 3x3 (nivel = prob×impacto: ≤2 Bajo, ≤4 Medio, ≤6 Alto, >6 Crítico) | NuevoRiesgoModal |
| `/revision` | reuniones (`reuniones`) + modal detalle | NuevaReunionModal |
| `/documentos` | tabs Todos/Lista Maestra(Publicado)/Edición Viva(Borrador); editar `version_actual` directo | NuevoDocumentoModal |
| `/reporteria` | wizard 3 pasos: módulo → filtros → informe con tabla/resumen por estado/distribución/vencidos + `window.print` | GeneradorInformeModal |
| `/sacp` | acciones con barra %, avance (100% → "En Validación"), cierre solo desde "En Validación" (→ "Cerrada" 100%) | NuevaSACPModal, modales inline |
| `/usuarios` | stats + filtros + CRUD vía `/api/usuarios`. Guard `rol==='admin'` | UsuarioFormModal, PasswordModal, ResetPasswordModal, ConfirmDialog |

## 3. Backend — API routes

**Única:** `app/api/usuarios/route.ts` (runtime nodejs, usa service-role para operar Supabase Auth `admin`).

- **GET** — admin o calidad. Lista `usuarios` con filtros `search`/`rol`/`estado`.
- **POST** — solo admin. Crea auth user (`admin.createUser`, email_confirm) + fila `usuarios` con `auth_id`. Rollback: si falla insert, borra el auth user. Genera contraseña temporal (≥8 o random).
- **PATCH** — solo admin. Autoprotección: no puedes auto-desactivarte, auto-cambiarte el rol ni auto-borrate. Actualiza Auth + tabla.
- **DELETE** — solo admin. Borra auth user + fila.

Server helpers en `lib/server/`: `getCurrentUser(request)` valida Bearer token y resuelve perfil `usuarios` por `auth_id` → `{auth_id, rol, email}`; `createServiceClient()` con service-role.

## 4. Base de datos (schema `public`)

Todas las tablas usan `id uuid` PK salvo indicado. Verificado con dump del dashboard real.

| Tabla | Columnas |
|-------|---------|
| `usuarios` | id, nombre, email, rol, estado, departamento, telefono, avatar_url, ultimo_acceso, created_at, auth_id (FK→auth.users.id) |
| `quejas` | id, folio, cliente_nombre, email_cliente, telefono, categoria, descripcion, prioridad, estado, fecha_sla, fecha, notas, resolucion, responsable_id (FK→usuarios), derivado_sacp_id, fecha_cierre |
| `quejas_comentarios` | id, queja_id (FK→quejas), usuario_id (FK→usuarios), comentario, tipo, visible_cliente, fecha |
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
| `notificaciones` | id, usuario_id (FK→usuarios), fecha, tipo, mensaje, leida, enlace, origen_id |
| `logs` | id, fecha, usuario_id (FK→usuarios), accion, modulo, detalle |
| `mail_queue` | id, destinatario, asunto, cuerpo, estado, intentos, error, fecha_envio, created_at |
| `informes_config` | id, nombre, modulo, filtros (jsonb), columnas (jsonb), creado_por (FK→usuarios), created_at |
| `catalogos` | id, tipo, valor, color, orden, activo, modulo — **sin RLS** |
| `sla_config` | id, proceso, prioridad, dias_alerta (int), dias_vencimiento (int) — **sin RLS** |
| `configuraciones_sistema` | clave (PK), valor (jsonb), descripcion, categoria — **sin RLS** |
| `permisos` | rol + modulo + accion (PK compuesta), permitido — **sin RLS** |

**Reglas de la DB:**
- `catalogos.modulo` = feature area (`'quejas'`, `'sacp'`, `'documentos'`, `'auditorias'`, `'riesgos'`, `'general'`); `tipo` agrupa valores (`'categoria_queja'`, `'estado_queja'`, `'prioridad'`, `'estado_sacp'`, `'tipo_sacp'`, `'estado_documento'`, `'estado_auditoria'`, `'tipo_auditoria'`...); `valor` = display; `activo` puede ser NULL/true — **siempre** filtrar con `.or('activo.is.null,activo.eq.true')`.
- RLS activo en TODAS las tablas de negocio (quejas, acciones, auditorias, documentos, procesos, riesgos, reuniones, etc.). Sin RLS: `catalogos`, `sla_config`, `configuraciones_sistema`, `permisos`, `informes_config`.
- Folios: funciones RPC `generar_folio_queja/sacp/auditoria/riesgo/documento` (SECURITY DEFINER, sin args) → formato `PREFIJO-AAAA-NNNN` (QUEJA-, SACP-, AUD-, RIESGO-, DOC-) con secuencias `seq_folio_*` (START 1 CACHE 20). Reset anual manual (ALTER SEQUENCE). Triggers de auto-folio están **comentados** — el frontend llama al RPC explícitamente.
- `lib/queries/useQuejas.ts` usa `select('*', {count:'exact'})`, `or(folio.ilike/cliente_nombre.ilike)`, `eq` estado/prioridad, `order('fecha', desc)`, `.range(page*25, ...)`.

## 5. Reglas de negocio IMPLEMENTADAS

1. **Auth:** Supabase Auth + perfil `usuarios` por `auth_id`. `signIn` bloquea si `estado !== 'activo'` ("Tu cuenta está inactiva"). `auth-store.init` hace signOut si perfil inactivo; suscribe `onAuthStateChange`.
2. **Roles:** solo `admin` y `calidad` en la UI. Guard admin en `/configuracion` y `/usuarios` (`user?.rol !== 'admin'` → redirect `/`). Sidebar oculta sección Administración para no-admin. API usuarios: GET admin/calidad, POST/PATCH/DELETE solo admin.
3. **Usuarios:** autoprotección (no auto-desactivarse/eliminarse/cambiarse rol), contraseña temporal generada y mostrada una vez, reset de contraseña.
4. **Folios:** generados vía RPC antes del insert en quejas, SACP, auditorías y riesgos. **NOTA:** `generar_folio_documento` existe pero NO se usa — documentos se crean con `version_actual:'1.0'`, `estado:'Borrador'`, sin folio.
5. **SLA quejas (solo visual):** por prioridad desde `sla_config` (`proceso='quejas'`); días≤alerta verde, ≤vencimiento ámbar, >vencimiento rojo; fallback 3/7 días. **No persiste `fecha_sla`.**
6. **SACP:** estados `Abierta`/`En Proceso`/`En Validación`/`Cerrada`; avance 100% → "En Validación"; cierre solo desde "En Validación" (→ "Cerrada" + 100%).
7. **Riesgos:** nivel = probabilidad × impacto (1-3 × 1-3): ≤2 Bajo, ≤4 Medio, ≤6 Alto, >6 Crítico; matriz 3x3.
8. **Documentos:** estados Borrador/Publicado/Archivado/En Revisión; tabs por estado; editar solo `version_actual`.
9. **Catálogos:** CRUD con cascada módulo→tipo, filtro activo NULL, edición inline. SLA y config general editables.
10. **Reportería:** informes por módulo con resumen por estado, distribución, vencidos, e impresión CSS (`@media print` oculta aside/header, `.informe-content`).
11. **Dashboard:** 4 KPIs + tareas pendientes de quejas (≠Cerrada, vence=fecha_sla) y acciones (≠Cerrada, vence=fecha_limite).
12. **Catálogo vacío:** modales de quejas muestran `<input>` de texto libre si el catálogo viene vacío (fallback).
13. **React Query:** `staleTime: Infinity`, `gcTime: 30min`, `retry: 1`, sin refetch on focus; invalidación manual tras mutaciones.
14. **Formulario público de quejas:** ruta `/q/[token]` pública (sin auth) — `AuthShell` salta el guard para `['/login', '/q']`. El formulario valida el token contra `formularios_publicos` (`activo=true`) y crea la queja vía RPC `crear_queja_publica(...)` (SECURITY DEFINER, estado `Recibido`). No abre INSERT directo a `anon`.
15. **Gestión de enlaces:** tab "Formularios" en `/configuracion` (solo admin): crea enlaces con token, copia URL, activar/desactivar, eliminar. Hook `lib/queries/useFormulariosPublicos.ts`.
16. **Máquina de estados queja:** `Recibido → (No Procede | En Investigación) → Resuelto → Finalizado`. Botones contextuales en `QuejaDetalleModal`. "Procede" setea `fecha_limite_investigacion = now()+15d`. "No Procede"/"Finalizar" setean `fecha_cierre`.
17. **Comentarios de quejas:** `quejas_comentarios` (tipo `interno`/`cliente`, `visible_cliente`) listado y alta en `QuejaDetalleModal`. Hook `lib/queries/useQuejaComentarios.ts`.
18. **Responsable y notas:** selects de responsable (admin/calidad activos vía `/api/usuarios`) y textarea `notas` editables en `QuejaDetalleModal` en cualquier estado.
19. **Derivar a SACP:** botón en estados `En Investigación`/`Resuelto`; crea `acciones` con `origen='queja'`, `origen_id`, folio por RPC y guarda `quejas.derivado_sacp_id`.
20. **Notificaciones reales:** `crearNotificacion()` en `notificacionService`; se invoca en cada transición de estado y al agregar comentario. Campana del `Header` conectada a `useNotificaciones` (no leídas, dropdown, marcar leída/todas, refetch 60s).
21. **Alertas de vencimiento:** función `procesar_alertas_quejas()` (3 y 1 día antes de `fecha_limite_investigacion`) + cron diario 06:00 (solo si `pg_cron` está disponible; si no, queda pendiente Edge Function). Insertar filas en `mail_queue` sin worker (envío de email NO implementado).
22. **Indicadores en `/quejas`:** 4 StatCards (resueltas a tiempo %, procedencia %, quejas del mes, total) vía `useQuejasEstadisticas`.
23. **Menú de usuario (Header):** avatar+nombre+rol ahora es un dropdown (click afuera/Escape cierra) con "Cambiar contraseña" (autoservicio vía `supabase.auth.updateUser`, `CambiarMiPasswordModal`), preferencias de notificación (Switch `components/ui/Switch.tsx`, RPC `actualizar_mis_preferencias_notificacion`) y logout. El bloque de usuario al pie del Sidebar fue ELIMINADO.
24. **Centro de notificaciones:** archivar individual (botón "x" al hover) y "Vaciar" (todas visibles) setean `notificaciones.archivada=true` (query filtra `.eq('archivada', false)`); si `notif_habilitadas=false` no se pide el badge/query (`enabled`); beep Web Audio cuando sube el conteo de no-leídas solo si `notif_sonido=true`.
25. **Sonido de notificación (8 MP3 reales autohospedados):** `usuarios.notif_sonido_id` (CHECK en 8 ids `notification/{info,success,popup,error}` + `game/{coin,void,hit,miss}`, lista y `playNotificationSound()` en `lib/services/sonidosNotificacion.ts`); selector con preview (▶) dentro de las preferencias del menú de usuario, visible solo si el toggle de sonido está on; RPC `actualizar_mis_preferencias_notificacion` recibe `p_sonido_id`. Los mp3 son los originales de react-sounds (`public/sounds/*.mp3`, 4 notificación + 4 juego) descargados del CDN y autocontenidos — se reproducen decodificados vía `decodeAudioData` + `AudioContext` (sin CDN en runtime, funciona tras firewall). Migración 003 tiene el CHECK de 8 ids (con DROP previo del RPC por 42P13).
26. **Realtime** (`useRealtimeSubscription` en `hooks/`): `/quejas` suscribe a `quejas` (invalida quejas+estadísticas+dashboard); `Header` suscribe a `notificaciones` por `usuario_id` (badge + beep inmediato). Migración 004 habilita realtime para quejas y notificaciones y además `crear_queja_publica` ahora notifica a todos los admin/calidad activos (`tipo='queja_nueva'`) + inserta `mail_queue`.

## 6. Reglas en el esquema pero NO implementadas (gaps / deuda técnica)

- **Quejas:** `fecha_sla` no se persiste (SLA sigue siendo solo visual); `fecha_limite_investigacion` se setea al "Procede" pero no hay alertas hasta que exista `pg_cron`/Edge Function (mail_queue se llena, sin worker de envío).
- **SACP:** `eficacia`, `validado_por_gc`, `origen`/`origen_id`, `responsable_id`, `prioridad`, `fecha_apertura`, `notas` — en la interfaz pero nunca escritos.
- **Auditorías:** no hay CRUD de hallazgos; "Derivado a SACP" solo es un badge si el campo viene poblado.
- **Documentos:** `documento_versiones`/`versiones_documentos` nunca se escriben; campos Drive `drive_file_id*` sin uso; historial es placeholder.
- **Permisos:** tabla sembrada (admin/coordinador/revisor/usuario) pero NUNCA consultada — toda la autorización es `rol === 'admin'`.
- **Sin escritores:** `informes_config`, `logs`, `tareas`, `solicitudes_documentales` (mail_queue sí lo escribe `procesar_alertas_quejas`).
- **Capa muerta:** `lib/services/*Service.ts` (queja, auditoria, documento, proceso, reunion, riesgo, sacp, user, notificacion) no es importada por ninguna página (páginas usan hooks + supabase directo). `useRealtimeSubscription` y `theme-store` sin consumidores; `theme-toggle.tsx` no existe.

## 7. Convenciones y gotchas

- **Estilos:** Tailwind v4 CSS-first (`@import "tailwindcss"` en `globals.css`), sin tailwind.config.js. Mucho estilo inline con paleta fija: primario `#0d6efd`, dark `#212529`/`#2c3e50`/`#343a40`, bordes `#dee2e6`, texto `#6c757d`. Clases `dark:` presentes en muchas páginas pero sin toggle conectado.
- **Tipos:** `lib/types.ts` solo tiene `Queja`; cada hook declara sus tipos localmente.
- **Búsqueda con retraso:** `useDeferredValue` en quejas/usuarios.
- **RPC:** `.rpc()` en la app: `folioService.generarFolio`, `crear_queja_publica` (formulario público `/q/[token]`), `crear_accion_sacp` (derivar queja a SACP) y `actualizar_mis_preferencias_notificacion` (preferencias del usuario autenticado).
- **Errores:** `errorToast.ts` (showError/showSuccess) envuelve sonner + console.error.
- **Env vars (.env.local):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (esta última es del proyecto real, ref `fykhrrpeo...`).
