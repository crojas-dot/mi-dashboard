import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

const { default: FotoPerfil } = loadModule('components/perfil/FotoPerfil.tsx', {
  'next/image': { __esModule: true, default: 'img' },
})

test('cuando el usuario tiene foto configurada, no se muestran las iniciales durante la carga', () => {
  const pending = renderToStaticMarkup(React.createElement(FotoPerfil, {
    url: undefined, initials: 'CR', hasPhoto: true, size: 40, className: 'size-10',
  }))
  assert.match(pending, /data-avatar-loading/)
  assert.doesNotMatch(pending, />CR</)
  const pendingFetch = renderToStaticMarkup(React.createElement(FotoPerfil, {
    url: 'blob:https://qms.test/111', initials: 'CR', hasPhoto: true, size: 40, className: 'size-10',
  }))
  assert.match(pendingFetch, /data-avatar-loading/)
  assert.doesNotMatch(pendingFetch, />CR</)
})

test('si el usuario no tiene foto, sus iniciales aparecen sin estado de carga', () => {
  const withoutPhoto = renderToStaticMarkup(React.createElement(FotoPerfil, {
    initials: 'CR', hasPhoto: false, size: 40, className: 'size-10',
  }))
  assert.match(withoutPhoto, />CR</)
  assert.doesNotMatch(withoutPhoto, /data-avatar-loading/)
})

test('el fondo login no tapa la imagen con una capa blanca intensa', () => {
  const fs = requireSource()
  assert.match(fs, /data-login-fondo/)
  assert.match(fs, /bg-black\/10/)
  assert.doesNotMatch(fs, /bg-white\/70/)
})

function requireSource() {
  return loadModule('components/identidad/FondoIdentidad.tsx', {
    '@/lib/queries/useIdentidadImagenes': { useIdentidadImagenes: () => ({ data: { login_fondo: '' } }) },
  }).default.toString()
}
