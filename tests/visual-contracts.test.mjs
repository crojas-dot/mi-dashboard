import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

test('la limpieza tardía de una página no borra la acción de la nueva ruta', () => {
  const { useHeaderActionStore: store } = loadModule('lib/store/header-action-store.ts')
  const first = { label: 'Nuevo proceso', onClick() {} }
  const next = { label: 'Nueva queja', onClick() {} }
  store.getState().registerAction('procesos', first)
  store.getState().registerAction('quejas', next)
  const activeState = store.getState()
  store.getState().clearAction('procesos')
  assert.equal(store.getState(), activeState, 'tampoco debe notificar un cambio inexistente')
  assert.equal(store.getState().action, next)
  store.getState().clearAction('quejas')
  assert.equal(store.getState().action, null)
})

test('paginación conserva controles HTML accesibles y no envía formularios', () => {
  const { default: Pagination } = loadModule('components/ui/tailwind/Pagination.tsx', {
    '@/lib/queries/pagination': { PAGE_SIZE: 25 },
  })
  // Renderizar CoreUI real detecta props descartadas por sus componentes polymorphic.
  const html = renderToStaticMarkup(createElement(Pagination, { page: 0, count: 75, onChange() {} }))
  const buttons = [...html.matchAll(/<button\b([^>]*)>(.*?)<\/button>/g)]
  assert.equal(buttons.length, 2)
  assert.ok(buttons.every(([, attributes]) => attributes.includes('type="button"')))
  assert.match(buttons[0][1], /disabled=""/)
  assert.match(buttons[0][1], /aria-label="Página anterior"/)
  assert.match(buttons.at(-1)[1], /aria-label="Página siguiente"/)
  assert.doesNotMatch(buttons.at(-1)[1], /\sdisabled(?:=|\s|$)/)
  assert.match(html, />Página 1 de 3/)
  const busy = renderToStaticMarkup(createElement(Pagination, { page: 1, count: 75, busy: true, onChange() {} }))
  assert.equal([...busy.matchAll(/<button\b[^>]*disabled=""/g)].length, 2)
})

function modalFixture({ open = true } = {}) {
  let closes = 0
  const { default: Modal } = loadModule('components/ui/tailwind/Modal.tsx', {
    react: {
      useEffect() {},
      useId: () => 'parent',
      useRef: (current) => ({ current }),
    },
    'react-dom': { createPortal: (child) => child },
  }, { document: { body: {} } })
  const element = Modal({ open, title: 'Expediente', onClose: () => closes++, children: null })
  return { element, dialog: element, closes: () => closes }
}

test('cancelación nativa del diálogo consume Escape antes del panel de fondo', () => {
  const top = modalFixture()
  const effects = []
  const event = { key: 'Escape', defaultPrevented: false, preventDefault() { effects.push('prevent') }, stopPropagation() { effects.push('stop') } }
  top.dialog.props.onCancel(event)
  assert.equal(top.closes(), 1)
  assert.deepEqual(effects, ['prevent', 'stop'])
})

test('arrastrar desde el contenido al fondo no cierra el modal; pulsar el fondo sí', () => {
  const { dialog, closes } = modalFixture()
  const overlay = { getBoundingClientRect: () => ({ left: 10, top: 10, right: 100, bottom: 100 }) }
  dialog.props.onMouseDown({ target: {}, currentTarget: overlay })
  dialog.props.onClick({ target: overlay, currentTarget: overlay, clientX: 0, clientY: 0 })
  assert.equal(closes(), 0)
  dialog.props.onMouseDown({ target: overlay, currentTarget: overlay, clientX: 0, clientY: 0 })
  dialog.props.onClick({ target: overlay, currentTarget: overlay, clientX: 0, clientY: 0 })
  assert.equal(closes(), 1)
})

test('un modal cerrado no monta un diálogo ni modifica el scroll de otro', () => {
  assert.equal(modalFixture({ open: false }).element, null)
})
