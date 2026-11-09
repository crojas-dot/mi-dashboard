# Quejas y Mis Quejas: preparación del lanzamiento

Revisión de estado: 14 de octubre de 2026; evidencia DB de la entrega del 10
(migraciones con timestamp UTC del 11). No se consultó nuevamente producción para
esta actualización documental.
Alcance: formulario público y gestión interna. La matriz completa incluye un portal
ciudadano y otros procesos que no pertenecen a este primer lanzamiento.

## Terminado en código local y DB

- Nombre, correo electrónico válido y descripción obligatorios; teléfono/evidencias opcionales.
  Seis tipos compartidos por altas interna/pública y sus validaciones DB, incluida Observación.
- Fecha de recepción y tipo del registro automáticos. GC selecciona área reutilizable
  y registra oficio en la etapa de decisión/resolución, con revisión esperada.
  Observaciones se concentra en Actividad, conservando el texto histórico.
  Añadir un área no la asigna ni reemplaza la selección. No se exige fecha manual.
- Oficio emitido por ECA: no se inventa una serie. Unicidad por mayúsculas/trim y límite
  de 120 caracteres. La RPC nueva exige oficio explicativo para No Procede y de resolución
  para Resuelto/Finalizado; su archivo se adjunta como evidencia en Drive.
- El alta usa el consecutivo anual transaccional. No renumerar los expedientes existentes:
  snapshot del 10 octubre: 130 filas, contador 2025=16, 2026=2066. Son cifras de esa
  verificación, no conteos actuales. La siguiente alta del año sigue el contador vigente.
  Se cerró la llamada directa del cliente al generador para no consumir números sin alta.
- Nuevas evaluaciones: 3 días hábiles; investigación: 15 desde la procedencia. GC revisión
  y devolución conservan la ejecución/plazo. La reapertura real crea otra ejecución.
  Los snapshots y plazos históricos ya emitidos se conservan.
- Quejas, Mis Quejas, Dashboard e informes leen qms_quejas (security invoker), mostrando
  el vencimiento persistido de la etapa. La prioridad no participa en filtros/UI de Quejas
  ni en sus plazos; se conserva la columna histórica y prioridades de otros módulos.
- IDs de estados y workflow permanecen estables. Sus etiquetas/colores vienen del catálogo;
  valores ajenos al flujo no se ofrecen como estados operativos. Cambiar etiqueta no cambia ID.
- Modal amplio y responsive; Tiptap se carga al montar el editor. Negrita, cursiva, títulos,
  listas y undo/redo. Texto histórico plain es literal; solo markdown explícito tiene formato.
  Lector sin HTML, imágenes remotas ni enlaces externos. Límite persistible: 10.000 caracteres.
- Permisos de lectura/escritura por módulo, admin activo con autoridad operativa, revisión
  obsoleta rechazada, sin escritura directa cliente en quejas. Autor/responsable usa usuarios.id.
- Cola específica de 3 avisos: recibido, primera investigación, final. No Procede tiene dos;
  Finalizado no agrega un cuarto y reapertura no duplica eventos. Worker HMAC y Apps Script
  independiente preparados en esta evaluación; activación directa Supabase/Apps Script
  verificada el 13 octubre, sin Vercel. Ver correo-quejas-directo-2026-10-13.md.

## Pendiente antes de producción

1. Publicar y verificar este cliente nuevo cuando el propietario lo autorice. No se publicó
   en esta entrega. Después ejecutar el corte coordinado de scripts/cerrar-workflow-quejas.sql.
   qms_transition anterior conserva temporalmente EXECUTE para el cliente desplegado;
   no garantiza los nuevos requisitos de oficio/formato. El wrapper nuevo ya los exige.
2. Correo activado el 13 octubre en Supabase/Apps Script, con HMAC, diario privado,
   activador de cinco minutos y envíos/ACK reales. El circuito no requiere desplegar
   Vercel. Mantener conciliación de incertidumbre y validar recepción institucional;
   ver correo-quejas-directo-2026-10-13.md.
3. Calendario efectivo actual: lunes a viernes, sin feriados cargados. El motor admite
   versiones de feriados mediante qms_publish_calendar, pero no hay editor visual integrado.
   Definir los feriados institucionales antes de afirmar que se excluyen automáticamente.
4. Los avisos de vencimiento 3/1 días existen como filas/función QMS; no hay cron instalado.
   Los tres correos ciudadanos son un circuito independiente. Confirmar el programador.
5. Validación funcional institucional de textos/expedientes y recepción real de correo con
   destinatario de prueba autorizado. No se hicieron envíos ni escrituras ficticias remotas.

## Evidencia de la entrega del 10 octubre

- Suite completa: 457/457 en el estado final, incluyendo editor/alta y restauración sin dirty.
- PostgreSQL local: 48 comprobaciones de permisos, carreras, snapshots, oficio único,
  plazos, gateway idempotente, replay HMAC/leases y cola. Sin conexión remota en fixtures.
- Playwright/Chrome temporal: 7 verificaciones con componentes reales y datos ficticios;
  escritorio 1440×1000 y móvil 390×844, editor/viñetas y ausencia de overflow horizontal.
- TypeScript, lint, build, structure y visual-layer verificados. No es un benchmark
  de miles de filas ni una certificación de la versión aún desplegada en Vercel.
- DB aplicada: 20261011044303, 20261011044317, 20261011044810. Se mantienen 130 expedientes,
  contadores intactos y cero eventos de correo retroactivos.

## Estado de construcción al 14 octubre

Estimación de planificación: **avance del 90–95 % en la versión operativa del módulo de Quejas**.
El correo ya está activo, y el panel/editor, catálogo de áreas, observaciones y
presentación pública se refinaron después de la entrega inicial. El porcentaje es
orientativo; no representa toda la matriz de Calidad ni el porcentaje publicado.
Restan el cierre coordinado del despliegue/workflow, feriados, avisos de vencimiento
y aceptación institucional. Conciliación de incertidumbre sigue manual, sin UI.
El oficio sigue emitido por ECA y adjuntado: no hay generador PDF integrado ni se
necesita asumirlo como requisito acordado de esta versión operativa.

Última verificación local del 14: 129/129 pruebas pertinentes, TypeScript, lint acotado,
estructura, capa visual y build correctos; QA sintética 124/32/16 de formulario,
HTML de correo y lector del expediente. No es una nueva suite global ni un nuevo
despliegue. Ver [evidencia y límites](arquitectura/verificacion-y-pendientes.md).
