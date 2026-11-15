# Asignación y seguimiento de investigación — Calidad

Contrato vigente para `/quejas`, etapas **Recibido → En Investigación**, en el
workspace ampliado nativo. No rediseña el resto del flujo, ni `/mis-quejas`,
ni las tablas, permisos, plazos, correos o publicaciones.

## Evaluación (Procede)

La justificación de procedencia continúa siendo obligatoria, con formato
`plain` / `markdown`, y la selección de responsable activo es obligatoria.
Se añaden dos campos **opcionales** separados de la justificación:

- Instrucciones para el investigador: texto plano, hasta 4.000 caracteres.
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

La columna central se titula **Detalles de asignación**. Presenta:
investigador asignado del expediente actual, instrucciones guardadas si las hay,
oficio vinculado en `ListaAdjuntos` (visor privado) y aviso de existencia y
última modificación del borrador guardado por el responsable. No muestra su
contenido ni habilita edición. Si no hay metadatos de asignación en expedientes
históricos, muestra responsable real, ausencia explícita de instrucciones y
estado real del borrador, sin crear registros falsos.

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

Migración aditiva `20261115035753_quejas_investigacion_asignacion.sql`.
La tabla de asignaciones usa RLS; lectura para admin/Calidad con permiso o
investigador asignado con permiso. No se concede escritura directa a
`authenticated`. La RPC es `SECURITY DEFINER` con validación explícita
de la identidad y rol actual; `EXECUTE` concedido solo a authenticated.
El borrador remoto ya tiene RLS que habilita metadatos para Calidad sin
conceder derechos de modificación.

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
