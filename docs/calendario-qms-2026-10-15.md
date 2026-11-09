# Calendario laboral QMS — 15 de octubre de 2026

El motor de etapas ya conservaba calendarios versionados en `qms_calendars`.
Esta entrega conecta su editor en **Configuración → Calendario laboral**, solo
para el administrador real. La pantalla es local; no se publicó Vercel.

## Contrato

- Lee una sola versión vigente, con columnas explícitas y cancelación de lectura.
  Query/caché: `lib/queries/useQmsCalendar.ts`, `queryKeys.qmsCalendar` y el TTL acotado
  de Configuración. No mantiene otro calendario en Zustand ni en `sla_config`.
- Días ISO 1–7 y hasta 1000 fechas civiles únicas con descripción. Añadir/quitar
  edita el borrador; no publica ni reemplaza feriados anteriores. No hay importación
  automática de fechas nacionales o institucionales sin confirmarlas.
- Modelo/validación: `lib/utils/qmsCalendar.ts`. Descripción hasta 200 caracteres,
  motivo hasta 500, sin fechas inexistentes ni conversión de la fecha civil a UTC.
- `qmsCalendarService.publicarCalendarioQms` llama al RPC existente
  `qms_publish_calendar(p_expected,p_weekdays,p_holidays,p_reason)`. Usa cliente
  autenticado, sin service role en UI. DB exige admin activo, lock `qms.config`,
  revisión anterior exacta, versión nueva y auditoría.
- Captura la revisión al comenzar a editar. Refetch no pisa el borrador ni cambia
  esa revisión. Conflicto `40001` conserva cambios; recargar exige aceptar descartar
  el borrador. Nunca obtener otra revisión para forzar un reintento.
- Guardado bloquea doble envío y comprueba visita/identidad/ámbito. Una escritura
  confirmada invalida su origen; un fallo del refresco comunica que se guardó y
  permite actualizar la vista. Una respuesta antigua no edita otra sesión/visita.

El calendario es compartido por las etapas del motor QMS. Se aplica a las **etapas
que comiencen después de guardar**, incluso una investigación nueva de una queja
que ya se recibió. Las etapas abiertas conservan su snapshot, vencimiento y avisos.
La UI muestra los plazos confirmados de Quejas: evaluación 3 e investigación 15 días
hábiles; no expone un editor genérico de reglas que altere los correos aprobados.
La zona persistida es `America/Costa_Rica`; este editor no la modifica.

## Permisos efectivos y entrega

Se consultaron esquema, policies, grants y publishers efectivos en
`supabase/backups/calendar_preflight_20261015.json`. La revisión encontró grants
directos de escritura, incluido TRUNCATE, a authenticated en calendarios/reglas/auditoría.
RLS no protege TRUNCATE. Tras autorización explícita del propietario se aplicó
`20261015171835_qms_calendar_append_only_grants`:

- Retira INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER a anon/authenticated en
  `qms_calendars`, `qms_stage_versions` y `qms_config_audit`.
- Conserva SELECT/RLS, RPC y permisos de service_role. No cambia funciones,
  snapshots, calendario, feriados, actores ni reglas de vencimiento.
- Verificación remota: cero grants cliente de escritura, tres SELECT conservados,
  tres tablas con RLS. El calendario sigue versión 1, lunes–viernes y cero feriados.
  Evidencia: `supabase/backups/calendar_grants_evidence_20261015.json`.
- Se verificaron también privilegios efectivos por rol/herencia y por columnas:
  anon/authenticated no conservan ninguna escritura; EXECUTE del publisher sigue
  disponible para authenticated y cerrado para anon. El guard admin activo continúa
  dentro del RPC; tener EXECUTE no sustituye esa autorización.

El advisor por CLI no estuvo disponible por conectividad IPv6; los permisos se
verificaron directamente en SQL. No presentar esto como auditoría global nueva.
El poll autenticado de avisos seguía activo en la consulta del 15 octubre. Destinatario
encargado se resuelve por asignación, aunque sea Colaborador; no equivale a enviar
a todos los colaboradores. Calidad conserva su rol real y aún necesita destinatarios
activos configurados por la institución.

## Verificación y pendientes

PostgreSQL aislado: **112/112** comprobaciones de permisos, RPC real, admin/inactivo/
noadmin/anon, concurrencia CAS, auditoría, idempotencia y conservación de snapshots,
vencimientos y avisos abiertos. Script: `scripts/test-qms-calendar-grants-db.mjs`.
No usa producción, secretos reales ni publica feriados de prueba.

Suite Node completa: **636/636**; modelo/lectura/mutación **13/13** y UI **9/9** en
`tests/qms-calendar*.test.mjs`. TypeScript, lint global, build, estructura y capa visual
correctos. Tras los ajustes de clases se repitieron pruebas UI/foundation, lint acotado,
build y QA visual. El build requirió red para Google Fonts, sin cambiar la fuente.

QA real local: **43/43** comprobaciones a 1366, 390 y 320 px, componente/guard/modal,
Tailwind e Inter reales; auth/lectura/publicación con datos ficticios y red externa
bloqueada. Verifica añadir/quitar, motivo, conflictos, borradores, confirmación,
doble envío y fallo de refresco posterior al guardado. Sin errores JavaScript.
Detectó/corrigió dos fallos: acciones de ConfirmDialog que se recortaban a 320 px
y fieldsets con mínimo nativo que crecían por una descripción sin espacios. Ahora
las acciones ajustan filas y el contenido puede encogerse/saltar sin ocultar recortes.
Evidencia: `.performance/calendar-20261015/{visual-evidence.json,QA-visual.md,run-visual.mjs}`;
permisos remotos: `.performance/calendar-permissions-20261015.jpg`.

Siguen
pendientes el calendario institucional real, aceptación de sus responsables y la
publicación web autorizada. No generar feriados ni cambiar roles por inferencia.
