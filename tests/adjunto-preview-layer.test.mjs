import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { loadModule } from './load-module.mjs'

const viewerSource = fs.readFileSync('components/quejas/AdjuntoPreviewModal.tsx', 'utf8')
const listSource = fs.readFileSync('components/quejas/ListaAdjuntos.tsx', 'utf8')
const clientSource = fs.readFileSync('lib/services/driveClient.ts', 'utf8')

function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes)
  return value?.props ? [value, ...nodes(value.props.children)] : []
}
const file = (path = 'synthetic_drive_doc_001') => ({
  id: 'attachment-fixture', queja_id: 'qms-fixture',
  storage_path: path, nombre: 'Documento.pdf', tamano: 1024,
  tipo_mime: 'application/pdf', usuario_id: 'staff',
  created_at: '2026-11-14T10:00:00Z',
})

function listHarness(path = 'synthetic_drive_doc_001', layout = 'cards') {
  const preloads = [], opened = [], downloaded = []
  const ListaAdjuntos = loadModule('components/quejas/ListaAdjuntos.tsx', {
    '@/lib/services/driveClient': { prefetchDriveBlob: id => { if (!id.includes('/')) preloads.push(id) } },
    '@/components/ui/Button': { default: 'Button' },
    '@/components/ui/Badge': { default: 'Badge' },
    '@/lib/utils/format': { formatBytes: () => '1 KB' },
  }).default
  const adjunto = file(path)
  const tree = ListaAdjuntos({ adjuntos: [adjunto], layout,
    onPreview: item => opened.push(item), onDownload: item => downloaded.push(item) })
  return { tree, preloads, opened, downloaded, adjunto }
}

test('el visor privado usa dialog nativo, Escape y URL local revocable', () => {
  assert.match(viewerSource, /return <dialog ref=\{dialogRef\}/)
  assert.match(viewerSource, /dialog\.showModal\(\)/)
  assert.match(viewerSource, /onCancel=\{event =>/)
  assert.match(viewerSource, /URL\.createObjectURL\(blob\)/)
  assert.match(viewerSource, /URL\.revokeObjectURL\(objectUrl\)/)
  assert.match(viewerSource, /useAuthStore\.subscribe/)
  assert.doesNotMatch(viewerSource, /drive\.google\.com|createSignedUrl\(/)
})

test('las tarjetas anticipan la descarga privada al hover o focus, sin descargar al render', () => {
  const h = listHarness()
  assert.equal(h.preloads.length, 0)
  const controls = nodes(h.tree).filter(x => x.props?.['aria-label'] === 'Vista previa de Documento.pdf')
  assert.equal(controls.length, 2)
  controls[0].props.onPointerEnter()
  controls[1].props.onFocus()
  assert.deepEqual(h.preloads, [h.adjunto.storage_path, h.adjunto.storage_path])
  assert.equal(h.opened.length, 0)
  controls[0].props.onClick()
  assert.deepEqual(h.opened, [h.adjunto])
})

test('archivo de Storage no inicia precarga de Google', () => {
  const h = listHarness('legacy/documento.pdf')
  const controls = nodes(h.tree).filter(x => x.props?.['aria-label'] === 'Vista previa de Documento.pdf')
  controls[0].props.onPointerEnter()
  controls[1].props.onFocus()
  assert.equal(h.preloads.length, 0)
  controls[0].props.onClick()
  assert.equal(h.opened.length, 1)
})

test('la precarga nunca introduce URL pública, popups de Google ni almacenamiento persistente', () => {
  assert.match(listSource, /prefetchDriveBlob\(path\)/)
  assert.match(clientSource, /cache: 'no-store'/)
  assert.match(clientSource, /useAuthStore\.subscribe/)
  assert.match(clientSource, /PREVIEW_CACHE_MS = 45_000/)
  assert.match(clientSource, /MAX_PREVIEWS = 5/)
  assert.doesNotMatch(listSource + viewerSource + clientSource, /drive\.google\.com|window\.open\(/)
})
