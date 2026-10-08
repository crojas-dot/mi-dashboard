> Archivo histórico archivado el 8 de octubre de 2026. Conserva la evidencia y las decisiones de su etapa; los imports/componentes descritos pueden haber sido retirados. Para editar hoy, seguir [el mapa de arquitectura](../arquitectura/README.md) y [los patrones vigentes](../visual-patterns.md).

# Paso 5 — limpieza segura, pendiente de completar la migración

Fecha: 2026-10-05.

`@coreui/react` y `@coreui/coreui` ya no figuran como dependencias directas en
package.json/package-lock.json. `@coreui/react` tampoco está instalado localmente.
La migración de vistas sigue en el lote 1 de diez archivos; la limpieza final
completa todavía no puede hacerse sin quitar estilos y componentes en uso.

## Archivos eliminados

- `scripts/scope-coreui.mjs`: generación/verificación del CSS retirado del paquete.
- `scripts/generate-coreui-theme.mjs`: generador anterior sin consumidores activos.
- `scripts/visual-check.mjs`: fixture obsoleto que leía CSS y fuentes inexistentes.
- `scripts/visual-check/entry.jsx`: entrada usada únicamente por ese fixture.
- `components/ui/Card.tsx`: adaptador CoreUI sin imports en app/components/lib/hooks.
- `tailwind.config.ts`: configuración vacía de plugins, sin @config ni consumidores;
  Tailwind v4 se configura en CSS.

También se retiraron `styles:coreui` y `check:styles` de package.json y el bloque
experimental.optimizePackageImports de CoreUI en next.config.ts. Los headers de
seguridad y las demás opciones permanecen iguales. No se reinstalaron paquetes.

## Archivos conservados por uso activo

`app/coreui-scoped.css` y `app/styles/coreui-bridge.css`, sus imports en globals.css,
la entrada Tailwind sin prefijo y LegacyViewBoundary siguen atendiendo las vistas
no migradas. Actualmente también hay CSS Modules que dependen de variables --cui-*.
Borrarlos ahora no completa la migración: deja esos consumidores sin sus estilos.

Los adaptadores antiguos Button, Badge, Select, Switch, Table, Pagination, PageHeader,
EmptyState, ErrorState e icons siguen importados por código activo. Por ejemplo:
Badge tiene 16 consumidores, Button 15 y ErrorState 18. DeferredMount es un controlador
de montaje vigente, no un adaptador CoreUI, y se conserva.

## Estado pendiente y comprobaciones

Inventario actual: 86 archivos TSX/JSX, 41 con imports de paquetes CoreUI y 54
con clases sin prefijo o CSS Modules (categorías solapadas).
Lint y las 18 pruebas focalizadas del kit/shell/lote 1 pasan. El build falla con
40 errores de resolución de @coreui/react. La suite completa falla en pruebas de
adaptadores antiguos (ErrorState, Button y Pagination) por MODULE_NOT_FOUND.
No se ocultaron esos errores cambiando imports de los tests ni reinstalando CoreUI.

- `node scripts/audit-ui-migration.mjs` mantiene intactas las huellas de hooks,
  eventos y declaraciones de negocio del lote 1 y regenera el inventario restante.
- `@coreui/react` continúa importado directamente desde Login, Dashboard, Quejas,
  Configuración, Usuarios y otros componentes. Su desinstalación deja imports sin
  resolver: no asumir que una instalación limpia ni el build están sanos.
- No hay un flujo único de Tailwind aún. El kit tw: y el Tailwind sin prefijo se
  compilan separadamente; mezclarlos en una misma compilación con prefix(tw) o quitar
  el segundo antes de migrar sus consumidores rompe las clases pendientes.

La siguiente acción necesaria es terminar las vistas y adaptadores del paso 4.
Después se podrán eliminar los dos CSS, la frontera de compatibilidad, los
adaptadores restantes y los paquetes CoreUI de iconos/gráficas/utilidades que aún
se usan. En ese momento se consolidará Tailwind en una sola entrada prefijada con
tokens, Preflight y reglas generales. Eliminar CSS no reemplaza componentes React.
