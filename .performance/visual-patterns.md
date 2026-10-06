# Capa visual ECA-QMS — React + Tailwind v4

La migración está completa. CoreUI y Bootstrap ya no forman parte del runtime.
Se conserva su identidad corporativa mediante componentes React locales y clases
Tailwind con prefijo `tw:`. No reinstalar dependencias ni recrear adaptadores antiguos.

## Dónde editar

| Cambio | Lugar |
| --- | --- |
| Colores, contrastes, sombras y radios | `app/styles/tokens.css` |
| Alias de Tailwind y fuente | `app/styles/ui-kit.css` |
| Entrada CSS única | `app/globals.css` (importada por `app/layout.tsx`) |
| Componentes base | `components/ui/tailwind/` |
| Distribución particular de una vista | Su archivo `*.styles.ts`, junto al módulo |
| Menú lateral y encabezado | `components/Sidebar.tsx`, `components/Header.tsx` |
| Área autenticada y scroll | `components/AuthenticatedLayout.tsx` |
| Gráficas y paleta | `components/dashboard/Chart.tsx`, `ChartCanvas.tsx`, `chartColors.ts` |
| Datos y permisos | `lib/queries/`, `lib/services/`, `lib/store/`, `AuthShell.tsx`; separados de la apariencia |

## Reglas

- Usar únicamente utilidades `tw:`. Variantes después del prefijo: `tw:md:grid-cols-2`.
- Importar cada componente desde su archivo. No crear un barrel que cargue todo el sistema.
- `cn` combina `clsx` y `tailwind-merge` con el mismo prefijo; una clase explícita del consumidor sobrescribe el valor base.
- Preferir utilidades legibles (`tw:p-4`). Usar valores arbitrarios solo para geometría particular o selectores de contenido, por ejemplo `tw:w-[600px]`.
- Los tokens `--color-qms-*` son variables estables para utilidades y Chart.js. La marca es `#4257be`; la fuente es Inter.
- No introducir CSS Modules, clases Bootstrap ni otra hoja de Tailwind sin prefijo.
- Los estilos inline se reservan para valores calculados (altura/porcentaje/color de series). El error global conserva un respaldo inline si falla el layout/CSS.
- Mantener hooks, payloads, permisos y eventos fuera del kit. No convertir un error de consulta en una lista vacía.

## Patrón de vista

```tsx
import Button from '@/components/ui/tailwind/Button'
import { Card, CardHeader, CardContent } from '@/components/ui/tailwind/Card'
import Input from '@/components/ui/tailwind/Input'
import Label from '@/components/ui/tailwind/Label'

<Card>
  <CardHeader><h2 className="tw:m-0 tw:text-xl">Registros</h2></CardHeader>
  <CardContent>
    <Label htmlFor="registro-nombre">Nombre</Label>
    <Input id="registro-nombre" name="nombre" />
    <Button variant="primary" type="submit">Guardar</Button>
  </CardContent>
</Card>
```

El título de la ruta pertenece a `Header`. `PageHeader` solo organiza acciones
secundarias/volver: no añadir un segundo encabezado a Mis Quejas ni a su expediente.

## Interacción y rendimiento

- Formularios y expedientes habituales: import estático por ruta. `DeferredMount`
  aplaza solo el montaje y conserva la instancia; no introducir descarga al primer clic.
- `Modal` usa `<dialog>` y `showModal`: el navegador administra pila, fondo inerte y
  foco. Escape solicita cerrar al propietario; se respetan sus guardas mientras guarda.
  El cierre restaura foco y arrastrar texto hacia el fondo no cierra accidentalmente.
- `Popover` administra apertura, Escape y foco del menú de usuario/notificaciones.
- `Tabs` mantiene las acciones de la vista y admite flechas/Home/End por teclado.
- `Input`/`Label` deben compartir `id`/`htmlFor`; cada control de filtro requiere nombre accesible.
- Tablas nativas: mantener `tw:overscroll-contain`, `tw:[contain:paint]` y el scroll
  dentro de su contenedor. No sustituirlas por una librería pesada por motivos visuales.
- `Chart.tsx` carga `ChartCanvas` con `next/dynamic`, `ssr:false`. Reservar altura
  para evitar saltos; la implementación destruye Chart.js al desmontar.
- El informe imprimible usa `data-print-report`. No eliminar su aislamiento de impresión.

## Validación

```sh
npm run lint
npm test
npm run build
node scripts/check-visual-layer.mjs
node scripts/check-visual-layer.mjs --business
```

El último comando compara hooks/eventos con los contratos previos a la migración.
Si cambia la lógica deliberadamente, revisar y actualizar el fixture; no regenerarlo
para ocultar una diferencia. Las pruebas funcionales siguen verificando envíos
duplicados, respuestas tardías de IA, adjuntos y borradores.

Ver [reporte final](tailwind-migration-complete.md). Los informes de fases anteriores
son históricos: sus avisos de imports pendientes ya no describen el runtime actual.
