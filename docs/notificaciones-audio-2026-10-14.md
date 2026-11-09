# Sonido de notificaciones — 14 de octubre de 2026

## Revisión local del 3 noviembre

El servicio recupera audio suspendido o cargado después de un gesto cuando
`userActivation.hasBeenActive` lo permite. La campana incorpora Activar y probar
sonido. No cambia la línea base, IndexedDB ni preferencias. Ver
[implementación y evidencia](quejas-claridad-y-acuse-2026-11-03.md); sin publicar,
sin aceptación del volumen/permiso real del equipo.

## Corrección del 19 de octubre

El guard de visibilidad descartaba avisos nuevos cuando el panel quedaba en segundo
plano (por ejemplo, al enviar el formulario desde otra pestaña). Esos IDs ya se habían
consumido y volver al panel no los hacía sonar. Se permite audio en segundo plano con
sesión y preferencias vigentes, conservando el reclamo IndexedDB entre pestañas.

El hook prepara el MP3 **antes** de reclamar: exige AudioContext ya habilitado por
un gesto y buffer disponible. Una pestaña bloqueada por autoplay o una descarga
fallida no puede consumir el reclamo de otra que sí tenga audio. Los errores de
descarga no permanecen en caché durante toda la sesión. No se espera un gesto futuro
para reproducir una cola de avisos atrasados ni se añade polling/timers/red remota.

Verificación: **42/42** pruebas de sonido, fiabilidad y menú; **16/16** comprobaciones
en Chrome temporal con dos páginas, AudioContext, decodificación del MP3 e IndexedDB
nativos. La visibilidad oculta se simula explícitamente y la salida está silenciada;
no certifica el volumen/permiso de cada dispositivo. Evidencia reproducible en
`.performance/audio-background-20261019/run.mjs` y `evidence.json`. No hubo sesión real,
correos ni peticiones al backend. TypeScript, lint focalizado y build correctos.
La corrección quedó publicada el 19 octubre en `dpl_2kk83rkgKrip1MwK8NNbMcw2d2MF`.
La evidencia sintética no sustituye comprobar permiso/volumen en el dispositivo del usuario.

Cambio local de presentación; no añade notificaciones de negocio, correo, push ni un
servicio que permanezca activo con la aplicación cerrada. La campana conserva sus
lecturas, preferencias, Realtime y polling existentes. Los avisos con la aplicación
cerrada requieren su canal de correo independiente.

## Contrato

- `components/Header.tsx` entrega identidad, éxito de la consulta, preferencias y
  notificaciones a `lib/hooks/useNotificationSound.ts`.
- La primera consulta correcta por identidad/montaje establece una línea base
  silenciosa. Una consulta pendiente vacía no cuenta como esa primera lectura.
- Se detectan IDs nuevos sin leer, independientemente del conteo total. Leer un aviso
  y recibir otro simultáneamente sigue generando un sonido. Un lote emite uno solo.
- Desactivar/reactivar preferencias consume lo acumulado sin reproducirlo. La sesión
  viva, las preferencias, el audio disponible y la visita se comprueban antes del reclamo
  y de la reproducción; logout/desmontaje/cambio de identidad invalidan la espera.
- `lib/services/sonidosNotificacion.ts` prepara audio automático sin intentar desbloquearlo;
  comprueba vigencia después de cargar/decodificar y justo antes de emitir. La previsualización
  manual conserva su contrato. No hay recursos remotos ni esperas artificiales.

## Coordinación entre pestañas

`lib/utils/notificationSound.ts` confirma el reclamo mediante una transacción
IndexedDB `readwrite` en el origen local antes de emitir sonido. El motor de
IndexedDB serializa transacciones concurrentes del mismo almacén entre renderers.
La transacción no permanece abierta mientras se carga o reproduce el audio.

La base local `qms-notification-sound`, almacén `claims`, usa el ID de usuario como
clave y guarda únicamente pares de ID de notificación/fecha. Conserva como máximo
128 marcas por usuario; las marcas de más de 24 horas se descartan al reclamar.
Un margen futuro máximo de un minuto tolera pequeños desfases de reloj. Un lote
mayor también cabe en un único reclamo. No contiene mensajes, nombres, direcciones,
tokens ni credenciales. No hay espejo en localStorage ni migración en Supabase.

Se descartó localStorage bajo Web Locks: la prueba con dos renderers mostró que
la segunda pestaña podía leer su copia anterior antes de recibir la actualización,
aunque el Web Lock fuera compartido. No se añadió una espera para ocultar esa carrera.

Si IndexedDB no existe, falla o está bloqueado, se omite el sonido automático. La
campana, el correo y la previsualización manual siguen sus contratos. El foco de una
ventana no se usa como sustituto de una exclusión atómica. Tampoco se garantiza
autoplay sin un gesto previo permitido por el navegador.

## Verificación inicial del 14 de octubre

- `tests/notification-sound.test.mjs`: 19 casos de línea base, IDs/lotes, preferencias,
  identidad, almacenamiento, retención, reloj, guards y espera de decodificación.
- Junto con `notification-reliability` y `header-menu-focus`: 36/36 casos.
- QA Chromium temporal con datos ficticios, sin sesión real y red externa bloqueada:
  13 comprobaciones, dos páginas del mismo origen con IndexedDB real. Verifica primera
  carga silenciosa, un reclamo compartido, lectura + INSERT y logout durante una
  transacción pendiente y durante la espera del audio simulado.
- Evidencia local en `.performance/internal-notices/audio-visual/evidence.json` y
  `verification.png`; fixture reproducible `run.mjs`. Solo sesión/contador de audio
  se sustituyen; hook, tracker y coordinación son código real.

Esto no equivale a escuchar el MP3 en todos los dispositivos ni a verificar un nuevo
despliegue web. No se publicó Vercel como parte de esta modificación.
