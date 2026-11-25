# Módulos y flujos de negocio

Contrato del código vigente. Para diseño y geometría consultar [visual](visual.md);
para estado de despliegue y pruebas, [verificación](verificacion-y-pendientes.md).
No restaurar contratos antiguos o prototipos por encima de esta guía.

## Inventario funcional y cobertura

Este inventario complementa el contrato de arquitectura. **Operativo** significa que
hay ruta/consumidor y lógica integrada en el repositorio; no significa aceptación
institucional ni que el último commit esté publicado. **Parcial** obliga a respetar
sus límites. No extrapolar producción, permisos ni ejecución de pruebas por existir
archivos, migraciones o documentación.

| Área / ruta | Capacidades conectadas en el código | Alcance que NO se debe suponer |
| --- | --- | --- |
| Inicio `/`, alias `/dashboard` | Tablero ejecutivo SVG, pestañas y período; Quejas con indicadores verificables | Indicadores de los demás módulos en preparación |
| Quejas `/quejas` | Alta/consulta, filtros, estados y colores de catálogo, área afectada, timeline, plazos, revisión GC, devolución, relación SACP, resolución, expediente oficial y publicación final | Publicar al aprobar GC, omitir PDF/oficio, derivar desde cualquier estado |
| Mis Quejas `/mis-quejas` | Casos del responsable real, etapas Análisis/Resolución/Revisión de Calidad, notas e historial, evidencias propias, asistencia, borrador versionado y envío/reenvío a revisión | Acceso a casos ajenos, autoguardado o publicar respuesta ciudadana |
| Informe y comunicación | Tiptap A4 en modal, versionado, exportación Word/PDF, PDF oficial en Drive por folio/versión, correo editable con borrador/publicación y archivo físico adjunto | Considerar la paginación visual como paginación del PDF; enviar sin documento autorizado |
| Formulario ciudadano `/q/[token]` | Registro con capacidad privada, validación cliente/API, evidencias limitadas, reintento idempotente, finalización y acceso al seguimiento según estado | Portal de usuario externo con login, ver notas internas o recuperar una capacidad vencida |
| Seguimiento ciudadano | Enlace de capacidad y consulta del estado, plazos de caducidad y etapas permitidas | Identidad verificada del portador o lectura pública del expediente completo |
| Usuarios `/usuarios` | CRUD/estado, roles/permisos, tabla adaptable; nueva alta con contraseña temporal por correo/entrega manual, gracia de 3 días hábiles, login directo si `ready`, cambio diferido en Mi perfil (manual/generador/copia), 2FA opcional y reenvío; invitaciones legacy y reset MFA | La plantilla GAS más reciente requiere verificar publicación; sin alta pública, recuperación genérica, gestor universal de sesiones ni E2E completo |
| Configuración `/configuracion` | Organización, acceso, servicios, marca, catálogos, IA administrada y calendario QMS versionado | Editor SLA legacy como publicador del motor QMS, secretos en el navegador |
| Documentos `/documentos` | Listado/estados, alta y cambio de versión visible | Control documental completo, historial real y gestión de Drive |
| SACP `/sacp` | Listado, alta, seguimiento/cierre y vínculo autorizado desde Quejas | Motor completo de eficacia o validaciones administrativas no implementadas |
| Riesgos `/riesgos` | Listado, alta y matriz | Seguimiento integral de mitigación y controles |
| Auditorías `/auditorias` | Listado, alta, hallazgos consultables | CRUD completo de hallazgos y workflow de acciones |
| Revisión por Dirección `/revision` | Reuniones, alta y detalle | Actas y acuerdos con workflow documental completo |
| Procesos `/procesos` | Listado, alta, tipos y estados | KPIs y documentos vinculados como gestor integral |
| Reportería `/reporteria` | Selección de módulo, filtros, tabla, resumen, distribución, vencidos e impresión | Persistencia de reportes personalizados, exportador empresarial o envíos |
| Agenda/notificaciones | Agenda de hoy desde RPC/Query, plazos y novedades por perfil, avisos internos y sonido sujeto a gesto/permisos del navegador | Agenda completa de planificación, avisos push universales o datos de meses que no se consultaron |
| Integraciones | Supabase Auth/DB/RLS/RPC, Google Drive por API privada, IA por servidor, colas de correo en DB/Edge y emisor Apps Script | Acceso directo público a Drive, email garantizado en inbox, automatización desde Vercel |
| Seguridad transversal | API Bearer y rol, guards del servidor, RLS, operaciones con revisión esperada, aislamiento de caché por identidad, BotID y cuotas de formulario | Sustituir autorizaciones de backend por controles visuales, MFA/antivirus/telemetría completos |

**Estados y decisiones esenciales:** Recibido → evaluación → En Investigación →
Pendiente de Revisión GC → Resuelto → respuesta publicada / Finalizado, con rama
No Procede y devoluciones/reaperturas justificadas. La resolución interna y el
correo al ciudadano son productos distintos; una aprobación de Calidad no envía el
mensaje final. Los plazos son del motor QMS y su calendario persistido, no simples
diferencias de fechas naturales. La asignación y las operaciones conservan revisión
optimista y permisos efectivos. Los folios anuales no se regeneran por abrir un editor.

### Dashboard activo

- Inicio `/` (alias protegido `/dashboard`): tablero ejecutivo gráfico, sin
  tablas de expedientes, actividad reciente ni barras de seguimiento por módulo.
  Quejas es la primera pestaña; SACP, Documentos, Riesgos, Auditorías, Revisión
  por Dirección y Procesos son estados de preparación sin métricas inventadas.
- Selector civil CR: año actual de enero hasta mes en curso, últimos seis
  meses incluyendo el mes en curso, y año anterior completo si hay ingresos
  visibles en ese año. No mezclar históricos con el año vigente.
- Cohorte de ingresos del período: volumen mensual recibido, distribución
  de su estado actual, activos (Recibido, Investigación, Revisión GC, Resuelto).
  Procedencia usa decisiones de esa cohorte, excluye Recibido, Felicitación y
  tipo ausente, y acepta solo estados decisorios conocidos. Top 5 usa
  `area_afectada` no vacía de los procedentes; no clasifica por tipo.
- Resolución: eventos observados `qms_case_events.kind='resolved'`, por mes
  de resolución (incluye ingresos de otros períodos). Vincular la ejecución
  de investigación más reciente terminada antes del evento, configurada,
  con fecha límite persistida y resultado válido. No acreditar dos eventos
  con la misma ejecución. Comparar instante de resolución contra expires_at.
  Sin ejecución verificable se excluye del denominador y se indica cobertura;
  no comparar fecha_cierre con fecha_sla ni reconstruir SLA.
- Promedio: días calendario transcurridos desde recepción hasta cada resolución
  observada del período, incluida una eventual reapertura; no afirmar días
  hábiles. Cumplimiento por etapa: ejecuciones configuradas terminadas en el
  período por transición válida, comparar ended_at con expires_at. Meta visual
  90 % y duración nominal 3/15 días, sin alterar el calendario versionado.
  Ausencia de denominador muestra «— / Sin datos evaluables», no 0 %.
- Las lecturas usan qms_quejas (security_invoker), qms_case_events y
  qms_stage_runs con SELECT/RLS del usuario real y permiso de Quejas.
  RPC obtener_estadisticas_quejas sin cambios para consumidores existentes;
  su SLA legacy no se utiliza para el tablero. Sin cambios de DB.
- Exportación por window.print(), período y fecha de generación CR, sin menú
  ni controles. Ver contrato de [visual](visual.md) y [datos](datos-y-rendimiento.md).

## Quejas y Mis Quejas: lógica vigente

Alcance: recepción y gestión interna de Quejas; no toda la matriz de Calidad ni un
portal ciudadano completo. Las variantes de presentación no cambian IDs, estados,
permisos ni datos persistidos.

- Alta pública/interna con nombre, correo y descripción obligatorios, tipos
  compartidos, fecha automática y consecutivo anual transaccional. Conservar folios
  y contadores históricos; no reiniciar la serie ni consumir folios sin un alta.
- Consecutivo automático: año de registro en Costa Rica, mínimo tres dígitos
  (`2027-001`, `2027-002`, …, `2027-1000`), una serie por módulo/año. Cada enero
  empieza en 001 si ese año no tiene histórico. Conservar los prefijos de otros
  módulos. SACP/Auditorías/Riesgos omiten el folio vacío en el INSERT; nunca reservar
  desde UI. Los RPC legacy se conservan para compatibilidad del cliente publicado.
  DB aplicada el 11 noviembre; calendario adicional aplazado. Ver estado web en verificación.
  [Contrato y evidencia](../consecutivos-anuales-2026-11-11.md).
- Corrección posterior autorizada del 11 noviembre: solo futuras altas de Quejas,
  contador 2026 de 2089 a 89 (siguiente `2026-090`), retirando el arrastre de 2000.
  Migración 20261111155021 aplicada. No renumerar ni borrar las 153 quejas existentes;
  el generador salta números ya ocupados y conserva el crecimiento después de 999.
  El borrado para lanzamiento es un trabajo futuro, todavía no autorizado para ejecutar.
- Procede requiere un único editor de justificación (que también constituye las
  instrucciones al investigador), responsable obligatorio y un oficio de apertura
  opcional. No crear un segundo textarea de instrucciones. La transición y el
  vínculo del oficio se guardan en una sola transacción DB con revisión esperada,
  sin autoguardado. Solo en este editor, ocultar la pista gris de formato sin
  ocultar errores de límite de caracteres.
  La subida a Drive persiste el archivo inmediatamente: cancelar la decisión deja
  el adjunto como archivo ordinario sin asignarle oficio; solo confirmar Procede
  guarda su asociación. La tabla de asignación tiene SELECT autorizado y ninguna
  escritura directa para authenticated. En la etapa 2 de `/quejas`, Calidad ve
  primero «Justificación de Calidad» y debajo «Investigador asignado», seguidos
  de los documentos vinculados. NO consultar ni mostrar aviso de borrador del
  encargado en este panel (ni en el triaje 40vw); esa edición permanece en
  `/mis-quejas`. En Procede, el botón visible es «Adjuntar documento», sin
  modificar la asociación interna del archivo. Contrato:
  docs/quejas-asignacion-investigacion-2026-11-14.md.
  Investigación prepara la propuesta;
  enviarla a Revisión GC no publica ni notifica al cliente. Aprobar y continuar pasa
  a Resuelto; Calidad prepara después la comunicación final. Publicar respuesta
  congela el correo y documento elegidos y pasa atómicamente a Finalizado.
- Devolver a investigación exige motivo y conserva propuesta y plazo. Reabrir exige
  motivo. Las etapas nuevas usan 3/15 días hábiles; revisión, devolución o reasignación
  no reinician la investigación. Leer el snapshot QMS, nunca prioridad/SLA legacy
  para inventar vencimientos. Los históricos conservan su calendario y revisión.
- En Pendiente de Revisión GC, la propuesta del responsable se lee en el centro
  con sus adjuntos internos debajo, sin «Ver antecedentes». GC puede Aprobar y continuar (Resuelto),
  Devolver con motivo/soportes, o Derivar a SACP si hay propuesta y aún no está
  vinculada una SACP. El responsable NUNCA deriva en investigación.
- Derivar a SACP crea una acción interna vinculada e independiente, sin cambiar
  el estado de Quejas ni bloquear su publicación final. La función efectiva de DB
  acepta Revisión GC (migración 20261113221000), sin habilitar la derivación a
  cualquier rol o estado.
- Soportes de devolución: se suben realmente con subirAdjuntoQueja y, al
  Confirmar devolución, RPC qms_review_resolution_with_attachments vincula
  los IDs a queja_gc_revision_adjuntos en la misma transacción de devolución.
  La tabla tiene RLS; authenticated puede consultar según policy pero no
  insertar directamente. El encargado ve solo adjuntos de ESA revisión en su
  tarjeta amarilla y entra a corregir con «Ir al editor» (mismo Tiptap).
  Subir sin confirmar deja el archivo en expediente, aún sin vínculo a devolución.
- No Procede usa directamente la misma ventana de correo y documento. No restaurar
  pestañas de Justificación/Correo ni el segundo modal «Confirmar no procedencia».
  Los fundamentos se documentan en el informe; el servicio conserva el motivo previo
  o la comunicación al adjunto, y publica mediante el puente atómico correspondiente.
- Guardados y transiciones capturan revisión/visita/ámbito antes de escribir. Informe
  y respuesta tienen versiones remotas; conflictos conservan el borrador. No sustituir
  la revisión esperada por la de un refresco ni repetir una publicación confirmada.
- Oficio institucional único y documento publicado obligatorios para el cierre final.
  La excepción propuesta para Felicitación sigue pendiente: no habilitar
  cierre sin adjunto hasta coordinar RPC, restricciones y guard de cierre,
  outbox, autorización Edge, Apps Script, seguimiento y pruebas por categoría.
  Aprobar la propuesta en GC no exige adelantar la publicación del oficio. El número
  nuevo precarga el folio como valor editable; no es otra serie ni cambia el folio.
- Área afectada: selección directa en el panel de Evaluación; solo se edita en Recibido
  con permisos y revisión capturada. Mis Quejas la consulta sin cargar el catálogo.
  Configuración administra `quejas/area_afectada`: editar, desactivar y restaurar sin
  borrar históricos ni asignar automáticamente una opción nueva al expediente.
- Las notas se redactan en Historial y notas. Los comentarios y observaciones
  históricos se conservan como datos del expediente y de reportería.
  Notas de investigación y propuesta enviada se guardan por separado.
  Editar o eliminar una nota propia solo se permite En Investigación y compara el
  contenido esperado (CAS); el historial de devolución/aprobación/cierre y las notas
  ajenas no se reescriben. Migración 20261112054513 sin aplicar: sin ella la UI
  conserva el error visible, no una edición remota.
  En Mis Quejas/Investigación, Resolución usa la barra Tiptap sin encabezado adicional:
  Asistencia IA es un botón directo a la derecha de formato, sin chat ni acordeones;
  la pista de formato está oculta (errores de límite visibles). La redacción tiene
  scroll interno, barra superior y pie fijos y esquinas redondeadas. No crear
  separadores adicionales dentro del texto ni fijar la tarjeta central con sticky;
  al abrir no desplazar el scroll exterior con `scrollIntoView`.
  IA y Expandir/Contraer están a la derecha, separados por un divisor vertical;
  el expansor de 44px tiene icono de cuatro esquinas y aumenta solo la altura
  hacia arriba conservando ancho y borde inferior; Guardar/Cancelar restablecen
  el alto habitual. Guardar siempre mantiene
  el azul primary incluso deshabilitado; Editar se muestra arriba del borrador
  guardado y reabre el editor **sin expansión automática**. El tamaño base es
  `h-[clamp(360px,calc(100dvh-110px),700px)]`; solo el botón Expandir aplica el overlay
  vertical, sin ampliar todo el expediente.
  Guardar conserva borrador remoto/versionado, sin cambiar estado, revisión de Queja,
  propuesta enviada ni avisar a GC/cliente. Las ediciones
  posteriores sin guardar siguen siendo de la visita; no hay autoguardado.
  Guardar y Enviar comparan revisión de expediente y versión de borrador; no forzar
  reintentos con una lectura nueva. Al enviar/reasignar/cambiar estado, DB limpia el
  borrador sin borrar la propuesta anterior. Migración 20261112030353 aplicada;
  [Contrato](../mis-quejas-borrador-resolucion-2026-11-11.md).
- Decisiones/resoluciones usan Tiptap lazy, límite 10.000 y formato plain/markdown
  explícito. `quejaContent` omite
  solo la copia plain exacta `[Procede]` de una justificación separada; conserva otras
  notas y reaperturas. No interpretar HTML ni inferir Markdown de texto histórico.

Contratos: [revisión GC y respuesta](../quejas-revision-y-respuesta-2026-11-04.md),
[panel y procesamiento](../quejas-panel-2026-10-13.md) e
[informe editable](../quejas-informe-editable-word-2026-11-03.md).

### Límites del workflow y catálogos

- Las lecturas usan `qms_quejas`; mutaciones `qms_update_details`,
  `qms_transition_complaint` y `qms_update_complaint_register` preservan
  revisión esperada, rol y módulo. EXECUTE del motor legacy sigue cerrado.
  `qms_save_complaint_area` crea/reactiva bajo lock; gestionar catálogo no
  asigna el área. Elegir la misma opción no escribe. Mantener snapshot y
  área histórica inactiva; no reintentar un 40001 con revisión nueva.
- La prioridad se retiró de la UX de Quejas, no de DB ni otros módulos.
  `quejas_actividad` conserva notas; `quejas_comentarios` conserva
  comentarios históricos para reportería. Oficio anterior sigue visible
  tras reapertura, sin renumerar folio.
- Los avisos, transporte de correo y calendario se rigen por
  [integraciones](integraciones.md) y [base de datos](base-de-datos.md).
- Regla de oro: ninguna decisión crítica desde el triaje contraído; el CTA
  solo amplía. Ver [visual](visual.md) para el contrato de cada etapa.

## Informe y correo de respuesta al cliente

- En Resuelto, «Generar expediente» aparece SOLO debajo de los datos del
  cliente como botón secundario ancho en un contenedor mínimo, sin párrafos de
  ayuda ni duplicado central. Abre un informe Tiptap prellenado y editable con
  encabezado, secciones, Conclusión/Resolución y anexos; 100.000 caracteres
  (`INFORME_MAX_LENGTH` validado en editor/API). Se guarda remotamente.
- Guardar inicia el cálculo del PDF local en paralelo con la escritura versionada
  en DB, pero NO sube a Drive hasta confirmar la versión; así no se atribuye un PDF
  a una versión inexistente. Usa adjuntos ya consultados y evita listar de nuevo
  cuando la versión es nueva. Después sube y registra el PDF oficial en la misma
  arquitectura de Drive, con nombre estable folio/versión (informePdfFilename).
  Si ya existe un PDF válido para esa versión, lo reutiliza. El indicador
  distingue «Guardando versión» de «Registrando PDF en Drive».
  Si falla Drive/subida, conserva el texto guardado, muestra error y permite
  reintentar Guardar sin crear una versión nueva. No es una transacción distribuida.
  Word/PDF siguen disponibles como opciones de exportación separadas; no añadir
  «Preparar PDF para cliente» ni segundo generador de PDF.
- Diseño del informe: `lib/constants/informeDesign.ts` centraliza azul documental
  #2A61B0, negro #1A1718 y divisores #E6E5E5 de la guía de identidad. Word/editor usan
  Century Gothic en títulos y Arial en cuerpo; PDF conserva Helvetica integrada.
  Sin franjas de fondo en títulos; Word conserva un párrafo editable después de un
  título vacío para separar Conclusión de Anexos. La plantilla genera solo un
  párrafo editable (no dos) y la paginación visual evita un borde de página
  fantasma tras el último separador, sin ocultar páginas cortas con contenido.
  El editor reduce espaciados verticales, pero nunca trunca contenido ni fuerza
  un máximo de páginas. El PDF real sigue su paginación A4 independiente.
  No reescribir informes guardados.
- Respuesta al cliente usa compositor tipo Gmail: Para y N.º de oficio en misma
  fila, Asunto en línea y texto libre. No hay selector desplegable de documentos.
  Para abrir rápido, precargar por intención desde la fila (hover/foco)
  y desde el expediente al entrar en Recibido, Revisión GC, Resuelto o No Procede
  exclusivamente para personal de Calidad/admin. Compartir claves y TTL de
  TanStack Query de 30 s y no duplicar consultas; un click sin hover debe
  iniciar el mismo prefetch desde el expediente. La consulta de redacción
  necesita solo borrador y publicación (dos SELECT paralelos): no esperar el
  historial de revisiones GC, que se maneja en otro panel con sus propios permisos.
  Montar el editor real tan pronto llegue el contexto de respuesta, sin esperar
  el informe versionado: ese informe
  puede llegar después y el chip PDF se selecciona automáticamente solo si
  existe el de la versión válida y el usuario no eligió otro. Un informe guardado
  dentro de esta visita tiene prioridad sobre respuestas de red tardías.
  Nunca sobreescribir campos ya editados ni publicar con un archivo provisional.
  Solo ante falta de caché de borrador aparece un estado breve, centrado,
  sin spinner ni editor ficticio. Si falla el borrador, Reintentar; si falla
  solo el informe, el compositor sigue utilizable con error/reintento propios.
  Aplica por igual a No Procede y al cierre normal de Quejas.
  **Regresión obligatoria al tocar este flujo:** abrir No Procede desde Recibido
  y Respuesta al cliente desde Resuelto, con caché caliente y fría, teclado y
  ratón. No reinstalar editor ficticio, spinner ni doble scroll durante precarga;
  confirmar encabezados, asunto, cuerpo y adjuntos estables. Simular informe
  retrasado/ausente/error y comprobar que el correo sigue editable y que el
  aviso Reintentar corresponde solo al recurso fallido. Si llega después
  el PDF de la versión correcta, seleccionar automáticamente solo cuando no
  haya elección manual; un informe guardado en la visita prevalece. Verificar
  borrador versionado/conflicto, aviso de cambios sin guardar, bloqueo de
  publicación sin PDF y prohibición de acceso fuera de Calidad/admin.
  Medir el tiempo real en navegador autenticado antes de afirmar apertura
  instantánea universal; caché fría o servicios externos pueden causar espera.
  El PDF oficial de la versión guardada se selecciona como chip automáticamente
  si existe; de lo contrario, solo Subir archivo y aviso discreto. El chip permite
  previsualizar y quitar selección; onPdfReady actualiza selección también cuando
  se guarda desde el editor del propio modal, si sigue vigente esa visita.
  El compositor no tiene scroll exterior duplicado: el área Para/Asunto y los
  adjuntos permanecen fijos; solo el textarea del mensaje desplaza su texto.
  Para Respuesta normal y No Procede, conservar la cuadrícula acotada con
  filas `minmax(0,1fr)` para el correo y `auto` para los adjuntos. La barra
  interior pertenece solo a `[data-response-message-scroll]`; el botón extra
  «Preparar documento (opcional)» en cierre y No Procede, los errores y la precarga no habilitan
  desplazamiento del contenedor externo. No ocultar mensajes ni controles.
  El PDF recién generado/subido se conserva en memoria privada durante
  45 segundos ÚNICAMENTE tras recibir confirmación del servidor de Drive/DB;
  así el chip puede mostrarlo sin redescargar. Los PDF existentes se anticipan
  al seleccionar el chip y se conservan los guards de QMS, sin cookies Google.
  Publicar sin PDF genera toast rojo «Es necesario adjuntar un informe antes de
  publicar» y NO finaliza la queja. Volver conserva el borrador del correo.
- Debajo: correo de acompañamiento independiente y editable, dirigido al interesado,
  asunto con guion y folio; resultados/fundamentos en el informe adjunto y consultas
  a `gc@eca.or.cr`. Límites compartidos: asunto 180, mensaje 3.500 caracteres.
- Guardar borrador es remoto/versionado; Publicar respuesta es la acción final desde
  esa ventana, también para No Procede. No añadir otro texto o confirmación obligatoria
  de justificación después de que el usuario ya preparó correo e informe.
- El documento físico Word/PDF viaja en el correo final. El seguimiento temporal no
  reemplaza el adjunto; no incluir su botón en el mensaje final. `sent` confirma
  aceptación del servicio de envío, no lectura ni ubicación garantizada en inbox.

Fuentes: `QuejaInformeModal`, `QuejaRespuestaClienteModal`, `QuejaCorreoEditor`,
`useQuejaInforme`, `useQuejaRespuestaCliente`, `quejaInformeService`,
`quejaWorkflowService`, `quejaInforme*` y `quejaCorreo`. Contrato de referencia en
[revisión/respuesta](../quejas-revision-y-respuesta-2026-11-04.md);
estado y evidencias actuales en
[checklist 13/11](../quejas-checklist-aceptacion-2026-11-13.md).

## Formulario público, evidencias y seguimiento

- Cliente/API comparten `publicQuejaValidation`: nombre 50, correo 254, teléfono 25,
  descripción 10.000. Nombre con letras/tildes y signos admitidos, sin números;
  teléfono con dígitos/signos, sin letras ni marcas invisibles. No reducir email a 25.
- Errores de campo mediante `setCustomValidity`/`reportValidity`: aviso nativo junto
  al campo, foco/scroll y mensaje accesible, que se limpia al corregir. Sin toast
  para campos ni ayudas permanentes debajo. Errores operativos quedan en el pie.
- Formulario público normal de 860px máximos, dos columnas desde sm y una en móvil;
  descripción ampliable, scroll de página y tarjeta institucional centrada.
  La variante `?embed=1` conserva su contrato propio para WordPress.
  PR #65: `FormularioQuejaPublica.tsx` usa `data-public-form-loading`,
  la misma tarjeta/encabezado y skeleton de campos, descripción, evidencias
  y botón, reservando la geometría completa desde el inicio; evitar saltos
  y el skeleton genérico corto. Rótulos: «Registro de solicitud», «Enviar
  solicitud» y «Solicitud registrada». No alterar validación ni idempotencia.
- Hasta diez evidencias públicas PDF/JPEG/PNG, máximo 4 MiB por archivo. Gateway
  valida bytes/tipo/contenido, tamaño, cuotas y capacidades; no confiar en extensión,
  MIME declarado o validación del navegador. BotID/WAF y accesos legacy cerrados se
  conservan. Las restricciones del canal público no sustituyen el contrato interno.
- Registro/subida/finalización son idempotentes. Conservar folio, submissionId,
  uploadId y capacidad al reintentar; no finalizar mientras falte confirmar un archivo.
  Mostrar error seguro por archivo y en el pie; no presentar una carga fallida como éxito.
- Un único reintento automático de evidencias ante red/502/503/504, backoff abortable
  de 500ms y misma identidad de carga. Formato, permiso, cuota, capacidad vencida,
  reserva pendiente y privacidad no se reintentan a ciegas. Nunca duplicar folio/archivo.
- PDF: no confundir bytes de fuentes sfnt con acciones ni un destino de vista/zoom
  `OpenAction` con código ejecutable. Se permiten destinos cerrados y acotados;
  acciones JS/Launch/diccionarios/referencias ambiguas siguen rechazadas. No atribuir
  un fallo a contraseña/contenido activo sin haber determinado esa causa. No prometer
  antivirus ni aceptación universal de cualquier PDF.
- Seguimiento automático por capacidad privada, nunca solo por folio; sin PII,
  evidencias/notas internas ni caché. El enlace autoriza a su portador, no verifica
  identidad. BotID se comprueba antes de consultar/descargar en backend.
- Caduca 30 días naturales desde el primer No Procede/Finalizado; Resuelto no inicia
  el plazo. Consultar/reabrir no renueva el acceso ni borra expediente/evidencias.
  Recuperar un enlace pendiente no repite registro/adjuntos.
- Seguimiento (`PublicTrackingPage.tsx`) conserva la tarjeta institucional
  con logo y pie interno: `data-public-tracking-card`, altura estable en
  escritorio `min(680px,calc(100dvh-3rem))` y scroll interior en
  `data-public-tracking-scroll`; móvil con scroll natural. Cuatro filas fijas:
  Recepción, Investigación, Respuesta y Cierre. Solo marcar verde si existe
  evento real; sin evento, «Pendiente» o «Sin registro» en estado terminal.
  Nunca inventar investigación, fecha ni aprobación en No Procede.
  Respuesta extensa dentro del scroll; no repetir fecha de recepción.
  Sin «Actualizar estado», «Copiar enlace» ni descarga de informe en esa
  vista. Quitar UI no revoca capacidades ni endpoints.
- El propietario confirmó el reintento del PDF original y la lectura remota verificó
  un adjunto completo con checksum coincidente. Excluyó recuperar la evidencia antigua
  de otro folio; no recrearla ni generar quejas de prueba para compensar esa exclusión.

Contrato y activación: [formulario/correo del 10 noviembre](../quejas-formulario-correo-inmediato-2026-11-10.md).
Seguridad y capacidad: [formularios públicos](../seguridad-formularios-publicos.md) y
[seguimiento/publicación](../quejas-seguimiento-y-publicacion-2026-10-16.md).

### Gateway y evidencias: reglas complementarias

- Metadata por GET/API, token exacto/activo/modulo Quejas; no lista otros enlaces ni devuelve IDs internos. El cliente usa TIPOS_REGISTRO_QUEJA: Queja, Observación, Sugerencia, Reclamo y Felicitación; 'Denuncia' sobrevive solo como valor histórico en DB. El ciudadano selecciona tipo; GC asigna área internamente.
- Orden: POST crear devuelve folio/capacidad → subir cada evidencia por API → POST finalizar. El navegador no llama Supabase RPC en este flujo. El ciudadano conserva su folio aunque falle una evidencia. Datos, progreso y reintentos permanecen en el mismo formulario durante la subida. Solo al confirmar todos los adjuntos y la finalización se sustituye por la tarjeta de éxito con el folio. La geometría y los controles se describen en [visual](visual.md).
- Seguimiento activo desde el 19 octubre: la finalización distingue disabled/available/pending, y solo available entrega URL validada. Reintentar el enlace no repite alta ni uploads. La página informativa no pide contraseña/folio; el enlace privado abre automáticamente. Ver [contrato y límites](../quejas-seguimiento-y-publicacion-2026-10-16.md).
- UUID de envío y hash normalizado reclaman una única queja antes del folio. Un reintento incierto conserva ID y cuerpo; un mismo ID con contenido diferente produce conflicto. No recrear la queja para reintentar archivos.
- Cada archivo tiene uploadId estable. Reintentar una subida confirmada recupera su recibo; las pendientes no abren otra escritura Drive. El cliente reintenta solo los archivos fallidos y mantiene la capacidad únicamente en memoria.
- La capacidad firmada liga formulario/envío/queja y vence a los 30 minutos por emisión. Recuperar un envío antiguo exige verificar de nuevo BotID, formulario activo y mismo contenido antes de emitir otra; no se acepta una capacidad expirada. Finalizar no revoca una capacidad vigente: permite recuperar evidencias mientras la queja siga Recibido y el formulario activo.
- Finalización bloquea reservas pendientes y evita duplicar notificaciones/mail_queue. La cola no implica que se haya enviado correo.
- Público acepta solo PDF/JPEG/PNG, **4 MiB por archivo y diez archivos**, también bajo concurrencia. Nombre/email/descripción son obligatorios; teléfono opcional. Sus límites vigentes son 50/254/10000/25 (nombre/correo/descripción/teléfono). JSON limitado a 64 KiB reales; multipart a 4 MiB +128 KiB. Honeypot y propiedades administrativas se rechazan.
- Validación de archivo comprueba firma/estructura y límites de descompresión; rechaza acciones PDF identificadas, PDF cifrado y PNG animado. Es una validación acotada, no un antivirus.
- Reservar en DB precede a Drive. Comprueba permisos de raíz y carpeta del folio, rechazando acceso anyone; la subida no crea permisos públicos. Resultado incierto Drive/DB conserva la reserva hasta reconciliación manual: no liberar cuota ni borrar un archivo que pudo quedar registrado.
Archivos internos comparten transporte, pero tienen su propia allowlist y autorización:

- Archivos nuevos van a **Google Drive**, no a Storage. Raíz configurable por drive_folder_id_quejas, subcarpeta por folio; evidencias ciudadanas en raíz del folio e investigación interna en Analisis/.
- Límite interno **4 MiB** por archivo y cuerpo multipart +128 KiB. Su allowlist incluye PDF, JPEG, PNG, WebP, Word DOC/DOCX, Excel XLS/XLSX y texto; la pública es más pequeña.
- Upload Drive usa multipart/related con fetch/undici, Content-Length y timeout de 55 s; normaliza accessToken string/objeto. googleapis sirve para JWT, carpetas, descarga y eliminación.
- Metadatos conservan dual-write nombre/nombre_archivo y storage_path/url_archivo. La reserva pública guarda drive:ID; el parche de compatibilidad aplicado guarda ID limpio en queja_adjuntos para los consumidores actuales. esDrive(path) detecta ID sin /; paths con / siguen el bucket privado legacy quejas-adjuntos.
- Descarga y vista previa: Blob local privado autorizado; Storage legacy
  usa descarga autenticada, no iframe ni enlace externo. Ver datos/visual.
- Evidencias visibles en todos los estados; subida de investigación solo durante En Investigación. Eliminación del ciudadano solo admin; de análisis staff o responsable, con confirmación.
- Eliminar: **papelera Drive confirmada primero, fila después**. El shared drive permite canTrash, no borrado permanente con esta credencial. Un 404 de delete no demuestra ausencia; si falla o el resultado es incierto se conserva la fila. Un archivo ya en papelera se verifica dentro del expediente para reintentar la retirada de metadatos, sin habilitar su descarga.
- programarContextoDrive usa next/server.after, webhook opcional con folderId, hasta tres intentos, timeout 8 s y pausas crecientes. Apps Script es externo; el repo integra la invocación, no su despliegue.

### Configuración y catálogos

- `app/configuracion/page.tsx` organiza navegación/guard/montaje. Paneles: General, Catálogos, SLA, Calendario, Vistas, Formularios, IA. `DeferredMount` monta una sección al visitarla y conserva borradores; hooks de editores usan enabled=active. IA se monta al abrir y su gestor mantiene carga propia.
- Servicios de escritura en `configuracionService.ts`; validaciones en `lib/utils/configuracion.ts`. General conserva el tipo JSON del valor y excluye `ai_*`; zona horaria tiene editor/endpoint propios.
- Catálogos: cascada modulo→tipo, orden/color/activo. En selectores activos usar `.or('activo.is.null,activo.eq.true')`; el editor muestra también inactivos.
- La DB agregó `codigo` y `valor_interno`: código/interno son inmutables; etiqueta/color editables. `qms_catalog_guard` impide DELETE, cambio de módulo/tipo y creación/desactivación arbitraria de estados.
- El servicio/UI legacy aún intenta borrar filas y no integra completamente códigos internos. Al corregirlo, ofrecer desactivación/historial; no quitar el trigger para hacer funcionar el botón.
- SLA legacy escribe `sla_config`: días enteros, alerta>=0, vencimiento>=1 y alerta<=vencimiento. **No publica `qms_stage_versions` ni calendarios**; ver motor real de DB.
- Calendario laboral publica días/feriados confirmados
  mediante qms_publish_calendar con revisión capturada, motivo y auditoría. No añade
  fechas por defecto ni cambia 3/15 días. Afecta nuevas etapas, incluso de casos existentes;
  conserva etapas abiertas. Ver [editor, permisos y límites](../calendario-qms-2026-10-15.md).
- Roles y permisos vive en Usuarios; hace upsert por rol/módulo; requiere Ver antes de Editar y bloquea Configuración para admin. Los permisos del store se recargan al recuperar sesión/vista, no hay suscripción dedicada a cambios de permisos.
- Formularios: crear/copiar URL/activar/desactivar/eliminar con confirmación, solo admin activo. La lectura ciudadana pasa por GET/API. El corte público del 9 octubre cerró la lectura anónima directa; administración consulta con su autorización. Los formularios con envíos registrados quedan protegidos por FK: desactivar antes que borrar.
- Zona horaria: clave `org.zona_horaria`, fallback America/Costa_Rica; GET para cualquier perfil activo, PUT admin, validación Intl. La configuración se usa en análisis/helpers conectados; no todos los widgets ni el motor QMS usan esa clave.
- Marca institucional: `org.logo_url` guarda la URL pública del objeto vigente en el bucket `branding`. El menú lateral usa `EmpresaLogo`: con logo muestra la imagen sola (sin fondo ni círculo, conservando la transparencia) y sin logo, la inicial «E» en un círculo azul. Configuración ofrece subir, centrar y quitar, solo admin real. El recorte cuadrado se resuelve en el cliente y la API revalida tipo/peso antes de escribir con service role.

### Otros módulos

- SACP: alta con folio, tipo, descripción y fecha límite; estado Abierta, avance 0. Avance 100→En Validación. El botón de cierre se muestra desde En Validación y escribe Cerrada/100; la UI no sustituye una máquina de estados transaccional de DB.
- Origen/origen_id se escriben en derivación desde quejas. Eficacia, validado_por_gc, notas, responsabilidad y prioridad no tienen edición completa en el flujo actual de SACP.
- Riesgos: probabilidad×impacto con escala 1–3. <=2 Bajo, <=4 Medio, <=6 Alto, >6 Crítico; matriz 3×3. Alta directa de atributos y nivel.
- Auditorías: alta con folio (manual o automático en el INSERT), tipo/área/fechas/objetivo/alcance. Hallazgos asociados solo se listan; badge derivado_sacp_id no implementa derivación.
- Documentos: alta con código/título, versión 1.0 y Borrador; `generar_folio_documento` existe pero no se usa aquí. Cambiar versión solo actualiza `documentos.version_actual`; el historial muestra un placeholder y no inserta versiones.
- Consecutivos automáticos desde el 11 noviembre: año de registro CR y contador por módulo/año, mínimo tres dígitos sin truncar; SACP/Auditorías/Riesgos omiten folio vacío para asignarlo transaccionalmente. Los RPC previos siguen compatibles para el cliente publicado y los códigos manuales se conservan. DB aplicada; consultar estado web en verificación. [contrato](../consecutivos-anuales-2026-11-11.md).
- Revisión por Dirección: altas/listado/detalle de reuniones, agenda/fechas. Acta Pendiente/Registrada con texto e icono estático; no usar spinner para un estado permanente. No se implementa un gestor de actas o acuerdos con Drive completo.
- Reportería: módulos Quejas/SACP/Documentos/Auditorías/Riesgos/Revisión; filtros de fechas/estado/tipo (sin prioridad en Quejas). Lee lotes de 500 ordenados por id, tope 5000 filas y exige restringir filtros al superarlo. `window.print`/CSS de impresión; no persiste informes_config.
- Usuarios: ver [sesión y permisos](sesion-y-permisos.md) para el contrato vigente de administración, acceso y borrado.
- Cambio de contraseña propia: seguir el contrato de acceso temporal o contraseña ordinaria; sin service role en navegador.

## Contrato de altas operativas

Procesos, Auditorías, Riesgos, Reuniones, SACP y Documentos usan un lock síncrono contra doble envío, validación de campos obligatorios recortados y fechas/escalas según formulario, try/catch/finally y error accesible. El borrador se conserva tras fallar y no se permite cerrar durante una escritura. Si el INSERT tuvo éxito y el refresco falla, comunicar que se guardó; no invitar a crear una segunda fila. `lib/utils/operationalFormValidation.ts` es la validación compartida.
