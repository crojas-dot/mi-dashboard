# Apariencia: fuentes y particularidades

Contrato vigente del diseño aprobado; la guía general del kit es
[visual-patterns.md](../visual-patterns.md). Usar [mapa de edición](README.md)
para ubicar componentes. No recuperar las pruebas descartadas.

## Fuentes activas

- app/layout.tsx importa únicamente app/globals.css; esta importa Tailwind v4 sin prefijo, app/styles/theme.css y app/styles/components.css.
- @theme en app/styles/theme.css define colores, fuente, escala, radios y sombras. Las recetas ui-* están en app/styles/components.css; las utilidades globales están en app/globals.css.
- Inter llega por next/font; escala actual: text-xs 14px, text-sm 15px, text-base 16px. Fuente de filas operativas: 16px.
- Marca #024796, hover #013b7d, fondo #f4f7f6, surface blanco, borde #dee2e6 y header de tabla #F0F2F5. Quejas/Mis Quejas leen `estado_color` del catálogo para el fondo de Badge y conservan el mapa histórico como fallback; paleta en lib/constants/badges.ts. Los demás estados neutros conservan `qms-neutral-soft` (aprox. #F0EFEF) y texto `qms-dark` (#212529). QuejaPlazoIndicator comparte el semáforo de plazo (punto y texto sin fondo; gris cuando no hay plazo activo). Los colores persistidos, fechas y reglas no cambian.
- Button/campos: 40px mínimos, sm 32px; controles móviles principales 44px. Radios de botón 4px, panel/modal 6px.
- Sidebar desktop 250px/64px colapsado desde lg; móvil drawer hasta 320px sin marcos anidados. Shell h-dvh con scroll propio del main.
- Marca del Sidebar: el hueco de 40px (mismo tamaño y padding que el avatar de Header) muestra el logo institucional sin fondo ni máscara circular —un PNG conserva su transparencia— o, si no hay logo, la inicial «E» dentro de un círculo azul; `EmpresaLogo` vuelve a la inicial si la URL falla. La fila de marca mide h-14 y, en el menú de escritorio, la línea divisoria es un hr corto e independiente de la que usa el encabezado móvil. El recorte del editor es cuadrado y sin esquinas redondeadas, para que la vista previa coincida con el resultado.
- Body usa select-none; tablas y contenido que debe copiarse usan select-text. globals.css define scrollbars e impresión; .informe-content delimita el informe.

## Contratos que no se deben romper

- Avatar de Header: 40px, iniciales con leading de 1 y ajuste óptico vertical de 1px; nombre/correo completos dentro del menú, sin recortar datos guardados. El menú de cuenta solo ofrece «Mi perfil» y «Cerrar sesión»; «Mi perfil» abre el modal personal (nombre, contraseña y preferencias) con pestañas Detalles/Seguridad/Notificaciones.
- Login: conservar username/current-password y desbloqueo de readonly por foco/pointerdown; arregla la vista previa Chromium sin desactivar autocompletado.
- Antes de verificar una URL privada, solo fondo neutral; no presentar barra, login ni shell de dashboard. Login/logout usa skeleton de login cuando corresponde; datos pendientes del módulo usan solo su carga propia.
- Skeletons fijos CSS y movimiento reducido; Spinner solo en operaciones. Sin espera mínima ni círculo permanente por registro o Acta Pendiente.
- Modal mantiene dialog nativo, top layer, Tab/Shift+Tab, foco y scroll lock de modales anidados. Escape/fondo cierran por defecto; dismissOnEscape/dismissOnBackdrop permiten exigir X en una vista concreta.
- Clases dark: pueden existir, pero no hay selector completo de tema integrado. QuejasSummary dibuja SVG puro y no carga librerías de gráficos.

Catálogos usa `COLORES_CATALOGO` de `lib/constants/badges.ts`: primary, info, success,
warning, danger y secondary son códigos DB; sus etiquetas y estilos se resuelven
en la misma fuente. El editor y el servicio validan esas opciones antes de escribir.
No guardar nombres de variantes visuales ni hex en ese campo. La resolución de
Quejas depende de su estado, nunca del color de su badge.

Cada regla de tamaños y variantes vive en los tokens/kit; no copiar paletas o CSS
por página para resolver un ajuste local. Revisar componentes montados y el CSS
importado antes de modificar archivos similares de una etapa anterior.

## Identidad, carga y navegación

- El logo lateral y el botón de menú comparten el control de expansión. En
  móvil el logo cierra el menú abierto. Dashboard usa velocímetro, Reportería
  un informe con gráfico y Configuración un engranaje.
- Menú y login conservan el isotipo ECA local hasta que carga su imagen
  personalizada. Identidad administra «Logo del inicio de sesión» por separado.
  Su recuadro conserva 56 px y el fondo azul del sistema. El servidor lee fondo
  y logo del login en una sola consulta. El cliente consulta si esa lectura falla.
- Fondo de login y formularios: `FondoIdentidad` y `.ui-auth-card` comparten
  el fondo, blanco al 96 %, borde y sombra. El formulario en `/q/[token]`
  usa scroll de página. Solo `?embed=1` permite la vista transparente y
  comunica su altura al origen WordPress configurado por `ALLOWED_FRAME_ORIGIN`.
- Los paneles contraído y ampliado de Quejas y Mis Quejas usan el mismo
  stepper de chevrones. Bajo 420 px de ancho de panel se abrevian las etiquetas.

- En correo de acceso, credencial en bloque compacto con borde uniforme;
  los detalles de plantilla viven en [integraciones](integraciones.md).
- El formulario público conserva el ancho máximo de 860 px, el correo
  institucional 900 px, tarjeta blanca al 96 %, fondo compartido y pie
  interno. El skeleton reproduce la geometría completa; ver [flujos](modulos-y-flujos.md).
- Cuatro campos en dos columnas desde sm y una en móvil; descripción ampliable.
  Adjuntar/contador comparten fila, lista visible solo con archivos y scroll
  tras dos filas; nombres truncados conservan valor accesible.
  Pie separado sin superponerse; variante embed mantiene contrato propio.
- Confirmación con cabecera de marca, folio azul en línea, una columna y
  pie discreto; no duplicar evidencias ni insertar check circular gigante.
  Seguimiento conserva altura fija en escritorio y scroll interno, cuatro
  etapas y pie estable; móvil con scroll natural. No añadir «Actualizar estado».
- Carga sin credenciales: fondo neutral, sin shell ni módulo anticipado;
  después de autorización, skeleton específico. No añadir tiempos mínimos.

## Quejas y Mis Quejas: presentación vigente

- Compartir `CaseWorkspace`, `CaseCycle`, `CaseRequestHeader`, `CaseSection`,
  `CaseWorkspaceNavigation`, `CaseReadOnlyHeader`, `QuejaCierreResumen`, `AreaAfectada`, `ListaAdjuntos`
  y `QuejaPlazoIndicator` cuando el contrato coincida.
  Conservar las acciones/permisos particulares de Calidad y del responsable.
- Workspace lateral derecho de 40vw/100dvh; la tabla conserva columnas, filtros y
  scroll en ambos ejes. Móvil y ampliado usan diálogo nativo. Cerrar restablece el
  lateral. Ampliar/reducir conserva nodos, editor, visita y borradores.
- Contraído (40vw/100dvh): triaje estrictamente sin edición ni Tiptap visible:
  segmentos no interactivos en Quejas y navegación de consulta en Mis Quejas; tarjeta compacta de estado/plazo/
  responsable y tarjeta de «Siguiente paso» superior, con fondo suave y
  contorno uniforme tenue (SIN rayas verticales de color ni `border-l-4`),
  icono, título, explicación de 2 líneas y CTA principal azul.
  El contorno es `border` uniforme y tenue: prohibidos `border-l-2`,
  `border-l-4` y otros acentos verticales en todas las tarjetas de triaje,
  incluida la observación amarilla de devolución de Mis Quejas.
  Los tonos azul, ámbar y verde se aplican con fondos suaves y borde fino;
  conservar iconografía, legibilidad y hover del botón azul institucional.
  No reducir el triaje a un botón plano o una vista vacía. Debajo conservar
  en Quejas el extracto de 3 líneas y máximo 2 chips de adjuntos con contador "+N más en ampliado".
  REGLA DE ORO: cero decisiones a ciegas. Si el contexto está truncado, ninguna
  acción crítica (Tomar decisión, Aprobar, Devolver, Derivar a SACP, Enviar a GC,
  Resolver, Publicar) se ejecuta desde contraído. El CTA principal contextual
  (con flecha a la derecha) únicamente expande el workspace;
  los botones originales de negocio viven únicamente en la columna derecha del
  AMPLIADO. Acciones auxiliares seguras como abrir Notas/Historial/Análisis
  y la consulta de etapas sí se permiten sin ejecutar transiciones.
  El pie compacto ofrece Historial y notas en ambos módulos. Presentar el contenido
  de la etapa en Mis Quejas con una sola superficie visible. El editor se monta al
  abrir Resolución para editar y permanece montado al cambiar de vista. La visita,
  las revisiones y los borradores se conservan.
  La tabla y la geometría del drawer no cambian.
- Ampliado: dos columnas desde 1100 px útiles, documento centrado y acciones
  a la derecha (360 px); conservar encabezado, navegación, ciclo y geometría
  original. Por debajo se apila sin desbordar.
  `CaseWorkspace` activa `qualitySideGutters` solo con `qualityTwoColumn` y
  `expanded`. Fondo exterior `bg-qms-background` (#F4F7F6). En Quejas,
  hoja blanca de ancho máximo 210 mm, altura mínima original
  `calc(100dvh-70px)`, margen superior de 24 px, padding lateral de 24 px
  en la zona de lectura, borde tenue y sombra mínima. En escritorio el
  primer `data-case-client-document` tiene padding superior de 15 px para
  compensar margen/borde y recuperar la altura de «Descripción del cliente».
  No reducir letras ni imponer una altura A4 fija que recorte contenido.
  En Mis Quejas, `preserveEditorWidth` evita limitar el editor al A4;
  `data-mis-quejas-reading-column` mantiene máximo 960 px, fondo gris y
  hoja de lectura centrada. Conservar Tiptap, ancho, expansión y borrador.
  Panel derecho rectangular, sin marco, radio ni sombra:
  `data-case-coreui-docs-panel` en `app/styles/components.css` usa
  `linear-gradient(rgb(2 71 150 / 9%), rgb(2 71 150 / 9%)), #F3F6FB`.
  No sustituir por lila, negro, blur, opacidad global ni transparencia al 10%.
  Procede en azul ECA #024796 y No procede en rojo ECA #DE4041, con
  texto/icono blancos; controles secundarios blancos. Mantener contraste,
  disabled, hover y acciones de cada rol. Panel con scroll interno en
  escritorio, alto original y reset por expediente; permitir la cadena nativa
  de rueda hacia el scrollport del expediente cuando el panel no tenga más
  recorrido (overscroll-y-auto lateral; contención en el scrollport exterior); no añadir pie fijo
  de decisiones ni plegar herramientas por defecto. Anterior/Siguiente
  comparten CaseWorkspaceNavigation con Ampliar/Reducir; X de Modal.
- En Quejas, ciclo de evaluación/investigación/revisión/cierre; el contraído no usa
  checks verticales. No Procede muestra únicamente evaluación y cierre. Es una
  proyección del estado, nunca otro historial ni aprobaciones/fechas inventadas.
- Descripción comienza el documento y usa el ancho interior de la hoja.
  En Evaluación, Área afectada queda en el panel derecho antes de las
  decisiones. Sin resumen superior de resultado ni líneas decorativas.
  En revisión GC se prioriza la propuesta y se pliegan Solicitud y antecedentes.
- Responsable antes de las acciones de Calidad. Devolver/Aprobar se ofrecen en el
  expediente, sin modal duplicado de lectura. Fecha real de cierre bajo el estado;
  Calidad ve el estado/hora del correo final sin reenviarlo por consultar.
  `CaseFinalMailStatus` compacto (Quejas ampliadas): tipo/estado, contador
  de incidencias y reintento individual; «Ver motivo» despliega detalles
  extensos con altura limitada y ajuste de palabras. Después de dos correos,
  los adicionales se pliegan. No inventar reintento masivo ni reenviar por
  consultar. En Mis Quejas, error de resolución resumido con «Ver motivo»
  y scroll acotado; conservar los detalles y recuperación existente.
- Mis Quejas presenta Análisis, Resolución y Revisión de Calidad. El breadcrumb
  separa la etapa vigente de la consultada y funciona en el contraído y el
  ampliado. Las etapas alcanzadas se pueden consultar. Una devolución habilita
  consultar la revisión devuelta y devuelve la acción a Resolución. No Procede
  mantiene Análisis como único paso disponible.
- Análisis muestra primero la evaluación en café suave y Procede en azul cuando existe, después la
  descripción y el área afectada. Las evidencias del cliente y los archivos
  internos de Calidad/antecedentes quedan al final, en lectura. El botón azul
  «Ir a Resolución» cambia únicamente la vista. La consulta histórica usa la
  cabecera azul compartida «Solo lectura». Las lecturas del oficio y de las
  devoluciones permiten reservar sus adjuntos para Análisis incluso cuando el
  autor coincide con el responsable de la queja.
- Resolución muestra el lienzo integrado y «Mis adjuntos» personales. El
  responsable asignado puede editar, guardar, adjuntar y enviar/reenviar en
  En Investigación. La consulta de Análisis conserva el editor y el borrador
  montados. Cada cambio de etapa empieza arriba. La tarjeta única «Historial y
  notas» vive debajo del cliente y abre el diálogo centrado con ambas secciones;
  el contraído conserva el mismo acceso en el pie. En consulta se leen las
  notas, y la redacción y los menús de escritura se habilitan en Resolución.
- Revisión de Calidad reutiliza `QuejaCierreResumen` para Análisis, Propuesta y
  Revisión. Cada detalle permite recorrer Anterior/Siguiente desde el inicio
  del contenido. Resuelto y Finalizado concluyen aquí el trabajo del responsable
  y muestran la fecha registrada de aprobación de Calidad cuando existe.
  La lectura puntual por expediente y
  responsable utiliza la revisión más nueva para reflejar decisiones incluso
  cuando el expediente sale del filtro de la tabla.
- Las tarjetas de Agenda y los avisos navegables abren el registro con `?abrir=<id>`.
  Cada bandeja consulta por ID y con los permisos de sesión; Mis Quejas exige
  además responsabilidad propia. La bandeja abre en lateral y consume el parámetro.
- El editor conserva el desplazamiento interno al enfocar texto o barra de
  formato. Sin foco, la rueda desplaza el expediente. Escape reduce el
  workspace conservando borradores. El guardado es versionado y conserva
  los cambios ante conflictos; las cargas pendientes bloquean el envío.
- Estados de Quejas/Mis Quejas: usar primero `estado_color` del catálogo y la paleta
  original de Badge; mapa histórico de `estados.ts` como fallback. No imponer los
  colores de una maqueta ni cambiar los códigos guardados. Otros estados neutros
  conservan el fondo `qms-neutral-soft` (gris ECA aclarado) y texto oscuro.
- Plazos en ambas tablas/paneles: punto verde vigente, ámbar en alerta, rojo vencido;
  gris completado/sin plazo. Texto sin fondo y fecha en el título. El color no
  sustituye el texto ni altera el cálculo de `getQuejaDeadline`/`caseDeadline`.
  Mientras se consulta un snapshot de plazo aún no disponible, mostrar
  «Consultando plazo…» en gris, sin conteo natural provisional. Un snapshot
  válido en caché se muestra inmediatamente aunque se esté refrescando;
  un futuro vencimiento sin días hábiles intermedios se expresa por fecha.
  Mantener fecha límite, errores reales y fallback tras terminar la consulta.
- Fila seleccionada: `ui-case-row` + `aria-selected`, fondo `qms-row-selected`
  **#F0F4F7**, sin contorno añadido ni cambios de alto; persiste al retirar el puntero
  y desaparece al cerrar. Enter/Espacio abren la fila sin interceptar controles hijos.
- Adjuntos en `ListaAdjuntos layout="cards"`: superficie suave, sin marcos/separadores
  interiores fuertes; iconos estáticos por formato, nombre/tamaño y acciones accesibles.
  Separar evidencias del cliente y del análisis por su autor, sin descargar miniaturas
  ni archivos al listar. Conservar permisos de eliminar/descargar/visualizar.
- Marco redondeado y margen inferior del lienzo solo contraído; ampliado sin esa
  franja. El documento conserva padding final para que el contenido no toque el borde.
- En Quejas, el stepper permite consultar por clic Evaluación, Investigación,
  Revisión de Calidad y Cierre **solo con el workspace expandido**, sin transición
  ni escritura; "Volver a etapa actual" restaura las acciones. En el panel
  contraído se conserva el indicador visual no interactivo de la etapa actual.
  Al reducir o cambiar el folio se cierra la consulta. Nunca fingir registros
  de etapas futuras ni permitir mutaciones desde una vista histórica.
- Divulgación progresiva en ambos módulos y TODAS sus etapas: Recibido muestra
  descripción truncada (3 líneas) y dos adjuntos del cliente; En Investigación
  de Calidad muestra estado, responsable e instrucciones reales (no reciclar la
  justificación de la evaluación como análisis); el CTA es «Ver estado de la
  investigación →». Revisión GC presenta propuesta truncada
  (3 líneas), dos archivos internos y CTA "Revisar propuesta completa →".
  Los handlers existentes de Aprobar/Devolver/SACP NO se montan en la superficie
  visible del contraído; permanecen intactos exclusivamente en la columna derecha
  del ampliado. En Recibido el CTA «Revisar solicitud completa →» abre
  la evaluación, sin botón «Tomar decisión». En Revisión GC el CTA dice
  «Revisar propuesta completa →». En Resuelto, la persona autorizada ve
  «Redactar y publicar respuesta →» para llegar al panel ampliado y seguir el
  flujo existente de correo/publicación (sin publicar directamente).
  Resuelto/Finalizado muestran únicamente los pasos de
  `QuejaCierreResumen`; No Procede solo Solicitud y No procedencia. La respuesta
  al cliente sigue disponible en Resuelto. En Mis Quejas contraído, Resolución
  muestra el estado del borrador y su único botón azul abre el editor ampliado.
  Análisis y Revisión de Calidad muestran la lectura de la etapa elegida.
  Escape reduce el ampliado conservando el borrador. Desde el contraído devuelve
  el foco a la fila si no hay edición pendiente. Los diálogos auxiliares cierran
  primero, preservando la visita. Usar scroll inmediato y superficies opacas.
- En Quejas → Resuelto/Finalizado, QuejaCierreResumen muestra tres tarjetas de
  lectura (Solicitud, Análisis, Calidad); en No Procede usa solo dos (Solicitud
  y No procedencia), sin fingir investigación ni aprobación GC. Los nodos
  tienen fondo y anillo opacos para que la línea vertical no atraviese iconos.
  Las tarjetas conservan línea discreta, nodos de 32 px,
  cabeceras suaves y texto de 14 px. Contraído, las tarjetas mantienen
  124 px desde 580 px útiles del lienzo y resumen de dos líneas. Expandido,
  usan altura fluida basada en la ventana (124–212 px, 21dvh) para aprovechar
  el espacio sin crear scroll innecesario; desde 700 px de ancho útil el
  resumen puede mostrar tres líneas. En estrecho crecen según contenido. Cada tarjeta abre Modal
  variant=document size=mail con navegación Anterior/Siguiente y acceso a
  adjuntos reales. El artículo del visor usa todo el ancho interior útil y texto
  de lectura de 16 px, como el patrón de Análisis, sin cambiar el modal.
  No atribuir documentos internos sin asociación de etapa,
  ni inventar autores/fechas. No modificar el timeline lateral ni las notas
  del responsable solo para igualar una maqueta.
- El diálogo centrado «Historial y notas» conserva el mismo tamaño en ambas
  pestañas. Cada lista se desplaza dentro del diálogo. Historial usa una
  cuadrícula centrada de líneas finas con Usuario, Fecha y Acción realizada.
  Las filas tienen altura mínima de 40 px; fecha y hora de 12 horas (a. m./p. m.)
  quedan dentro de su columna, ampliada a 11.5 rem en escritorio y 6.75 rem en
  móvil. Si no caben juntas pasan a líneas separadas sin invadir Acción realizada.
  El GET privado se
  prepara al abrir el diálogo «Historial y notas» del folio y comparte petición y
  caché de 30 s con Historial. Mientras llega, la pestaña puede mostrar el ingreso que la vista
  ya tiene. El GET valida la sesión y el expediente por RLS y devuelve
  movimientos en orden descendente. Usa eventos QMS, revisiones, reaperturas y
  transiciones históricas vinculadas por folio, fecha y aviso del expediente.
  Resuelve nombres bajo los permisos de la sesión. Notas conserva texto breve sin
  título, orden descendente, reglas de escritura del rol y color por cuenta y
  navegador. «Reabrir expediente» queda bajo el correo final en acciones.
  «MI TRABAJO EN ESTE EXPEDIENTE», «Expediente anterior/siguiente» y
  textos neutrales son los rótulos vigentes; no renombrar IDs.
- En Evaluación, «Mis adjuntos» permite subir mediante el diálogo compartido.
  Un archivo propio ya subido se puede vincular como oficio de apertura; para
  No Procede o respuesta final se puede seleccionar un PDF válido del expediente.
- Scroll principal nativo de ancho normal (`scrollbar-width: auto`), color/gutter
  estable y capa compuesta `will-change: transform`; excluirlo de reglas globales
  `::-webkit-scrollbar`. Análisis/Notas/Adjuntos usan data-case-scroll y
  [will-change:transform], sin qms-compact-modal-scroll, backdrop-blur en overlays
  o scroll-smooth en scrollports internos. En escritorio el lienzo central se
  desplaza dentro de la cuadrícula fija. Móvil conserva la pila con un scroll
  común. Ampliado sin velo sobre el fondo ya cubierto.
- Visor privado: NO usar iframe externo, preconnect, enlace externo ni
  autenticación directa contra drive.google.com. Los archivos Drive se consultan por
  fetchDriveBlob → /api/drive/download, donde se verifica Bearer QMS, usuario
  activo, rol, expediente, pertenencia y privacidad física de Drive. El navegador
  recibe un Blob local con URL.createObjectURL y la revoca al cerrar/cambiar
  de sesión o de documento. Archivos legacy Storage usan download autenticado
  con el mismo usuario Supabase; nunca se abre URL firmada externa. Sin sesión
  válida o si cambia la identidad, mostrar error y no conservar la vista.
  Sin soporte de vista previa para un MIME, ofrecer Descargar, sin dar permisos
  nuevos ni exponer service role. Para acortar la espera se precargan hasta dos
  adjuntos Drive del expediente y se anticipa el documento al hover/focus; los
  bytes ya autorizados se reutilizan en memoria hasta 45 segundos y un máximo
  de 5 entradas. La caché se separa por usuario/rol y se limpia ante cambio de
  identidad, rol o logout, nunca usa cookies Google, almacenamiento persistente
  ni URLs públicas. La primera consulta puede demorar por verificaciones de
  permisos/privacidad en la API; no prometer latencia en milisegundos.

Detalle y evidencia visual: [patrones](../visual-patterns.md),
[panel](../quejas-panel-2026-10-13.md).

### Contrato de aceptación: triaje contextual y directorio

- **Calidad / `/quejas`:** cada estado tiene una sola tarjeta compartida
  `CaseTriageNextStep` en el bloque superior de `CaseTriageSummary`.
  `getCaseTriageNextStep` define el título, la descripción breve, el icono,
  el tono y la etiqueta (separados del código persistido y del catálogo):
  - Recibido: «Evaluar procedencia» → «Revisar solicitud completa».
  - En Investigación: «Seguimiento de caso» → «Ver avance del caso completo»,
    mencionando al responsable real cuando se conoce.
  - Pendiente de Revisión GC: «Revisión de Calidad» →
    «Revisar propuesta completa».
  - Resuelto, con permiso: «Preparar respuesta al cliente» →
    «Redactar y publicar respuesta» (**solo abre**; publicar sigue en ampliado).
  - Finalizado / No Procede: «Expediente cerrado» →
    «Ver expediente de cierre completo».
  - Estados desconocidos o sin permiso: CTA de consulta, jamás un permiso
    implícito de publicación. Mantener el ciclo real y las tarjetas de cierre;
    No Procede no debe inventar etapa de investigación ni aprobación.
- **Responsable / `/mis-quejas`:** Sin borrador → «Redactar resolución»;
  borrador con fecha → «Borrador guardado»; cambios locales →
  «Cambios sin guardar»; devolución de Calidad → «Corrección requerida»
  con alerta ámbar y motivo de dos líneas; también los estados de consulta
  ofrecen «Siguiente paso» descriptivo. Cada CTA de edición amplía y enfoca
  el **mismo** Tiptap. No añadir otro botón de editar bajo la observación
  ni volver a insertar el editor en el contraído.
- **Prueba visual obligatoria:** en todas las etapas, la tarjeta debe mostrar
  icono, título claro, descripción `line-clamp-2` a 13px y CTA principal azul
  con flecha. Fondo tonal suave, borde exterior fino **en los cuatro lados**,
  sin raya vertical decorativa. Evitar tanto el vacío como el scroll largo:
  extracto de tres líneas, hasta dos chips y contador; pie auxiliar fijo.
- **Acciones y persistencia:** el CTA de la tarjeta nunca llama a
  `guardarResolucionBorrador`, `enviarResolucionBorradorRevision`, aprobar,
  devolver, derivar ni publicar. Toda acción de negocio permanece en el ampliado;
  este conserva DOM/Tiptap, `visitId`, revisiones, borradores, permisos y datos.
  Escape colapsa primero y los diálogos auxiliares se cierran antes; no añadir
  autosave, consultas de red por expansión, `scroll-smooth` ni `backdrop-blur`.
- **Usuarios:** conservar la tabla y sus columnas 24/14/13/19/18/12 %.
  En Acciones, el botón «Editar» (lápiz, texto y flecha) reemplaza los tres puntos,
  alineado con el encabezado. Conservar `UsuarioAccionesMenu`, su portal,
  sus tres handlers, permisos y tarjetas móviles; no convertirlo en una acción
  de edición automática ni crear scroll horizontal fuera de la tabla.

### Regresión de diseño y navegación

- **Pruebas mínimas antes de integrar:** `npx tsc --noEmit`,
  `npm run lint`, `node --test tests/quejas-progressive-disclosure.test.mjs
  tests/quejas-panel-reference.test.mjs tests/mis-quejas-workspace.test.mjs
  tests/quejas-stepper-consulta.test.mjs tests/usuarios-table-layout.test.mjs
  tests/usuarios-acciones-menu.test.mjs`, `npm run build`,
  `npm run check:structure` y `npm run check:visual`.
  La automatización de referencia es
  `.github/workflows/qms-workspace-verify.yml`. Una prueba de código correcta
  no sustituye inspección visual y operativa en navegador autenticado.

### Editor integrado, informe y compositor

- El editor de resolución mantiene `h-[clamp(360px,calc(100dvh-110px),700px)]`,
  una barra Tiptap, pie fijo y scroll propio. Asistencia a la derecha, separada
  de Expandir/Contraer. Solo Expandir explícito altera altura hacia arriba;
  Editar después de guardar reabre normal con `resolutionOverlay=null`.
  Guardar azul incluso disabled, no autoguardar ni montar segundo editor.
  Los límites de escritura y guardado están en [flujos](modulos-y-flujos.md).
- Modal de informe `variant="report"`: 94vw/1450px por 94dvh, encabezado fijo,
  barra compacta y una región desplazable; `QuejaInformeHoja.module.css`
  no se aplica a otros editores. `height="content"` es opcional para otros
  documentos. Word/editor Century Gothic títulos y Arial cuerpo, PDF Helvetica;
  colores de informe en informeDesign.ts (#2A61B0, #1A1718, #E6E5E5).
  A4 visual sin página fantasma; PDF independiente, sin truncar.
- Respuesta al cliente: Para y oficio en misma fila, asunto en línea,
  adjuntos fijos y único scroll de textarea `data-response-message-scroll`.
  Cuadrícula minmax(0,1fr)/auto; no agregar scroll exterior, editor ficticio
  ni otro selector. Ver [flujos](modulos-y-flujos.md).
- RichTextEditor lazy, toolbar accesible, listas dentro del padding,
  mínimo 240 px en su variante base. RichTextContent mantiene plain literal
  y Markdown seguro sin interpretar HTML/enlaces/imágenes. No inferir formato.
- `CaseRequestHeader`: desplegable nativo Datos de la solicitud en cabecera
  del folio; persona/tipo, correo/teléfono/recepción, scroll hasta 45dvh.
  Se reinicia por expediente sin remontar documento; no abrir otra ranura.
- Área afectada: selección directa en Evaluación, sin Select anidado ni
  botón de guardado adicional. No habilitar durante carga, error o guardado.
  Gestión en Configuración; catálogo compacto 448 px, acciones por fila en
  popup top layer, Escape por nivel y foco restaurado. Desactivar/restaurar,
  no borrar históricos; autorización real y CAS.

## Usuarios: tabla, modales y roles

Nunca mostrar éxito ficticio ni inventar estado 2FA. Usuarios evita
repetir el título «Gestión de accesos» sobre un encabezado «Usuarios» existente
y usa un único lienzo con pestañas y «Nuevo usuario» en la cabecera,
filtros en la banda siguiente, tabla y paginación debajo; Roles comparte el
mismo lienzo sin contenedores anidados. Se conserva paginación en cliente,
scroll vertical interno y tarjetas móviles sin scroll horizontal. Ambos modales usan
`Modal` `variant="document" size="mail" height="fill"` (896 px / 90dvh),
con cabecera, scroll único y pie fijo. Crear mantiene una vista con «Información del usuario» y «Acceso al sistema»;
  tras el alta muestra el resultado del envío y permite reenviar bajo autorización.
  **Con correo activado no muestra la contraseña**; si se desactivó expresamente
  el envío, la muestra una única vez al admin para entrega manual y la descarta
  al cerrar el modal.
Editar conserva pestañas «Detalles del perfil» y «Seguridad y acceso», avatar,
y zona de peligro con confirmación. FormData permanece montado al cambiar de tab.
La Seguridad vigente genera/restablece
acceso desde `UsuarioSeguridadAcceso`; no recuperar el antiguo editor
de contraseña administrada por PATCH ni abrir otro modal. Ver
[sesión y permisos](sesion-y-permisos.md).

La tabla sigue el orden Usuario, Rol, Estado,
Seguridad (2FA), Último acceso y Acciones, sin columna «Alta». Mientras no haya
política de acceso nueva, Seguridad muestra «Sin cambios». Para cuentas con política,
muestra su método o pendiente; no inventar factores ni habilitar filtros ficticios.
Estado usa punto y fondo discretos semánticos; Rol conserva el badge existente.
La tabla de Usuarios aprovecha el espacio: Usuario 24 %, Rol 14 %, Estado 13 %,
Seguridad (2FA) 19 %, Último acceso 18 % y Acciones 12 % en escritorio.
Las columnas posteriores a Usuario comienzan más a la izquierda, sin quitar
espacio a nombres/correos ni alterar los datos, el orden o la versión móvil.
Acciones conserva la última columna y su proporción: el encabezado se
alinea con el comienzo del botón «Editar» con icono lápiz y chevron, en lugar
de los tres puntos. Su clic despliega las mismas tres acciones; no llama
a edición directamente. En escritorio, respetar `colgroup`
`24/14/13/19/18/12` con tabla fija y scroll local; encabezado
`<TableHeaderCell className="pl-0 text-left">Acciones</TableHeaderCell>` y
celda de acción `pl-0`, sin el antiguo truco de `w-[18px] justify-end`.
El menú mantiene Actualizar perfil,
Restablecer contraseña (abre Seguridad del mismo modal de Gestionar usuario;
NO correo de recuperación ni un segundo diálogo), y Desactivar/Restaurar
cuenta según estado, con confirmación
y prohibición de desactivar la cuenta propia. No duplicar mutaciones ni guards.
El menú se muestra en portal fuera del scroll de tabla/tarjetas, para no
recortarse al final; soporta clic externo, Escape, flechas y foco accesible.
Reutilizar también en móvil. Fuente: app/usuarios/components/
UsuarioAccionesMenu.tsx y tests/usuarios-acciones-menu.test.mjs.
Roles muestra ayuda en un portal flotante con z-index independiente
(por encima de la tabla y encabezado), Escape y X para cerrar, sin
contenedores details recortados; matriz con scroll propio.

Tablas de Quejas/Mis Quejas: la especificación del 16 noviembre conserva la
altura original de cada fila, colores y densidad. El seguimiento por etapas y
sus pruebas está en [tablas y bandeja](../quejas-bandeja-etapas-2026-11-16.md).
Las fechas de ingreso se presentan con `formatFechaIngreso` en DD/MM/AAAA y
zona Costa Rica; no modificar el instante almacenado por un cambio visual.
Toda hora visible usa `hourCycle: 'h12'` (a. m./p. m., medianoche y mediodía
como 12:00). Conservar la zona y precisión de cada formateador, fechas civiles,
ISO de API/DB, orden, plazos y reglas de negocio.

## Agenda y visor

- Agenda compacta (máximo 320px) abre en calendario con semana D/L/M/X/J/V/S,
  flechas de mes anterior/siguiente, selección circular y puntos por fecha_limite
  real y prioridad. El RPC añade fecha_limite civil CR (null si no existe), caché
  de contrato v3, cinco minutos. «Ver agenda» muestra cinco tarjetas y «Volver al
  calendario» regresa. Si hay más de cinco, «Ver más» aparece dentro del scroll y
  despliega ahí los restantes recibidos, sin navegar a otro panel. Navegar meses no consulta
  otras agendas ni inventa eventos: puntos solo para los registros recibidos.
  Cada apertura restablece mes actual y selección. Migración 20261111175442 aplicada;
  confirmar publicación por SHA de producción. [Contrato](../agenda-hoy-2026-11-11.md).
- Calendario de Agenda: mes a la izquierda y las dos flechas juntas a la derecha,
  con área 32px e iconos 20px. Grillas gap-1, días 32px y puntos de 4px. Pie de una
  sola fila: check circular azul + «X tareas hoy» y «Ver agenda» como acción textual azul, ambos text-xs; «hoy» en color de texto normal, sin CTA
  relleno ni elementos apilados. Check y «Ver agenda» usan qms-primary; el día
  seleccionado usa fondo qms-primary y texto blanco, sin cambiar la marca global.
- Pulsar cualquier día abre la vista de tarjetas filtrada por esa fecha, con
  fecha y cantidad de vencimientos. «Volver al calendario» conserva el mes;
  «Ver todo» retira el filtro. Si no hay coincidencias, mostrar un vacío acotado
  a la agenda actual. Mantener ancho 320px, lista de cinco y «Ver más» local,
  foco en la navegación y scroll al inicio al cambiar filtro. Reabrir desde
  el icono restablece día/mes y vista; sin cambios de la paleta global.
- Visor: marco estable, permiso verificado y Blob local revocable, nunca
  iframe Drive externo. Indicador tras 180 ms; transición breve 150 ms con
  movimiento reducido. Precarga/caché privada en [datos y rendimiento](datos-y-rendimiento.md).

## Dashboard ejecutivo

- Cabecera «Dashboard · Indicadores del SGC», pestañas horizontales accesibles
  (Quejas activa por defecto), selector de período e Imprimir / PDF discretos.
  Solo Quejas dibuja ocho tarjetas; las demás muestran preparación sin datos.
- Fondo #F4F7F6, Inter heredada, tarjeta blanca con borde fino uniforme y sin
  bordes laterales destacados. Azul #024796, verde QMS #198754, ámbar y gris.
- Tres filas con escala legible del Dashboard anterior: 4 KPIs de altura mínima
  184px (altura mínima, sin recortar contenido); tendencia y dona de 350px (65/35 cuando el espacio útil lo permite);
  áreas y cumplimiento por etapa de 270px. Títulos de 18px, texto secundario
  de 14px, valores principales de 36px, anillos KPI de 88–116px y dona de 200px. En los KPI de proporción y tiempo,
  texto a la izquierda y SVG a la derecha en una sola fila; conteos breves
  con buen contraste.
  Paddings de 20px en escritorio. Cuatro KPIs desde 1120px de ancho del contenido,
  dos en pantallas intermedias; permitir scroll vertical antes que miniaturizar.
- SVG puro: anillos delgados, puntas redondeadas, barras segmentadas,
  etiquetas cortas, leyenda y tooltip de tendencia por hover/foco; sin Chart.js
  ni Recharts. Valores positivos encima de cada barra, sin mostrar ceros
  ni inventar datos; leyenda de dona con cantidad y porcentaje. Meta 90%
  rotulada sobre su marca vertical en la primera barra de etapas; los
  conteos se expresan como «X de Y a tiempo». La meta es solo referencia;
  no sustituye denominadores reales. Sin notas repetidas bajo tendencia.
- DashboardLoading comparte grillas, tarjetas y alturas con QuejasSummary;
  formas fijas CSS motion-safe, sin temporizadores por registro. Error real
  con reintento, sin datos evaluables no equivale a 0%.
- Impresión circunscrita al tablero: página nombrada A4 horizontal, margen
  externo cero, contenedor de 297 × 208mm con padding 9mm 11mm y flex/gap
  4mm. Liberar los ancestros y reservar 2mm de tolerancia para evitar una hoja
  en blanco. Encabezado institucional azul con módulo, período y hora CR 12h;
  pie con identificación ISO 9001 y Página 1 de 1. Tres filas distribuidas
  en el espacio disponible, tarjetas blancas con borde suave, anillos 56px,
  activos en dos columnas sin colisiones y tendencia de 175px con SVG
  posicionado en su marco. Impresión de colores exactos. Verificar que no
  haya contenido recortado en Chromium, incluso con cinco áreas y siete estados.
  El botón usa un título temporal «ECA-QMS - Informe Ejecutivo - módulo - período»,
  restaurado con afterprint o fallback al salir de impresión/recuperar foco.
  El navegador conserva control final sobre nombre y opciones del diálogo.
- «Solicitudes procedentes» muestra procedentes y no proceden del mismo
  denominador, sin añadir felicitaciones ni solicitudes sin evaluar.
  No modificar AuthShell, SessionScreen, tema global ni alias de ruta.
