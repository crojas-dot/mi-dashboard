# Sesión, autorización y límites de seguridad

> Contrato vigente de acceso, sesión y administración al 23 de noviembre de 2026. Sustituye las reglas de acceso de los días 15, 17 y 21. Evidencia y despliegue: [verificación y pendientes](verificacion-y-pendientes.md).

### Identidades y sesión

- Supabase Auth usa email/password. **`auth.users.id` se relaciona con `usuarios.auth_id`; no con `usuarios.id`.** Los responsables y autores de negocio referencian `usuarios.id`.
- `lib/auth.ts` contiene `signIn`, `signOut`, `getAppUser`. El perfil determina rol/estado; una cuenta que no sea `activo` se rechaza. El rol operativo llamado «superadmin» por el usuario es `admin`; no hay un rol `superadmin` integrado. No usar `user_metadata` editable como autorización.
- `lib/supabase.ts` usa el cliente JS estándar; el SDK administra persistencia/refresco de tokens del navegador. El store Zustand no es la autoridad de los datos. La aplicación no implementa una capa de sesión SSR con cookies HttpOnly ni un guard de páginas privadas en el proxy: las páginas prerenderizan una presentación neutra y las API validan Bearer en servidor.
- El store contiene `user`, `permisos`, `vistaActiva`, `loading`, `initialized`, `signingOut` y preferencias. `app_mis_permisos` carga permisos propios; errores producen lista vacía. `fetchPermisosByRol` es para simulación visual.

### Inicio, restauración y cierre: orden obligatorio

| Operación | Flujo real y condición para publicar contenido |
| --- | --- |
| Inicio sin credenciales | `init` se ejecuta una vez, registra listener y lee `getSession`. Sin sesión termina la inicialización y la ruta privada redirige a login |
| Restaurar una sesión | `getSession` detecta credenciales → `getUser` confirma identidad coincidente → perfil y permisos en paralelo → exigir perfil activo, estado de acceso ready y revisión de sesión vigente → publicar usuario/permisos juntos |
| Login explícito | Email normalizado trim/lowercase → `signInWithPassword` → perfil activo → `getUser` y permisos en paralelo → comparar authId y revisión vigente, comprobar `fetchAccessStatus()` → publicar inmediatamente si ready, incluso con clave temporal; si no ready, `/acceso` |
| Evento de Auth | Callback síncrono, sin esperar otras llamadas SDK. Ignora INITIAL_SESSION porque init ya tiene lector; difiere resolución con setTimeout(0) para salir del bloqueo de Auth |
| Refresh/foco de la misma identidad | SIGNED_IN/TOKEN_REFRESHED no reinician permisos, vista o caché si el usuario ya está resuelto |
| Cambio de identidad / SIGNED_OUT | Incrementar revisión y retirar perfil anterior. Descartar respuestas tardías de identidad, perfil, permisos, login y vista; el nuevo usuario se publica solo al resolver sus comprobaciones |
| Logout | Marcar cierre pendiente → incrementar revisión y retirar user/permisos/vista inmediatamente → desmontar ámbito privado de caché → esperar `signOut` → finalizar estado cerrado |
| Recarga durante logout | Detectar marca antes de leer getSession y continuar cerrando. Los eventos automáticos no pueden restaurar el perfil anterior |

`lib/authLogoutIntent.ts` guarda solo `qms:logout-pending=true` en sessionStorage por pestaña, además del bloqueo en memoria: no guarda tokens ni identidad. Un cierre inesperadamente fallido conserva la marca; completar logout o un login explícito confirmado la retira. Si Storage no está disponible, el bloqueo en memoria solo protege el documento actual. Un login no se inicia mientras el cierre está en curso.

### Decisión de ruta y presentación de sesión

`AuthShell` consume `authRoute`; la redirección es asíncrona y **la decisión de render debe bloquear también la espera de `router.replace`**. Nunca devolver los hijos privados porque todavía no existe user. Esto evita el dashboard desnudo antes de login y al salir.

| Estado | Qué se monta |
| --- | --- |
| No inicializado / loading | Transición neutral en URL privada, también en HTML inicial; login solo en su URL o durante cierre. No anticipar ningún módulo |
| Ruta privada sin usuario | Skeleton de login mientras redirige a `/login` |
| Login con usuario validado y acceso ready | Transición neutral mientras redirige a `/`; el dashboard carga sus datos después de autorizar |
| Sesión con acceso no ready | `/acceso` para 2FA, vencimiento o canje legacy; no montar módulos privados |
| Ruta con permiso de lectura | AuthenticatedLayout y después los hijos privados |
| Ruta sin lectura | Redirigir a `/mis-quejas` o `/` únicamente si tienen lectura; transición neutral durante la redirección |
| Sin destino autorizado | Explicación estática de acceso denegado y acción Cerrar sesión; no montar módulos ni crear bucles |
| `/login` o `/q` por segmento | Contenido público al completar el bootstrap; no exige iniciar sesión para usar el formulario ciudadano |

- `SessionScreen` usa una transición neutral (solo fondo, sin barra ni animación) mientras restaura una URL privada. Login/logout/destino confirmado a login usan la silueta de login. No existe workspace global; tras validar solo se monta la carga propia del módulo solicitado. No incluye nombres, cifras, datos previos, enlaces ni controles operativos. Mensajes normales solo para lector de pantalla; tras 10 s muestra Reintentar, que recarga y vuelve a validar. No abre el panel ni agrega una espera mínima. Ver contrato visual en visual.md y ../visual-patterns.md.
- `/configuracion` y `/usuarios` conservan además guard duro `user.rol === 'admin'`, incluso al simular otro rol.
- El cierre inmediato de la UI no equivale a invalidación instantánea de todos los JWT ya emitidos. Los guards de acceso comprueban identidad, perfil y requisitos de sesión/2FA; no prometer revocación universal inmediata de JWT. Fuente: [sesiones de Supabase](https://supabase.com/docs/guides/auth/sessions).

### Permisos de presentación

- `permisos` tiene PK `(rol, modulo)`, columnas `leer` y `escribir`.
- Módulos de ruta: `dashboard`, `quejas`, `mis_quejas`, `documentos`, `sacp`, `riesgos`, `auditorias`, `revision`, `procesos`, `usuarios`, `configuracion`, `reporteria`.
- `tienePermiso` exige lectura y, cuando se solicita, escritura. Su excepción explícita de admin es **Configuración**; no asumir que el helper frontend concede todos los módulos a admin.
- Sidebar filtra enlaces con esos permisos. No todas las páginas ocultan sus botones de escritura cuando `escribir=false`; una operación puede terminar rechazada por RLS.
- Roles con etiquetas/colores en `lib/constants/roles.ts`: admin, calidad, colaborador, coordinador, revisor, usuario. Las comprobaciones operativas de las API de Usuarios y del workflow reconocen principalmente admin/calidad/colaborador; no confundir los seis rótulos con seis roles completamente implementados.
- `setVistaActiva` cambia permisos visibles y el ámbito de caché, no el usuario de Auth ni el rol de DB. No usar esa simulación para ampliar privilegios.
- Los roles de Postgres `anon`/`authenticated`/`service_role` y los roles operativos del perfil son capas distintas. El backend y los RPC resuelven el perfil real; «authenticated» por sí solo no significa admin ni autorización para todos los módulos.

### Autenticación y autorización de API

- `getAuthToken` lee Bearer. `getCurrentUser` valida con `auth.getUser(token)`, consulta `usuarios` por `auth_id`, exige `estado='activo'` y devuelve `{id, auth_id, rol, email}`.
- `proxy.ts` cubre `/api/:path*`, elimina `x-user-id`, `x-user-role`, `x-user-email` aportados por el cliente y devuelve 401 sin Bearer en API privadas.
- Los métodos públicos son excepciones exactas por ruta/método (gateway de formularios, seguimiento, canje legacy y GET de identidad); cada handler valida sus capacidades y límites. No abrir prefijos completos.
- Los métodos de `lib/server/apiAuthentication.ts` validan sesión dentro del handler una sola vez: Usuarios GET/POST/PATCH/DELETE, IA analizar/test POST, configuración IA GET/PUT/POST, zona horaria GET/PUT, Drive upload POST/download GET/delete DELETE.
- Una API o un método no registrado en `API_WITH_ROUTE_AUTH` conserva el guard completo del proxy. En ese caso, los encabezados de identidad verificados se reenvían como **request headers**, no a la respuesta del navegador.
- Los handlers registrados no confían en encabezados de identidad. No quitar su guard por asumir que el proxy ya consultó Auth.
- `checkModuleAccess(usuariosId, rolReal, modulo, requireWrite)` es un helper server-only disponible: compara perfil activo/rol real, permite admin y consulta permisos con lectura antes de escritura. No está aplicado como middleware universal de todos los endpoints.
- Los endpoints con service role deben autorizar explícitamente usuario/rol/entidad: service role evita RLS y no sustituye la validación del llamador.

### Protección implementada y límites de acceso

| Capa | Implementado hoy | Alcance que no debe atribuirse a esa capa |
| --- | --- | --- |
| Guard cliente | Bloqueo de montaje, permisos de lectura, transición neutra y aislamiento entre sesiones | No autoriza una solicitud directa al Data API o a una API |
| API privadas | Bearer validado por Auth, perfil activo, roles/entidad según handler; identidad falsificada por headers descartada | `checkModuleAccess` no está integrado universalmente |
| RPC versionados de quejas | Staff/responsable real, revisión esperada, bloqueo/transición en DB | No conceder EXECUTE legacy ni reintentar con una revisión nueva para forzar un cambio |
| RLS/ACL | Reglas por fila, columnas protegidas, vistas invoker y RPC internos cerrados | 33/33 con RLS no demuestra políticas estrictas en todas las áreas |
| Rate limit propio | Por IP y scope en API seleccionadas, limpieza cada 30 s y máximo 10 000 entradas en memoria | No es distribuido entre instancias Vercel; no cubre el endpoint de login externo de Supabase |
| Sesión/contraseña | Acceso temporal, gracia, cambio diferido, 2FA opcional y canje legacy; cliente/API/DB integrados | Correo propio no equivale a AAL2; sin CAPTCHA ni bloqueo persistente propio del login Supabase; falta aceptación E2E |

## Acceso temporal y 2FA — contrato único vigente

- **Alta de usuarios:** `UsuarioFormModal.tsx` crea mediante un solo `POST`
  con `access: { id, invite:false, requireMfa, sendByEmail }`. Las casillas
  de envío por correo y 2FA son independientes: correo activado y 2FA
  desactivado por defecto. `lib/server/usuarioInput.ts` valida la entrada.
  El servidor genera una contraseña temporal aleatoria de **24 caracteres**;
  con correo activado **nunca** se retorna al administrador. Solo si este
  desactiva expresamente el envío, se muestra al admin autorizado **una vez**
  para entrega manual, con copia, y se elimina del estado al cerrar.
  Un fallo del correo no deshace la cuenta creada; no repetir el alta.
- **Plazo real y seguridad:** contraseña temporal válida durante **3 días
  hábiles** desde la emisión, contando lunes a viernes en zona
  `America/Costa_Rica`, conservando la hora. El cálculo
  `qms_private.three_business_days_after` no incorpora feriados
  institucionales adicionales. Migración aplicada:
  `supabase/migrations/20261123153151_acceso_temporal_tres_dias_habiles_20261123.sql`.
  `temporary_password_issued_at` y `temporary_password_expires_at` están
  en `qms_private.access_policies`. `access_ready`, `access_summary`,
  `qms_temporary_access_command`, `qms_access_command` y el trigger de
  contraseña hacen cumplir plazo, sesión posterior a emisión, perfil activo
  y 2FA cuando procede. Verificado en DB remota el 23 noviembre. Al vencer,
  el servidor/RLS bloquea el acceso y se requiere restablecimiento por admin:
  no hacer desbloqueo meramente visual ni crear recuperación pública.
- **Inicio de sesión sin esperas artificiales:** `lib/auth.ts` comprueba
  `fetchAccessStatus()`; `lib/store/auth-store.ts` publica usuario y
  permisos **en la misma operación de login** si `phase==='ready'`, incluso
  cuando `temporaryPassword===true`. La condición correcta para enviar a
  `/acceso` es `result.access && result.access.phase !== 'ready'`.
  No enviar al usuario autorizado a la pantalla de «Creá tu nueva contraseña»
  ni depender de un evento posterior de Auth para terminar de entrar.
  `lib/authRoute.ts` y `AuthShell` mantienen el guard en sesión, login y
  rutas privadas; `/acceso` sigue sirviendo **2FA pendiente, acceso temporal
  vencido y canje de invitaciones heredadas**. Conservar verificación de
  identidad remota, permisos, revisión de sesión, revocación/cierre y RLS.
- **Cambio diferido desde Mi perfil:** mientras la clave temporal esté vigente,
  permitir trabajar normalmente y mostrar en `components/Header.tsx` un
  aviso no bloqueante con vencimiento y acciones «Cambiar en Mi perfil» y
  «Más tarde». El acceso a `components/perfil/MiPerfilModal.tsx` abre
  `Seguridad`. El titular puede escribir una **segunda contraseña** o
  generarla con `generatePassword(20)` (Web Crypto); el generador llena
  contraseña y confirmación, ofrece **ojo para mostrar/ocultar** y botón
  **Copiar contraseña** para guardarla antes de pulsar Actualizar.
  Para sustituir una temporal: mínimo **12 caracteres**, máximo **72 bytes**,
  distinta de la anterior, `POST /api/auth/acceso` con
  `{action:'password',password,confirmation}` y operación correlacionada.
  No usar el cambio genérico de Supabase Auth para esa primera sustitución.
  Al completarla, `refreshAccess()` retira el aviso. Para una contraseña
  ordinaria, el perfil conserva su ruta existente y mínimo de 8 caracteres.
  «Más tarde» solo oculta el aviso, **no** prorroga el vencimiento.
  Corrección de estado: el aviso se reinicia por identidad en `Header.tsx`; en
  `UsuarioSeguridadAcceso.tsx` se limpia la clave manual al cambiar cuenta
  o visita y se descartan respuestas tardías mediante `manualVisit`.
  Conservar estas garantías; las pruebas generales de acceso siguen pendientes.
- **2FA independiente:** si `requireMfa=true`, mantener enrolamiento y
  verificación en `/acceso`, incluso durante la gracia. TOTP nativo requiere
  AAL2 real; OTP alternativo por correo no debe fingir AAL2. No suprimir
  factor, políticas ni guards al facilitar el primer ingreso.
- **Reenvío, idempotencia y cuentas legacy:** conservar estados
  `sent/failed/uncertain`; nunca marcar `uncertain` como éxito ni reenviar
  automáticamente. Un reenvío/reset autorizado gira la contraseña temporal
  e invalida la anterior; evitar recrear usuarios ya creados. Invitaciones
  heredadas siguen con token personal de 24 horas, canje y reenvío separados;
  no migrar masivamente ni cambiar contraseñas heredadas en silencio. Reset
  2FA requiere admin y confirmación.
- **Emisor y destinos separados:** Next API → Supabase Edge
  `qms-access-mailer` **v5 ACTIVE** → Google Apps Script → MailApp;
  `qms_private.mail_wake_settings.access_endpoint` almacena el destino

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

- `/acceso` no es un módulo de negocio ni concede permisos. Sus RPC de
  bootstrap son service-only, con identidad verificada; el canje público
  acepta únicamente POST de invitación con origen y token personal de un uso.
  El token legacy se mantiene en memoria, sin redirigir al usuario previamente
  conectado. No aplicar políticas retroactivas a cuentas anteriores.
- Para transportes, plantillas y versión de Apps Script consultar
  [integraciones](integraciones.md); para migraciones y ACL,
  [base de datos](base-de-datos.md). La evidencia está en
  [verificación y pendientes](verificacion-y-pendientes.md).

## Administración de Usuarios

- `/usuarios` exige admin real. GET de API admite admin/Calidad para el
  directorio de responsables; POST/PATCH/DELETE y operaciones de acceso
  son de admin. Validar rol, estado, UUID, tipos y perfil antes de efectos.
  Impedir auto-desactivación, auto-cambio de rol y auto-borrado. El control
  de último admin en operaciones ordinarias no es una transacción distribuida.
- Alta con un solo POST y acceso temporal como se describe arriba; no
  repetir una cuenta creada por fallo del correo o del refresco. Conservar
  los estados y las confirmaciones de entrega. Gestión conserva FormData
  de perfil entre pestañas Detalles del perfil y Seguridad y acceso; la
  zona de peligro exige confirmación en el mismo diálogo.
- Seguridad actual usa `UsuarioSeguridadAcceso.tsx` y
  `gestionarAccesoUsuario` (POST `/api/usuarios/acceso`, authId, action,
  confirm): resend, reset, manual y reset_mfa. La entrega manual genera
  en servidor una temporal, solo si se autoriza expresamente, y la limpia
  al cambiar de visita/cuenta. «Restablecer contraseña» en el menú abre
  Seguridad del mismo modal. No restaurar el editor histórico
  `PATCH newPassword` como diseño de acceso de nuevas altas. El PATCH
  de perfil/contraseña existente conserva validaciones y compatibilidad;
  no enviar UPDATE vacío cuando solo cambia la contraseña.
- `PasswordModal` y `ResetPasswordModal` son legacy sin montaje en Usuarios.
  Los cambios de clave del titular se realizan desde Mi perfil según su
  política vigente, no mediante service role en navegador.
- Roles y permisos viven en Usuarios (RolesAccesos), no Configuración.
  `usePermisos` / `useActualizarPermiso` conservan leer/escribir,
  lectura antes de escritura y guardado real; no simular privilegios.
  `useOperationLock` impide dobles escrituras; no cerrar/regenerar
  durante una operación ni repetir una escritura confirmada.
- API normaliza email, conserva los caracteres de la contraseña y valida
  antes de escribir. Alta Auth+perfil compensa si falla el INSERT;
  no asumir una transacción distribuida entre Auth y DB.

### Borrado recuperable

**Contrato de borrado:** nunca borrar
físicamente `usuarios` ni sus referencias de expedientes después de eliminar Auth.
Usar `usuarioDeletion.ts` y el intento durable `qms_delete_user_account`: suspender,
eliminar/confirmar ausencia de Auth por ID, finalizar con `eliminado_en` y retiro
del directorio. Conservar nombre/ID histórico; liberar email con dirección interna.
No llamar `deleteUser(null)`, no borrar relaciones ni recrear Auth como compensación.
GET/PATCH excluyen retirados; inactivos normales siguen administrables. RPC cerrado
a clientes, cuenta propia prohibida y último admin protegido. La migración
20261117212024 está aplicada; esta corrección no activa invitaciones/MFA.
[Contrato y evidencia](../usuarios-eliminacion-2026-11-17.md).

No se ha auditado aquí la configuración completa del servicio Auth (cuotas de login, expiraciones, restricciones de sesión o CAPTCHA del proyecto). La integración del cliente no prueba esos ajustes. Mantener cualquier configuración futura de seguridad fuera de componentes puramente visuales y verificar su enforcement en servidor/proveedor.
