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

## Encabezado y menús

- El perfil del encabezado usa un avatar de 40px y una flecha, con ancho estable.
  Las iniciales tienen interlineado de 1 y un ajuste óptico vertical de 1px para
  compensar el espacio de descendentes de la fuente al mostrar mayúsculas.
  El nombre completo aparece en su tooltip/nombre accesible y dentro del menú,
  junto al correo y rol. Nombre y correo pueden ocupar varias líneas; no recortar
  ni abreviar nombres guardados para resolver el espacio del encabezado.
- Menú de cuenta: 320px en escritorio. Notificaciones: 400px, mensajes de 14px
  y fechas de 12px sin segundos. El contador visual llega a `99+`, conservando
  la cantidad exacta en el nombre accesible de la campana.
- En móvil los paneles se posicionan bajo el encabezado con 12px de margen a
  cada lado y altura limitada al viewport. Sus listas hacen scroll interno.
- Las notificaciones usan botones separados para abrir/marcar y para archivar;
  archivar no debe navegar. Escape devuelve el foco al botón que abrió el panel.
  El pie aclara cuando se muestran solo las 15 notificaciones más recientes.

## Pantallas pequeñas

- Por debajo de 1024px la navegación usa `Modal variant="drawer"`: panel lateral
  pegado al borde izquierdo, de altura `100dvh`, sin marcos ni padding anidados.
  Solo la lista de enlaces hace scroll. Conserva permisos, fondo inerte, bloqueo
  del scroll de la página, cierre por Escape/fondo y retorno del foco al disparador.
- Los diálogos mantienen Tab y Shift+Tab dentro de sus controles visibles.
- `QuejasToolbar` adapta su cuadrícula al ancho del módulo mediante container
  queries: buscador completo, dos filtros iguales y acción de ancho completo en
  móvil; una fila al disponer de 860px. Controles móviles de 44px de altura.
- PageHeader extiende las acciones principales en móvil; Pagination mantiene
  anterior, estado y siguiente en una fila, con iconos y nombres accesibles.
- Las tablas compartidas conservan un mínimo de 640px y scroll horizontal local
  para evitar columnas ilegibles. No permitir que ensanchen la página completa.
- Usuarios usa filtros en cuadrícula; las pestañas de Documentos pueden saltar
  de fila. El panel de Mis Quejas ocupa el viewport móvil y conserva los 500px
  y la reserva de espacio únicamente desde el breakpoint `lg`.
- Revisión por Dirección indica acta `Pendiente`/`Registrada` con iconos estáticos.
  Reservar la animación de carga para operaciones en curso, no estados permanentes.

## Sesión y carga inicial

- `AuthShell` bloquea el montaje de contenido privado antes de validar usuario y
  permisos, mientras redirige y desde el primer instante de logout. Mostrar solo
  `SessionScreen`: skeleton del espacio de trabajo o del formulario de login,
  nunca el dashboard sin su shell. Son formas decorativas sin datos, nombres,
  cifras, enlaces ni controles activos. Durante logout usa el skeleton de login.
  Acceso denegado conserva una tarjeta estática con explicación y salida.
- La misma regla se aplica al HTML inicial de producción y a rutas sin permiso.
  La autorización de datos sigue siendo responsabilidad de API y RLS.
- La pulsación suave es CSS, respeta movimiento reducido y usa un número fijo de
  formas; no crear animaciones por registro ni temporizadores de animación JS.
  Los mensajes normales de carga son solo para lectores de pantalla.
  No retrasar artificialmente la transición.
  Después de 10 s de espera, Reintentar recarga la página y vuelve a comprobar
  identidad/perfil/permisos; no habilita el dashboard. Botones de al menos 44px.
- Si se recarga durante un cierre de sesión pendiente, se continúa el cierre.
  La marca de bloqueo no contiene información de cuenta y no concede permisos.
- El dashboard usa `DashboardLoading` con variantes summary/modules/table/activity:
  skeleton proporcional a cada bloque, círculos de gráficos y líneas cortas.
  Conservar la carga independiente por bloque, no agregar un segundo marco dentro
  de una tarjeta que ya tiene encabezado ni esperar a que terminen todos los bloques.
  `components/ui/Skeleton` solo dibuja formas; no consulta datos ni permisos.
- `LoadingSkeleton` es la carga inicial compartida de los módulos activos: table
  para listados/permisos, form para ajustes/formulario público, cards para IA y
  list para historial, hallazgos, comentarios y evidencias. Cinco filas de tabla
  o tres elementos/tarjetas como máximo, independientes del número de registros.
  Usar `framed={false}` dentro de un panel que ya tiene borde. No agregar spinners
  sueltos ni mensajes visibles a esas cargas. Dashboard delega table/activity aquí.
- Reservar `Spinner` para guardar, subir, descargar, sincronizar o analizar.
  Caja estable de 14/16/24px, centrada en ambos ejes, sin deformar texto ni botones;
  giro CSS solo con movimiento permitido. `Button loading` lo incorpora y conserva
  disabled, aria-busy y anuncio accesible. `OperationLoading` centra icono y texto
  dentro del área de informes/preview para operaciones más largas.
- La navegación precarga por intención de hover, foco o tacto con el mismo debounce
  de 80ms y caché compartida. Mis Quejas usa siempre el responsable propio; sin id
  no precargar una consulta general. Conservar permisos, ámbitos por usuario/vista,
  plazos de caché y actualización en segundo plano: no ampliar staleTime global
  para aparentar rapidez ni esperar a terminar todos los bloques.

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
