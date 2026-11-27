# Auditoría de rendimiento de ECA-QMS

23 de noviembre de 2026 · Base local `eab6b1c` · Datos sintéticos

## Alcance y método

- PostgreSQL 18.6 en Windows, enlazado a loopback, con 10.000 quejas, 19.000 etapas, 5.000 documentos, 2.000 registros por módulo restante (SACP, Riesgos, Auditorías, Revisión y Procesos) y 100 usuarios. Las quejas cubren más de cuatro años e incluyen actividad, eventos y metadatos de adjuntos. El catálogo remoto consultado reportó PostgreSQL 17.6.
- Se reprodujeron las vistas, los RPC de esta revisión, los predicados de RLS y los índices relevantes en la base temporal. Se midieron 30 ejecuciones por consulta y variante. Los tiempos incluyen la conexión local ya establecida y la devolución del resultado. Cada archivo de plan contiene una ejecución separada con `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`.
- Next.js 16.4.6 en build de producción y Chromium contra el adaptador HTTP local, que consulta el PostgreSQL temporal. El proveedor Auth y el transporte Realtime se simularon. Las copias de benchmark usan el archivo Inter de la compilación local para que la descarga de Google Fonts quede fuera de la prueba.
- La columna «Solicitudes» de navegador cuenta Auth, API y REST durante la acción y su arranque inmediato. El tamaño es el cuerpo de datos sin comprimir. Las precargas de rutas de Next se cuentan aparte. El p95 usa rango más próximo y coincide con el máximo cuando hay ocho muestras. Los resultados sirven para comparar estos recorridos y priorizar una medición en staging.

## Resultados en PostgreSQL

Tiempos en ms y tamaño lógico de la respuesta en kB. Los índices corresponden a los planes observados. El RPC de Agenda se explica también con su consulta interna. «Solicitudes» cuenta ejecuciones directas, con el recuento y la página en una sola sentencia donde aplica.

| Consulta o rol | p50 antes → después | p95 antes → después | Máximo después | Solicitudes | kB después | Plan SQL | Índice utilizado | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bandeja de Quejas · Calidad | 533 → 254 | 650 → 282 | 290 | 1 | 58,0 | [Antes](../.performance/auditoria-rendimiento-20261123/plan-base-quejas.json) / [Después](../.performance/auditoria-rendimiento-20261123/plan-after-quejas.json) | `quejas_pkey`, `qms_runs_case` | Correcto |
| Bandeja · página 391 | 524 → 355 | 581 → 409 | 443 | 1 | 71,0 | [Antes](../.performance/auditoria-rendimiento-20261123/plan-base-quejas_profunda.json) / [Después](../.performance/auditoria-rendimiento-20261123/plan-after-quejas_profunda.json) | `qms_runs_case`, `queja_bandeja_actividad_pkey` | Correcto |
| Bandeja · búsqueda parcial | 31 → 24 | 41 → 28 | 31 | 1 | 64,9 | [Antes](../.performance/auditoria-rendimiento-20261123/plan-base-quejas_busqueda.json) / [Después](../.performance/auditoria-rendimiento-20261123/plan-after-quejas_busqueda.json) | `quejas_pkey`, `qms_runs_case` | Correcto |
| Bandeja · filtro de plazo | 194 → 165 | 233 → 197 | 210 | 1 | 50,4 | [Antes](../.performance/auditoria-rendimiento-20261123/plan-base-quejas_plazo.json) / [Después](../.performance/auditoria-rendimiento-20261123/plan-after-quejas_plazo.json) | `qms_runs_case`, `qms_one_active_run` | Correcto |
| Mis Quejas · responsable | 86 → 14 | 128 → 16 | 18 | 1 | 46,5 | [Antes](../.performance/auditoria-rendimiento-20261123/plan-base-mis_quejas.json) / [Después](../.performance/auditoria-rendimiento-20261123/plan-after-mis_quejas.json) | `idx_quejas_responsable_id` | Correcto |
| Agenda · admin | 159 → 130 | 196 → 161 | 171 | 1 | 9,8 | [Antes](../.performance/auditoria-rendimiento-20261123/plan-base-agenda_admin.json) / [Después](../.performance/auditoria-rendimiento-20261123/plan-after-agenda_admin.json) | RPC | Correcto |
| Agenda · Calidad | 503 → 204 | 598 → 240 | 254 | 1 | 9,8 | [Antes](../.performance/auditoria-rendimiento-20261123/plan-base-agenda-detallado.json) / [Después](../.performance/auditoria-rendimiento-20261123/plan-after-agenda-detallado.json) | `qms_runs_case`, `quejas_pkey`, `queja_gc_revisiones_pkey` | Correcto |
| Agenda · colaborador | 321 → 5,86 | 373 → 7,34 | 7,58 | 1 | 0,0 | [Antes](../.performance/auditoria-rendimiento-20261123/plan-base-agenda_colaborador.json) / [Después](../.performance/auditoria-rendimiento-20261123/plan-after-agenda_colaborador.json) | RPC | Correcto |
| Expediente por ID, sin archivos | 1,77 → 2,02 | 2,34 → 2,92 | 2,92 | 1 | 1,6 | [Antes](../.performance/auditoria-rendimiento-20261123/plan-base-detalle.json) / [Después](../.performance/auditoria-rendimiento-20261123/plan-after-detalle.json) | `quejas_pkey`, `qms_runs_case` | Correcto |
| Notificaciones · 15 avisos | 0,63 → 0,94 | 0,98 → 1,27 | 1,31 | 1 | 4,1 | [Antes](../.performance/auditoria-rendimiento-20261123/plan-base-notificaciones.json) / [Después](../.performance/auditoria-rendimiento-20261123/plan-after-notificaciones.json) | `idx_notificaciones_usuario` | Correcto |
| Notificaciones · total no leído | 0,34 → 0,64 | 0,6 → 0,94 | 1,09 | 1 | 0,0 | [Antes](../.performance/auditoria-rendimiento-20261123/plan-base-notificaciones_no_leidas.json) / [Después](../.performance/auditoria-rendimiento-20261123/plan-after-notificaciones_no_leidas.json) | `idx_notificaciones_no_leidas` | Correcto |
| Nota de investigación · INSERT | 1,04 → 0,86 | 1,51 → 1,15 | 1,66 | 1 | — | DML con RLS | — | Correcto en SQL |

La primera página y Agenda de Calidad eran bloqueantes en la prueba inicial. La página 391 también superaba el presupuesto. La mutación de nota incluye el INSERT autenticado y los disparadores de la réplica. Su medición de navegador sigue pendiente. La réplica incluye los índices de folio y cliente. En la búsqueda medida se observaron los índices que indica la tabla.

## Resultados en navegador

Ocho recorridos por variante y 16 aperturas de Login por variante. Tiempos en ms. Solicitudes y tamaño son medianas después del cambio. Los planes se refieren a la consulta correspondiente de PostgreSQL. Login se mide desde el envío del formulario hasta el destino autorizado.

| Ruta o acción | p50 después | p95 antes → después | Máximo después | Solicitudes | kB | Plan SQL o fuente | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Primera pantalla de Login | 217 | 327 → 269 | 269 | 0 | 0,0 | — | Correcto |
| Login · admin | 136 | 268 → 241 | 241 | 14 | 10,6 | Flujo de Auth | Correcto |
| Login · colaborador | 238 | 263 → 257 | 257 | 11 | 66,9 | Flujo de Auth | Correcto |
| Dashboard · indicadores listos | 199 | 822 → 654 | 654 | 13 | 19,4 | Varias consultas | Correcto |
| Primera entrada a Quejas | 525 | 1 111 → 580 | 580 | 3,0 | 58,8 | [Después](../.performance/auditoria-rendimiento-20261123/plan-after-quejas.json) | Mejorable |
| Quejas · página siguiente | 377 | 1 049 → 396 | 396 | 1,0 | 59,5 | [Después](../.performance/auditoria-rendimiento-20261123/plan-after-quejas.json) | Correcto |
| Quejas · página anterior en caché | 42 | 58 → 65 | 65 | 0 | 0,0 | Caché | Correcto |
| Mis Quejas · recarga | 164 | 471 → 186 | 186 | 10 | 65,9 | [Después](../.performance/auditoria-rendimiento-20261123/plan-after-mis_quejas.json) | Correcto |
| Quejas · desde la última tecla | 422 | 108 → 433 | 433 | 1,0 | 3,0 | [Después](../.performance/auditoria-rendimiento-20261123/plan-after-quejas_busqueda.json) | Correcto |
| Expediente sin descargar archivos | 77 | 92 → 94 | 94 | 6,0 | 23,2 | [Después](../.performance/auditoria-rendimiento-20261123/plan-after-detalle.json) | Correcto |
| Abrir Agenda con datos en caché | 39 | 44 → 54 | 54 | 0 | 0,0 | [Después](../.performance/auditoria-rendimiento-20261123/plan-after-agenda_admin.json) | Correcto |
| Abrir Notificaciones con datos en caché | 49 | 59 → 69 | 69 | 0 | 0,0 | [Después](../.performance/auditoria-rendimiento-20261123/plan-after-notificaciones.json) | Correcto |
| Usuarios · primera página | 44 | 154 → 54 | 54 | 1,0 | 22,3 | API y Auth Admin | Correcto |
| Configuración · navegación disponible | 74 | 64 → 134 | 134 | 1,0 | 1,4 | Lectura de catálogo | Correcto |
| Dashboard → Quejas con lista fresca | 99 | 126 → 100 | 100 | 1,0 | 0,0 | Caché | Correcto |

- Las precargas de rutas de módulos en el arranque del Dashboard pasaron de 22 a 0. Las solicitudes totales, incluidos recursos de Next, pasaron de 82 a 36 en la ventana observada. Las 13 solicitudes de datos incluyen sesión, encabezado e indicadores.
- La búsqueda de ocho caracteres pasó de 8 a 1 solicitudes. El tiempo desde la última tecla incluye los 350 ms de espera. Volver a Quejas durante la vigencia de la caché pasó de una lectura de la bandeja a cero. La solicitud que se sigue observando en ese recorrido pertenece a las estadísticas del Dashboard.
- La primera entrada a Quejas incluye la navegación de Next y queda por encima del presupuesto de lista. Cambiar de página cumple el presupuesto con la ruta abierta. El p95 de la primera pantalla de Login cumple su objetivo de 2.500 ms.
- El detalle empezó con seis solicitudes en la muestra y no descargó archivos. Los menús de Agenda y Notificaciones reutilizaron los datos que ya habían llegado al encabezado. La tabla mide su apertura, mientras los planes SQL documentan la carga de datos.

## Cambios verificados

- **Bandeja y RLS.** La vista difiere las lecturas de calendario y reapertura hasta proyectar casos de la página. La etiqueta «Nuevo» detiene la búsqueda al tercer día hábil y conserva el horizonte de 370 días. El conteo sin filtro conserva el total y deja de ejecutar las lecturas de presentación. En el plan de la primera página, los bloques encontrados en memoria pasaron de 429.950 a 241.899.
- **Agenda.** El puente privado calcula la identidad y los permisos una vez por llamada. Se comprobó igualdad de filas de la bandeja y JSON de Agenda para admin, Calidad, colaborador, inactivo y rol sin permiso. También se verificaron 504 combinaciones de calendario, la denegación de un expediente ajeno, la sesión vencida, los grants y `security_invoker`.
- **Búsqueda y caché.** Quejas, Mis Quejas y Usuarios comparten 350 ms de debounce. Cambiar el término deja de observar la consulta anterior y su transporte se cancela. Los espacios equivalentes comparten clave. La bandeja conserva 30 segundos de frescura y refetch ante invalidación o datos obsoletos.
- **Navegación.** El menú y los indicadores del Dashboard desactivan el prefetch de rutas por visibilidad. La precarga de datos por hover, foco o tacto conserva la clave de consulta y el filtro del responsable.

## Evidencia y límites del piloto

- El historial remoto de `pg_stat_statements` orientó la investigación. La bandeja registró 2.545 ejecuciones, 243 ms de media SQL y 2.862 ms de máximo. Agenda registró 1.072 ejecuciones, 181 ms de media y 1.292 ms de máximo.
- Las siete listas operativas consumen paginación de servidor de 25 filas, con desempate por ID. La bandeja conserva el conteo exacto que pide su paginador. La consulta experimental con proyección reducida bajó el cuerpo de una página sintética de 58,0 a 18,5 kB. La selección de Quejas entrega hoy esa fila al expediente y el cambio de contrato merece su propia prueba. La tabla de Usuarios conserva su paginación local con 100 perfiles en la muestra.
- En los recorridos observados, la bandeja realizó una consulta de lista y una de catálogo. El expediente consulta sus adjuntos, actividad y plazos como grupos. Las pruebas de navegación cubrieron cero descargas de Drive en la carga inicial del detalle. El tiempo real de Drive queda pendiente.
- El Dashboard comparte cuatro consultas de indicadores con las tareas. Estadísticas de Quejas y actividad son independientes. Agenda, el conteo y la lista de notificaciones, la marca y la restauración de sesión provienen del encabezado o el shell. El arranque del Dashboard debe interpretarse con esos recursos incluidos.
- Realtime agrupa invalidaciones y limpia los canales al salir según las pruebas sintéticas. El encabezado escucha avisos del usuario. Quejas y Mis Quejas mantienen un canal de actividad mientras su bandeja está abierta. Falta medir la frecuencia y la resincronización con el servicio alojado. Los editores pesados, los módulos de exportación de Word/PDF y la descarga de documentos se activan por uso.
- La conexión disponible mostró cero ramas de pruebas de Supabase. El piloto queda pendiente de una repetición autenticada con Supabase Auth, PostgREST, Realtime y Drive alojados. ECA-QMS opera en una sola organización. El aislamiento por rol y expediente se verificó en la réplica.

## Regresiones y evidencias locales

- Pasaron 111 pruebas focalizadas. La suite general pasó 1.093 de 1.170 pruebas y reprodujo los mismos 77 fallos de la base. El build de producción local y los controles de estructura y capa visual pasaron.

- Planes, muestras y scripts en `.performance/auditoria-rendimiento-20261123/`. Los JSON contienen datos sintéticos y métricas agregadas.
- Migración aplicada en Supabase en [rendimiento de bandeja y Agenda](../supabase/migrations/20261127023155_rendimiento_bandeja_agenda.sql).
- En una muestra de producción de 25 filas, la ejecución SQL pasó de 103,35 ms a 17,13 ms. La prueba aislada conservó los resultados y permisos en seis perfiles.
