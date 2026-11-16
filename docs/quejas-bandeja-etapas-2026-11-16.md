# Tablas Quejas / Mis Quejas — implementación por etapas

Especificación del propietario: `especificacion_desde_cero_quejas_mis_quejas_actualizada.md`.
Base limpia: `8261a03`. Rama de trabajo: `codex/quejas-bandeja-etapas-20261116`.
No se recuperó código de implementaciones anteriores.

## Base y método

- Páginas y CSS reales en localhost con datos sintéticos; ninguna escritura de expedientes, usuarios o correos para QA.
- Línea base: ocho escenarios (ambas tablas a 1536, 1920, 1280 y 390 px), filas de **58.390625 px** en todos los estados.
- A 1536 × 824: 9 filas completas en Quejas y 10 en Mis Quejas. A 1920 × 1080: 14 y 15.
- Ancho mínimo existente: 1100 px. Los viewports pequeños ya tienen desplazamiento local horizontal; no añadir desbordamiento.
- Evidencia local: `.performance/quejas-etapas-20261116/`, métricas JSON y capturas completas por etapa.
- La base no rellenaba con cero los días de una cifra. Se corrige únicamente la presentación a DD/MM/AAAA, en Costa Rica, antes de las demás etapas.
- Los escenarios de navegador verifican presentación/interacciones de las páginas con transporte simulado; no constituyen E2E autenticado de Supabase.

## Etapas

0. Base medida; fecha numérica normalizada. Ocho escenarios sin cambios de altura, filas visibles ni desbordamiento; fecha CR comprobada en cruce de medianoche UTC.
1. «Revisión GC» solo en las dos tablas. Conserva ID, filtros y color. Ocho escenarios sin variación de altura/densidad/desbordamiento.
2. Distribución horizontal: pendiente.
3. Encabezado Fecha de ingreso: pendiente.
4. Segunda línea sin aumentar altura: pendiente.
5–6. Nuevo y actividad relevante: pendiente.
7. Orden antes de paginar: pendiente.
8. Plazo estable y semáforo: pendiente.
9. Filtro Plazo en Quejas: pendiente.

La aprobación del diseño, la ejecución de pruebas y la publicación son evidencias distintas. Este trabajo no autoriza publicar la web.
