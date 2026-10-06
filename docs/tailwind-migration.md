> **Estado vigente (2026-10-05): migración completada.** React + Tailwind tw:, sin dependencias CoreUI/Bootstrap. Esta fase/inventario es histórico; seguir [patrones actuales](visual-patterns.md) y el [reporte final](tailwind-migration-complete.md).

# Migración progresiva a Tailwind — pasos 1, 2 y 3

**Paso 5 solicitado:** se retiraron scripts/configuración obsoletos y el Card viejo
sin consumidores. El CSS y los adaptadores activos siguen pendientes; los paquetes
react/coreui fueron desinstalados con imports restantes. Ver
[estado de la limpieza](cleanup-step5-status.md). No ejecutar check:styles/styles:coreui.

La decisión del usuario del 5 de octubre de 2026 sustituye la obligación anterior
de mantener el híbrido. Objetivo: React propio + Tailwind, conservando la identidad
CoreUI. El shell está migrado; las vistas se migrarán en etapas posteriores.

**Paso 4 iniciado:** cinco módulos (Procesos, Auditorías, Riesgos, Revisión y
Documentos) y sus cinco formularios ya usan el kit Tailwind. Ver el
[inventario y validación del lote 1](migration-step4-batch1.md). El resto queda
pendiente de la siguiente instrucción «continúa» del usuario.

## Estado actual

Implementados: tokens, Button, Card/CardHeader/CardContent/CardFooter, Badge, Input,
Label y cn. Instalados clsx y tailwind-merge. Los componentes antiguos siguen
atendiendo las vistas existentes hasta migrarlas explícitamente. No se ha retirado
ninguna dependencia que esas pantallas aún necesitan.

Paso 3 implementado: Sidebar, Header y AuthenticatedLayout usan únicamente clases
`tw:` y React/HTML propios. Sus desplegables usan Popover, Button, Badge y Switch
del kit; iconos Lucide. Se retiraron los CSS Modules del shell. El formulario de
cambio de contraseña conserva su modal existente (su migración corresponde al paso 4).
Ese modal se monta como hermano del header para quedar por encima del sidebar;
cerrar el desplegable al abrirlo conserva el trigger como destino del foco.

## Contrato del shell

- `Sidebar.tsx`: fijo a la izquierda, ancho 256px; riel de 64px con despliegue
  superpuesto por hover/foco visible de teclado. El foco de un clic no deja el
  riel abierto al retirar el cursor; la flecha no se desplaza al hacer hover.
  Mantiene permisos, grupos persistidos,
  rutas activas y prefetch por hover/foco con las mismas claves y funciones.
- `Header.tsx`: toolbar de 64px, breadcrumb y acción de ruta. Hamburguesa de
  escritorio conserva toggleHidden; la flecha del pie conserva toggleCollapsed.
  Realtime, sonidos, preferencias, notificaciones y logout siguen en sus handlers.
- `useMobileNavigation` conserva el umbral 992px; las variantes Tailwind del shell
  usan ese mismo umbral. En móvil el menú está cerrado inicialmente. Un `<dialog>`
  nativo abierto con showModal vuelve inerte el fondo; Escape, cierre, navegación
  y backdrop actualizan mobileOpen. Tab envuelve los controles visibles y el
  navegador restaura el foco al trigger. Main bloquea scroll mientras está abierto.
- `AuthenticatedLayout.tsx` reserva 256/64/0px mediante utilidades, sin variables
  CoreUI ni animación del contenido. Fondo de la paleta y padding 16px móvil/24px
  escritorio. Enlace «Saltar al contenido» disponible por teclado.
- `Popover.tsx` es un panel no modal, con aria-expanded/controls/haspopup, foco
  inicial, Escape y retorno al trigger, cierre al salir por Tab o clic exterior.
  Recupera foco si una acción elimina su propio botón. A menos de 640px se ubica
  a 16px de los bordes del viewport para evitar desbordar junto a la campana.
- **Frontera de compatibilidad:** AuthShell mantiene todos sus guards sin cambios
  y envuelve solo las vistas pendientes en LegacyViewBoundary. Su clase
  `coreui-scope` es un marcador del CSS legado; no pertenece al shell Tailwind.
  No eliminar esa frontera hasta migrar las vistas del paso 4. Los modales actuales
  ya tienen su scope propio. No extender el scope a Sidebar/Header.

Comprobado: grupos/permisos/prefetch y callbacks con pruebas automáticas; en navegador
con datos ficticios se revisaron escritorio (1280px) y móvil (390px), ocultar/riel,
navegación, Escape, ciclo de Tab, lectura de notificaciones, ajustes de sonido y
desplegables dentro del viewport. Esta comprobación no escribe en Supabase ni
sustituye una prueba autenticada con los datos reales del entorno.

## Configuración y separación

Tailwind v4 usa CSS-first; se eliminó `tailwind.config.ts`, que solo tenía plugins vacíos.
`app/styles/tokens.css` publica la paleta y los radios con `@theme static`.
`app/styles/ui-kit.css` se compila como entrada independiente desde el layout:
usa `prefix(tw)` y reutiliza los tokens mediante `@theme inline`. No importarlo desde
globals.css: allí sigue compilándose el Tailwind sin prefijo de las vistas antiguas.

El kit no duplica Preflight. `tw:p-4` significa 16px con la escala de 4px; Bootstrap
no tiene ese selector, por lo que no puede sustituirlo con su `p-4 !important` de
24px. Todos los className nuevos usan el prefijo, también sus variantes:
`tw:hover:bg-primary-hover`, `tw:md:grid-cols-2`. No pasar utilidades sin prefijo
al kit: cn no las convierte automáticamente y volverían a traer las colisiones.

Inter se carga con next/font y se expone como `--font-qms-inter`. Los nuevos
componentes usan `tw:font-sans`. Botones/inputs: rounded-md (6px); tarjetas y
futuros modales: rounded-lg (8px). Cambiar radios aquí no modifica los antiguos.
La marca #4257be es compartida. Danger usa un rojo más oscuro para texto blanco.

## Uso

```tsx
import Button from '@/components/ui/tailwind/Button'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/tailwind/Card'
import Badge from '@/components/ui/tailwind/Badge'
import Input from '@/components/ui/tailwind/Input'
import Label from '@/components/ui/tailwind/Label'

// Ejemplo de presentación; los handlers pertenecen al formulario real.
<Card aria-labelledby="queja-title">
  <CardHeader>
    <h2 id="queja-title" className="tw:m-0 tw:text-base tw:font-semibold">Queja</h2>
    <Badge variant="success">Resuelto</Badge>
  </CardHeader>
  <CardContent className="tw:space-y-2">
    <Label htmlFor="cliente">Persona o empresa</Label>
    <Input id="cliente" name="cliente" autoComplete="organization" required />
  </CardContent>
  <CardFooter>
    <Button variant="secondary">Cancelar</Button>
    <Button type="submit">Guardar</Button>
  </CardFooter>
</Card>
```

Para errores, usar `aria-invalid` y `aria-describedby` hacia un mensaje específico
visible. Label necesita htmlFor correspondiente al id del campo. Botones con solo
icono necesitan aria-label; los iconos decorativos llevan aria-hidden.
Loading bloquea el botón y anuncia un estado sin sustituir el nombre visible.
Los botones nativos soportan Enter/Espacio y conservan ref/atributos/eventos.

Card es un contenedor compuesto: no recibe title/action/bodyClassName como el
adaptador antiguo. Extraer esa estructura al migrar cada consumidor. Badge acepta
aliases de colores históricos, pero la nueva API es primary/secondary/danger/
success/warning/info. Input.size define sm/md/lg; htmlSize preserva el atributo HTML.

## Etapas pendientes

4. Migrar vistas una a una: formularios, tablas y modales, preservando consultas,
   estados de carga/error, foco y acciones. Las tablas de Quejas/Mis Quejas siguen
   siendo HTML nativo y mantienen la contención de scroll hasta su refactor visual.
5. Tras comprobar cero consumidores: retirar CSS CoreUI/puente, adaptadores antiguos,
   iconos y wrappers de gráficas CoreUI, configuración de optimización asociada y
   dependencias. Chart.js puede seguir siendo independiente. Unificar la entrada
   Tailwind y eliminar la entrada sin prefijo cuando no queden consumidores.

No se atribuye una mejora de velocidad a un kit todavía sin consumidores. Medir
con builds comparables tras migrar vistas y retirar dependencias.

Referencias: [Tailwind: importaciones sin Preflight y prefijos](https://tailwindcss.com/docs/preflight),
[Tailwind: variables de tema](https://tailwindcss.com/docs/theme).
