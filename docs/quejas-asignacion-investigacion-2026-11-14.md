# Asignación y seguimiento de investigación — Calidad

**Estado del backend (15-11-2026 UTC):** migración
`20261115041345_quejas_investigacion_asignacion.sql` aplicada en Supabase
antes de habilitar el nuevo cliente. Se verificó RLS activa, una política SELECT
para authenticated, ausencia de INSERT/UPDATE para authenticated, denegación
SELECT/EXECUTE a anon y rechazo del RPC sin sesión. La tabla nació vacía:
no se modificaron expedientes existentes. Esto no demuestra por sí solo una
transición autenticada de extremo a extremo; queda pendiente validarla en navegador
con usuarios de prueba antes de uso institucional.

Contrato vigente para `/quejas`, etapas **Recibido → En Investigación**, en el
workspace ampliado nativo. No rediseña el resto del flujo, ni `/mis-quejas`,
ni las tablas, permisos, plazos, correos o publicaciones.

## Evaluación (Procede)

La justificación de procedencia continúa siendo obligatoria, con formato
`plain` / `markdown`, y la selección de responsable activo es obligatoria.
La justificación del único editor Tiptap también es la instrucción para el
investigador. No existe un segundo campo de texto ni se duplica su captura.
La pista gris de formato se oculta exclusivamente en este editor; se conservan
los errores de límite y los controles de edición. Debajo queda únicamente
**Adjuntar documento** (opcional), con la nota de almacenamiento;
**Cancelar / Guardar** permanece en el footer.

- Un oficio de apertura: archivo privado en Drive asociado a `queja_adjuntos`.
  Al seleccionarlo se sube por la API existente y se muestra chip de vista previa
  y opción de desvincular. Cancelar Procede no elimina el archivo físico subido
  ni lo marca como oficio; permanece como adjunto institucional del expediente.

`iniciarInvestigacionQueja` invoca
`qms_start_investigation_with_assignment` con la revisión capturada de la queja.
La RPC valida rol de Calidad/admin, estado Recibido, revisión, responsable y
pertenencia de archivo/cargador. Después usa el workflow vigente de transición
y escribe `queja_investigation_assignments` **en la misma transacción**;
ante conflicto/error se revierten ambas escrituras sin suplantar revisiones.
El oficio debe tener ID de adjunto del expediente y `usuario_id` igual al
usuario operativo de Calidad que confirmó Procede.

## Investigación (Calidad / Admin)

La columna central se titula **Detalles de asignación**. Su orden es:
**Justificación de Calidad** primero (la decisión Procede en su formato Tiptap),
**Investigador asignado** debajo y, por último, el documento vinculado en
`ListaAdjuntos` (visor privado). Si no existe justificación pero hay instrucciones
históricas, se usan como respaldo de lectura. No se muestra ni se consulta un
borrador del investigador desde `/quejas` y no se inventan registros inexistentes.

La columna derecha se titula **Esperar propuesta del investigador** y explica
que pasará a **Revisión GC** tras el envío del responsable. Incluye duración
en días hábiles **solo si** `caseDeadline` dispone de la regla QMS vigente
validada; de lo contrario, usa un texto genérico, no un número inventado.
No existe botón «Ver análisis» durante En Investigación; ese botón sigue
disponible cuando se revisa una propuesta realmente enviada en GC.

El panel contraído 40vw mantiene `CaseTriageNextStep`, estado/plazo/responsable
y CTA azul **«Ver estado de la investigación →»**: solo expande al escritorio.
No presenta la evaluación de Procede como hallazgo del investigador.
Preserva un único árbol de workspace montado, el ciclo, el foco y los borradores.

## Seguridad

Migración aditiva `20261115041345_quejas_investigacion_asignacion.sql`.
La tabla de asignaciones usa RLS; lectura para admin/Calidad con permiso o
investigador asignado con permiso. No se concede escritura directa a
`authenticated`. La RPC es `SECURITY DEFINER` con validación explícita
de la identidad y rol actual; `EXECUTE` concedido solo a authenticated.
La interfaz de Calidad no consulta los borradores remotos del investigador;
la gestión y edición de esos borradores continúa exclusivamente en `/mis-quejas`.

La publicación del backend/migración precede al cliente: este no debe invocar
una RPC inexistente. Probar transición con un expediente sintético y roles
autorizados antes de usar con personas reales; las suites Node y el build
verifican contratos, pero no sustituyen esa prueba de integración autenticada.

## Validación mínima

`node --test tests/quejas-asignacion-investigacion.test.mjs`,
`tests/quejas-progressive-disclosure.test.mjs`,
`tests/queja-publicacion.test.mjs`,
`tests/entity-request-guard.test.mjs`,
`tests/visual-contracts.test.mjs`, TypeScript, lint, build, check:structure
y check:visual.
