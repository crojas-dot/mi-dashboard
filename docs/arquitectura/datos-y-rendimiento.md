# Datos, caché, rendimiento y diagnóstico

> Referencia vigente del código y del snapshot remoto del 7 de octubre de 2026. Consultar solo el tema que se modifica; una nota histórica no demuestra el estado de un despliegue nuevo.

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
- Cancelación real con `.abortSignal(signal)` está integrada en dashboard, seis listados paginados, Quejas/adjuntos/comentarios/actividad/estadísticas/SLA, catálogos, formularios públicos, permisos, notificaciones y API de Usuarios/zona horaria. Los wrappers de queryFn y precarga pasan solo `context.signal`. Las consultas directas legacy de componentes no quedan migradas automáticamente por esta revisión.
- `containsPattern()` se usa en búsquedas de Quejas y API de Usuarios: comas, comillas y paréntesis quedan dentro del valor citado y no alteran la gramática de filtros. Conserva los comodines `%`/`_` ya admitidos por la búsqueda; no describirlo como una búsqueda literal de esos dos caracteres.

### Realtime

- Publication `supabase_realtime`: acciones, auditorias, documentos, hallazgos, notificaciones, procesos, queja_adjuntos, quejas, quejas_actividad, quejas_comentarios, reuniones, riesgos.
- Consumidores activos principales: listado de Quejas, Header para notificaciones por usuario y QuejasSummary para estadísticas. Estar publicado no implica que cada página ya tenga suscripción.
- `useRealtimeSubscription` escucha `*`, filtra los eventos solicitados (default INSERT/UPDATE/DELETE) y agrupa invalidaciones en ventanas de 750 ms sin postergar continuamente una ráfaga. Compacta prefijos solapados con el matching de TanStack.
- El hook resincroniza tras una desconexión posterior a SUBSCRIBED; la conexión inicial no genera una consulta extra. Al desmontar cancela el timer, invalida los cambios pendientes con refetchType:none, elimina el canal e ignora callbacks tardíos. Estos bordes tienen pruebas sintéticas; no equivalen a una prueba de la red real en producción.

### Errores y operaciones concurrentes

- `lib/errors/userError.ts` y `httpError.ts`: mensajes seguros, recuperación, SQLSTATE/HTTP y conservación del status en los consumidores que los usan. No enviar diagnostics SQL/URLs/credenciales crudos a la UI.
- `errorToast.ts` envuelve sonner con mensajes seguros; el logger usa `normalizeApiError` para contexto HTTP/código sin diagnóstico. El wrapper `useApiError` sin consumidores fue retirado.
- `logger.ts`: niveles ERROR/WARN/INFO/DEBUG, timestamp ISO, módulo/acción/usuario/status/código, detección server/client. Usa consola también en producción; Sentry/LogRocket no están integrados. Dashboard y caché lo consumen; persisten console.* legacy en otros módulos.
- Boundaries: `app/error.tsx`, `app/global-error.tsx` (html/body), `app/quejas/error.tsx`, `app/documentos/error.tsx`; mostrar recuperación/refetch o reset.
- `createRequestScope`/`useEntityRequestGuard` modelan una visita A→B→A distinta y descartan respuestas tardías. **No están conectados todavía a los handlers de los paneles de quejas**. Esos paneles resetean UI al cambiar ID, pero no garantizan aislamiento de todas las respuestas IA/subidas/transiciones en vuelo.

- Usuarios comparte `lib/services/apiClient.ts` (Bearer/signal), `usuariosService.ts` (mutación HTTP sin reintento) y `lib/hooks/useOperationLock.ts` (ref síncrono y estado visual). Alta/edición, delete, reset y cambio de estado recuperan la carga ante fallo; la propia cuenta omite rol/estado disabled. Un error de refresco posterior a una escritura confirmada no vuelve a enviar la mutación. Los errores de escritura conservan el borrador.

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
