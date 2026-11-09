<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ECA-QMS — guía de entrada

Revisión: **20 de octubre de 2026**. Esta entrada contiene reglas siempre aplicables.
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
| Colores de badges/estados | lib/constants/badges.ts y estados.ts |
| Marca institucional (logo del menú) | lib/constants/marca.ts (bucket, clave y límites); components/EmpresaLogo.tsx, lib/queries/useLogoEmpresa.ts y app/configuracion/components/LogoEmpresaEditor.tsx |
| Colores y tipografía | app/styles/theme.css (@theme) |
| Recetas y utilidades visuales | app/styles/components.css y app/globals.css |
| Controles, modales y cargas | components/ui/ y components/Modal.tsx |
| Páginas y editores | app/<modulo>/page.tsx y sus components/ |
| Lecturas/claves/TTL/paginación | lib/queries/, queryKeys.ts, cacheConfig.ts, pagination.ts |
| Calendario laboral y feriados QMS | app/configuracion/components/CalendarioSettings.tsx; lib/queries/useQmsCalendar.ts; lib/services/qmsCalendarService.ts; lib/utils/qmsCalendar.ts |
| Workflow/mutaciones | lib/services/; guards privilegiados en lib/server/ |
| Lectura de justificación/análisis de Quejas | lib/utils/quejaContent.ts y lib/utils/richText.ts |
| Formulario ciudadano y borrador/reintentos | app/q/[token]/page.tsx y app/q/components/usePublicQuejaForm.ts |
| Validación ciudadana idéntica en cliente/API | lib/utils/publicQuejaValidation.ts; códigos de campo cerrados, sin diagnósticos remotos |
| Seguimiento privado y publicación final | app/q/seguimiento/; lib/server/publicTracking.ts; app/quejas/components/QuejaPublicacionPanel.tsx |
| Correos de Quejas: mensaje / transporte / apariencia | supabase/functions/quejas-mail-queue/message.ts / index.ts; integration/apps-script/quejas-mail/Codigo.gs |
| DB aplicada y evidencia | supabase/migrations/ y supabase/backups/ |

Stack: Next 16.3.8, React 19.2.4, Supabase JS 2.111.0, TanStack Query 5 y Zustand 5.
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
- **Estado:** TanStack Query administra datos remotos a través de `lib/queries/`; `lib/store/` (Zustand) administra sesión y estado de interfaz. Los borradores de formularios permanecen locales.
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
- Motor QMS y auditoría están en DB; Quejas/Mis Quejas/Dashboard/informes consumen sus plazos. Tiptap usa formato plain/markdown explícito; prioridad de Quejas es histórica. DB encola correos y Apps Script consulta/manda/confirma mediante Edge HMAC de Supabase, sin Vercel. El activador existente de cinco minutos también procesa avisos internos QMS; no requiere pg_cron. Ver el contrato de avisos del 14 octubre.
- No están integrados Seguridad y Estado, MFA/2FA, telemetría persistida/retención anual, fondo personalizado ni selector completo de tema. Formularios públicos: gateway/BotID Basic publicado, variables cifradas y cortes legacy aplicados; Storage histórico restringido por expediente/perfil activo. Ver estado y límites en [su guía](docs/seguridad-formularios-publicos.md).
- Logout inmediato de UI no revoca universalmente todos los JWT emitidos. APIs privadas conservan rate limit por instancia; formulario público usa cuotas transaccionales PostgreSQL y tiene WAF Vercel publicado. No protegen el login Supabase externo.

Estado de entrega: producción del 19 octubre en dpl_2kk83rkgKrip1MwK8NNbMcw2d2MF, dominio mi-dashboard-iota.vercel.app. Conserva 20261009230746 (Storage RLS) y 20261009231000 (corte público/Drive); añade seguimiento y cierre de qms_transition interno legacy. Metadata anónima y escritura directa de adjuntos permanecen cerradas. El visor Drive conserva iframe inmediato sin skeleton. No reabrir accesos legacy ni restaurar un cliente antiguo sin coordinar su contrato de DB.

Detalle público: [seguridad-formularios-publicos.md](docs/seguridad-formularios-publicos.md). Mantener cerrado el acceso público legacy; cualquier corte de workflow interno exige verificar primero su cliente compatible publicado.

Detalle: [base de datos](docs/arquitectura/base-de-datos.md) e
[integraciones](docs/arquitectura/integraciones.md). No ejecutar dumps, seeds o SQL legacy como migración.

## Verificar y mantener

Ejecutar las comprobaciones pertinentes al cambio, sin instalar dependencias de prototipos ni regenerar fixtures para esconder fallos:

~~~sh
npx tsc --noEmit
npm run lint
node --test tests/<suite-del-cambio>.test.mjs
npm run build
npm run check:structure
npm run check:visual
~~~

Verificación del 5 de noviembre: Node 831/831, TypeScript, lint, build, estructura y
capa visual correctos; el expediente ampliado con solicitud en lateral y avance en la
línea superior con línea de progreso azul verificado con el contrato nuevo del panel.
La corrección del scroll ampliado sigue local, sin publicar. Conserva la verificación del
2 de noviembre: Node 798/798 (19/19 de contratos visuales con la
promoción del scrollport, fondo opaco y velo del backdrop, y la exclusión de
`::-webkit-scrollbar` en el lienzo); TypeScript, lint, build, estructura y
capa visual correctos; el CSS compilado emite `will-change:transform`, la barra
nativa del expediente y las reglas globales con `:not([data-case-scroll])`. La
corrección
del scroll ampliado sigue local, sin publicar. Conserva la verificación del 20 octubre:
Node 795/795, selección pública 107/107,
PostgreSQL aislado de correo 137/137 y bundle Edge 41 checks; lint, build,
estructura y capa visual correctos. La política de dos correos se aplicó en DB
con 20261020163142; el arreglo web de reintentos permanece local, sin publicar.
Detalle: [dos correos y reintentos](docs/quejas-dos-correos-y-reintentos-2026-10-20.md).
La verificación local del 19 octubre conserva Node 731/731 tras el refinamiento de lienzo
(104/104 focalizadas y build correctos). La activación previa conserva 725/725 y selección de seguimiento/correo
162/162, PostgreSQL aislado 208/208 y bundle Edge 50 checks; TypeScript, lint,
build, estructura y capa visual correctos (96 archivos React). Candidato 5/5 y
producción 6/6 comprobaciones HTTP sin escrituras de negocio. Recibo público conserva
QA 142/142 y audio 16/16 en navegador sintético; no certifican cada dispositivo/buzón.
El 16 octubre conserva logo institucional, PostgreSQL aislado de seguimiento/publicación
208/208 y HTML de correo 201/201. QA anterior: seguimiento/formulario 74/74 y gestión/seguimiento
98/98; esa evidencia visual conserva su fecha/alcance, no certifica producción.
La evidencia del calendario del 15 octubre conserva 112/112 en DB y 43/43 de QA.
La evidencia de cada entrega se conserva
en su referencia fechada. El 14 octubre: QA de sonido 13 comprobaciones en dos
pestañas con datos ficticios, correo 78/78 y DB de avisos 76/76. Las auditorías previas
de DB/seguridad y sus fixtures/ROLLBACK conservan fecha y alcance en docs/.
No existe benchmark autenticado con miles de filas ni garantía universal de servicios externos.
Compilar no publica Vercel. No publicar estos cambios web sin autorización explícita;
una petición de documentación o continuidad no la sustituye. Verificar el despliegue
solicitado antes de afirmar que los cambios están en producción.

Actualizar el documento del tema cambiado y el mapa si cambian puntos de edición.
Mantener esta entrada breve; la evidencia fechada no sustituye contratos vivos.
Consulta [verificación y pendientes](docs/arquitectura/verificacion-y-pendientes.md).

## Quejas y Mis Quejas: estado vigente

Flujo del 4 noviembre: revisión GC separada de respuesta al cliente. Aprobar sin oficio
pasa a Resuelto; borrador remoto versionado, publicación confirmada atómica a Finalizado.
Devolver exige motivo y conserva propuesta/plazo. Históricos de lectura, No Procede
compatible. Cliente local; activación/QA en [su contrato](docs/quejas-revision-y-respuesta-2026-11-04.md).
Refinamiento posterior: Devolver/Aprobar directamente en el expediente, sin modal
duplicado; estado/plazo arriba. Respuesta usa la hoja del informe y selector Word/PDF,
con correo de plantilla. Adjuntos físicos y permiso Drive de lectura en el mismo contrato.

Ajuste local del 5 de noviembre (corrección): el modal de gestión de Quejas muestra el
avance del proceso en la línea horizontal superior con mini línea y los datos de la
solicitud en el lateral izquierdo de forma estable; la disposición ya no depende del modo
expandido. La variante lateral con desplegable corresponde al panel del responsable
(Mis Quejas). El catálogo de áreas sale del expediente ampliado y se administra desde
Configuración. Detalle en
[panel y procesamiento](docs/quejas-panel-2026-10-13.md). Local, sin publicar.

Ajuste local del 3 noviembre: expediente empieza con Descripción, sin resumen
superior de resultado; margen inferior y marco redondeado del lienzo solo sin ampliar
y dos pestañas en Mis Quejas
(Análisis/Resolución). Barra principal nativa de ancho normal; interiores de 16px
con puntas cuadradas. Audio recupera contexto con interacción previa. Despertador
de correo por evento preparado, **sin activar ni publicar**; configuración y
evidencia fechada en [su contrato](docs/quejas-claridad-y-acuse-2026-11-03.md).
Excepción de lectura posterior: revisión GC comienza con la propuesta y pliega
antecedentes; Resolución de Mis Quejas compacta el editor bajo las pestañas. Ambas
usan ciclo horizontal en ese contexto. Ver [composición y evidencia](docs/quejas-resolucion-y-revision-gc-2026-11-03.md).

Alcance: módulo de Quejas, recepción y gestión interna; no toda la matriz de Calidad ni un portal
ciudadano completo. La implementación local y la versión web publicada son estados
distintos. DB aplicó 20261011044303/20261011044317/20261011044810; la evidencia está en
[lanzamiento y pendientes](docs/quejas-lanzamiento-2026-10-09.md).

- Alta pública/interna, nombre/correo/descripción obligatorios, tipos compartidos,
  fecha automática y consecutivo anual transaccional. Conservar folios y contadores
  históricos; no reiniciar la serie para aparentar 001 ni consumir folios sin alta.
- Procedencia con justificación/responsable; investigación, revisión GC, resolución,
  cierre y reapertura con motivo. Nuevas etapas de 3/15 días hábiles; revisión/devolución
  GC no reinicia investigación. UI e informes leen el snapshot persistido del plazo.
- Área afectada junto a Descripción: una lista directa; elegir guarda con la revisión
  capturada, sin segundo selector. Catálogo administrado en Configuración (módulo `quejas`,
  tipo `area_afectada`); el expediente conserva solo el control de asignación junto a
  Descripción. Añadir no asigna ni reemplaza la selección; el catálogo es un desplegable
  compacto con tres puntos por fila. Admin real puede Editar, Eliminar (desactivar con
  confirmación) y Restaurar mediante quejaAreaCatalogService con comparación del snapshot,
  sin borrar históricos. Oficio emitido por ECA, único, obligatorio al declarar No Procede o
  resolver; se adjunta su documento en Drive. Prioridad histórica fuera de la UX de Quejas,
  sin borrar datos de otros módulos.
- Observaciones centraliza notas/comentarios de Actividad; conserva la observación
  histórica sin inventar autor/fecha. Las notas de investigación son otro contrato.
- Workspace derecho 40vw/100dvh, tabla operativa con scroll en ambos ejes sin recomponer
  filtros/columnas. Móvil/ampliado modal; cerrar restablece lateral. Ciclo con checks,
  estado/acción sticky, sin footer de lectura. Actividad independiente y adjuntos con
  tarjetas/iconos estáticos, sin descargar miniaturas al listar.
- Scroll del expediente (2 noviembre): el scrollport de CaseWorkspace se promueve a
  capa compuesta (`will-change: transform`) y queda excluido de las reglas globales
  `::-webkit-scrollbar`; usa la barra nativa `solid-color` (`scrollbar-width: thin`
  y `scrollbar-color`) que Chromium actualiza en el compositor. La personalizada se
  repinta en el hilo principal y retrasaba el desplazamiento al ampliar a todo el
  ancho; los laterales sticky llevan capa propia para que su offset no dependa del
  hilo principal. Quejas y Mis Quejas conservan una sola barra, laterales sticky y
  borradores; no cambian permisos, DB ni workflow. El pulgar del expediente pierde el
  resaltado al pasar el puntero, que la barra nativa no expone. Al ampliar a pantalla
  completa el diálogo no compone un velo (`backdrop:bg-transparent`) sobre un fondo
  opaco, y el scrollport del expediente lleva fondo opaco para que la capa compuesta no
  obligue a mezclar el ancho completo en cada frame. Corrección local verificada; no
  publicada.
- Espacio inferior en el documento (4 de noviembre): el sheet del documento añade `pb-6`
  al final de la descripción/evidencias para que el texto no quede pegado al borde
  inferior del modal al terminar el contenido. Ver
  [scroll ampliado](docs/quejas-panel-2026-10-13.md).
- Editor del expediente (4 de noviembre): el lienzo con `layout="fill"` del
  `RichTextEditor` pasa a `overscroll-contain` y capa compuesta (`will-change:
  transform`) en su scroll, igualando el patrón del scrollport del expediente; el
  lienzo del informe con `layout="content"` (`data-informe-scroll`) incorpora la misma
  promoción. Ver [scroll ampliado](docs/quejas-panel-2026-10-13.md).
- Encabezado del expediente (4 de noviembre): el resumen `data-case-summary` se vuelve
  `sticky top-0 z-10` dentro del contenedor de scroll del modal, con su propio fondo, para
  que los datos de la solicitud queden fijos al deslizar el documento. No se reorganiza el
  orden; solo se pega arriba al hacer scroll. Ver [scroll ampliado](docs/quejas-panel-2026-10-13.md).
- Flujo export/Respuesta (4 de noviembre): la respuesta al cliente se alimenta del documento
  interno que se publica (No Procede: justificación; resolución: resolución) sin exigir texto
  paralelo. Ver [scroll ampliado](docs/quejas-panel-2026-10-13.md).
- Editor informe (4 de noviembre): los botones Guardar Cambios / Exportar a Word / Exportar
  a PDF se pasan al `headerActions` del Modal y la fila de estado de contenido se quita,
  subiendo el editor. Ver [scroll ampliado](docs/quejas-panel-2026-10-13.md).
- Refinamiento visual local del 19 octubre: Quejas/Mis Quejas comparten CaseWorkspace
  y una única hoja central; CaseRequestHeader conserva el mini desplegable de datos
  bajo el folio, fuera del documento, sin agrandar la cabecera del lateral. El área
  acompaña Descripción. Encabezado Folio semibold, iconos de 20 px y Actividad con texto azul, sin fondo, solo en workspace. El ciclo se proyecta por tarea:
  Calidad ve evaluación/revisión/cierre; responsable, asignación/investigación/propuesta
  enviada. No son nuevos estados ni un historial de aprobaciones. Este ajuste visual
  posterior a la activación sigue sin publicar; no altera permisos ni revisiones.
- Decisión document XL/90dvh estable, encabezado blanco, elección inicial centrada
  azul/roja que cede el lienzo al editor; decisión gris y responsable buscable arriba.
  Guardar Procede exige asignación antes de escribir. Cancelar vuelve a elegir conservando
  el borrador; la X cierra. Mantener locks/revisión también al devolver a investigación.
- Tiptap lazy y límite 10.000, formatos plain/markdown explícitos. El lector compartido
  quejaContent oculta únicamente la copia plain exacta `[Procede]` de la justificación
  separada; conserva análisis distintos/reaperturas, sin modificar DB ni inferir formato.

Detalle de interacción: [panel y procesamiento](docs/quejas-panel-2026-10-13.md).

Entrega del 16 octubre, publicada el 19: Mis Quejas comparte workspace/ciclo/plazos con Quejas,
con Tiptap amplio e IA secundaria. El análisis es borrador de visita; notas y propuesta
enviada a GC sí persisten. Calidad redacta la respuesta pública separada del documento
interno y selecciona el oficio. Seguimiento por capacidad privada, nunca por folio solo;
sin PII ni evidencia interna y sin caché. Configuración obtiene enlaces por formulario
solo con admin real. Web/Edge/Apps Script/migración y cortes activos el 19 octubre.
Seguimiento abre automáticamente por enlace, sin contraseña/consecutivo manual.
Mientras esté desactivado no ofrece una consulta rota. Finalizar devuelve estado
disabled/available/pending; recuperar enlace pendiente no repite alta ni adjuntos.
El propietario mantuvo todo local el 16 octubre y autorizó activar enlaces en nuevos
correos el 19. El corte coordinado está verificado; no hubo backfill ni reenvío histórico.
En la activación del 19, eventos recibido/investigación con snapshot constaron sent; falta aceptar entrega
y apertura del enlace por su destinatario. Evidencia: supabase/backups/public_tracking_activation_20261019.json.
El enlace de seguimiento autoriza al portador, no verifica identidad ni control del
correo: no prometer acceso exclusivo al titular. Caducidad: DB fija 30 días
naturales desde el primer No Procede/Finalizado;
Resuelto no inicia la cuenta. Firma v2/snapshot de correo solo expediente/nonce;
consulta/descarga/emisión comprueban DB. No renovar por consultar o reabrir ni borrar
expediente/evidencias al vencer. Consulta/descarga verifican BotID Basic antes del
backend; WAF amplía la regla existente a sus dos POST, 90 peticiones/IP por 600 s.
Contratos, límites y orden: [seguimiento y publicación](docs/quejas-seguimiento-y-publicacion-2026-10-16.md).

### Formulario público y correo

- Formulario de 896 px máximos, campos iniciales en dos columnas desde sm; móvil en
  una columna. Encabezado compacto y descripción ampliable de cinco filas. Adjuntar
  y contador en una fila, lista solo al seleccionar y hasta dos filas con scroll. Tarjeta hasta 100dvh − 48 px; en
  pantallas bajas se desplazan solo los campos, pie de envío separado sin superposición.
- Registro/subida/finalización y errores permanecen en el mismo formulario. Reintentos
  conservan submissionId/uploadId; no generan otra queja. Confirmación con folio solo
  cuando finalizan todos los adjuntos y la operación. Sin pausas ni ventanas de subida.
  La presentación refinada y el recibo compacto quedaron publicados el 19 octubre.
- Recibo local del 20 octubre: cabecera de marca y una columna como el correo,
  folio en línea sin recuadro interior. Conserva éxito/adjuntos/seguimiento;
  43/43 pruebas del cliente y QA sintética en tres anchos. Sigue sin publicar.
- Corrección web del 20 octubre: reintentos del formulario público verificados en local;
  no está publicada y no sustituye la versión web del 19. Ver su referencia de entrega.
- Correo directo: DB encola → Apps Script consulta/envía → ACK por
  `quejas-mail-queue` de Supabase. Desde el 20 octubre, dos eventos ciudadanos:
  recibido y final (No Procede o resolución de Calidad). Investigación es histórica;
  los avisos internos siguen intactos. Reapertura/Finalizado no duplican.
  No depende de Vercel; credenciales DB solo en Edge, HMAC independiente en el script.
- Estado operativo en queja_mail_outbox; diario privado mínimo del emisor para deduplicar
  e incertidumbre, sin destinatarios/contenido. Un trigger cada cinco minutos; `/exec`
  anterior archivado y worker Vercel local apagado. `sent` no significa leído; no reintentar
  incertidumbre a ciegas. Cuotas de MailApp compartidas, no correo ilimitado.
- HTML qmsMailHtml_ de 760 px máximos, adaptable/compacto, sin recursos remotos. Guardado
  y verificado en el Apps Script activo, actualizado el 19 octubre; los correos anteriores no cambian.
  Editar apariencia no requiere ejecutar el poll ni reinstalar el activador.
  Refinamiento del 19: recibo compacto y HTML con encabezado blanco publicados;
  el botón de seguimiento aparece solo con URL validada. La pantalla confirma
  registro/adjuntos; aclara la posible espera del correo y no afirma entrega.
- Avisos internos activos desde el 14 octubre: recepción a Calidad, evaluación a 1 día,
  asignación al responsable, investigación a 5 días a Calidad y a 3 días a ambos,
  vencimiento a ambos cuando corresponda. Usuarios activos con rol real `calidad`;
  admin no sustituye ese rol para correo. Fecha de corte sin avisos históricos,
  calendario persistido, deduplicación y pertinencia comprobada antes de enviar.
  Claim v2 con límite 0 procesa campanas aunque falte cuota/diario; no reserva correo.
  Nunca reiniciar 15 días al reasignar ni reintentar incertidumbre automáticamente.
- Sonido publicado el 19 octubre: primera lectura silenciosa; IDs nuevos y reclamo IndexedDB atómico
  entre pestañas, con comprobación de sesión/preferencias antes de reproducir.
  Panel abierto también avisa en segundo plano. Preparar MP3/contexto habilitado por
  gesto antes de reclamar evita que autoplay bloqueado consuma el aviso de otra pestaña;
  descarga fallida se puede recuperar. Si falla el almacenamiento se omite el audio
  automático. Requiere permiso del navegador y gesto previo permitido para el audio.
- Calendario laboral: editor admin publicado en Configuración, días ISO y feriados
  confirmados, motivo y versión capturada. Publica con qms_publish_calendar, no
  sla_config. Conflictos conservan borrador; no cambiar expected al refrescar.
  Afecta etapas que comiencen después de guardar, nunca etapas abiertas. DB aplicó
  20261015171835: calendarios/reglas/auditoría sin writes/TRUNCATE cliente; SELECT/RLS
  y RPC conservados. No inventar feriados ni exponer cambios genéricos de reglas 3/15.

Referencias: [formulario visual](docs/formulario-publico-visual-2026-10-14.md),
[seguridad pública](docs/seguridad-formularios-publicos.md),
[correo operativo](docs/correo-quejas-directo-2026-10-13.md) y
[protocolo de correo](docs/seguridad-correos-quejas.md).
Avisos/destinatarios: [contrato operativo](docs/avisos-internos-quejas-2026-10-14.md).
Audio: [coordinación y límites](docs/notificaciones-audio-2026-10-14.md).
Calendario: [editor y permisos](docs/calendario-qms-2026-10-15.md).

### Lo que falta para cerrar la versión operativa de Quejas

1. Aceptar la recepción de un correo nuevo con «Consultar mi trámite» y apertura del
   enlace por su destinatario. Web/DB/Edge/Apps Script, WAF y ambos cortes ya están
   activos; las comprobaciones HTTP sin capacidad real no sustituyen esa aceptación.
2. Registrar los feriados institucionales confirmados en el editor de calendario
   QMS publicado. DB conserva lunes–viernes, sin feriados.
   El editor SLA legacy sigue separado de las reglas/calendarios versionados.
3. Asignar los destinatarios institucionales de Calidad: la activación encontró cero
   perfiles activos de ese rol. Validar recepción institucional de los avisos con sus
   destinatarios reales; no cambiar roles ni generar quejas/correos de prueba sin autorización.
4. Aceptación institucional del ciclo completo (roles, oficios, plazos, evidencias,
   correos/fallos/reintentos). Sigue sin UI de conciliación de envíos/subidas inciertos.

No presentar Seguridad y Estado, MFA, antivirus o un portal ciudadano completo como
capacidades terminadas de esta versión. Al comunicar avance al propietario, usar
«módulo de Quejas» o «versión operativa», con alcance y pendientes explícitos.
No asignar un porcentaje por archivos o pruebas:
el avance es una estimación de planificación, separada de la aceptación y el despliegue.
