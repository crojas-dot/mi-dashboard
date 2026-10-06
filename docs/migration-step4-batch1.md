> **Estado vigente (2026-10-05): migración completada.** React + Tailwind tw:, sin dependencias CoreUI/Bootstrap. Esta fase/inventario es histórico; seguir [patrones actuales](visual-patterns.md) y el [reporte final](tailwind-migration-complete.md).

# Paso 4 — lote 1: diez vistas/formularios

Fecha: 2026-10-05. El usuario autorizó procesar diez archivos y pausar para
continuar por lotes si la migración completa no cabe en una sola entrega.

## Archivos migrados

| Módulo | Vista | Formulario |
| --- | --- | --- |
| Procesos | `app/procesos/page.tsx` | `app/procesos/components/NuevoProcesoModal.tsx` |
| Auditorías | `app/auditorias/page.tsx` | `app/auditorias/components/NuevaAuditoriaModal.tsx` |
| Riesgos | `app/riesgos/page.tsx` | `app/riesgos/components/NuevoRiesgoModal.tsx` |
| Revisión por Dirección | `app/revision/page.tsx` | `app/revision/components/NuevaReunionModal.tsx` |
| Documentos | `app/documentos/page.tsx` | `app/documentos/components/NuevoDocumentoModal.tsx` |

Los diez archivos ya no importan CoreUI, adaptadores antiguos ni CSS Modules.
Todas sus clases literales usan `tw:`. Las tablas del kit renderizan etiquetas
HTML nativas (`table`, `thead`, `tbody`, `tr`, `th`, `td`); no hay CTable.

## Soporte añadido al UI kit

Archivos nuevos en `components/ui/tailwind/`: Select, Textarea, Table, EmptyState,
Pagination, ErrorState y Modal. Badge acepta los mapas existentes de tipo string
con fallback secondary seguro: no se cambiaron los mapas de estados de negocio.

Los formularios enlazan Label.htmlFor e Input/Select/Textarea.id. Los campos mantienen
value, onChange, required, type y opciones. Las grids pasan a una columna en móvil.
Los espaciados que Bootstrap imponía antes se traducen a su equivalente en Tailwind
(por ejemplo, su p-4 de 24px pasa a tw:p-6) para conservar la densidad visible.
La escala legible de 16px/14px se conserva con utilidades reales del kit; el tema
de las vistas migradas es claro, sin variantes dark huérfanas.

El modal nuevo usa dialog.showModal y portal al body: pila nativa, fondo inerte,
Escape, cierre, foco inicial/restauración y ciclo de Tab. El clic en el backdrop
solo cierra si comenzó fuera; arrastrar una selección al fondo no cierra el diálogo.
AuthenticatedLayout contiene una utilidad que bloquea el scroll del main mientras
hay un dialog modal abierto. El formulario sigue siendo dueño de su borrador y sus
handlers, por encima del portal. No se cambió DeferredMount ni la carga estática.

## Garantía de esta migración visual

`node scripts/audit-ui-migration.mjs` compara el AST actual de los diez archivos
con huellas SHA-256 tomadas antes de migrarlos. Verifica llamadas a hooks, atributos
onClick/onSubmit/onChange/onClose/onCreated y declaraciones de negocio, incluidos
los payloads de Supabase. Solo excluye imports, JSX y el mapa explícito de clases
de la matriz de riesgos. La comparación pasa sin cambios de lógica.

La referencia está en `tests/fixtures/step4-batch1-business.json`. Es una herramienta
de revisión para esta migración, no una prohibición permanente de desarrollar el
negocio. Si después se autoriza cambiar su lógica, revisar el diff y renovar la
referencia deliberadamente; no regenerarla para ocultar un fallo de migración.

## Validación

- Tests del proyecto, lint, check:styles y build de producción.
- Tests adicionales: ausencia de CoreUI/clases sin prefijo en el lote, enlaces
  label-control, atributos y semántica de tablas, filas interactivas por teclado,
  límites/busy de paginación y fallback de badges.
- Navegador con las páginas y formularios reales, datos y transporte ficticios:
  crear un proceso local, abrir hallazgos, editar versión documental local, filtrar
  documentos, cambiar probabilidad/impacto y abrir reuniones por Enter. Modales
  revisados con Escape, Tab, retorno de foco y fondo bloqueado; revisión móvil.
- La prueba local no escribe en Supabase. Los contratos de consultas y mutaciones
  permanecen intactos; no es una prueba de backend ni de concurrencia.

## Pendientes al pausar

El inventario completo se genera en `.performance/step4-remaining.json`, escaneando
`app`, `components`, `lib` y `hooks`. Al cerrar el lote hay 87 archivos TSX/JSX:
42 aún importan algún paquete CoreUI y 55 contienen clases sin prefijo o CSS Modules.
Son categorías que se solapan; no sumar ambas cifras como total de archivos.

Siguientes áreas: SACP, Quejas/Mis Quejas, Configuración/Usuarios, Dashboard/Charts,
Reportería/Login/formulario público, límites de error y adaptadores antiguos.
Conservar las dependencias y LegacyViewBoundary mientras haya consumidores.
Las tablas de Quejas/Mis Quejas y sus handlers no se modificaron en este lote.
Al completar los lotes: retirar el CSS generado y el puente CoreUI, el scope
legado y las dependencias sin consumidores; unificar la entrada Tailwind.
