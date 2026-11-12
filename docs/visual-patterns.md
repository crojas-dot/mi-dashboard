# Capa visual ECA-QMS — guía del código activo

El panel utiliza React y Tailwind v4, sin Bootstrap ni CoreUI.
La referencia traducida inspira los controles y la distribución; no se instala
como otra biblioteca. El azul de marca es **#024796**.

## Dónde modificar cada cosa

| Cambio | Archivo |
| --- | --- |
| Colores, tamaños de texto, radios y sombras | `app/styles/theme.css`, bloque `@theme` |
| Recetas Tailwind compartidas de botones, campos y tablas | `app/styles/components.css` |
| Focus ring y reglas globales | `app/globals.css` |
| Props y comportamiento de los controles | `components/ui/`, un archivo por componente |
| Modal, Escape, foco y fondo inerte | `components/Modal.tsx` (`<dialog>` nativo) |
| Navegación de Configuración y guard de admin | `app/configuracion/page.tsx` |
| Editores de Configuración | `app/configuracion/components/*Settings.tsx` |
| Consultas y mutaciones de Configuración | `lib/queries/` y `lib/services/configuracionService.ts` |
| Validación de plazos y tipos de valores | `lib/utils/configuracion.ts` |
| Menú lateral y encabezado | `components/Sidebar.tsx` y `components/Header.tsx` |

Al igualar un color, inspeccionar el componente de referencia y reutilizar su token
semántico; no escoger un hex o una clase azul «parecida». Por ejemplo, Button primary
usa `qms-primary`; colores con nombres distintos pueden ser tonos distintos.

## Una única entrada Tailwind

`app/layout.tsx` importa `app/globals.css`. Esta importa Tailwind **sin prefijo**,
los tokens de `app/styles/theme.css` y las recetas en `app/styles/components.css`. No agregar CDN ni otra configuración
de Tailwind. `tailwind.config.ts` no es la fuente de los tokens de v4.
Los directorios de previews, experimentos y pruebas se excluyen del escaneo con
`@source not`, para que no generen clases adicionales en el CSS publicado.

Las guías de migración y `docs/historico/` documentan etapas anteriores; no
definen el CSS actual. El kit duplicado con prefijo y sus estilos huérfanos se
retiraron. No introducir un segundo kit, prefijo o helper `cn` de prototipos.

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
- Quejas y Mis Quejas muestran el fondo de estado configurado en `estado_color`
  mediante la paleta existente de Badge; sin metadata usan el mapa histórico de
  `lib/constants/estados.ts`. No copiar colores de una referencia externa.
  Los demás estados neutros mantienen `qms-neutral-soft` y texto `qms-dark`.
  `QuejaPlazoIndicator` representa el plazo calculado con un punto verde/ámbar/rojo
  y texto sin fondo. Completado/sin plazo usan punto gris; la fecha queda en el título.
  Prioridad, riesgo y roles conservan sus variantes semánticas.
- Switch admite nombres accesibles y atributos HTML; cada permiso necesita
  identificar rol, módulo y operación.
- Table conserva filas de 16px con padding vertical de 16px. Una fila con onClick
  también puede abrirse con Enter o Espacio, sin interceptar sus botones internos.
  Quejas y Mis Quejas comparten `ui-case-row`: la selección usa `qms-row-selected`,
  fondo #F0F4F7 elegido por el propietario. Sin contorno añadido ni
  cambio de alto; conserva el foco de teclado.
- Las etiquetas `ui-*` son utilidades de Tailwind v4, no clases Bootstrap.
  Las acciones nativas sencillas pueden usar las mismas recetas sin un wrapper.
- ConfirmDialog permite que sus acciones cambien de fila y que etiquetas largas
  ajusten al ancho disponible. Comprobar Cancelar y confirmar visibles a 320 px;
  no resolver el desborde recortando acciones con overflow-hidden.

Los fallbacks de ruta usan `components/RouteErrorFallback.tsx` y `ErrorState`:
mensaje seguro, alerta accesible y acción de reintento, sin emojis decorativos.
`global-error.tsx` sustituye el layout y declara documento, CSS y fuente propios.
La IA conserva sus acciones y etiquetas textuales; no usa robots, cerebros ni
destellos como adorno. Los iconos que identifican controles siguen disponibles.

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
- Quejas utiliza Modal variant="workspace" derecho (40vw, 100dvh, ampliable).
  En escritorio deja la tabla operativa; solo su ventana se recorta, sin recomponer
  columnas/buscador/filtros. Móvil y ampliado son modales nativos. No hay footer de
  lectura: ciclo/estado/acción quedan sticky. El scrollport del expediente se promueve
  a capa compuesta (`will-change: transform`) con fondo opaco, queda fuera de la barra
  `::-webkit-scrollbar` global (barra nativa `solid-color`, ancho normal y gutter estable) porque la personalizada se
  repinta en el hilo principal, y los laterales sticky llevan capa propia; así el
  desplazamiento al ampliar a todo el ancho no degrada. En ampliado no se compone
  velo (`backdrop:bg-transparent`) sobre el fondo opaco ya cubierto. Actividad
  (sheet de 420 px) y decisiones
  (document de altura fija, encabezado blanco) son diálogos superiores; Escape desde
  Tiptap cierra solo el superior. Solo Actividad carga comentarios/historial/correo.
  En el lateral de acciones, etiquetas largas envuelven dentro de la columna y los
  botones conservan un alto mínimo que puede crecer; no deben generar scroll horizontal
  ni recortar texto.
  Ver [contrato actual](quejas-panel-2026-10-13.md).
- Los scrolls interiores del modal (editores, listas y paneles) usan barras de 16px
  con pulgar cuadrado. La excepción nativa es el scrollport principal del expediente.
  Solo el workspace sin ampliar deja al pie el mismo fondo y margen del lienzo
  superior (12px en móvil, 16px desde sm). Su lienzo lleva un marco de 1px con las
  mismas esquinas redondeadas arriba y abajo; el borde inferior permanece visible
  al desplazar. Al ampliar no se añade ese marco ni margen. El expediente comienza con Descripción, sin el resumen
  superior de resultado ni la etiqueta Cliente encima;
  Mis Quejas prioriza Resolución en una tarjeta central amplia, sin bloques debajo.
  Notas es una tarjeta compacta bajo el cliente: cantidad/última fecha, y Ver notas
  abre un diálogo centrado (`variant="dialog"`) con lectura y alta. En contraído sigue
  visible sin mostrar el contacto. Adjuntar está en el encabezado, a la izquierda de
  Guardar/Editar, y abre el selector directamente. Los adjuntos se listan bajo el
  lienzo con `ListaAdjuntos layout="cards"`, también al editar, sin sheet aparte.
  Reciben las mismas lecturas del padre y conservan los borradores al cerrar.
  A la derecha quedan Acción actual y la devolución real de Calidad,
  en amarillo solo cuando existe; sin bloque de contexto, extractos ni decisión repetidos.
  Ver caso completo
  usa fondo rojo institucional `qms-brand-red`, hover blanco con texto/icono/borde
  rojos, y queda en Acción actual, encima del
  envío a GC; investigación omite la descripción
  redundante de esa tarjeta. Ese único acceso abre Análisis. Ver
  [investigación con consulta lateral](quejas-panel-2026-10-13.md#investigación-integrada-y-análisis-lateral--11-noviembre).
- En Mis Quejas y revisión de GC, el ciclo se presenta arriba en horizontal para
  ampliar el documento. Resolución se edita en la página, con Guardar junto a Asistencia
  secundaria; Guardar conserva un borrador remoto sin enviar a GC ni notificar al cliente.
  Guardar es azul solo con cambios. Tras confirmación muestra check y Guardado neutral
  deshabilitado, con fecha real en su título; no hay autoguardado ficticio.
  El lienzo mide hasta 720px de alto (70dvh, mínimo 420px), sin reducir la columna central.
  El envío queda siempre en Acción actual; no se duplica al pie del editor.
  Las tarjetas usan radios/tokens del sistema: azul para edición,
  amarillo para devolución y púrpura en el icono
  de notas. Los iconos Lucide son estáticos y decorativos junto a etiquetas accesibles.
  Análisis usa el mismo modal document/xl de procedencia (1040px máximos, 90dvh),
  centrado y nativo en todos los tamaños, sin ampliar el workspace al abrir.
  Primero muestra Observación de Calidad y Procede azul, después Descripción del
  cliente. Su pie ofrece Preparar resolución. Resolución contiene el scroll cuando
  el texto o su barra de formato tienen foco, incluso en los límites y estando vacío.
  Sin foco, desplaza el expediente; conserva el scroll interno y el ancho mediante
  gutter estable. El editor conserva su nodo y borrador
  al consultar. GC muestra primero la propuesta;
  Solicitud y antecedentes conserva el contenido íntegro en un desplegable.
  El selector de formato conserva su ancho explícito y la barra envuelve sus controles
  cuando hace falta, sin ocultarlos detrás de un scroll horizontal. El encabezado existente añade la fecha real, sin otra ficha grande. El resto
  conserva su ciclo lateral. Ver [composición y evidencia](quejas-resolucion-y-revision-gc-2026-11-03.md).
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
  permisos, mientras redirige y desde el primer instante de logout. Durante el
  bootstrap de una URL privada usa `SessionScreen neutral`: solo el fondo,
  sin barra, animación, silueta de login ni dashboard. Solo el módulo autorizado dibuja
  su propio skeleton de datos. No hay un WorkspaceSkeleton global.
- La variante login se usa en /login sin usuario, en logout o cuando el destino
  /login ya está confirmado. Redirecciones internas de una sesión válida usan la
  transición neutral. Acceso denegado conserva explicación estática y salida.
- Un único QueryProvider envuelve todas las ramas dentro de AuthShell. Su key por
  usuario/rol/vista remonta el ámbito de datos; el guard de sesión permanece fuera
  y no se remonta. Conservar caché del mismo usuario durante navegación/redirect,
  y vaciar el ámbito anterior al cambiar identidad/vista o salir.
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

RichTextEditor (Quejas): Tiptap lazy, toolbar accesible, minHeight 240 y 10.000 caracteres
persistibles. plain histórico permanece literal; markdown se habilita al editar y se
lee con RichTextContent sin HTML/links/imágenes. El plugin permite restaurar contenido
externo con emitUpdate:false, pero limita las transacciones de edición/pegado.
`layout="fill"` reserva el lienzo de decisión y desplaza únicamente el texto, con
`overscroll-contain` y capa compuesta en el scroll del lienzo (misma vía que el
scrollport del expediente).
toolbar/ayuda accesibles. Placeholder y primer bloque comparten el origen; el selector
de texto es Select del kit, con flecha y controles de la misma altura.
