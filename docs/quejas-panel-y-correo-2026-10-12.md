# Panel de expediente y conexión de correo

Revisión local: 12 de octubre de 2026. No publicado en Vercel.
La preparación de correo descrita aquí es histórica. Desde el 13 octubre está activo
el [transporte directo Supabase/Apps Script](correo-quejas-directo-2026-10-13.md), sin
worker Vercel ni `/exec` público. La geometría e interacción visual se actualizó en el
[panel del 13 octubre](quejas-panel-2026-10-13.md); el detalle de abajo es evidencia histórica.

## Panel de Quejas

La referencia `ECA_QMS_Quejas_Actividad_y_Plazos.html` se tradujo al kit actual,
sin cargar sus CDN, fuentes o datos ficticios. El panel abre a la derecha (790 px),
ocupa el viewport móvil y puede ampliarse. A partir de 1100 px útiles organiza
ciclo, lectura y acción pendiente en tres columnas. La lista de Quejas no cambia
sus filas, paginación ni tamaños.

- Datos de la solicitud: persona/empresa, recepción automática, correo, teléfono,
  tipo y estado. Descripción y archivos conservan la distinción cliente/análisis.
- Registro GC compacto: área y oficio; editar permite guardar también observaciones
  y reutilizar el catálogo. No pide repetir la fecha ni el tipo del alta.
- Actividad abre un panel independiente: observaciones, comentarios, cambios
  registrados y estados seguros del correo. Cargarlo no bloquea la lectura del caso.
- Decidir, resolver y revisar abren un diálogo con editor y acciones al pie. Escape
  funciona incluso desde Tiptap y cierra solo el diálogo superior. El cuerpo hace
  scroll; Guardar sigue accesible en móvil. No se añaden pestañas al expediente.
- Anterior/siguiente recorren solo las filas de la página actual. Edición, comentario
  pendiente o subida bloquean esos controles; cerrar invalida la visita como antes.
- Los estados son los existentes del workflow. El ciclo describe etapas, no inventa
  aprobaciones, autores ni fechas. La historia viene de `quejas_actividad`.

El tiempo restante conserva el vencimiento de `qms_quejas`. Cuando encuentra un
snapshot válido de esa ejecución, cuenta sus días hábiles y feriados; no usa la
configuración actual para modificar plazos históricos. Si falta/falla el calendario,
presenta días naturales y deja claro ese criterio, sin fabricar una barra de progreso.
Los estados terminales no muestran un plazo operativo pendiente.

Fuentes: `app/quejas/components/QuejaDetalleModal.tsx` conserva handlers/guards;
`QuejaExpedientePanels.tsx` contiene presentación; `quejaExpedienteModel.ts` transforma
fechas; `lib/queries/useQuejaSeguimiento.ts` consulta ejecuciones (máximo 20) y solo
id/tipo/status/sent_at del correo. Comentarios, actividad y correo se consultan al
abrir Actividad. Nada agrega permisos, RPC o escrituras de DB nuevas.

Los borradores conservan su revisión original al cerrar/reabrir el editor. Un conflicto
no busca otra revisión ni reintenta. Un guardado confirmado solo limpia el borrador
de su visita/version vigente. Las acciones de responsable, Drive y derivación mantienen
sus servicios y autorización efectiva.

## Apps Script: acceso comprobado, envío pendiente

El propietario publicó el servicio independiente y cambió el acceso a **Cualquier
persona**, ejecutado como su cuenta. Una llamada sin firma desde servidor respondió
HTTP 200 con `invalid_mail_request`: ya llega al guard del código, sin login Google.
La opción anterior, «usuario con cuenta de Google», devolvía HTTP 401 antes del handler.
Esto comprueba acceso/rechazo de solicitudes sin firma; no verifica todavía un envío.

La URL está en `QUEJAS_MAIL_APPS_SCRIPT_URL` de `.env.local`. El secreto de
`QUEJAS_MAIL_SIGNING_SECRET` se copió privadamente a `QMS_MAIL_SECRET` en el proyecto
institucional con autorización explícita. No se imprimió ni guardó en código/Git.
`QMS_MAIL_ENABLED=false` quedó guardado. El worker local sigue deshabilitado.
No se publicaron variables ni código a Vercel y no se envió correo real.

Se ejecutó `qmsMailInitializeLedger` en la cuenta institucional: creó el libro dedicado,
guardó su ID en propiedades e inicializó las cinco cabeceras de `_qms_mail_delivery`.
Se verificaron las cabeceras y la ejecución terminada. La política Workspace daba acceso
al dominio por enlace; se cambió a **Restringido**, solo propietario, y se comprobó el
resultado guardado. Cero activadores en el proyecto. El inicializador ahora reutiliza
el libro/diario bajo ScriptLock y exige que el correo esté apagado; no modifica ACL.

Prueba real sin envíos: request `delivery_request` con payload vacío, sin destinatario
ni evento. La respuesta `delivery_receipt` tiene HMAC válido, nonce correlacionado y
`invalid_delivery`. El rechazo sucede antes del diario y MailApp; no se insertaron
eventos ni filas ficticias. La prueba valida secreto/conexión, no entrega de correo.

Estado de **Configuración del proyecto → Propiedades del script**:

| Propiedad | Valor que configura el propietario |
| --- | --- |
| `QMS_MAIL_SECRET` | Configurado con el mismo secreto local; valor no documentado |
| `QMS_MAIL_ENABLED` | Configurado en `false` |
| `QMS_MAIL_LEDGER_SPREADSHEET_ID` | Configurado por el inicializador; hoja privada verificada |
| `QMS_MAIL_WORKER_URL` | Pendiente del despliegue autorizado que contendrá `/api/quejas/correos` |
| `QMS_MAIL_REPLY_TO` | Opcional, todavía no configurado |

No copiar secretos al código, chat, diario o documentación. La hoja debe ser accesible
por la cuenta que ejecuta el script y restringida a administradores designados.
El inicializador crea el libro si falta el ID, o reutiliza el existente sin borrar
filas ni duplicar diarios; exige flags apagados y lock. Siempre verificar la ACL del
libro creado: Mi unidad no garantiza privacidad bajo toda política Workspace. **No ejecutar
`qmsMailPoll` ni `qmsMailInstallTrigger` durante esta preparación.**

Cuando se autorice publicar, configurar en Vercel la misma URL/secreto, verificar un
envío controlado autorizado y después activar ambos flags y el trigger. La versión
desplegada anterior no demuestra que el worker nuevo esté disponible. El servicio
conserva HMAC, protección de replay, cola/leases y diario de duplicados; MailApp no
garantiza exactamente una entrega ni informa lectura. Detalle en
[seguridad de correo](seguridad-correos-quejas.md) y
[documentación oficial de web apps](https://developers.google.com/apps-script/guides/web).

## Verificación

TypeScript, lint, build, estructura y capa visual comprobados. Playwright/Chrome
temporal con componentes reales y datos ficticios: 13 comprobaciones en 1600×1000 y
390×844, panel derecho/ampliado, actividad, editor, viñetas, límites horizontales y
Escape anidado. Sin usar la sesión del propietario ni archivos/correos reales.
Suite completa final: **469/469**. La prueba histórica de análisis ahora verifica el
lector canónico integrado, en lugar de exigir un ReactMarkdown inline ya retirado;
comprueba formato útil y ausencia de HTML/recursos externos en la salida real.
Las pruebas de revisión, doble envío, cambio de visita, calendario, lectura limitada
y HMAC se mantienen en `tests/entity-request-guard.test.mjs`, `queja-expediente.test.mjs`
y `queja-mail.test.mjs`. Esta evidencia no certifica el despliegue ni vuelve a auditar
las policies remotas; el cambio no alteró la DB.
Ampliación de preparación: 20/20 pruebas de correo (siete nuevas de inicialización),
ejecución real y comprobación de cabeceras/privacidad/HMAC. El código actualizado del
inicializador se guardó en el editor de Apps Script; el handler de envío y su despliegue
existente se conservaron. Esto no activa el worker de Vercel ni la programación automática.
