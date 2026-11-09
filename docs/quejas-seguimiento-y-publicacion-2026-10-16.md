# Quejas: gestión, seguimiento privado y comunicación final

## Activación verificada del 19 de octubre

El propietario autorizó publicar y activar el enlace en nuevos correos, sin reenviar
históricos. Producción sirve `dpl_2kk83rkgKrip1MwK8NNbMcw2d2MF` en
`https://mi-dashboard-iota.vercel.app`. La migración `20261015223440` quedó aplicada
y registrada; tras verificar el cliente compatible se aplicaron ambos cortes de
publicación y workflow. La comprobación remota confirmó `publication_cut_active=true`
y `legacy_client_can_execute=false`. No restaurar un cliente antiguo contra este contrato.

Web y Edge comparten firma dedicada y origen canónico con disponibilidad habilitada.
Apps Script conserva su transporte HMAC/diario y el mismo activador de cinco minutos;
su código guardado se comparó con `Codigo.gs`, se configuró el origen de seguimiento
y se reactivó tras completar el corte. `qmsMailPoll` automático completó a las
15:49:20 de Costa Rica en 4,518 s. No se ejecutó un poll manual ni se reenviaron históricos.
Los eventos nuevos recibido e investigación ya tienen snapshot de seguimiento y
estado `sent`; esto confirma procesamiento, no lectura ni entrega en cada buzón.

La regla WAF existente conserva sus cuatro grupos y límite de 90 peticiones/IP por
600 segundos, añadiendo los dos POST de seguimiento. Las consultas y descargas sin
prueba fueron rechazadas con 403, `no-store` y `noindex`; la página genérica abre
sin exponer expedientes. Su disponibilidad se verificó también tras hidratar en navegador.

Verificación: **725/725** Node, **162/162** de seguimiento/correo/publicación,
**208/208** PostgreSQL aislado y **50** comprobaciones sintéticas del bundle Edge.
TypeScript, lint, estructura, capa visual y build correctos. Candidato **5/5** y
producción **6/6** comprobaciones HTTP sin escrituras de negocio ni envíos de prueba.
El build incluyó el flag habilitado porque la página captura disponibilidad al prerenderizar.

Evidencia saneada: [public_tracking_activation_20261019.json](../supabase/backups/public_tracking_activation_20261019.json).
Los respaldos y diagnósticos locales están en `.performance/tracking-release-20261019/`;
los secretos permanecen en configuración privada, fuera de Git y del paquete de Vercel.
Falta aceptación de un correo nuevo con el botón y apertura del trámite por su destinatario.
Una prueba adicional que habría emitido acceso para un expediente real fue rechazada
por revisión automática y no se ejecutó; no se generaron capacidades de prueba sobre datos reales.

## Historial previo a la activación

Estado al **16 de octubre de 2026**: implementación y pruebas locales. La migración,
el corte de publicación, la nueva versión de Edge/Apps Script y la web **no están
activados en producción**. La lectura remota del 15 de octubre está en
`supabase/backups/public_tracking_preflight_20261015.json`; no es una comprobación
remota continua. No generar expedientes ni correos de prueba reales sin autorización.

El 16 de octubre el propietario eligió **mantener todo en local**. No aplicar la
migración, el corte, secretos/flags ni cambios del emisor como continuación automática.
Tras verificar esta corrección se volvió a ofrecer la activación coordinada; el
propietario confirmó nuevamente **«No, mantener todo en local»**. La entrega web,
DB y correo de seguimiento quedaron preparadas, sin activar ni reenviar históricos
en esa fecha. La autorización y activación posteriores constan arriba.

## Flujo y límites de producto

### Corrección de seguimiento y formulario del 16 octubre

El reporte mostró una página que pedía consecutivo y «clave» aunque el seguimiento
no estaba activado. La inspección local confirmó ausentes `PUBLIC_TRACKING_ENABLED`,
`PUBLIC_TRACKING_SIGNING_SECRET` y `PUBLIC_TRACKING_ORIGIN`. No era una contraseña
elegida por el interesado. El emisor requiere la ampliación v3 y su configuración
coordinada para incorporar el enlace; los correos ya enviados no se modifican.

- La página recibe del servidor solo un booleano de disponibilidad. Mientras falte
  activación/configuración muestra información clara, sin un formulario que termine
  en 503. El HTML sigue genérico y no contiene secretos o expedientes.
- El flujo normal abre el enlace completo y consulta automáticamente. Sin enlace
  explica cómo abrir el botón del correo/confirmación; una opción secundaria permite
  pegar el enlace completo. No pide contraseña ni consecutivo. No se consulta por
  folio solo ni se conserva la capacidad en almacenamiento persistente.
- Un fallo de consulta conserva su capacidad en memoria para Reintentar. Al recargar,
  el fragmento ya consumido no se recupera; se explica reabrir el enlace guardado.
- La finalización informa `trackingState: disabled | available | pending`. Disponible
  exige URL validada; pendiente conserva la confirmación del envío. Obtener enlace
  repite únicamente la finalización idempotente con la misma capacidad: nunca el alta
  ni los adjuntos. Cambiar de visita o salir aborta/descarta respuestas anteriores.
- Configuración distingue la página informativa del enlace privado de un expediente;
  eliminó el parámetro `?form=` que no autorizaba consultas ni era consumido.
- Formulario con encabezado compacto, adjuntar y contador en una fila, lista solo
  cuando hay archivos, máximo dos filas visibles y scroll. El pie de envío conserva
  espacio propio; ya no hay dos paneles vacíos ni un bloque de error de altura mínima.

La plantilla de Apps Script explica que el botón abre directamente sin contraseña.
Esta corrección del 16 octubre se mantuvo local; el emisor, flags y migración se
activaron posteriormente el 19 octubre, según la evidencia del inicio.

Verificación de esta corrección: Node completo **703/703**, selección de flujo/correo
**100/100**, navegador sintético **74/74** en 1440/1280/375/320 px, TypeScript, lint,
build, estructura y capa visual correctos. Se probaron apertura automática, pegar
enlace completo, folio inválido sin red, servicio apagado sin formulario roto, errores
y reintentos, confirmación estable y diez evidencias. Red externa bloqueada y cero
escrituras/correos reales; evidencia en `.performance/seguimiento-20261016/`.

1. La recepción pública mantiene su alta idempotente y termina los adjuntos antes
   de confirmar. Después puede ofrecer el enlace privado de seguimiento.
2. En **Mis Quejas**, el responsable documenta la investigación y presenta su
   propuesta a **revisión de Calidad**. El lienzo de análisis es un borrador de esa
   visita; las notas de actividad y la propuesta enviada sí se guardan. No hay
   autoguardado del lienzo ni publicación directa del análisis al ciudadano.
3. **Calidad** revisa el documento interno y redacta por separado la **Respuesta al
   cliente**, con el oficio emitido por ECA y el archivo que publicará. Nunca se
   copian automáticamente notas o análisis a la respuesta pública.
4. El resultado final se comunica mediante la plantilla de correo y su enlace
   privado. El documento variable se descarga desde el seguimiento; no se adjuntan
   todas las evidencias al correo ni se añaden permisos de Drive a Apps Script.

Mis Quejas comparte el workspace 40vw/100dvh de Quejas, con tabla estable y scroll
en ambos ejes, ampliación que se restablece al cerrar, ciclo/plazo persistido y
Tiptap lazy. La IA es una acción secundaria y no se ejecuta al abrir el expediente.
Las propuestas conservan la revisión que se abrió al editar; conflictos y errores
mantienen el borrador. Solo admin, Calidad o el colaborador responsable pueden editar.

## Seguimiento y seguridad

`/q/seguimiento` es una página genérica, sin datos de expedientes en su HTML inicial.
El consecutivo sirve como referencia y **no autoriza consultas**. Un enlace contiene
una capacidad HMAC v2 con propósito exclusivo, UUID del expediente y nonce.
La vigencia se comprueba en DB en cada consulta y descarga; no se anticipa una fecha
de cierre desconocida dentro del enlace firmado.
La clave viaja en el fragmento y se retira del historial al consumirlo; cambiar de
enlace en la misma pestaña cancela y descarta la respuesta anterior. Las capacidades
permanecen en memoria, sin localStorage ni claves de TanStack Query.

El enlace es una credencial de portador: quien posea el enlace completo vigente
puede consultar ese expediente. No verifica la identidad de quien lo abre ni el
control del correo registrado, y no requiere una sesión Auth del ciudadano.
Reenviar/filtrar el enlace transfiere ese acceso hasta revocación o caducidad.
No presentar este modelo como «solo la persona dueña puede entrar». El consecutivo
por sí solo no autoriza; un correo escrito en un campo tampoco demuestra identidad.
El propietario rechazó añadir otro envío de enlaces; no se incorporó OTP ni un nuevo
flujo de correo como parte de esta revisión.

### Caducidad confirmada: 30 días naturales desde el cierre

El propietario eligió contar desde el cierre, no desde el registro. Mientras el
expediente no tenga cierre formal, `queja_public_access.closed_at/expires_at` son
nulos. La primera transición a **Finalizado** o **No Procede** fija ambos valores
atómicamente con hora de DB y una ventana exacta de 720 horas. **Resuelto** aún es
un paso previo al cierre y no inicia esta cuenta. No cambia el calendario ni los
plazos de evaluación/investigación.

`closed_at` es propio del acceso: el `fecha_cierre` legacy puede corresponder a una
resolución anterior o sobrevivir a una reapertura. Consultar, volver a obtener el
enlace desde Configuración, reenviar un correo o reabrir/volver a cerrar no renueva
el primer vencimiento ni reactiva un enlace vencido. Los históricos ya cerrados
usan, bajo demanda, su fecha pasada conocida de forma conservadora; una fecha
ausente, futura o anterior a la recepción falla cerrada, sin conceder un mes nuevo.

La restricción de tabla exige las dos fechas nulas o ambas finitas y coherentes.
El helper de creación bloquea primero el expediente, en el mismo orden que el
workflow, para que una carrera entre obtener enlace/cerrar no deje un acceso abierto.
Al llegar al límite, consulta, descarga y emisión desde Configuración rechazan el
acceso. No requiere cron y no borra queja, auditoría, publicación ni archivos Drive;
la gestión autenticada conserva sus permisos existentes.

La firma autentica expediente/nonce, **no sustituye la autorización de DB**. El
snapshot de correo guarda solo esos dos campos; el mismo enlace sirve antes y
después del cierre. Un mensaje reclamado tarde conserva URL, texto y hash, aunque
su acceso ya esté vencido. Esto evita que la caducidad haga fallar después del claim
un lote entero y deje correos sanos en incertidumbre. No se modifican los leases,
ACK, diario ni reglas de reintento ante incertidumbre. v1 era un borrador local sin
activar: el contrato v2 quedó coordinado con la migración del 19 octubre, sin compatibilidad
que reabra enlaces anteriores ni reenvío de históricos.

Los POST exactos `/api/public/seguimiento` y `/api/public/seguimiento/documento`
verifican firma, vigencia y revocación, origen, tamaño del body y cuotas
transaccionales PostgreSQL. Responden sin caché, sin indexación y sin referrer.
Refuerzo local del 16 octubre: ambos POST también reutilizan BotID Basic antes
de obtener el cliente privilegiado o consumir cuotas. La instrumentación cliente
incluye esas dos rutas, además de las tres del formulario. Mantiene las excepciones
de desarrollo/loopback del guard existente, sin convertirlas en bypass en Vercel.
No demuestra detección real de bots desde pruebas locales ni protección infalible.
La regla WAF del 9 octubre cubría el formulario y metadata; el 19 octubre añadió
estas dos rutas conservando sus condiciones anteriores y el límite compartido.
Pruebas locales del refuerzo: **55/55** en gateway público y seguimiento, TypeScript,
lint focalizado y build correctos. Casos bot/SDK fallido o incompleto no llegan a DB
ni Drive; una comprobación humana tampoco autoriza una capacidad inválida.
No publican nombre, correo, teléfono, descripción original, responsables, análisis,
observaciones internas ni evidencias ciudadanas. El DTO permite únicamente folio,
estado, hasta cuatro hitos y la respuesta/oficio aprobados. No existe una cuenta
ciudadana ni un canal de comentarios públicos en esta entrega.
La proyección excluye campos personales del expediente; una respuesta u oficio
redactado por Calidad aún puede contener información personal que su autor incluya.

La descarga vuelve a comprobar expediente, publicación y pertenencia física en
Drive. Fuerza `attachment`/`application/octet-stream` y limita los bytes reales a
4 MiB. No publica URLs de Drive. Un oficio requiere autor interno, ID Drive válido,
nombre de hasta 255 caracteres, MIME válido y tamaño conocido entre 1 byte y 4 MiB.
Las evidencias ciudadanas no son oficios publicables. Esto no incorpora antivirus
ni garantiza la inocuidad universal de documentos o servicios externos.

Configuración → Formularios ofrece **Seguimiento** por formulario. El administrador
solicita expresamente el enlace de un consecutivo; el servidor comprueba la relación
con ese formulario y su finalización. La referencia general del formulario no
contiene credenciales. Cerrar o cambiar el consecutivo retira el enlace anterior.

## Persistencia y puntos de edición

| Contrato | Fuente |
| --- | --- |
| Workspace del responsable | `app/mis-quejas/page.tsx` y `components/QuejaColaboradorPanel.tsx` |
| Publicación de Calidad | `app/quejas/components/QuejaDetalleModal.tsx`, `QuejaPublicacionPanel.tsx`; `resolverQuejaConDocumento` |
| Capacidad disponible | `lib/queries/useQuejaPublicacion.ts`; GET privado `/api/quejas/seguimiento` |
| Página y transporte público | `app/q/seguimiento/`, `lib/services/publicTrackingClient.ts`, `lib/server/publicTracking.ts` |
| DTO y validación de enlaces | `lib/types/publicTracking.ts`, `lib/utils/publicTrackingLink.ts` |
| Firma compartida web/Edge | `supabase/functions/_shared/publicTrackingCapability.ts` |
| Enlaces de Configuración | `SeguimientoFormularioModal.tsx`, `publicTrackingAdminClient.ts`; POST privado `/api/quejas/seguimiento` |
| Migración aditiva, aplicada el 19 octubre | `supabase/migrations/20261015223440_quejas_public_tracking.sql` |
| Corte obligatorio posterior a web compatible | `scripts/activar-publicacion-quejas.sql` |

Las tablas de capacidades y reservas de borrado son solo de servidor; la tabla de
publicación permite lectura autenticada con la visibilidad RLS del expediente.
La respuesta y la transición se confirman mediante un único wrapper con CAS.
Reservar el borrado antes de llamar a Drive impide publicar un archivo cuya
eliminación empezó. La publicación impide borrar después el oficio. Una reserva
incierta se conserva y se concilia; no se libera suponiendo que Drive falló.

El corte separado exige que No Procede/Resuelto se publiquen en la misma transacción
y con la revisión original; no confía en headers o GUC del cliente. Los históricos
sin publicación no pueden pasar a Finalizado después de ese corte hasta registrar
su respuesta y oficio. Una reapertura no muestra automáticamente una publicación
de la investigación anterior. No fabricar respuestas ni adjuntos históricos.

## Contrato para futuras activaciones o rotaciones

- Configurar privadamente en web y Edge `PUBLIC_TRACKING_SIGNING_SECRET` (clave
  aleatoria independiente, mínimo 32 bytes) y `PUBLIC_TRACKING_ORIGIN` (origen HTTPS
  canónico). Apps Script recibe solo `QMS_PUBLIC_TRACKING_ORIGIN`; nunca la clave.
- Mantener `PUBLIC_TRACKING_ENABLED=false` mientras se prepara la entrega. Con
  activación true y configuración incompleta, la UI recibe un error y bloquea el
  guardado; solo false explícito o el flag ausente conservan compatibilidad.
- Aplicar la migración aditiva, publicar y verificar primero web/API compatibles.
  Solo entonces aplicar el corte anterior y coordinar el cierre interno legacy
  existente de `scripts/cerrar-workflow-quejas.sql`. No confundirlo con el gateway
  público cerrado desde el 9 de octubre.
- Actualizar Apps Script/Edge y sus propiedades antes de activar los enlaces. No
  añadir activadores ni ejecutar un poll para verificar apariencia. Coordinar con
  la cola sin envíos en vuelo: cambiar flag/clave/origen sobre mensajes intentados
  puede cambiar su huella y requiere conciliación, nunca reenvío automático.
- Verificar el contrato v2 de capacidad y los snapshots de dos campos junto con la
  migración de caducidad. No usar el borrador anterior que firmaba una fecha fija;
  no reintentar ni reescribir mensajes históricos para eludir la deduplicación.
- Edge activo usa claim v3; v2 y mensajes históricos conservan su contrato. Los
  tres hitos ciudadanos siguen siendo recibido, investigación y final. No hay
  backfill de enlaces o reenvío de correos históricos. Ver el
  [protocolo de correo](seguridad-correos-quejas.md).

## Evidencia local histórica anterior al corte

Recibo/correo del 19 octubre: [diagnóstico y límites del emisor](correo-quejas-directo-2026-10-13.md).
El aviso reportado se encontró en Recibidos. Seguimiento apagado, sin backfill/reenvío.
Recibo compacto **142/142**; plantilla local conserva QA **201/201** del 16 octubre;
Node completo **719/719**. Diseño y prueba local no activan enlaces en correos reales;
la publicación/configuración aún requieren autorización.

Caducidad desde cierre (16 octubre): Node completo **710/710** y PostgreSQL aislado
**208/208**. TypeScript, lint focalizado, build de producción, estructura y capa
visual correctos. DB comprueba abierto de más de un año, primera No Procede/Finalizado,
Resuelto sin cuenta, límite exacto, revocación, emisión y descarga vencidas,
reapertura sin renovación, cierres históricos inválidos, 720 horas a través de DST,
carreras enlace/cierre y rollback de una transición rechazada. API/correo comprueba
la misma URL antes/después de cerrar y el mismo hash en un lote reclamado tarde.
Evidencia: `.performance/tracking-expiry-node-20261016.log` y
`.performance/quejas-public-tracking-db-evidence.json`. La migración aditiva local
sin aplicar incorpora este contrato; no se modificó DB, Edge, Apps Script, secretos
ni despliegues remotos. No hubo quejas ni correos reales de prueba.

Pruebas de gateway/capacidades, configuración, flujo de publicación, permisos,
revisiones, reintentos y correo en `tests/`: suite Node completa **686/686**. TypeScript,
lint, build de producción, estructura y capa visual correctos. La página de seguimiento
se prerenderiza estática; sus consultas y descargas siguen siendo POST dinámicos.
PostgreSQL aislado: **154/154** mediante
`scripts/test-quejas-public-tracking-db.mjs`, con los contratos del preflight remoto,
carreras de publicación/borrado y el script de corte real. Navegador sintético:
Mis Quejas **19/19**, Configuración **17/17**, seguimiento **26/26**, Calidad **36/36**.
Escritorio y móvil 390/320 px; sin datos, sesiones ni peticiones externas reales.
Las capturas y resultados están en `.performance/`; no se publican en Vercel.

Estas pruebas sintéticas no equivalen a un benchmark de miles de registros. La
activación remota del 19 octubre tiene la evidencia separada indicada arriba.
Siguen pendientes destinatarios reales de Calidad, feriados institucionales y
aceptación del ciclo y de la entrega del enlace por sus usuarios responsables.
