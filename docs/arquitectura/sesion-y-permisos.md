# Sesión, autorización y límites de seguridad

> Referencia vigente del código y del snapshot remoto del 7 de octubre de 2026. Consultar solo el tema que se modifica; una nota histórica no demuestra el estado de un despliegue nuevo.

### Identidades y sesión

- Supabase Auth usa email/password. **`auth.users.id` se relaciona con `usuarios.auth_id`; no con `usuarios.id`.** Los responsables y autores de negocio referencian `usuarios.id`.
- `lib/auth.ts` contiene `signIn`, `signOut`, `getAppUser`. El perfil determina rol/estado; una cuenta que no sea `activo` se rechaza. El rol operativo llamado «superadmin» por el usuario es `admin`; no hay un rol `superadmin` integrado. No usar `user_metadata` editable como autorización.
- `lib/supabase.ts` usa el cliente JS estándar; el SDK administra persistencia/refresco de tokens del navegador. El store Zustand no es la autoridad de los datos. La aplicación no implementa una capa de sesión SSR con cookies HttpOnly ni un guard de páginas privadas en el proxy: las páginas prerenderizan una presentación neutra y las API validan Bearer en servidor.
- El store contiene `user`, `permisos`, `vistaActiva`, `loading`, `initialized`, `signingOut` y preferencias. `app_mis_permisos` carga permisos propios; errores producen lista vacía. `fetchPermisosByRol` es para simulación visual.

### Inicio, restauración y cierre: orden obligatorio

| Operación | Flujo real y condición para publicar contenido |
| --- | --- |
| Inicio sin credenciales | `init` se ejecuta una vez, registra listener y lee `getSession`. Sin sesión termina la inicialización y la ruta privada redirige a login |
| Restaurar una sesión | `getSession` detecta credenciales → `getUser` confirma identidad coincidente → perfil y permisos en paralelo → exigir perfil activo y revisión de sesión vigente → publicar usuario/permisos juntos |
| Login explícito | Email normalizado trim/lowercase → `signInWithPassword` → perfil activo → `getUser` y permisos en paralelo → comparar authId con resultado del login y revisión vigente → publicar → `router.replace('/')` |
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
| Login con usuario validado | Transición neutral mientras redirige a `/`; el dashboard carga sus datos después de autorizar |
| Ruta con permiso de lectura | AuthenticatedLayout y después los hijos privados |
| Ruta sin lectura | Redirigir a `/mis-quejas` o `/` únicamente si tienen lectura; transición neutral durante la redirección |
| Sin destino autorizado | Explicación estática de acceso denegado y acción Cerrar sesión; no montar módulos ni crear bucles |
| `/login` o `/q` por segmento | Contenido público al completar el bootstrap; no exige iniciar sesión para usar el formulario ciudadano |

- `SessionScreen` usa una transición neutral (solo fondo, sin barra ni animación) mientras restaura una URL privada. Login/logout/destino confirmado a login usan la silueta de login. No existe workspace global; tras validar solo se monta la carga propia del módulo solicitado. No incluye nombres, cifras, datos previos, enlaces ni controles operativos. Mensajes normales solo para lector de pantalla; tras 10 s muestra Reintentar, que recarga y vuelve a validar. No abre el panel ni agrega una espera mínima. Ver contrato visual en visual.md y ../visual-patterns.md.
- `/configuracion` y `/usuarios` conservan además guard duro `user.rol === 'admin'`, incluso al simular otro rol.
- El cierre inmediato de la UI no equivale a invalidación instantánea de todos los JWT ya emitidos. Las API actuales validan `getUser(token)` y perfil activo, sin comprobación adicional de `auth.sessions.session_id`. La duración/revocación de tokens depende de Auth; no prometer revocación universal inmediata. Fuente: [sesiones de Supabase](https://supabase.com/docs/guides/auth/sessions).

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
- `/api/drive/upload-public` es la excepción pública exacta; el endpoint valida token/folio/archivo.
- Los métodos de `lib/server/apiAuthentication.ts` validan sesión dentro del handler una sola vez: Usuarios GET/POST/PATCH/DELETE, IA analizar/test POST, configuración IA GET/PUT/POST, zona horaria GET/PUT, Drive upload POST/download GET/delete DELETE.
- Una API o un método no registrado conserva el guard completo del proxy. En ese caso, los encabezados de identidad verificados se reenvían como **request headers**, no a la respuesta del navegador.
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
| Sesión/contraseña | Email/password, rechazo de inactivos, autoservicio de contraseña y administración Auth en servidor | No hay flujo 2FA/MFA, captchaToken/reCAPTCHA/Turnstile ni bloqueo persistente propio por intentos de login en este checkout |

No se ha auditado aquí la configuración completa del servicio Auth (cuotas de login, expiraciones, restricciones de sesión o CAPTCHA del proyecto). La integración del cliente no prueba esos ajustes. Mantener cualquier configuración futura de seguridad fuera de componentes puramente visuales y verificar su enforcement en servidor/proveedor.
