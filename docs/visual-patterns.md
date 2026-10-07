# Capa visual ECA-QMS — guía del código activo

El panel utiliza React y Tailwind v4, sin Bootstrap ni CoreUI.
La referencia traducida inspira los controles y la distribución; no se instala
como otra biblioteca. El azul de marca es **#024796**.

## Dónde modificar cada cosa

| Cambio | Archivo |
| --- | --- |
| Colores, tamaños de texto, radios y sombras | `app/globals.css`, bloque `@theme` |
| Recetas Tailwind compartidas de botones, campos y tablas | `app/styles/components.css` |
| Focus ring de todos los controles | `@utility focus-ring` en `app/globals.css` |
| Props y comportamiento de los controles | `components/ui/`, un archivo por componente |
| Modal, Escape, foco y fondo inerte | `components/Modal.tsx` (`<dialog>` nativo) |
| Navegación de Configuración y guard de admin | `app/configuracion/page.tsx` |
| Editores de Configuración | `app/configuracion/components/*Settings.tsx` |
| Consultas y mutaciones de Configuración | `lib/queries/` y `lib/services/configuracionService.ts` |
| Validación de plazos y tipos de valores | `lib/utils/configuracion.ts` |
| Menú lateral y encabezado | `components/Sidebar.tsx` y `components/Header.tsx` |

## Una única entrada Tailwind

`app/layout.tsx` importa `app/globals.css`. Esta importa Tailwind **sin prefijo**
y las recetas en `app/styles/components.css`. No agregar CDN ni otra configuración
de Tailwind. `tailwind.config.ts` no es la fuente de los tokens de v4.
Los directorios de previews, experimentos y pruebas se excluyen del escaneo con
`@source not`, para que no generen clases adicionales en el CSS publicado.

La carpeta `components/ui/tailwind/`, los archivos con clases `tw:` y las guías de
la migración anterior se conservan como prototipos históricos. No están conectados
a la entrada CSS del panel activo. No usarlos como base de nuevas vistas ni
importar su `cn`, que requiere dependencias ajenas al kit activo.

## Componentes y recetas

Importar archivos directamente; no crear un barrel que cargue todo el sistema.
Los componentes conservan atributos HTML/ARIA, `ref`, eventos y estado disabled.

```tsx
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Field from '@/components/ui/Field'

<Field id="nombre" label="Nombre">
  <Input id="nombre" required value={nombre} onChange={event => setNombre(event.target.value)} />
</Field>
<Button type="submit" loading={guardando}>Guardar cambios</Button>
<Button variant="secondary" onClick={cancelar}>Cancelar</Button>
<Button variant="danger" onClick={pedirConfirmacion}>Eliminar</Button>
```

- Button: variantes primary, secondary, danger, ghost y link; tamaños sm, md, lg e icon.
  `type="button"` por defecto. Loading deshabilita el botón y anuncia su estado.
- Input, Textarea y Select comparten `ui-field` y el focus ring global.
  Field exige `id` y `label`; enlazar `aria-describedby` cuando haya una ayuda.
- Login añade `ui-login-field`: texto, placeholder y primera línea de 16px con
  la fuente heredada. Chromium fuerza otra fuente en su vista previa interna;
  el formulario habilita ambos campos al recibir foco o pointerdown para evitar
  esa vista previa al cargar. Conservar `username`/`current-password` para el
  gestor de contraseñas y comprobar clic, Tab y validación de campos vacíos.
- Badge conserva el tamaño de las etiquetas de Quejas. Ámbar usa texto oscuro
  para mayor contraste; naranja distingue una prioridad alta.
- Switch admite nombres accesibles y atributos HTML; cada permiso necesita
  identificar rol, módulo y operación.
- Table conserva filas de 16px con padding vertical de 16px. Una fila con onClick
  también puede abrirse con Enter o Espacio, sin interceptar sus botones internos.
- Las etiquetas `ui-*` son utilidades de Tailwind v4, no clases Bootstrap.
  Las acciones nativas sencillas pueden usar las mismas recetas sin un wrapper.

## Configuración

La navegación agrupa Organización, Acceso y Servicios. Cada sección tiene un
título, una explicación y un editor propio; la página no contiene escrituras SQL.

`DeferredMount` monta una sección en su primera visita y después conserva su
instancia y borradores. Sus consultas usan `enabled: active`; las secciones ocultas
no bloquean las visibles. Los imports son estáticos para evitar esperas de descarga
al primer clic. La configuración de IA se consulta al abrir su sección.

- Catálogos administra también valores inactivos. NULL equivale a activo.
  La edición conserva el módulo/tipo original; eliminar requiere confirmación.
- Plazos exige días enteros, alerta >= 0, vencimiento >= 1 y alerta <= vencimiento.
- General conserva el tipo JSON original y solo actualiza el valor. Los ajustes
  ai_* pertenecen al gestor de IA y no se editan desde General.
- Formularios confirma eliminaciones y solo anuncia copia después de que el
  portapapeles confirme la operación.
- Permisos bloquea operaciones concurrentes y exige Ver antes de Editar.
  El administrador conserva Configuración.
- Vista por rol cambia la presentación y no el rol de autenticación ni la RLS.

La base de datos sigue aplicando Auth y RLS. Ningún componente de UI debe importar
`lib/server/*`, credenciales o clientes de service role. No cambiar permisos reales
para resolver un problema visual.

## Validación

```sh
npx tsc --noEmit
npm run lint
node --test tests/configuracion-foundation.test.mjs
npm run build
node scripts/check-visual-layer.mjs
```

La suite global contiene pruebas de prototipos y contratos anteriores; comparar
sus fallos con el estado previo antes de atribuirlos a un cambio. No regenerar
fixtures ni instalar dependencias de los prototipos para hacerla pasar.
Probar pantallas estrechas, navegación con teclado, errores de carga, guardados
duplicados y cierre de modales. Los previews usan datos locales, nunca claves reales.
