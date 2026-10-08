# Base de datos: esquema, políticas y motor QMS

> Referencia vigente del código y del snapshot remoto del 7 de octubre de 2026. Consultar solo el tema que se modifica; una nota histórica no demuestra el estado de un despliegue nuevo.

> Este inventario describe metadatos, no registros privados. Antes de cambiar la DB, releer esquema, políticas, grants y funciones efectivos mediante herramientas autorizadas. No ejecutar SQL histórico como estado deseado.

### RLS real, verificada en el servidor

Las **33 tablas públicas** tienen RLS habilitada. Su alcance efectivo es desigual:

| Área | Autorización real actual |
| --- | --- |
| Usuarios | Propio (también inactivo para que login lea el motivo), staff activo y lectura de módulo; colaboradores pueden ver autores de comentarios de sus quejas visibles. UPDATE propio solo activo y por columnas seguras |
| Columnas de Usuarios | Cliente puede cambiar nombre, teléfono, avatar, último acceso y preferencias; no `rol`, `estado`, `auth_id`, `id`, email, departamento ni created_at. Administración por API/service role |
| Quejas/comentarios | SELECT staff admin/calidad activos; colaborador activo con `mis_quejas` y responsable propio. Mutaciones del workflow mediante RPC |
| Adjuntos | SELECT staff o colaborador responsable. **Existe además una política heredada INSERT para staff**; no afirmar que RLS prohíbe todo INSERT directo, aunque la aplicación use RPC |
| Actividad de quejas | Lectura/escritura por permiso `quejas`, o por `mis_quejas` y queja propia |
| Permisos | Lectura staff activo; escrituras admin activo |
| Documentos/Auditorías | SELECT por lectura del módulo; INSERT/UPDATE/DELETE por lectura+escritura; admin activo conserva autoridad |
| Informes guardados | RLS activa; lectura por Reportería, creación/edición del propio autor con escritura, override admin y DELETE solo admin |
| Notificaciones | SELECT/UPDATE propias, usando la identidad operativa activa |
| Catálogos/SLA | Lectura por perfil activo y escritura por admin activo; anon solo categorías de quejas activas o legacy NULL. Se preservan códigos/estados protegidos por el trigger y colores semánticos |
| Configuraciones | Datos ordinarios solo admin activo. Claves con prefijo exacto `ai_` sin lectura/escritura por cliente authenticated, incluso admin; backend service role conserva acceso. API IA valida admin antes de usar ese privilegio |
| Formularios públicos | Anon y authenticated leen activos como flujo ciudadano; admin activo ve también inactivos y administra. INSERT/UPDATE/DELETE amplios se eliminaron |
| Acciones, Riesgos, Procesos, Reuniones, Hallazgos y versiones/solicitudes documentales | Perfil activo y lectura/escritura del módulo correspondiente, con override de admin activo. UPDATE verifica USING y WITH CHECK |
| Tareas | Admin activo administra; responsables activos leen solo sus propias tareas. No hay un módulo UI integrado |
| Logs/mail_queue | Políticas INSERT para authenticated; no hay lectura general por cliente |
| Motor QMS | Reglas/calendarios legibles por sesión, ejecuciones por quejas visibles y eventos por expedientes visibles. Auditoría de configuración solo admin |
| Tablas internas cerradas | `folios_quejas_anuales` y `qms_deadline_notices` tienen RLS sin políticas de cliente; acceden funciones/roles privilegiados |

Las políticas permisivas se combinan con OR. Añadir una política estricta no corrige otra antigua amplia. La lectura heredada de Configuraciones se eliminó: `ai_*` se accede por backend autorizado. Project owners/roles privilegiados de Supabase conservan acceso administrativo; el JSONB no se convirtió en almacenamiento cifrado ni Vault.

## Esquema

Este inventario incluye columnas y PK verificadas, no datos de personas ni secretos. `NOT NULL` indica restricción observada; las columnas sin esa marca admiten NULL. Los campos no equivalen a funciones UI implementadas.

### Tablas de negocio y soporte

| Tabla | PK | Columnas / tipos |
| --- | --- | --- |
| `acciones` | `(id)` | id uuid NOT NULL, folio text NOT NULL, tipo text, origen text, origen_id text, descripcion text, responsable_id uuid, fecha_limite timestamp with time zone, estado text, prioridad text, seguimiento_porcentaje integer, validado_por_gc boolean, eficacia text, notas text, fecha_apertura timestamp with time zone |
| `auditorias` | `(id)` | id uuid NOT NULL, folio text NOT NULL, tipo text, proceso_area text, auditor_lider_id uuid, equipo_auditor text, fecha_inicio timestamp with time zone, fecha_fin timestamp with time zone, estado text, objetivo text, alcance text, created_at timestamp with time zone |
| `catalogos` | `(id)` | id uuid NOT NULL, tipo text NOT NULL, valor text NOT NULL, color text, orden integer, activo boolean, modulo text NOT NULL, codigo text NOT NULL, valor_interno text |
| `configuraciones_sistema` | `(clave)` | clave text NOT NULL, valor jsonb NOT NULL, descripcion text, categoria text |
| `documento_versiones` | `(id)` | id uuid NOT NULL, documento_id uuid, version text, drive_file_id_historico text, motivo_cambio text, aprobado_por text, fecha_version timestamp with time zone |
| `documentos` | `(id)` | id uuid NOT NULL, codigo_doc text, titulo text NOT NULL, version_actual text, estado text, drive_file_id text, drive_file_id_borrador text, fecha_publicacion timestamp with time zone, created_at timestamp with time zone |
| `folios_quejas_anuales` | `(anio)` | anio integer NOT NULL, ultimo integer NOT NULL |
| `formularios_publicos` | `(id)` | id uuid NOT NULL, modulo text NOT NULL, nombre text NOT NULL, token text NOT NULL, activo boolean NOT NULL, creado_por uuid, created_at timestamp with time zone NOT NULL |
| `hallazgos` | `(id)` | id uuid NOT NULL, auditoria_id uuid, tipo text, descripcion text, evidencia text, requisito text, estado text, responsable_id uuid, derivado_sacp_id uuid, created_at timestamp with time zone |
| `informes_config` | `(id)` | id uuid NOT NULL, nombre text NOT NULL, modulo text NOT NULL, filtros jsonb, columnas jsonb, creado_por uuid, created_at timestamp with time zone |
| `logs` | `(id)` | id uuid NOT NULL, fecha timestamp with time zone, usuario_id uuid, accion text, modulo text, detalle text |
| `mail_queue` | `(id)` | id uuid NOT NULL, destinatario text, asunto text, cuerpo text, estado text, intentos integer, error text, fecha_envio timestamp with time zone, created_at timestamp with time zone |
| `notificaciones` | `(id)` | id uuid NOT NULL, usuario_id uuid, fecha timestamp with time zone, tipo text, mensaje text, leida boolean, enlace text, origen_id text, archivada boolean NOT NULL |
| `permisos` | `(rol, modulo)` | rol text NOT NULL, modulo text NOT NULL, leer boolean NOT NULL, escribir boolean NOT NULL |
| `procesos` | `(id)` | id uuid NOT NULL, nombre_proceso text, tipo text, objetivo text, responsable_id uuid, documentos_vinculados text, kpis text, estado text, created_at timestamp with time zone |
| `queja_adjuntos` | `(id)` | id uuid NOT NULL, queja_id uuid NOT NULL, nombre_archivo text NOT NULL, url_archivo text, tipo_archivo text, tamano integer, subido_por uuid, fecha_subida timestamp with time zone, nombre text NOT NULL, storage_path text NOT NULL, tipo_mime text NOT NULL, usuario_id uuid, created_at timestamp with time zone NOT NULL |
| `quejas` | `(id)` | id uuid NOT NULL, folio text NOT NULL, cliente_nombre text NOT NULL, email_cliente text, telefono text, categoria text, descripcion text, prioridad text, estado text, fecha_sla timestamp with time zone, fecha timestamp with time zone, notas text, resolucion text, responsable_id uuid, derivado_sacp_id uuid, fecha_cierre timestamp with time zone, fecha_limite_investigacion timestamp with time zone, reabierta boolean, motivo_reapertura text, revision bigint NOT NULL, tipo text, area_afectada text, fecha_recepcion_gc date, numero_oficio_resolucion text, observaciones text |
| `quejas_actividad` | `(id)` | id uuid NOT NULL, queja_id uuid NOT NULL, tipo text NOT NULL, descripcion text NOT NULL, usuario_id uuid, created_at timestamp with time zone NOT NULL |
| `quejas_comentarios` | `(id)` | id uuid NOT NULL, queja_id uuid, usuario_id uuid, comentario text, tipo text, visible_cliente boolean, fecha timestamp with time zone |
| `reuniones` | `(id)` | id uuid NOT NULL, titulo text, tipo text, fecha_programada timestamp with time zone, hora text, duracion text, organizador_id uuid, participantes text, agenda text, estado text, acta_drive_id text, acuerdos text, created_at timestamp with time zone |
| `riesgos` | `(id)` | id uuid NOT NULL, folio text NOT NULL, tipo text, categoria text, descripcion text, causa text, efecto text, probabilidad integer, impacto integer, nivel text, responsable_id uuid, estado text, accion_mitigacion text, fecha_identificacion timestamp with time zone |
| `sla_config` | `(id)` | id uuid NOT NULL, proceso text NOT NULL, prioridad text, dias_alerta integer, dias_vencimiento integer NOT NULL |
| `solicitudes_documentales` | `(id)` | id uuid NOT NULL, tipo text, solicitante_id uuid, descripcion text, justificacion text, estado text, revisor_id uuid, nuevo_drive_file_id text, fecha timestamp with time zone |
| `tareas` | `(id)` | id uuid NOT NULL, titulo text, descripcion text, responsable_id uuid, fecha_limite timestamp with time zone, estado text, prioridad text, origen text, created_at timestamp with time zone |
| `usuarios` | `(id)` | id uuid NOT NULL, nombre text NOT NULL, email text NOT NULL, rol text NOT NULL, estado text, departamento text, telefono text, avatar_url text, ultimo_acceso timestamp with time zone, created_at timestamp with time zone, auth_id uuid, notif_habilitadas boolean NOT NULL, notif_sonido boolean NOT NULL, notif_sonido_id text NOT NULL |
| `versiones_documentos` | `(id)` | id uuid NOT NULL, documento_id text, version text, cambios text, autor_id uuid, fecha timestamp with time zone |

### Motor de etapas / calendarios

| Tabla | PK | Columnas / tipos |
| --- | --- | --- |
| `qms_calendars` | `(id)` | id bigint NOT NULL, weekdays integer[] NOT NULL, holidays jsonb NOT NULL, timezone text NOT NULL, created_at timestamp with time zone NOT NULL, created_by uuid |
| `qms_case_events` | `(id)` | id bigint NOT NULL, module text NOT NULL, case_id uuid NOT NULL, kind text NOT NULL, occurred_at timestamp with time zone NOT NULL, provenance text NOT NULL |
| `qms_config_audit` | `(id)` | id bigint NOT NULL, entity text NOT NULL, old_value jsonb, new_value jsonb NOT NULL, reason text, actor_id uuid, created_at timestamp with time zone NOT NULL |
| `qms_deadline_notices` | `(id)` | id uuid NOT NULL, run_id uuid NOT NULL, offset_days integer NOT NULL, due_at timestamp with time zone NOT NULL, processed_at timestamp with time zone |
| `qms_stage_runs` | `(id)` | id uuid NOT NULL, case_id uuid NOT NULL, stage_id text NOT NULL, rule_id bigint, calendar_id bigint, snapshot jsonb NOT NULL, started_at timestamp with time zone NOT NULL, expires_at timestamp with time zone, attention_at timestamp with time zone, ended_at timestamp with time zone, end_event text, provenance text NOT NULL |
| `qms_stage_versions` | `(id)` | id bigint NOT NULL, stage_id text NOT NULL, duration integer NOT NULL, day_type text NOT NULL, alerts integer[] NOT NULL, expiration_action text NOT NULL, created_at timestamp with time zone NOT NULL, created_by uuid |
| `qms_stages` | `(id)` | id text NOT NULL, process_id text NOT NULL, name text NOT NULL, start_event text NOT NULL, end_event text NOT NULL |

### Vistas

Las tres vistas tienen `security_invoker=true` y aplican los permisos del llamador:

| Vista | Función |
| --- | --- |
| `qms_current_stages` | Etapas con su regla/version actual (`id, process_id, name, start_event, end_event, rule`) |
| `qms_quejas` | Queja con revision, código/nombre/color de estado y plazo vigente: `plazo_vence, plazo_etapa, plazo_situacion, plazo_dias` |
| `qms_work_items` | Expedientes unificados por módulo: folio/título/categoría/estado/color/prioridad/due/situation/days/stage |

### Relaciones e índices

- `usuarios.auth_id` tiene UNIQUE y FK a `auth.users.id` **ON DELETE SET NULL**. Un perfil UUID no es el UUID de Auth; no compararlos como si fueran iguales.
- Responsables/organizadores/autores referencian `usuarios.id`; hallazgos referencian auditoría y acción; adjuntos/actividad/comentarios referencian queja.
- Adjuntos y actividad se eliminan por cascade al borrar queja. `documento_versiones.documento_id` es UUID/FK con cascade; `versiones_documentos.documento_id` es **texto y sin esa FK**.
- `acciones.origen_id` es texto y una relación lógica. `quejas.derivado_sacp_id` existe como UUID, pero no tiene FK observada en este snapshot; no inventar una constraint por inferirla del nombre.
- Etapas: stage_versions→stage; runs→queja (FK diferida), regla y calendario; notices→run. Eventos QMS guardan module/case_id sin una FK única para todos los módulos.
- Índices principales ya cubiertos: UNIQUE de usuarios.auth_id/email; usuarios `(rol,estado)`; permisos PK `(rol,modulo)`; quejas estado/fecha/fecha_sla/responsable/derivado, folio UNIQUE y trigramas GIN para folio/cliente; documentos estado/código; FK/autores de comentarios y catálogo modulo/tipo.
- `idx_usuarios_auth_id` se retiró por redundancia con UNIQUE en la limpieza 016. No recrear índices equivalentes solo por tener nombres distintos.
- `pg_trgm` está instalado en public. Hay dos familias de tablas de versiones de documentos; no elegir una sin revisar escritores/lectores y diseñar su unificación.
- Adjuntos reales: `tamano` es **integer**, `url_archivo` admite NULL, `nombre_archivo` sigue NOT NULL. También sobreviven tipo_archivo/subido_por/fecha_subida junto a columnas nuevas; el RPC mantiene compatibilidad.
- Nuevos campos de Quejas reales: tipo, area_afectada, fecha_recepcion_gc (DATE), numero_oficio_resolucion, observaciones, revision bigint, reabierta y motivo_reapertura. La interface cliente y formularios no están migrados por completo.

## Motor de etapas

Esta capa se aplicó en la migración remota `etapas_versionadas`. **Existe y ejecuta triggers aunque la UI todavía use flujos legacy.**

- `qms_stages` define etapas de proceso con eventos de inicio/fin. Etapas de quejas actuales: evaluación (`Recibido`) e investigación (`En Investigación`).
- `qms_publish_stage` y `qms_publish_calendar` solo admin autenticado, con advisory lock, `p_expected` y conflicto SQLSTATE 40001. Agregan nuevas versiones y auditoría en `qms_config_audit`, no reemplazan silenciosamente la historia.
- Duración 1–3660; tipo business_days/calendar_days; alertas únicas positivas dentro de duración; acción notify_quality/mark_only. Calendario: días ISO 1–7 sin duplicados, feriados fecha+descripción, máximo 1000.
- `qms_due` cuenta desde el día posterior al inicio, usa calendario y días laborables/naturales, desplaza el vencimiento hasta un día permitido y devuelve el fin de ese día (un microsegundo antes del siguiente) en **America/Costa_Rica**. No confundir con simples N×24 horas.
- Trigger `qms_queja_stage BEFORE INSERT OR UPDATE` llama `qms_sync_queja`. Cada UPDATE incrementa revision; si no cambia estado conserva fecha_sla/fecha_limite_investigacion anteriores.
- Al cambiar estado cierra runs anteriores. Para Recibido/En Investigación toma la última regla/calendario, guarda snapshot inmutable en `qms_stage_runs` y calcula expires_at/attention_at/notices.
- Evaluación escribe fecha_sla; investigación escribe fecha_limite_investigacion. Cambiar prioridad/notas sin cambiar estado **no recalcula** esos plazos por sla_config: el trigger conserva el snapshot vigente.
- Alertas se programan a las 06:00 locales según offsets y, para notify_quality, al vencer. `qms_process_notices` procesa hasta 250 pendientes con FOR UPDATE/SKIP LOCKED, solo runs abiertos, notifica staff activo y responsable y marca processed_at.
- `qms_process_notices` y el procesador legacy `procesar_alertas_quejas` están reservados a postgres/service role. La comprobación de octubre no encontró `cron.job` ni Edge Functions desplegadas; no afirmar que la ejecución automática está instalada.
- Triggers `qms_*_event` en quejas, acciones, documentos y riesgos registran aperturas/cierres (y Resuelto en quejas) en qms_case_events. No afirmar que esos eventos son el mismo listado que quejas_actividad.
- `qms_catalog_audit` audita catálogos y protege códigos/estructura/historia.
- `qms_transition` y `qms_update_details` exigen revisión de la fila y aplican autorización staff/responsable; resuelven códigos del catálogo y retornan datos de qms_quejas.
- `qms_dashboard(text)` agrega buckets, estados/categorías, etapas, cronología y atención con vistas invoker. **No es el RPC usado por la página `/` actual.**

El SLA visual por antigüedad, el editor sla_config y los widgets que usan fecha_sla en la UI son una capa anterior. Antes de cambiarlos, reconciliar visualización y escritura con estos snapshots; no ajustar el trigger para mantener una UI vieja engañosa.

### Folios

- `generar_folio_queja()` vigente usa `folios_quejas_anuales(anio,ultimo)`, UPSERT por año con incremento y hora Costa Rica. Devuelve **`AAAA-NNN`** con mínimo tres dígitos, sin truncar a partir de 1000. No agrega `QUEJA-`.
- El contador anual de quejas avanza por fila/año; no necesita reset manual de la antigua secuencia para enero.
- SACP/Auditorías/Riesgos/Documentos conservan generadores por secuencias y prefijos `SACP-`, `AUD-`, `RIESGO-`, `DOC-` con año y cuatro dígitos. Los modales correspondientes (excepto Documentos) pueden aceptar folio manual o generar por RPC.
- `siguiente_folio_queja()` y el formato Q-AAAA-NNNNN son legacy; el cliente actual usa el generador a través del workflow/RPC de creación.
- No generar un folio de queja adicional en frontend antes de `crear_queja_interna`/pública: la creación lo resuelve en DB.

### RPC: uso y acceso relevantes

| RPC | Cliente actual / DB |
| --- | --- |
| `crear_queja_interna` | Usado por alta interna; staff activo y folio/SLA legacy con trigger QMS vigente |
| `crear_queja_publica` | Usado por formulario público; activo/token, devuelve folio, notif diferida |
| `*_con_atributos`, `actualizar_atributos_queja` | Existen en DB/017 para tipo/área/oficio/fecha/observaciones; no están integrados en los formularios actuales |
| `actualizar_detalles_queja`, `transicionar_queja` | Funciones legacy internas cerradas para anon y authenticated; service/owner o wrappers internos |
| `qms_update_details`, `qms_transition` | Wrappers usados por el cliente para editar, asignar responsable, transicionar y reabrir; autorización staff/responsable y revisión esperada |
| `derivar_queja_a_sacp`, `agregar_comentario_queja`, `registrar_adjunto_queja` | Usados, autenticados y con validación de dominio |
| `registrar_adjunto_queja_publica`, `notificar_queja_publica` | Acceso público intencional para submit ciudadano |
| `actualizar_mis_preferencias_notificacion` | Propio activo, authenticated; retorna perfil |
| `obtener_estadisticas_quejas` | Invoker, authenticated/service, conteos bajo RLS; usado por QuejasSummary |
| `incrementar_tokens_proveedor` | Invoker, solo service_role, contador con bloqueo de fila; backend IA |
| `app_*`, `current_*`, `es_admin` | Helpers de identidad/permisos; la identidad operativa excluye inactivos |
| `qms_publish_*`, `qms_due`, `qms_business_day`, `qms_classify`, `qms_dashboard` | Motor/calendario/analítica de DB, integración de UI incompleta |

No conservar overloads ambiguos con defaults para PostgREST. Revisar firmas/ACL en pg_proc, no asumir acceso porque la función aparece listada en el MCP.

## Migraciones y referencias

### Historial y fuentes

- `supabase/001`–`017`, seeds, dumps y scripts de RLS en raíz contienen historia manual. No representan exactamente todo el esquema remoto.
- Historial remoto observado: `20260917190526 add_missing_performance_indexes`, `20260917191058 add_trigram_index_for_search`, `20260923213259 etapas_versionadas`, `20260924043528 017_atributos_reales_quejas`, `20261006232152 seguridad_fases_1_3`, `20261008011901 auditoria_permisos_validacion`, `20261008012121 aislamiento_credenciales_ia`.
- La migración de seguridad previa es `supabase/migrations/20261006232152_seguridad_fases_1_3.sql`: RLS/ACL de Usuarios/Documentos/Auditorías/Informes, identidad activa, RPC internos sin anon, estadísticas invoker, contador IA service-only y search_path.
- `supabase/backups/seguridad_fases_1_3_antes.json` y `_despues.json` son metadatos de políticas/ACL/funciones, no backup de datos del negocio ni credenciales.
- El DDL de etapas versionadas existe en remoto y no tiene una migración completa equivalente en la carpeta local actual; reconciliar esa historia antes de pretender recrear la DB desde el repo.
- `scripts/auditoria-fases-1-3.sql` consulta esquema/índices/políticas; `scripts/verificar-seguridad-db.sql` prueba roles/ACL/RLS con fixtures y ROLLBACK. Revisar objetivo/proyecto antes de cualquier SQL con escritura.
- `supabase/schema-actual.txt`, dumps y el antiguo `rls-role-based.sql` son snapshots/referencias; no reaplicarlos como estado deseado.
- `SUPABASE_PHASE3_RLS.sql` se incorporó al integrar commits remotos: es un borrador histórico incompatible con esta DB. No ejecutarlo ni convertirlo en migración sin corregir identidad Auth/perfil, permisos y duplicaciones.
- `docs/auditoria-fases-1-3.md` conserva resultados/cambios anteriores y la corrección de AbortSignal/performance.
- En la revisión histórica anterior al endurecimiento se releyeron metadatos por MCP, sin aplicar DDL: RLS 33/33; tres vistas invoker; legacy actualizar/transicionar sin EXECUTE para anon/authenticated; wrappers QMS para authenticated; contador IA solo service_role entre los roles de cliente; estadísticas sin anon. Ese snapshot registró políticas `true` de Configuraciones/Formularios, que las migraciones nuevas eliminaron, y ausencia de `cron.job`. La confirmación de estos puntos no sustituye revisar todas las políticas o ejecutar una auditoría exhaustiva nueva.
- El inventario de este documento y el resto de reglas de DB conservan el snapshot de la auditoría de octubre. No se extrajeron registros de personas, tokens, claves IA ni secretos para redactar esta guía.

## Endurecimiento aplicado

Las migraciones `20261008011901_auditoria_permisos_validacion` y `20261008012121_aislamiento_credenciales_ia` sustituyeron políticas amplias de 13 tablas, limitaron grants y cerraron el bypass de derivación SACP. Esta derivación exige admin activo o staff activo con escritura de Quejas y SACP; conserva locks e idempotencia.

Hay 11 CHECK NOT VALID que se aplican a INSERT/UPDATE y un trigger de fechas de Auditorías. Una auditoría histórica con fechas invertidas se conserva: editar otros campos está permitido, cambiar fechas exige orden válido. No se reescribieron datos históricos.

`scripts/verificar-auditoria-db.sql` comprobó CRUD, roles activos/inactivos, tareas propias, lectura pública, ACL, validaciones y consumo IA con fixtures y ROLLBACK. Los archivos `supabase/backups/auditoria_permisos_*` contienen metadatos/conteos/código, no una copia de los datos. `auditoria_permisos_rollback.sql` es recuperación manual, no una migración para ejecutar normalmente.

Persisten asesores sobre RLS sin policy en tablas internas, pg_trgm en public, SECURITY DEFINER intencionales y protección de contraseñas filtradas deshabilitada. No atribuirles una corrección automática. Evidencia y límites en [la auditoría validada](../auditoria-validada-2026-10-07.md).
