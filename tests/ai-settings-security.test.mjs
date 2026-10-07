import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loadModule } from './load-module.mjs'

const { providersRevision } = loadModule('lib/server/aiSettings.ts')
const fixtureProvider = { id: 'provider-1', nombre: 'Ejemplo', tipo: 'openai', base_url: 'https://api.openai.com/v1', api_key: 'test-only-private-value', modelos: ['example-model'], limite_tokens: 100, tokens_usados: 43 }
function fixture({ user = { rol: 'admin' }, failure = null, beforeWrite = null } = {}) {
  const calls = [], writes = [], settings = new Map([['ai_providers', [fixtureProvider]], ['ai_routing', {}], ['ai_cache_ttl_minutes', 1440]])
  let version=10
  const admin = {
    from(table) {
      calls.push(['table', table]); let key, change, comparison, inserting = false
      const q = { select: () => q, eq: (column, value) => { if(column==='clave')key=value;else if(column==='xmin')comparison=value; return q },
        is: () => q,
        update: value => { change=value;calls.push(['update',value]);return q },
        insert: value => { change=value;key=value.clave;inserting=true;return q },
        maybeSingle: async () => {
          if(change){
            if(beforeWrite){beforeWrite(settings);version++}
            writes.push({comparison,change})
            if(comparison!==undefined&&comparison!==String(version))return {data:null,error:null}
            if(inserting&&settings.has(key))return {data:null,error:{code:'23505'}}
            settings.set(key,change.valor);version++
          }
          return { data: settings.has(key)?{ valor: settings.get(key),xmin:String(version) }:null, error: failure }
        },
        upsert: async value => { calls.push(['upsert', value]); return { error: failure } },
      }
      return q
    },
    rpc: async (name, params) => { calls.push(['rpc', name, params]); return { data: [fixtureProvider], error: failure } },
  }
  const route = loadModule('app/api/configuracion/ia/route.ts', {
    'next/server': { NextResponse: { json: (value, options = {}) => Response.json(value, options) } },
    '@/lib/server/auth': { getCurrentUser: async () => user },
    '@/lib/server/supabase-admin': { createServiceClient: () => { calls.push(['service']); return admin } },
    '@/lib/server/rateLimit': { rateLimit: () => true, getClientIp: () => 'fixture' },
    '@/lib/ai/modelDiscovery': { obtenerModelosDisponibles: async provider => { calls.push(['discover', provider]); return { modelos: ['example-model'], total: 1, descartados: 0 } } },
    '@/lib/ai/modelMemory': { limpiarMemoriaModelos: async () => {} },
    '@/lib/ai/modelTestingClient': { limpiarResultadoTest: async () => {} },
    '@/lib/utils/logger': { logger: { error() {} } },
  })
  return { route, calls, settings, writes }
}
const req = (method, value, extra = {}) => new Request('https://app.test/api/configuracion/ia', {
  method, ...(method === 'GET' ? {} : { body: JSON.stringify(value) }), ...extra,
})

test('todos los métodos IA rechazan sesión inválida y roles no admin antes del cliente privilegiado', async () => {
  for (const [user, status] of [[null, 401], [{ rol: 'calidad' }, 403], [{ rol: 'colaborador' }, 403]]) {
    for (const method of ['GET', 'PUT', 'POST']) {
      const f = fixture({ user }); const response = await f.route[method](req(method, {}))
      assert.equal(response.status, status); assert.equal(f.calls.length, 0)
    }
  }
})
test('GET conserva modelos y consumo, pero nunca entrega claves al navegador', async () => {
  const f = fixture(); const response = await f.route.GET(req('GET'))
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store')
  const text = await response.text(); assert.equal(text.includes(fixtureProvider.api_key), false)
  const data = JSON.parse(text); assert.equal(data.providers[0].api_key, ''); assert.equal(data.providers[0].has_api_key, true)
  assert.equal(data.providers[0].tokens_usados, 43); assert.deepEqual(data.providers[0].modelos, ['example-model'])
})
test('guardar proveedores conserva claves, reinicia solo lo solicitado y compara la versión MVCC anterior', async () => {
  const f = fixture(); const response = await f.route.PUT(req('PUT', { clave: 'ai_providers', valor: [{ ...fixtureProvider, api_key: '', tokens_usados: 0 }], resetTokens: ['provider-1'], expectedRevision:providersRevision([fixtureProvider]) }))
  assert.equal(response.status, 200); assert.equal((await response.text()).includes(fixtureProvider.api_key), false)
  const saved=f.settings.get('ai_providers')[0]
  assert.equal(saved.api_key,fixtureProvider.api_key);assert.equal(saved.tokens_usados,0)
  assert.equal(f.writes[0].comparison,'10')

})
test('URL privada, credenciales, host desconocido y redirecciones no pueden usar la clave guardada', async () => {
  for (const base_url of ['http://api.openai.com/v1', 'https://localhost/v1', 'https://127.0.0.1/v1', 'https://evil.test/v1', 'https://user:pass@api.openai.com/v1', 'https://api.openai.com/v1?secret=x']) {
    const f = fixture(); const response = await f.route.POST(req('POST', { action: 'connect', provider: { ...fixtureProvider, base_url, api_key: '' } }))
    assert.equal(response.status, 400); assert.equal(f.calls.some(c => c[0] === 'discover'), false)
  }
  const f = fixture(); const response = await f.route.POST(req('POST', { action: 'connect', provider: { ...fixtureProvider, base_url: 'https://api.groq.com/openai/v1', api_key: '' } }))
  assert.equal(response.status, 400); assert.equal(f.calls.some(c => c[0] === 'discover'), false)
})
test('probar un proveedor existente utiliza su clave solo en el servidor', async () => {
  const f = fixture(); const response = await f.route.POST(req('POST', { action: 'connect', provider: { ...fixtureProvider, api_key: '' } }))
  assert.equal(response.status, 200); assert.equal((await response.text()).includes(fixtureProvider.api_key), false)
  assert.equal(f.calls.find(c => c[0] === 'discover')[1].api_key, fixtureProvider.api_key)
})
test('cuerpo inválido, tamaño real y claves ajenas se rechazan antes de escribir', async () => {
  for (const extra of [{ body: 'broken-json' }, { body: '"' + 'x'.repeat(1_048_576) + '"' }, { body: JSON.stringify({ clave: 'drive_folder_id_quejas', valor: 'x' }) }]) {
    const f = fixture(); const response = await f.route.PUT(req('PUT', {}, extra)); assert.equal(response.status, 400)
    assert.equal(f.calls.some(c => ['upsert', 'update', 'rpc'].includes(c[0])), false)
  }
})
test('diagnósticos y extras de los tests no exponen SQL ni claves', async () => {
  const f = fixture(); f.settings.set('ai_test_resultado_provider-1', { timestamp: 1, api_key: fixtureProvider.api_key, resultados: [{ modelo: 'example-model', ok: false, latenciaMs: 1, api_key: fixtureProvider.api_key, error: 'SQL secret=' + fixtureProvider.api_key }] })
  const response = await f.route.GET(new Request('https://app.test/api/configuracion/ia?clave=ai_test_resultado_provider-1'))
  const text = await response.text(); assert.equal(text.includes(fixtureProvider.api_key), false); assert.equal(text.includes('SQL secret'), false)
  const failing = fixture({ failure: { message: 'SQL secret=' + fixtureProvider.api_key, code: '23505' } })
  assert.equal((await (await failing.route.GET(req('GET'))).text()).includes(fixtureProvider.api_key), false)
})
test('descubrimiento rechaza destinos fuera de allowlist y no sigue redirects de OpenAI compatibles', async () => {
  const calls = []
  const { obtenerModelosDisponibles } = loadModule('lib/ai/modelDiscovery.ts', { '@/lib/utils/logger': { logger: { warn() {} } } }, {
    fetch: async (url, options) => { calls.push({ url, options }); return Response.json({ data: [{ id: 'example-model' }] }) },
  })
  await assert.rejects(obtenerModelosDisponibles({ ...fixtureProvider, base_url: 'https://evil.test' }, true))
  assert.equal(calls.length, 0)
  const data = await obtenerModelosDisponibles(fixtureProvider, true); assert.equal(data.modelos[0], 'example-model')
  assert.equal(calls[0].options.redirect, 'error')
})
test('gestor cliente usa únicamente la API IA y deja vacío el campo para conservar claves', () => {
  const source = fs.readFileSync('components/configuracion/AIProvidersManager.tsx', 'utf8')
  assert.doesNotMatch(source, /supabase.from|modelDiscovery|modelMemory|modelTestingClient/)
  assert.match(source, /Dejar vacío para conservar la clave/)
})

test('una revisión anterior rechaza sobrescrituras y preserva el contador más reciente', async () => {
  const f=fixture();const revision=providersRevision([fixtureProvider])
  f.settings.set('ai_providers',[{...fixtureProvider,tokens_usados:71}])
  const result=await f.route.PUT(req('PUT',{clave:'ai_providers',valor:[{...fixtureProvider,api_key:'',tokens_usados:0}],expectedRevision:revision}))
  assert.equal(result.status,200);assert.equal(f.settings.get('ai_providers')[0].tokens_usados,71)
  const stale=await f.route.PUT(req('PUT',{clave:'ai_providers',valor:[{...fixtureProvider,api_key:'',tokens_usados:0}],expectedRevision:'0'.repeat(64)}))
  assert.equal(stale.status,409);assert.equal(f.settings.get('ai_providers')[0].tokens_usados,71)
})

test('una actualización de consumo entre lectura y escritura produce conflicto sin perder tokens', async () => {
  const f=fixture({beforeWrite:settings=>settings.set('ai_providers',[{...fixtureProvider,tokens_usados:72}])})
  const response=await f.route.PUT(req('PUT',{clave:'ai_providers',valor:[{...fixtureProvider,api_key:''}],expectedRevision:providersRevision([fixtureProvider])}))
  assert.equal(response.status,409);assert.equal(f.settings.get('ai_providers')[0].tokens_usados,72)
  assert.equal(f.writes.length,1,'no debe reintentar con una revisión nueva')
})

test('el SDK real compara xmin sin poner secretos en filtros HTTP de PostgREST', async () => {
  const calls=[]
  const admin=createClient('https://fixture.test','test-only-service-credential',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async(url,options)=>{
      calls.push({url:String(url),options})
      return Response.json(options.method==='PATCH'?[{valor:JSON.parse(options.body).valor}]:[{valor:[fixtureProvider],xmin:'10'}])
    }},
  })
  const {writeAISetting}=loadModule('lib/server/aiSettings.ts')
  const result=await writeAISetting(admin,'ai_providers',[{...fixtureProvider,api_key:''}],[],providersRevision([fixtureProvider]))
  assert.equal(result.valor[0].api_key,'');assert.equal(calls.length,2)
  assert.equal(new URL(calls[1].url).searchParams.get('xmin'),'eq.10')
  assert.ok(calls.every(c=>!c.url.includes(fixtureProvider.api_key)))
  assert.equal(JSON.parse(calls[1].options.body).valor[0].api_key,fixtureProvider.api_key)
})

test('el endpoint de tests recibe mensajes seguros aunque el proveedor incluya una clave en el error',async()=>{
  const {testearModelo}=loadModule('lib/ai/modelTesting.ts',{
    './aiFactory':{crearClienteIA:()=>({analizar:async()=>{throw Error('Provider key='+fixtureProvider.api_key+' https://private.test/debug SQL')}})},
  })
  const result=await testearModelo(fixtureProvider,'example-model','synthetic-prompt')
  assert.equal(result.ok,false);assert.equal(result.error.includes(fixtureProvider.api_key),false);assert.equal(result.error.includes('private.test'),false)
})
