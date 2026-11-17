# Acceso inicial, invitaciones y verificación de cuentas nuevas

Estado del 17 noviembre de 2026: código integrado localmente en
`codex/usuarios-acceso-seguro-20261117`, partiendo de `main` `ae77fee`.
**Backend activado con autorización expresa; cliente/API locales sin publicar en Vercel.**
Migración `20261117214855`, Edge `qms-access-mailer` v2 y Apps Script v7 activos.
Las pruebas automatizadas usan datos sintéticos; la invitación real solicitada
por el propietario se verifica por separado, sin crear cuentas adicionales de QA.
No se asignaron políticas nuevas a usuarios existentes. No confundir este trabajo con
la entrega de Agenda/Notificaciones/Correos conservada sin publicar en
`codex/expediente-agenda-por-fecha-20261116` (`2c6dbe7`, `627a785`, `5c7d2ce`).
Esa entrega no se incorpora ni se activa desde esta rama.

## Experiencia y fuentes

- `UsuarioFormModal.tsx` monta `UsuarioAccesoInicial.tsx`: dos interruptores
  independientes, azules al activar y grises al desactivar, ambos activos inicialmente.
  Cambiarlos solo modifica el formulario. Crear envía una operación UUID idempotente.
- Invitación activa: el servidor genera credencial aleatoria no expuesta y crea Auth;
  el perfil y la política se confirman juntos en DB. Se envía un enlace personal
  de 24 horas. Si falla el envío, la cuenta permanece y se ofrece **Reenviar invitación**.
  Reenviar revoca enlaces anteriores, no crea otra cuenta, y exige esperar 60 segundos.
- Invitación desactivada: el servidor genera contraseña temporal de 24 caracteres,
  visible una sola vez dentro del resultado del formulario. No se guarda en tablas
  de aplicación, caché ni correo. Auth conserva su hash, como cualquier contraseña.
  Cerrar limpia el valor local. Un reintento de operación completada no vuelve a revelarlo.
- `/acceso` permite crear/cambiar la contraseña propia (mínimo 12 caracteres) y después
  configurar la verificación requerida. Si no se requirió segundo factor, termina ahí.
  Las cuentas anteriores no reciben política nueva ni se fuerzan a configurar nada.
- Abrir la invitación con otra cuenta conectada conserva el enlace y muestra quién
  tiene la sesión abierta. Solo «Configurar acceso» canjea y cambia de identidad.
  El token se conserva en una ref de memoria antes de retirar el fragmento; así
  StrictMode puede repetir/limpiar el efecto sin perderlo. Hasta leer el enlace
  se muestra fondo neutral, sin anticipar el dashboard anterior. No almacenar el
  token en sessionStorage, logs ni caché remota.
- `UsuarioSeguridadAcceso.tsx`, en Seguridad y acceso, reenvía la invitación y pide
  confirmación explícita para restablecer 2FA de otra persona. `UsuarioAccessBadges.tsx`
  comparte estados entre tabla y tarjetas móviles: invitación pendiente/vencida,
  contraseña pendiente, 2FA pendiente, activo/desactivado. Sin política nueva indica
  **Sin cambios**, sin inventar factores ni migrar la cuenta.
- La recuperación genérica por correo y la administración general de sesiones siguen
  pendientes. Restablecer 2FA sí revoca las sesiones de la cuenta administrada.

## Dos métodos distintos, sin simular AAL2

La elección **App y correo con verificación propia** fue autorizada expresamente.

1. **Aplicación autenticadora:** enrolamiento, QR, secreto y desafío nativos de
   Supabase; la API verifica el código con Auth, valida identidad y `session_id`
   del token devuelto y solo confirma con AAL2 real y factor verificado propio.
2. **Correo alternativo:** verificación propia de ECA-QMS, vinculada a la sesión
   nativa y generación de política. Normaliza el correo y rechaza que coincida con
   el principal. El código dura diez minutos, es de un solo uso y se almacena como
   HMAC con clave privada, no en texto plano. Este método **no eleva el JWT a AAL2**.

El permiso de ECA-QMS exige prueba de sesión para ambos métodos; en TOTP exige
además `aal2`. No cambiar este contrato a una comprobación universal `aal='aal2'`,
porque excluiría el método de correo aprobado. Tampoco aceptar `aal1` sin prueba.
Referencia del proveedor: [MFA de Supabase](https://supabase.com/docs/guides/auth/auth-mfa).

En futuros inicios se pide el factor elegido. El correo se envía automáticamente
al abrir la verificación y se muestra parcialmente oculto. Cinco códigos erróneos
consecutivos bloquean diez minutos; contadores y bloqueo están en DB y sobreviven
al cambio de instancia o sesión. Solicitar otro correo tiene espera de 60 segundos
y máximo cinco en quince minutos. Auth conserva también sus propios límites TOTP.
La prueba propia vence a las doce horas y exige otra verificación.

## Autorización y persistencia

Fuentes: `lib/server/accessIdentity.ts`, `accessService.ts`,
`lib/services/accessClient.ts`, `lib/types/access.ts`, `lib/auth.ts`,
`lib/store/auth-store.ts`, `lib/authRoute.ts`, `AuthShell.tsx`.

- `GET/POST /api/auth/acceso` valida Bearer con Auth y claims de sesión; puede
  consultar la política antes de autorizar datos privados. Su RPC vuelve a exigir
  perfil activo. No recibe identidad, AAL ni estado de verificación desde el JSON.
- `POST /api/public/acceso/invitacion` es la excepción pública exacta del proxy.
  Exige origen permitido y confirmación POST: abrir el enlace no lo consume.
  El token de 32 bytes viaja en fragmento, se retira del historial y en DB solo
  persiste su SHA-256. Canjea una sola vez mediante recovery de cuenta existente;
  no usa magiclink con alta implícita ni envía contraseña. Una interrupción posterior
  al consumo requiere reenviar otra invitación.
- `POST /api/usuarios/acceso` exige administrador real activo y acceso completo.
  Reset propio y reset sin confirmación se rechazan antes de los efectos.
- El guard cliente no monta pantallas ni carga permisos/perfil operativo mientras
  el acceso esté pendiente. Los eventos Auth y refresh vuelven a comprobar cuentas
  con política; las respuestas tardías no restauran una sesión cerrada.
- La migración `20261117214855_usuarios_acceso_inicial_mfa.sql` crea seis tablas
  privadas con RLS y sin grants directos a clientes ni service role. El RPC
  `qms_access_command` y los puentes de canje/transporte son exclusivamente service role.
- `qms_access_allowed()` no concede roles: añade un requisito restrictivo a las
  policies existentes de las tablas públicas con RLS. Storage pertenece al rol del
  proveedor: su única policy vigente usa `app_es_staff`/`app_usuario_actual_id`,
  cuyos contratos/ACL se conservan y se añade este requisito. No se crean policies
  en tablas del proveedor ni se asume permiso de `postgres` sobre ellas.
  **Toda futura tabla protegida debe conservar este requisito.** Las vistas deben
  continuar como invoker. Los permisos por módulo siguen siendo independientes.
- El pre-request `qms_check_access_request` bloquea también RPC definer antiguos
  para identidades pendientes. La migración se detiene si existe otro pre-request
  incompatible; nunca lo sustituye silenciosamente.
- Reset incrementa generación, elimina pruebas/desafíos, revoca `auth.sessions`,
  borra factores nativos mediante Admin API y finalmente limpia el método propio.
  Conserva `require_mfa`. Si falla el proveedor, queda `reset_pending`, protegido,
  y otro intento explícito puede terminarlo. No afirma revocación universal fuera
  de ECA-QMS para cuentas sin esta política.
- Editar correo principal invalida invitaciones previas y rechaza igualarlo al
  alternativo. La API comprueba antes de actualizar Auth y DB mantiene el invariante.
  La creación reservada recupera solo Auth con `app_metadata.qms_creation_id`
  correspondiente, nunca adopta una cuenta encontrada solo por correo.

La activación verificó seis tablas privadas con RLS, 52 policies restrictivas,
RPC sin EXECUTE para anon/authenticated, pre-request configurado y acceso permitido
a las dos cuentas activas anteriores. Al aplicar había cero políticas de cuentas
nuevas; no hubo backfill. No se leyeron sesiones ni factores de personas reales.

## Transporte de correo

`supabase/functions/qms-access-mailer/index.ts` es un servicio de máquina separado
de la cola de Quejas. Solo acepta service role/secret key: el RPC service-only
`qms_access_mail_transport` valida la credencial contra el propio proveedor, sin
confiar en un `role` decodificado ni comparar JWT con una copia distinta del runtime.
Acepta clave nueva en `apikey` y JWT anterior en Bearer. Una sesión normal o un JWT
falsificado no tienen EXECUTE. La lectura ya necesaria de transporte sirve también
de autorización, sin una consulta adicional. Usa el endpoint del
emisor existente y HMAC con propósitos exclusivos `access_delivery_request` y
`access_delivery_receipt`. Valida origen de invitación, formato, límites de bytes,
destino Google Script y recibo firmado enlazado al evento/nonce. No registra cuerpos,
códigos, credenciales ni destinatarios. `integration/apps-script/quejas-mail/Acceso.gs`
envía dos plantillas ECA: invitación y código; no modifica los ocho correos de Quejas.

El diario temporal del emisor guarda HMAC y resultado; un envío incierto no se
reintenta automáticamente. El código solo se habilita tras recibo de envío confirmado.
Las cuotas de Google, disponibilidad de red, caducidad/evicción de CacheService y
clasificación del buzón impiden prometer entrega universal o exactamente una copia.

Usa nombres de configuración existentes, nunca guardar valores en documentación:
`PUBLIC_TRACKING_ORIGIN` en web y Edge, `QMS_PUBLIC_TRACKING_ORIGIN` en Apps Script,
`QUEJAS_MAIL_SIGNING_SECRET` en Edge y `QMS_MAIL_SECRET` en Apps Script, además de
las claves Supabase del runtime y la configuración privada de transporte ya existente.

En desarrollo, una solicitud de origen exacto `http://localhost:3000` o
`http://127.0.0.1:3000` genera enlace a ese mismo entorno y añade `local:true` al
mensaje firmado. Edge y Apps Script rechazan otros hosts/puertos; el correo advierte
que debe abrirse en la misma computadora. No requiere el origen público de Edge
para esta excepción. Fuera de desarrollo se exige el origen HTTPS configurado,
aunque el request intente presentar localhost como Host.

## Activación y aceptación

El propietario autorizó **solo el backend de acceso**, para probar en localhost:

- Migración aplicada con versión real `20261117214855`, sin seeds ni backfill.
- Edge v2 activa, `verify_jwt=false` y autorización service-only comprobada.
- Apps Script v7 deriva de la versión publicada v6: conserva los demás archivos y
  funciones, modifica solo el despacho `doPost` y añade `Acceso`. HEAD y versión
  publicada coinciden. La cola de Quejas conserva Edge v19.
- La primera creación real solicitada confirmó una sola cuenta Auth/perfil y la
  opción sin segundo factor. El envío falló por rechazo 401 de la credencial del
  servidor en Edge v1; se corrigió en v2. No se elimina/recrea la cuenta: se reenvía
  desde Seguridad y acceso. El propietario confirmó recepción y canje reales hasta
  la pantalla «Creá tu contraseña». Una sola cuenta Auth/perfil; el enlace se
  consumió con POST. La contraseña propia la define el usuario.
- Se corrigió además el replay de efectos de desarrollo: con admin conectado, el
  primer cleanup perdía el fragmento antes de conservarlo y enviaba al dashboard.
  La invitación ahora tiene precedencia y requiere confirmación explícita de cambio.
- Vercel no se publicó. Antes de usar invitaciones públicas, publicar cliente/API
  compatibles y comprobar SHA del alias, con autorización expresa independiente.
  Mantener sin activar la entrega anterior de Agenda/Notificaciones.

Evidencia saneada: `supabase/backups/usuarios_acceso_activacion_20261117.json`.
El asesor de DB informa RLS sin policies en las tablas privadas: es el cierre
intencional sin grants, accesible solo desde los RPC privilegiados. Los helpers
definer públicos solo consultan la identidad actual y conservan autorización propia;
no son los RPC administrativos. Ver [regla del asesor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Verificación ejecutada

- 104 pruebas focalizadas de Usuarios, Auth, API y correo, incluyendo bloqueo de
  perfil/permisos mientras falta verificación y descarte de respuestas tras logout.
- 68 comprobaciones PostgreSQL 18 temporal: permisos/RLS, inmutabilidad de usuarios
  anteriores, idempotencia, canje único, códigos, bloqueo, sesión, AAL2 TOTP y reset.
- 14 comprobaciones en Chrome sin red externa, componentes y CSS reales, servicios
  sintéticos, anchos 1440/390/320: interruptores, alta manual, reenvío, confirmación,
  contraseña, correo, error/corrección de código y navegación de acceso.
- Build, TypeScript, estructura y capa visual correctos; lint sin errores (dos
  advertencias previas en componentes ajenos). Suite global: 1076 pruebas,
  1041 correctas y los mismos 35 fallos del baseline de `main`, sin fallos nuevos.
  Las pruebas sintéticas no equivalen a correo recibido ni login de producción.

Activación: 21 pruebas focalizadas de acceso/correo y 71 comprobaciones PostgreSQL
aisladas, incluido rechazo de credencial falsa y compatibilidad con claves distintas
del runtime; TypeScript de Edge correcto.
El sondeo real sin mensaje confirmó autorización del servidor por RPC y rechazo de
solicitudes anónimas; no envía invitaciones ficticias. El recibo firmado confirma
aceptación por el emisor, no garantiza clasificación en la bandeja del destinatario.

Corrección de apertura: cinco regresiones Node (StrictMode, sesión previa, doble
canje, enlace vencido y logout concurrente) y 38 comprobaciones en Chrome aislado
con StrictMode, AuthShell y QueryProvider reales, Auth sintético, 1440/390px.
55 regresiones de Usuarios/Auth, TypeScript, lint focalizado, build de Next y
comprobaciones de estructura/capa visual correctos. La recepción
y pantalla de contraseña sí fueron confirmadas por el propietario; enrolamiento
TOTP/correo, nuevo inicio y reset todavía requieren aceptación real separada.

Archivos de prueba: `tests/usuarios-acceso-seguro.test.mjs`,
`tests/usuarios-acceso-mail.test.mjs`, `tests/auth-visibility.test.mjs` y suites
de Usuarios; `scripts/test-usuarios-acceso-db.mjs`. Los artefactos ignorados de
la sesión están bajo `.performance/access-*` y no contienen secretos reales.
