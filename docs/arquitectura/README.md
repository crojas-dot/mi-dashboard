# Arquitectura y mapa de edición de ECA-QMS

La entrada de reglas está en [AGENTS.md](../../AGENTS.md). Lee primero el archivo
que gobierna el cambio y después la referencia de su tema; no hace falta recorrer todo el repositorio.
Las rutas de código de estas tablas parten de la raíz del proyecto.

## Ruta rápida

1. Busca el comportamiento en **Dónde editar** y abre primero el archivo de entrada indicado.
2. Sigue sus imports hasta la fuente canónica; no edites una copia local si ya existe un registro, token o helper compartido.
3. Lee solo el AGENTS.md de la capa y la referencia del tema que vas a tocar.
4. Cambia la capa responsable, añade o actualiza una prueba de ese contrato y ejecuta la suite más pequeña que lo cubra.
5. Si el cambio modifica una ruta, permiso, estado persistido o integración, actualiza su referencia y verifica también los límites de seguridad.

No hace falta pasar este mapa completo como prompt: las guías AGENTS.md por carpeta dan
las reglas locales automáticamente. Para una IA, basta pedir el resultado esperado y
el comportamiento que no debe cambiar; para editar a mano, empieza por la misma ruta.

## Revisar impacto transversal

Una pantalla no necesariamente es dueña de todo lo que muestra. Antes de cambiar una regla:

1. Busca el símbolo/ID y sus consumidores en `app/`, `components/`, `lib/`, `tests/` y `docs/`; inspecciona quién lo usa, no solo coincidencias de texto.
2. Sigue el dato en ambas direcciones: UI → hook/servicio → API → DB, y DB/API → listas, etiquetas e informes. Incluye Sidebar, precarga y permisos si cambia una ruta o módulo.
3. Si persiste en DB, confirma esquema, policies, grants y RPC efectivos antes de editar. Una migración histórica o un mock no demuestra el estado aplicado.
4. Clasifica cada parte como transversal (mismo contrato en varios consumidores) o propia del módulo. Comparte la primera; deja local la segunda. Una similitud visual no significa que comparta la regla de negocio.
5. Prueba el flujo modificado y al menos una superficie vecina que use el mismo contrato. Para IDs/estados/rutas, cubre productor y consumidores; para auth/API, también el rechazo sin permiso.

Mantén separados **ID estable**, **etiqueta visible** y **presentación** (variant,
color o clase). Los módulos pueden compartir controles y tokens sin compartir sus
estados, permisos ni workflows. No renombres claves históricas solo para uniformar:
adáptalas explícitamente en la frontera.

## Referencias por tema

| Tema | Documento |
| --- | --- |
| Login, logout, identidad, roles, guards y permisos | [Sesión y permisos](sesion-y-permisos.md) |
| Tablas, columnas, RLS, RPC, QMS y migraciones aplicadas | [Base de datos](base-de-datos.md) |
| Queries, caché, precarga, cancelación, Realtime y errores | [Datos y rendimiento](datos-y-rendimiento.md) |
| Qué hace cada página, reglas de Quejas y límites de producto | [Módulos y flujos](modulos-y-flujos.md) |
| Usuarios, Drive, IA, endpoints y variables de entorno | [Integraciones](integraciones.md) |
| Tokens y puntos de entrada de apariencia | [Visual](visual.md) y [patrones del kit](../visual-patterns.md) |
| Comandos, alcance de pruebas y trabajo pendiente | [Verificación y pendientes](verificacion-y-pendientes.md) |

## Dónde editar

| Quiero cambiar… | Abrir primero | Acompañar con |
| --- | --- | --- |
| Nombre, ruta o grupo de un módulo | [lib/constants/modulos.ts](../../lib/constants/modulos.ts) | [components/Sidebar.tsx](../../components/Sidebar.tsx), [components/Header.tsx](../../components/Header.tsx), [lib/permisos.ts](../../lib/permisos.ts); registro no concede acceso |
| Roles, etiquetas y colores | [lib/constants/roles.ts](../../lib/constants/roles.ts) | [lib/server/usuarioInput.ts](../../lib/server/usuarioInput.ts) valida roles asignables; guards/API/DB siguen siendo la autoridad de acceso |
| Color de un estado o prioridad | [lib/constants/estados.ts](../../lib/constants/estados.ts) | [lib/constants/badges.ts](../../lib/constants/badges.ts), [components/ui/Badge.tsx](../../components/ui/Badge.tsx) y [app/styles/theme.css](../../app/styles/theme.css) |
| Paleta, fuente, tamaños, radios o sombras | [app/styles/theme.css](../../app/styles/theme.css) | [app/styles/components.css](../../app/styles/components.css) y [app/globals.css](../../app/globals.css); mantener tokens, sin colores repetidos por página |
| Botón, input, select, tabla o paginación | [components/ui/](../../components/ui/)<Componente>.tsx | [components/ui/AGENTS.md](../../components/ui/AGENTS.md) y docs/visual-patterns.md |
| Modal, foco, Escape o drawer móvil | [components/Modal.tsx](../../components/Modal.tsx) | [components/AuthenticatedLayout.tsx](../../components/AuthenticatedLayout.tsx) y [hooks/useMobileNavigation.ts](../../hooks/useMobileNavigation.ts) |
| Login o error de autofill | [app/login/page.tsx](../../app/login/page.tsx) | [app/globals.css](../../app/globals.css): ui-login-field; [lib/auth.ts](../../lib/auth.ts) para ejecución |
| Orden de restauración/login/logout | [lib/store/auth-store.ts](../../lib/store/auth-store.ts) | [lib/auth.ts](../../lib/auth.ts), [lib/authRoute.ts](../../lib/authRoute.ts), [lib/authLogoutIntent.ts](../../lib/authLogoutIntent.ts), [components/AuthShell.tsx](../../components/AuthShell.tsx) |
| Presentación al validar sesión | [components/SessionScreen.tsx](../../components/SessionScreen.tsx) | [components/AuthShell.tsx](../../components/AuthShell.tsx); fondo neutral antes de autorizar, sin módulos anticipados |
| Encabezado, usuario y notificaciones | [components/Header.tsx](../../components/Header.tsx), [components/header/](../../components/header/) | [lib/services/notificacionService.ts](../../lib/services/notificacionService.ts), [lib/queries/useNotificaciones.ts](../../lib/queries/useNotificaciones.ts) |
| Dashboard activo | [app/page.tsx](../../app/page.tsx) | [lib/queries/useDashboard.ts](../../lib/queries/useDashboard.ts), [components/dashboard/QuejasSummary.tsx](../../components/dashboard/QuejasSummary.tsx) y DashboardLoading.tsx |
| Buscar, filtrar o paginar un listado | lib/queries/use<Modulo>.ts | app/<modulo>/page.tsx, queryKeys.ts, pagination.ts, [lib/utils/postgrest.ts](../../lib/utils/postgrest.ts) |
| TTL o reintentos de lecturas | [lib/queries/cacheConfig.ts](../../lib/queries/cacheConfig.ts) | [lib/providers/QueryProvider.tsx](../../lib/providers/QueryProvider.tsx); revisar overrides del hook |
| Precarga del menú o reconexión | [hooks/useHoverPrefetch.ts](../../hooks/useHoverPrefetch.ts), [hooks/useRealtimeSubscription.ts](../../hooks/useRealtimeSubscription.ts) | Sidebar y claves de la vista; context.signal al transporte |
| Alta operativa | app/<modulo>/components/Nueva*.tsx | [lib/utils/operationalFormValidation.ts](../../lib/utils/operationalFormValidation.ts); mantener doble envío y borrador protegidos |
| Workflow/estado/responsable de Quejas | [lib/services/quejaWorkflowService.ts](../../lib/services/quejaWorkflowService.ts) | [lib/constants/quejas.ts](../../lib/constants/quejas.ts), [lib/queries/useQuejas.ts](../../lib/queries/useQuejas.ts), paneles de Quejas y wrappers QMS en DB |
| Mis Quejas, análisis o resolución | [app/mis-quejas/](../../app/mis-quejas/) | Buscar QuejaColaboradorPanel.tsx y useEntityRequestGuard; no cambiar filtro de propietario |
| Secciones y editores de Configuración | [app/configuracion/page.tsx](../../app/configuracion/page.tsx) | [app/configuracion/components/](../../app/configuracion/components/); [lib/services/configuracionService.ts](../../lib/services/configuracionService.ts) |
| CRUD/reset/último acceso de Usuarios | [app/api/usuarios/route.ts](../../app/api/usuarios/route.ts) | [lib/server/usuarioInput.ts](../../lib/server/usuarioInput.ts), ultimoAcceso.ts, [components/usuarios/](../../components/usuarios/) y [lib/services/usuariosService.ts](../../lib/services/usuariosService.ts), [lib/services/apiClient.ts](../../lib/services/apiClient.ts), useUsuarios.ts |
| Proveedores/modelos/routing de IA | [components/configuracion/AIProvidersManager.tsx](../../components/configuracion/AIProvidersManager.tsx) | [lib/services/aiConfigService.ts](../../lib/services/aiConfigService.ts), [app/api/configuracion/ia/route.ts](../../app/api/configuracion/ia/route.ts), [lib/server/aiSettings.ts](../../lib/server/aiSettings.ts) |
| Ejecución/fallback/memoria de análisis IA | [app/api/ai/analizar/route.ts](../../app/api/ai/analizar/route.ts) | [lib/ai/](../../lib/ai/) y [lib/server/deadline.ts](../../lib/server/deadline.ts); conservar presupuesto y límites |
| Subir/descargar/eliminar evidencias | [app/api/drive/](../../app/api/drive/) | [lib/server/drive.ts](../../lib/server/drive.ts), [lib/constants/adjuntos.ts](../../lib/constants/adjuntos.ts), [components/quejas/](../../components/quejas/) y formulario público |
| Zona horaria | [lib/timeZone.ts](../../lib/timeZone.ts) | [app/api/configuracion/zona-horaria/route.ts](../../app/api/configuracion/zona-horaria/route.ts); motor QMS conserva su calendario |
| Imprimir un informe | [app/reporteria/page.tsx](../../app/reporteria/page.tsx) | [app/globals.css](../../app/globals.css): reglas de impresión; lotes limitados a 5000 filas |
| Validación de API o headers falsificados | [lib/server/auth.ts](../../lib/server/auth.ts), proxy.ts | [lib/server/apiAuthentication.ts](../../lib/server/apiAuthentication.ts); cada método registrado conserva su guard |
| Política, tabla, función o índice | [supabase/migrations/](../../supabase/migrations/) | Ver esquema efectivo y skills de Supabase; [scripts/verificar-auditoria-db.sql](../../scripts/verificar-auditoria-db.sql) no altera estado final |

Cuando una tabla apunta a una carpeta, usar rg --files en esa carpeta y rg con el
nombre de la función o propiedad. Seguir imports activos antes de usar un archivo similar.

## Cómo está armado

- app/ compone páginas/API; components/ presenta controles y paneles.
- lib/queries/ lee estado remoto con TanStack; lib/services/ ejecuta flujos y escrituras.
- lib/store/ guarda sesión y UI; no es autoridad de datos ni una segunda caché de negocio.
- lib/server/ y API validan Auth/rol/entidad antes de usar recursos privilegiados.
- lib/constants/ guarda diccionarios; app/styles/theme.css define tokens visuales y globals.css su entrada.
- supabase/migrations/ registra DDL aplicado; backups/ y auditorías fechadas conservan evidencia.
- tests/ usa transporte/identidades sintéticas para regresión; no copiar sesiones o secretos reales.
- Los límites por módulo están en `modulos-y-flujos.md`. Actualizar una fila cuando se
  integra o retira una capacidad; un archivo, tabla o prototipo sin consumidor activo
  y flujo probado no cuenta como funcionalidad terminada.

## Cómo mantener esta documentación

Actualizar el tema cuando cambia su contrato. Cambiar este mapa solo si cambia el
punto de edición; evitar duplicar el cuerpo de una función, todas las columnas en
varios archivos o listados automáticos de cada componente. Comentarios de código
explican una decisión o invariante difícil de inferir, no repiten el nombre del archivo.

El material en docs/historico/ conserva decisiones de etapas previas; sus imports,
tokens y componentes pueden haber sido retirados. Revisar consumidores actuales.
El [informe del 7 de octubre](../auditoria-validada-2026-10-07.md) documenta evidencia
de aquella auditoría; resultados históricos no equivalen a ejecutar pruebas hoy.
