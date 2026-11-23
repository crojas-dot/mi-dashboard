<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ECA-QMS — guía de entrada

Revisión: **21 de noviembre de 2026**. Esta entrada contiene reglas siempre aplicables.
El detalle se consulta por tema en [el mapa de arquitectura](docs/arquitectura/README.md).
No cargar todos los documentos para una modificación aislada.

## Contrato vigente — acceso de usuarios y correo (21 noviembre 2026)

**Prevalece sobre los relatos históricos del 15 y 17 noviembre.** Código de
`main` verificado en el commit `e235dfeac9472d36d0a634b6a2e1ef5a42e0e931`;
volver a consultar GitHub y el alias de Vercel si cambia el repositorio.

- **Alta de usuario:** `UsuarioFormModal.tsx` envía un único `POST` con
  `access: { id, invite: false, requireMfa, sendByEmail }`. Hay **dos casillas**:
  «Enviar invitación por correo» (envía credenciales, activada por defecto) y
  «Requerir 2FA» (opcional, desactivada por defecto). No se crea un enlace
  extra de aceptación en las altas temporales.
  Validar `invite/requireMfa/sendByEmail` en `lib/server/usuarioInput.ts`
  y no aceptar secretos enviados arbitrariamente desde el navegador.
- **Correo inicial sencillo:** `accessService.ts` genera en servidor una
  contraseña temporal aleatoria de **24 caracteres**. `qms_temporary_access_command`
  confirma la política y vigencia de **3 días hábiles**. El correo `temporary_access`
  muestra **Usuario = email**, **Contraseña temporal** y botón
  **«Iniciar sesión»** a `/login`. No crear un enlace de aceptación adicional.
  Con correo activado **nunca** devolver ni mostrar la contraseña al admin.
  Solo si se desactiva explícitamente el correo, devolverla una única vez al
  administrador autorizado y mostrarla temporalmente para entrega manual;
  borrarla del estado al cerrar. Nunca registrarla en logs ni en DB en claro.
- **Primer ingreso (23 noviembre):** la contraseña recibida por correo sigue
  siendo temporal y debe reemplazarse por una segunda. **No se fuerza el cambio
  antes de ingresar**: hay un plazo de 3 días hábiles (lunes a viernes, hora
  Costa Rica) desde su emisión. Durante el plazo, `phase='ready'` cuando
  `requireMfa=false`; con 2FA requerido se conserva el enrolamiento y la
  verificación. `Header` muestra un recordatorio con «Más tarde» y «Cambiar
  en Mi perfil», que abre la pestaña «Seguridad». El usuario puede escribir
  su nueva clave o generar una aleatoria de 20 caracteres, verla y copiarla
  antes de guardarla. El cambio temporal pasa siempre por
  `POST /api/auth/acceso` con confirmación y operación correlacionada,
  **no** por la actualización genérica de Auth. La migración
  `20261123153151_acceso_temporal_tres_dias_habiles_20261123.sql` aplica el plazo
  en `access_ready`, `access_summary`, RPC y el trigger de Auth; no
  basta con cambiar el UI. Al vencer, se bloquea por servidor/RLS y
  se requiere restablecimiento administrativo. No hay cambio para cuentas
  legacy ni se omite 2FA. La rotación previa de claves de correo sigue pendiente.
- **Reenvíos:** si el servicio informa `failed` o `uncertain`, mostrar fallo
  sin presentar la entrega como exitosa ni repetirla automáticamente. Antes
  de reenviar por acción explícita, confirmar que se invalidará la clave
  anterior. `resetUserAccess` gira la credencial de acceso temporal bajo
  autorización de admin, invalidando la anterior. Conservar idempotencia del alta
  y resultados `sent/failed/uncertain`; envío incierto nunca implica reintento
  automático. Si MailApp falla, preservar Auth y perfil creados. Para **cuentas
  legacy invitadas** conservar `inviteAccess`, canje en `/acceso` y reenvío
  de invitación de 24h sin cambiarles la contraseña silenciosamente.
  Reset 2FA exige admin/confirmación y mantiene la obligación configurada.
- **Emisor:** API Next → Supabase Edge `qms-access-mailer` → Google Apps
  Script `/exec` → MailApp. Fuentes `Codigo.gs` y `Acceso.gs` en
  `integration/apps-script/quejas-mail/`; copia integral:
  `docs/instalacion-apps-script/ECA-QMS-CODIGO-COMPLETO.gs`.
  Actualizar la **implementación existente de Google Apps Script** al cambiar
  su código; GitHub y Vercel no publican Google. Mantener URL, propiedades,
  activadores y el flujo de quejas/OTP. `Vercel READY` no demuestra recepción
  real ni garantiza que Google tenga la versión nueva.
  **Nuevo destino aislado (21 noviembre):** migración
  `20261121222345_acceso_correo_endpoint_independiente.sql` agrega
  `qms_private.mail_wake_settings.access_endpoint` (nullable).
  `qms_access_mail_transport()` usa `coalesce(access_endpoint,endpoint)`:
  sin URL nueva, Acceso sigue apuntando al transporte anterior. Al
  recibir una URL real `https://script.google.com/macros/s/.../exec`
  de una **implementación nueva del mismo proyecto Apps Script**,
  escribirla solo en `access_endpoint`; nunca reemplazar `endpoint`
  porque lo utiliza Quejas. Conservar Script Properties, permisos, secretos
  y triggers. Revalidar la recepción del correo real antes de afirmar éxito.
- **Incidencia real (21 noviembre, 16:06 CR):** `qms-access-mailer` v4
  recibió la solicitud y Google Apps Script respondió
  `invalid_access_delivery` **antes de `MailApp.sendEmail`**.
  Quejas usa un despacho diferente (`delivery_request`), por lo que sus
  correos sí pueden funcionar. El código histórico de `Acceso.gs` aceptaba
  invitaciones pero no `temporary_access`; otro posible rechazo es una
  discrepancia entre el dominio de `/login` de Supabase y las propiedades
  `QMS_PUBLIC_TRACKING_ORIGIN` / `APP_PUBLIC_URL` en GAS.
  La validación actual de GAS acepta **solo orígenes oficiales conocidos** y
  devuelve un recibo firmado con `login_origin_mismatch` o
  `invalid_access_payload` tras validar HMAC, nunca detalles privados.
  Ejecutar `qmsAccessMailHealthCheck` solo desde el editor y **publicar una
  nueva versión en la implementación existente**: GitHub y Supabase no
  actualizan automáticamente el código de Google Apps Script.
  No afirmar entrega real sin un correo de prueba controlado.
  **Diagnóstico posterior (21 noviembre, 17:07 CR):** una prueba
  desde Apps Script comprobó configuración, 494 bytes y HMAC correctos,
  pero `qmsAccessMailPost_` retornó el genérico
  `invalid_access_delivery`. En el código actualizado, después de la
  verificación exitosa debería generar `access_delivery_receipt`
  firmado con `invalid_access_payload` o `login_origin_mismatch`.
  Revisar **definiciones duplicadas** del manejador (por ejemplo,
  conservar `Acceso.gs` además del archivo completo) y que la solicitud
  usada en el paso del handler coincida con la verificada.
  `qmsAccessMailHealthCheck()` confirma los marcadores del manejador
  ejecutado y el formato del dominio sin exponer su valor; 
  `qmsAccessMailSelfTest()` firma una solicitud deliberadamente inválida
  y comprueba **ambas rutas** sin llamar `MailApp`. Ambas rutas deben
  devolver `signed_receipt/invalid_access_payload`.
  **Revisión del archivo realmente utilizado:** el código completo compartido
  por el administrador tiene 846 líneas, una sola función `doPost` y una sola
  `qmsAccessMailPost_`. El indicador que comparaba
  `String(qmsAccessMailPost_)` era insuficiente y podía dar un falso negativo;
  **no diagnosticar duplicados basándose únicamente en ese indicador**.
  El diagnóstico `2026-11-21-fases` comprueba el sobre firmado mediante
  `qmsMailVerify_` y reporta formatos de UUID, longitud y fase concreta
  del rechazo desde ambos manejadores. Usa una solicitud intencionalmente
  inválida y una barrera `preventSend` para no llamar a MailApp durante QA.
  Si `roundTripValid=false`, investigar firma/decodificación, no dominio
  de login. Si es `true` pero el manejador falla, utilizar `direct.phase`
  y `doPost.phase` para localizar el siguiente paso.
  **Inconsistencia observada a las 17:33 CR:** el usuario ejecutó
  `qmsAccessMailSelfTest`: firma, nonce y UUID correctos, pero ambos
  manejadores devolvieron `generic_rejection` sin fase registrada.
  En el código nuevo esa ruta debería establecer
  `phase='configuration'` de inmediato. Para aislar cualquier desajuste
  entre la función existente y la publicada, `doPost` ahora invoca
  directamente al manejador **`qmsAccessMailPostV20261121_`**
  versionado; no se modifica el transporte de Quejas.
  La prueba requiere `direct.handlerVersion` y
  `doPost.handlerVersion='2026-11-21-v2'`, con diagnóstico
  `2026-11-21-versioned`. Prueba sintética: autodiagnóstico válido y
  un correo ficticio aceptado por el simulador de MailApp; esto NO
  certifica correo real ni ejecución actual en Google. Para aplicarlo,
  reemplazar el único archivo Apps Script por el paquete completo y
  publicar nueva versión en la implementación existente de Acceso,
  sin modificar Supabase ni los correos de Quejas.
  El registro compartido incluyó el secreto completo; **rotar**
  `QMS_MAIL_SECRET` y `QUEJAS_MAIL_SIGNING_SECRET` coordinadamente
  en sus respectivas plataformas, sin registrarlos ni copiarlos
  en GitHub o en la conversación. No rotar solo uno porque rompe firmas.
- **Pruebas:** validar `tests/usuarios-invitacion-restaurada.test.mjs`,
  `tests/usuarios-acceso-seguro.test.mjs`, `tests/usuarios-acceso-mail.test.mjs`,
  suites de Usuarios y build/TS. Usar fixtures y buzones controlados; confirmar
  recepción real, primer login, cambio obligatorio y 2FA activada/desactivada
  antes de declarar un E2E completo. No enviar a terceros ni crear cuentas de
  producción como sustituto de tests.

**Diseño público:** `/q/seguimiento` y la confirmación de queja comparten
`FondoIdentidad`, `PublicQmsHeader`, tarjeta blanca centrada y pie interno.
No hay botón «Actualizar estado». Formulario público ancho máximo 860px;
plantilla institucional HTML de correo máximo 900px, más compacta, con fuentes
de respaldo porque Gmail puede sustituir Inter. El correo ya entregado no
cambia retroactivamente.


## Antes de editar

- Respetar el working tree y consultar el AGENTS.md del subdirectorio aplicable.
- Leer la guía local de Next instalada antes de escribir código Next. Usar proxy.ts; no añadir middleware.ts junto a él.
- Apariencia: leer [docs/visual-patterns.md](docs/visual-patterns.md). El kit activo es Tailwind v4 sin prefijo, sin CoreUI/Bootstrap.
- Supabase: leer .agents/skills/supabase/SKILL.md. Para SQL/esquema/RLS/índices, leer también supabase-postgres-best-practices y las referencias pertinentes.
- Antes de cambiar DB, consultar esquema, policies y grants efectivos. SQL histórico y documentación son referencias; RLS habilitada no demuestra autorización correcta.
- No copiar .env, claves, tokens, contraseñas ni datos privados a logs, documentación, prompts o fixtures. Documentar nombres, nunca valores secretos.
- Usar imports @/ y las capas existentes; sin segunda arquitectura de datos, Server Actions ni nuevas dependencias visuales para una vista.
- Registrar como pendiente lo que exista solo en DB, en un prototipo o en una utilidad sin consumidores. No atribuir una capacidad por encontrar un archivo.
- Comentar invariantes, decisiones y trampas no obvias; no narrar línea por línea lo que ya expresa el código.
- Para una tarea acotada, leer solo esta entrada, la guía AGENTS.md de la carpeta tocada y el tema enlazado en el mapa.
- Antes de editar, rastrear consumidores de la regla/símbolo y contratos relacionados; un cambio en un módulo puede afectar listas, permisos, APIs, informes y otros módulos.
- Compartir una abstracción solo si los consumidores tienen el mismo comportamiento/contrato; conservar local lo que sea específico. No generalizar para ahorrar líneas.
- Separar IDs persistidos/rutas/claves, etiquetas visibles y colores/clases. Cambiar una etiqueta no debe cambiar IDs; un ID persistido exige revisar API, DB, informes, fixtures y migraciones.

## Capas y fuentes únicas

| Qué se modifica | Fuente |
| --- | --- |
| Rutas, nombres, grupos e IDs de módulo | lib/constants/modulos.ts |
| Roles operativos | lib/constants/roles.ts |
| Colores de badges/estados | lib/constants/badges.ts y estados.ts; Quejas prioriza estado_color del catálogo |
| Marca institucional (menú y login) | components/EmpresaLogo.tsx con isotipo ECA local; claves independientes en lib/constants/marca.ts e identidad.ts; editores en app/configuracion/components/IdentidadSettings.tsx |
| Colores y tipografía | app/styles/theme.css (@theme) |
| Recetas y utilidades visuales | app/styles/components.css y app/globals.css |
| Controles, modales y cargas | components/ui/ y components/Modal.tsx |
| Páginas y editores | app/<modulo>/page.tsx y sus components/ |
| Workspace y ciclo de Quejas/Mis Quejas | app/quejas/components/QuejaExpedientePanels.tsx y quejaExpedienteModel.ts; paneles de cada rol |
| Tarjetas de «Siguiente paso» y triaje compacto | app/quejas/components/CaseTriageSummary.tsx (CaseTriageSummary, CaseTriageNextStep, CaseTriageExcerpt, CaseTriageAttachments); metadatos por etapa en quejaExpedienteModel.ts; integración en QuejaDetalleModal.tsx y QuejaColaboradorPanel.tsx |
| Borrador guardado de resolución | lib/queries/useQuejaResolucionDraft.ts; guardarResolucionBorrador/enviarResolucionBorradorRevision en quejaWorkflowService.ts; [contrato](docs/mis-quejas-borrador-resolucion-2026-11-11.md) |
| Asignación de investigación de Calidad | QuejaInvestigacionAsignacion.tsx, useQuejaInvestigationAssignment.ts, iniciarInvestigacionQueja en quejaWorkflowService.ts; migración 20261115041345_quejas_investigacion_asignacion.sql |
| Ciclo de trabajo en Mis Quejas | app/mis-quejas/components/MisQuejasEtapas.tsx y etapasResponsable.ts; QuejaColaboradorPanel.tsx; lectura por expediente en useQuejaAsignada.ts |
| Historial y notas en ambos módulos | components/quejas/QuejaNotasPanel.tsx y QuejaHistorial.tsx; hooks/useQuejaNotas.ts; useQuejaHistorial.ts y GET /api/quejas/historial |
| Mis adjuntos en Evaluación y Resolución | app/mis-quejas/components/QuejaAdjuntosInvestigacion.tsx; autor y vínculos de oficio/devolución en etapasResponsable.ts, selección de oficio en QuejaDetalleModal.tsx y de PDF en QuejaRespuestaClienteModal.tsx |
| Foto personal | components/perfil/MiPerfilModal.tsx, lib/queries/useFotoPerfil.ts y app/api/perfil/avatar/route.ts; bucket privado qms-avatars en la migración 20261117223249, preparada para activar |
| Área, adjuntos y visor compartidos | components/quejas/AreaAfectada.tsx, ListaAdjuntos.tsx y AdjuntoPreviewModal.tsx; AreaQuejaControl.tsx para edición |
| Plazo como semáforo | components/quejas/QuejaPlazoIndicator.tsx; lib/utils/quejaDeadline.ts y caseDeadline para el cálculo existente |
| Informe editable y Word/PDF | QuejaInformeModal.tsx; lib/queries/useQuejaInforme.ts; lib/services/quejaInformeService.ts; lib/utils/quejaInforme*.ts |
| PDF oficial automático por versión | QuejaInformeModal.tsx; subirAdjuntoQueja; informePdfFilename en lib/utils/quejaInforme.ts; quejaAdjuntosKey |
| Soportes de devolución GC | QuejaInvestigacionResumen.tsx; lib/queries/useQuejaDevoluciones.ts; RPC qms_review_resolution_with_attachments; queja_gc_revision_adjuntos |
| Navegación, lectura y resumen comunes | CaseWorkspaceNavigation y CaseReadOnlyHeader en QuejaExpedientePanels.tsx; QuejaCierreResumen.tsx para ambos roles; RegistroDesdeEnlace.tsx consume `?abrir=<id>` |
| Tabla de Usuarios y acciones | app/usuarios/page.tsx (colgroup, encabezados, filas y tarjetas móviles); app/usuarios/components/UsuarioAccionesMenu.tsx (menú/portal/foco) |
| Alta/gestión de Usuarios y acceso | components/usuarios/UsuarioFormModal.tsx (crear/editar, contraseña integrada y pestañas), app/usuarios/page.tsx (callbacks); PasswordModal.tsx y ResetPasswordModal.tsx solo legacy, sin montaje en Usuarios |
| Acceso temporal de nuevas altas / 2FA opcional e invitaciones legacy | components/usuarios/UsuarioAccesoInicial.tsx, UsuarioFormModal.tsx, UsuarioSeguridadAcceso.tsx y UsuarioAccessBadges.tsx; app/acceso/page.tsx solo canje legacy; lib/server/accessIdentity.ts y accessService.ts; migraciones 20261117214855 y 20261121190202; contrato vigente arriba |
| Eliminar cuenta conservando expedientes | DELETE app/api/usuarios/route.ts; lib/server/usuarioDeletion.ts; RPC service-only qms_delete_user_account; migración aplicada 20261117212024 y [contrato](docs/usuarios-eliminacion-2026-11-17.md) |
| Correo de acompañamiento y publicación | QuejaRespuestaClienteModal.tsx, QuejaCorreoEditor.tsx; lib/utils/quejaCorreo.ts; useQuejaRespuestaCliente.ts y quejaWorkflowService.ts |
| Lecturas/claves/TTL/paginación | lib/queries/, queryKeys.ts, cacheConfig.ts, pagination.ts |
| Calendario laboral y feriados QMS | app/configuracion/components/CalendarioSettings.tsx; lib/queries/useQmsCalendar.ts; lib/services/qmsCalendarService.ts; lib/utils/qmsCalendar.ts |
| Agenda de hoy | lib/queries/useAgendaHoy.ts; components/ui/AgendaHoyWidget.tsx; components/Header.tsx; RPC qms_get_agenda_hoy, migración 20261111172515; [contrato](docs/agenda-hoy-2026-11-11.md) |
| Workflow/mutaciones | lib/services/; guards privilegiados en lib/server/ |
| Consecutivos anuales | qms_private.next_annual_folio; folios_quejas_anuales / qms_private.folios_anuales; migración 20261111151343 y [contrato](docs/consecutivos-anuales-2026-11-11.md) |
| Lectura de justificación/análisis de Quejas | lib/utils/quejaContent.ts y lib/utils/richText.ts |
| Formulario ciudadano y borrador/reintentos | app/q/[token]/page.tsx; app/q/components/usePublicQuejaForm.ts; lib/services/publicQuejasClient.ts |
| Validación de bytes de evidencias públicas | lib/server/publicForms/files.ts; límites y tipos en lib/constants/publicForms.ts |
| Validación ciudadana idéntica en cliente/API | lib/utils/publicQuejaValidation.ts; códigos de campo cerrados, sin diagnósticos remotos; nombre solo letras y teléfono solo dígitos/signos, con límites aplicados en cliente y API, sin textos de ayuda permanentes |
| Seguimiento privado y publicación final | app/q/seguimiento/; lib/server/publicTracking.ts; app/quejas/components/QuejaPublicacionPanel.tsx |
| Correo: plantillas, identidad, entregas y reintentos | supabase/functions/quejas-mail-queue/, qms-access-mailer/ y _shared/emailIdentity.ts; qmsMailHeader_/qmsMailFrame_ en integration/apps-script/quejas-mail/Codigo.gs y acceso en Acceso.gs; copia completa en docs/instalacion-apps-script/ECA-QMS-CODIGO-COMPLETO.gs; app/api/quejas/correos/reintentar/route.ts |
| DB aplicada y evidencia | supabase/migrations/ y supabase/backups/ |

Stack local: Next 16.4.6, React 19.2.4, Supabase JS 2.111.0, TanStack Query 5 y Zustand 5.
Historial documentado al 10 noviembre: correo por evento activo en DB/Edge
v17/Apps Script v5, con autorización Google/Drive y recibo HMAC/adjunto final
verificados en aquella fecha; no representa auditoría remota nueva. La web
continuó evolucionando y los cambios de Quejas del 14 noviembre ya están
desplegados, según SHA verificado abajo. Contrato histórico:
[formulario y correo](docs/quejas-formulario-correo-inmediato-2026-11-10.md).
El layout servidor solo monta metadata/font y AuthShell/ToastProvider. Las páginas
operativas son Client Components; negocio se lee por hooks/servicios. API, proxy.ts
y lib/server/* son servidor. createServiceClient es server-only; nunca importarlo en UI.
El mapa contiene rutas exactas y explica dónde modificar cada función.
Las carpetas app/, lib/, components/ y tests/ tienen una guía local breve; se aplica
solo al editar esa capa.
Para trabajo por módulo, registra sus capacidades terminadas y pendientes; no marques
un módulo como completo solo porque su página o tabla exista.

## Inventario funcional y cobertura — corte del 15 noviembre de 2026

Este inventario complementa el contrato de arquitectura. **Operativo** significa que
hay ruta/consumidor y lógica integrada en el repositorio; no significa aceptación
institucional ni que el último commit esté publicado. **Parcial** obliga a respetar
sus límites. No extrapolar producción, permisos ni ejecución de pruebas por existir
archivos, migraciones o documentación.

| Área / ruta | Capacidades conectadas en el código | Alcance que NO se debe suponer |
| --- | --- | --- |
| Inicio `/`, alias `/dashboard` | KPIs, resumen de Quejas, tareas por vencimiento, actividad y consultas independientes con caché | Dashboard analítico alternativo, métricas de todos los módulos |
| Quejas `/quejas` | Alta/consulta, filtros, estados y colores de catálogo, área afectada, timeline, plazos, revisión GC, devolución, relación SACP, resolución, expediente oficial y publicación final | Publicar al aprobar GC, omitir PDF/oficio, derivar desde cualquier estado |
| Mis Quejas `/mis-quejas` | Casos del responsable real, etapas Análisis/Resolución/Revisión de Calidad, notas e historial, evidencias propias, asistencia, borrador versionado y envío/reenvío a revisión | Acceso a casos ajenos, autoguardado o publicar respuesta ciudadana |
| Informe y comunicación | Tiptap A4 en modal, versionado, exportación Word/PDF, PDF oficial en Drive por folio/versión, correo editable con borrador/publicación y archivo físico adjunto | Considerar la paginación visual como paginación del PDF; enviar sin documento autorizado |
| Formulario ciudadano `/q/[token]` | Registro con capacidad privada, validación cliente/API, evidencias limitadas, reintento idempotente, finalización y acceso al seguimiento según estado | Portal de usuario externo con login, ver notas internas o recuperar una capacidad vencida |
| Seguimiento ciudadano | Enlace de capacidad y consulta del estado, plazos de caducidad y etapas permitidas | Identidad verificada del portador o lectura pública del expediente completo |
| Usuarios `/usuarios` | CRUD/estado, roles/permisos, tabla adaptable; nueva alta con email/contraseña temporal de 72h, cambio obligatorio, 2FA opcional y reenvío; invitaciones legacy y reset MFA | La recepción real del correo requiere prueba; sin alta pública, recuperación genérica ni gestor universal de sesiones |
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

**Corte de correcciones del 14 noviembre:** el compositor de Respuesta al cliente
tiene una sola zona desplazable (el textarea); Para, Asunto y Adjuntos permanecen
fijos. La hoja A4 no dibuja un marco final solo por un separador, pero debe preservar
páginas cortas con contenido y permitir hojas reales adicionales. La plantilla solo
inserta un párrafo vacío editable antes de Anexos. El PDF descargable se pagina
independientemente de Tiptap; un documento corto se prueba sin hojas en blanco y
uno largo sin truncamiento. La vista previa utiliza `fetchDriveBlob` por API privada
Bearer, precarga según selección/hover/focus y comparte una descarga en curso.
Cuando la API confirma la subida/registro, `recordarDriveBlob` retiene bytes en
memoria por usuario/rol hasta 45 segundos (máximo 5 entradas), sin redescarga
inmediata y sin compartir entre sesiones. El primer archivo remoto puede tardar
por Drive y autorizaciones; no afirmar rendimiento instantáneo sin E2E autenticado.

**Interpretación de pruebas:** los tests Node sobre scroll, deduplicación, PDF
corto/largo y guardado son regresiones del código, no demostración de experiencia
en navegador ni de entrega de correo real. Vercel READY significa build disponible;
confirmar el SHA asociado al alias `mi-dashboard-iota.vercel.app` antes de afirmar
que una corrección está en producción. La rama `fix/qms-pdf-pages-preview-scroll-20261114` pertenece a ese corte
histórico: para cambios nuevos consultar el `main` vigente y proponer ramas/PR
sin sobrescribir trabajo ajeno. No inferir por ello el SHA en producción.

## Biblioteca de arquitectura

Este archivo es la entrada y contiene los invariantes que aplican a cualquier cambio.
La biblioteca detallada vive en `docs/`; abre la referencia del tema afectado y sigue
el mapa para llegar a su fuente de código. Los documentos describen el código y la
evidencia disponible, no garantizan que un despliegue posterior conserve ese estado.

| Área del sistema | Referencia principal | Cobertura |
| --- | --- | --- |
| Mapa general y puntos de edición | [docs/arquitectura/README.md](docs/arquitectura/README.md) | Capas, flujo de cambios, mapa de archivos y revisión de impacto entre consumidores |
| Módulos y reglas de negocio | [docs/arquitectura/modulos-y-flujos.md](docs/arquitectura/modulos-y-flujos.md) | Dashboard, Quejas, formulario público, Configuración, catálogos y estado real de otros módulos |
| Apariencia e interacción | [docs/visual-patterns.md](docs/visual-patterns.md) y [docs/arquitectura/visual.md](docs/arquitectura/visual.md) | Tokens, componentes, responsive, accesibilidad, cargas, modales e impresión |
| Sesión y autorización | [docs/arquitectura/sesion-y-permisos.md](docs/arquitectura/sesion-y-permisos.md) | Identidades, login/logout, restauración, roles, rutas, guards, API y límites de seguridad |
| Lecturas y rendimiento | [docs/arquitectura/datos-y-rendimiento.md](docs/arquitectura/datos-y-rendimiento.md) | TanStack Query, claves, TTL, paginación, precarga, cancelación, Realtime y errores |
| Persistencia y base de datos | [docs/arquitectura/base-de-datos.md](docs/arquitectura/base-de-datos.md) | Esquema, relaciones, RLS, grants, RPC, motor QMS, migraciones y evidencia aplicada |
| API e integraciones | [docs/arquitectura/integraciones.md](docs/arquitectura/integraciones.md) | Contratos de endpoints, Usuarios, Drive, IA, secretos y configuración externa |
| Pruebas, despliegue y pendientes | [docs/arquitectura/verificacion-y-pendientes.md](docs/arquitectura/verificacion-y-pendientes.md) | Verificación por tipo de cambio, evidencia previa, límites conocidos y trabajo no integrado |
| Reglas de cada capa | [app/AGENTS.md](app/AGENTS.md), [lib/AGENTS.md](lib/AGENTS.md), [components/AGENTS.md](components/AGENTS.md), [components/ui/AGENTS.md](components/ui/AGENTS.md) y [tests/AGENTS.md](tests/AGENTS.md) | Convenciones locales que se consultan al cambiar esa carpeta |

### Modelo mental del sistema

- **Presentación:** `app/` contiene rutas, páginas y API; `components/` contiene el shell, controles y paneles. Las páginas operativas son Client Components. El layout servidor monta metadata/fuente y los proveedores de autenticación y notificaciones.
- **Estado:** TanStack Query administra datos remotos a través de `lib/queries/`; `lib/store/` (Zustand) administra sesión y estado de interfaz. Las ediciones sin guardar permanecen locales; resolución, informe y respuesta al cliente tienen guardado remoto versionado.
- **Lecturas y escrituras:** los hooks/queries leen datos; `lib/services/` concentra flujos y mutaciones. Las lecturas de navegador usan el cliente Supabase sujeto a RLS. Las operaciones privilegiadas atraviesan API/`lib/server/`, que autentican y autorizan antes de usar service role.
- **Identidad y acceso:** `lib/store/auth-store.ts`, `lib/auth.ts` y `components/AuthShell.tsx` coordinan sesión y protección de rutas; `proxy.ts` participa en el límite de entrada. La autorización de servidor y RLS siguen siendo necesarias aunque la UI oculte una acción.
- **Persistencia e integraciones:** `supabase/migrations/` conserva cambios de esquema; `supabase/backups/` y las referencias de arquitectura aportan evidencia. Drive e IA se conectan desde APIs de servidor con límites y permisos propios.
- **Fuentes canónicas:** rutas/módulos y roles están en `lib/constants/`; lectura y caché en `lib/queries/`; workflows en `lib/services/`; tokens visuales en `app/styles/`; políticas/esquema aplicado en Supabase. No mantener una copia paralela de estas reglas.

## Invariantes de sesión y autorización

- Auth relaciona auth.users.id con usuarios.auth_id. Entidades, autores y responsables usan usuarios.id; son identidades distintas.
- El rol de máxima autoridad operativa es admin. No existe superadmin integrado; no autorizar con user_metadata editable.
- Restauración: getSession detecta credenciales → getUser verifica identidad → perfil/permisos independientes en paralelo → exigir activo y revisión vigente → publicar juntos.
- Eventos Auth tienen callback síncrono y difieren llamadas SDK. Refresh de la misma identidad conserva permisos, vista y caché.
- Login exige perfil activo e identidad remota coincidente. Logout marca cierre pendiente y retira usuario/permisos/vista/caché antes de esperar la red.
- qms:logout-pending en sessionStorage contiene solo un booleano. Recargar durante cierre continúa cerrando; ningún evento tardío puede restaurar el perfil anterior.
- Cambiar identidad/rol/vista separa el ámbito de QueryProvider y vacía el anterior. Navegar dentro del mismo ámbito conserva caché. El guard queda fuera del key de datos.
- AuthShell bloquea hijos privados antes de validar y mientras router.replace redirige. No mostrar contenido anterior, siquiera para cubrir una espera.
- Una URL privada pendiente muestra solo fondo neutral; login/logout/destino confirmado a login usan su skeleton. Después de autorizar carga solo el módulo solicitado, sin barra global ni doble skeleton.
- /login y /q son públicos por segmento. /usuarios y /configuracion requieren además rol real admin incluso al simular vista.
- Vista por rol cambia presentación, nunca Auth ni RLS. El registro de módulos no concede permisos; una nueva ruta exige revisar lectura/escritura, API y DB.
- Mantener guard Bearer/perfil activo/rol/entidad en cada API. API_WITH_ROUTE_AUTH solo incorpora métodos con guard completo y pruebas de token inválido; el proxy descarta headers de identidad enviados por cliente.
- Service role evita RLS: cada handler que lo usa debe autorizar antes al llamador. Guard cliente no autoriza solicitudes directas.
- Quejas usa qms_update_details/qms_transition_complaint y qms_update_complaint_register con revisión esperada. Nunca leer una revisión nueva para forzar el reintento ni reabrir EXECUTE de los RPC legacy.
- Una respuesta tardía no puede cambiar silenciosamente el ámbito, revisión esperada, estado inactivo o cierre pendiente para hacer pasar una operación.

Detalle: [sesión y permisos](docs/arquitectura/sesion-y-permisos.md).

## Datos, rendimiento y cargas

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
- El diagnóstico de correo usa códigos públicos; «Reintentar envío» reprograma
  la misma fila del outbox si el fallo fue previo a MailApp. El poll existente
  conserva autorización, reserva y deduplicación. La migración local
  `20261120224355` corrige el acceso de máquina a la regla privada de autorización.
- Agenda: RPC invoker de Quejas/Auditorías, permisos y fechas CR, máximo 20 y un
  motivo prioritario por registro. Caché de cinco minutos por perfil, sin canal
  Realtime adicional ni hover. Los avisos existentes invalidan también Agenda.
  Header controla apertura/cierre; UI solo recibe datos/callbacks.
  /dashboard es alias protegido del panel en /. Asignación/devolución salen de
  eventos reales. SQL aplicado; verificar SHA de producción para determinar su publicación. [Contrato](docs/agenda-hoy-2026-11-11.md).
- Agenda compacta (máximo 320px) abre en calendario con semana D/L/M/X/J/V/S,
  flechas de mes anterior/siguiente, selección circular y puntos por fecha_limite
  real y prioridad. El RPC añade fecha_limite civil CR (null si no existe), caché
  de contrato v3, cinco minutos. «Ver agenda» muestra cinco tarjetas y «Volver al
  calendario» regresa. Si hay más de cinco, «Ver más» aparece dentro del scroll y
  despliega ahí los restantes recibidos, sin navegar a otro panel. Navegar meses no consulta
  otras agendas ni inventa eventos: puntos solo para los registros recibidos.
  Cada apertura restablece mes actual y selección. Migración 20261111175442 aplicada;
  confirmar publicación por SHA de producción. [Contrato](docs/agenda-hoy-2026-11-11.md).
- Calendario de Agenda: mes a la izquierda y las dos flechas juntas a la derecha,
  con área 32px e iconos 20px. Grillas gap-1, días 32px y puntos de 4px. Pie de una
  sola fila: check circular azul + «X tareas hoy» y «Ver agenda» como acción textual azul, ambos text-xs; «hoy» en color de texto normal, sin CTA
  relleno ni elementos apilados. Check y «Ver agenda» usan qms-primary; el día
  seleccionado usa fondo qms-primary y texto blanco, sin cambiar la marca global.
- Agenda de hoy reúne novedades accionables de hoy (recepción, asignación, propuesta
  para GC, devolución, lista para publicar y programación) y plazos de hoy o dentro
  de dos días hábiles. La ventana incluye un día hábil con etiqueta precisa.
  Excluye vencidas y finalizadas; novedades antiguas solo reaparecen por vencimiento.
  Calidad ve recepción/revisión/publicación; el colaborador solo su investigación.
  Quejas usa el calendario de su run persistido; Auditorías usa el calendario vigente.
  No inferir novedades a partir de la creación si su evento real es otro.

- Campana: últimos 15 avisos no archivados, orden fecha/ID y contador de
  no leídos exacto. La consulta de conteo sin filas se hace cuando hay avisos
  fuera de la lista. Desactivar avisos suspende su consulta, canal y sonido.
  Agenda conserva su caché de cinco minutos, refresca en primer plano e
  invalida con avisos nuevos o reconexión.
- Visor: validar lectura del expediente con RLS persistida antes de acreditar
  la carpeta/archivo en Drive. Intención de 80 ms y máximo dos precargas
  nativas, caché privada 45 s/5 archivos por identidad/rol. Mostrar indicador
  luego de 180 ms y revelar cuando carga la vista, con transición de 150 ms
  que respeta movimiento reducido. Formatos de Google compatibles usan la vista
  privada de Drive y sus permisos; la descarga queda disponible.
- Foto propia: JPG/PNG/WebP hasta 2 MiB y 16 MP, recodificada a WebP 320×320.
  API Bearer de perfil activo, objeto privado por usuario y puntero con
  comparación de la versión leída. Usar iniciales hasta que la foto cargue.
  Cliente/API y pruebas locales listos; la activación de la migración de bucket,
  autoría de notas e índices espera autorización explícita del proyecto remoto.

- TanStack es estado remoto; Zustand gestiona sesión/UI. No duplicar consultas en estado global ni globalizar borradores locales.
- Compartir queryKeys y queryFn entre vista/precarga; invalidar el prefijo del módulo tras mutar. Una queryFn recibe contexto: pasar solo context.signal a abortSignal.
- Precargar por intención (80 ms), con identidad/permisos y claves reales. Mis Quejas siempre filtra responsable propio; sin ID no consulta.
- Listados operativos: 25 filas y orden estable; dashboard comparte cuatro recursos, más estadísticas/actividad independientes. No bloquear todos los bloques por la consulta más lenta.
- Conservar caché fresca al navegar y refrescar según TTL. Sin caché global infinita, duración mínima ni requests para aparentar fluidez.
- Realtime agrupa 750 ms, compacta prefijos, resincroniza al reconectar y limpia canal/timer/callbacks al desmontar.
- Carga inicial con Skeleton/LoadingSkeleton; operaciones con Button loading/Spinner/OperationLoading centrados. Cantidad fija de formas CSS, movimiento reducido, sin spinner permanente por fila.
- Guardados: validar antes de efectos, bloquear doble envío, conservar borrador/error y distinguir escritura exitosa de refresco fallido. Errores visibles pasan por helpers seguros.
- Paneles de Quejas usan guards por visita y ámbito de QueryClient; una escritura confirmada invalida su origen mientras el ámbito siga vigente. Respuestas viejas nunca editan otra visita ni borradores nuevos.

Detalle: [datos y rendimiento](docs/arquitectura/datos-y-rendimiento.md),
[flujos de módulos](docs/arquitectura/modulos-y-flujos.md) y [capa visual](docs/arquitectura/visual.md).

## Estado de DB e integraciones

- Proyecto Supabase: fykhrrpeoehwqznccmfp. MCP/OAuth es configuración del agente, no código del producto.
- Snapshot remoto documentado: 36 tablas con RLS y tres vistas invoker; no es un inventario remoto actualizado en cada edición. Seguridad aplicada: 20261006232152, 20261008011901 y 20261008012121; las dos últimas sustituyen políticas amplias de 13 tablas y cierran bypass SACP. Gateway público aditivo: 20261008224037 y compatibilidad Drive: 20261009031934.
- ai_* no es accesible por Data API cliente, incluso admin. Gestor IA pasa por /api/configuracion/ia con admin activo y respuestas sin claves guardadas; backend service role conserva acceso.
- Guardar IA preserva secreto vacío y consumo, usa revisión explícita/xmin y devuelve 409 en carreras. No reintentar silenciosamente con otra revisión ni introducir un RPC inexistente.
- Evidencias nuevas usan Drive, máximo 4 MiB; paths legacy siguen Storage. Borrar Drive primero y después la fila; no borrar metadatos si falla el archivo.
- Seguimiento añade reserva de borrado antes de Drive y publicación atómica de respuesta/oficio. No borrar un oficio publicado ni liberar una reserva incierta. Migración 20261015223440 y cortes de publicación/workflow aplicados el 19 octubre tras verificar cliente compatible; ver [contrato y activación](docs/quejas-seguimiento-y-publicacion-2026-10-16.md).
- Motor QMS y auditoría están en DB; Quejas/Mis Quejas/Dashboard/informes consumen sus plazos persistidos. DB encola y Apps Script envía/confirma a través de Edge HMAC, sin Vercel. El despertador pg_net por evento está activo desde el 10 noviembre; el poll de cinco minutos conserva recuperación y avisos internos. No requiere pg_cron.
- Seguridad y Estado, telemetría persistida/retención anual, fondo personalizado y selector completo de tema siguen pendientes. Alta nueva con contraseña temporal y 2FA opcional publicada según el corte verificado del 21 noviembre; el canje legacy se conserva sin modificar cuentas previas. Formularios públicos: gateway/BotID Basic publicado, variables cifradas y cortes legacy aplicados; Storage histórico restringido por expediente/perfil activo. Ver estado y límites en [su guía](docs/seguridad-formularios-publicos.md).
- Logout inmediato de UI no revoca universalmente todos los JWT emitidos. APIs privadas conservan rate limit por instancia; formulario público usa cuotas transaccionales PostgreSQL y tiene WAF Vercel publicado. No protegen el login Supabase externo.

Historial de activación: la entrega del 19 de octubre (`dpl_2kk83rkgKrip1MwK8NNbMcw2d2MF`) incorporó seguimiento, cortes de Storage RLS/Drive y cierre del RPC interno `qms_transition` legacy; es evidencia fechada, **no** el último despliegue actual. Para conocer el código web activo, consultar el alias de producción y su SHA en Vercel. Metadata anónima y escritura directa de adjuntos permanecen cerradas; el visor Drive usa API privada Bearer y URL local revocable. No reabrir accesos legacy ni restaurar clientes antiguos sin coordinar DB.

Detalle público: [seguridad-formularios-publicos.md](docs/seguridad-formularios-publicos.md). Mantener cerrado el acceso público legacy; cualquier corte de workflow interno exige verificar primero su cliente compatible publicado.

Detalle: [base de datos](docs/arquitectura/base-de-datos.md) e
[integraciones](docs/arquitectura/integraciones.md). No ejecutar dumps, seeds o SQL legacy como migración.

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
  DB aplicada el 11 noviembre; cliente local y calendario adicional aplazado.
  [Contrato y evidencia](docs/consecutivos-anuales-2026-11-11.md).
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
  Aprobar la propuesta en GC no exige adelantar la publicación del oficio. El número
  nuevo precarga el folio como valor editable; no es otra serie ni cambia el folio.
- Área afectada: selección directa junto a Descripción; solo se edita en Recibido
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
  cliente local. [Contrato](docs/mis-quejas-borrador-resolucion-2026-11-11.md).
- Decisiones/resoluciones usan Tiptap lazy, límite 10.000 y formato plain/markdown
  explícito. `quejaContent` omite
  solo la copia plain exacta `[Procede]` de una justificación separada; conserva otras
  notas y reaperturas. No interpretar HTML ni inferir Markdown de texto histórico.

Contratos: [revisión GC y respuesta](docs/quejas-revision-y-respuesta-2026-11-04.md),
[panel y procesamiento](docs/quejas-panel-2026-10-13.md) e
[informe editable](docs/quejas-informe-editable-word-2026-11-03.md).

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
- Ampliado: recorrido horizontal completo; desde 1100 px útiles, contacto a la
  izquierda, documento al centro y acciones a la derecha. Las etiquetas de los pasos
  se alinean con Descripción. Por debajo se apila sin desbordar el diálogo.
  El lienzo central tiene su propio scroll y ambos laterales quedan fijos, con
  texto sobre el fondo y botones del kit. Los laterales solo desplazan su
  contenido cuando el alto disponible es insuficiente. El encabezado ampliado
  usa el fondo de superficie del sistema. Anterior y Siguiente miden 44 px y comparten
  CaseWorkspaceNavigation con Ampliar/Reducir; la X la proporciona Modal.
  Ambos módulos comparten la hoja de lectura y el resumen vertical, con las
  etapas y acciones propias de cada rol.
- En Quejas, ciclo de evaluación/investigación/revisión/cierre; el contraído no usa
  checks verticales. No Procede muestra únicamente evaluación y cierre. Es una
  proyección del estado, nunca otro historial ni aprobaciones/fechas inventadas.
- Descripción comienza el documento y usa todo el ancho disponible. Área afectada
  queda a la derecha en el mismo encabezado, adaptándose al espacio. Sin resumen
  superior de resultado ni líneas verticales decorativas. En revisión GC se prioriza
  la propuesta y se pliegan Solicitud y antecedentes.
- Responsable antes de las acciones de Calidad. Devolver/Aprobar se ofrecen en el
  expediente, sin modal duplicado de lectura. Fecha real de cierre bajo el estado;
  Calidad ve el estado/hora del correo final sin reenviarlo por consultar.
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
  Las filas miden 40 px y la hora usa el formato de 24 horas. El GET privado se
  prepara al abrir el diálogo «Historial y notas» del folio y comparte petición y
  caché de 30 s con Historial. Mientras llega, la pestaña puede mostrar el ingreso que la vista
  ya tiene. El GET valida la sesión y el expediente por RLS y devuelve
  movimientos en orden descendente. Usa eventos QMS, revisiones, reaperturas y
  transiciones históricas vinculadas por folio, fecha y aviso del expediente.
  Resuelve nombres bajo los permisos de la sesión. Notas conserva texto breve sin
  título, orden descendente, reglas de escritura del rol y color por cuenta y
  navegador. Reabrir queja queda bajo el correo final en la columna de acciones.
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

Detalle y evidencia visual: [patrones](docs/visual-patterns.md),
[capa visual](docs/arquitectura/visual.md) y [panel](docs/quejas-panel-2026-10-13.md).

### Contrato de aceptación: triaje contextual y directorio (14-11-2026)

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
- **Pruebas mínimas antes de integrar:** `npx tsc --noEmit`,
  `npm run lint`, `node --test tests/quejas-progressive-disclosure.test.mjs
  tests/quejas-panel-reference.test.mjs tests/mis-quejas-workspace.test.mjs
  tests/quejas-stepper-consulta.test.mjs tests/usuarios-table-layout.test.mjs
  tests/usuarios-acciones-menu.test.mjs`, `npm run build`,
  `npm run check:structure` y `npm run check:visual`.
  La automatización de referencia es
  `.github/workflows/qms-workspace-verify.yml`. Una prueba de código correcta
  no sustituye inspección visual y operativa en navegador autenticado.


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
[revisión/respuesta](docs/quejas-revision-y-respuesta-2026-11-04.md);
estado y evidencias actuales en
[checklist 13/11](docs/quejas-checklist-aceptacion-2026-11-13.md).

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
- Seguimiento muestra etapas, fechas y respuesta permitida dentro de la tarjeta
  institucional con logo y pie interno; sin «Actualizar estado», «Copiar enlace»
  ni descarga de informe en esa vista. Quitar UI no revoca capacidades ni endpoints.
- El propietario confirmó el reintento del PDF original y la lectura remota verificó
  un adjunto completo con checksum coincidente. Excluyó recuperar la evidencia antigua
  de otro folio; no recrearla ni generar quejas de prueba para compensar esa exclusión.

Contrato y activación: [formulario/correo del 10 noviembre](docs/quejas-formulario-correo-inmediato-2026-11-10.md).
Seguridad y capacidad: [formularios públicos](docs/seguridad-formularios-publicos.md) y
[seguimiento/publicación](docs/quejas-seguimiento-y-publicacion-2026-10-16.md).

## Correo, avisos, sonido y calendario

- Dos eventos ciudadanos: recibido y final (No Procede o publicación de respuesta).
  Inicio de investigación queda histórico; reapertura/Finalizado no duplican envíos.
  DB encola, Edge autoriza/transporta y Apps Script envía/confirma mediante HMAC,
  leases, nonce y ACK. No depende de Vercel ni de un worker web.
- Despertador por evento activo según evidencia del **10 noviembre**: `pg_net`
  después del commit, Edge **v17** y Apps Script **v5**, sin revertir el negocio si
  falla el despertar. Migraciones `20261110203610` y `20261110212506` aplicadas;
  settings/Vault privados y RPC de máquina solo service_role, sin claves en logs.
- Claim urgente de hasta dos correos ciudadanos, respetando finalización del
  formulario, orden y deduplicación; el poll de cinco minutos conserva recuperación
  y avisos internos. Envío por evento no garantiza latencia, cuota ni entrega en inbox.
- Antes de intentar el final, autorizar y verificar el único documento publicado,
  descargarlo y adjuntarlo físicamente. No aceptar un final nuevo sin adjunto.
  Diario mínimo del emisor sin destinatarios/contenido; no reenviar sent ni reintentar
  incertidumbre a ciegas. Una recuperación histórica autorizada no habilita reenvíos en masa.
- Avisos internos: recepción a Calidad, evaluación a un día, asignación al responsable,
  investigación a cinco días a Calidad y a tres a ambos, vencimientos pertinentes.
  Destinatarios activos con rol real calidad; admin no sustituye ese rol. Conservar
  corte temporal, calendario y pertinencia antes del envío; límite de claim cero no
  reserva correo y permite procesar campanas.
- Sonido: primera lectura silenciosa; IDs nuevos y reclamo IndexedDB atómico entre
  pestañas, con sesión/preferencias vigentes. Preparar MP3/contexto por gesto antes
  de reclamar; recuperar descarga fallida. Si falla almacenamiento, omitir audio
  automático. No prometer sonido sin permiso/interacción previa del navegador.
- Calendario admin en Configuración: días ISO/feriados confirmados, motivo y versión
  capturada, publicación con `qms_publish_calendar`. Afecta etapas nuevas, no abiertas;
  conflictos conservan borrador/revisión. SLA legacy no publica calendarios QMS ni
  justifica editar genéricamente reglas 3/15. No inventar feriados institucionales.

Referencias: [correo por evento](docs/quejas-formulario-correo-inmediato-2026-11-10.md),
[protocolo](docs/seguridad-correos-quejas.md),
[avisos internos](docs/avisos-internos-quejas-2026-10-14.md),
[audio](docs/notificaciones-audio-2026-10-14.md) y
[calendario](docs/calendario-qms-2026-10-15.md).

## Alcance de los demás módulos

Dashboard monta consultas compartidas, próximos vencimientos y actividad real, con
cargas independientes; no los tabs analíticos alternativos. Configuración agrupa
Organización/Acceso/Servicios y exige admin real. Los controles de «Roles y
accesos» ya no están en Configuración: ahora viven en Usuarios → Roles y permisos,
dentro de app/usuarios/components/RolesAccesos.tsx. Se conserva usePermisos y
useActualizarPermiso, escrituras por nivel sobre leer/escribir, guardado inmediato,
restricciones de configuración solo admin y usuarios solo admin; NO inventar
permisos distintos de esos dos booleanos ni simular guardado al hacer clic.
Usuarios administra cuentas por API con guards; no asumir cierre transaccional
distribuido del último admin. Crear/editar/activar/desactivar/eliminar y
restablecer o definir contraseña **desde el propio panel** utilizan el API existente.
Alta con contraseña temporal por correo y 2FA opcional conectada en web/DB/Edge
según corte del 21 noviembre. El nuevo usuario recibe email, clave temporal y botón
«Iniciar sesión», con cambio obligatorio al entrar. El reenvío de invitación legacy
se mantiene aparte. Verificar la versión realmente publicada en Google Apps Script.
La recuperación genérica y el gestor general de sesiones siguen pendientes.
Nunca mostrar éxito ficticio ni inventar estado 2FA. Usuarios evita
repetir el título «Gestión de accesos» sobre un encabezado «Usuarios» existente
y usa un único lienzo con pestañas y «Nuevo usuario» en la cabecera,
filtros en la banda siguiente, tabla y paginación debajo; Roles comparte el
mismo lienzo sin contenedores anidados. Se conserva paginación en cliente,
scroll vertical interno y tarjetas móviles sin scroll horizontal. Ambos modales usan
`Modal` `variant="document" size="mail" height="fill"` (896 px / 90dvh),
con cabecera, scroll único y pie fijo. Crear mantiene una vista con «Información del usuario» y «Acceso al sistema»;
  tras el alta muestra el resultado de envío y permite reenviar bajo autorización,
  pero **jamás muestra ni copia la contraseña temporal** en el modal.
Editar conserva pestañas «Detalles del perfil» y «Seguridad y acceso», avatar,
y zona de peligro con confirmación. FormData permanece montado al cambiar de tab.
La pestaña Seguridad preselecciona contraseña generada, ofrece regenerar, mostrar,
copiar, cancelar o guardar; la contraseña manual también se guarda con PATCH
validado sin abrir una segunda ventana. El botón «Restablecer contraseña» del
menú abre directamente esa pestaña. No renderizar `PasswordModal` ni
`ResetPasswordModal` desde `/usuarios`; ambos componentes legacy permanecen
en el repositorio solo por compatibilidad hasta su eventual retiro.
La invitación **por correo** y 2FA son dos interruptores independientes:
el correo está activado y 2FA desactivado por defecto; la cuenta nueva usa
siempre credenciales temporales, no enlaces de aceptación. La recuperación genérica y la gestión general de
sesiones permanecen deshabilitadas; reset 2FA sí revoca sesiones.
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
Procesos, Auditorías, Riesgos, Revisión por Dirección, Documentos y SACP tienen las
capacidades parciales de [módulos y flujos](docs/arquitectura/modulos-y-flujos.md):
no atribuirles gestión documental/versionado, mitigación, eficacia o acuerdos completos
por encontrar una tabla o modal. Reportería ofrece filtros/vistas/impresión; no
confundirla con el informe Word/PDF editable de Quejas ni asumir guardado/envío de
informes configurables. No asignar porcentajes por cantidad de archivos o pruebas.

## Contrato de Usuarios — base visual histórica (15 noviembre); acceso vigente arriba

**Fuente:** `components/usuarios/UsuarioFormModal.tsx` y `app/usuarios/page.tsx` en
`main`. El HTML externo aporta distribución y jerarquía, nunca funcionalidades
simuladas ni colores distintos a `docs/visual-patterns.md`. La implementación
en repositorio no implica que se hayan ejecutado las pruebas ni que esté publicada.

- **Mismo tamaño y distinto contenido:** alta y gestión usan `Modal` document
  `size="mail" height="fill"`, ancho máximo 896 px. Cabecera y pie fijos;
  el contenido tiene **un único scroll**; responsive, legibilidad y foco accesibles.
- **Alta:** una vista con perfil y acceso temporal; un solo `POST` con
  `invite:false`, `sendByEmail` booleano y `requireMfa` opcional. El servidor
  genera la contraseña. **Si se solicitó correo, no retornarla al modal**;
  si se desactivó, entregarla una sola vez al admin y descartarla al cerrar.
  Tras crear, bloquear la repetición del alta y mostrar el estado del correo;
  un fallo de refresco no debe crear otra cuenta.
- **Gestión:** «Detalles del perfil» y «Seguridad y acceso». Preservar el
  `FormData` de nombre/correo/rol/estado sin desmontarlo entre tabs; la propia
  cuenta no puede modificar rol/estado ni eliminarse. Zona de peligro con
  confirmación de eliminación dentro del mismo diálogo.
- **Contraseñas integradas:** Seguridad tiene seleccionado por defecto
  «Generar contraseña segura». Panel expandible **en el mismo modal** con
  regeneración, visibilidad, copia, cancelar y «Guardar contraseña».
  «Definir contraseña manual» también es operativo con mínimo 8 caracteres.
  Ambos hacen `PATCH /api/usuarios` con `{ id, newPassword }` usando el
  servicio existente y bloqueos anti-doble escritura. No cambiar contraseña
  al hacer clic en el método: solo al pulsar Guardar. Si PATCH ya se completó,
  no repetirlo porque falle invalidación de lista; conservar el estado de éxito.
  «Restablecer contraseña» del menú abre `Gestionar usuario` en la pestaña
  Seguridad; nunca montar otro modal de reseteo sobre él.
- **Acceso de nuevas altas:** correo con usuario y clave temporal de 72h, login,
  cambio obligatorio y 2FA si se seleccionó. Web/DB/Edge integrados; la
  publicación del Apps Script y la recepción real se verifican por separado.
  El enlace de invitación queda para cuentas heredadas. Sin recuperación pública
  genérica ni gestor universal de sesiones.
- **Permisos y verificaciones:** backend Bearer/rol/admin, RLS y operaciones
  autorizadas siguen siendo fuente de verdad; no reemplazarlos por UI.
  Validar con `tests/usuarios-accesos-layout.test.mjs`,
  `tests/usuarios-page-reliability.test.mjs`,
  `tests/usuarios-reliability.test.mjs`,
  `tests/usuarios-table-layout.test.mjs` y
  `tests/usuarios-acciones-menu.test.mjs`, más TS/lint/build y navegador
  autenticado, antes de afirmar entrega. No crear usuarios reales para QA.
- **Mis Quejas (ajuste del 15-11):** pulsar «Editar» sobre el borrador guardado
  reabre el mismo Tiptap con `resolutionOverlay=null` y altura normal
  `clamp(360px,calc(100dvh-110px),700px)`. La expansión vertical solo ocurre si se pulsa
  explícitamente Expandir. El workspace debe continuar ampliándose al elegir
  «Redactar/Corregir» desde el triaje compacto, porque el documento completo
  no se edita en esa vista, pero esto NO amplía automáticamente el editor vertical.

**Niveles de evidencia:** diseño de referencia, código integrado, pruebas
realmente ejecutadas y producción con SHA verificado son categorías distintas.
El corte previo de Vercel permanece histórico. Consultar CI/despliegue actual
antes de afirmar que una modificación de `main` está disponible en producción.

## Verificar, entregar y mantener

### Acceso inicial — historial del 17 noviembre (supeditado a la revisión del 21)

**Borrado de Usuarios (corrección aplicada en DB, cliente/API local):** nunca borrar
físicamente `usuarios` ni sus referencias de expedientes después de eliminar Auth.
Usar `usuarioDeletion.ts` y el intento durable `qms_delete_user_account`: suspender,
eliminar/confirmar ausencia de Auth por ID, finalizar con `eliminado_en` y retiro
del directorio. Conservar nombre/ID histórico; liberar email con dirección interna.
No llamar `deleteUser(null)`, no borrar relaciones ni recrear Auth como compensación.
GET/PATCH excluyen retirados; inactivos normales siguen administrables. RPC cerrado
a clientes, cuenta propia prohibida y último admin protegido. La migración
20261117212024 está aplicada; esta corrección no activa invitaciones/MFA.
[Contrato y evidencia](docs/usuarios-eliminacion-2026-11-17.md).

Consultar [usuarios-acceso-inicial-mfa-2026-11-17.md](docs/usuarios-acceso-inicial-mfa-2026-11-17.md).
Invitación legacy: enlace personal de 24h y un uso; error de envío conserva Auth
 y perfil, y el reenvío invalida el enlace anterior. Para altas nuevas se genera
 una contraseña temporal en el servidor; va al correo cuando está marcado
 o se muestra una sola vez al admin cuando se desactiva el envío. En ambos
 casos el primer ingreso obliga a cambiarla. Ninguna migración masiva de cuentas.

App autenticadora usa TOTP nativo y AAL2 real. Correo alternativo usa verificación
propia autorizada por el usuario: **no elevar ni presentar su JWT como AAL2**.
Ambos requieren prueba propia por sesión/generación (12h); TOTP exige además AAL2.
OTP: diez minutos, HMAC privado, cinco errores → diez minutos de bloqueo en DB.
API/guard, RLS restrictiva y pre-request cubren acceso incompleto; nunca autorizar
con estado local, user_metadata o claims enviados en el body. Nuevas tablas
protegidas deben incorporar `qms_access_allowed()` además de su autorización propia.

Reset 2FA de otra persona requiere admin activo y confirmación; revoca sesiones
y pruebas antes de borrar factores, conserva obligatoriedad y queda protegido si
falla parcialmente. El emisor de acceso es independiente del outbox de Quejas.
Antecedente del 17 noviembre: migración `20261117214855` y flujo de
invitaciones de 24h con canje comprobado en esa fecha. Desde el 21 noviembre
se añadió `20261121190202` para contraseñas temporales de 72h y se publicó
la web de alta con correo/2FA opcional. `/acceso` mantiene canje para
invitaciones pendientes; preservar fragmento en memoria sin redirigir al
usuario previamente conectado. La versión de Google Apps Script se publica
por separado de GitHub y Vercel; no inferir versión activa de su historial.

Pruebas de referencia: `tests/usuarios-acceso-seguro.test.mjs`,
`tests/usuarios-acceso-mail.test.mjs`, `tests/usuarios-acceso-link.test.mjs`,
`tests/auth-visibility.test.mjs`, suites de
Usuarios y `scripts/test-usuarios-acceso-db.mjs`. QA sintética no demuestra
recepción de correo ni autenticación real de producción.

Tablas de Quejas/Mis Quejas: la especificación del 16 noviembre conserva la
altura original de cada fila, colores y densidad. El seguimiento por etapas y
sus pruebas está en [tablas y bandeja](docs/quejas-bandeja-etapas-2026-11-16.md).
Las fechas de ingreso se presentan con `formatFechaIngreso` en DD/MM/AAAA y
zona Costa Rica; no modificar el instante almacenado por un cambio visual.

Ejecutar comprobaciones acordes al cambio, sin instalar prototipos ni regenerar
fixtures para esconder fallos. QA con datos ficticios y sin secretos; no crear
expedientes, enviar correos ni cambiar roles reales solo para una prueba sin que
esa acción esté autorizada por la tarea.

~~~sh
npx tsc --noEmit
npm run lint
node --test tests/<suite-del-cambio>.test.mjs
npm run build
npm run check:structure
npm run check:visual
~~~

Evidencia reciente, con alcances distintos y selecciones parcialmente solapadas:

| Área | Evidencia conservada | Referencia |
| --- | --- | --- |
| Panel/colores/plazos | 65/65 Node, 379 comprobaciones en 36 escenarios, dos módulos, seis estados, 1536/390/320px; TypeScript, lint, build, estructura y visual correctos | [Panel](docs/quejas-panel-2026-10-13.md) |
| PDF de vista inicial | 118/118 focalizadas, PDF original reintentado con éxito y checksum de un único adjunto confirmado | [Formulario/correo](docs/quejas-formulario-correo-inmediato-2026-11-10.md) |
| Correo por evento | 83/83 selección de correo, 39/39 emisor, 159 PostgreSQL aisladas; activación HMAC/Drive y ACK final con Word documentados | [Activación](supabase/backups/quejas_urgent_mail_activation_20261110.json) |

No sumar esas cifras como suite global nueva. Las verificaciones completas antiguas,
fallos previos de informe/paginación y auditorías conservan su fecha y alcance en
[verificación y pendientes](docs/arquitectura/verificacion-y-pendientes.md). No hay
benchmark autenticado con miles de filas ni garantía universal de servicios externos.

- **Web (verificada el 21 noviembre de 2026):** rama productiva `main`, dominio
  `mi-dashboard-iota.vercel.app`, estado `READY`, commit
  `e235dfeac9472d36d0a634b6a2e1ef5a42e0e931` según consulta de
  Vercel en ese corte. Incluye acceso temporal de 72h, 2FA opcional y diseño
  público actualizado. No equivale a prueba de entrega de Google Apps Script.
- **Web (verificada el 14 noviembre de 2026; corte histórico):** `mi-dashboard` en Vercel,
  rama productiva `main`, dominio `mi-dashboard-iota.vercel.app`, despliegue
  `dpl_ADVuq52xdGjNfMhAfYqLiuexgQU5`, estado `READY`, commit
  `21e84eda3d717926c17a3d22f697753ce4b3e48c` (PR #27).
  Incluye scroll único de Respuesta al cliente/No procede, precarga visual estable,
  lectura anticipada de borrador/informe y apertura sin esperar PDF. La compilación
  confirma que el código se construye, no una prueba E2E de permisos, tiempos,
  Drive o envío real. Volver a consultar alias, SHA y estado de Vercel ante
  cualquier entrega posterior; el valor aquí es un corte histórico. Publicar
  solo con autorización expresa y sin cambios destructivos de DB.
- **Backend:** DB/Edge/Apps Script del correo por evento activos según evidencia
  fechada del 10 noviembre; su activación es independiente del deploy web verificado
  el 14 noviembre y no equivale a una auditoría remota recién ejecutada.
  No reabrir accesos legacy o restaurar clientes incompatibles.
- **Pendientes:** aceptación institucional del ciclo completo con roles/destinatarios,
  feriados confirmados, oficios/adjuntos y manejo de fallos; UI de conciliación de envíos
  o subidas inciertos; contraste de las barras internas de Google Drive.
- **Límites de seguridad:** alta y 2FA opcional integradas en web/DB, aceptación real del correo y primer login pendiente; sin antivirus, portal ciudadano completo,
  telemetría persistida/retención anual ni Seguridad y Estado terminados. La auditoría
  npm documentada tras fijar Next 16.4.6 registró cero críticas/altas y seis moderadas
  indirectas pendientes; no presentarla como una auditoría nueva ni seguridad total.

Para Quejas/Mis Quejas consultar también el
[checklist con alcance real y pruebas pendientes](docs/quejas-checklist-aceptacion-2026-11-13.md).
No atribuir pruebas E2E a inspección estática, SQL de metadatos ni compilación
Vercel. La existencia de archivos Node no demuestra que fueron ejecutados.

Actualizar la referencia temática y el mapa cuando cambien puntos de edición.
Conservar esta entrada como contrato actual: la cronología vive en `docs/` y no debe
restaurar decisiones visuales o flujos ya reemplazados por el propietario.
