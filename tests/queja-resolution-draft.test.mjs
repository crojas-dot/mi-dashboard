import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

function fixture(failure = null) {
  const calls = []
  const service = loadModule('lib/services/quejaWorkflowService.ts', {
    '@/lib/supabase': { supabase: { async rpc(name, args) { calls.push({ name,args }); return { data:{ ...args,version:args.p_version+1 },error:failure } } } },
  })
  return { service,calls }
}

test('guardar preserva texto/formato y usa revisión y versión explícitas sin transicionar', async () => {
  const { service,calls } = fixture()
  await service.guardarResolucionBorrador({ id:'q',revision:7 },2,' **Texto**\n','markdown')
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{ name:'qms_save_resolution_draft',args:{ p_id:'q',p_expected:7,p_version:2,p_content:' **Texto**\n',p_format:'markdown' } }])
  await service.guardarResolucionBorrador({ id:'q',revision:7 },3,'','plain')
  assert.equal(calls[1].args.p_content,'')
})

test('enviar compara el borrador y expediente en una sola operación', async () => {
  const { service,calls } = fixture()
  await service.enviarResolucionBorradorRevision({ id:'q',revision:7 },3,'Propuesta','plain')
  assert.equal(calls.length,1)
  assert.equal(calls[0].name,'qms_submit_resolution_draft')
  assert.equal(calls[0].args.p_version,3)
  assert.equal(calls[0].args.p_expected,7)
})

test('datos inválidos se rechazan antes de escribir y un conflicto no se reintenta', async () => {
  const failure = new Error('Conflicto sintético')
  const { service,calls } = fixture(failure)
  for (const args of [[{id:'q',revision:NaN},0,'x','plain'],[{id:'q',revision:7},-1,'x','plain'],[{id:'q',revision:7},0,'x'.repeat(10001),'plain'],[{id:'q',revision:7},0,'x','html']]) assert.throws(()=>service.guardarResolucionBorrador(...args))
  assert.throws(()=>service.enviarResolucionBorradorRevision({id:'q',revision:7},0,'  ','plain'))
  assert.equal(calls.length,0)
  await assert.rejects(()=>service.guardarResolucionBorrador({id:'q',revision:7},1,'x','plain'),e=>e===failure)
  assert.equal(calls.length,1)
})

test('la lectura conserva el prefijo compartido, filtro del expediente y señal de cancelación', async () => {
  const calls=[], signal=new AbortController().signal
  const query={ select(value){calls.push(['select',value]);return this},eq(...args){calls.push(['eq',...args]);return this},abortSignal(value){assert.equal(value,signal);return this},async maybeSingle(){return {data:null,error:null}} }
  const api=loadModule('lib/queries/useQuejaResolucionDraft.ts',{
    '@tanstack/react-query':{useQuery:options=>options},
    '@/lib/supabase':{supabase:{from(table){calls.push(['from',table]);return query}}},
  })
  assert.equal(await api.fetchQuejaResolucionDraft('q',signal),null)
  assert.deepEqual(calls.find(c=>c[0]==='eq'),['eq','queja_id','q'])
  assert.deepEqual(Array.from(api.quejaResolucionDraftKey('q')),['quejas','resolucion-borrador','q'])
  assert.equal(api.useQuejaResolucionDraft('q',false).enabled,false)
  assert.equal(api.useQuejaResolucionDraft('',true).enabled,false)
  assert.equal(api.useQuejaResolucionDraft('q',true).retry,false)
})
