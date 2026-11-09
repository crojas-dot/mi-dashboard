import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

const valid = {
  cliente_nombre: '  Persona de prueba  ', email_cliente: '  persona@example.test  ',
  categoria: '  Queja  ', descripcion: '  Descripción del caso\ncon detalle.  ', prioridad: '  Alta  ',
}
const serviceInput = values => ({
  clienteNombre: values.cliente_nombre, emailCliente: values.email_cliente,
  categoria: values.categoria, descripcion: values.descripcion, prioridad: values.prioridad,
})

function harness(values = valid, options = {}) {
  const slots = [], requests = [], errors = [], successes = []
  let cursor = 0, tree, closes = 0, created = 0
  const state = initial => {
    const index = cursor++
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
    return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
  }
  const { default: Modal } = loadModule('app/quejas/components/NuevaQuejaModal.tsx', {
    react: { useState: state, useRef: current => state({ current })[0] },
    '@/components/Modal': { default: 'Modal' },
    '@/components/ui/Button': { default: 'Button' },
    '@/components/ui/Select': { default: 'Select' },
    '@/lib/supabase': { supabase: { rpc: (name, args) =>
      new Promise((resolve, reject) => requests.push({ name, args, resolve, reject })) } },
    sonner: { toast: { error: message => errors.push(message), success: message => successes.push(message) } },
  }, { console: { warn() {} } })
  const props = { open: true, categorias: [], prioridades: [], onClose() { closes++ }, onCreated() {
    created++
    return options.onCreated?.()
  } }
  const visit = value => Array.isArray(value) ? value.flatMap(visit) : value?.props ? [value, ...visit(value.props.children)] : []
  const render = () => { cursor = 0; tree = Modal(props); return tree }
  const nodes = () => visit(tree)
  render()
  slots[0] = { ...values }
  render()
  return { requests, errors, successes, render, nodes,
    submit: () => nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }),
    close: () => tree.props.onClose(),
    values(next) { slots[0] = { ...slots[0], ...next }; render() },
    state: () => ({ form: slots[0], loading: slots[1], error: slots[2], saved: slots[3], closes, created }),
  }
}

test('alta interna: nombre, correo y descripción vacíos no llaman al RPC ni consumen folio', () => {
  const calls = []
  const { crearQuejaInterna } = loadModule('lib/services/quejaWorkflowService.ts', {
    '@/lib/supabase': { supabase: { rpc(...args) { calls.push(args) } } },
  })
  for (const field of ['cliente_nombre', 'email_cliente', 'descripcion']) {
    assert.throws(() => crearQuejaInterna(serviceInput({ ...valid, [field]: '   ' })), /Completa el campo/)
  }
  assert.equal(calls.length, 0)
})

test('alta interna: correo malformado o mayor de 254 caracteres se rechaza antes del transporte', () => {
  let calls = 0
  const { crearQuejaInterna } = loadModule('lib/services/quejaWorkflowService.ts', {
    '@/lib/supabase': { supabase: { rpc() { calls++ } } },
  })
  for (const email of ['persona', 'persona@', '@example.test', 'persona@example', 'per sona@example.test', 'p@example.test\nextra', `${'p'.repeat(242)}@example.test`]) {
    assert.throws(() => crearQuejaInterna(serviceInput({ ...valid, email_cliente: email })), /correo electrónico.*válido/)
  }
  assert.equal(calls, 0)
})

test('alta interna: el servicio recorta el payload y conserva el detalle multilínea', async () => {
  const calls = []
  const created = { id: 'queja-prueba', folio: '2026-001', revision: 0 }
  const { crearQuejaInterna } = loadModule('lib/services/quejaWorkflowService.ts', {
    '@/lib/supabase': { supabase: { async rpc(name, args) { calls.push({ name, args }); return { data: created, error: null } } } },
  })
  assert.equal(await crearQuejaInterna(serviceInput(valid)), created)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'crear_queja_interna')
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args)), {
    p_cliente_nombre: 'Persona de prueba', p_email_cliente: 'persona@example.test',
    p_categoria: 'Queja', p_descripcion: 'Descripción del caso\ncon detalle.', p_prioridad: 'Alta',
  })
})

test('alta interna: doble submit antes del render hace una sola escritura y bloquea el cierre', async () => {
  const modal = harness()
  const pending = modal.submit()
  await modal.submit()
  modal.close()
  assert.equal(modal.requests.length, 1)
  assert.equal(modal.state().closes, 0)
  modal.render()
  assert.equal(modal.state().loading, true)
  assert.equal(modal.nodes().find(node => node.type === 'fieldset').props.disabled, true)
  modal.requests[0].resolve({ data: { id: 'queja-prueba' }, error: null })
  await pending
  assert.equal(modal.state().loading, false)
  assert.equal(modal.state().created, 1)
  assert.equal(modal.state().closes, 1)
  assert.equal(modal.successes.length, 1)
})

test('alta interna: fallo de escritura conserva borrador, muestra error seguro y permite reintentar', async () => {
  const modal = harness()
  const pending = modal.submit()
  modal.requests[0].resolve({ data: null, error: { code: '42501', message: 'select password from private_table', details: 'token=privado' } })
  await pending
  modal.render()
  assert.deepEqual(modal.state().form, valid)
  assert.equal(modal.state().loading, false)
  assert.equal(modal.state().saved, false)
  assert.match(modal.state().error, /no tiene permiso/)
  assert.ok(modal.nodes().find(node => node.props.role === 'alert'))
  assert.doesNotMatch(JSON.stringify([modal.state().error, modal.errors]), /password|private_table|token=|privado/)
  assert.equal(modal.state().created, 0)
  const retry = modal.submit()
  assert.equal(modal.requests.length, 2)
  modal.requests[1].resolve({ data: { id: 'queja-prueba' }, error: null })
  await retry
  assert.equal(modal.successes.length, 1)
})

test('alta interna: validación accesible conserva el borrador y no inicia solicitudes', async () => {
  for (const field of ['cliente_nombre', 'email_cliente', 'descripcion']) {
    const values = { ...valid, [field]: '   ' }
    const modal = harness(values)
    await modal.submit()
    modal.render()
    assert.equal(modal.requests.length, 0)
    assert.deepEqual(modal.state().form, values)
    assert.equal(modal.state().loading, false)
    assert.match(modal.state().error, /Completa el campo/)
    assert.ok(modal.nodes().find(node => node.props.role === 'alert'))
  }
})

test('alta interna: refresco síncrono o asíncrono fallido tras guardar no permite otra escritura', async () => {
  for (const onCreated of [() => { throw new Error('Fallo de vista') }, async () => { throw new Error('Fallo de vista') }]) {
    const modal = harness(valid, { onCreated })
    const pending = modal.submit()
    modal.requests[0].resolve({ data: { id: 'queja-prueba' }, error: null })
    await pending
    modal.render()
    assert.match(modal.state().error, /ya se guardó/)
    assert.equal(modal.state().loading, false)
    assert.equal(modal.state().saved, true)
    assert.equal(modal.state().form.cliente_nombre, '')
    assert.equal(modal.state().created, 1)
    assert.equal(modal.state().closes, 0)
    assert.equal(modal.nodes().find(node => node.type === 'Button' && node.props.type === 'submit').props.disabled, true)
    await modal.submit()
    assert.equal(modal.requests.length, 1)
    modal.close()
    assert.equal(modal.state().closes, 1)
    assert.equal(modal.state().saved, false)
  }
})

test('alta interna: espera el refresco prometido con el cierre y los reintentos bloqueados', async () => {
  let resolveRefresh
  const refresh = new Promise(resolve => { resolveRefresh = resolve })
  const modal = harness(valid, { onCreated: () => refresh })
  const pending = modal.submit()
  modal.requests[0].resolve({ data: { id: 'queja-prueba' }, error: null })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(modal.state().loading, true)
  assert.equal(modal.state().created, 1)
  modal.close()
  await modal.submit()
  assert.equal(modal.requests.length, 1)
  assert.equal(modal.state().closes, 0)
  resolveRefresh()
  await pending
  assert.equal(modal.state().closes, 1)
  assert.equal(modal.state().loading, false)
})

test('alta interna: HTML exige nombre, correo y descripción con etiquetas enlazadas', () => {
  const { default: Modal } = loadModule('app/quejas/components/NuevaQuejaModal.tsx', {
    '@/components/Modal': { default: ({ children }) => createElement('section', null, children) },
    '@/lib/services/quejaWorkflowService': {},
  })
  const html = renderToStaticMarkup(createElement(Modal, { open: true, categorias: [], prioridades: [], onClose() {}, onCreated() {} }))
  assert.match(html, /for="nueva-queja-cliente"/)
  assert.match(html, /<input[^>]*id="nueva-queja-cliente"[^>]*required=""/)
  assert.match(html, /<input[^>]*id="nueva-queja-email"[^>]*type="email"[^>]*required=""[^>]*maxLength="254"/)
  assert.match(html, /<textarea[^>]*id="nueva-queja-descripcion"[^>]*required=""/)
})
