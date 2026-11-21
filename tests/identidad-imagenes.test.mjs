import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { loadModule } from './load-module.mjs'

const ORIGIN = 'https://qms.test'
const UUID = '11111111-1111-4111-8111-111111111111'
const marcas = loadModule('lib/constants/identidad.ts')

test('cada recurso institucional tiene clave, aspecto y nombre separados', () => {
  assert.deepEqual(Array.from(marcas.IDENTIDAD_SLOTS), ['correo_encabezado', 'correo_cuadrado', 'login_encabezado', 'login_fondo', 'formulario_encabezado'])
  assert.equal(marcas.IDENTIDAD_IMAGENES.login_fondo.proporcion, 16 / 9)
  assert.equal(marcas.IDENTIDAD_IMAGENES.correo_encabezado.proporcion, 3)
  assert.equal(marcas.IDENTIDAD_IMAGENES.login_encabezado.proporcion, 3)
  assert.equal(marcas.IDENTIDAD_IMAGENES.formulario_encabezado.proporcion, 3)
  assert.equal(marcas.IDENTIDAD_IMAGENES.correo_encabezado.formato, 'png')
  assert.equal(marcas.IDENTIDAD_IMAGENES.correo_cuadrado.ancho, 128)
  assert.equal(marcas.IDENTIDAD_IMAGENES.correo_cuadrado.alto, 128)
  assert.equal(new Set(marcas.IDENTIDAD_SLOTS.map(slot => marcas.IDENTIDAD_IMAGENES[slot].clave)).size, marcas.IDENTIDAD_SLOTS.length)
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
  return { api, client, config, objects, logs, makeRequest }
}

test('escritura de imágenes se rechaza para cuentas no administradoras', async () => {
  for (const rol of [null, 'colaborador', 'calidad']) {
    const f = fixture({ rol })
    const result = await f.api.PUT(f.makeRequest(new File([FOTO], 'fondo.png', { type: 'image/png' })))
    assert.equal(result.status, rol ? 403 : 401)
    assert.equal((await f.api.DELETE({ signal: undefined })).status, rol ? 403 : 401)
    assert.equal(f.logs.length, 0)
  }
})

test('solo administración guarda un estilo permitido y la lectura pública tiene respaldo horizontal', async () => {
  const request = emailLogoStyle => ({ signal: undefined, json: async () => ({ emailLogoStyle }) })
  for (const rol of [null, 'calidad']) {
    const denied = fixture({ rol })
    assert.equal((await denied.api.PATCH(request('cuadrado'))).status, rol ? 403 : 401)
    assert.equal(denied.logs.length, 0)
  }
  const f = fixture()
  assert.equal((await f.api.GET({})).body.emailLogoStyle, 'horizontal')
  assert.equal((await f.api.PATCH(request('vertical'))).status, 400)
  assert.equal((await f.api.PATCH(request('cuadrado'))).status, 200)
  assert.equal((await f.api.GET({})).body.emailLogoStyle, 'cuadrado')
  assert.equal(f.logs.length, 1)
})

test('el proxy deja leer solo el GET de identidad pública y retira encabezados de identidad', async () => {
  const { proxy } = loadModule('proxy.ts', {
    'next/server': { NextResponse: {
      json: Response.json,
      next: ({ request }) => {
        assert.equal(request.headers.has('x-user-role'), false)
        return new Response(null, { status: 200 })
      },
    } },
    '@/lib/server/auth': {
      getAuthToken: () => null,
      getCurrentUser: () => { throw new Error('No debe consultar identidad en esta solicitud') },
    },
  })
  const probar = async (method, path = '/api/configuracion/identidad') => {
    const request = new Request(ORIGIN + path, { method, headers: { 'x-user-role': 'admin' } })
    request.nextUrl = new URL(request.url)
    return (await proxy(request)).status
  }
  assert.equal(await probar('GET'), 200)
  assert.equal(await probar('PUT'), 401)
  assert.equal(await probar('DELETE'), 401)
  assert.equal(await probar('GET', '/api/configuracion/identidad/otro'), 401)
})

test('imagen institucional se convierte en WebP, se publica y se retira por slot', async () => {
  const f = fixture()
  const respuesta = await f.api.PUT(f.makeRequest(new File([FOTO], 'fondo.png', { type: 'image/png' })))
  assert.equal(respuesta.status, 200)
  const path = f.logs.find(value => value[0] === 'upload')[1]
  const image = await sharp(f.objects.get(path)).metadata()
  assert.equal(image.format, 'webp')
  // Un origen pequeño no debe agrandarse artificialmente para cubrir la medida sugerida.
  assert.equal(image.width, 90)
  assert.equal(image.height, 60)
  const clave = marcas.IDENTIDAD_IMAGENES.login_fondo.clave
  assert.equal(f.config.get(clave), respuesta.body.imagen)
  const lectura = await f.api.GET({ signal: undefined })
  assert.equal(lectura.status, 200)
  assert.equal(lectura.body.imagenes.login_fondo, respuesta.body.imagen)
  assert.equal(lectura.body.configuradas.login_fondo, true)
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

test('los logos de correo, login y formulario conservan un marco horizontal con transparencia', async () => {
  for (const [slot, extension, width, height] of [
    ['correo_encabezado', 'png', 900, 300],
    ['login_encabezado', 'png', 900, 300],
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
    // La imagen de prueba es 3:2: debe ocupar el centro sin quedar recortada a 3:1.
    const esquina = await sharp(f.objects.get(path)).extract({ left: 2, top: 150, width: 1, height: 1 }).ensureAlpha().raw().toBuffer()
    assert.equal(esquina[3], 0, 'los márgenes del logo deben seguir transparentes')
    assert.equal(res.body.slot, slot)
    assert.equal(f.config.get(marcas.IDENTIDAD_IMAGENES[slot].clave), res.body.imagen)
    assert.ok(!res.body.imagen.includes('correo_pie'))
  }
})

test('el login usa su propio logo y conserva el fondo al quitarlo', async () => {
  const f = fixture()
  const logo = ORIGIN + '/storage/v1/object/public/branding/identidad/login_encabezado/' + UUID + '.png'
  const fondo = ORIGIN + '/storage/v1/object/public/branding/identidad/login_fondo/' + UUID + '.webp'
  const logoLateral = ORIGIN + '/storage/v1/object/public/branding/logo-123.png'
  f.config.set(marcas.IDENTIDAD_IMAGENES.login_encabezado.clave, logo)
  f.config.set(marcas.IDENTIDAD_IMAGENES.login_fondo.clave, fondo)
  f.config.set('org.logo_url', logoLateral)
  const { identidadLoginInicial } = loadModule('lib/server/identidad-publica.ts', {
    '@/lib/server/supabase-admin': { createServiceClient: () => f.client },
  })
  assert.deepEqual({ ...await identidadLoginInicial() }, { logo, fondo })
  const resultado = await f.api.DELETE({ signal: undefined, json: async () => ({ slot: 'login_encabezado' }) })
  assert.equal(resultado.status, 200)
  assert.deepEqual({ ...await identidadLoginInicial() }, { logo: '', fondo })
  assert.equal(f.config.get('org.logo_url'), logoLateral)
})

test('un fondo de alta resolución conserva nitidez hasta el máximo de 2560 × 1440', async () => {
  const f = fixture()
  const grande = await sharp({ create: { width: 3200, height: 1800, channels: 3, background: '#224466' } }).png().toBuffer()
  const respuesta = await f.api.PUT(f.makeRequest(new File([grande], 'fondo-hd.png', { type: 'image/png' })))
  assert.equal(respuesta.status, 200)
  const path = f.logs.find(value => value[0] === 'upload')[1]
  const meta = await sharp(f.objects.get(path)).metadata()
  assert.equal(meta.width, 2560)
  assert.equal(meta.height, 1440)
  assert.equal(meta.format, 'webp')
})

test('las recomendaciones son solo sugerencias; el tamaño original puede ser mayor al del archivo enviado', () => {
  assert.equal(marcas.IDENTIDAD_ORIGEN_MAX_BYTES, 30 * 1024 * 1024)
  assert.equal(marcas.IDENTIDAD_MAX_BYTES, 4 * 1024 * 1024)
  assert.equal(marcas.IDENTIDAD_STORED_BYTES, 2 * 1024 * 1024)
  assert.ok(marcas.IDENTIDAD_ACCEPT.includes('image/avif'))
  assert.ok(marcas.IDENTIDAD_ACCEPT.includes('image/gif'))
  assert.equal(marcas.IDENTIDAD_ACCEPT_PICKER, 'image/*')
})

test('GET reconstruye la URL pública canónica aunque la configuración tenga un host antiguo', async () => {
  const f = fixture()
  const clave = marcas.IDENTIDAD_IMAGENES.login_fondo.clave
  f.config.set(clave, `https://almacen-anterior.example.test/storage/v1/object/public/branding/identidad/login_fondo/${UUID}.webp`)
  const res = await f.api.GET({ signal: undefined })
  assert.equal(res.status, 200)
  assert.equal(res.body.imagenes.login_fondo,
    `${ORIGIN}/storage/v1/object/public/branding/identidad/login_fondo/${UUID}.webp`)
  assert.ok(!res.body.imagenes.login_fondo.includes('almacen-anterior.example.test'))
})

test('identidad distingue un archivo guardado de una vista previa ilegible', async () => {
  const f = fixture()
  f.config.set(marcas.IDENTIDAD_IMAGENES.login_fondo.clave, 'https://invalido.example.test/icon.svg')
  const res = await f.api.GET({ signal: undefined })
  assert.equal(res.status, 200)
  assert.equal(res.body.configuradas.login_fondo, true)
  assert.equal(res.body.imagenes.login_fondo, '')
  assert.equal(res.body.configuradas.correo_encabezado, false)
})

test('la ruta rechaza sustituciones de bucket, subdirectorios y archivos arbitrarios', () => {
  const url = `${ORIGIN}/storage/v1/object/public/branding/identidad/login_fondo/${UUID}.webp`
  for (const invalid of [
    url.replace('/branding/', '/qms-avatars/'),
    url.replace('/login_fondo/', '/correo_encabezado/'),
    url.replace('.webp', '.svg'),
    url.replace('/' + UUID + '.webp', '/../../../secreto.webp'),
    url + '#hash',
    url.replace('https:', 'javascript:'),
  ]) assert.equal(marcas.rutaImagenIdentidad('login_fondo', invalid), null)
})
