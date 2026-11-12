# Módulos y flujos de negocio

**Contrato vigente de Quejas/Mis Quejas al 10 noviembre:** [AGENTS.md](../../AGENTS.md)
consolida lógica y presentación actuales; [panel](../quejas-panel-2026-10-13.md),
[respuesta](../quejas-revision-y-respuesta-2026-11-04.md) y
[formulario/correo](../quejas-formulario-correo-inmediato-2026-11-10.md) detallan las
correcciones posteriores. Lecturas anteriores de esta página conservan su fecha:
no restaurar los tres tabs, el segundo selector de área, el modal duplicado de
justificación, el informe como cuerpo del correo ni el despertador desactivado.
El cliente web sigue local; DB/Edge v17/Apps Script v5 del correo por evento están
activos según la evidencia fechada. Esta actualización no es una auditoría remota.

4 noviembre, cliente local: [revisión GC y respuesta separadas](../quejas-revision-y-respuesta-2026-11-04.md).
Aprobar pasa a Resuelto sin publicar; el borrador persiste y Publicar respuesta pasa
a Finalizado. Devolver exige motivo y conserva propuesta/plazo. No Procede y las
publicaciones históricas conservan su contrato. Estado remoto y QA en la referencia.

20 octubre: [dos correos ciudadanos y reintentos](../quejas-dos-correos-y-reintentos-2026-10-20.md).
La política de correo se aplicó en DB y se actualizaron Edge/Apps Script; el arreglo
web del formulario público permanece local, sin publicar. La entrega del 19 siguiente
conserva su alcance y evidencia.

19 octubre, publicado y activado: [Mis Quejas, seguimiento privado y publicación final](../quejas-seguimiento-y-publicacion-2026-10-16.md)
incorpora el workspace del responsable y la revisión/publicación de respuesta y oficio
por Calidad. El análisis es borrador de visita; la propuesta enviada persiste. El estado
público exige capacidad privada, sin PII, notas o evidencias internas. Esto amplía la
consulta de estado; no incorpora cuentas ni comentarios ciudadanos. La referencia
fechada registra web, migración, cortes y emisor activos; falta aceptación institucional.

> Contratos generales revisados el 8 de octubre de 2026; Quejas/formulario/correo actualizados al 14 octubre según código y evidencia fechada. El inventario general conserva el snapshot remoto del 7 de octubre, con las ampliaciones indicadas abajo. No es una nueva auditoría remota. El estado de producción se registra por separado en [la guía del formulario público](../seguridad-formularios-publicos.md).
> La tabla describe capacidades observadas, no porcentajes de avance. Cuenta como integrada
> una capacidad conectada a usuarios/ruta/API según corresponda y con su flujo validado;
> no basta con que existan archivos, tablas DB, prototipos o utilidades sin consumidores.

| Ruta | Qué monta y hace hoy | Límite / pendiente |
| --- | --- | --- |
| `/` | PageHeader, QuejasSummary lazy/Suspense, indicadores por módulo, ocho expedientes próximos y actividad real | No monta los tabs analíticos alternativos |
| `/quejas` | Tabla con filtros, paginación, tipo/estado, vencimiento por etapa, vistas locales, precarga de adjuntos, alta y detalle | Edición y transición por wrappers QMS con revisión esperada; oficio/área/observaciones integrados |
| `/mis-quejas` | Filtra responsable_id=usuario real, workspace con resolución integrada y consulta de Análisis en modal | Guardar conserva un borrador remoto; Enviar a GC es independiente. Cambios sin guardar son locales; sin adoptar otro responsable simulando rol. [Contrato](../mis-quejas-borrador-resolucion-2026-11-11.md) |
| `/configuracion` | Siete secciones agrupadas en Organización/Acceso/Servicios; solo admin | Editor de SLA legacy no publica versiones QMS |
| `/procesos` | Listado paginado y alta nombre/tipo/objetivo/estado | Documentos vinculados/KPIs no constituyen un gestor completo |
| `/auditorias` | Listado paginado, alta y modal de hallazgos asociados | Hallazgos de solo lectura, sin CRUD/derivación UI |
| `/riesgos` | Listado paginado, alta y matriz 3×3 | No hay motor completo de seguimiento de mitigaciones |
| `/revision` | Reuniones paginadas, alta y detalle | Acta Drive/acuerdos no tienen workflow documental completo |
| `/documentos` | Todos/Maestra(Publicado)/Edición(Borrador), alta y cambio directo de version_actual | Historial placeholder, sin versionado/Drive completo |
| `/sacp` | Listado paginado, alta, porcentaje de seguimiento y cierre | Validación avanzada/eficacia y campos administrativos incompletos |
| `/usuarios` | Solo admin, búsqueda diferida/rol/estado, alta/edición/eliminación/reset mediante API | API valida rol/estado/tipos antes de efectos; último admin aún sin bloqueo transaccional distribuido |
| `/reporteria` | Wizard módulo→filtros→tabla/resumen/distribución/vencidos e impresión | No guarda informes_config ni envía/exporta documentos por un servicio |
| `/q/[token]` | Cliente ciudadano HTTP, creación/reintentos idempotentes, capacidad temporal y evidencias limitadas | Gateway/corte público del 9 octubre; cliente de seis tipos/correo obligatorio y presentación refinada publicados el 19. Área se asigna internamente |
| `/login` | Email/password Supabase + resolución de perfil y acceso | No signup/recuperación pública completos en la UI actual |

### Dashboard activo

- `useDashboardIndicadores`/`useDashboardTareas` usan `useQueries` y **comparten cuatro consultas** bajo `['dashboard','recurso',nombre]`: Quejas, Acciones, Documentos y Riesgos.
- Quejas y Acciones devuelven count exacto + ocho filas ordenadas por vencimiento; Documentos y Riesgos usan HEAD/count. Las tareas combinan las dos listas y eligen los ocho vencimientos más próximos, poniendo sin fecha al final.
- Indicadores: Quejas fuera de Finalizado/No Procede/Cerrada, SACP no Cerrada, documentos Borrador y riesgos Activo.
- Un fallo/lentitud de Documentos no bloquea las tareas de Quejas/SACP. `DashboardLoading.tsx` muestra skeletons proporcionales al contenido (summary/modules/table/activity), con role=status y texto solo para lectores de pantalla, respetando movimiento reducido. Formas de cantidad fija, sin animaciones por registro ni tarjetas anidadas. Cada bloque se revela en cuanto está listo; reintento por bloque.
- Los listados/lecturas de detalle y las operaciones comparten el contrato de carga descrito en visual.md y ../visual-patterns.md.
- Actividad: últimas cinco filas de `quejas_actividad`, orden `created_at desc, id`; **no está hardcodeada**.
- QuejasSummary dibuja SVG para resolución dentro de plazo, procedencia y volumen total/mes; usa `obtener_estadisticas_quejas` y permiso de quejas. El RPC es SECURITY INVOKER y respeta RLS.
- La lectura combinada legacy `fetchDashboard/useDashboard` fue retirada; la página conserva las cuatro opciones compartidas y sus bloques independientes.
- El dashboard monta solo los bloques descritos aquí. Las variantes analíticas históricas no definen la composición actual; revisar consumidores antes de integrar otro diseño.

### Workflow de Quejas vigente (revisado al 14 octubre)

Ver [preparación del lanzamiento](../quejas-lanzamiento-2026-10-09.md) para evidencia y activación pendiente.

- Lecturas: qms_quejas, con fecha/tipo automático, campos GC y vencimiento por etapa.
- Registro GC: qms_update_complaint_register con revisión editada, área de catálogo,
  oficio institucional único y observaciones históricas. La UI edita solo el área desde
  Datos de la solicitud y conserva los otros campos del mismo snapshot/revisión.
  qms_save_complaint_area crea/reactiva una opción bajo lock; conserva borrador y
  ámbito de QueryClient si falla o cambia visita.
  Añadir solo amplía el catálogo: mantiene selección y desplegable; Guardar selección
  asigna al expediente después de elegir. No se seleccionan automáticamente las altas.
- Workflow: qms_transition_complaint guarda decisión, oficio y formatos atómicamente,
  valida el expected original bajo lock y llama al motor con la revisión de su propia escritura.
  qms_update_details conserva asignación/notas, ahora con guard de escritura por módulo.
  Nunca recuperar otra revisión para forzar un reintento de un conflicto 40001.
- Recibido → investigación exige justificación/responsable; No Procede requiere resolución
  y oficio explicativo. Investigación → revisión GC → Resuelto exige aprobación GC y oficio
  de resolución. Resuelto → Finalizado no envía otro correo. Reapertura exige motivo.
- Etapas nuevas: 3/15 días hábiles. Revisar/devolver en GC no reinicia 15 días. Los snapshots
  históricos se conservan; calendario actual sin feriados. Avisos QMS activos desde
  el 14 octubre mediante el poll independiente de Apps Script.
- Prioridad retirada de la UX de Quejas, sin borrar datos ni prioridades de otros módulos.
  Opciones de estado comparten IDs canónicos, etiquetas/colores configurables en catálogo.
- Observaciones concentra el seguimiento de Actividad en quejas_comentarios; tipo y
  visibilidad conservan su contrato. El texto histórico qms_quejas.observaciones se lee
  una vez en la misma sección, sin inventar autor/fecha ni migrarlo. Las notas de
  investigación de Mis Quejas siguen en quejas_actividad: son un contrato distinto.
- Oficio se captura al declarar No Procede o resolver/aprobar; no hay un campo vacío
  en recepción. Un oficio existente sigue visible con la resolución, incluso tras
  reapertura; no se genera una numeración nueva.
- Panel derecho ampliable y Actividad independiente; las decisiones/revisión usan diálogo
  xl con acciones al pie. Tiptap lazy, límite 10.000 y formato explícito plain/markdown. El lector mantiene
  notas antiguas literales y no interpreta HTML. Justificación nueva se conserva por separado.
  El lector compartido `lib/utils/quejaContent.ts` omite solo la copia plain exacta
  `[Procede]` que el motor histórico agregó cuando el mismo texto ya está en
  `justificacion_procede`. No cambia datos persistidos ni deduce Markdown de notas:
  conserva análisis distintos, reaperturas y documentos Markdown explícitos del autor.
- Vencimiento relativo: conserva la fecha persistida; el panel cuenta el snapshot hábil
  de la ejecución y usa días naturales si falta. Ver [panel y correo](../quejas-panel-y-correo-2026-10-12.md).
- Respuestas tardías solo reemplazan una visita/ámbito vigente; escrituras confirmadas invalidan
  su origen y no limpian un borrador posterior. Evidencias conservan sus permisos/Drive.
- Dos correos ciudadanos desde el 20 octubre: recibido y resultado final (No Procede
  o resolución de Calidad). Investigación queda en historial, sin nuevos envíos.
  [Servicio independiente](../seguridad-correos-quejas.md), DB/Edge
  Supabase y Apps Script, sin Vercel. Activador de cinco minutos, HMAC y diario privado;
  estado `sent` requiere MailApp y ACK DB, no solo encolado. Ver [evidencia](../correo-quejas-directo-2026-10-13.md).
- Avisos internos activados el 14 octubre por el mismo poll: recepción/evaluación a Calidad,
  asignación al responsable, investigación a 5 días a Calidad y a 3 días a ambos,
  vencidos según etapa. Sin backfill de vencimientos históricos, sin reiniciar plazos
  al reasignar y sin usar el correo ciudadano como destinatario interno. Ver [calendario,
  elegibilidad y límites](../avisos-internos-quejas-2026-10-14.md). La mejora de sonido
  entre pestañas sigue local hasta publicar el cliente.
- Corte del 19 octubre: qms_transition legacy ya no tiene EXECUTE cliente. El cliente
  compatible usa wrappers con revisión; no restaurar una versión que dependa del RPC cerrado.

### Formulario público y archivos

El flujo nuevo del repositorio se describe en [seguridad de formularios públicos](../seguridad-formularios-publicos.md).
Gateway y corte público activados el 9 octubre; las correcciones del cliente y el
seguimiento quedaron publicados el 19 octubre, junto con el corte del workflow
interno qms_transition. Son contratos distintos y ambos permanecen cerrados.

- Metadata por GET/API, token exacto/activo/modulo Quejas; no lista otros enlaces ni devuelve IDs internos. El cliente nuevo usa TIPOS_REGISTRO_QUEJA: Queja, Observación, Sugerencia, Reclamo y Felicitación; 'Denuncia' sobrevive solo como valor histórico en DB. El ciudadano selecciona tipo; GC asigna área internamente.
- Orden: POST crear devuelve folio/capacidad → subir cada evidencia por API → POST finalizar. El navegador no llama Supabase RPC en este flujo. El ciudadano conserva su folio aunque falle una evidencia. Datos, progreso y reintentos permanecen en el mismo formulario durante la subida. Solo al confirmar todos los adjuntos y la finalización se sustituye por la tarjeta de éxito con el folio. Adjuntar/contador comparten una fila; la lista aparece solo al seleccionar y llega hasta dos filas con scroll. Tarjeta hasta 100dvh − 48 px y pie separado sin overlay; en pantallas bajas solo los campos se desplazan. [Presentación actualizada al 16 octubre](../formulario-publico-visual-2026-10-14.md).
- Seguimiento activo desde el 19 octubre: la finalización distingue disabled/available/pending, y solo available entrega URL validada. Reintentar el enlace no repite alta ni uploads. La página informativa no pide contraseña/folio; el enlace privado abre automáticamente. Ver [contrato y límites](../quejas-seguimiento-y-publicacion-2026-10-16.md).
- UUID de envío y hash normalizado reclaman una única queja antes del folio. Un reintento incierto conserva ID y cuerpo; un mismo ID con contenido diferente produce conflicto. No recrear la queja para reintentar archivos.
- La corrección de reintentos del cliente del 20 octubre se verificó en local y sigue
  sin publicar; no modifica el despliegue web del 19. Su alcance y evidencia están
  en [la entrega del 20 octubre](../quejas-dos-correos-y-reintentos-2026-10-20.md).
- Cada archivo tiene uploadId estable. Reintentar una subida confirmada recupera su recibo; las pendientes no abren otra escritura Drive. El cliente reintenta solo los archivos fallidos y mantiene la capacidad únicamente en memoria.
- La capacidad firmada liga formulario/envío/queja y vence a los 30 minutos por emisión. Recuperar un envío antiguo exige verificar de nuevo BotID, formulario activo y mismo contenido antes de emitir otra; no se acepta una capacidad expirada. Finalizar no revoca una capacidad vigente: permite recuperar evidencias mientras la queja siga Recibido y el formulario activo.
- Finalización bloquea reservas pendientes y evita duplicar notificaciones/mail_queue. La cola no implica que se haya enviado correo.
- Público acepta solo PDF/JPEG/PNG, **4 MiB por archivo y diez archivos**, también bajo concurrencia. Nombre/email/descripción son obligatorios; teléfono opcional. Sus límites son 150/254/10000/40; el correo obligatorio quedó publicado el 19 octubre. JSON limitado a 64 KiB reales; multipart a 4 MiB +128 KiB. Honeypot y propiedades administrativas se rechazan.
- Validación de archivo comprueba firma/estructura y límites de descompresión; rechaza acciones PDF identificadas, PDF cifrado y PNG animado. Es una validación acotada, no un antivirus.
- Reservar en DB precede a Drive. Comprueba permisos de raíz y carpeta del folio, rechazando acceso anyone; la subida no crea permisos públicos. Resultado incierto Drive/DB conserva la reserva hasta reconciliación manual: no liberar cuota ni borrar un archivo que pudo quedar registrado.

Archivos internos comparten transporte, pero tienen su propia allowlist y autorización:

- Archivos nuevos van a **Google Drive**, no a Storage. Raíz configurable por drive_folder_id_quejas, subcarpeta por folio; evidencias ciudadanas en raíz del folio e investigación interna en Analisis/.
- Límite interno **4 MiB** por archivo y cuerpo multipart +128 KiB. Su allowlist incluye PDF, JPEG, PNG, WebP, Word DOC/DOCX, Excel XLS/XLSX y texto; la pública es más pequeña.
- Upload Drive usa multipart/related con fetch/undici, Content-Length y timeout de 55 s; normaliza accessToken string/objeto. googleapis sirve para JWT, carpetas, descarga y eliminación.
- Metadatos conservan dual-write nombre/nombre_archivo y storage_path/url_archivo. La reserva pública guarda drive:ID; el parche de compatibilidad aplicado guarda ID limpio en queja_adjuntos para los consumidores actuales. esDrive(path) detecta ID sin /; paths con / siguen el bucket privado legacy quejas-adjuntos.
- Descarga Drive: fetch Bearer al endpoint, streaming→Blob→ObjectURL→download. Legacy: URL firmada 60 s. Preview: iframe Drive inmediato, como antes, sin descargar bytes ni skeleton; Google exige sus propios permisos/sesión. Storage legacy usa URL firmada. Cerrar/cambiar evidencia desmonta su visita; clics repetidos no reinician el iframe.
- Evidencias visibles en todos los estados; subida de investigación solo durante En Investigación. Eliminación del ciudadano solo admin; de análisis staff o responsable, con confirmación.
- Eliminar: **papelera Drive confirmada primero, fila después**. El shared drive permite canTrash, no borrado permanente con esta credencial. Un 404 de delete no demuestra ausencia; si falla o el resultado es incierto se conserva la fila. Un archivo ya en papelera se verifica dentro del expediente para reintentar la retirada de metadatos, sin habilitar su descarga.
- programarContextoDrive usa next/server.after, webhook opcional con folderId, hasta tres intentos, timeout 8 s y pausas crecientes. Apps Script es externo; el repo integra la invocación, no su despliegue.

### Configuración y catálogos

- `app/configuracion/page.tsx` organiza navegación/guard/montaje. Paneles: General, Catálogos, SLA, Calendario, Roles, Vistas, Formularios, IA. `DeferredMount` monta una sección al visitarla y conserva borradores; hooks de editores usan enabled=active. IA se monta al abrir y su gestor mantiene carga propia.
- Servicios de escritura en `configuracionService.ts`; validaciones en `lib/utils/configuracion.ts`. General conserva el tipo JSON del valor y excluye `ai_*`; zona horaria tiene editor/endpoint propios.
- Catálogos: cascada modulo→tipo, orden/color/activo. En selectores activos usar `.or('activo.is.null,activo.eq.true')`; el editor muestra también inactivos.
- La DB agregó `codigo` y `valor_interno`: código/interno son inmutables; etiqueta/color editables. `qms_catalog_guard` impide DELETE, cambio de módulo/tipo y creación/desactivación arbitraria de estados.
- El servicio/UI legacy aún intenta borrar filas y no integra completamente códigos internos. Al corregirlo, ofrecer desactivación/historial; no quitar el trigger para hacer funcionar el botón.
- SLA legacy escribe `sla_config`: días enteros, alerta>=0, vencimiento>=1 y alerta<=vencimiento. **No publica `qms_stage_versions` ni calendarios**; ver motor real de DB.
- Calendario laboral (cliente local del 15 octubre) publica días/feriados confirmados
  mediante qms_publish_calendar con revisión capturada, motivo y auditoría. No añade
  fechas por defecto ni cambia 3/15 días. Afecta nuevas etapas, incluso de casos existentes;
  conserva etapas abiertas. Ver [editor, permisos y límites](../calendario-qms-2026-10-15.md).
- Roles y Accesos hace upsert por rol/módulo; requiere Ver antes de Editar y bloquea Configuración para admin. Los permisos del store se recargan al recuperar sesión/vista, no hay suscripción dedicada a cambios de permisos.
- Formularios: crear/copiar URL/activar/desactivar/eliminar con confirmación, solo admin activo. La lectura ciudadana pasa por GET/API. El corte público del 9 octubre cerró la lectura anónima directa; administración consulta con su autorización. Los formularios con envíos registrados quedan protegidos por FK: desactivar antes que borrar.
- Zona horaria: clave `org.zona_horaria`, fallback America/Costa_Rica; GET para cualquier perfil activo, PUT admin, validación Intl. La configuración se usa en análisis/helpers conectados; no todos los widgets ni el motor QMS usan esa clave.
- Marca institucional: `org.logo_url` guarda la URL pública del objeto vigente en el bucket `branding`. El menú lateral usa `EmpresaLogo`: con logo muestra la imagen sola (sin fondo ni círculo, conservando la transparencia) y sin logo, la inicial «E» en un círculo azul. Configuración ofrece subir, centrar y quitar, solo admin real. El recorte cuadrado se resuelve en el cliente y la API revalida tipo/peso antes de escribir con service role.

### Otros módulos

- SACP: alta con folio, tipo, descripción y fecha límite; estado Abierta, avance 0. Avance 100→En Validación. El botón de cierre se muestra desde En Validación y escribe Cerrada/100; la UI no sustituye una máquina de estados transaccional de DB.
- Origen/origen_id se escriben en derivación desde quejas. Eficacia, validado_por_gc, notas, responsabilidad y prioridad no tienen edición completa en el flujo actual de SACP.
- Riesgos: probabilidad×impacto con escala 1–3. <=2 Bajo, <=4 Medio, <=6 Alto, >6 Crítico; matriz 3×3. Alta directa de atributos y nivel.
- Auditorías: alta con folio (manual o automático en el INSERT), tipo/área/fechas/objetivo/alcance. Hallazgos asociados solo se listan; badge derivado_sacp_id no implementa derivación.
- Documentos: alta con código/título, versión 1.0 y Borrador; `generar_folio_documento` existe pero no se usa aquí. Cambiar versión solo actualiza `documentos.version_actual`; el historial muestra un placeholder y no inserta versiones.
- Consecutivos automáticos desde el 11 noviembre: año de registro CR y contador por módulo/año, mínimo tres dígitos sin truncar; SACP/Auditorías/Riesgos omiten folio vacío para asignarlo transaccionalmente. Los RPC previos siguen compatibles para el cliente publicado y los códigos manuales se conservan. DB aplicada, modales nuevos locales; [contrato](../consecutivos-anuales-2026-11-11.md).
- Revisión por Dirección: altas/listado/detalle de reuniones, agenda/fechas. Acta Pendiente/Registrada con texto e icono estático; no usar spinner para un estado permanente. No se implementa un gestor de actas o acuerdos con Drive completo.
- Reportería: módulos Quejas/SACP/Documentos/Auditorías/Riesgos/Revisión; filtros de fechas/estado/tipo (sin prioridad en Quejas). Lee lotes de 500 ordenados por id, tope 5000 filas y exige restringir filtros al superarlo. `window.print`/CSS de impresión; no persiste informes_config.
- Usuarios: GET API permite admin/Calidad (directorio de responsables); POST/PATCH/DELETE solo admin. Alta Auth+perfil y rollback de Auth al fallar el INSERT; comprobación de auto-desactivación/auto-rol/auto-borrado y del último admin activo (409). Esta última usa COUNT antes de la escritura, sin bloqueo transaccional de ambos administradores; no garantiza por sí sola el caso concurrente. Cambios Auth/perfil son llamadas separadas, no una transacción distribuida.
- UI y API de usuarios/reset usan `generatePassword()` criptográfico con composición y Fisher-Yates. La API usa `validarUsuarioInput` antes de cualquier efecto: roles admin/calidad/colaborador, estado activo/inactivo, tipos y UUID; rechaza valores desconocidos. Email se normaliza y la contraseña conserva sus caracteres. Email+contraseña se envían juntos a Auth; un reset exclusivo de contraseña no escribe un UPDATE vacío de perfil.
- Cambio de contraseña propia: `supabase.auth.updateUser`, sin service role en navegador.

## Contrato de altas operativas

Procesos, Auditorías, Riesgos, Reuniones, SACP y Documentos usan un lock síncrono contra doble envío, validación de campos obligatorios recortados y fechas/escalas según formulario, try/catch/finally y error accesible. El borrador se conserva tras fallar y no se permite cerrar durante una escritura. Si el INSERT tuvo éxito y el refresco falla, comunicar que se guardó; no invitar a crear una segunda fila. `lib/utils/operationalFormValidation.ts` es la validación compartida.
