import test from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { loadModule } from './load-module.mjs'

test('el visor usa la capa modal nativa y Escape cierra únicamente el visor', () => {
  const effects = []
  let closes = 0, stopped = false, shown = 0
  const document = { body: {}, activeElement: null }
  class Element { isConnected = true; focus() { document.activeElement = this } }
  const origin = new Element()
  document.activeElement = origin
  const Preview = loadModule('components/quejas/AdjuntoPreviewModal.tsx', {
    react: { ...React, useState: value => [value, () => {}], useRef: value => ({ current: value }), useId: () => 'documento', useEffect: callback => effects.push(callback) },
    '@/lib/supabase': { supabase: {} },
    '@/lib/services/quejaWorkflowService': { descargarAdjuntoQueja() {} },
    '@/lib/services/errorToast': { showError() {} },
  }, { document, HTMLElement: Element }).default
  const element = Preview({ adjunto: { id: 'demo', nombre: 'Documento.pdf', storage_path: 'drive-id-demo', tamano: 1, tipo_mime: 'application/pdf' }, onClose: () => closes++ })
  assert.equal(element.type, 'dialog')
  element.props.ref.current = { showModal() { shown++ }, close() { document.activeElement = document.body } }
  const cleanup = effects[0]()
  assert.equal(shown, 1)
  element.props.onCancel({ preventDefault() {}, stopPropagation() { stopped = true } })
  assert.equal(closes, 1)
  assert.equal(stopped, true)
  cleanup()
  assert.equal(document.activeElement, origin)
})
