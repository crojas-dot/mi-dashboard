# Eliminación de cuentas con trazabilidad — 17 noviembre

## Corrección

El DELETE anterior llamaba primero a `auth.admin.deleteUser` y después intentaba
borrar físicamente `usuarios`. Las relaciones de responsable, autor y actividad
impedían el segundo paso: Auth ya no existía, el perfil seguía visible y un nuevo
intento terminaba llamando a `deleteUser(null)`. El usuario veía un error genérico.

La baja retira la cuenta de acceso y el directorio, conservando la identidad interna
necesaria para leer los expedientes. No borra quejas, historial, notas, adjuntos,
responsabilidades históricas ni otros módulos; tampoco convierte sus FK en CASCADE.

Fuentes: `app/api/usuarios/route.ts`, `lib/server/usuarioDeletion.ts`,
`components/usuarios/UsuarioFormModal.tsx` y migración
`20261117212024_usuarios_eliminacion_con_trazabilidad.sql`.

## Contrato

1. DELETE valida Bearer, perfil activo, administrador real e ID. El RPC service-only
   vuelve a comprobar al administrador y prohíbe la propia cuenta.
2. `qms_delete_user_account(...,'begin')` suspende el perfil y reserva un intento
   durable en `qms_private.usuario_eliminaciones`. Un reintento recupera ese mismo
   intento, sin crear ni borrar otra identidad. Las bajas concurrentes se serializan
   para proteger el último administrador activo.
3. La API elimina el Auth capturado. Si ya era null, omite la llamada. Ante fallo
   o timeout solo continúa cuando Admin API confirma `user_not_found` para ese ID;
   nunca consulta por email para decidir qué cuenta borrar.
4. `finish` exige el intento correcto, verifica que Auth ya no exista y conserva el
   perfil con `eliminado_en`, `estado='inactivo'` y `auth_id=null`. Libera el correo
   único con una dirección interna no entregable y retira teléfono/avatar/avisos.
   El nombre permanece para identificar al autor histórico.
5. GET del directorio y PATCH excluyen `eliminado_en`. Un perfil inactivo normal
   continúa visible y administrable. La baja no puede reactivarse desde ese panel.
6. Si el proveedor o el último paso fallan, queda sin acceso, pendiente de completar;
   otro intento explícito puede terminarlo. No se restaura acceso silenciosamente,
   no se repite la operación automáticamente y no se borran relaciones para forzarla.

El primer uso posterior de un email liberado crea otra identidad; no recupera
permisos, documentos ni autoría de la persona anterior. La baja de una cuenta no
equivale al borrado legal de todo documento histórico que mencione a esa persona.

## Estado y evidencia

- La migración aditiva se aplicó en Supabase como **20261117212024**, nombre
  `usuarios_eliminacion_con_trazabilidad`. El archivo se preparó mediante CLI y
  se alineó después con la versión asignada por MCP para no desincronizar historial.
- Verificados `eliminado_en`, RLS privada, EXECUTE exclusivo de service role y
  ausencia de permiso cliente para actualizar la marca. No se ampliaron grants de
  usuarios ni se ejecutó una limpieza masiva de perfiles huérfanos.
- El aviso informativo [RLS enabled no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
  corresponde al cierre intencional de la tabla privada: no tiene acceso directo
  cliente ni service role. La operación pasa exclusivamente por el RPC autorizado.
- 33 comprobaciones en PostgreSQL temporal: privilegios, cuenta propia, reintentos,
  Auth pendiente, perfil huérfano, conservación de relaciones, nuevo ID al reutilizar
  email y protección administrativa. No se borraron cuentas reales para QA.
- Pruebas Node de servicio/API/directorio y regresiones de Usuarios correctas;
  TypeScript correcto y lint sin errores nuevos. Fuentes:
  `tests/usuarios-deletion.test.mjs`, suites de Usuarios y
  `scripts/test-usuarios-borrado-db.mjs`.

Cliente/API disponibles en el checkout local; no se publicó una nueva web Vercel.
Esta corrección no activa la migración pendiente de invitaciones/MFA, ni Agenda,
Notificaciones o los correos preparados en otra entrega.
