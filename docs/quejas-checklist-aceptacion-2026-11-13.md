# Quejas y Mis Quejas — checklist de implementación y aceptación

Auditoría: **13 de noviembre de 2026**. Base inspeccionada: implementación
`main` `2a67d36` publicada en Vercel (`READY`). Esta actualización documental
y el botón ampliado tienen su propio commit posterior.

**Interpretación:** [x] significa **existe en el código inspeccionado**, no que
se completó una prueba E2E con rol autenticado y servicios reales.
La aceptación funcional exige además los casos [ ] de cada etapa.

## Evidencia obtenida

- **Código GitHub:** fuentes y contratos inspeccionados; se verificó que los
  componentes invocan las rutas de guardado, carga, derivación, publicación y
  validación correspondientes. Los archivos de prueba no implican que se
  hayan ejecutado.
- **Supabase:** confirmados `queja_gc_revision_adjuntos`, RLS, SELECT para
  authenticated, ausencia de INSERT directo, RPC
  `qms_review_resolution_with_attachments` ejecutable por authenticated,
  denegada a anon; RPC `derivar_queja_a_sacp` con revisión GC admitida.
  Estas consultas no prueban una operación completa de devolución ni SACP.
- **Vercel:** producción READY del commit `2a67d36`; constancia de build.
  El build comprueba compilación, no la publicación de un correo ni Drive.
- **No ejecutado en esta auditoría:** flujo E2E de principio a fin con
  expediente ficticio/roles reales; tampoco `node --test`, `npm run lint`,
  `npx tsc --noEmit` o `npm run check:visual` localmente.
  No se han generado quejas ni enviado correos para simular éxito.

## 1. Evaluación — Gestión de Calidad

- [x] Descripción original y adjuntos del cliente visibles.
- [x] Botones Procede y No Procede para Gestión de Calidad.
- [x] Procede exige justificación y responsable y conduce a investigación.
- [x] No Procede entra al correo/oficio; no cierra únicamente por el clic.
- [ ] Probar ambos caminos con GC autorizado y confirmar estados, justificación,
      documento y publicación real con destinatario de prueba.

## 2. Investigación — Responsable

- [x] Editor Tiptap existente en el centro; resolución editable.
- [x] Guardar borrador remoto y Enviar a Revisión GC son operaciones distintas.
- [x] No aparece Derivar a SACP para el encargado en investigación.
- [x] Mis notas, adjuntos y alerta de plazo tienen componentes integrados.
- [ ] Probar Guardar sin transición, reabrir borrador, reenviar propuesta y
      verificar `Pendiente de Revisión GC`.
- [ ] Comprobar edición/borrado de notas y carga de evidencias con RLS efectiva;
      la migración histórica de notas sigue documentada como pendiente.

## 3. Revisión de Calidad

- [x] Propuesta en lectura central con acordeón «Ver antecedentes».
- [x] Acciones Aprobar y continuar, Devolver a investigación, Derivar a SACP
      (esta última solo con propuesta y sin acción previa vinculada).
- [x] Aprobar cambia a Resuelto, separado de Publicar respuesta.
- [x] La RPC para SACP admite Revisión GC y no cambia por sí sola el estado
      de la queja. SACP y cierre de Quejas son flujos independientes.
- [ ] Probar aprobación, derivación, idempotencia y revisión esperada usando
      cuenta GC y registros de prueba, sin efectos sobre expedientes reales.

## 4. Devolución de Calidad

- [x] Modal de ancho mail, motivo obligatorio, textarea libre y zona de adjuntos.
- [x] Botón Confirmar devolución deshabilitado hasta ingresar motivo.
- [x] Subida real por `subirAdjuntoQueja`, con error visible si falla.
- [x] RPC de devolución transaccional asocia UUID de soportes a la
      revisión correspondiente mediante `queja_gc_revision_adjuntos`.
- [x] Tarjeta amarilla clicable, detalle completo/solo lectura,
      soportes de ESA devolución e «Ir al editor» (sin un segundo Tiptap).
- [x] La devolución conserva plazo y propuesta para corregir y reenviar.
- [ ] E2E: adjuntar soporte de prueba, confirmar, abrir como responsable,
      visualizarlo y volver al editor; comprobar permisos y RLS.
- [ ] Validar cancelación, archivo inválido y error de carga. Un archivo subido
      permanece en el expediente aunque después se cancele la devolución;
      NO se marca como asociado a la revisión hasta confirmarla.

## 5. Cierre, informe y correo

- [x] «Generar expediente» está bajo datos del cliente, no en centro.
- [x] Botón azul compacto, ahora ancho completo y descripción de una línea,
      sin tarjeta grande ni título redundante.
- [x] Informe Tiptap guardado por versión; exportación Word/PDF disponible,
      sin «Preparar PDF para cliente».
- [x] Guardar persiste texto y luego genera/sube PDF oficial por versión.
      Si ya existe, reutiliza el adjunto. Si Drive falla, conserva texto
      guardado y reintenta PDF sin generar una versión adicional.
- [x] «Redactar respuesta» adjunta por defecto el PDF versionado existente
      como chip, o lo selecciona mediante `onPdfReady` al guardar dentro
      del modal. Permite previsualizar y quitar selección.
- [x] Publicar sin PDF muestra un toast rojo:
      «Es necesario adjuntar un informe antes de publicar».
- [x] Para y N.º de oficio en una línea; Asunto y editor libre con pie fijo.
- [ ] E2E: guardar expediente ficticio, confirmar fila y objeto PDF Drive,
      reabrir respuesta, chip correcto, previsualización y publicación.
- [ ] E2E: forzar fallo controlado en subida, recuperar sin duplicar versión,
      confirmar que no sale correo sin documento. Guardar texto y guardar PDF
      NO constituyen una transacción distribuida.

## 6. Navegación, timeline y rendimiento

- [x] CaseWorkspaceNavigation reutilizado por ambos módulos para anterior,
      siguiente y ampliar/reducir; cerrar proviene de Modal.
- [x] Laterales sticky con scroll propio en viewport ancho, centro separado;
      responsive para espacios estrechos.
- [x] Quejas conserva hoja propia; Mis Quejas conserva `documentStyle="cards"`.
      No repetir el rediseño no solicitado de la hoja.
- [x] QuejaTimeline compartido: punto azul reciente, grises para anteriores,
      anillo blanco sin círculo doble; historial centrado tamaño mail.
- [x] Análisis, Notas y Adjuntos usan scroll nativo con
      `data-case-scroll` y `[will-change:transform]`.
- [ ] Probar visualmente móvil/escritorio, sticky real, acceso con teclado,
      tamaños/editor central y fluidez de scroll.

## Criterio de cierre de QA

Para marcar casillas E2E, utilizar usuarios GC y responsable **de prueba**,
expediente sintético y destinatario controlado. Registrar fecha, SHA, navegador,
resultado, revisión/versión, adjunto en Drive y correo en cola (sin exponer PII).
**No marcar como comprobado algo solo por compilar o existir en la base de datos.**

Puntos de edición: `QuejaDetalleModal.tsx`, `QuejaInformeModal.tsx`,
`QuejaRespuestaClienteModal.tsx`, `QuejaExpedientePanels.tsx`,
`QuejaColaboradorPanel.tsx`, `QuejaInvestigacionResumen.tsx`,
`QuejaAnalisisPanel.tsx`, `useQuejaDevoluciones.ts`,
`quejaWorkflowService.ts`, `quejaInforme.ts` y migraciones
`20261113221000` / `20261113235000`.
