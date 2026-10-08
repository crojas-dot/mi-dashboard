# Módulos y flujos de negocio

> Referencia vigente del código y del snapshot remoto del 7 de octubre de 2026. Consultar solo el tema que se modifica; una nota histórica no demuestra el estado de un despliegue nuevo.
> La tabla describe capacidades observadas, no porcentajes de avance. Cuenta como integrada
> una capacidad conectada a usuarios/ruta/API según corresponda y con su flujo validado;
> no basta con que existan archivos, tablas DB, prototipos o utilidades sin consumidores.

| Ruta | Qué monta y hace hoy | Límite / pendiente |
| --- | --- | --- |
| `/` | PageHeader, QuejasSummary lazy/Suspense, indicadores por módulo, ocho expedientes próximos y actividad real | No monta los tabs analíticos alternativos |
| `/quejas` | Tabla con filtros, paginación, categorías/estados/prioridades, antigüedad SLA, vistas locales, precarga de adjuntos, alta y detalle | Edición y transición por wrappers QMS con revisión esperada; SLA visual aún legacy |
| `/mis-quejas` | Filtra responsable_id=usuario real, tabla y panel fixed con Detalle/Análisis/Resolución | No permite adoptar otro responsable simulando rol |
| `/configuracion` | Siete secciones agrupadas en Organización/Acceso/Servicios; solo admin | Editor de SLA legacy no publica versiones QMS |
| `/procesos` | Listado paginado y alta nombre/tipo/objetivo/estado | Documentos vinculados/KPIs no constituyen un gestor completo |
| `/auditorias` | Listado paginado, alta y modal de hallazgos asociados | Hallazgos de solo lectura, sin CRUD/derivación UI |
| `/riesgos` | Listado paginado, alta y matriz 3×3 | No hay motor completo de seguimiento de mitigaciones |
| `/revision` | Reuniones paginadas, alta y detalle | Acta Drive/acuerdos no tienen workflow documental completo |
| `/documentos` | Todos/Maestra(Publicado)/Edición(Borrador), alta y cambio directo de version_actual | Historial placeholder, sin versionado/Drive completo |
| `/sacp` | Listado paginado, alta, porcentaje de seguimiento y cierre | Validación avanzada/eficacia y campos administrativos incompletos |
| `/usuarios` | Solo admin, búsqueda diferida/rol/estado, alta/edición/eliminación/reset mediante API | API valida rol/estado/tipos antes de efectos; último admin aún sin bloqueo transaccional distribuido |
| `/reporteria` | Wizard módulo→filtros→tabla/resumen/distribución/vencidos e impresión | No guarda informes_config ni envía/exporta documentos por un servicio |
| `/q/[token]` | Formulario ciudadano sin sesión, valida enlace, crea queja y adjunta evidencias | Tipo/área nuevos de DB no integrados en este formulario |
| `/login` | Email/password Supabase + resolución de perfil y acceso | No signup/recuperación pública completos en la UI actual |

### Dashboard activo

- `useDashboardIndicadores`/`useDashboardTareas` usan `useQueries` y **comparten cuatro consultas** bajo `['dashboard','recurso',nombre]`: Quejas, Acciones, Documentos y Riesgos.
- Quejas y Acciones devuelven count exacto + ocho filas ordenadas por vencimiento; Documentos y Riesgos usan HEAD/count. Las tareas combinan las dos listas y eligen los ocho vencimientos más próximos, poniendo sin fecha al final.
- Indicadores: Quejas fuera de Finalizado/No Procede/Cerrada, SACP no Cerrada, documentos Borrador y riesgos Activo.
- Un fallo/lentitud de Documentos no bloquea las tareas de Quejas/SACP. `DashboardLoading.tsx` muestra skeletons proporcionales al contenido (summary/modules/table/activity), con role=status y texto solo para lectores de pantalla, respetando movimiento reducido. Formas de cantidad fija, sin animaciones por registro ni tarjetas anidadas. Cada bloque se revela en cuanto está listo; reintento por bloque.
- Los listados/lecturas de detalle y las operaciones comparten el contrato de carga descrito en visual.md y ../visual-patterns.md.
- Actividad: últimas cinco filas de `quejas_actividad`, orden `created_at desc, id`; **no está hardcodeada**.
- QuejasSummary dibuja SVG para resolución dentro de plazo, procedencia y volumen total/mes; usa `obtener_estadisticas_quejas` y permiso de quejas. El RPC es SECURITY INVOKER y respeta RLS.
- `fetchDashboard`/`useDashboard` permanecen por compatibilidad, pero no son los hooks montados por la página activa.
- El dashboard monta solo los bloques descritos aquí. Las variantes analíticas históricas no definen la composición actual; revisar consumidores antes de integrar otro diseño.

### Workflow de quejas: cliente versionado y reglas vigentes

El cliente presenta `Recibido → No Procede | En Investigación → [Pendiente de Revisión GC] → Resuelto → Finalizado`; permite reapertura desde estados admitidos por DB. Reglas visibles:

- No Procede exige resolución/justificación; Procede exige justificación y responsable antes de iniciar investigación.
- Durante investigación el detalle presenta responsable fijo; un helper de selección permite actualizarlo en otras situaciones no Recibido. No afirmar que es inmutable en toda la DB.
- El colaborador escribe conclusión y envía a Pendiente de Revisión GC; GC aprueba Resuelto o devuelve a En Investigación. Finalización/reapertura son de staff; la DB decide permisos y transiciones.
- Comentarios internos/cliente y flag visible_cliente van por `agregar_comentario_queja`; el flag no implementa un portal de seguimiento ciudadano.
- Derivación a SACP en investigación/resuelto, idempotente por RPC: crea acción de origen queja y guarda derivado_sacp_id.
- Antigüedad visible del listado se calcula desde `fecha` con `sla_config` por prioridad (fallback 3/7 días); **no es la presentación del motor QMS de etapas**. `ahora` se captura con useState al montar; no hay actualmente interval de 60 s en esa página.
- `useQuejasVistas` persiste por usuario en localStorage, máximo 500 registros. Abrir marca en requestAnimationFrame; botón de no vistas marca las de la página. Ambos listados distinguen visualmente las no leídas.
- Mis Quejas conserva tabla min-width 1200px; panel fixed de ancho completo en móvil y 500px desde lg, expandible a ancho completo. Solo desde lg reserva margen `calc(500px - 16px)`; la tabla mantiene su ancho mínimo extra de 484px al abrir.

`quejaWorkflowService.ts` usa `qms_update_details(p_id,p_expected,p_categoria,p_prioridad,p_owner,p_notes)` y `qms_transition(p_id,p_expected,p_state,p_resolution,p_justification,p_owner,p_reopen)` con **la revisión que el usuario editó**. `Queja.revision` es obligatorio y se valida antes de enviar. Los códigos estables del workflow están en `CODIGOS_ESTADO_QUEJA`; los argumentos opcionales siempre se envían como null cuando no aplican.

El resultado actualizado reemplaza el expediente abierto solo si conserva el mismo id, y luego invalida los listados. Un conflicto 40001 avisa que otro usuario modificó el registro y exige revisar/refrescar; nunca leer una revisión fresca para reintentar silenciosamente ni reabrir permisos legacy. `reabrirQueja` usa también qms_transition con motivo. Las funciones legacy siguen cerradas para authenticated y son invocadas únicamente por los wrappers. Los atributos nuevos y el SLA visual todavía necesitan integración aparte.

### Formulario público y archivos

- Formulario público consulta `formularios_publicos` por token/activo. La UI actual exige una categoría fija: Queja, Denuncia, Sugerencia, Reclamo, Felicitación; no usa catálogo ni el tipo separado nuevo.
- Orden: `crear_queja_publica` devuelve folio → subir cada evidencia a `/api/drive/upload-public` → registrar con `registrar_adjunto_queja_publica` → `notificar_queja_publica(p_folio)`. El ciudadano recibe su folio aunque fallen evidencias; la UI avisa cuántas fallaron.
- Creación pública no dispara por sí sola la notificación legacy; se difiere hasta después de las evidencias. El RPC de notificación evita duplicados por tipo queja_nueva + origen_id, inserta notificaciones staff y mail_queue. No hay entrega de correo implementada.
- Registro público exige queja Recibido y aplica el tope de diez adjuntos; `usuario_id=NULL` identifica evidencia del ciudadano.
- Archivos nuevos van a **Google Drive**, no a Storage. Carpeta raíz configurable por `drive_folder_id_quejas`; subcarpeta por folio. Evidencias del ciudadano en raíz del folio; investigación interna en `Analisis/`.
- Límite vigente: **4 MiB por archivo** (`MAX_FILE_BYTES`); cuerpo multipart acotado a ese límite +128 KiB antes de interpretar FormData, incluso sin Content-Length. No restaurar el antiguo límite de 50 MB.
- MIME permitidos: PDF, JPEG, PNG, WebP, Word DOC/DOCX, Excel XLS/XLSX y texto. Vacío=400, exceso=413, MIME fuera de allowlist=415.
- Upload Drive usa multipart/related con fetch/undici, Content-Length y timeout de 55 s; normaliza accessToken string/objeto. googleapis sirve para JWT, carpetas, descarga y eliminación.
- Los metadatos conservan dual-write legacy: nombre/nombre_archivo, storage_path/url_archivo. `esDrive(path)` detecta ID sin `/`; paths con `/` siguen el bucket privado legacy `quejas-adjuntos`.
- Descarga Drive: fetch Bearer al endpoint, streaming→Blob→ObjectURL→download. Legacy: URL firmada 60 s. Preview: iframe Drive o blob/URL legacy; depende también de los permisos de Google.
- Evidencias visibles en todos los estados; subida de investigación solo durante En Investigación. Eliminación del ciudadano solo admin; de análisis staff o responsable, con confirmación.
- Eliminación segura actual: **borrar Drive primero, luego la fila**. Si Drive falla se conserva la fila y responde 502; Drive 404 se trata como éxito para reintentar una fila cuyo archivo ya desapareció. No es una eliminación fire-and-forget.
- `programarContextoDrive` usa `next/server.after`, webhook opcional con `{folderId}`, hasta tres intentos, timeout 8 s y pausas crecientes. El extractor Apps Script es externo; el repositorio integra su invocación, no su implementación/despliegue.

### Configuración y catálogos

- `app/configuracion/page.tsx` organiza navegación/guard/montaje. Paneles: General, Catálogos, SLA, Roles, Vistas, Formularios, IA. `DeferredMount` monta una sección al visitarla y conserva borradores; hooks de editores usan enabled=active. IA se monta al abrir y su gestor mantiene carga propia.
- Servicios de escritura en `configuracionService.ts`; validaciones en `lib/utils/configuracion.ts`. General conserva el tipo JSON del valor y excluye `ai_*`; zona horaria tiene editor/endpoint propios.
- Catálogos: cascada modulo→tipo, orden/color/activo. En selectores activos usar `.or('activo.is.null,activo.eq.true')`; el editor muestra también inactivos.
- La DB agregó `codigo` y `valor_interno`: código/interno son inmutables; etiqueta/color editables. `qms_catalog_guard` impide DELETE, cambio de módulo/tipo y creación/desactivación arbitraria de estados.
- El servicio/UI legacy aún intenta borrar filas y no integra completamente códigos internos. Al corregirlo, ofrecer desactivación/historial; no quitar el trigger para hacer funcionar el botón.
- SLA legacy escribe `sla_config`: días enteros, alerta>=0, vencimiento>=1 y alerta<=vencimiento. **No publica `qms_stage_versions` ni calendarios**; ver motor real de DB.
- Roles y Accesos hace upsert por rol/módulo; requiere Ver antes de Editar y bloquea Configuración para admin. Los permisos del store se recargan al recuperar sesión/vista, no hay suscripción dedicada a cambios de permisos.
- Formularios: crear/copy URL/activar/desactivar/eliminar con confirmación; RLS ya limita mutaciones a admin activo y conserva la lectura ciudadana de activos.
- Zona horaria: clave `org.zona_horaria`, fallback America/Costa_Rica; GET para cualquier perfil activo, PUT admin, validación Intl. La configuración se usa en análisis/helpers conectados; no todos los widgets ni el motor QMS usan esa clave.

### Otros módulos

- SACP: alta con folio, tipo, descripción y fecha límite; estado Abierta, avance 0. Avance 100→En Validación. El botón de cierre se muestra desde En Validación y escribe Cerrada/100; la UI no sustituye una máquina de estados transaccional de DB.
- Origen/origen_id se escriben en derivación desde quejas. Eficacia, validado_por_gc, notas, responsabilidad y prioridad no tienen edición completa en el flujo actual de SACP.
- Riesgos: probabilidad×impacto con escala 1–3. <=2 Bajo, <=4 Medio, <=6 Alto, >6 Crítico; matriz 3×3. Alta directa de atributos y nivel.
- Auditorías: alta con folio (manual o RPC), tipo/área/fechas/objetivo/alcance. Hallazgos asociados solo se listan; badge derivado_sacp_id no implementa derivación.
- Documentos: alta con código/título, versión 1.0 y Borrador; `generar_folio_documento` existe pero no se usa aquí. Cambiar versión solo actualiza `documentos.version_actual`; el historial muestra un placeholder y no inserta versiones.
- Revisión por Dirección: altas/listado/detalle de reuniones, agenda/fechas. Acta Pendiente/Registrada con texto e icono estático; no usar spinner para un estado permanente. No se implementa un gestor de actas o acuerdos con Drive completo.
- Reportería: módulos Quejas/SACP/Documentos/Auditorías/Riesgos/Revisión; filtros de fechas/estado/prioridad/tipo. Lee lotes de 500 ordenados por id, tope 5000 filas y exige restringir filtros al superarlo. `window.print`/CSS de impresión; no persiste informes_config.
- Usuarios: GET API permite admin/Calidad (directorio de responsables); POST/PATCH/DELETE solo admin. Alta Auth+perfil y rollback de Auth al fallar el INSERT; comprobación de auto-desactivación/auto-rol/auto-borrado y del último admin activo (409). Esta última usa COUNT antes de la escritura, sin bloqueo transaccional de ambos administradores; no garantiza por sí sola el caso concurrente. Cambios Auth/perfil son llamadas separadas, no una transacción distribuida.
- UI y API de usuarios/reset usan `generatePassword()` criptográfico con composición y Fisher-Yates. La API usa `validarUsuarioInput` antes de cualquier efecto: roles admin/calidad/colaborador, estado activo/inactivo, tipos y UUID; rechaza valores desconocidos. Email se normaliza y la contraseña conserva sus caracteres. Email+contraseña se envían juntos a Auth; un reset exclusivo de contraseña no escribe un UPDATE vacío de perfil.
- Cambio de contraseña propia: `supabase.auth.updateUser`, sin service role en navegador.

## Contrato de altas operativas

Procesos, Auditorías, Riesgos, Reuniones, SACP y Documentos usan un lock síncrono contra doble envío, validación de campos obligatorios recortados y fechas/escalas según formulario, try/catch/finally y error accesible. El borrador se conserva tras fallar y no se permite cerrar durante una escritura. Si el INSERT tuvo éxito y el refresco falla, comunicar que se guardó; no invitar a crear una segunda fila. `lib/utils/operationalFormValidation.ts` es la validación compartida.
