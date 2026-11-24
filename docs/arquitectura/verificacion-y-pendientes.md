# Verificación, despliegue y pendientes

## Corte vigente de entrega — 23 noviembre 2026

- Código funcional en `main`: PR #64 (`80a902e1`, diseño de expedientes) y
  PR #65 (`d9c2be898e0e237cde23e7bbbf21e140079b5ae3`, formulario, seguimiento,
  terminología, correos y correcciones de lint). Las variantes descartadas
  de panel oscuro/lila, pie fijo de decisiones y herramientas plegadas NO
  forman parte del diseño aprobado.
- Vercel: el alias productivo `mi-dashboard-iota.vercel.app` se verificó
  READY en `80a902e1f3e87cd72c4c58b96a7f03d1d187b33c`,
  despliegue `dpl_41uyHBE9VonR37du4KeBDGDG2pt7`. El PR #65 está integrado
  en GitHub y su preview `c8d2c076` estaba READY; su publicación en el
  alias productivo aún no se confirmó en esta comprobación. Verificar SHA,
  alias y estado antes de declarar publicado cualquier commit posterior.
- Los módulos conservan sus nombres **Quejas** y **Mis Quejas**. Tipos:
  Queja, Observación, Sugerencia, Reclamo y Felicitación. Usar **solicitud**
  para el trámite y **expediente** para el registro de trabajo; conservar
  nombres de tipos, rutas, tablas, RPC, catálogos, folios, estados y permisos.
- Pendiente funcional: oficio/informe opcionales para Felicitación, con
  respuesta de agradecimiento. No está implementado: hoy la publicación,
  validación de cierre, autorización y transporte final siguen exigiendo
  documento. Observación/Sugerencia con informe según evaluación de GC
  es propuesta, no regla vigente. No eliminar controles solo en la UI.
- Pendiente operativo: publicar y comprobar plantillas nuevas de Quejas
  en Supabase Edge y Google Apps Script; Vercel no despliega esos servicios.
  Los PR #64/#65 no modifican la base de datos.
- QA del PR #65 (head `c8d2c076`): preview READY; TypeScript y lint
  superaron sus pasos (lint: 0 errores, 1 advertencia); verificación de
  bandeja Quejas aprobada. CaseWorkspace, Identidad y Reapertura fallaron
  pruebas posteriores. Hay aserciones antiguas de geometría y login,
  mocks incompletos de reintento de correo y fallos de acceso de usuarios.
  Investigar cada caso antes de modificar tests; no asumir que todos son
  obsoletos. GitHub Actions: runs 45278996866, 45278996483, 45278996512
  y 45278996490. No afirmar suite global verde ni E2E real. Falta aceptación
  institucional del ciclo por tipo, permisos, correo y seguimiento.

### Seguridad y pendientes operativos

- **Seguridad pendiente:** en pruebas anteriores se expuso un valor de
  `QMS_MAIL_SECRET` en un registro. **Rotar coordinadamente**
  `QMS_MAIL_SECRET` (Google Apps Script) y
  `QUEJAS_MAIL_SIGNING_SECRET` (Supabase) comprobando su relación con
  los demás envíos; no rotar unilateralmente ni publicar valores.
  La rotación no está confirmada. No escribir credenciales, tokens,
  correo personal o contraseñas temporales en AGENTS, logs o tests.

Evidencia reciente, con alcances distintos y selecciones parcialmente solapadas:

| Área | Evidencia conservada | Referencia |
| --- | --- | --- |
| Panel/colores/plazos | 65/65 Node, 379 comprobaciones en 36 escenarios, dos módulos, seis estados, 1536/390/320px; TypeScript, lint, build, estructura y visual correctos | [Panel](../quejas-panel-2026-10-13.md) |
| PDF de vista inicial | 118/118 focalizadas, PDF original reintentado con éxito y checksum de un único adjunto confirmado | [Formulario/correo](../quejas-formulario-correo-inmediato-2026-11-10.md) |
| Correo por evento | 83/83 selección de correo, 39/39 emisor, 159 PostgreSQL aisladas; activación HMAC/Drive y ACK final con Word documentados | [Activación](../../supabase/backups/quejas_urgent_mail_activation_20261110.json) |

No sumar esas cifras como suite global nueva. Las verificaciones completas antiguas,
fallos previos de informe/paginación y auditorías conservan su fecha y alcance
más abajo. No hay
benchmark autenticado con miles de filas ni garantía universal de servicios externos.

- **Web (verificada el 23 noviembre de 2026, corte histórico de acceso):** rama
  productiva `main`, dominio `mi-dashboard-iota.vercel.app`, estado `READY`,
  commit `8dba9dac7fdf8f8013cc830ac4bfcb6dd404814e`, despliegue
  `dpl_2xHeJWY7bvPJrkA42NhH7xHkW5Wz`. Incluye acceso inmediato con
  `phase='ready'`, gracia de 3 días hábiles, aviso en Header, cambio en Mi
  perfil, correo compacto preparado en GitHub y 2FA opcional. El deploy
  web NO publica automáticamente la plantilla GAS ni constituye E2E real.
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
- **Backend (verificado el 23 noviembre):** Supabase aplica la migración
  `20261123153151`, RPC de gracia y destino independiente de acceso;
  `qms-access-mailer` v5 `ACTIVE`. La entrega de correos reales fue
  confirmada por el propietario, pero los últimos ajustes HTML en GitHub
  aún exigen comprobar una nueva versión publicada de Apps Script.
  El correo de Quejas tiene evidencia histórica de activación del
  10 noviembre, independiente del cambio de acceso. No reabrir accesos
  legacy ni restaurar clientes incompatibles.
- **Pendientes:** aceptación institucional del ciclo completo con roles/destinatarios,
  excepción documental de Felicitación, publicación y verificación de plantillas
  Edge/GAS y resolución de las pruebas fallidas descritas en el corte vigente,
  feriados confirmados, oficios/adjuntos y manejo de fallos; UI de conciliación de envíos
  o subidas inciertos; contraste de las barras internas de Google Drive.
- **Límites de seguridad:** alta, 2FA opcional, plazo de gracia y login
  directo integrados en web/DB; el propietario comprobó recepción de correo
  real. Siguen pendientes la rotación coordinada de secretos de correo
  expuestos, el E2E automatizado del ciclo completo (inicio, reemplazo,
  vencimiento, reenvío y factores), antivirus, portal ciudadano completo,
  telemetría persistida/retención anual y Seguridad y Estado.
  La auditoría npm histórica tras fijar Next 16.4.6 registró cero
  críticas/altas y seis moderadas indirectas; no presentarla como nueva.

Para Quejas/Mis Quejas consultar también el
[checklist con alcance real y pruebas pendientes](../quejas-checklist-aceptacion-2026-11-13.md).
No atribuir pruebas E2E a inspección estática, SQL de metadatos ni compilación
Vercel. La existencia de archivos Node no demuestra que fueron ejecutados.

### Evidencia de acceso, regresiones y alcance

El propietario confirmó recepción real de correo de acceso. El autodiagnóstico
GAS y las verificaciones con mocks anteriores pasaron; el nuevo HTML aún exige
comprobar publicación. El login ready tuvo build READY; falta E2E de inicio,
cambio de clave, vencimiento, reenvíos y factores. Suites de referencia:
`tests/auth-visibility.test.mjs`, `tests/usuarios-acceso-mail.test.mjs`,
`tests/usuarios-acceso-seguro.test.mjs`, `tests/usuarios-acceso-link.test.mjs`,
`tests/usuarios-invitacion-restaurada.test.mjs`, `tests/mi-perfil.test.mjs`
y `scripts/test-usuarios-acceso-db.mjs`. Ejecutarlas antes de declarar aprobación;
QA sintética no demuestra entrega real ni autenticación en producción.

El corte del 14 noviembre sobre PDF/precarga/scroll conserva su rama
`fix/qms-pdf-pages-preview-scroll-20261114` como referencia histórica, no como
base actual. Tests Node de scroll, deduplicación, PDF corto/largo y guardado
son regresiones de código, no pruebas de UX real. Consultar main vigente
y no sobrescribir cambios ajenos.

Las entradas siguientes son evidencia histórica, no contratos de producto actuales.

17 noviembre, acceso inicial: backend activado con autorización expresa para
localhost, migración 20261117214855, Edge `qms-access-mailer` v2 y Apps Script v7.
Seis tablas privadas, 52 policies restrictivas, ACL service-only y acceso de cuentas
anteriores verificados. 21 pruebas focalizadas de acceso/correo y TypeScript Edge
correctos. Cuenta real solicitada creada una sola vez; recepción y canje hasta crear
contraseña confirmados por el propietario. Cinco regresiones del enlace y 38 checks
Chrome con StrictMode/AuthShell/QueryProvider, Auth sintético, correctos; 55 regresiones
Usuarios/Auth, TypeScript y lint focalizado correctos. Sin publicación Vercel ni activación de la entrega previa
de Agenda/Notificaciones. [Contrato](../usuarios-acceso-inicial-mfa-2026-11-17.md).

Agenda de hoy, 11 noviembre: 17 checks PostgreSQL aislado, 19 Node y 15 de navegador
sintético a 320/390/1440 px; TypeScript, lint, build, estructura y capa visual correctos.
RPC aplicado, cabecera local sin publicar. [Contrato](../agenda-hoy-2026-11-11.md).

El corte del 11 noviembre se conserva como evidencia; el contrato vigente está en los documentos temáticos.

Corrección posterior del contador de Quejas: migración 20261111155021 aplicada,
2089 → 89, siguiente candidato 2026-090; mismas 153 filas y digest de ID/folio,
sin correos ni registros de prueba reales. PostgreSQL aislado 162 comprobaciones,
incluido salto de históricos ocupados. No se renumeraron históricos ni se realizó
la limpieza futura para lanzamiento. [Contrato](../consecutivos-anuales-2026-11-11.md).

11 noviembre: [consecutivos anuales](../consecutivos-anuales-2026-11-11.md), 157
comprobaciones PostgreSQL aisladas, cinco series, cambio de año CR en tres zonas de
sesión, 200 asignaciones concurrentes y rollback por validación/RLS. Migración
20261111151343 aplicada y lectura remota con históricos/contadores de Quejas/policies
intactos; sin registros ni correos reales de QA. La DB conserva compatibilidad con
los RPC anteriores; los tres modales sin reserva previa siguen locales. Calendario
adicional aplazado.

Selección Node de esta entrega: 124/124 en altas, cliente público, informe, correo
y cola; TypeScript, lint focalizado, build, estructura y capa visual correctos.

Las entradas siguientes conservan su fecha y alcance; no sustituyen las correcciones
posteriores del propietario. Panel/estados/plazos: 65/65 Node y 379 comprobaciones
de navegador en ambos módulos/seis estados/1536–320 px; colores de catálogo con
prioridad, plazo como punto/texto, contacto solo al ampliar y selección #F0F4F7.
TypeScript, lint, build, estructura y capa visual correctos, sin publicar web.
[Contrato visual vigente](../quejas-panel-2026-10-13.md). No Procede abre directamente
correo/documento y publica desde esa ventana, sin otro modal de justificación;
[contrato de respuesta](../quejas-revision-y-respuesta-2026-11-04.md).

PDF de vista inicial, 10 noviembre: 118/118 en primitivas, revisión de seguridad,
gateway y cliente. PDF exacto del propietario aceptado y reintento real completado;
un solo adjunto y finalización confirmados. OpenAction permite destinos de vista
cerrados, mantiene el rechazo de acciones y no modifica permisos ni DB. Web local.
[Contrato y alcance](../quejas-formulario-correo-inmediato-2026-11-10.md).

Nuevos envíos, 10 noviembre: reintento automático acotado de evidencias ante red/
502/503/504, sin duplicar archivo/folio. Cliente 49/49, navegador 63/63 (tres anchos),
lint, build, estructura y capa visual correctos. Diez archivos confirmados antes de
finalizar; cancelación y rechazos permanentes sin reintento. El propietario excluyó
recuperar el archivo antiguo. [Contrato](../quejas-formulario-correo-inmediato-2026-11-10.md).

10 noviembre, formulario/correo por evento: 205/205 Node focalizadas, 159/159
PostgreSQL aisladas, 63 comprobaciones de navegador. Falso rechazo de fuentes
incrustadas en PDF corregido y reproducido con ambos documentos de requisitos.
Validación nativa y reintento de evidencias antes de finalizar; copiar enlaces
retirado de formulario/seguimiento/configuración. Web local; DB/Edge/Apps Script v5
activos por evento tras autorización Google. Final pendiente recuperado sin entrega
previa y ACK sent con Word. Suite del emisor posterior: 39/39. [Contrato](../quejas-formulario-correo-inmediato-2026-11-10.md).

10 noviembre, refinamiento de panel/comunicación: 145/145 Node focalizadas,
124/124 PostgreSQL aisladas, 45 comprobaciones de navegador y 64 del bundle Edge.
TypeScript, lint, build, estructura y capa visual correctos. No Procede usa la
ventana compartida con justificación/CAS; atajo al informe y envío GC en acciones.
DB y Edge v16 activas; web local sin publicación Vercel. Conserva el fallo previo
del doble de PDF en la selección adicional del informe. [Contrato](../quejas-revision-y-respuesta-2026-11-04.md).

10 noviembre: [correo de acompañamiento editable](../quejas-revision-y-respuesta-2026-11-04.md).
101 checks PostgreSQL aislados y 46 de navegador sintético, con Word real y
RPC/subidas ficticios; ningún correo o expediente real creado para QA. DB y Edge
activadas con snapshot del correo; cliente web local, sin despliegue Vercel. El
asesor conserva los cinco tipos/recuentos previos. La suite general conserva cinco
fallos anteriores en informe/paginación, fuera del cambio de correo.

9 noviembre, local: [estabilidad del modal de Quejas y Mis Quejas](../quejas-resolucion-y-revision-gc-2026-11-03.md#estabilidad-del-modal--9-noviembre-de-2026).
QA de navegador 505/505 y suites de paneles 98/98; lint, build con TypeScript,
estructura y capa visual correctos. Persisten cinco fallos anteriores en pruebas
de informe/paginación, detallados en la referencia. No se publicó web ni se
modificaron DB o correo.

3 noviembre: [informe editable y Word](../quejas-informe-editable-word-2026-11-03.md),
implementación local con **819/819** Node, **23/23** PostgreSQL aislado y
**15/15** QA de navegador. Persistencia activada por MCP el 3 noviembre con
`20261104001552`: preflight efectivo, grants/RLS, API REST y prueba de versiones con
ROLLBACK verificados. API local añade permisos efectivos de lectura/escritura para
Calidad; web sin publicar. Ver evidencia saneada en su referencia.

20 octubre: [dos correos ciudadanos y reintentos](../quejas-dos-correos-y-reintentos-2026-10-20.md).
DB aplicó `20261020163142`: recepción y resultado final, sin nuevos correos ciudadanos
de investigación. Se preservaron los 23 `sent` existentes; no había leases activos
en el corte. Edge y Apps Script actualizados, con cierre de verificación en la
referencia. Avisos internos y contratos históricos intactos. **795/795** Node,
**107/107** públicas, **137/137** PostgreSQL aislado y **41** checks del bundle Edge;
lint/build/estructura/visual correctos. La corrección del formulario público para
reintentos sigue **local, sin publicar**; no se desplegó una nueva versión web.

Refinamiento visual local posterior a la activación del 19 octubre: Quejas y Mis
Quejas comparten lienzo, cabecera de solicitud compacta y ciclos por tarea. Suite
focalizada **104/104** y completa **731/731**; TypeScript, lint acotado, build,
estructura y capa visual correctos. Revisión de permisos/CAS/borradores y QA CUA
con datos ficticios (14 escenarios, escritorio y viewport CSS390/320). No publica
Vercel ni modifica DB/correos. Ver [contrato del panel](../quejas-panel-2026-10-13.md).

19 octubre, seguimiento activado con autorización: Vercel
`dpl_2kk83rkgKrip1MwK8NNbMcw2d2MF` promovido y verificado en el dominio canónico;
Supabase aplicó `20261015223440` y los cortes de publicación/workflow después del
cliente compatible. Edge y Apps Script actualizados, flags/origen/firma comprobados;
activador automático completado a las 15:49:20 Costa Rica. WAF amplió sus dos POST
de seguimiento sin cambiar el límite existente. **725/725** Node, selección **162/162**,
DB aislada **208/208**, bundle Edge **50** checks, TypeScript/lint/build/estructura/visual
correctos; candidato **5/5** y producción **6/6** comprobaciones HTTP sin escrituras
de negocio. Nuevos eventos recibido/investigación con snapshot de seguimiento constan
`sent`; falta verificar correo y apertura del enlace por su destinatario. Sin quejas
de prueba ni reenvío histórico. Ver [activación y límites](../quejas-seguimiento-y-publicacion-2026-10-16.md)
y [evidencia saneada](../../supabase/backups/public_tracking_activation_20261019.json).

Las entradas siguientes conservan el estado y alcance de su fecha, anterior al corte
del 19 octubre; sus menciones de «local/sin publicar» no describen producción actual.

19 octubre, sonido en segundo plano corregido localmente: **42/42** pruebas pertinentes,
QA Chrome **16/16**, TypeScript, lint focalizado y build correctos. Audio preparado antes
de reclamar evita que una pestaña sin autoplay/MP3 silencie otra; IndexedDB mantiene
deduplicación y guards de identidad/preferencias. QA usa WebAudio/MP3/IndexedDB nativos,
visibilidad simulada y salida silenciada. Sin correos ni escrituras remotas. Seguimiento
continúa desactivado por la instrucción de mantenerlo local; correo recibido confirmado
por el propietario, con activador existente de cinco minutos. Ver
[sonido y límites](../notificaciones-audio-2026-10-14.md).

19 octubre, recibo público y plantilla de correo refinados localmente: Node **719/719**,
formulario **30/30**, QA de recibo **142/142** en cuatro tamaños/tres estados, TypeScript,
lint focalizado, build, estructura y capa visual correctos. HTML conserva QA **201/201**
del 16 octubre. El aviso reportado fue aceptado y encontrado en Recibidos, sin reenvío
ni escrituras remotas. Seguimiento apagado; Vercel/DB/Edge/Apps Script remoto sin cambios.
Ver [diagnóstico y presentación](../correo-quejas-directo-2026-10-13.md).

16 octubre, marca institucional (logo del menú) integrada localmente: bucket
`branding` aplicado en Supabase (20261016223929) y verificado por SQL —público, 2 MiB,
png/jpeg/webp y sin policies de escritura—, con `org.logo_url` como única referencia
al objeto vigente. Comprobación directa contra el bucket real: alta y baja con service
role correctas, lectura pública sin sesión, y rechazo (400) de mime no admitido, de un
archivo mayor a 2 MiB y de una escritura anónima; el objeto de prueba se retiró y el
bucket quedó vacío. Suite Node **719/719** (incluye tests/branding-logo-api.test.mjs),
TypeScript, lint, build, estructura (245 archivos fuente, 39 entradas Next/proxy) y
capa visual (**96 archivos React**) correctos. No se publicó Vercel y falta aceptación
visual en navegador con un archivo real (recorte cuadrado y logo sin fondo); el logo
de la prueba revertida se retiró junto con su bucket. Ver [integración del logo](integraciones.md).

16 octubre, caducidad de seguimiento desde cierre: Node **710/710**, PostgreSQL
aislado **208/208**, TypeScript, lint focalizado, build, estructura y capa visual
correctos. Primera No Procede/Finalizado fija 30 días naturales; Resuelto no inicia
la cuenta y consultar/reabrir no renueva. Firma v2 y snapshot de dos campos conservan
URL/hash. Pruebas de límite exacto, descarga/emisión, carreras y rollback. Todo
preparado en código/migración local, sin activar servicios ni enviar correos reales.
Ver [contrato y evidencia](../quejas-seguimiento-y-publicacion-2026-10-16.md).

16 octubre, revisión de autorización/antiabuso del seguimiento: BotID Basic añadido
en local a consulta y descarga antes del backend; **55/55** pruebas pertinentes,
TypeScript, lint focalizado y build correctos. El enlace sigue autorizando al portador,
sin autenticación del titular. No se activó seguimiento ni modificó WAF remoto.

16 octubre, seguimiento coherente y formulario compacto: [contrato actualizado](../quejas-seguimiento-y-publicacion-2026-10-16.md).
Node completo **703/703**, flujo/correo **100/100**, navegador sintético **74/74** en
cuatro tamaños, TypeScript, lint, build, estructura y capa visual correctos. El
propietario reafirmó mantener todo local después de ofrecer la activación. No se
publicó web, aplicó DB ni cambió Edge/Apps Script remoto; los correos reales aún no
incluyen esta ampliación de seguimiento.

16 octubre, corrección posterior del formulario público: validación cliente/API
compartida, mensaje/foco por campo y distinción entre entrada inválida y fallo
interno. El propietario confirmó el envío local. Suite Node completa **697/697**,
Chrome sintético **38/38** en escritorio/móvil, TypeScript, lint, build, estructura
y capa visual correctos. Incluye visor **9/9** con conexión anticipada por intención
al origen Drive, sin precargar documentos ni alterar su autorización. Sin nueva
migración ni publicación. Detalle y límites en [contrato público](../seguridad-formularios-publicos.md)
y [visor Drive](../seguridad-drive.md).

16 octubre: [gestión, seguimiento y publicación final](../quejas-seguimiento-y-publicacion-2026-10-16.md)
verificados localmente: Node **686/686**, PostgreSQL aislado **154/154**, navegador
**98/98** (Mis Quejas/Configuración/seguimiento/Calidad), TypeScript, lint, build,
estructura y capa visual correctos. Nada de esta ampliación está activado en producción.
La migración y el corte de publicación se coordinan con web/Edge/Apps Script; publicación
en Vercel sigue requiriendo autorización explícita. No usar el corte con un cliente viejo.

15 octubre: [calendario laboral](../calendario-qms-2026-10-15.md) integrado localmente
con el publisher/versionado existente. Suite Node **636/636** y PostgreSQL aislado
**112/112**. Se aplicó el retiro autorizado de writes/TRUNCATE cliente sobre sus
tablas; lectura/RLS/RPC conservados, sin publicar feriados ni cambiar etapas abiertas.
TypeScript/lint/build/estructura/capa visual correctos. QA real local **43/43** a
1366/390/320 px con datos ficticios y red externa bloqueada, incluidas confirmaciones
y descripciones largas. No se publicó Vercel. La institución aún debe confirmar
feriados y destinatarios de Calidad.

14 octubre: [avisos internos activados](../avisos-internos-quejas-2026-10-14.md) por
Supabase/Apps Script, con corte sin mensajes históricos y prueba HMAC real sin envío.
Primer poll automático posterior al corte completado a las 21:44 Costa Rica, sin
filas reclamadas ni errores; evidencia en el documento de avisos y backup de activación.
Suite Node completa **614/614**, PostgreSQL aislado **76/76**, correo **78/78**,
TypeScript/lint/build/estructura/capa visual correctos. Audio: **13 comprobaciones**
en dos páginas Chromium con datos ficticios; mejora web local, sin publicar Vercel.
La activación encontró cero perfiles activos de Calidad. Falta asignar sus destinatarios
institucionales y aceptar entrega real; siguen pendientes conciliación visual,
feriados y corte/publicación web coordinados.

13 octubre: [correo directo activo](../correo-quejas-directo-2026-10-13.md), sin Vercel.
Suite517/517 y selección posterior de correo62/62, healthHMACreal, MailApp/ACK DB y ejecución automática verificados. Un
activador de cinco minutos, diario privado y endpoint anterior archivado. No se publicó
el frontend; los avisos QMS se activaron después el 14 octubre, la conciliación visual sigue pendiente.

Entrega local del 12 octubre: [panel y conexión de correo](../quejas-panel-y-correo-2026-10-12.md).
Suite completa **469/469**, TypeScript/lint/build/estructura/capa visual y 13 verificaciones
Playwright con datos ficticios. Apps Script ya recibe y rechaza peticiones sin firma;
configuración inicial/diario privado terminados, HMAC comprobado sin envío y 20/20 pruebas
de correo tras ampliar el inicializador. Activación posterior en la referencia del 13. La evidencia histórica siguiente
conserva sus fechas y alcances; no describe el despliegue actual.

Última verificación local: **8 de octubre de 2026**, [segunda limpieza y evidencia](../segunda-limpieza-2026-10-08.md).
La segunda limpieza comprobó **290/290**; seis carreras previas quedaron corregidas.
La ampliación pública comprobó **363/363 tests Node** y **73/73 verificaciones PostgreSQL**
en un cluster local sintético aislado, sin escrituras de negocio en producción.
TypeScript/lint/build de la limpieza son evidencia histórica; las verificaciones del
cambio público y su despliegue se registran en [la guía pública](../seguridad-formularios-publicos.md).
DB aditiva y parche Drive aplicados, WAF público activo; activación API en Vercel
y cierre de RPC legacy aún pendientes.
La [auditoría del 7 de octubre](../auditoria-validada-2026-10-07.md) conserva su evidencia histórica.

## Comandos

~~~sh
npm run dev
npx tsc --noEmit
npm run lint
node --test tests/<suite-del-cambio>.test.mjs
npm run build
npm run check:structure
npm run check:visual
~~~

npm test ejecuta tests/*.test.mjs. Algunos fallos históricos dejan timers abiertos;
node --test --test-force-exit tests/*.test.mjs permite recoger el diagnóstico, sin
ocultar resultados. Elegir regresión pertinente y ampliar si aparece un fallo nuevo.
Un cambio solo Markdown requiere rutas/enlaces/consistencia y git diff --check, no otro build.

El auditor de estructura sigue imports literales/exports/CSS, identifica archivos
sin montaje y comprueba que no vuelvan kits retirados, middleware conflictivo ni
artefactos `.performance` versionados. Es un inventario estático: no autoriza
borrados automáticos ni demuestra permisos o referencias calculadas en runtime.

## Qué comprobar según el cambio

| Área | Suite o herramienta inicial |
| --- | --- |
| Sesión, login/logout, alcance de caché | tests/auth-visibility.test.mjs |
| QueryFunctionContext, dashboard, guard de métodos | tests/dashboard-runtime-regression.test.mjs |
| Cancelación, claves y paginación | tests/query-read-contracts.test.mjs, data-reliability.test.mjs, pagination-active.test.mjs |
| Precarga y permisos de Sidebar | tests/navigation-prefetch.test.mjs |
| Formularios y guardados duplicados | tests/operational-mutations.test.mjs |
| Inputs y efectos privilegiados de Usuarios | tests/usuarios-input-security.test.mjs, usuarios-acceso-workflow.test.mjs |
| Acceso inicial / invitación / verificación propia y TOTP (local, 17 noviembre) | 104 focalizadas; 68 PostgreSQL temporal; 14 navegador sintético en 1440/390/320; build/TS/estructura/visual correctos; global 1041/1076 con los mismos 35 fallos previos. Sin cuentas/correos reales ni activación remota. [Contrato](../usuarios-acceso-inicial-mfa-2026-11-17.md) |
| Gestor/API IA y errores seguros | tests/ai-settings-security.test.mjs, ai-settings-ui.test.mjs, markdown-security.test.mjs |
| Kit, layout responsive, foco y modales | tests/visual-contracts.test.mjs, header-menu-focus.test.mjs, scripts/check-visual-layer.mjs |
| Gateway público, archivos y reintentos | tests/public-form-primitives.test.mjs, public-gateway.test.mjs, public-quejas-client.test.mjs, public-flow-review.test.mjs |
| Gateway público DB y concurrencia | scripts/test-public-forms-db.mjs, cluster sintético aislado; verificar-public-forms-gateway.sql y verificar-public-forms-cutover.sql para metadata |
| DB RLS/ACL/workflow histórico | scripts/verificar-seguridad-db.sql y verificar-auditoria-db.sql, revisar sus expectativas legacy antes de ejecutarlos; fixtures transaccionales y ROLLBACK |

Los tests JS transpilan módulos reales con tests/load-module.mjs y dobles de red;
no usan cuentas o credenciales reales. No instalar dependencias de un prototipo o
regenerar fixtures solo para hacer desaparecer un fallo. Baseline global de la
auditoría: **199/222, con 23 fallos presentes en HEAD anterior**. La comparación anterior
fue 119/156 y 37 fallos; se resolvieron 14, sin nuevos fallos en aquella suite.
Selección posterior de IA/sesión/cargas: **47/47**. Son resultados fechados.

## Evidencia pública y límites

El test PostgreSQL aplica gateway, parche y cierre sobre fixtures locales, prueba
roles/ACL y carreras de creación/cuota/adjuntos/notificación, y detiene su cluster.
No valida una migración distinta ni publica Vercel. Los tests HTTP emplean dobles
de SDK/red y los del cliente reproducen respuestas perdidas y reintentos. No
demuestran detección real de bots: BotID puede omitirla en desarrollo.

Producción debe comprobar rechazo de POST sin prueba BotID, metadata limitada,
cierre de firmas legacy y continuidad admin. Evitar quejas ficticias en DB real
para una prueba de humo: generan folios/notificaciones. Drive/DB no tienen una
transacción distribuida; reservas de resultado incierto requieren reconciliación manual.

## Evidencia previa y límites

- Next producción y TypeScript correctos; lint 0 errores con 2 warnings históricos de experimentos. Capa visual: 114 archivos React comprobados en esa auditoría.
- npm audit --omit=dev devolvió 0. La auditoría completa registró 5 entradas high de una cadena de desarrollo ESLint/fast-glob/micromatch/braces; no se forzaron versiones incompatibles. Releer package-lock y ejecutar audit antes de afirmar el resultado actual.
- El frontend/API compatible se verificó en Vercel en 07763ff antes del aislamiento de DB. Un checkout distinto requiere verificar su propio despliegue.
- HTML inicial de /, /quejas, /usuarios y /procesos: presentación neutra, sin shell privado. Browser temporal sin sesión real: ruta privada → login y recarga; IA/Usuarios sin Bearer e IA con token inválido responden 401.
- DB endurecida y rollback de metadatos se probaron con fixtures/ROLLBACK en remoto sin revertir el estado final. No se extrajeron datos de personas ni claves reales.
- Esa auditoría no incluyó benchmark autenticado con miles de registros ni carga concurrente completa. El correo se activó y verificó después, el 13 octubre, con alcance en [su estado operativo](../correo-quejas-directo-2026-10-13.md); no demuestra lectura/inbox universal ni verificación continua de servicios externos.

## Trabajo pendiente confirmado

| Área | Alcance todavía pendiente |
| --- | --- |
| Catálogos | UI legacy aún ofrece DELETE/cambios que el trigger protege; integrar codigo/valor_interno y desactivación/historial |
| Quejas | Falta aceptación institucional de los cinco tipos, informe opcional para Felicitación, plantillas Edge/GAS y pruebas fallidas del corte vigente |
| QMS | Lectores y editor versionado publicados; editor SLA sigue legacy. Registrar feriados institucionales confirmados; calendario actual lunes–viernes |
| Avisos/correo | Dos correos ciudadanos desde el 20 octubre, con investigación solo histórica; avisos internos activados el 14 mediante el poll existente, sin pg_cron. Faltan destinatarios activos de Calidad/aceptación institucional y UI de conciliación; mail_queue por sí sola no demuestra envío |
| Formularios públicos | Gateway/BotID Basic/cuotas DB/idempotencia/capacidad desplegados; DB/WAF/variables y cortes legacy aplicados. POST sin prueba rechazado en producción. Pendientes: antivirus, reconciliación automática y prueba ciudadana positiva de extremo a extremo en producción. [Estado de activación](../seguridad-formularios-publicos.md) |
| Datos legacy | Migrar consultas directas de componentes según necesidad; la cancelación aplicada a hooks no los reemplaza automáticamente |
| Usuarios | Último admin y cambios entre Auth/perfil sin transacción distribuida; revisar concurrencia real y coherencia de roles |
| Seguridad | Acceso temporal y 2FA integrados; falta E2E de inicio/cambio/vencimiento/reenvío/factores, rotación coordinada y aceptación real. BotID/cuotas del gateway no protegen ese login |
| Rendimiento | Perfilar navegación autenticada/red/memoria con volumen y distinguir dev de build de producción |
| Producto | CRUD/derivación de hallazgos, eficacia/validación SACP, versionado/Drive documental y actas/acuerdos completos |
| Producto | Sin persistencia UI completa de informes_config, tareas o solicitudes documentales |
| Observabilidad | Seguridad y Estado sigue propuesto; sin ingesta/visor de errores reales ni telemetría JSONB con limpieza anual |
| Apariencia | Fondo personalizado y selector completo de tema no están montados |

RLS amplias de las 13 tablas, filtros seguros de Quejas/Usuarios, cancelación de
hooks operativos, reconexión de Realtime y validación API de Usuarios fueron
resueltos en la auditoría; no mantenerlos en la lista como si siguieran abiertos.

## Continuidad y despliegue

Consultar git status antes de editar/integrar cambios. Compilar localmente no
publica Vercel ni verifica sus variables. Tras desplegar, verificar URL/commit,
login, recarga privada, logout, permisos y API. Ctrl+F5 puede descartar chunks
antiguos; no borrar .next/node_modules o detener servicios del usuario como primera solución.

Validación manual útil: una cuenta desactivada con token previo, dos administradores
concurrentes, envío ciudadano con evidencias, servicios externos y reconexión real.
Actualizar contratos vivos por tema; auditorías y archivos históricos conservan la
evidencia de su fecha sin competir con la fuente actual.

## Activación pública — 9 octubre

Usuario autorizó publicar tras verificar y cerrar accesos antiguos. Despliegue dpl_5RVFbd1Dd4xBtK9HTh4UMGY3St8G sirve mi-dashboard-iota.vercel.app; nueve comprobaciones HTTP sin escrituras de negocio correctas: rutas públicas accesibles, token inexistente 404, tres POST sin prueba 403, cuatro APIs privadas sin sesión 401. Corte SQL remoto confirmado con roles anon/authenticated en transacción read-only. Pruebas 417/417 Node, 73/73 PostgreSQL público y 148/148 Drive/Storage/corte atómico. Los extras ACL de storage.objects pertenecen a supabase_storage_admin y no fueron revocados por postgres; la protección efectiva de archivos es RLS/bucket privado, no un REVOKE que haya ignorado el grantor. Advisors mantienen avisos de ámbito global registrados en la evidencia. No equivale a antivirus ni a una auditoría absoluta de todo el producto.

Evidencia: [public_activation_evidence_20261009.json](../../supabase/backups/public_activation_evidence_20261009.json).

Quejas (10 octubre): las migraciones 20261011044303/20261011044317/20261011044810
están aplicadas. Suite completa 457/457, PostgreSQL aislado 48 checks, visual real en
Chrome temporal 7 checks. TypeScript/lint/build/structure/visual-layer verificados.
Evidencia de DB y validación en supabase/backups/quejas_completion_evidence_20261010.json.
No publica Vercel, no prueba envío institucional ni programa avisos QMS. Pendientes:
cliente nuevo/corte legacy coordinado, feriados, Apps Script separado y pruebas de
recepción autorizadas. Ver ../quejas-lanzamiento-2026-10-09.md.

## Ajustes visuales — 14 octubre

Formulario público, lectura del análisis de Quejas/Mis Quejas y HTML del correo:
129/129 pruebas pertinentes, TypeScript, lint acotado, estructura, capa visual y
build de producción correctos. QA sintética: 124 comprobaciones del formulario
con página/hook/cliente reales en cuatro tamaños y reducción de altura; 32 del
HTML de los tres correos en escritorio/móvil; 16 del lector de justificación y
resolución en ambos tamaños. No equivalen a una suite completa ni a un envío real.

Solo la función HTML del mailer activo se actualizó en Apps Script y se verificó
guardada tras recargar. No se ejecutó el poll ni se enviaron pruebas. Frontend
preparado localmente, sin publicación Vercel ni cambios DB. Contratos:
[formulario](../formulario-publico-visual-2026-10-14.md),
[correo](../correo-quejas-directo-2026-10-13.md) y
[lector de expediente](../quejas-panel-2026-10-13.md).
