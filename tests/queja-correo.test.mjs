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
