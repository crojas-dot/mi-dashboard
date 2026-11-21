import test from 'node:test'
import assert from 'node:assert/strict'
import {loadModule} from './load-module.mjs'

// Reproduce cleanup/setup de StrictMode antes del primer frame. No usa Auth ni red.
function invitationPage({token='a'.repeat(43),admin=true,response}={}) {
 const slots=[],frames=new Map(),effects=[],redirects=[],requests=[],sessions=[]
 const location={pathname:'/acceso',hash:token?'#invitacion='+token:''}
 let cursor=0,frameId=0,tree,logoutPending=false
 const state={user:admin?{id:'admin-profile',nombre:'Administrador ficticio',rol:'admin'}:null,
  access:null,accessIdentity:admin?'admin-auth':null,
  refreshAccess:async()=>{state.user=null;state.accessIdentity='invited-auth';state.access={phase:'password',managed:true}},logout:async()=>{}}
 const useAuthStore=selector=>selector(state);useAuthStore.getState=()=>state
 const useState=initial=>{
  const i=cursor++
  if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial
  return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]
 }
 const router={replace:path=>redirects.push(path)}
 const Page=loadModule('app/acceso/page.tsx',{
  react:{useState,useRef:current=>useState({current})[0],useEffect:(callback,deps)=>{
   const i=cursor++,previous=slots[i]
   if(!previous||deps.some((value,index)=>!Object.is(value,previous.deps[index]))){
    slots[i]={callback,deps,cleanup:previous?.cleanup};effects.push(i)
   }
  }},
  'next/navigation':{useRouter:()=>router},'next/image':{default:'Image'},
  '@/components/ui/Button':{default:'Button'},'@/components/ui/Input':{default:'Input'},
  '@/components/ui/Field':{default:'Field'},'@/components/SessionScreen':{default:'SessionScreen'},
  '@/lib/queries/useIdentidadImagenes':{useIdentidadImagenes:()=>({data:undefined})},
  '@/lib/store/auth-store':{useAuthStore},'@/lib/authLogoutIntent':{isLogoutPending:()=>logoutPending},
  '@/lib/services/accessClient':{accessAction:async()=>{throw new Error('unexpected action')}},
  '@/lib/supabase':{supabase:{auth:{setSession:async session=>{sessions.push(session);return {error:null}}}}},
 },{location,history:{replaceState:()=>{location.hash=''}},
  requestAnimationFrame:callback=>{frames.set(++frameId,callback);return frameId},cancelAnimationFrame:id=>frames.delete(id),
  fetch:async(url,options)=>{requests.push({url,options});return response?response():Response.json({session:{access_token:'synthetic-access',refresh_token:'synthetic-refresh'}})},
 }) .default
 const visit=value=>Array.isArray(value)?value.flatMap(visit):value?.props?[value,...visit(value.props.children)]:[]
 const text=value=>Array.isArray(value)?value.map(text).join(''):value?.props?text(value.props.children):typeof value==='string'?value:''
 const render=()=>{cursor=0;tree=Page();return tree}
 const flushEffects=(strict=false)=>{
  for(const i of effects.splice(0)){
   const effect=slots[i];effect.cleanup?.();effect.cleanup=effect.callback()
   if(strict){effect.cleanup?.();effect.cleanup=effect.callback()}
  }
 }
 const flushFrames=()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback())}
 render()
 return {state,location,requests,sessions,redirects,render,flushEffects,flushFrames,
  text:()=>text(tree),tree:()=>tree,button:()=>visit(tree).find(node=>node.type==='Button'&&text(node)==='Configurar acceso'),
  logout:()=>{logoutPending=true},
 }
}

test('una invitación conserva el token bajo StrictMode con admin conectado y no consume ni redirige al abrir',()=>{
 const page=invitationPage()
 assert.equal(page.tree().type,'SessionScreen','espera a leer el enlace antes de mostrar la sesión anterior')
 page.flushEffects(true);page.flushFrames();page.render();page.flushEffects()
 assert.ok(page.button(),'el cleanup no pierde la invitación retirada del hash')
 assert.match(page.text(),/Administrador ficticio/)
 assert.match(page.text(),/cambiarás a la cuenta invitada/)
 assert.equal(page.location.hash,'')
 assert.equal(page.requests.length,0)
 assert.deepEqual(page.redirects,[])
})

test('confirmar cambia a la cuenta invitada, permite crear contraseña y bloquea doble canje',async()=>{
 const page=invitationPage()
 page.flushEffects(true);page.flushFrames();page.render();page.flushEffects()
 const first=page.button().props.onClick(),second=page.button().props.onClick()
 await Promise.all([first,second]);await new Promise(resolve=>setImmediate(resolve))
 page.render();page.flushEffects()
 assert.equal(page.requests.length,1)
 assert.equal(JSON.parse(page.requests[0].options.body).token,'a'.repeat(43))
 assert.equal(page.sessions.length,1)
 assert.equal(page.state.accessIdentity,'invited-auth')
 assert.match(page.text(),/Creá tu contraseña/)
 assert.deepEqual(page.redirects,[])
})

test('un enlace vencido conserva la sesión del admin y muestra el error sin entrar a su dashboard',async()=>{
 const page=invitationPage({response:async()=>Response.json({error:'La invitación venció.'},{status:410})})
 page.flushEffects(true);page.flushFrames();page.render();page.flushEffects()
 page.button().props.onClick();await new Promise(resolve=>setImmediate(resolve));page.render();page.flushEffects()
 assert.match(page.text(),/La invitación venció/)
 assert.ok(page.button())
 assert.equal(page.sessions.length,0)
 assert.equal(page.state.accessIdentity,'admin-auth')
 assert.deepEqual(page.redirects,[])
})

test('sin sesión también conserva la invitación y un logout durante el canje impide restaurarla',async()=>{
 let resolveResponse
 const pending=new Promise(resolve=>{resolveResponse=resolve})
 const page=invitationPage({admin:false,response:()=>pending})
 page.flushEffects(true);page.flushFrames();page.render();page.flushEffects()
 assert.ok(page.button())
 page.button().props.onClick();page.logout()
 resolveResponse(Response.json({session:{access_token:'synthetic-access',refresh_token:'synthetic-refresh'}}))
 await new Promise(resolve=>setImmediate(resolve));page.render()
 assert.equal(page.sessions.length,0)
 assert.match(page.text(),/La sesión cambió/)
})

test('sin invitación, una cuenta ya configurada vuelve al inicio después de leer el enlace',()=>{
 const page=invitationPage({token:''})
 page.flushEffects(true)
 assert.deepEqual(page.redirects,[])
 page.flushFrames();page.render();page.flushEffects()
 assert.deepEqual(page.redirects,['/'])
})
test('la contraseña inicial acepta ocho caracteres y rechaza siete antes de escribir', async () => {
  const saved = []
  class AccessError extends Error {
    constructor(code, status = 400) { super(code); this.code = code; this.status = status }
  }
  const route = loadModule('app/api/auth/acceso/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/server/accessIdentity': { getAccessIdentity: async () => ({ id: 'fixture-auth' }) },
    '@/lib/server/supabase-admin': { createServiceClient: () => ({}) },
    '@/lib/server/rateLimit': { rateLimit: () => true, getClientIp: () => 'fixture' },
    '@/lib/server/accessService': {
      AccessError, accessStatus: async () => ({ phase: 'password' }),
      readAccessJson: async request => request.json(), accessCommand: async () => ({ phase: 'ready' }),
      setOwnAccessPassword: async (_, password) => saved.push(password),
    },
  })
  const post = password => route.POST(new Request('https://qms.example.test/api/auth/acceso', {
    method: 'POST', body: JSON.stringify({ action: 'password', password }),
  }))
  const invalid = await post('A1-bcde')
  assert.equal(invalid.status, 400)
  assert.match((await invalid.json()).error, /8 a 128 caracteres/)
  assert.deepEqual(saved, [])
  assert.equal((await post('A1-bcdef')).status, 200)
  assert.deepEqual(saved, ['A1-bcdef'])
})
