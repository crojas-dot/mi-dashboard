import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { readFileSync } from 'node:fs'
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


test('fondo login se precarga sin esperar el fetch de TanStack Query', () => {
  const origen = 'https://qms.test/storage/v1/object/public/branding/identidad/login_fondo/ejemplo.webp'
  const Fondo = loadModule('components/identidad/FondoIdentidad.tsx', {
    '@/lib/queries/useIdentidadImagenes': { useIdentidadImagenes: () => ({ data: undefined }) },
  }).default
  const html = renderToStaticMarkup(React.createElement(Fondo, {
    slot: 'login_fondo', initialUrl: origen,
  }, React.createElement('main', null, 'Iniciar sesión')))
  assert.match(html, /data-login-fondo/)
  assert.ok(html.includes(origen))
  assert.ok(html.includes('Iniciar sesión'))
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

test('login muestra el logo y el nombre dentro de la tarjeta, sin cabecera flotante', () => {
  const page = readFileSync('app/login/page.tsx', 'utf8')
  const section = page.indexOf('<section aria-labelledby="login-title"')
  const header = page.indexOf('<header className=', section)
  const form = page.indexOf('<form', header)
  assert.ok(section >= 0 && header > section && form > header)
  assert.match(page, /useLogoLogin/)
  assert.match(page, /Gestión de Calidad/)
  assert.match(page, /text-qms-dark">QMS/)
  assert.doesNotMatch(page, /ECA-QMS<\/span>/)
})

test('el fondo login se mantiene durante la comprobación de sesión', () => {
  const source = readFileSync('components/SessionScreen.tsx', 'utf8')
  assert.match(source, /layout === 'login' \? 'bg-transparent'/)
  const fondo = readFileSync('components/identidad/FondoIdentidad.tsx', 'utf8')
  assert.match(fondo, /fetchPriority="high"/)
  assert.match(fondo, /initialUrl \|\| data\?\.\[slot\]/)
})

test('el editor de marca mantiene proporciones y contraste con logos blancos', () => {
  const editor = readFileSync('app/configuracion/components/LogoEmpresaEditor.tsx', 'utf8')
  assert.match(editor, /data-logo-preview/)
  assert.match(editor, /sm:w-52/)
  assert.match(editor, /bg-\[#273342\]/)
  assert.match(editor, /Logo configurado/)
})
