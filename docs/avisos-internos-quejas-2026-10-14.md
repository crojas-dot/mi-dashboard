# Avisos internos de Quejas

Calendario acordado el **14 de octubre de 2026**. Los avisos operativos se dirigen
a todos los perfiles activos con rol real `calidad`, y al responsable activo del
expediente donde corresponda. Simular una vista no cambia esos destinatarios.

| Hito | Destinatarios |
| --- | --- |
| Recepción completa | Calidad |
| Evaluación: resta 1 día hábil del plazo de 3 | Calidad |
| Asignación o reasignación de investigación | Nuevo responsable |
| Investigación: restan 5 días hábiles | Calidad |
| Investigación: restan 3 días hábiles | Calidad y responsable |
| Evaluación vencida | Calidad y responsable, si existe |
| Investigación vencida | Calidad y responsable |

La asignación no concede 15 días nuevos: el plazo corre desde la procedencia.
La revisión/devolución de GC conserva la ejecución de investigación y su fecha
límite. Reapertura real crea otra ejecución. Los avisos usan el calendario y el
vencimiento persistidos; no cambian fechas para enviar un recordatorio.

Los tres correos ciudadanos de recibido/investigación/final mantienen su contrato
independiente. Los nuevos avisos internos no consumen ese límite vitalicio ni se
envían a la dirección del formulario. Cada entrega tiene un destinatario y UUID;
no se expone una lista CC/BCC ni contenido del cliente, notas o archivos.

## Controles de entrega

- Deduplicación por evento/ejecución/destinatario, independiente de leer o archivar
  la campana. Una persona que es Calidad y responsable recibe una sola copia del hito.
- La recepción pública se comunica después de finalizar sus evidencias; la recepción
  interna se comunica desde su alta. La campana admin existente se conserva.
- Un aviso obsoleto se omite si terminó la etapa o cambió la asignación/rol/actividad.
  Apps Script verifica pertinencia inmediatamente antes de MailApp por HMAC.
- Asunto/cuerpo/destinatario quedan congelados por UUID para que los reintentos
  respeten el diario. Una entrega incierta nunca se convierte en reenvío automático.
- Activación con fecha de corte, sin avalancha retroactiva de registros de prueba.
  Solo se programan recordatorios futuros con calendario hábil conocido, sin
  recalcular snapshots legacy ni el vencimiento del expediente.

El poll independiente de Apps Script funciona con el panel cerrado cada cinco minutos.
Llama claim v2 con límite 0 si no hay cuota o diario: produce campanas sin reservar
correos ni crear attempting. No añade pg_cron ni un segundo activador. El sonido de
la campana es complementario: requiere panel abierto y permiso de reproducción
del navegador. Respeta preferencias y no debe sonar por la primera carga histórica,
por activar el sonido ni varias veces por pestañas que reciben el mismo evento.

## Estado de implementación

Activado el **14 octubre, 21:40 Costa Rica** (`2026-10-15T03:40:57.91402Z`). Migración
`20261015011028` registrada y configuración privada habilitada tras desplegar Edge
y guardar/verificar Apps Script. Health HMAC real: reachable/enabled true. Sin ejecutar
poll manual ni generar quejas/correos sintéticos remotos. Los seis correos ciudadanos
sent se conservaron y no se generaron avisos históricos al activar; quedaron cuatro
avisos futuros sobre ejecuciones hábiles conocidas.
El activador ejecutó `qmsMailPoll` automáticamente a las **21:44:20** y terminó
correctamente en 5,548 s; la DB confirmó el tick autenticado posterior al corte.
Contadores del lote: cero reclamados/enviados/retry/uncertain/failed/skipped, coherente
con no tener avisos actuales elegibles. Captura local `.performance/internal-notices-active.jpg`.

La revisión encontró **cero perfiles activos de Calidad**; no se alteran roles ni se
sustituyen por admin para poblar destinatarios. El directorio necesita emails válidos:
la activación comprobó cero emails inválidos entre activos. Al insertar campana/outbox
atómicos, un perfil con correo inválido no recibe ninguno de esos dos avisos.
La entrega en buzón real de los nuevos tipos requiere aceptación institucional con
sus destinatarios; health o cola no equivalen a correo leído.

Evidencia sin datos personales: `supabase/backups/internal_notices_activation_20261014.json`;
esquema previo en `internal_notices_preflight_20261014.json`, productores y publicadores
adyacentes. Verificación: 614/614 Node, 76/76 PostgreSQL aislado, 78/78 correo,
TypeScript/lint/build/estructura/capa visual; audio real sintético 13 checks/2 pestañas.
El build necesitó acceso de red a Google Fonts, sin modificar fuentes. Los cambios
web de sonido/lectura siguen locales hasta autorización de Vercel.
