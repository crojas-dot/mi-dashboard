# Servicio independiente de correo de Quejas

4 noviembre: adjunto oficial físico preparado con `QMS_MAIL_ATTACH_OFFICIAL_DOCUMENTS`.
Usa el único documento publicado que devuelve Edge por HMAC con lease vigente.
Requiere el manifiesto con `drive.readonly` y ejecutar una vez
`qmsMailEnableOfficialAttachments` tras autorizar Google. La función no envía correos.
No ejecutar el poll para probar, recrear activadores ni reenviar eventos históricos.
Contrato y estado remoto: [revisión e informe](../../../docs/quejas-revision-y-respuesta-2026-11-04.md).

Transporte operativo: `QMS_MAIL_TRANSPORT=supabase`, URL exacta de `quejas-mail-queue`,
HMAC específico. DB decide los eventos, Apps Script manda por MailApp y confirma por
la Edge Function de Supabase. No usa Vercel ni claves generales Supabase en el script.
Estado activo y verificación: [13 octubre](../../../docs/correo-quejas-directo-2026-10-13.md).
Ampliación activa del 14 octubre: [avisos a Calidad y responsable](../../../docs/avisos-internos-quejas-2026-10-14.md).
Ampliación activa del 19 octubre: [seguimiento privado](../../../docs/quejas-seguimiento-y-publicacion-2026-10-16.md).
La migración y los cortes DB están aplicados, web/Edge compatibles publicados y
el `Codigo.gs` guardado se comparó con el remoto. `QMS_MAIL_ENABLED=true` quedó
guardado; el activador de cinco minutos se conservó sin poll manual ni reenvíos históricos.
El activador existente ejecuta el HEAD guardado: no recrearlo ni volver a publicar
el `/exec` legacy para actualizar estos avisos. Claim v2 acepta límite 0 para mantener
campanas sin cuota/diario. Los avisos internos requieren preflight HMAC de pertinencia
antes de MailApp; el diario conserva cualquier entrega anterior e incertidumbre.

Diseño del correo: `qmsMailHtml_` en `Codigo.gs`; cuerpo/asunto canónicos en
`supabase/functions/quejas-mail-queue/message.ts`. Ajuste visual del 14 octubre:
760 px máximos y espacios compactos, aplicado al código guardado del mailer activo.
El 19 se guardó el encabezado blanco compacto y botón condicional de seguimiento;
se conserva el cuerpo/asunto canónico y los correos ya recibidos no cambian.
Cambiar la apariencia no requiere ejecutar el poll ni recrear el activador.

Para los enlaces, configurar `QMS_PUBLIC_TRACKING_ORIGIN` con el origen canónico
permitido (`https://mi-dashboard-iota.vercel.app`). La firma dedicada vive solo en
web/Edge: no copiarla a Apps Script ni utilizar el HMAC del mailer como sustituto.
Con seguimiento habilitado, Edge usa claim v3; v2 y los eventos históricos sin
snapshot conservan su contrato. El botón solo aparece cuando llega un enlace
válido; el script no lo inventa ni emite capacidades. Ver
[configuración y evidencia del 19](../../../docs/correo-quejas-directo-2026-10-13.md#activación-coordinada-del-19-octubre).

La activación fue comprobada sin generar correos de prueba. La recepción real de
un nuevo correo con enlace y la apertura de su trámite siguen pendientes de
aceptación; `sent` no demuestra entrega en inbox. No reenviar eventos anteriores
para añadirles el botón.

Para una instalación nueva, copiar Codigo.gs en un proyecto Apps Script nuevo.
El servicio existente no requiere recrear el proyecto. Ya incluye doPost; no modifica
el proyecto que convierte PDF/Word para IA. Usar appsscript.mail.example.json como
manifiesto y configurar las propiedades indicadas en la guía.

MailApp solo autoriza enviar; no requiere leer el buzón Gmail. La cuenta que ejecuta
el servicio será el remitente real. No ejecutar qmsMailPoll ni instalar el trigger
hasta configurar y verificar la cuenta institucional.

Preparar con `QMS_MAIL_ENABLED=false` y el secreto compartido configurado. Ejecutar
`qmsMailInitializeLedger` crea un libro en Mi unidad si falta su ID, lo guarda en
`QMS_MAIL_LEDGER_SPREADSHEET_ID` y prepara la pestaña del diario. Si ya existe el ID,
reutiliza el libro y conserva sus filas. No activa envíos ni instala el trigger.

**Mi unidad no garantiza acceso privado.** Una política de Workspace puede dar
acceso por enlace al dominio a archivos recién creados. Antes de activar, revisar
Compartir y dejar el acceso general en **Restringido**, conservando solo la cuenta
ejecutora y administradores designados. Revisar también los accesos heredados si
se proporciona una hoja de una unidad compartida. El inicializador no modifica
permisos ni comprueba la ACL; no añade scopes de Drive.

La activación se describe en [seguridad-correos-quejas.md](../../../docs/seguridad-correos-quejas.md).
