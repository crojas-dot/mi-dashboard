import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync('app/usuarios/page.tsx', 'utf8')
const menu = fs.readFileSync('app/usuarios/components/UsuarioAccionesMenu.tsx', 'utf8')

test('Usuario ocupa solo 24% y las demás columnas comienzan más a la izquierda', () => {
  const cols = page.match(/<colgroup>([\s\S]*?)<\/colgroup>/)
  assert.ok(cols, 'la tabla conserva colgroup explícito para las seis columnas')
  const widths = Array.from(cols[1].matchAll(/w-\[(\d+)%\]/g), match => Number(match[1]))
  assert.deepEqual(widths, [24, 14, 13, 19, 18, 12])
  assert.equal(widths.reduce((sum, width) => sum + width, 0), 100)
  const starts = widths.slice(0, -1).reduce((acc, width) => [...acc, (acc.at(-1) ?? 0) + width], [])
  const previousStarts = [32, 45, 57, 74, 93]
  starts.forEach((value, index) => assert.ok(value < previousStarts[index], 'la columna ' + (index + 2) + ' comienza antes'))
  assert.ok(widths[0] >= 24, 'se conserva espacio para nombre y correo')
  assert.ok(widths[5] >= 12, 'Acciones tiene aire sin recortar el menú')
})

test('la letra A de Acciones coincide con el eje de tres puntos, sin trucos de ancho', () => {
  assert.match(page, /<TableHeaderCell className="pl-\[18px\] text-left">Acciones<\/TableHeaderCell>/)
  assert.match(page, /<TableCell className="pl-0 text-left">\s*<UsuarioAccionesMenu/)
  assert.doesNotMatch(page, /w-\[18px\] justify-end whitespace-nowrap">Acciones/)
  assert.match(menu, /inline-flex size-9/)
  assert.match(menu, /<MoreVertical aria-hidden="true" className="size-\[18px\]"/)
  // Celda pl-0: icono de 18px centrado en botón de 36px => eje x = 18px.
  assert.match(menu, /data-users-action-trigger/)
  assert.match(menu, /createPortal\(/)
})

test('se conservan las seis columnas, el menú y la versión móvil independientes', () => {
  const order = ['Usuario', 'Rol', 'Estado', 'Seguridad (2FA)', 'Último acceso', 'Acciones']
  const headers = page.match(/<TableHead[\s\S]*?<\/TableHead>/)?.[0] ?? ''
  let prev = -1
  for (const title of order) {
    const pos = headers.indexOf(title)
    assert.ok(pos > prev, title + ' conserva el orden')
    prev = pos
  }
  assert.match(page, /data-users-mobile-list/)
  assert.match(page, /xl:hidden/)
  assert.match(page, /usuariosVisibles\.map\(\(u\) =>/)
  assert.match(menu, /onEditar/)
  assert.match(menu, /onRestablecer/)
  assert.match(menu, /onEstado/)
})
