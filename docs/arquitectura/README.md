# Arquitectura y mapa de edición de ECA-QMS

La entrada de reglas está en [AGENTS.md](../../AGENTS.md). Lee primero el archivo
que gobierna el cambio y después la referencia de su tema; no hace falta recorrer todo el repositorio.
Las rutas de código de estas tablas parten de la raíz del proyecto.

## Ruta rápida

[Consecutivos anuales — 11 noviembre](../consecutivos-anuales-2026-11-11.md)
ubica el contador por módulo/año de Costa Rica, `qms_private.next_annual_folio`, los
triggers de alta de SACP/Auditorías/Riesgos y la compatibilidad con RPC anteriores.
DB aplicada, históricos intactos; modales sin reserva previa en el cliente local.
Quejas mantiene `AAAA-NNN`; otros módulos conservan sus prefijos. Calendario adicional aplazado.

[Limpieza compartida de Quejas/Mis Quejas](../quejas-panel-2026-10-13.md)
ubica la selección persistente de fila con fondo #F0F4F7 (`ui-case-row`, `qms-row-selected`), contacto solo al ampliar,
responsable antes de acciones, área junto a Descripción y adjuntos sin marcos
anidados. `components/quejas/AreaAfectada.tsx` comparte el área de solo lectura
sin consultar el catálogo. Cambios web locales; el contraste interno del visor
de Google permanece pendiente por su aislamiento de origen.
Quejas/Mis Quejas vuelven a leer `estado_color` para el fondo de sus estados;
`components/quejas/QuejaPlazoIndicator.tsx` comparte punto y texto del plazo en
tablas y paneles. Conserva fechas y colores originales del sistema.

[Formulario, evidencias y correo por evento — 10 noviembre](../quejas-formulario-correo-inmediato-2026-11-10.md)
ubica validación nativa y límites compartidos, finalización tras adjuntos,
seguimiento sin copiar enlaces y RPC privados del despertador. DB/Edge aplicadas;
Apps Script v5 activo por evento y final pendiente enviado con Word; web local sin publicar.

[Revisión GC y respuesta al cliente](../quejas-revision-y-respuesta-2026-11-04.md)
ubica acciones directas, devolución con motivo, informe editable y selector Word/PDF,
borrador persistente y publicación final atómica. También documenta el adjunto físico
del emisor, conservando No Procede y los contratos del cliente anterior.
Su ajuste del 10 noviembre ubica `QuejaCorreoEditor.tsx` y `lib/utils/quejaCorreo.ts`:
correo de acompañamiento personalizado con asunto/mensaje editables y
selección/subida/visualización del documento arriba y atajo Editar informe que conserva
el correo. No Procede comparte esa ventana y publica desde ella, sin un segundo
editor/modal de justificación; conserva borrador CAS y fundamentos en el informe.
Guardado/publicación v2, puentes de rechazo y claim v4 conservan el correo aprobado;
DB y Edge están activadas, mientras el cliente web sigue local.
La misma referencia ubica `CaseCompletionDate`/`CaseFinalMailStatus` en
`QuejaExpedientePanels.tsx` y la actualización acotada del ACK en
`lib/queries/useQuejaSeguimiento.ts`: cierre visible y estado del correo final.
También registra el ajuste activo en Apps Script/Edge que reserva seguimiento
al acuse y exige el informe físico en el correo final; Edge v16 añade el contacto de
Calidad a las plantillas ciudadanas predeterminadas. El mismo contrato ubica el marco
contraído compartido y Enviar a Revisión GC en las acciones de Mis Quejas.

Revisión local del 3 noviembre de Quejas: [claridad, sonido y acuse por evento](../quejas-claridad-y-acuse-2026-11-03.md).
Ubica la presentación del expediente y el despertador de correo, activado el
10 noviembre según el contrato enlazado arriba. El resumen superior de resultado se retiró por petición
del propietario. [Resolución y revisión GC](../quejas-resolucion-y-revision-gc-2026-11-03.md)
ubica la edición compacta y la propuesta prioritaria durante revisión; los demás
estados mantienen Descripción al principio.

[Informe editable y Word](../quejas-informe-editable-word-2026-11-03.md) ubica
Generar expediente, plantilla Tiptap, API y almacenamiento por versiones. Editor y
exportación verificados en local; almacenamiento remoto activado el 3 noviembre,
con publicación web pendiente.

1. Busca el comportamiento en **Dónde editar** y abre primero el archivo de entrada indicado.
2. Sigue sus imports hasta la fuente canónica; no edites una copia local si ya existe un registro, token o helper compartido.
3. Lee solo el AGENTS.md de la capa y la referencia del tema que vas a tocar.
4. Cambia la capa responsable, añade o actualiza una prueba de ese contrato y ejecuta la suite más pequeña que lo cubra.
5. Si el cambio modifica una ruta, permiso, estado persistido o integración, actualiza su referencia y verifica también los límites de seguridad.

No hace falta pasar este mapa completo como prompt: las guías AGENTS.md por carpeta dan
las reglas locales automáticamente. Para una IA, basta pedir el resultado esperado y
el comportamiento que no debe cambiar; para editar a mano, empieza por la misma ruta.

## Revisar impacto transversal

Una pantalla no necesariamente es dueña de todo lo que muestra. Antes de cambiar una regla:

1. Busca el símbolo/ID y sus consumidores en `app/`, `components/`, `lib/`, `tests/` y `docs/`; inspecciona quién lo usa, no solo coincidencias de texto.
2. Sigue el dato en ambas direcciones: UI → hook/servicio → API → DB, y DB/API → listas, etiquetas e informes. Incluye Sidebar, precarga y permisos si cambia una ruta o módulo.
3. Si persiste en DB, confirma esquema, policies, grants y RPC efectivos antes de editar. Una migración histórica o un mock no demuestra el estado aplicado.
4. Clasifica cada parte como transversal (mismo contrato en varios consumidores) o propia del módulo. Comparte la primera; deja local la segunda. Una similitud visual no significa que comparta la regla de negocio.
5. Prueba el flujo modificado y al menos una superficie vecina que use el mismo contrato. Para IDs/estados/rutas, cubre productor y consumidores; para auth/API, también el rechazo sin permiso.

Mantén separados **ID estable**, **etiqueta visible** y **presentación** (variant,
color o clase). Los módulos pueden compartir controles y tokens sin compartir sus
estados, permisos ni workflows. No renombres claves históricas solo para uniformar:
adáptalas explícitamente en la frontera.

## Referencias por tema

| Tema | Documento |
| --- | --- |
| Login, logout, identidad, roles, guards y permisos | [Sesión y permisos](sesion-y-permisos.md) |
| Tablas, columnas, RLS, RPC, QMS y migraciones aplicadas | [Base de datos](base-de-datos.md) |
| Queries, caché, precarga, cancelación, Realtime y errores | [Datos y rendimiento](datos-y-rendimiento.md) |
| Qué hace cada página, reglas de Quejas y límites de producto | [Módulos y flujos](modulos-y-flujos.md) |
| Preparación del primer lanzamiento de Quejas | [Evaluación y reglas confirmadas](../quejas-lanzamiento-2026-10-09.md) |
| Usuarios, Drive, IA, endpoints y variables de entorno | [Integraciones](integraciones.md) |
| Gateway ciudadano, BotID, cuotas, capacidad de adjuntos y activación | [Seguridad de formularios públicos](../seguridad-formularios-publicos.md) |
| Avisos a Calidad/responsable, fechas y entrega independiente | [Avisos internos de Quejas](../avisos-internos-quejas-2026-10-14.md) |
| Sonido, primera lectura y coordinación entre pestañas | [Notificaciones y audio](../notificaciones-audio-2026-10-14.md) |
| Calendario versionado, días laborables y feriados | [Calendario QMS](../calendario-qms-2026-10-15.md) |
| Mis Quejas, seguimiento privado, caducidad desde cierre y respuesta/oficio publicados | [Contrato y activación del 19 octubre](../quejas-seguimiento-y-publicacion-2026-10-16.md) |
| Dos correos ciudadanos, retiro del intermedio y corrección local de reintentos | [Entrega del 20 octubre](../quejas-dos-correos-y-reintentos-2026-10-20.md) |
| Tokens y puntos de entrada de apariencia | [Visual](visual.md) y [patrones del kit](../visual-patterns.md) |
| Comandos, alcance de pruebas y trabajo pendiente | [Verificación y pendientes](verificacion-y-pendientes.md) |

## Dónde editar

| Quiero cambiar… | Abrir primero | Acompañar con |
| --- | --- | --- |
| Nombre, ruta o grupo de un módulo | [lib/constants/modulos.ts](../../lib/constants/modulos.ts) | [components/Sidebar.tsx](../../components/Sidebar.tsx), [components/Header.tsx](../../components/Header.tsx), [lib/permisos.ts](../../lib/permisos.ts); registro no concede acceso |
| Roles, etiquetas y colores | [lib/constants/roles.ts](../../lib/constants/roles.ts) | [lib/server/usuarioInput.ts](../../lib/server/usuarioInput.ts) valida roles asignables; guards/API/DB siguen siendo la autoridad de acceso |
| Color de un estado o prioridad | [lib/constants/estados.ts](../../lib/constants/estados.ts) | [lib/constants/badges.ts](../../lib/constants/badges.ts), [components/ui/Badge.tsx](../../components/ui/Badge.tsx) y [app/styles/theme.css](../../app/styles/theme.css) |
| Paleta, fuente, tamaños, radios o sombras | [app/styles/theme.css](../../app/styles/theme.css) | [app/styles/components.css](../../app/styles/components.css) y [app/globals.css](../../app/globals.css); mantener tokens, sin colores repetidos por página |
| Botón, input, select, tabla o paginación | [components/ui/](../../components/ui/)<Componente>.tsx | [components/ui/AGENTS.md](../../components/ui/AGENTS.md) y docs/visual-patterns.md |
| Modal, foco, Escape o drawer móvil | [components/Modal.tsx](../../components/Modal.tsx) | [components/AuthenticatedLayout.tsx](../../components/AuthenticatedLayout.tsx) y [hooks/useMobileNavigation.ts](../../hooks/useMobileNavigation.ts) |
| Login o error de autofill | [app/login/page.tsx](../../app/login/page.tsx) | [app/globals.css](../../app/globals.css): ui-login-field; [lib/auth.ts](../../lib/auth.ts) para ejecución |
| Orden de restauración/login/logout | [lib/store/auth-store.ts](../../lib/store/auth-store.ts) | [lib/auth.ts](../../lib/auth.ts), [lib/authRoute.ts](../../lib/authRoute.ts), [lib/authLogoutIntent.ts](../../lib/authLogoutIntent.ts), [components/AuthShell.tsx](../../components/AuthShell.tsx) |
| Presentación al validar sesión | [components/SessionScreen.tsx](../../components/SessionScreen.tsx) | [components/AuthShell.tsx](../../components/AuthShell.tsx); fondo neutral antes de autorizar, sin módulos anticipados |
| Encabezado, usuario y notificaciones | [components/Header.tsx](../../components/Header.tsx), [components/header/](../../components/header/) | [lib/services/notificacionService.ts](../../lib/services/notificacionService.ts), [lib/queries/useNotificaciones.ts](../../lib/queries/useNotificaciones.ts) |
| Dashboard activo | [app/page.tsx](../../app/page.tsx) | [lib/queries/useDashboard.ts](../../lib/queries/useDashboard.ts), [components/dashboard/QuejasSummary.tsx](../../components/dashboard/QuejasSummary.tsx) y DashboardLoading.tsx |
| Buscar, filtrar o paginar un listado | lib/queries/use<Modulo>.ts | app/<modulo>/page.tsx, queryKeys.ts, pagination.ts, [lib/utils/postgrest.ts](../../lib/utils/postgrest.ts) |
| TTL o reintentos de lecturas | [lib/queries/cacheConfig.ts](../../lib/queries/cacheConfig.ts) | [lib/providers/QueryProvider.tsx](../../lib/providers/QueryProvider.tsx); revisar overrides del hook |
| Precarga del menú o reconexión | [hooks/useHoverPrefetch.ts](../../hooks/useHoverPrefetch.ts), [hooks/useRealtimeSubscription.ts](../../hooks/useRealtimeSubscription.ts) | Sidebar y claves de la vista; context.signal al transporte |
| Alta operativa | app/<modulo>/components/Nueva*.tsx | [lib/utils/operationalFormValidation.ts](../../lib/utils/operationalFormValidation.ts); mantener doble envío y borrador protegidos |
| Workflow/estado/responsable de Quejas | [lib/services/quejaWorkflowService.ts](../../lib/services/quejaWorkflowService.ts) | [lib/constants/quejas.ts](../../lib/constants/quejas.ts), [lib/queries/useQuejas.ts](../../lib/queries/useQuejas.ts), paneles de Quejas y wrappers QMS en DB |
| Mis Quejas, análisis o resolución | [app/mis-quejas/](../../app/mis-quejas/) | Buscar QuejaColaboradorPanel.tsx y useEntityRequestGuard; no cambiar filtro de propietario |
| Lectura de análisis y copia histórica de procedencia | [lib/utils/quejaContent.ts](../../lib/utils/quejaContent.ts) | Compartido por QuejaDetalleModal y QuejaColaboradorPanel; oculta solo la copia plain exacta del motor, sin modificar DB ni inferir formato |
| Panel de expediente, actividad y plazos de Quejas | [app/quejas/components/QuejaDetalleModal.tsx](../../app/quejas/components/QuejaDetalleModal.tsx) | QuejaExpedientePanels.tsx, quejaExpedienteModel.ts, ResponsablePicker.tsx, AreaQuejaControl.tsx y lib/queries/useQuejaSeguimiento.ts; observaciones en useQuejaComentarios.ts; [contrato del 13 octubre](../quejas-panel-2026-10-13.md) |
| Selección y catálogo de áreas afectadas | [AreaQuejaControl.tsx](../../app/quejas/components/AreaQuejaControl.tsx) | AreaQuejaCatalogo.tsx dentro de CaseRequestHeader y AreaCatalogoPicker.tsx para el desplegable con acciones por fila; [quejaAreaCatalogService.ts](../../lib/services/quejaAreaCatalogService.ts) para renombrar/activar con snapshot; altas por guardarAreaQueja y lecturas en useCatalogos.ts; no reescribir áreas históricas |
| Correos automáticos de Quejas sin Vercel | [supabase/functions/quejas-mail-queue/](../../supabase/functions/quejas-mail-queue/) | message.ts canónico; diseño HTML en qmsMailHtml_ de integration/apps-script/quejas-mail/Codigo.gs; productor/claims en migración 20261020163142; [estado operativo](../correo-quejas-directo-2026-10-13.md) y [dos correos](../quejas-dos-correos-y-reintentos-2026-10-20.md) |
| Destinatarios y recordatorios internos de Quejas | [migración de avisos](../../supabase/migrations/20261015011028_quejas_internal_notices.sql) | qms_process_notices/claim v2/authorize; [contrato y activación](../avisos-internos-quejas-2026-10-14.md); no cambiar snapshots/plazos para avisar |
| Sonido de campana entre pestañas | [lib/hooks/useNotificationSound.ts](../../lib/hooks/useNotificationSound.ts) | [lib/utils/notificationSound.ts](../../lib/utils/notificationSound.ts), sonidosNotificacion.ts; IDs/fechas locales, sin contenido ni credenciales |
| Secciones y editores de Configuración | [app/configuracion/page.tsx](../../app/configuracion/page.tsx) | [app/configuracion/components/](../../app/configuracion/components/); [lib/services/configuracionService.ts](../../lib/services/configuracionService.ts) |
| Días laborables y feriados del motor QMS | [app/configuracion/components/CalendarioSettings.tsx](../../app/configuracion/components/CalendarioSettings.tsx) | useQmsCalendar.ts, qmsCalendarService.ts, lib/utils/qmsCalendar.ts; RPC qms_publish_calendar con CAS/auditoría, sin recalcular etapas abiertas |
| CRUD/reset/último acceso de Usuarios | [app/api/usuarios/route.ts](../../app/api/usuarios/route.ts) | [lib/server/usuarioInput.ts](../../lib/server/usuarioInput.ts), ultimoAcceso.ts, [components/usuarios/](../../components/usuarios/) y [lib/services/usuariosService.ts](../../lib/services/usuariosService.ts), [lib/services/apiClient.ts](../../lib/services/apiClient.ts), useUsuarios.ts |
| Proveedores/modelos/routing de IA | [components/configuracion/AIProvidersManager.tsx](../../components/configuracion/AIProvidersManager.tsx) y [sus editores](../../components/configuracion/ia/) | [lib/services/aiConfigService.ts](../../lib/services/aiConfigService.ts), [app/api/configuracion/ia/route.ts](../../app/api/configuracion/ia/route.ts), [lib/server/aiSettings.ts](../../lib/server/aiSettings.ts) |
| Ejecución/fallback/memoria de análisis IA | [app/api/ai/analizar/route.ts](../../app/api/ai/analizar/route.ts) | [lib/ai/](../../lib/ai/) y [lib/server/deadline.ts](../../lib/server/deadline.ts); conservar presupuesto y límites |
| Formulario público, contrato API o protección de bots | [app/q/[token]/page.tsx](../../app/q/[token]/page.tsx) y [lib/services/publicQuejasClient.ts](../../lib/services/publicQuejasClient.ts) | [presentación del 14 octubre](../formulario-publico-visual-2026-10-14.md), [validador cliente/API](../../lib/utils/publicQuejaValidation.ts), [app/q/components/usePublicQuejaForm.ts](../../app/q/components/usePublicQuejaForm.ts), [lib/server/publicForms/](../../lib/server/publicForms/), [app/api/public/](../../app/api/public/), instrumentation-client.ts y next.config.ts |
| Subir/descargar/eliminar evidencias | [app/api/drive/](../../app/api/drive/) | [lib/server/drive.ts](../../lib/server/drive.ts), [lib/constants/adjuntos.ts](../../lib/constants/adjuntos.ts), [components/quejas/](../../components/quejas/) y formulario público |
| Zona horaria | [lib/timeZone.ts](../../lib/timeZone.ts) | [app/api/configuracion/zona-horaria/route.ts](../../app/api/configuracion/zona-horaria/route.ts); motor QMS conserva su calendario |
| Logo institucional del menú | [components/EmpresaLogo.tsx](../../components/EmpresaLogo.tsx) | [lib/constants/marca.ts](../../lib/constants/marca.ts), [lib/queries/useLogoEmpresa.ts](../../lib/queries/useLogoEmpresa.ts), [app/api/configuracion/logo/route.ts](../../app/api/configuracion/logo/route.ts) y [editores de Configuración](../../app/configuracion/components/); bucket público branding, recorte cuadrado en cliente y sin máscara circular al mostrarlo |
| Imprimir un informe | [app/reporteria/page.tsx](../../app/reporteria/page.tsx) | [app/globals.css](../../app/globals.css): reglas de impresión; lotes limitados a 5000 filas; [observaciones de Quejas](../reporteria-observaciones-2026-10-13.md) en generador/consultas.ts |
| Validación de API o headers falsificados | [lib/server/auth.ts](../../lib/server/auth.ts), proxy.ts | [lib/server/apiAuthentication.ts](../../lib/server/apiAuthentication.ts); cada método registrado conserva su guard |
| Política, tabla, función o índice | [supabase/migrations/](../../supabase/migrations/) | Ver esquema efectivo y skills de Supabase; [scripts/verificar-auditoria-db.sql](../../scripts/verificar-auditoria-db.sql) no altera estado final |

Cuando una tabla apunta a una carpeta, usar rg --files en esa carpeta y rg con el
nombre de la función o propiedad. Seguir imports activos antes de usar un archivo similar.

## Cómo está armado

- app/ compone páginas/API; components/ presenta controles y paneles.
- lib/queries/ lee estado remoto con TanStack; lib/services/ ejecuta flujos y escrituras.
- lib/store/ guarda sesión y UI; no es autoridad de datos ni una segunda caché de negocio.
- lib/server/ y API validan Auth/rol/entidad antes de usar recursos privilegiados.
- lib/constants/ guarda diccionarios; app/styles/theme.css define tokens visuales y globals.css su entrada.
- supabase/migrations/ registra DDL aplicado; backups/ y auditorías fechadas conservan evidencia.
- tests/ usa transporte/identidades sintéticas para regresión; no copiar sesiones o secretos reales.
- Los límites por módulo están en `modulos-y-flujos.md`. Actualizar una fila cuando se
  integra o retira una capacidad; un archivo, tabla o prototipo sin consumidor activo
  y flujo probado no cuenta como funcionalidad terminada.

## Cómo mantener esta documentación

Actualizar el tema cuando cambia su contrato. Cambiar este mapa solo si cambia el
punto de edición; evitar duplicar el cuerpo de una función, todas las columnas en
varios archivos o listados automáticos de cada componente. Comentarios de código
explican una decisión o invariante difícil de inferir, no repiten el nombre del archivo.

El material en docs/historico/ conserva decisiones de etapas previas; sus imports,
tokens y componentes pueden haber sido retirados. Revisar consumidores actuales.
El [informe del 7 de octubre](../auditoria-validada-2026-10-07.md) documenta evidencia
de aquella auditoría; resultados históricos no equivalen a ejecutar pruebas hoy.

Activación pública verificada 9-oct: [corte canónico](../../supabase/migrations/20261009231000_public_forms_drive_access_cutover.sql), [Storage histórico](../../supabase/migrations/20261009230746_public_storage_access_hardening.sql) y [evidencia de producción](../../supabase/backups/public_activation_evidence_20261009.json). Consultar sus límites antes de restaurar un cliente anterior.

Quejas: [entrega y pendientes](../quejas-lanzamiento-2026-10-09.md), [correo independiente](../seguridad-correos-quejas.md).
