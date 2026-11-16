# Quejas y Mis Quejas: plazo, fecha de ingreso y actividad operativa

Corte: 15 de noviembre de 2026. El alcance integrado es **ambas tablas**; el patrón visual se puede reutilizar en otros módulos sin asumir que ya están integrados.

## Plazo

Fuente: `plazo_vence` persistido en el motor QMS y el calendario de la ejecución. No reconstruir vencimientos por prioridad ni editar plazos históricos. Para calendarios business_days la vista usa `qms_business_day` y `qms_stage_runs.calendar_id` del snapshot; si no hay regla se usa diferencia civil en Costa Rica. La fecha civil tiene prioridad sobre la hora: hoy rojo aunque aún no llegue la hora límite.

| Condición | Texto | Punto |
| --- | --- | --- |
| Resuelto, Finalizado o No Procede (SLA ya cerrado) | Completado | Gris |
| Sin plazo operativo registrado | Sin plazo | Gris |
| Falta > 1 día | Vence en X días | Verde |
| Falta 1 día | Vence mañana | Verde |
| Vence en fecha civil de hoy | Vence hoy | Rojo |
| Venció hace 1 día | Venció ayer | Rojo |
| Venció hace 2–30 días | Venció hace X días | Rojo |
| Venció hace más de 30 días | Vencido | Rojo |

La fecha y el conteo exactos siguen accesibles para auditoría y lógica. El umbral de 30 días solo recorta el **texto**.

## Fecha de ingreso y segunda línea

Primera línea obligatoria `fecha` (`es-CR` y `America/Costa_Rica`): «14 nov 2026».

Segunda línea opcional:

- Si está Recibido, nunca fue procesado, no hay movimientos verificables y han transcurrido **0–2 días hábiles**: «Nuevo» azul semibold. El calendario usa días ISO configurados y feriados publicados de QMS. Desde el tercer día hábil no aparece.
- Si está activo y existe actividad posterior: hoy «Actualización: hoy» azul semibold; ayer «Actualización: ayer» gris; 2–30 «Actualización: hace X días» gris; >30 «Actualización: 14 oct 2026» gris.
- Si está Finalizado o No Procede: no se muestra segunda línea.
- No convertir la creación en una actualización ni fabricar un timestamp cuando no hay registros operativos.

`Resuelto` mantiene seguimiento de respuesta al cliente, aunque su SLA de investigación ya terminó: por eso el plazo puede mostrar «Completado» y la fecha seguir mostrando actividad hasta publicación final.

## Fuente de actividad relevante

La vista `qms_quejas_lista` es invoker y se apoya en `qms_quejas` original. La tabla `qms_quejas_actividad_relevante` no almacena contenido ni permite escritura directa a authenticated. Nueve triggers de eventos capturan cambios reales en quejas, notas, comentarios, adjuntos, borradores, informes, revisiones de GC y asignaciones.

Los registros anteriores a la activación se reconstruyen únicamente con timestamps existentes en tablas de auditoría/etapas/adjuntos. No hay reconstrucción perfecta de ediciones históricas sin su propio timestamp: en tales casos queda fecha de ingreso sin segunda línea.

Se ignoran lecturas de página, abrir expedientes, descargar archivos, hover, navegación, sincronizaciones que no modifican campos, cambios solo de versión y operaciones en la cola de correos. La UI invalida las consultas de listado tras guardar borradores, editar/agregar/eliminar notas y subir/eliminar evidencias, siempre bajo el ámbito de sesión/visita vigente. El alta con su adjunto inicial próximo a `fecha` no se trata como actualización posterior.

## Orden y geometría

`fetchQuejas` filtra primero y ordena en PostgreSQL: `es_nuevo DESC, fecha_orden_actividad DESC, fecha DESC, id ASC` y solo **después** pagina en bloques de 25. Se mantiene orden estable al cambiar páginas, buscar o filtrar; Mis Quejas conserva `responsableId`.

`table-fixed` con `colgroup` 14/24/12/17/16/17, mínimo de 1200 px. Folio cede algo de anchura a Fecha de ingreso; Cliente se acerca a Folio. Estado único que se abrevia: «Pendiente de Revisión GC» → «Revisión GC». Es una transformación de presentación: valor persistido, color y flujo siguen siendo los mismos.

## Integración y verificación

Migraciones aplicadas en Supabase del proyecto: `20261115190000_quejas_directorio_actividad_relevante.sql`, `20261115194500_quejas_directorio_dias_operativos.sql` y `20261115200000_quejas_directorio_orden_eficiente.sql`. SQL de solo lectura verificó 156 casos, vista security_invoker, 9 triggers y 13 plazos con conteo business_days. El tercer cambio calcula el límite de «Nuevo» una vez por consulta y agrega un índice de eventos. El plan de consulta sobre 156 filas pasó de 120,6 ms a 23,3 ms en dos mediciones puntuales del entorno remoto: no es benchmark multiusuario ni promesa de escalabilidad.

Archivos: `lib/utils/quejaDeadline.ts`, `lib/utils/quejasListado.ts`, `components/quejas/QuejaFechaIngreso.tsx`, `lib/queries/useQuejas.ts`, y páginas de `app/quejas` y `app/mis-quejas`.

Pruebas dirigidas: `tests/queja-deadline.test.mjs`, `tests/quejas-directorio-actividad.test.mjs`, `tests/data-reliability.test.mjs` y `tests/pagination-active.test.mjs`. Antes de producción se requiere compilar, ejecutar Node, verificar cada estado con cuenta de rol real y probar los límites de días/feriados en navegador. **Una lectura SQL correcta no es prueba E2E ni evidencia de despliegue web.**
