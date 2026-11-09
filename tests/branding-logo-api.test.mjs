import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const marca = loadModule('lib/constants/marca.ts')
const URL_MARCA = 'https://qms.test/storage/v1/object/public/branding/logo-viejo.png'
const URL_AJENA = 'https://qms.test/storage/v1/object/public/quejas-adjuntos/adjunto.png'
// El handler corre en otro contexto: se copian sus salidas antes de compararlas.
const plano = (valor) => JSON.parse(JSON.stringify(valor))

function preparar({ rol = 'admin', valor = '', subidaError = null, upsertError = null, borradoError = null } = {}) {
  const llamadas = { subidas: [], borrados: [], filas: [], privilegioSinSesion: 0 }
  let guardada = valor
  const consulta = {
    select() { return consulta },
    eq() { return consulta },
    maybeSingle: () => Promise.resolve({ data: guardada === null ? null : { valor: guardada }, error: null }),
    upsert(fila) {
      llamadas.filas.push(fila)
      if (!upsertError) guardada = fila.valor
      return consulta
    },
    single: () => Promise.resolve(upsertError ? { data: null, error: upsertError } : { data: { valor: guardada }, error: null }),
  }
  const storage = {
    from: (bucket) => ({
      upload: async (nombre, cuerpo, opciones) => {
        llamadas.subidas.push({ bucket, nombre, cuerpo, opciones })
        return subidaError ? { error: subidaError } : { error: null }
      },
      remove: async (nombres) => {
        llamadas.borrados.push({ bucket, nombres })
        return borradoError ? { error: borradoError } : { error: null }
      },
      getPublicUrl: (nombre) => ({ data: { publicUrl: `https://qms.test/storage/v1/object/public/${bucket}/${nombre}` } }),
    }),
  }
  const modulo = loadModule('app/api/configuracion/logo/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    '@/lib/server/auth': { getCurrentUser: async () => rol ? { rol } : null },
    '@/lib/server/supabase-admin': {
      createServiceClient: () => {
        if (!rol) llamadas.privilegioSinSesion++
        return { from: () => consulta, storage }
      },
    },
  })
  const adjunto = (tipo, bytes = 4) => new File([new Uint8Array(bytes)], 'logo', { type: tipo })
  const pedido = (datos) => ({ signal: undefined, formData: async () => datos })
  const formulario = (archivo) => {
    const datos = new FormData()
    if (archivo) datos.append('archivo', archivo)
    return datos
  }
  return { ...modulo, llamadas, adjunto, pedido, formulario, get valor() { return guardada } }
}

test('la lectura del logo es pública para sesiones activas y nunca expone basura de la clave', async () => {
  const anonimo = preparar({ rol: null })
  assert.equal((await anonimo.GET(anonimo.pedido(null))).status, 401)
  assert.equal(anonimo.llamadas.privilegioSinSesion, 0, 'sin sesión no se toca el service role')

  const vacio = preparar({ valor: '' })
  const sinFila = preparar({ valor: null })
  const basura = preparar({ valor: '""' })
  for (const api of [vacio, sinFila, basura]) {
    const respuesta = await api.GET(api.pedido(null))
    assert.equal(respuesta.status, 200)
    assert.deepEqual(plano(respuesta.body), { logoUrl: '' })
  }

  const conLogo = preparar({ valor: URL_MARCA, rol: 'colaborador' })
  assert.deepEqual(plano((await conLogo.GET(conLogo.pedido(null))).body), { logoUrl: URL_MARCA })
})

test('solo el administrador escribe y la validación rechaza antes de tocar Storage', async () => {
  const comun = preparar({ rol: 'colaborador' })
  assert.equal((await comun.PUT(comun.pedido(comun.formulario(comun.adjunto('image/png'))))).status, 403)
  assert.equal((await comun.DELETE(comun.pedido(null))).status, 403)
  assert.equal(comun.llamadas.subidas.length, 0)

  const anonimo = preparar({ rol: null })
  assert.equal((await anonimo.PUT(anonimo.pedido(anonimo.formulario(anonimo.adjunto('image/png'))))).status, 401)
  assert.equal((await anonimo.DELETE(anonimo.pedido(null))).status, 401)
  assert.equal(anonimo.llamadas.privilegioSinSesion, 0)

  const admin = preparar()
  assert.equal((await admin.PUT(admin.pedido(admin.formulario(null)))).status, 400, 'sin archivo')
  assert.equal((await admin.PUT(admin.pedido(admin.formulario('no-es-archivo')))).status, 400, 'campo que no es File')
  assert.equal((await admin.PUT(admin.pedido(admin.formulario(admin.adjunto('image/svg+xml'))))).status, 400, 'SVG fuera del contrato')
  assert.equal((await admin.PUT(admin.pedido(admin.formulario(admin.adjunto('image/webp', marca.LOGO_MAX_BYTES + 1))))).status, 400, 'supera el tope del bucket')
  assert.equal(admin.llamadas.subidas.length, 0, 'ninguna validación fallida sube archivos')
})

test('el alta sube el cuadrado versionado, guarda la URL y retira el objeto anterior del bucket', async () => {
  const api = preparar({ valor: URL_MARCA })
  const respuesta = await api.PUT(api.pedido(api.formulario(api.adjunto('image/webp'))))
  assert.equal(respuesta.status, 200)
  assert.match(respuesta.body.logoUrl, /^https:\/\/qms\.test\/storage\/v1\/object\/public\/branding\/logo-\d+\.webp$/)

  const [subida] = api.llamadas.subidas
  assert.equal(subida.bucket, marca.LOGO_BUCKET)
  assert.deepEqual(plano(subida.opciones), { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
  assert.equal(subida.cuerpo.byteLength, 4)
  assert.deepEqual(plano(api.llamadas.filas), [{
    clave: 'org.logo_url', valor: respuesta.body.logoUrl,
    descripcion: 'URL pública del logo mostrado en el menú lateral', categoria: 'general',
  }])
  assert.equal(api.valor, respuesta.body.logoUrl, 'la clave queda con la URL nueva')
  assert.deepEqual(plano(api.llamadas.borrados), [{ bucket: marca.LOGO_BUCKET, nombres: ['logo-viejo.png'] }])
})

test('una URL previa de otro bucket no se borra y la extensión sigue al tipo admitido', async () => {
  const api = preparar({ valor: URL_AJENA })
  const respuesta = await api.PUT(api.pedido(api.formulario(api.adjunto('image/jpeg'))))
  assert.equal(respuesta.status, 200)
  assert.equal(api.valor, respuesta.body.logoUrl)
  assert.deepEqual(plano(api.llamadas.borrados), [], 'no se borra un objeto ajeno al bucket de marca')
  assert.match(respuesta.body.logoUrl, /\.jpg$/)
})

test('si la clave no se puede persistir se retira el objeto recién subido', async () => {
  const api = preparar({ upsertError: { message: 'boom' } })
  const respuesta = await api.PUT(api.pedido(api.formulario(api.adjunto('image/png'))))
  assert.equal(respuesta.status, 500)
  assert.equal(api.llamadas.subidas.length, 1)
  assert.deepEqual(plano(api.llamadas.borrados[0].nombres), [api.llamadas.subidas[0].nombre], 'sin fila, el objeto queda huérfano')
})

test('si la subida falla no se escribe la clave', async () => {
  const api = preparar({ valor: URL_MARCA, subidaError: { message: 'boom' } })
  assert.equal((await api.PUT(api.pedido(api.formulario(api.adjunto('image/png'))))).status, 500)
  assert.equal(api.llamadas.filas.length, 0)
  assert.equal(api.valor, URL_MARCA)
})

test('quitar el logo borra el objeto del bucket y limpia la clave; un fallo de borrado la conserva', async () => {
  const api = preparar({ valor: URL_MARCA })
  const respuesta = await api.DELETE(api.pedido(null))
  assert.equal(respuesta.status, 200)
  assert.deepEqual(plano(respuesta.body), { logoUrl: '' })
  assert.deepEqual(plano(api.llamadas.borrados), [{ bucket: marca.LOGO_BUCKET, nombres: ['logo-viejo.png'] }])
  assert.equal(api.valor, '')

  const ajeno = preparar({ valor: URL_AJENA })
  assert.equal((await ajeno.DELETE(ajeno.pedido(null))).status, 200)
  assert.deepEqual(plano(ajeno.llamadas.borrados), [])
  assert.equal(ajeno.valor, '', 'solo se limpia la referencia propia')

  const fallo = preparar({ valor: URL_MARCA, borradoError: { message: 'boom' } })
  assert.equal((await fallo.DELETE(fallo.pedido(null))).status, 500)
  assert.equal(fallo.valor, URL_MARCA, 'no se libera la referencia si el archivo sigue en Storage')
})

test('el bucket y los límites del contrato coinciden con la migración aplicada', () => {
  assert.equal(marca.LOGO_BUCKET, 'branding')
  assert.equal(marca.LOGO_CLAVE, 'org.logo_url')
  assert.equal(marca.LOGO_MAX_BYTES, 2 * 1024 * 1024)
  assert.deepEqual(plano(marca.LOGO_MIME), ['image/png', 'image/jpeg', 'image/webp'])
  assert.equal(marca.logoExtension('image/jpeg'), 'jpg')
  assert.equal(marca.urlLogoValida('""'), '')
  assert.equal(marca.urlLogoValida('branding/logo.png'), '')
  assert.equal(marca.urlLogoValida(URL_MARCA), URL_MARCA)
})
