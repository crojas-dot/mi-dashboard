<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ECA-QMS — guía de entrada

Revisión: **11 de noviembre de 2026**. Esta entrada contiene reglas siempre aplicables.
El detalle se consulta por tema en [el mapa de arquitectura](docs/arquitectura/README.md).
No cargar todos los documentos para una modificación aislada.

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
| Marca institucional (logo del menú) | lib/constants/marca.ts (bucket, clave y límites); components/EmpresaLogo.tsx, lib/queries/useLogoEmpresa.ts y app/configuracion/components/LogoEmpresaEditor.tsx |
| Colores y tipografía | app/styles/theme.css (@theme) |
| Recetas y utilidades visuales | app/styles/components.css y app/globals.css |
| Controles, modales y cargas | components/ui/ y components/Modal.tsx |
| Páginas y editores | app/<modulo>/page.tsx y sus components/ |
| Workspace y ciclo de Quejas/Mis Quejas | app/quejas/components/QuejaExpedientePanels.tsx y quejaExpedienteModel.ts; paneles de cada rol |
| Borrador guardado de resolución | lib/queries/useQuejaResolucionDraft.ts; guardarResolucionBorrador/enviarResolucionBorradorRevision en quejaWorkflowService.ts; [contrato](docs/mis-quejas-borrador-resolucion-2026-11-11.md) |
| Notas y evidencias de investigación | app/mis-quejas/components/QuejaNotasPanel.tsx; adjuntos bajo el lienzo y datos de la visita en QuejaColaboradorPanel.tsx |
| Área, adjuntos y visor compartidos | components/quejas/AreaAfectada.tsx, ListaAdjuntos.tsx y AdjuntoPreviewModal.tsx; AreaQuejaControl.tsx para edición |
| Plazo como semáforo | components/quejas/QuejaPlazoIndicator.tsx; lib/utils/quejaDeadline.ts y caseDeadline para el cálculo existente |
| Informe editable y Word/PDF | QuejaInformeModal.tsx; lib/queries/useQuejaInforme.ts; lib/services/quejaInformeService.ts; lib/utils/quejaInforme*.ts |
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
| Correos de Quejas: mensaje / transporte / apariencia | supabase/functions/quejas-mail-queue/message.ts / index.ts; integration/apps-script/quejas-mail/Codigo.gs |
| DB aplicada y evidencia | supabase/migrations/ y supabase/backups/ |

Stack local: Next 16.4.6, React 19.2.4, Supabase JS 2.111.0, TanStack Query 5 y Zustand 5.
Estado documentado al 10 noviembre: refinamientos web locales sin publicar; correo
por evento activo en DB/Edge v17/Apps Script v5, con autorización Google/Drive y
recibo HMAC/adjunto final verificados. No es una nueva auditoría remota. Contrato:
[formulario y correo](docs/quejas-formulario-correo-inmediato-2026-11-10.md).
El layout servidor solo monta metadata/font y AuthShell/ToastProvider. Las páginas
operativas son Client Components; negocio se lee por hooks/servicios. API, proxy.ts
y lib/server/* son servidor. createServiceClient es server-only; nunca importarlo en UI.
El mapa contiene rutas exactas y explica dónde modificar cada función.
Las carpetas app/, lib/, components/ y tests/ tienen una guía local breve; se aplica
solo al editar esa capa.
Para trabajo por módulo, registra sus capacidades terminadas y pendientes; no marques
un módulo como completo solo porque su página o tabla exista.

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

- Agenda: RPC invoker de Quejas/Auditorías, permisos y fechas CR, máximo 20 y un
  motivo prioritario por registro. Caché de cinco minutos por perfil, sin canal
  Realtime adicional ni hover. Los avisos existentes invalidan también Agenda.
  Header controla apertura/cierre; UI solo recibe datos/callbacks.
  /dashboard es alias protegido del panel en /. Asignación/devolución salen de
  eventos reales. SQL aplicado; cliente local sin publicar. [Contrato](docs/agenda-hoy-2026-11-11.md).
- Agenda compacta (máximo 320px) abre en calendario con semana D/L/M/X/J/V/S,
  flechas de mes anterior/siguiente, selección circular y puntos por fecha_limite
  real y prioridad. El RPC añade fecha_limite civil CR (null si no existe), caché
  de contrato v3, cinco minutos. «Ver agenda» muestra cinco tarjetas y «Volver al
  calendario» regresa. Si hay más de cinco, «Ver más» aparece dentro del scroll y
  despliega ahí los restantes recibidos, sin navegar a otro panel. Navegar meses no consulta
  otras agendas ni inventa eventos: puntos solo para los registros recibidos.
  Cada apertura restablece mes actual y selección. Migración 20261111175442 aplicada;
  UI local sin publicar. [Contrato](docs/agenda-hoy-2026-11-11.md).
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
- No están integrados Seguridad y Estado, MFA/2FA, telemetría persistida/retención anual, fondo personalizado ni selector completo de tema. Formularios públicos: gateway/BotID Basic publicado, variables cifradas y cortes legacy aplicados; Storage histórico restringido por expediente/perfil activo. Ver estado y límites en [su guía](docs/seguridad-formularios-publicos.md).
- Logout inmediato de UI no revoca universalmente todos los JWT emitidos. APIs privadas conservan rate limit por instancia; formulario público usa cuotas transaccionales PostgreSQL y tiene WAF Vercel publicado. No protegen el login Supabase externo.

Último despliegue web documentado: 19 de octubre en dpl_2kk83rkgKrip1MwK8NNbMcw2d2MF, dominio mi-dashboard-iota.vercel.app. Conserva 20261009230746 (Storage RLS) y 20261009231000 (corte público/Drive); añade seguimiento y cierre de qms_transition interno legacy. Metadata anónima y escritura directa de adjuntos permanecen cerradas. El visor Drive conserva iframe inmediato sin skeleton. No reabrir accesos legacy ni restaurar un cliente antiguo sin coordinar su contrato de DB.

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
- Procede requiere justificación y responsable. Investigación prepara la propuesta;
  enviarla a Revisión GC no publica ni notifica al cliente. Aprobar y continuar pasa
  a Resuelto; Calidad prepara después la comunicación final. Publicar respuesta
  congela el correo y documento elegidos y pasa atómicamente a Finalizado.
- Devolver a investigación exige motivo y conserva propuesta y plazo. Reabrir exige
  motivo. Las etapas nuevas usan 3/15 días hábiles; revisión, devolución o reasignación
  no reinician la investigación. Leer el snapshot QMS, nunca prioridad/SLA legacy
  para inventar vencimientos. Los históricos conservan su calendario y revisión.
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
- Observaciones agrupa comentarios de Actividad y conserva la observación histórica
  sin inventar autor/fecha. Notas de investigación y propuesta enviada sí persisten.
  Editar o eliminar una nota propia solo se permite En Investigación y compara el
  contenido esperado (CAS); el historial de devolución/aprobación/cierre y las notas
  ajenas no se reescriben. Migración 20261112054513 sin aplicar: sin ella la UI
  conserva el error visible, no una edición remota.
  Resolución ofrece Guardar junto a Asistencia: borrador remoto/versionado, sin cambiar
  estado, revisión de Queja, propuesta enviada ni avisar a GC/cliente. Las ediciones
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
  `AreaAfectada`, `ListaAdjuntos` y `QuejaPlazoIndicator` cuando el contrato coincida.
  Conservar las acciones/permisos particulares de Calidad y del responsable.
- Workspace lateral derecho de 40vw/100dvh; la tabla conserva columnas, filtros y
  scroll en ambos ejes. Móvil y ampliado usan diálogo nativo. Cerrar restablece el
  lateral. Ampliar/reducir conserva nodos, editor, visita y borradores.
- Contraído: etapa actual y segmentos horizontales arriba; acciones primero y luego
  documento dentro de un único marco desplazable. Sin desplegable de datos del
  cliente ni espacio reservado. El contacto se mantiene oculto/montado para no
  remontar el documento al ampliar.
- Ampliado: recorrido horizontal completo; desde 1100 px útiles, contacto a la
  izquierda, documento al centro y acciones a la derecha. Las etiquetas de los pasos
  se alinean con Descripción. Por debajo se apila sin desbordar el diálogo.
- Ciclo compartido de evaluación/investigación/revisión/cierre; el contraído no usa
  checks verticales. No Procede muestra únicamente evaluación y cierre. Es una
  proyección del estado, nunca otro historial ni aprobaciones/fechas inventadas.
- Descripción comienza el documento y usa todo el ancho disponible. Área afectada
  queda a la derecha en el mismo encabezado, adaptándose al espacio. Sin resumen
  superior de resultado ni líneas verticales decorativas. En revisión GC se prioriza
  la propuesta y se pliegan Solicitud y antecedentes.
- Responsable antes de las acciones de Calidad. Devolver/Aprobar se ofrecen en el
  expediente, sin modal duplicado de lectura. Fecha real de cierre bajo el estado;
  Calidad ve el estado/hora del correo final sin reenviarlo por consultar.
- Mis Quejas trabaja sin pestañas ni modal de escritura. Resolución es la primera
  tarjeta central, con ancho completo y lienzo `min(70dvh,720px)`, mínimo 420px;
  no hay secciones ni acciones debajo del editor. `CaseWorkspace documentStyle="cards"` conserva
  las columnas; la hoja de Quejas sigue siendo el valor predeterminado.
  Notas es una tarjeta compacta debajo del cliente (`requestFooter`): cantidad real,
  última fecha o Sin notas todavía; abre un diálogo centrado (`variant="dialog"`) para
  leer/agregar. Cada nota propia de esta investigación ofrece menú de tres puntos con
  Editar/Eliminar y confirmación en línea; Escape o pulsar fuera lo cierra. Las notas
  de devolución de Calidad conservan su historial sin acciones. En contraído la
  tarjeta sigue disponible y el contacto permanece oculto. El borrador de nota
  pertenece a la visita y no se pierde al cerrar ese panel.
  Adjuntar evidencia abre el selector nativo desde el botón Adjuntar del encabezado,
  a la izquierda de Guardar/Editar; cancelar el selector no cierra el expediente.
  Los adjuntos se listan dentro de la misma tarjeta, debajo del lienzo, tanto al
  editar como con el borrador guardado, con `ListaAdjuntos layout="cards"`; comparten
  la consulta y los permisos existentes, sin sheet ni contador adicional.
  Acción actual queda a la derecha. `QuejaInvestigacionResumen` muestra únicamente
  la devolución real de Calidad en amarillo cuando existe; sin ella no reserva espacio.
  No repetir ahí el contexto, Cliente, evaluación ni Procede. Ver caso completo queda en Acción actual, encima de
  Enviar a Revisión GC, con fondo rojo institucional `qms-brand-red`, hover blanco
  con texto/icono/borde rojos; investigación
  omite la descripción redundante de esa tarjeta.
  Ese único acceso abre `QuejaAnalisisPanel` en `Modal variant="document" size="xl"`,
  como procedencia: primero Observación de Calidad con Procede azul, después
  Descripción del cliente. Su pie Preparar resolución vuelve al editor.
  Enviar a Revisión GC permanece en Acción actual, también en espacios estrechos:
  un único control, mismo handler/revisión. Con el borrador guardado el encabezado
  cambia Guardar por Editar: el lienzo pasa a solo lectura y Editar devuelve al modo
  de escritura con Guardar. Asistencia es secundaria y comparte fila con Guardar solo
  al editar: azul con cambios; Guardado con check, neutral y deshabilitado tras
  confirmación remota. La fecha real está en el título de Editar; no inventar
  autoguardado. Adjuntos/actividad se consultan una sola vez y se comparten.
  Si la investigación tiene devolución previa (reenvío), el mismo control se llama
  «Reenviar revisión a GC»; el mensaje de devolución deja de mostrarse en ese contexto
  y el envío actual entrega la propuesta corregida. Un mensaje de devolución muy
  largo se resume en línea y abre modal «Ver más» para revisarlo completo.
- Análisis es un modal nativo centrado de hasta 1040px y 90dvh; no amplía el workspace
  al abrir. Conservar nodo/editor/borrador, cursor y revisión al consultar/cerrar.
  El scroll de Resolución depende del foco: texto o barra de formato enfocados
  contienen el desplazamiento, incluso al llegar al límite o estar vacío. Sin foco,
  la rueda desplaza el expediente y conserva el punto de lectura interno.
  Gutter estable; sin remontar el editor ni cambiar el borrador.
  Conflictos conservan la propuesta; cargas
  pendientes bloquean envío. El pie de lectura no permite editar casos de solo lectura.
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
- Scroll principal nativo de ancho normal (`scrollbar-width: auto`), color/gutter
  estable y capa compuesta `will-change: transform`; excluirlo de reglas globales
  `::-webkit-scrollbar`. Laterales sticky con capa propia y fondo opaco; ampliado sin
  velo sobre el fondo ya cubierto. Interiores de modal: 16px y puntas cuadradas.
- Visor Drive: iframe inmediato, sin blob previo ni skeleton; preconnect solo por
  intención. Los archivos Storage históricos conservan su ruta de vista/descarga.
  Las barras internas de Google pertenecen a otro origen y no se recolorean con CSS
  del padre. Su contraste persistente sigue pendiente; no afirmar que esté resuelto
  ni alterar los colores del documento con filtros para simular una solución.

Detalle y evidencia visual: [patrones](docs/visual-patterns.md),
[capa visual](docs/arquitectura/visual.md) y [panel](docs/quejas-panel-2026-10-13.md).

## Informe y correo de respuesta al cliente

- Generar expediente abre un informe Tiptap prellenado, editable y guardado en el
  expediente para retomarlo desde otra computadora. Incluye encabezado institucional,
  secciones del caso, Conclusión y Resolución y anexos como nombres de archivo.
  El informe admite 100.000 caracteres (`INFORME_MAX_LENGTH`, validado en editor/API).
  Exporta Word/PDF; guardar/exportar están en las acciones del encabezado.
- Diseño del informe: `lib/constants/informeDesign.ts` centraliza azul documental
  #2A61B0, negro #1A1718 y divisores #E6E5E5 de la guía de identidad. Word/editor usan
  Century Gothic en títulos y Arial en cuerpo; PDF conserva Helvetica integrada.
  Sin franjas de fondo en títulos; Word conserva un párrafo editable después de un
  título vacío para separar Conclusión de Anexos. No reescribir informes guardados.
- Respuesta al cliente no vuelve a montar el informe como cuerpo del correo. Arriba:
  oficio editable, selector del informe guardado o documento subido, Adjuntar,
  Visualizar y Editar informe. Volver del editor conserva asunto, mensaje y selección.
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
`quejaWorkflowService`, `quejaInforme*` y `quejaCorreo`. Contrato vigente en
[revisión/respuesta](docs/quejas-revision-y-respuesta-2026-11-04.md).

## Formulario público, evidencias y seguimiento

- Cliente/API comparten `publicQuejaValidation`: nombre 50, correo 254, teléfono 25,
  descripción 10.000. Nombre con letras/tildes y signos admitidos, sin números;
  teléfono con dígitos/signos, sin letras ni marcas invisibles. No reducir email a 25.
- Errores de campo mediante `setCustomValidity`/`reportValidity`: aviso nativo junto
  al campo, foco/scroll y mensaje accesible, que se limpia al corregir. Sin toast
  para campos ni ayudas permanentes debajo. Errores operativos quedan en el pie.
- Formulario de 896px máximos, dos columnas desde sm y una en móvil; descripción de
  seis filas ampliable. Alto disponible con scroll solo en campos y pie separado.
  Adjuntar/contador en una fila y lista acotada cuando hay archivos.
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
- Seguimiento muestra etapas/fechas y Actualizar estado; sin Copiar enlace ni botón
  de descarga del informe en esa vista. Retirar botones no revoca capacidades ni
  endpoints previos: su autorización y compatibilidad se conservan.
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
Organización/Acceso/Servicios y exige admin real. Usuarios administra cuentas por API
con guards; no asumir cierre transaccional distribuido del último admin.
Procesos, Auditorías, Riesgos, Revisión por Dirección, Documentos y SACP tienen las
capacidades parciales de [módulos y flujos](docs/arquitectura/modulos-y-flujos.md):
no atribuirles gestión documental/versionado, mitigación, eficacia o acuerdos completos
por encontrar una tabla o modal. Reportería ofrece filtros/vistas/impresión; no
confundirla con el informe Word/PDF editable de Quejas ni asumir guardado/envío de
informes configurables. No asignar porcentajes por cantidad de archivos o pruebas.

## Verificar, entregar y mantener

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

- **Web:** última publicación documentada del 19 octubre; los refinamientos web de
  noviembre siguen locales. Compilar o actualizar documentación no publica Vercel.
  No desplegar sin autorización explícita; verificar el despliegue antes de afirmar
  que una función local está en producción.
- **Backend:** DB/Edge/Apps Script del correo por evento activos según evidencia
  fechada del 10 noviembre; no confundirlos con la web pendiente ni con una auditoría
  remota recién ejecutada. No reabrir accesos legacy o restaurar clientes incompatibles.
- **Pendientes:** aceptación institucional del ciclo completo con roles/destinatarios,
  feriados confirmados, oficios/adjuntos y manejo de fallos; UI de conciliación de envíos
  o subidas inciertos; contraste de las barras internas de Google Drive.
- **Límites de seguridad:** sin MFA/2FA integrado, antivirus, portal ciudadano completo,
  telemetría persistida/retención anual ni Seguridad y Estado terminados. La auditoría
  npm documentada tras fijar Next 16.4.6 registró cero críticas/altas y seis moderadas
  indirectas pendientes; no presentarla como una auditoría nueva ni seguridad total.

Actualizar la referencia temática y el mapa cuando cambien puntos de edición.
Conservar esta entrada como contrato actual: la cronología vive en `docs/` y no debe
restaurar decisiones visuales o flujos ya reemplazados por el propietario.
