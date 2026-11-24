# Datos, caché, rendimiento y diagnóstico

La campana se acota a 15 filas con orden estable y
un conteo de no leídos sin descargar más mensajes. La agenda se refresca cada
cinco minutos en primer plano y vuelve a consultar ante nuevos avisos o al
recuperar el canal. Leer o archivar avisos refresca solo la campana.

El visor privado comprueba el acceso al expediente antes de leer Drive. La precarga
requiere 80 ms de intención para formatos nativos y admite dos lecturas en
paralelo. El indicador aparece a los 180 ms de espera. Un archivo caliente se
revela cuando está listo, con transición breve que respeta movimiento reducido.

En PostgreSQL aislado con 60 000 adjuntos y 120 000 avisos sintéticos, con 24
consultas simultáneas, los índices preparados bajaron el p95 de la búsqueda de
adjuntos de 608,15 a 2,62 ms y el de la campana de 17 a 2,4 ms. El formulario
superó 73 comprobaciones aisladas, incluidas 25 solicitudes simultáneas con el
mismo identificador que generaron un expediente. La aplicación de los índices
en Supabase está pendiente con la migración del avatar y la autoría de notas.

> Contrato de datos y rendimiento. La evidencia fechada no demuestra el estado de un despliegue nuevo; ver [verificación](verificacion-y-pendientes.md).

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
- La bandeja de Quejas y Mis Quejas reutiliza páginas frescas durante 30 s. Refresca al montar, enfocarse o reconectar si la página está obsoleta. El RPC de estadísticas usa `refetchOnMount:'always'`. Notificaciones hacen polling cada 60 s y pueden deshabilitar la consulta por preferencias.
- Hooks analíticos no montados actualmente y zona horaria tienen TTL propios de 5 min; no asumir que el TTL global reemplaza cada override.
- `pagination.ts`: páginas de 25, count exacto, filtro de estado antes de range, orden principal descendente + `id` ascendente. Se usa en Auditorías, Documentos, Procesos, Reuniones, Riesgos y SACP.
- Quejas: filtros folio/cliente, tipo, estado y responsable; count exacto; `fecha desc, id asc`; `keepPreviousData`. Búsqueda con `useDeferredValue` y página de 25.
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

- Resolución de Mis Quejas lee `useQuejaResolucionDraft` solo al investigar, bajo el
  prefijo Quejas y con señal de cancelación. La primera lectura hidrata la visita;
  refetch no reemplaza texto/versiones editados. Guardar/Enviar comparten el lock del
  workflow; CAS de Queja y borrador evita sobrescribir otra computadora. Confirmación
  tardía actualiza solo la caché de origen si sigue vigente su ámbito, nunca otra visita.
  [Contrato](../mis-quejas-borrador-resolucion-2026-11-11.md).

- `lib/errors/userError.ts` y `httpError.ts`: mensajes seguros, recuperación, SQLSTATE/HTTP y conservación del status en los consumidores que los usan. No enviar diagnostics SQL/URLs/credenciales crudos a la UI.
- `errorToast.ts` envuelve sonner con mensajes seguros; el logger usa `normalizeApiError` para contexto HTTP/código sin diagnóstico. El wrapper `useApiError` sin consumidores fue retirado.
- `logger.ts`: niveles ERROR/WARN/INFO/DEBUG, timestamp ISO, módulo/acción/usuario/status/código, detección server/client. Usa consola también en producción; Sentry/LogRocket no están integrados. Dashboard y caché lo consumen; persisten console.* legacy en otros módulos.
- Boundaries: `app/error.tsx`, `app/global-error.tsx` (html/body), `app/quejas/error.tsx`, `app/documentos/error.tsx`; mostrar recuperación/refetch o reset.
- `createRequestScope`/`useEntityRequestGuard` están conectados a los dos paneles de Quejas. Separan visita (A→B→A, cierre, borrador) y ámbito de datos (`queryContextScope`, lifetime del QueryClient). Locks síncronos impiden duplicados. IA/chat/archivos/transiciones/comentarios ignoran UI tardía; escrituras confirmadas invalidan el origen si el ámbito sigue vigente, incluso al navegar. Logout/rol/vista descartan ese callback de caché. La selección exige misma visita/ID y revisión no inferior; no se vuelve a leer una revisión para forzar guardados.

- Usuarios comparte `lib/services/apiClient.ts` (Bearer/signal), `usuariosService.ts` (mutación HTTP sin reintento) y `lib/hooks/useOperationLock.ts` (ref síncrono y estado visual). Alta/edición, delete, reset y cambio de estado recuperan la carga ante fallo; la propia cuenta omite rol/estado disabled. Un error de refresco posterior a una escritura confirmada no vuelve a enviar la mutación. Los errores de escritura conservan el borrador.

### Reglas de rendimiento que deben conservarse

La [auditoría del 23 de noviembre](../auditoria-rendimiento-2026-11-23.md) registra los planes y las mediciones locales. El menú y los indicadores desactivan el prefetch automático de rutas de Next. La precarga de TanStack Query se activa por intención.

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
| `quejas_actividad` | Notas del expediente y marcas históricas del flujo; ambos paneles y las últimas cinco entradas del dashboard |
| `qms_config_audit` | Historia de configuración versionada/catálogos, actor y motivo, `old_value/new_value` JSONB; acceso de administración en DB, sin visor completo montado |
| `qms_case_events` | Eventos de apertura/cierre/resolución generados por triggers QMS; distintos de quejas_actividad |
| `/api/quejas/historial` | Proyección para el expediente autorizado desde el diálogo «Historial y notas». Combina eventos QMS, revisiones, reaperturas y transiciones históricas asociadas al caso. La precarga al abrir el diálogo y la pestaña comparten petición y caché de 30 s. Antes de recibir los movimientos se muestra el ingreso disponible en el expediente |
| `qms_stage_runs.snapshot` | Copia inmutable de regla/calendario usados en un plazo; sirve para explicar su cálculo |
| Logger de aplicación | Contexto seguro con timestamp/entorno/módulo/acción/usuario/status/código en consola cliente o servidor; QueryProvider, Auth y dashboard registran errores. No persiste automáticamente en DB ni en una plataforma de observabilidad |
| Supabase/Vercel | Herramientas externas para logs/asesores. No hay un conector de esas fuentes a un visor dentro del panel actual |
| `/auditorias` | Auditorías de calidad y hallazgos de negocio; no es un diagnóstico de seguridad, errores de runtime o salud de la DB |

Los boundaries muestran recuperación y los servicios usan mensajes sanitizados donde están integrados; todavía hay consumidores/console.* legacy. Login conserva un mensaje compuesto con `error.message` del SDK en `signIn`; no afirmar que todos los errores visibles ya pasan por `getUserError`.

El «Estado del sistema» estilo Wordfence, alertas de errores inesperados, controles de 2FA/CAPTCHA y métricas reales dentro del panel siguen **propuestos, sin UI/backend integrado**. JSONB ya existe en configuración/snapshots/auditoría QMS, pero no hay una tabla nueva de telemetría, ingesta de errores ni limpieza anual automática instalada. Definir cobertura, acceso, redacción de datos sensibles y retención antes de implementarlos; no inventar diagnósticos ni usar logs de auditoría de negocio como temporales descartables.

Quejas (10 octubre): fetchQuejas y Dashboard leen qms_quejas con RLS invoker;
Dashboard ordena plazo_vence y comparte las cuatro queries previas. getQuejaDeadline
solo presenta el vencimiento persistido, no calcula un nuevo plazo por prioridad.
Reportería usa la misma vista/campo, sin filtro prioridad. Mantener AbortSignal,
paginación estable y caché por ámbito. Tiptap/ProseMirror es lazy al abrir el editor,
no un coste por fila ni una consulta remota añadida a la bandeja.

Evidencia del 12 octubre (contrato de consulta actualizado en las secciones vigentes): `useQuejaSeguimiento` lee hasta 20 ejecuciones del expediente
con orden estable y AbortSignal. El panel cuenta el calendario guardado para presentar
tiempo restante; conserva el vencimiento de la vista. Comentarios, actividad e historial consultan al abrir sus superficies; estado de correo se consulta en el expediente según rol y estado. Los estados de correo omiten destinatario,
payload y claim; se invalidan con el prefijo Quejas, y cambios con quejasActividad.
No hubo cambios de TTL global, duración mínima de espera ni nuevo coste por fila.

Sonido (publicado el 19 octubre): el panel abierto puede avisar en segundo plano, con
sesión/preferencias vigentes y audio ya habilitado por un gesto. El hook prepara el
MP3 antes de reclamar el ID en IndexedDB; autoplay bloqueado o descarga fallida no
consumen el reclamo compartido. Buffers correctos se reutilizan; fallos no se cachean.
No añade solicitudes remotas ni cambia Realtime/intervalos. Ver
[contrato y pruebas](../notificaciones-audio-2026-10-14.md).

## Agenda de hoy, campana y foto de perfil

- Agenda: RPC invoker de Quejas/Auditorías, permisos y fechas CR, máximo 20 y un
  motivo prioritario por registro. Caché de cinco minutos por perfil, sin canal
  Realtime adicional ni hover. Los avisos existentes invalidan también Agenda.
  Header controla apertura/cierre; UI solo recibe datos/callbacks.
  /dashboard es alias protegido del panel en /. Asignación/devolución salen de
  eventos reales. SQL aplicado; verificar SHA de producción para determinar su publicación. [Contrato](../agenda-hoy-2026-11-11.md).
- Agenda compacta (máximo 320px) abre en calendario con semana D/L/M/X/J/V/S,
  flechas de mes anterior/siguiente, selección circular y puntos por fecha_limite
  real y prioridad. El RPC añade fecha_limite civil CR (null si no existe), caché
  de contrato v3, cinco minutos. «Ver agenda» muestra cinco tarjetas y «Volver al
  calendario» regresa. Si hay más de cinco, «Ver más» aparece dentro del scroll y
  despliega ahí los restantes recibidos, sin navegar a otro panel. Navegar meses no consulta
  otras agendas ni inventa eventos: puntos solo para los registros recibidos.
  Cada apertura restablece mes actual y selección. Migración 20261111175442 aplicada;
  confirmar publicación por SHA de producción. [Contrato](../agenda-hoy-2026-11-11.md).
- Calendario de Agenda: mes a la izquierda y las dos flechas juntas a la derecha,
  con área 32px e iconos 20px. Grillas gap-1, días 32px y puntos de 4px. Pie de una
  sola fila: check circular azul + «X tareas hoy» y «Ver agenda» como acción textual azul, ambos text-xs; «hoy» en color de texto normal, sin CTA
  relleno ni elementos apilados. Check y «Ver agenda» usan qms-primary; el día
  seleccionado usa fondo qms-primary y texto blanco, sin cambiar la marca global.
- Agenda de hoy reúne novedades accionables de hoy (recepción, asignación, propuesta
  para GC, devolución, lista para publicar y programación) y plazos de hoy o dentro
  de dos días hábiles. La ventana incluye un día hábil con etiqueta precisa.
  Excluye vencidas y finalizadas; novedades antiguas solo reaparecen por vencimiento.
  Calidad ve recepción/revisión/publicación; el colaborador solo su investigación.
  Quejas usa el calendario de su run persistido; Auditorías usa el calendario vigente.
  No inferir novedades a partir de la creación si su evento real es otro.

- Campana: últimos 15 avisos no archivados, orden fecha/ID y contador de
  no leídos exacto. La consulta de conteo sin filas se hace cuando hay avisos
  fuera de la lista. Desactivar avisos suspende su consulta, canal y sonido.
  Agenda conserva su caché de cinco minutos, refresca en primer plano e
  invalida con avisos nuevos o reconexión.

- Foto propia: JPG/PNG/WebP hasta 2 MiB y 16 MP, recodificada a WebP 320×320.
  API Bearer de perfil activo, objeto privado por usuario y puntero con
  comparación de la versión leída. Usar iniciales hasta que la foto cargue.
  Cliente/API y pruebas locales listos; la activación de la migración de bucket,
  autoría de notas e índices espera autorización explícita del proyecto remoto.

## Evidencias privadas y precarga

- La visualización actual usa `fetchDriveBlob` → `/api/drive/download` con
  Bearer QMS, perfil activo, rol, expediente, pertenencia y privacidad física
  verificadas. Blob local y URL.createObjectURL revocada al cerrar/cambiar
  documento o sesión; Storage legacy usa descarga autenticada. Nunca
  iframe externo, preconnect ni autenticación directa Drive. Sin MIME
  previsualizable ofrecer Descargar, no cambiar permisos.
- Intención 80 ms, máximo dos precargas nativas/paralelas y caché 45 s /
  cinco archivos por usuario/rol. Compartir descarga en vuelo; limpiar
  al cambiar identidad, rol o logout. Nada persistente, cookies Google
  ni URL pública. `recordarDriveBlob` solo después de confirmación del
  registro/subida servidor; no cachear fallo. El primer archivo puede tardar.
- La resolución, el informe y el compositor comparten claves y TTL 30 s
  donde corresponde. Precargar por intención y desde expediente, solo
  autorización efectiva. Redacción consulta borrador/publicación en
  paralelo; no bloquearla por informe o historial. Elegir PDF vigente
  automáticamente solo sin elección manual. Las respuestas tardías
  no sustituyen borrador/versión guardados de la visita.
