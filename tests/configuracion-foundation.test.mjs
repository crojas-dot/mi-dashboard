import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

const utils = loadModule('lib/utils/configuracion.ts')

test('los plazos rechazan alertas posteriores, fracciones y valores no finitos antes de escribir', () => {
  assert.equal(utils.validarPlazos(0, 1), null)
  assert.equal(utils.validarPlazos(7, 7), null)
  for (const [alerta, vencimiento] of [[8, 7], [-1, 7], [3, 0], [1.5, 7], [3, Infinity], [NaN, 7]]) assert.ok(utils.validarPlazos(alerta, vencimiento))
})

test('General conserva objetos, arrays, booleanos, números y cadenas vacías sin convertirlos a texto', () => {
  assert.equal(utils.parsearValorConfiguracion('false', true), false)
  assert.equal(utils.parsearValorConfiguracion('0', 4), 0)
  assert.equal(utils.parsearValorConfiguracion('', 'antes'), '')
  assert.equal(utils.parsearValorConfiguracion('null', null), null)
  assert.equal(JSON.stringify(utils.parsearValorConfiguracion('{"a":2}', { a: 1 })), '{"a":2}')
  assert.equal(JSON.stringify(utils.parsearValorConfiguracion('[2,3]', [1])), '[2,3]')
  assert.throws(() => utils.parsearValorConfiguracion('"false"', true))
  assert.throws(() => utils.parsearValorConfiguracion('{}', []))
  assert.throws(() => utils.parsearValorConfiguracion('{mal}', {}))
})

function service(failure = null) {
  const calls = []
  const supabase = { from(table) {
    const query = {
      update(payload) { calls.push({ table, payload }); return query },
      insert(payload) { calls.push({ table, payload }); return query },
      delete() { calls.push({ table, delete: true }); return query },
      eq(key, value) { calls.push({ filter: [key, value] }); return query },
      select(columns) { calls.push({ columns }); return query },
      single: async () => ({ error: failure }),
    }
    return query
  } }
  return { calls, ...loadModule('lib/services/configuracionService.ts', { '@/lib/supabase': { supabase } }) }
}

test('mutaciones inválidas y claves de IA se bloquean antes de consultar la BD', async () => {
  const api = service()
  await assert.rejects(api.guardarPlazo({ proceso: 'quejas', prioridad: 'Alta', dias_alerta: 8, dias_vencimiento: 7 }))
  await assert.rejects(api.guardarValorCatalogo({ modulo: 'quejas', tipo: '', valor: 'Queja' }))
  await assert.rejects(api.guardarConfiguracionGeneral({ clave: 'ai_providers', valor: [] }))
  assert.equal(api.calls.length, 0)
})

test('un guardado general solo escribe el valor y confirma la fila; los errores RLS no anuncian éxito', async () => {
  const api = service()
  await api.guardarConfiguracionGeneral({ clave: 'general.activo', valor: false })
  assert.equal(JSON.stringify(api.calls[0]), '{"table":"configuraciones_sistema","payload":{"valor":false}}')
  assert.equal(JSON.stringify(api.calls[1].filter), '["clave","general.activo"]')
  assert.equal(api.calls[2].columns, 'clave')
  const failed = service(new Error('Fila inexistente o no autorizada'))
  await assert.rejects(failed.guardarConfiguracionGeneral({ clave: 'general.activo', valor: true }), /no autorizada/)
})

test('Button conserva atributos nativos, ref y eventos; loading bloquea el envío y anuncia estado', () => {
  const { default: Button } = loadModule('components/ui/Button.tsx')
  const onClick = () => {}, ref = { current: null }
  const element = Button({ children: 'Guardar', onClick, ref, 'aria-label': 'Guardar ajuste', form: 'editor' })
  assert.equal(element.props.onClick, onClick)
  assert.equal(element.props.ref, ref)
  assert.equal(element.props.form, 'editor')
  assert.equal(element.props.type, 'button')
  const html = renderToStaticMarkup(createElement(Button, { type: 'submit', loading: true }, 'Guardar'))
  assert.match(html, /disabled=""/)
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /role="status"/)
})

test('filas interactivas admiten teclado y dejan que los controles internos manejen su propio evento', () => {
  const { TableRow } = loadModule('components/ui/Table.tsx')
  let clicks = 0
  const row = TableRow({ onClick() {}, children: 'Caso' })
  assert.equal(row.props.tabIndex, 0)
  const target = { click: () => clicks++ }
  const event = { key: 'Enter', currentTarget: target, target, preventDefault() {} }
  row.props.onKeyDown(event)
  row.props.onKeyDown({ ...event, target: {} })
  assert.equal(clicks, 1)
})

test('Configuración no monta secciones ni dispara consultas para un usuario sin rol admin', () => {
  let reads = 0
  const { default: Page } = loadModule('app/configuracion/page.tsx', {
    'next/navigation': { useRouter: () => ({ replace() {} }) },
    '@tanstack/react-query': { useQueryClient: () => ({}) },
    '@/lib/store/auth-store': { useAuthStore: selector => selector({ initialized: true, user: { rol: 'colaborador' } }) },
    '@/lib/queries/useCatalogos': { useCatalogos() { reads++; throw new Error('No debe consultar') } },
    '@/lib/supabase': { supabase: {} },
  })
  const html = renderToStaticMarkup(createElement(Page))
  assert.match(html, /Verificando acceso/)
  assert.doesNotMatch(html, /Secciones de configuración/)
  assert.equal(reads, 0)
})

test('la consulta de General excluye proveedores, enrutamiento y futuros ajustes ai_*', async () => {
  const excluded = []
  const result = [{ clave: 'drive_folder_id_quejas', valor: 'folder', categoria: 'general' }, { clave: 'ai_futuro', valor: 'privado' }]
  const query = {
    select() { return query }, not(...args) { excluded.push(args); return query }, order() { return query },
    then(resolve) { return Promise.resolve({ data: result, error: null }).then(resolve) },
  }
  const api = loadModule('lib/services/configuracionService.ts', { '@/lib/supabase': { supabase: { from: () => query } } })
  const data = await api.fetchConfiguracionesGenerales()
  assert.equal(data.length, 1)
  assert.equal(data[0].clave, 'drive_folder_id_quejas')
  assert.match(excluded[0][2], /ai_providers/)
})

test('los avisos y la consola no publican credenciales ni detalles SQL del error', () => {
  const messages = [], logged = []
  const api = loadModule('lib/services/errorToast.ts', { sonner: { toast: { error: message => messages.push(message), success() {} } } }, { console: { warn: (...args) => logged.push(args) } })
  api.showError({ code: '23505', message: 'duplicate private_customer', details: 'api_key=privado', hint: 'secret=123' }, 'No se pudo guardar')
  api.showError(new Error('Bearer sk-proj-privado'), 'No se pudo conectar')
  api.showError(new Error('Invalid API key provided: sk-abcdefghijk1234'), 'No se pudo conectar')
  api.showError(new Error('gsk_privado123456'), 'No se pudo conectar')
  assert.doesNotMatch(JSON.stringify({ messages, logged }), /privado|private_customer|secret=123|abcdefghijk1234/)
  assert.equal(api.errorMsg(new Error('Completá el nombre del catálogo.')), 'Completá el nombre del catálogo.')
})
