<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ECA-QMS — guía de entrada

Revisión: **8 de octubre de 2026**. Esta entrada contiene reglas siempre aplicables.
El detalle se consulta por tema en [el mapa de arquitectura](docs/arquitectura/README.md).
No cargar todos los documentos para una modificación aislada.

## Antes de editar

- Respetar el working tree y consultar el AGENTS.md del subdirectorio aplicable.
- Leer la guía local de Next instalada antes de escribir código Next. Usar proxy.ts; no añadir middleware.ts junto a él.
- Apariencia: leer [docs/visual-patterns.md](docs/visual-patterns.md). El kit activo es Tailwind v4 sin prefijo, sin CoreUI/Bootstrap.
- Supabase: leer .agents/skills/supabase/SKILL.md. Para SQL/esquema/RLS/índices, leer también supabase-postgres-best-practices y las referencias pertinentes.
- Antes de cambiar DB, consultar esquema, policies y grants efectivos. SQL histórico y documentación son referencias; RLS habilitada no demuestra autorización correcta.
- No copiar .env, claves, tokens, contraseñas ni datos privados a logs, documentación, prompts o fixtures. Documentar nombres, nunca valores secretos.
- Usar imports @/ y las capas existentes; sin segunda arquitectura de datos, Server Actions ni nuevas dependencias visuales para una vista.
- Registrar como pendiente lo que exista solo en DB, en un prototipo o en una utilidad sin consumidores. No atribuir una capacidad por encontrar un archivo.
- Comentar invariantes, decisiones y trampas no obvias; no narrar línea por línea lo que ya expresa el código.
- Para una tarea acotada, leer solo esta entrada, la guía AGENTS.md de la carpeta tocada y el tema enlazado en el mapa.
- Antes de editar, rastrear consumidores de la regla/símbolo y contratos relacionados; un cambio en un módulo puede afectar listas, permisos, APIs, informes y otros módulos.
- Compartir una abstracción solo si los consumidores tienen el mismo comportamiento/contrato; conservar local lo que sea específico. No generalizar para ahorrar líneas.
- Separar IDs persistidos/rutas/claves, etiquetas visibles y colores/clases. Cambiar una etiqueta no debe cambiar IDs; un ID persistido exige revisar API, DB, informes, fixtures y migraciones.

## Capas y fuentes únicas

| Qué se modifica | Fuente |
| --- | --- |
| Rutas, nombres, grupos e IDs de módulo | lib/constants/modulos.ts |
| Roles operativos | lib/constants/roles.ts |
| Colores de badges/estados | lib/constants/badges.ts y estados.ts |
| Colores y tipografía | app/styles/theme.css (@theme) |
| Recetas y utilidades visuales | app/styles/components.css y app/globals.css |
| Controles, modales y cargas | components/ui/ y components/Modal.tsx |
| Páginas y editores | app/<modulo>/page.tsx y sus components/ |
| Lecturas/claves/TTL/paginación | lib/queries/, queryKeys.ts, cacheConfig.ts, pagination.ts |
| Workflow/mutaciones | lib/services/; guards privilegiados en lib/server/ |
| DB aplicada y evidencia | supabase/migrations/ y supabase/backups/ |

Stack: Next 16.3.8, React 19.2.4, Supabase JS 2.111.0, TanStack Query 5 y Zustand 5.
El layout servidor solo monta metadata/font y AuthShell/ToastProvider. Las páginas
operativas son Client Components; negocio se lee por hooks/servicios. API, proxy.ts
y lib/server/* son servidor. createServiceClient es server-only; nunca importarlo en UI.
El mapa contiene rutas exactas y explica dónde modificar cada función.
Las carpetas app/, lib/, components/ y tests/ tienen una guía local breve; se aplica
solo al editar esa capa.
Para trabajo por módulo, registra sus capacidades terminadas y pendientes; no marques
un módulo como completo solo porque su página o tabla exista.

## Biblioteca de arquitectura

Este archivo es la entrada y contiene los invariantes que aplican a cualquier cambio.
La biblioteca detallada vive en `docs/`; abre la referencia del tema afectado y sigue
el mapa para llegar a su fuente de código. Los documentos describen el código y la
evidencia disponible, no garantizan que un despliegue posterior conserve ese estado.

| Área del sistema | Referencia principal | Cobertura |
| --- | --- | --- |
| Mapa general y puntos de edición | [docs/arquitectura/README.md](docs/arquitectura/README.md) | Capas, flujo de cambios, mapa de archivos y revisión de impacto entre consumidores |
| Módulos y reglas de negocio | [docs/arquitectura/modulos-y-flujos.md](docs/arquitectura/modulos-y-flujos.md) | Dashboard, Quejas, formulario público, Configuración, catálogos y estado real de otros módulos |
| Apariencia e interacción | [docs/visual-patterns.md](docs/visual-patterns.md) y [docs/arquitectura/visual.md](docs/arquitectura/visual.md) | Tokens, componentes, responsive, accesibilidad, cargas, modales e impresión |
| Sesión y autorización | [docs/arquitectura/sesion-y-permisos.md](docs/arquitectura/sesion-y-permisos.md) | Identidades, login/logout, restauración, roles, rutas, guards, API y límites de seguridad |
| Lecturas y rendimiento | [docs/arquitectura/datos-y-rendimiento.md](docs/arquitectura/datos-y-rendimiento.md) | TanStack Query, claves, TTL, paginación, precarga, cancelación, Realtime y errores |
| Persistencia y base de datos | [docs/arquitectura/base-de-datos.md](docs/arquitectura/base-de-datos.md) | Esquema, relaciones, RLS, grants, RPC, motor QMS, migraciones y evidencia aplicada |
| API e integraciones | [docs/arquitectura/integraciones.md](docs/arquitectura/integraciones.md) | Contratos de endpoints, Usuarios, Drive, IA, secretos y configuración externa |
| Pruebas, despliegue y pendientes | [docs/arquitectura/verificacion-y-pendientes.md](docs/arquitectura/verificacion-y-pendientes.md) | Verificación por tipo de cambio, evidencia previa, límites conocidos y trabajo no integrado |
| Reglas de cada capa | [app/AGENTS.md](app/AGENTS.md), [lib/AGENTS.md](lib/AGENTS.md), [components/AGENTS.md](components/AGENTS.md), [components/ui/AGENTS.md](components/ui/AGENTS.md) y [tests/AGENTS.md](tests/AGENTS.md) | Convenciones locales que se consultan al cambiar esa carpeta |

### Modelo mental del sistema

- **Presentación:** `app/` contiene rutas, páginas y API; `components/` contiene el shell, controles y paneles. Las páginas operativas son Client Components. El layout servidor monta metadata/fuente y los proveedores de autenticación y notificaciones.
- **Estado:** TanStack Query administra datos remotos a través de `lib/queries/`; `lib/store/` (Zustand) administra sesión y estado de interfaz. Los borradores de formularios permanecen locales.
- **Lecturas y escrituras:** los hooks/queries leen datos; `lib/services/` concentra flujos y mutaciones. Las lecturas de navegador usan el cliente Supabase sujeto a RLS. Las operaciones privilegiadas atraviesan API/`lib/server/`, que autentican y autorizan antes de usar service role.
- **Identidad y acceso:** `lib/store/auth-store.ts`, `lib/auth.ts` y `components/AuthShell.tsx` coordinan sesión y protección de rutas; `proxy.ts` participa en el límite de entrada. La autorización de servidor y RLS siguen siendo necesarias aunque la UI oculte una acción.
- **Persistencia e integraciones:** `supabase/migrations/` conserva cambios de esquema; `supabase/backups/` y las referencias de arquitectura aportan evidencia. Drive e IA se conectan desde APIs de servidor con límites y permisos propios.
- **Fuentes canónicas:** rutas/módulos y roles están en `lib/constants/`; lectura y caché en `lib/queries/`; workflows en `lib/services/`; tokens visuales en `app/styles/`; políticas/esquema aplicado en Supabase. No mantener una copia paralela de estas reglas.

## Invariantes de sesión y autorización

- Auth relaciona auth.users.id con usuarios.auth_id. Entidades, autores y responsables usan usuarios.id; son identidades distintas.
- El rol de máxima autoridad operativa es admin. No existe superadmin integrado; no autorizar con user_metadata editable.
- Restauración: getSession detecta credenciales → getUser verifica identidad → perfil/permisos independientes en paralelo → exigir activo y revisión vigente → publicar juntos.
- Eventos Auth tienen callback síncrono y difieren llamadas SDK. Refresh de la misma identidad conserva permisos, vista y caché.
- Login exige perfil activo e identidad remota coincidente. Logout marca cierre pendiente y retira usuario/permisos/vista/caché antes de esperar la red.
- qms:logout-pending en sessionStorage contiene solo un booleano. Recargar durante cierre continúa cerrando; ningún evento tardío puede restaurar el perfil anterior.
- Cambiar identidad/rol/vista separa el ámbito de QueryProvider y vacía el anterior. Navegar dentro del mismo ámbito conserva caché. El guard queda fuera del key de datos.
- AuthShell bloquea hijos privados antes de validar y mientras router.replace redirige. No mostrar contenido anterior, siquiera para cubrir una espera.
- Una URL privada pendiente muestra solo fondo neutral; login/logout/destino confirmado a login usan su skeleton. Después de autorizar carga solo el módulo solicitado, sin barra global ni doble skeleton.
- /login y /q son públicos por segmento. /usuarios y /configuracion requieren además rol real admin incluso al simular vista.
- Vista por rol cambia presentación, nunca Auth ni RLS. El registro de módulos no concede permisos; una nueva ruta exige revisar lectura/escritura, API y DB.
- Mantener guard Bearer/perfil activo/rol/entidad en cada API. API_WITH_ROUTE_AUTH solo incorpora métodos con guard completo y pruebas de token inválido; el proxy descarta headers de identidad enviados por cliente.
- Service role evita RLS: cada handler que lo usa debe autorizar antes al llamador. Guard cliente no autoriza solicitudes directas.
- Quejas usa qms_update_details/qms_transition con revisión esperada. Nunca leer una revisión nueva para forzar el reintento ni reabrir EXECUTE de los RPC legacy.
- Una respuesta tardía no puede cambiar silenciosamente el ámbito, revisión esperada, estado inactivo o cierre pendiente para hacer pasar una operación.

Detalle: [sesión y permisos](docs/arquitectura/sesion-y-permisos.md).

## Datos, rendimiento y cargas

- TanStack es estado remoto; Zustand gestiona sesión/UI. No duplicar consultas en estado global ni globalizar borradores locales.
- Compartir queryKeys y queryFn entre vista/precarga; invalidar el prefijo del módulo tras mutar. Una queryFn recibe contexto: pasar solo context.signal a abortSignal.
- Precargar por intención (80 ms), con identidad/permisos y claves reales. Mis Quejas siempre filtra responsable propio; sin ID no consulta.
- Listados operativos: 25 filas y orden estable; dashboard comparte cuatro recursos, más estadísticas/actividad independientes. No bloquear todos los bloques por la consulta más lenta.
- Conservar caché fresca al navegar y refrescar según TTL. Sin caché global infinita, duración mínima ni requests para aparentar fluidez.
- Realtime agrupa 750 ms, compacta prefijos, resincroniza al reconectar y limpia canal/timer/callbacks al desmontar.
- Carga inicial con Skeleton/LoadingSkeleton; operaciones con Button loading/Spinner/OperationLoading centrados. Cantidad fija de formas CSS, movimiento reducido, sin spinner permanente por fila.
- Guardados: validar antes de efectos, bloquear doble envío, conservar borrador/error y distinguir escritura exitosa de refresco fallido. Errores visibles pasan por helpers seguros.
- Las utilidades de guard de visitas aún no protegen todos los handlers de paneles de quejas. Mantener este pendiente al tocar IA/subidas/transiciones.

Detalle: [datos y rendimiento](docs/arquitectura/datos-y-rendimiento.md),
[flujos de módulos](docs/arquitectura/modulos-y-flujos.md) y [capa visual](docs/arquitectura/visual.md).

## Estado de DB e integraciones

- Proyecto Supabase: fykhrrpeoehwqznccmfp. MCP/OAuth es configuración del agente, no código del producto.
- Snapshot remoto: 33 tablas con RLS y tres vistas invoker. Seguridad aplicada: 20261006232152, 20261008011901 y 20261008012121; las dos últimas sustituyen políticas amplias de 13 tablas y cierran bypass SACP.
- ai_* no es accesible por Data API cliente, incluso admin. Gestor IA pasa por /api/configuracion/ia con admin activo y respuestas sin claves guardadas; backend service role conserva acceso.
- Guardar IA preserva secreto vacío y consumo, usa revisión explícita/xmin y devuelve 409 en carreras. No reintentar silenciosamente con otra revisión ni introducir un RPC inexistente.
- Evidencias nuevas usan Drive, máximo 4 MiB; paths legacy siguen Storage. Borrar Drive primero y después la fila; no borrar metadatos si falla el archivo.
- Motor QMS versionado y auditoría existen en DB; SLA/editor visual aún son legacy. No afirmar programador de avisos/correos: cron y worker no están instalados según snapshot.
- No están integrados Seguridad y Estado, MFA/2FA, CAPTCHA, telemetría persistida/retención anual, fondo personalizado ni selector completo de tema.
- Logout inmediato de UI no revoca universalmente todos los JWT emitidos. Rate limit propio es memoria por instancia, no distribución entre Vercel ni protección del login externo.

Detalle: [base de datos](docs/arquitectura/base-de-datos.md) e
[integraciones](docs/arquitectura/integraciones.md). No ejecutar dumps, seeds o SQL legacy como migración.

## Verificar y mantener

Ejecutar las comprobaciones pertinentes al cambio, sin instalar dependencias de prototipos ni regenerar fixtures para esconder fallos:

~~~sh
npx tsc --noEmit
npm run lint
node --test tests/<suite-del-cambio>.test.mjs
npm run build
npm run check:structure
npm run check:visual
~~~

Suite local de limpieza: 238/244; seis fallos previos de concurrencia en paneles de Quejas.
Comparar con su baseline y alcance; no declarar verde toda la suite por una selección.
La auditoría previa comprobó 47/47 casos de IA/sesión/cargas, build/TypeScript y DB con fixtures/ROLLBACK;
no equivale a un benchmark autenticado con miles de filas ni a verificar un despliegue nuevo.
Compilar no publica Vercel. Verificar producción tras un despliegue solicitado antes de afirmar que quedó allí.

La auditoría fechada guarda evidencia de una fecha; no reemplaza los contratos vivos ni
demuestra el estado de un despliegue nuevo. Actualiza esta guía cuando cambie el mapa
general, un flujo transversal o un contrato que una IA necesite para orientarse. Actualiza
también la referencia temática cuando cambie su detalle. La referencia de DB conserva el
inventario completo de columnas, policies, relaciones e índices; esta guía explica cómo
encaja con el producto.

## Mapa general y ejecución

### Capas del código

| Capa | Responsabilidad | Entrada / fuentes principales |
| --- | --- | --- |
| Rutas y composición | Una ruta por página operativa, layouts y endpoints | `app/`, `app/layout.tsx`, `app/api/` |
| Shell y experiencia compartida | AuthShell, layout autenticado, Sidebar, Header, modal y controles | `components/AuthShell.tsx`, `components/AuthenticatedLayout.tsx`, `components/`, `components/ui/` |
| Pantallas de negocio | Estado local de formularios, filtros, selección y detalle | `app/<ruta>/page.tsx` y `app/<ruta>/components/` |
| Consultas de cliente | Lecturas tipadas, query keys, caché, cancelación, paginación y Realtime | `lib/queries/`, `lib/queries/queryKeys.ts`, `lib/queries/cacheConfig.ts`, `hooks/` |
| Flujos de negocio | Validación y escritura a través de funciones compartidas | `lib/services/`, `lib/utils/`, `lib/constants/` |
| Estado de cliente | Identidad de sesión, permisos mostrados, simulación visual y preferencias | `lib/store/auth-store.ts` y stores de interfaz |
| API de servidor | Frontera para operaciones privilegiadas, integraciones y credenciales | `app/api/`, `lib/server/`, `proxy.ts` |
| Persistencia | Tablas, funciones, vistas, triggers, RLS y grants | Supabase; cambios versionados en `supabase/migrations/` |
| Pruebas y mantenimiento | Regresiones, verificadores de estructura/estilo y scripts DB | `tests/`, `scripts/` |
| Documentación técnica | Contratos vivos y evidencia fechada | `AGENTS.md`, `docs/arquitectura/`, `docs/visual-patterns.md` |

### Flujo de una solicitud típica

1. El navegador entra por `proxy.ts` y, para una ruta privada, `AuthShell` valida el estado
   de sesión/permisos antes de montar el contenido. El proxy no convierte la UI en autoridad.
2. La página operativa monta el hook de `lib/queries/` o el servicio correspondiente. Las
   lecturas del cliente Supabase están sometidas a RLS; hooks no deben duplicar estado remoto
   en Zustand ni crear una caché paralela.
3. Para lectura, query key y query function son compartidas por la página y la precarga.
   Para escritura, el servicio valida y envía la mutación; la base aplica su autorización y
   la UI invalida el prefijo común después de confirmar el éxito.
4. Una operación que requiere service role sale del navegador y atraviesa un handler API.
   El handler comprueba Bearer, perfil operativo activo y permiso/rol/entidad necesarios
   antes de cualquier acceso privilegiado.
5. El resultado se presenta solo si la identidad, el ámbito y el registro siguen vigentes.
   Operaciones versionadas de Quejas usan la revisión que el usuario editó; no se reintentan
   en silencio con un estado más reciente.

No todos los módulos tienen cada capa ni todos los handlers usan el mismo servicio. Sigue
imports y consumidores activos antes de extrapolar el flujo de una pantalla a otra.

### Límites de ejecución

- Next.js 16.3.8, React 19.2.4, Supabase JS 2.111.0, TanStack Query 5 y Zustand 5.
- `app/layout.tsx` establece metadata/fuente, CSS y proveedores compartidos. El contenido
  de negocio se monta en páginas cliente; las API y `lib/server/*` se ejecutan en servidor.
- `createServiceClient` es server-only. Nunca importarlo desde componentes, hooks o servicios
  de navegador. Las credenciales privadas no se compilan en el cliente.
- `proxy.ts` es el punto de entrada que existe. La versión de Next instalada puede diferir
  de ejemplos conocidos: consultar primero `node_modules/next/dist/docs/` antes de cambiar
  routing, APIs, proxy o convenciones Next.
- Las importaciones internas usan `@/`. No introducir Server Actions, otro cliente de datos,
  otro store global de negocio ni una arquitectura paralela sin una decisión explícita.

## Mapa de módulos y comportamiento vigente

Las filas indican la capacidad integrada hoy; no equivalen al alcance futuro del producto.
Una tabla, función DB, componente o prototipo sin consumidor activo no demuestra que exista
un flujo completo.

| Ruta | Comportamiento integrado | Límites conocidos |
| --- | --- | --- |
| `/` | Dashboard con indicadores de módulos, ocho expedientes próximos, resumen SVG de Quejas y actividad real | Los tabs/variantes analíticas alternativos no forman parte de la página activa |
| `/quejas` | Listado paginado con búsqueda/filtros, prioridad, estados, SLA visible, vistas locales, alta, detalle, comentarios y adjuntos | Editar/transicionar usa wrappers QMS con revisión; presentación SLA/editor siguen parcialmente legacy |
| `/mis-quejas` | Lista solo las quejas del responsable operativo autenticado; panel de Detalle, Análisis y Resolución | Simular otro rol no cambia responsable ni concede acceso a otras quejas |
| `/q/[token]` | Formulario ciudadano público, valida formulario activo, crea queja y puede adjuntar evidencia | Categorías actuales son una lista fija; no integra todos los atributos nuevos de Quejas |
| `/configuracion` | Secciones General, Catálogos, SLA, Roles, Vistas, Formularios e IA; acceso real admin | SLA/editor no publica reglas versionadas QMS; catálogo UI aún debe alinearse con códigos inmutables |
| `/usuarios` | Directorio con búsqueda/rol/estado, alta, edición, eliminación y reset a través de API | Administración Auth y perfil son llamadas separadas; último admin no tiene serialización transaccional distribuida |
| `/procesos` | Listado paginado y alta de nombre, tipo, objetivo y estado | Documentos vinculados/KPIs no son un gestor de procesos completo |
| `/auditorias` | Listado, alta y modal de hallazgos asociados | CRUD/derivación de hallazgos no está completo |
| `/riesgos` | Listado, alta y matriz de probabilidad×impacto 3×3 | No hay seguimiento integral de mitigaciones |
| `/revision` | Listado, alta y detalle de reuniones de revisión | Acta/acuerdos/Drive no tienen workflow documental completo |
| `/documentos` | Listado por Todos/Maestra/Edición, altas y cambio directo de versión actual | Historial placeholder; versionado y Drive completos pendientes |
| `/sacp` | Listado, alta, avance y flujo básico de validación/cierre | Eficacia, validación avanzada y algunos campos administrativos no están completos |
| `/reporteria` | Selección de módulo/filtros, tablas/resúmenes/distribuciones y print | Lotes acotados a 5000; no persiste la configuración ni emite/envía informes |
| `/login` | Email/password Supabase y resolución de perfil activo | No equivale a una implementación de alta/recuperación pública completa |

### Archivos que suelen ser fuentes canónicas

| Comportamiento | Fuente primaria y consumidores que revisar |
| --- | --- |
| Registro de módulos, grupos, rutas/IDs | `lib/constants/modulos.ts`; Sidebar/Header, guards, precarga, permisos, tests |
| Roles y rol asignable | `lib/constants/roles.ts`; validación server `lib/server/usuarioInput.ts`, APIs, perfil y permisos DB |
| Auth, restauración y logout | `lib/auth.ts`, `lib/store/auth-store.ts`, `lib/authRoute.ts`, `lib/authLogoutIntent.ts`, `components/AuthShell.tsx` |
| Protección de API | `proxy.ts`, `lib/server/auth.ts`, `lib/server/apiAuthentication.ts`, handlers en `app/api/` |
| Queries, keys, TTL y páginas | `lib/queries/`, `queryKeys.ts`, `cacheConfig.ts`, `pagination.ts`, hooks de precarga |
| Workflow de Quejas | `lib/services/quejaWorkflowService.ts`, `lib/constants/quejas.ts`, hooks, paneles y RPC QMS |
| Configuración | `app/configuracion/`, `lib/services/configuracionService.ts`, `lib/utils/configuracion.ts`, API para datos privilegiados |
| Tokens visuales | `app/styles/theme.css`, `app/styles/components.css`, `app/globals.css` |
| Componentes compartidos | `components/ui/`, `components/Modal.tsx`, `components/AuthenticatedLayout.tsx` |
| Esquema DB aplicado | Snapshot/estado remoto y `supabase/migrations/`; documentación/SQL históricos son evidencia, no migración ejecutable |

Al cambiar un ID persistido, revisar productor y consumidores en API, DB, RLS/RPC,
reportería, vistas, fixtures y documentación. No hacer cambios solo de etiqueta/color en
una clave que se persiste o usa como ruta.

## Lógica de negocio por flujo

### Dashboard

- La página activa usa `useDashboardIndicadores` y `useDashboardTareas`, no asumir que
  `fetchDashboard`/`useDashboard` ni los tabs analíticos históricos estén montados.
- Indicadores y tareas comparten cuatro recursos cacheados: Quejas, Acciones, Documentos
  y Riesgos. Quejas/Acciones entregan count exacto y hasta ocho filas relevantes;
  Documentos/Riesgos se consultan como counts. Estadísticas de Quejas y actividad son
  recursos independientes, por lo que el dashboard no tiene un único bloqueo global.
- Tareas combinan Quejas/Acciones y priorizan ocho vencimientos próximos; sin fecha queda
  después de los que sí vencen. Indicadores excluyen de Quejas estados Finalizado,
  No Procede y Cerrada; SACP excluye Cerrada; Documentos cuentan Borrador y Riesgos Activo.
- Actividad presenta cinco eventos reales recientes de `quejas_actividad`, no texto
  preconfigurado. `QuejasSummary` usa `obtener_estadisticas_quejas` bajo RLS y dibuja SVG;
  el RPC es SECURITY INVOKER. No instalar Chart.js para ese resumen.

### Quejas

Flujo presentado por la aplicación: `Recibido → No Procede | En Investigación →
[Pendiente de Revisión GC] → Resuelto → Finalizado`; la DB define transiciones admitidas,
incluida reapertura desde estados permitidos.

- No Procede requiere resolución/justificación. Procede requiere justificación y responsable
  antes de iniciar investigación. El colaborador envía conclusión a revisión GC; GC aprueba
  Resuelto o devuelve a En Investigación. Finalización/reapertura queda para staff.
- El responsable puede ser fijo durante investigación en el panel, pero existen flujos de
  selección en otros estados; no declarar que la inmutabilidad aplica en toda la DB.
- Comentarios cliente/internos usan `agregar_comentario_queja`; `visible_cliente` no crea
  por sí mismo un portal de consulta ciudadana.
- Derivar a SACP usa RPC idempotente `derivar_queja_a_sacp` y crea acción con origen queja.
- Edición/transición/reapertura del cliente pasan por `qms_update_details` y `qms_transition`.
  Deben enviar `Queja.revision` que cargó el usuario; el conflicto exige refrescar/revisar.
  No consultar una revisión nueva para forzar el reintento ni reabrir los RPC legacy.
- El listado guarda vistas leídas por usuario en localStorage con límite de 500. La
  antigüedad visual usa `fecha` y SLA legacy por prioridad (fallback 3/7 días); no equivale
  al motor versionado QMS ni se actualiza por un reloj de fila en intervalo.
- En los paneles de Quejas aún falta aplicar guard de respuestas tardías a todos los
  handlers IA/chat/subidas/transiciones, incluso al navegar A→B→A. Cambiar el ID puede
  resetear la vista, pero no garantiza aislamiento de toda operación en vuelo.

### Formulario público y evidencias

1. Lee `formularios_publicos` por token y exige formulario activo.
2. `crear_queja_publica` genera folio y crea en estado Recibido.
3. Evidencias nuevas van a Google Drive por `/api/drive/upload-public`, se registran con
   `registrar_adjunto_queja_publica` y la notificación se solicita al final.
4. El folio de la queja se conserva aunque una o más evidencias fallen; la UI comunica
   cuántas fallaron. No se debe generar un folio en el navegador antes del RPC.
5. Upload público comprueba token/formulario, folio, estado y límite de diez adjuntos.
   Usa lista MIME permitida y 4 MiB por archivo; no restaurar límites históricos mayores.
6. Para borrado interno, primero borrar archivo de Drive y después la fila de metadatos.
   Si Drive falla, conservar la fila; un 404 de Drive permite completar el borrado lógico.
   Paths legacy de Storage siguen teniendo consumidores y no se deben interpretar como IDs Drive.

No afirmar que existe entrega de correo: se inserta en `mail_queue`, pero no se encontró
cron/worker de entrega instalado en el snapshot documentado.

### Otros flujos

- **SACP:** alta con folio, tipo, descripción, fecha límite y responsable; avance 100%
  desplaza a En Validación y existe cierre básico. No implica eficacia verificada ni
  máquina de estados integral.
- **Riesgos:** escala probabilidad/impacto 1–3 y matriz 3×3; puntuación por producto,
  niveles Bajo/Medio/Alto/Crítico. No inferir seguimiento de mitigación implementado.
- **Auditorías:** alta por folio, tipo/área/fechas/objetivo/alcance; hallazgos asociados se
  listan, pero las operaciones UI de CRUD/derivación no están integradas por completo.
- **Documentos:** cambio de `version_actual` no significa historial; la UI no crea
  automáticamente versión/archivo Drive en cada cambio.
- **Revisión por Dirección:** reuniones, agenda/fechas y detalle; estado de acta Pendiente/
  Registrada no equivale a flujo de actas o acuerdos guardados en Drive.
- **Reportería:** lectura en lotes de 500, máximo 5000 filas y filtros requeridos si se
  supera; imprime por `window.print`/CSS, no persiste `informes_config`.
- **Configuración:** `DeferredMount` carga panel al visitarlo y preserva borrador;
  el editor de IA tiene API específica. `ai_*` no debe leerse/escribirse por cliente.
- **Catálogos:** claves estables (`codigo`, `valor_interno`) se separan de etiqueta/color.
  Triggers protegen estructura/estados/historial. No quitar la guarda para habilitar un
  botón legacy; al adaptar CRUD, ofrecer desactivación/historial.
- **Roles y vistas:** simulación modifica presentación/permisos visibles, no identidad
  Auth, rol real ni RLS. Admin real es un guard extra de `/usuarios` y `/configuracion`.

## Sesión, identidad y autorización con detalle

### Identidades diferentes

- Supabase Auth usa `auth.users.id`; su perfil de aplicación es `public.usuarios` unido
  por `usuarios.auth_id`. `usuarios.id` es la identidad de negocio usada por responsables,
  autores, actores y relaciones de módulos.
- Nunca comparar o intercambiar `auth.users.id` con `usuarios.id`. No usar
  `user_metadata` editable como fuente de rol/autorización.
- El rol operativo máximo se llama `admin`; no hay rol integrado `superadmin`.
  Los roles operativos (admin, calidad, colaborador, coordinador, revisor, usuario) no
  implican que todas las capacidades estén implementadas para cada uno.

### Ciclo de sesión

1. `init` se ejecuta de forma idempotente, registra listener Auth y detecta credenciales.
2. `getSession` detecta sesión; `getUser` confirma identidad remota, luego perfil y permisos
   independientes se cargan en paralelo.
3. Se exige identidad coincidente, usuario activo y revisión de sesión vigente antes de
   publicar juntos usuario/permisos. Errores nunca deben publicar perfil parcial.
4. El login email/password normaliza email; exige perfil activo, confirma con `getUser`,
   compara auth ID y descarta respuestas si ya cambió la revisión/identidad.
5. Un refresh del mismo usuario conserva permisos, vista y caché. Los eventos Auth usan
   callback síncrono y difieren llamadas SDK para no bloquear el listener.
6. Logout establece `qms:logout-pending` (booleano en sessionStorage), incrementa revisión,
   retira de inmediato usuario/permisos/vista/caché privada y luego espera a `signOut`.
   Al recargar durante logout no restaurar el perfil viejo; eventos tardíos no lo publican.

### Guard de rutas, permisos y API

- `/login` y `/q` son públicos por segmento. AuthShell bloquea contenido privado durante
  bootstrap/redirección; mientras valida una URL privada muestra fondo neutral sin shell,
  datos, links o esqueleto de módulo. Tras autorizar monta solamente el módulo pedido.
- `/usuarios` y `/configuracion` además exigen `user.rol === 'admin'` real aunque la vista
  esté simulada. La simulación es una herramienta de presentación, no autorización.
- `lib/permisos.ts` resuelve permisos de presentación; el registro de módulos no concede
  acceso por sí solo. Añadir ruta requiere evaluar navegación, permisos DB/RLS, guards de
  API y lectura/escritura.
- API privadas deben validar Bearer, usar `auth.getUser(token)`, buscar perfil por auth_id
  y exigir `estado='activo'`, y validar rol/permisos/entidad para esa operación.
- `proxy.ts` descarta `x-user-id`, `x-user-role`, `x-user-email` enviados por cliente.
  `API_WITH_ROUTE_AUTH` solo incluye métodos que hacen su propio guard completo y tienen
  pruebas de token inválido. Enrutamiento simplificado no significa handler sin auth.
- `service_role` evita RLS: el endpoint debe autorizar llamador antes de cada uso. El guard
  cliente no protege solicitudes HTTP directas. `checkModuleAccess` sirve como helper
  server-only; no es middleware universal instalado en todos los endpoints.
- Logout inmediato de UI no revoca universalmente JWT ya emitidos. Rate limit propio es
  memoria por instancia y no coordina réplicas de Vercel ni protege el login externo.

## Datos, concurrencia y rendimiento

### TanStack Query

- Query keys están centralizadas en `lib/queries/queryKeys.ts`; invalidar prefijo de módulo
  tras mutación. La vista y precarga deben compartir query key/queryFn y filtros.
- QueryProvider crea un cliente por ámbito `usuarioId:rolReal:vistaActiva`. Cambiar identidad,
  rol real o vista separa y vacía la caché anterior. Navegar dentro del mismo ámbito la
  conserva. El guard queda fuera del componente con key que cambia.
- `cacheConfig.ts` elige defaults por el primer elemento de la key: Dashboard/default
  stale 60s y gc 5m; Quejas/actividad stale 30s y gc 3m; notificaciones 15s/1m; configuración,
  catálogos, SLA y permisos 10m/30m. Hooks pueden tener overrides; leerlos antes de cambiar.
- Reintento global de lectura es como máximo uno para errores recuperables; no retry en
  401/403/validación. Mutaciones sin retry automático.
- Listas operativas suelen paginar 25, con `count: exact` y orden estable. `pagination.ts`
  aplica filtro antes de range y tie-breaker `id`; validar si el hook usa contrato propio.
- Queries abortables deben aceptar `QueryFunctionContext` y pasar únicamente
  `context.signal` a `.abortSignal(signal)`. No construir una key distinta en precarga.
- Precarga de navegación por intención tras 80 ms con deduplicación; Mis Quejas solo por
  responsable real propio y no consulta sin ID. No precargar toda la aplicación.

### Realtime y errores

- Suscripción activa existe solo donde el consumidor la usa. Tablas publicadas en la
  publication `supabase_realtime` no implican una pantalla suscrita.
- `useRealtimeSubscription` agrupa invalidaciones en 750 ms, compacta prefijos, resincroniza
  tras desconexión posterior a SUBSCRIBED y al desmontar cancela timer/canal/callbacks.
- `lib/errors/userError.ts`, `httpError.ts` y `errorToast.ts` producen mensajes seguros.
  Nunca mandar SQL, URL interna, tokens, secretos o diagnóstico crudo al usuario.
- Guardados: validar antes de efectos, doble envío bloqueado sin esperar render, conservar
  borrador/error; distinguir éxito de escritura y fallo de refresco. Un error del refetch
  tras guardar no autoriza repetir la escritura.
- La UI cancela operaciones al desmontarse cuando la capa ya provee signal; no asumir que
  todas las consultas directas legacy fueron migradas ni que guard de visita ya cubre todos
  los paneles de Quejas.

## Base de datos y fuente de verdad

### Capas y alcance observado

- Supabase aloja Auth y Postgres de aplicación; `usuarios.auth_id` vincula Auth con perfil.
  Perfil/relaciones operativas se referencian por `usuarios.id`.
- Snapshot documentado: 33 tablas públicas con RLS y tres vistas `security_invoker`.
  Es información con fecha, no una consulta a la DB en cada edición.
- Las policies permisivas se combinan con OR; agregar una policy nueva no corrige una
  policy histórica amplia. Verificar policies y grants efectivos, no solo que `relrowsecurity`
  esté habilitado.
- Service role conserva privilegios que omiten RLS. Las tablas `ai_*`/claves `ai_*` no son
  accesibles desde Data API cliente, incluso para admin operativo; panel IA usa API admin.
- `configuraciones_sistema` contiene JSONB; el prefijo `ai_` no significa que el contenido
  esté cifrado/Vault. No copiar valores sensibles a documentación o logs.
- Tres vistas QMS de invocador actual: `qms_current_stages`, `qms_quejas` y `qms_work_items`.
  No convertirlas a SECURITY DEFINER ni romper el scope RLS.

### Dominios persistidos

`public.usuarios` y `permisos` describen perfil operativo y permisos; `quejas`,
`quejas_comentarios`, `quejas_actividad` y `queja_adjuntos` describen expediente y evidencia;
`acciones` (incluido el flujo SACP), `auditorias`/`hallazgos`, `riesgos`, `procesos`, `reuniones` y
`documentos` soportan otros módulos; `catalogos`, `sla_config`, `formularios_publicos`,
`configuraciones_sistema`, `informes_config`, `notificaciones`, `logs` y `mail_queue`
soportan parametrización, presentación e integración. El motor QMS versionado agrega
tablas de stages, versiones, calendarios, runs, eventos, avisos y auditoría de configuración.

La documentación DB temática contiene el esquema verificado columna por columna, PK,
NULL, relaciones, vistas, grants/RLS y RPC relevantes; consultarla antes de SQL, índices,
policies, DDL, migraciones o scripts. No asumir FK por nombres: por ejemplo
`acciones.origen_id` es texto y la derivación de Quejas no implica automáticamente FK.
Hay familias legacy de versiones de documentos incompatibles: identificar lectores y
escritores antes de unificarlas.

### Seguridad de negocio por dominio

- **usuarios:** cliente puede leer identidad/perfil dentro de policy, pero no modificar
  rol/estado/auth_id/ID/email y campos administrativos; administración pasa por API.
- **quejas:** staff admin/calidad activo y colaborador activo responsable con `mis_quejas`.
  Mutaciones sensibles se hacen por RPC autorizados/versionados.
- **adjuntos:** lectura staff o responsable; snapshot aún conserva policy heredada de INSERT
  para staff; no afirmar que todo INSERT directo está prohibido.
- **documentos/auditorías y otros módulos:** acceso por perfil activo y lectura/escritura
  correspondiente al módulo con override admin donde define la policy.
- **notificaciones:** filas propias; formularios públicos dejan leer activos sin sesión y
  restringen administración a admin. `ai_*` y tablas internas de folios/avisos se mantienen
  fuera del acceso cliente general.
- Validar también SECURITY DEFINER/INVOKER y EXECUTE por rol de cada función; proteger
  grants de RPC legacy. RLS no compensa un RPC ampliamente ejecutable.

### Motor QMS de etapas

- Motor versionado implementado en DB con stages, versiones de reglas, calendarios,
  snapshots por caso (`qms_stage_runs`), eventos, avisos y auditoría. Su existencia no
  significa que la UI de configuración SLA ya lo administre.
- `qms_publish_stage`/`qms_publish_calendar` usan rol admin, revisión esperada, bloqueo y
  conflicto de serialización; publican nueva versión sin reescribir historia.
- La duración admite 1–3660, business_days/calendar_days, alertas positivas únicas dentro
  del plazo y acciones definidas. El calendario usa días ISO 1–7 y feriados.
- `qms_due` cuenta desde el día posterior al inicio, desplaza el vencimiento al día válido
  y calcula final de día en `America/Costa_Rica`; no equivale a N×24h.
- Trigger `qms_queja_stage` sincroniza estado/runs y aumenta `revision` en cada UPDATE.
  Si el estado no cambia, conserva snapshot y plazos. Al cambiar, cierra run previo, captura
  regla/calendario vigente y calcula `expires_at`/`attention_at`.
- Avisos se procesan en lotes hasta 250 con `FOR UPDATE SKIP LOCKED`; función reservada
  a postgres/service role. En snapshot no se encontró `cron.job` ni Edge Function desplegada:
  no afirmar que el procesamiento automático está instalado.
- `qms_case_events` y `quejas_actividad` son registros diferentes. `qms_dashboard` existe
  pero no es el RPC que usa la página principal actual.
- `sla_config` y antigüedad visual constituyen capa legacy; conciliar con snapshots QMS
  antes de cambiar plazos para no presentar una fecha incorrecta.

### Folios y mutaciones DB

- `generar_folio_queja()` usa contador anual transaccional `folios_quejas_anuales`, zona
  Costa Rica y formato `AAAA-NNN` (mínimo tres dígitos, crece sobre 999); no agregar prefijo
  ni implementar reset manual. No usar generadores legacy `siguiente_folio_queja()`.
- SACP/Auditorías/Riesgos/Documentos mantienen generadores secuenciales con prefijos y
  formato propio; seguir el RPC activo en cada módulo.
- RPC sensible: `crear_queja_interna`, `crear_queja_publica`, `qms_update_details`,
  `qms_transition`, `derivar_queja_a_sacp`, `agregar_comentario_queja` y RPC de adjuntos.
  Revisar firma, código de autorización y grants efectivos antes de cambiar cliente o DB.
- No abrir EXECUTE de `actualizar_detalles_queja`/`transicionar_queja` legacy para evitar
  wrappers versionados ni implementar lógica de DB como una secuencia de requests no atómica.

## Apariencia, navegación y accesibilidad

### Sistema visual

- Tailwind v4 sin prefijo, entrada única `app/globals.css`; esta importa
  `app/styles/theme.css` (`@theme`) y `app/styles/components.css`. No añadir Bootstrap,
  CoreUI, CDN, otro prefijo Tailwind o un segundo helper visual de prototipo.
- Marca `#024796`; tokens de color/escala/fuente/radios/sombras se definen en theme. El CSS
  de página no debe duplicar hex/clases de marca. Estados/colores semánticos son
  `lib/constants/estados.ts` y `lib/constants/badges.ts`; etiquetas e IDs son conceptos distintos.
- Componentes base: `Button`, `Input`, `Textarea`, `Select`, `Field`, `Badge`, `Switch`,
  `Table`, paginación, `Modal` nativo. Importar cada componente desde su archivo y preservar
  atributos HTML/ARIA, ref, eventos y disabled.
- Controles 40px mínimos (sm 32px; controles principales táctiles 44px), texto de filas
  16px; Badge de estado mantiene contraste (ámbar texto oscuro, investigación naranja con
  blanco según su token). Verificar valor real del token antes de mover colores.
- Sidebar desktop 250px/64px colapsado desde lg; bajo 1024px drawer de ancho máximo 320px,
  `100dvh`, scroll interno en navegación y sin marcos anidados. Shell usa altura viewport y
  scroll propio del main.
- Tablas conservan mínimo 640px y scroll horizontal local. No hacer que desborden página.
  Mis Quejas conserva tabla min-width 1200px; panel móvil ocupa viewport, 500px desde lg.
- Body usa selección de texto desactivada como default; texto/tabla copiables la habilitan.
  CSS global define scrollbar e impresión; `.informe-content` delimita impresión.
- Clases dark pueden existir, pero no hay selector integral de tema. No anunciar fondo
  personalizado o cambio completo de tema como funcionalidad activa.

### Modal, focus y cargas

- `components/Modal.tsx` usa `<dialog>` nativo/top layer; respetar focus trap, retorno de
  foco, Tab/Shift+Tab, Escape, cierre por fondo y scroll lock, incluso anidados.
- Antes de resolver auth en URL privada: fondo neutral; no barra, dashboard, links ni perfil
  anterior. Login/logout/destino de login usa skeleton de login cuando corresponde.
- Después de autorización, cada módulo gestiona su skeleton; no agregar skeleton global ni
  doble carga. Estados permanentes (p.ej. Acta Pendiente) son texto/icono estático.
- Skeletons CSS con cantidad fija de formas, movimiento reducido y sin timers/queries JS por
  fila. `Spinner` solo para operación en curso; no spinner permanente por registro.
- Button loading deshabilita y anuncia estado. Un guard síncrono de envío impide doble
  submit aunque dos clicks ocurran antes de render.
- Login conserva `username`/`current-password` para autofill y su desbloqueo al foco/
  pointerdown; no arreglar la vista previa Chromium desactivando password managers.
- Cabecera muestra avatar 40px; nombre/correo completos en menú, sin truncar datos
  guardados; menús móviles caben en viewport y devuelven foco al disparador al cerrar.

## API e integraciones externas

| Ruta | Contrato resumido y autoridad |
| --- | --- |
| `/api/usuarios` GET | Admin/Calidad; filtros/proyección, incluido último acceso obtenido de Auth Admin en servidor |
| `/api/usuarios` POST/PATCH/DELETE | Admin; valida payload antes de efectos y gestiona Auth + perfil, autoprotección y último admin |
| `/api/configuracion/zona-horaria` GET/PUT | GET perfil activo, PUT admin; guarda `org.zona_horaria` |
| `/api/configuracion/ia` GET/PUT/POST | Admin activo; lee/escribe configuración, descubre modelos, prueba y limpia memoria; respuestas sin secreto guardado |
| `/api/ai/analizar` POST | Bearer y permiso staff/responsable según módulo/entidad; proveedor/modelo se resuelven en servidor |
| `/api/ai/test` POST | Admin; prueba proveedor/modelo individual |
| `/api/drive/upload` POST | Bearer; expediente autorizado, archivo dentro de límites, carpeta interna `Analisis/` |
| `/api/drive/upload-public` POST | Público por diseño exacto; valida token activo, folio/estado y cuota de adjuntos |
| `/api/drive/download?id=...` GET | Bearer; resuelve adjunto en DB y valida staff/responsable antes de stream |
| `/api/drive/delete` DELETE | Bearer; permiso según origen de archivo; elimina Drive antes que metadato |

Todos los anteriores usan runtime Node cuando está descrito en su contrato. Cada nuevo
endpoint debe validar métodos, límites de body, errores y autorización para cada método;
un path público debe ser excepción exacta, no wildcard. API IA/admin no devuelve secretos.

### Proveedor IA

- Código en `lib/ai/` (types, factory, discovery, memory, tests) y configuración en
  `lib/services/aiConfigService.ts`; APIs autorizadas en `app/api/configuracion/ia/route.ts`,
  `app/api/ai/analizar/route.ts` y `app/api/ai/test/route.ts`.
- Proveedores soportados incluyen Gemini, Anthropic y OpenAI-compatible bajo allowlist.
  La URL es HTTPS/host validado; rechazar IP privada/redirects no permitidos. No convertir
  un campo URL en acceso arbitrario a red.
- Análisis recibe módulo, entidad, tipo auto/custom y prompt opcional; servidor resuelve
  entidad y contexto. Presupuesto total documentado 50s/55s dentro de endpoint de hasta
  60s, con timeout por modelo/tamaño y fallback limitado. Revisar `lib/ai/` antes de
  modificar cifras o número de reintentos.
- Contexto externo opcional `.contexto_qms.txt` viene de Drive; no es autorización ni
  instrucción confiable, y puede contener prompt injection. No guardar temporales locales.
- Memoria de éxito/fallo se almacena en claves `ai_*`; límite de tokens configurado informa
  consumo, no bloquea necesariamente endpoint de análisis. Incrementos/reset de consumo
  usan RPC restringido al service role.
- Gestor usa revisión explícita basada en `xmin`: conflicto devuelve 409; secreto vacío
  conserva el guardado, contador existente se conserva, actualización no reintenta con una
  revisión nueva. No crear dependencia de un RPC nuevo inexistente.
- Test de modelos tiene límite de modelos, aborta al desmontarse/cancelarse y no persiste
  resultados no confirmados. No exponer API key ni mensajes de proveedor crudos.
- Las claves viven en configuración DB y variables secretas de servidor; nunca imprimirlas
  ni incluir su valor en documentación, tests o fixtures.

### Configuración de entorno

Documentar solo nombres, propósito y si es pública/servidor. No mostrar valores.

| Nombre o clave | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente web y consultas respetando RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Administración privilegiada exclusivamente de servidor |
| `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` | Service Account Drive; clave privada solo servidor |
| `APPS_SCRIPT_WEBAPP_URL` | Webhook opcional para extraer contexto desde Drive |
| `drive_folder_id_quejas` (DB) | Carpeta raíz Drive |
| `org.zona_horaria` (DB) | Configuración de visualización, no redefine automáticamente calendario de RPC |
| `ai_providers`, `ai_routing`, `ai_cache_ttl_minutes` (DB) | Proveedores/rutas/consumo/caché IA |

`.env*`, `.next`, `node_modules` y `.vercel` son locales/ignorados. La presencia de
`.env.local` no demuestra que Vercel tenga variables configuradas; compilar tampoco verifica
Drive, Apps Script ni proveedores externos.

## Trabajo pendiente y discrepancias que no deben darse por terminadas

| Área | Estado que una IA debe comunicar |
| --- | --- |
| Guardas de respuestas tardías en paneles de Quejas | Helper existe; integrar en todos los handlers IA/chat/subida/transición, con caso A→B→A |
| SLA de UI/editor | Legacy; no publica reglas/calendarios QMS versionados ni sincroniza completamente snapshots |
| Notificaciones/correo automáticos | `mail_queue`/RPC existentes; no se observó worker, cron o Edge Function de entrega |
| Nuevos atributos de Quejas | `tipo`, `area_afectada`, recepción GC, oficio, observaciones y revisión en DB; formularios/lecturas no integran todos |
| Catálogos | Trigger protege códigos/estados; UI legacy aún ofrece acciones incompatibles y necesita desactivación/historial |
| Adjuntos públicos/internos | Drive nuevo + paths Storage históricos; el límite actual es 4 MiB, no el límite legacy |
| Usuarios | Auth y perfil no son transacción distribuida; comprobación de último admin no serializa administradores concurrentes |
| Documentos | Historial/Drive/versionado completo no integrado |
| Hallazgos/SACP | CRUD/derivación de hallazgos, seguimiento de eficacia y validación completa pendientes |
| Tareas/solicitudes documentales | Tablas o soporte DB sin módulo UI completo |
| Seguridad adicional | Sin MFA/2FA, CAPTCHA, rate limit distribuido ni revocación instantánea universal de JWT |
| Observabilidad | Sin Seguridad y Estado integrado, sistema persistido de telemetría ni limpieza anual |
| Apariencia | Sin selector integral de tema ni fondo personalizado |
| Rendimiento | Sin benchmark autenticado representativo con miles de filas y concurrencia de producción |

No mover un elemento de esta tabla a «terminado» solo por hallar una tabla, migración, helper
o prototipo: verificar consumidor activo, permisos, flujo de extremo a extremo y pruebas.

## Cómo modificar la arquitectura sin romper contratos

1. Inspeccionar `git status` y respetar cambios del usuario. Leer esta guía, el AGENTS.md
   más cercano a los archivos afectados y solo la referencia de tema necesaria.
2. Encontrar todos los consumidores/llamadores de ruta, ID, hook, endpoint, estado o columna;
   examinar el flujo productor → almacenamiento → presentación, no solo coincidencias.
3. Antes de DB, verificar esquema, RLS, policies, grants, triggers y RPC efectivos. Cargar
   los skills de Supabase/Postgres obligatorios si aplica. Una migración histórica no
   demuestra estado remoto y un rollback de prueba no cambia la intención del producto.
4. Mantener capa responsable y reutilizar helper solo si los contratos coinciden. No crear
   abstracción transversal solo por similitud visual o para reducir líneas.
5. Actualizar test de productor/consumidor y rechazo de acceso cuando corresponda. Errores
   visibles deben ser explícitos y seguros; no usar catch vacío, fallback exitoso o silencio.
6. Actualizar esta guía si cambia el mapa general/contrato transversal y el documento temático
   de detalle. No copiar secretos/datos personales ni convertir auditoría fechada en regla.

## Verificación: elegir por alcance

Comandos disponibles:

~~~sh
npx tsc --noEmit
npm run lint
node --test tests/<suite-del-cambio>.test.mjs
npm run build
npm run check:structure
npm run check:visual
~~~

| Cambio | Inicio de verificación |
| --- | --- |
| Auth, logout, navegación/ámbito | `node --test tests/auth-visibility.test.mjs` |
| Dashboard, contrato de query, API guard | `node --test tests/dashboard-runtime-regression.test.mjs` |
| Query, cancelación, key, página | `node --test tests/query-read-contracts.test.mjs tests/data-reliability.test.mjs tests/pagination-active.test.mjs` |
| Precarga y permisos Sidebar | `node --test tests/navigation-prefetch.test.mjs` |
| Altas/guardado/doble envío | `node --test tests/operational-mutations.test.mjs` |
| Usuarios / side effects privilegiados | `node --test tests/usuarios-input-security.test.mjs tests/usuarios-acceso-workflow.test.mjs` |
| Gestor IA/API/errores | `node --test tests/ai-settings-security.test.mjs tests/ai-settings-ui.test.mjs tests/markdown-security.test.mjs` |
| Visual, responsive, foco y modal | `node --test tests/visual-contracts.test.mjs tests/header-menu-focus.test.mjs` y `npm run check:visual` |
| RLS/RPC/grants | scripts de verificación DB con fixtures transaccionales y `ROLLBACK`, autorizados y con scope de proyecto correcto |

Los tests JS pueden usar mocks y transportes sintéticos: eso no equivale a Auth, DB, Drive o
red real. Baseline documentado de suite de limpieza: 238/244, seis fallos previos de
concurrencia en paneles de Quejas; comparar regresiones nuevas con ese baseline. No declarar
toda la suite verde por ejecutar solo una selección. Build local no publica Vercel.
Para afirmar despliegue, confirmar URL y commit y probar el flujo solicitado después de
publicar.
