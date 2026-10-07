# Auditoría y continuidad de las fases 1–3

Fecha: 6 de octubre de 2026. Proyecto auditado: Next.js 16.2.12, React 19.2.4 y TanStack Query 5.101.4.

Las correcciones locales y de base de datos están aplicadas y probadas. La migración remota `20261006232152_seguridad_fases_1_3` está registrada en `fykhrrpeoehwqznccmfp` y tiene un archivo local con la misma versión. Se verificaron RLS, políticas, permisos por columna, RPC e índices. Las pruebas transaccionales se repitieron después de aplicar la migración; no quedaron usuarios, documentos, quejas ni proveedores de prueba.

## Estado de componentes

| Componente | Estado | Resultado |
| --- | --- | --- |
| `lib/utils/logger.ts` | ✅ | Creado. ERROR/WARN/INFO/DEBUG, contexto, timestamp ISO y detección servidor/cliente; consola en ambos entornos. Usado por dashboard y QueryProvider. |
| `lib/hooks/useApiError.ts` | ✅ | Creado y exportado en `lib/hooks/index.ts`. Normaliza HTTP/Supabase, conserva contexto y muestra toast. No publica diagnósticos o credenciales. |
| Protección global de API | ✅ | `proxy.ts` rechaza peticiones sin Bearer y limpia identidad del cliente. Los métodos registrados validan sesión/perfil en el handler una sola vez; API y métodos nuevos conservan el guard completo del proxy. |
| `lib/server/permissions.ts` | ✅ | Helper disponible para consultar perfil activo y permisos reales en BD. La RLS y los guards de los endpoints aplican la autorización. Calidad conserva el directorio de responsables; CRUD de usuarios solo admin. |
| `QueryProvider.tsx` | ✅ | TTL por prefijo, revalidación al montar/reconectar, errores de caché registrados y reintentos seguros. Conserva separación de caché por usuario/rol/vista. |
| `app/page.tsx` | ✅ | QuejasSummary lazy/Suspense, skeletons y bloques independientes de indicadores, tareas y actividad. Conserva datos, orden y estilos existentes. |
| RLS remota | ✅ Aplicada y verificada | Las cinco tablas y `informes_config` tienen RLS activa. Documentos/Auditorías respetan permisos; perfil protegido y acceso a informes limitado al módulo y autor. |
| Índices remotos | ✅ | Los índices requeridos están cubiertos: Auth por UNIQUE, rol por `(rol, estado)`, permisos por PK y estado/fecha de quejas y estado documental por índices propios. |

## Cambios aplicados

- `lib/server/auth.ts`: devuelve `usuarios.id` y rechaza perfiles distintos de `estado='activo'`, aunque el token siga siendo válido. El rol proviene del perfil, nunca de metadata o de la vista simulada.
- `proxy.ts`: protege `/api/:path*`, reemplaza identidad aportada por el cliente y mantiene la subida pública exacta `/api/drive/upload-public`. Esta última conserva su validación de archivo, token y folio dentro del endpoint. Las API mantienen sus comprobaciones de autorización por rol y entidad.
- `lib/server/permissions.ts`: usa `usuarios.id` para perfiles y valida que el rol recibido coincida con el de la BD. Falla de forma cerrada ante perfiles ausentes, cuentas inactivas o errores de consulta.
- `lib/utils/logger.ts`, `lib/errors/apiError.ts`, `lib/hooks/useApiError.ts` e `index.ts`: logging y errores centralizados. `details` solo conserva el código seguro; Sentry/LogRocket queda como punto de integración comentado.
- `lib/queries/cacheConfig.ts` y `lib/providers/QueryProvider.tsx`: dashboard 60s/5min, quejas 30s/3min, notificaciones 15s/1min y configuración 10min/30min. Los tiempos corresponden a `staleTime/gcTime`. Catálogos, SLA y permisos usan la configuración de ajustes; actividad de quejas usa la de quejas.
- Hooks de quejas, actividad, notificaciones y permisos: eliminadas opciones que anulaban los TTL o repetían errores 401/403. Se conservan las excepciones existentes de refetch de Quejas y el polling de notificaciones.
- `lib/queries/useDashboard.ts`: consultas compartidas por tabla, con errores independientes entre bloques y cancelación real del transporte. Se mantienen `fetchDashboard` y `useDashboard` para compatibilidad. Actividad ya consultaba datos reales; se conservó esa implementación.
- `app/page.tsx`, `components/dashboard/QuejasSummary.tsx` y `DashboardLoading.tsx`: carga por bloques y estados accesibles de espera, error, recuperación y contenido vacío; el indicador discreto reemplaza las barras skeleton iniciales.
- `components/Sidebar.tsx` y `hooks/useHoverPrefetch.ts`: precarga alineada con la clave del dashboard nuevo. TanStack reutiliza datos frescos y vuelve a consultar los invalidados sin duplicar peticiones simultáneas.
- `scripts/auditoria-fases-1-3.sql`: auditoría remota, exclusivamente de lectura.
- `tests/optimization-phases.test.mjs`: 12 pruebas de errores, logger, permisos, proxy, caché, cancelación y aislamiento de bloques.

## Cambios aplicados en Supabase

Migración: `supabase/migrations/20261006232152_seguridad_fases_1_3.sql`.

- Documentos y Auditorías: sustituidas las políticas ALL por SELECT/INSERT/UPDATE/DELETE según `permisos.leer/escribir`, con validación de cuenta activa. Admin conserva acceso; Calidad mantiene sus permisos reales. No se modificó la tabla de permisos ni las asignaciones de usuarios.
- Usuarios: el cliente solo puede modificar nombre, teléfono, avatar, último acceso y preferencias de su perfil activo. Rol, estado, identidad, correo y datos administrativos quedan reservados a las API con service role. El login puede leer su propio perfil inactivo para mostrar el motivo del rechazo. Staff conserva el directorio y colaboradores ven su perfil y autores de comentarios visibles en sus propias quejas.
- `informes_config`: habilitada RLS. Lectura según módulo Reportería, creación/edición propia para usuarios con escritura y administración por admin. Se conserva eliminación exclusiva de admin.
- Privilegios: retirados los grants de anon en estas cuatro tablas y TRUNCATE/TRIGGER/REFERENCES del cliente. Service role conserva su autoridad.
- Estadísticas: `obtener_estadisticas_quejas` ahora es SECURITY INVOKER, con `search_path` fijo y sin ejecución anónima. Los conteos respetan las filas autorizadas por RLS.
- IA: `incrementar_tokens_proveedor` queda exclusivamente para service role. Corrige la comprobación del tipo JSON, valida el incremento, bloquea la fila con FOR UPDATE y acumula sin perder escrituras concurrentes.
- Identidad: helpers operativos descartan cuentas inactivas; el RPC de preferencias también exige perfil activo.
- RPC internos: eliminado acceso anónimo, conservando exactamente los permisos autenticados existentes. Los RPC antiguos cerrados por control de revisión (`transicionar_queja` y `actualizar_detalles_queja`) siguen cerrados; sus wrappers actuales siguen autorizados. Crear, registrar adjuntos y notificar quejas públicas conserva su ejecución anónima.
- Fijados los cuatro `search_path` que señalaba el asesor. No se duplicaron índices ya cubiertos por UNIQUE o PK.
- Metadatos originales y resultado verificado guardados en `supabase/backups/seguridad_fases_1_3_{antes,despues}.json`; no contienen filas privadas ni claves.

`scripts/verificar-seguridad-db.sql` crea perfiles y expedientes ficticios dentro de una transacción, simula los roles de PostgREST y termina en ROLLBACK. Comprueba admin, Calidad, permisos solo lectura, colaborador, perfil inactivo, protección de columnas, nombres de autores, propiedad de informes, estadísticas RLS, acceso público y consumo IA. Pasó antes y después de la aplicación definitiva.

## Diferencias necesarias respecto al adjunto

1. `middleware.ts` está deprecado en la guía instalada de Next.js 16; se implementó `proxy.ts`.
2. TanStack Query v5 acepta `true` para refetch de datos obsoletos al montar/reconectar. La cadena `'stale'` no es un valor válido de estas opciones.
3. `auth.uid()` corresponde a `usuarios.auth_id`, no a `usuarios.id`. El SQL adjunto compara además texto con UUID y consulta recursivamente `usuarios` desde su propia política.
4. Permitir INSERT directo de quejas contradice el flujo transaccional por RPC vigente. La actualización libre del propio perfil tampoco debe permitir cambios de rol, estado o identidad.
5. No se aplicaron políticas adicionales por sus nombres: hay que revisar sus predicados y permisos reales primero. Tampoco se añadió `audit_log`: los RPC ya escriben en `logs`.
6. La migración 016 elimina `idx_usuarios_auth_id` porque `usuarios_auth_id_key` ya indexa la columna; `(rol, modulo)` de permisos puede estar cubierto por su PK. No duplicar esos índices para satisfacer una lista nominal.

## Verificación

| Comprobación | Resultado |
| --- | --- |
| Build de producción | ✅ `npm run build`; Next reconoce el proxy y genera las rutas. |
| Tipos y alias | ✅ Validados por el build. |
| ESLint | ✅ Sin errores; conserva dos advertencias previas en `.experiments/src/_nav.tsx`. |
| Pruebas nuevas de fases y runtime | ✅ 17/17. |
| Suite completa actual | 125 pruebas: 88 pasan y 37 fallan. |
| Referencia inicial aislada | 108 pruebas: 67 pasan y 41 fallan; ejecutada desde un archivo Git de HEAD con las mismas dependencias. |
| Regresiones nuevas | ✅ Ninguna: los 37 fallos restantes también aparecen en la referencia inicial. |
| Fallos existentes corregidos | ✅ Cuenta inactiva, recuperación de caché invalidada y precarga de datos invalidados. |
| GET `/api/usuarios` sin sesión con identidad falsificada | ✅ 401 en servidor compilado. |
| GET `/api/algo` sin sesión | ✅ 401. |
| POST `/api/drive/upload-public` sin campos | ✅ 400 del propio endpoint; no queda bloqueado por el proxy. |
| GET `/login` | ✅ 200. |
| Logger | ✅ Pruebas verifican fecha ISO, contexto y entorno cliente/servidor. |
| Regresión SQL sobre Supabase real | ✅ Antes de aplicar, y después sobre la migración persistida; fixtures descartados. |
| Historial de migración | ✅ Versión remota/local coincidente: `20261006232152`. |
| Asesor de seguridad | ✅ Cero avisos ERROR; eliminados los errores por RLS desactivada y los cuatro avisos por `search_path`. |

La suite original mantiene conexiones/timers tras algunos fallos. Para obtener el resultado completo se usó `node --test --test-force-exit tests/*.test.mjs`. No se cambiaron fixtures para ocultar fallos.

## Pendientes y riesgos

- [x] Herramientas del MCP disponibles; conexión, RLS, políticas, columnas e índices consultados en la base real.
- [x] Corregidas y verificadas las políticas de Documentos/Auditorías, las columnas de autorización de Usuarios y la RLS de informes.
- [x] Corregidos los cuatro `search_path` mutables, la ejecución anónima de estadísticas y el acceso de clientes al contador IA.
- [ ] Persisten avisos del asesor: extensión `pg_trgm` en public, protección de contraseñas filtradas deshabilitada y RPC SECURITY DEFINER accesibles. Evaluar cada cuerpo: accesibilidad por sí sola no demuestra vulnerabilidad; los RPC ciudadanos y helpers propios tienen acceso intencional. Hay dos tablas internas con RLS y sin políticas, que se mantienen cerradas al cliente.
- [ ] `procesar_alertas_quejas` ya estaba reservado a postgres/service role; se verificó y no se modificó. `cron.job` no existe en esta base: no se confirmó un programador automático de alertas.
- [ ] Resolver los 37 fallos previos: incluyen Realtime, cancelación/búsquedas, estado de solicitudes concurrentes, Usuarios y contratos del prototipo visual anterior. No atribuir automáticamente esos contratos al kit vigente.
- [x] Eliminada la validación duplicada de sesión para métodos con guard en su handler. Se prueban todos los métodos del registro `API_WITH_ROUTE_AUTH`; no se confía en encabezados del cliente ni se guarda autorización entre peticiones.
- [x] Eliminadas las consultas duplicadas de Quejas/SACP entre indicadores y tareas. La navegación precarga las mismas cuatro claves que usan los bloques.
- [ ] Perfilar la experiencia autenticada en el navegador: las pruebas miden cantidad de solicitudes y aislamiento de cargas, no la latencia percibida de una sesión real.

## Corrección posterior: AbortSignal y navegación

El error `signal.removeEventListener is not a function` se introdujo al registrar `fetchDashboardIndicadores(signal?)` directamente como `queryFn` del menú. TanStack pasa un QueryFunctionContext, que acababa enviado a Supabase como si fuera un AbortSignal. El reintento del SDK fallaba al quitar el listener del objeto incorrecto.

- Las opciones de precarga ahora reciben explícitamente QueryFunctionContext y pasan solo `context.signal`. `PrefetchConfig` exige el tipo QueryFunction para detectar esta incompatibilidad al compilar.
- `useQueries` comparte cuatro consultas por tabla entre indicadores, tareas y precarga. Antes se ejecutaban seis consultas para los dos bloques; ahora se ejecutan cuatro, conservando el aislamiento de tareas ante un módulo lento.
- El menú de Usuarios usa la misma clave normalizada que su página y evita otra consulta al navegar.
- `lib/server/apiAuthentication.ts` registra únicamente métodos cuyo handler ya valida token, cuenta activa y autorización. El proxy conserva el guard completo para métodos/API no registrados. Los endpoints se probaron con token inválido e identidad falsificada: siguen respondiendo 401.
- `tests/dashboard-runtime-regression.test.mjs` usa QueryClient/QueriesObserver y el SDK real, con transporte controlado. Verifica precarga, reutilización, cuatro peticiones sin precarga, módulo lento, reintento 503 y una sola validación de sesión por método privado.
- Build aprobado y lint sin errores; las mismas dos advertencias de `.experiments`. Pruebas nuevas 17/17. Suite completa 88/125, con los 37 fallos restantes ya presentes antes de este arreglo.
- Comprobación en el servidor de desarrollo de `127.0.0.1:3000`: Usuarios, zona horaria y API desconocida devuelven 401 con token inválido; la subida pública incompleta devuelve 400. Para descartar los temporizadores y chunks del código anterior, recargar el navegador con Ctrl+F5.

## Próxima fase

- [x] Aplicar y verificar la corrección de autorización remota, conservando los RPC y flujos públicos existentes.
- [ ] Continuar la fiabilidad de consultas: Realtime, cancelación al salir, filtros y precarga de Usuarios.
- [ ] Medir rendimiento de los bloques con React Profiler y Network antes de introducir más cambios.

## Verificación manual restante

- [x] Compilación de producción.
- [x] API protegida sin token devuelve 401.
- [x] Pruebas de timestamp del logger y reutilización de caché.
- [ ] Navegar al dashboard real en `/` con sesión: observar carga independiente, skeletons, recuperación tras errores y datos coherentes.
- [ ] Revisar consola y Network con sesión real; comprobar que las consultas no se multiplican al navegar o reconectar.
- [ ] Comprobar rechazo de una cuenta desactivada con su token previo en el entorno real.
- [ ] Probar envío ciudadano con evidencias y token público válido.

Fuentes consultadas: guía instalada `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, guía instalada de lazy loading, [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient) y [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
