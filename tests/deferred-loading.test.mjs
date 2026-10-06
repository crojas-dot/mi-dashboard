import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement, Suspense } from 'react'
import { renderToString } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

const { default: DeferredMount } = loadModule('components/ui/DeferredMount.tsx')

test('primera apertura renderiza el formulario sin suspender ni esperar una descarga', () => {
  const { default: NuevaQuejaModal } = loadModule('app/quejas/components/NuevaQuejaModal.tsx', {
    '@/components/ui/tailwind/Modal': { default: ({ children }) => createElement('section', { role: 'dialog' }, children) },
    '@/lib/services/errorToast': {},
    '@/lib/services/quejaWorkflowService': {},
  })
  const html = renderToString(createElement(Suspense, { fallback: 'CARGA_GLOBAL' },
    createElement('nav', null, 'Menú principal'),
    createElement('table', null, createElement('tbody', null,
      createElement('tr', null, createElement('td', null, 'QUEJA-PRUEBA')))),
    createElement(DeferredMount, { active: true }, createElement(NuevaQuejaModal, {
      open: true, onClose() {}, onCreated() {}, categorias: [], prioridades: [],
    })),
  ))
  assert.match(html, /Menú principal/)
  assert.match(html, /QUEJA-PRUEBA/)
  assert.match(html, /role="dialog"/)
  assert.match(html, /Cliente/)
  assert.match(html, /Guardar/)
  assert.doesNotMatch(html, /Abriendo/)
  assert.doesNotMatch(html, /CARGA_GLOBAL/)
})

test('un formulario nunca abierto no se monta ni inicia sus consultas', () => {
  let mounts = 0
  function Form() { mounts++; return createElement('form') }
  const html = renderToString(createElement(DeferredMount, { active: false }, createElement(Form)))
  assert.equal(mounts, 0)
  assert.equal(html, '')
})
