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
2. Distribución horizontal 11/22/12/16/18/21, tabla fija con mínimo 1100 px original. Se ajustó la referencia 13 % de Folio porque aumentaba su ancho respecto de la base; 11 % acerca Cliente y deja 21 % a Fecha. Nombres habituales caben. Ocho escenarios mantienen altura, densidad y desbordamiento original.
3. Encabezado «Fecha de ingreso», con fecha DD/MM/AAAA. Ocho escenarios sin regresión de medidas; TypeScript verificado.
4. Componente compartido `QuejaFechaIngreso`: segunda línea de 14px/16px en el espacio interior original, sin padding ni altura nuevos. Ocho escenarios mantienen exactamente 58.390625px por fila; «Actualización: hace 30 días» permanece en una línea. La lógica real se conecta en la etapa siguiente.
5–6. **Implementado en código y DB**: «Nuevo» dos días hábiles con calendario del run, «Actualización» por cambios relevantes, exclusión de lecturas y guardados sin cambios. La función y sus triggers fueron probados en PostgreSQL temporal y aplicados sin alterar expedientes.
7. **Implementado en código**: orden descendente por última actividad relevante, fecha de ingreso e ID, antes del límite/paginación. La vista invoker conserva RLS.
8. **Implementado y probado**: «Completado» y «Sin plazo» grises, «Vence mañana» verde, «Vence hoy» y «Vencido» rojos, usando fechas civiles de Costa Rica; el plazo histórico se conserva.
9. **Implementado en código**: filtro Plazo en Quejas y búsqueda de folio/Estado en Mis Quejas. «Nueva queja» solo está visible cuando el rol tiene permiso efectivo; el RPC no permite altas a colaboradores sin autorización.

## Activación y verificaciones del 16/11/2026

- Migraciones aplicadas al proyecto Supabase existente y registradas como `20261116180852_quejas_bandeja_actividad` y `20261116180929_quejas_bandeja_movimientos`. Los archivos del repositorio usan esas versiones para evitar reaplicaciones.
- Vista `qms_quejas_bandeja` con `security_invoker=true`, tabla auxiliar con RLS y select para autenticados, sin permiso anónimo ni escritura de cliente; nueve triggers; tabla registrada en Realtime.
- Comprobación de base: 156 registros originales, 156 en la vista, 156 en el resumen de actividad, 63 con contexto de actualización y ninguna etiqueta «Nuevo» actualmente. Consulta de primera página: ~45 ms en PostgreSQL (EXPLAIN ANALYZE; no mide latencia total).
- Ejecución real bajo rol PostgreSQL `authenticated` con un perfil administrador activo: 156 registros visibles, 63 contextos presentes y 156 categorías de Plazo válidas. RLS de colaboradores probado con identidades ficticias en PostgreSQL aislado; actualmente no había perfiles activos de colaborador con auth_id para repetir esa prueba sobre datos reales.
- GitHub Actions «Verificación de bandeja Quejas»: TypeScript, ESLint, regresión Node, migraciones/aislamiento en PostgreSQL 17 y build **correctos**. El workflow general «CaseWorkspace» sigue fallando por tres tests de Usuarios no modificados por esta intervención.
- Vercel Preview `fix/quejas-bandeja-etapas-5-9-20261116` publicado y build READY. Sigue pendiente revisión visual autenticada de ambas tablas con dos líneas, densidad y navegador; sin cambio en `main`.

La aprobación visual, las pruebas y la publicación en producción son evidencias distintas. **No fusionar el PR sin validar la pantalla autenticada tras activar las migraciones.**
