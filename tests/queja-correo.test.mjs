import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'
import fs from 'node:fs'
import vm from 'node:vm'

const { crearCorreoAcompanamiento, validarCorreoQueja } = loadModule('lib/utils/quejaCorreo.ts')
const { default: Editor } = loadModule('app/quejas/components/QuejaCorreoEditor.tsx')
const { quejaMailMessage, claimMailSnapshot } = loadModule('supabase/functions/quejas-mail-queue/message.ts')
const snapshot = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', claim_token: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  tipo: 'final', destinatario: 'persona@example.test', folio: '2026-001', estado: 'Resuelto', numero_oficio: 'ECA-001' }

test('correo y sobre de recepción conservan ceros, año e históricos del folio persistido', () => {
  for (const folio of ['2026-2088', '2027-001', '2027-1000', 'QUEJA-2025-0016']) {
    const correo = crearCorreoAcompanamiento({ cliente_nombre: 'Ana Pérez', folio })
    assert.equal(correo.asunto, `Respuesta a su solicitud - Folio ${folio}`)
    assert.ok(correo.cuerpo.includes(`folio ${folio}`))
    const mensaje = quejaMailMessage(claimMailSnapshot({ ...snapshot, tipo: 'recibido', folio }))
    assert.equal(mensaje.folio, folio)
    assert.ok(mensaje.subject.includes(folio))
    assert.ok(mensaje.body.includes(folio))
  }
})

test('el correo de acompañamiento saluda al interesado y remite los resultados al adjunto', () => {
  const correo = crearCorreoAcompanamiento({ cliente_nombre: 'Ana Pérez', folio: snapshot.folio })
  assert.match(correo.cuerpo, /^Estimado\(a\) Ana Pérez:/)
  assert.match(correo.cuerpo, /resultados del análisis y la resolución se encuentran en el informe adjunto/)
  assert.doesNotMatch(correo.cuerpo, /estado: Resuelto|PROPUESTA INTERNA/)
  assert.ok(correo.asunto.includes(snapshot.folio))
  assert.equal(correo.asunto, 'Respuesta a su solicitud - Folio '+snapshot.folio)
  assert.match(correo.cuerpo, /Para consultas adicionales, puede escribir a gc@eca.or.cr/)
  const markup = renderToStaticMarkup(createElement(Editor, { id: 'correo', destinatario: snapshot.destinatario, correo, onChange() {} }))
  assert.match(markup, /<textarea/)
  assert.match(markup, /Asunto/)
  assert.match(markup, /Estimado\(a\) Ana Pérez:/)
})

test('la plantilla de no procedencia remite los fundamentos al mismo informe adjunto', () => {
  const correo = crearCorreoAcompanamiento({ cliente_nombre: 'Ana Pérez', folio: snapshot.folio }, true)
  assert.match(correo.cuerpo, /no procedente/)
  assert.match(correo.cuerpo, /fundamentos.*informe adjunto/)
  assert.match(correo.cuerpo, /gc@eca.or.cr/)
})

test('el asunto y cuerpo editados son los del sobre final; el destino siempre sale del snapshot', () => {
  const correo = { subject: 'Respuesta personalizada', body: 'Estimada Ana:\n\nLe adjuntamos su informe.\n\nCordialmente, ECA.' }
  const row = claimMailSnapshot({ ...snapshot, correo })
  const mail = quejaMailMessage(row)
  assert.equal(mail.subject, correo.subject)
  assert.equal(mail.body, correo.body)
  assert.equal(mail.to, snapshot.destinatario)
  const tracked = quejaMailMessage({ ...row, public_tracking: { queja_id: snapshot.id, nonce: snapshot.claim_token } }, { trackingUrl: 'https://qms.example.test/q/seguimiento#clave=synthetic.signature' })
  assert.equal(tracked.body, correo.body)
  assert.equal(tracked.subject, correo.subject)
  assert.equal(Object.hasOwn(tracked, 'trackingUrl'), false)
  assert.doesNotMatch(tracked.body, /Seguimiento privado:/)
  assert.doesNotMatch(tracked.body, /concluyó con el estado/)
})

test('un sobre histórico sin correo editable conserva el texto y asunto anteriores', () => {
  const mail = quejaMailMessage(claimMailSnapshot(snapshot))
  assert.equal(mail.subject, 'Queja 2026-001: comunicación final')
  assert.match(mail.body, /concluyó con el estado: Resuelto/)
  const receipt = claimMailSnapshot({ ...snapshot, tipo: 'recibido', estado: 'Recibido', correo: { subject: 'No usar', body: 'Privado' } })
  assert.equal(receipt.correo, undefined)
  assert.doesNotMatch(quejaMailMessage(receipt).body, /Privado/)
})

test('el HTML del emisor conserva el correo editado como texto y no lo cambia por la plantilla de estado', () => {
  const context = vm.createContext({})
  vm.runInContext(fs.readFileSync('integration/apps-script/quejas-mail/Codigo.gs', 'utf8'), context)
  const correo = { subject: 'Asunto editado', body: 'Estimada Ana:\n\nEstos son los resultados adjuntos.\n\n<script>Texto literal</script>' }
  const message = quejaMailMessage(claimMailSnapshot({ ...snapshot, correo }))
  const html = context.qmsMailHtml_(message)
  assert.match(html, /Estimada Ana:/)
  assert.match(html, /Estos son los resultados adjuntos/)
  assert.match(html, /&lt;script&gt;Texto literal&lt;\/script&gt;/)
  assert.doesNotMatch(html, /concluyó con el estado|<script>/)
  assert.doesNotMatch(html, /Consultar mi trámite|q\/seguimiento/)
})

test('se rechazan cabeceras inyectadas, límites y sobres ambiguos sin copiar HTML al editor', () => {
  for (const correo of [{ asunto: 'Hola\nBcc: otro', cuerpo: 'Mensaje' }, { asunto: 'x'.repeat(181), cuerpo: 'Mensaje' }, { asunto: 'Hola', cuerpo: 'x'.repeat(3501) }, { asunto: '', cuerpo: ' ' }]) assert.throws(() => validarCorreoQueja(correo, true))
  for (const correo of [{ subject: 'Hola\r\nBcc: otro', body: 'Texto' }, { subject: 'Hola', body: 'x'.repeat(3501) }, { subject: 'Hola', body: 'Texto', to: 'other@example.test' }]) assert.throws(() => claimMailSnapshot({ ...snapshot, correo }))
  const markup = renderToStaticMarkup(createElement(Editor, { id: 'correo', destinatario: '<img src=x>', correo: { asunto: '<script>x</script>', cuerpo: '<iframe>hola' }, onChange() {} }))
  assert.doesNotMatch(markup, /<script|<img|<iframe/)
  assert.match(markup, /&lt;iframe&gt;/)
})

test('correo normal y No procede mantienen un único scroll en el mensaje, también durante la precarga', () => {
  for (const noProcede of [false, true]) {
    const correo = crearCorreoAcompanamiento({ cliente_nombre: 'Ana', folio: '2026-001' }, noProcede)
    const markup = renderToStaticMarkup(createElement(Editor, { id: 'correo-scroll', destinatario: 'ana@example.test',
      oficio: '2026-001', correo, onOficioChange() {}, onChange() {} }))
    assert.match(markup, /flex h-full min-h-0 flex-col overflow-hidden/)
    assert.match(markup, /flex min-h-0 flex-1 flex-col px-5 py-5/)
    assert.match(markup, /data-response-message-scroll/)
    assert.match(markup, /h-full min-h-0 w-full flex-1 resize-none overflow-y-auto overscroll-contain/)
    assert.match(markup, /focus:border-transparent focus:outline-none focus:ring-0/)
    assert.doesNotMatch(markup, /data-response-counter/)
  }
  const modal = fs.readFileSync('app/quejas/components/QuejaRespuestaClienteModal.tsx', 'utf8')
  assert.match(modal, /data-response-prefill role="status" aria-live="polite"/)
  assert.match(modal, /if \(!initial && query\.data\) setInitial\(query\.data\)/)
  assert.match(modal, /if \(initial\) return <RespuestaEditor \{\.\.\.props\} initial=\{initial\} informeActual=\{informe\.data\}/)
  assert.match(modal, /\{query\.isLoading \? \(/)
  assert.doesNotMatch(modal, /query\.isLoading \|\| informe\.isLoading/)
  assert.match(modal, /const report = savedReport \?\? informeActual \?\? null/)
  assert.match(modal, /ultimoPdfGenerado\(props\.adjuntos, queja\.folio, informeActual \?\? null, queja\.id\)/)
  assert.match(modal, /setSavedReport\(result\)/)
  assert.match(modal, /informeError && !report/)
  assert.match(modal, /informePendiente \? 'Comprobando el PDF oficial…'/)
  const prefillStart = modal.indexOf('data-response-prefill')
  const prefillEnd = modal.indexOf('    ) : (', prefillStart)
  assert.ok(prefillEnd > prefillStart)
  const prefill = modal.slice(prefillStart, prefillEnd)
  assert.match(prefill, /flex min-h-0 flex-1 items-center justify-center overflow-hidden/)
  assert.match(prefill, /Recuperando el borrador guardado/)
  assert.doesNotMatch(prefill, /LoaderCircle|animate-spin/)
  assert.doesNotMatch(prefill, /QuejaCorreoEditor|<textarea|overflow-y-auto|grid-rows-/)
  assert.match(modal.slice(prefillEnd, modal.indexOf('\n  </Modal>', prefillEnd)), /Reintentar/)
  assert.match(modal, /data-response-compose className="flex h-full min-h-0 max-h-full flex-1 flex-col overflow-hidden/)
  assert.match(modal, /data-response-scroll-shell className="flex min-h-0 flex-1 flex-col overflow-hidden/)
  const start = modal.indexOf('data-response-compose className=')
  const composer = modal.slice(start, modal.indexOf('\n    </Modal>', start))
  assert.match(composer, /<div data-response-scroll-shell[\s\S]*<QuejaCorreoEditor/)
  assert.doesNotMatch(composer, /data-response-attachments|data-response-counter/)
  assert.match(modal, /data-response-footer[\s\S]*data-response-attachments[\s\S]*data-response-footer-actions/)
  assert.match(modal, /data-response-footer-actions[\s\S]*data-response-counter[\s\S]*Descartar[\s\S]*Guardar borrador/)
  assert.match(modal, /dialogClassName="h-\[85vh\] max-h-\[85dvh\]"/)
  assert.doesNotMatch(composer, /overflow-y-auto|scrollbar-gutter/)
})

test('la precarga se anticipa por fila y dentro del expediente en los dos caminos de respuesta', () => {
  const list = fs.readFileSync('app/quejas/page.tsx', 'utf8')
  const detail = fs.readFileSync('app/quejas/components/QuejaDetalleModal.tsx', 'utf8')
  assert.match(list, /onMouseEnter=\{\(\) => precargarFila\(q\)\}/)
  assert.match(list, /onFocus=\{\(\) => precargarFila\(q\)\}/)
  assert.match(list, /user\?\.rol === 'admin' \|\| user\?\.rol === 'calidad'/)
  assert.match(list, /\['Recibido', 'Pendiente de Revisión GC', 'Resuelto', 'No Procede'\]/)
  for (const source of [list, detail]) {
    assert.match(source, /respuestaClienteKey\(/)
    assert.match(source, /fetchRespuestaCliente\(/)
    assert.match(source, /quejaInformeKey\(/)
    assert.match(source, /fetchQuejaInforme\(/)
    assert.match(source, /staleTime: 30_000/)
  }
  assert.doesNotMatch(detail, /estadoActual !== 'Resuelto' \|\| !esStaff/)
})
