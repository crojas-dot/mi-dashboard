import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { loadModule } from './load-module.mjs'

const ORIGIN = 'https://qms.test'
const UUID = '11111111-1111-4111-8111-111111111111'
const marcas = loadModule('lib/constants/identidad.ts')

test('cada recurso institucional tiene clave, aspecto y nombre separados', () => {
  assert.deepEqual(Array.from(marcas.IDENTIDAD_SLOTS), ['correo_encabezado', 'login_fondo', 'formulario_encabezado'])
  assert.equal(marcas.IDENTIDAD_IMAGENES.login_fondo.proporcion, 16 / 9)
  assert.equal(marcas.IDENTIDAD_IMAGENES.correo_encabezado.proporcion, 1)
  assert.equal(marcas.IDENTIDAD_IMAGENES.formulario_encabezado.proporcion, 3)
  assert.equal(marcas.IDENTIDAD_IMAGENES.correo_encabezado.formato, 'png')
  assert.equal(new Set(marcas.IDENTIDAD_SLOTS.map(slot => marcas.IDENTIDAD_IMAGENES[slot].clave)).size, 3)
})

test('solo se admiten URL del bucket institucional y del slot correcto', () => {
  const url = `${ORIGIN}/storage/v1/object/public/branding/identidad/login_fondo/${UUID}.webp`
  assert.equal(marcas.urlIdentidadValida('login_fondo', url, ORIGIN), url)
  assert.equal(marcas.rutaImagenIdentidad('login_fondo', url, ORIGIN), `identidad/login_fondo/${UUID}.webp`)
  const logoCorreo = `${ORIGIN}/storage/v1/object/public/branding/identidad/correo_encabezado/${UUID}.png`
  assert.equal(marcas.urlIdentidadValida('correo_encabezado', logoCorreo, ORIGIN), logoCorreo)
  assert.equal(marcas.urlIdentidadValida('correo_encabezado', logoCorreo.replace('.png', '.webp'), ORIGIN), '')
  for (const invalid of [
    url.replace('qms.test','otro.test'),
    url.replace('/login_fondo/','/formulario_encabezado/'),
    url + '?v=2',
    url.replace('public/branding','public/qms-avatars'),
    url.replace('.webp','.svg'),
    'javascript:alert(1)',
    url.replace('https:', 'http:'),
  ]) assert.equal(marcas.urlIdentidadValida('login_fondo', invalid, ORIGIN), '')
})

const FOTO = await sharp({ create: { width: 90, height: 60, channels: 3, background: '#024796' } }).png().toBuffer()

function fixture({ rol = 'admin' } = {}) {
  const config = new Map(), objects = new Map(), logs = []
  const client = {
    from(table) {
      assert.equal(table, 'configuraciones_sistema')
      let clave
      const query = {
        select() { return query },
        in(_column, keys) {
          return Promise.resolve({ data: keys.filter(key => config.has(key)).map(key => ({ clave: key, valor: config.get(key) })), error: null })
        },
        eq(_col, value) { clave = value; return query },
        async maybeSingle() { return { data: config.has(clave) ? { valor: config.get(clave) } : null, error: null } },
        upsert(value) { config.set(value.clave, value.valor); logs.push(['upsert', value.clave]); return query },
        async single() { return { data: { valor: config.get(clave) }, error: null } },
      }
      return query
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'branding')
      return {
        async upload(path, bytes, opts) { objects.set(path, bytes); logs.push(['upload', path, opts]); return { error: null } },
        async remove(paths) { paths.forEach(path => objects.delete(path)); logs.push(['remove', ...paths]); return { error: null } },
        getPublicUrl: path => ({ data: { publicUrl: `${ORIGIN}/storage/v1/object/public/branding/${path}` } }),
      }
    }},
  }
  const api = loadModule('app/api/configuracion/identidad/route.ts', {
    'next/server': { NextResponse: { json: (value, opts = {}) => ({ body: value, status: opts.status ?? 200 }) } },
    '@/lib/server/auth': { getCurrentUser: async () => rol ? { id: UUID, rol } : null },
    '@/lib/server/rateLimit': { rateLimit: () => true },
    '@/lib/server/supabase-admin': { createServiceClient: () => client },
    sharp: { default: sharp },
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: ORIGIN } } })
  const makeRequest = (file, slot = 'login_fondo') => ({ signal: undefined, formData: async () => {
    const data = new FormData()
    data.set('slot', slot)
    if (file) data.set('archivo', file)
    return data
  }})
  return { api, config, objects, logs, makeRequest }
}

test('escritura de imágenes se rechaza para cuentas no administradoras', async () => {
  for (const rol of [null, 'colaborador', 'calidad']) {
    const f = fixture({ rol })
    const result = await f.api.PUT(f.makeRequest(new File([FOTO], 'fondo.png', { type: 'image/png' })))
    assert.equal(result.status, rol ? 403 : 401)
    assert.equal(f.logs.length, 0)
  }
})

test('imagen institucional se convierte en WebP, se publica y se retira por slot', async () => {
  const f = fixture()
  const respuesta = await f.api.PUT(f.makeRequest(new File([FOTO], 'fondo.png', { type: 'image/png' })))
  assert.equal(respuesta.status, 200)
  const path = f.logs.find(value => value[0] === 'upload')[1]
  const image = await sharp(f.objects.get(path)).metadata()
  assert.equal(image.format, 'webp')
  assert.equal(image.width, 1600)
  assert.equal(image.height, 900)
  const clave = marcas.IDENTIDAD_IMAGENES.login_fondo.clave
  assert.equal(f.config.get(clave), respuesta.body.imagen)
  const lectura = await f.api.GET({ signal: undefined })
  assert.equal(lectura.status, 200)
  assert.equal(lectura.body.imagenes.login_fondo, respuesta.body.imagen)
  assert.equal(lectura.body.imagenes.correo_encabezado, '')
  assert.equal(lectura.body.imagenes.formulario_encabezado, '')
  const quitar = await f.api.DELETE({ signal: undefined, json: async () => ({ slot: 'login_fondo' }) })
  assert.equal(quitar.status, 200)
  assert.equal(f.config.get(clave), '')
})

test('el endpoint no admite SVG ni claves inventadas', async () => {
  const f = fixture()
  const req = f.makeRequest(new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }))
  assert.equal((await f.api.PUT(req)).status, 400)
  assert.equal((await f.api.DELETE({ signal: undefined, json: async () => ({ slot: 'otra' }) })).status, 400)
  assert.equal(f.objects.size, 0)
})

test('logo del correo se guarda como PNG cuadrado y logo del formulario como WebP horizontal', async () => {
  for (const [slot, extension, width, height] of [
    ['correo_encabezado', 'png', 512, 512],
    ['formulario_encabezado', 'webp', 900, 300],
  ]) {
    const f = fixture()
    const res = await f.api.PUT(f.makeRequest(new File([FOTO], 'logo.png', { type: 'image/png' }), slot))
    assert.equal(res.status, 200)
    const path = f.logs.find(v => v[0] === 'upload')[1]
    assert.ok(path.endsWith('.' + extension))
    const meta = await sharp(f.objects.get(path)).metadata()
    assert.equal(meta.format, extension)
    assert.equal(meta.width, width)
    assert.equal(meta.height, height)
    assert.equal(res.body.slot, slot)
    assert.equal(f.config.get(marcas.IDENTIDAD_IMAGENES[slot].clave), res.body.imagen)
    assert.ok(!res.body.imagen.includes('correo_pie'))
  }
})
