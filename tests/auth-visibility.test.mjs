import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadModule } from './load-module.mjs'

const { authRoute } = loadModule('lib/authRoute.ts')
const ready = { initialized: true, loading: false, user: null, permisos: [] }
const user = { id: 'perfil', nombre: 'Prueba', email: 'prueba@example.test', rol: 'admin', estado: 'activo' }
const permissions = [{ modulo: 'dashboard', rol: 'admin', leer: true, escribir: true }]

test('una ruta privada nunca autoriza hijos al iniciar, sin sesión ni durante redirección', () => {
  for (const pathname of ['/', '/quejas', '/usuarios', '/configuracion', '/login-falso', '/q-falso']) {
    assert.equal(authRoute(pathname, { ...ready, initialized: false }).view, 'pending')
    assert.equal(authRoute(pathname, { ...ready, loading: true, user }).view, 'pending')
    const denied = authRoute(pathname, ready)
    assert.equal(denied.view, 'pending')
    assert.equal(denied.redirect, '/login')
  }
  assert.equal(authRoute('/login', ready).view, 'public')
  assert.equal(authRoute('/q/token-publico', ready).view, 'public')
})

test('permisos ausentes bloquean el contenido sin bucles entre rutas', () => {
  assert.equal(authRoute('/', { ...ready, user }).view, 'denied')
  assert.equal(authRoute('/quejas', { ...ready, user, permisos: permissions }).redirect, '/')
  assert.equal(authRoute('/', { ...ready, user, permisos: permissions }).view, 'private')
  assert.equal(authRoute('/login', { ...ready, user, permisos: permissions }).redirect, '/')
  assert.equal(authRoute('/q/token', { ...ready, user }).view, 'public')
})

test('el guard real no monta componentes privados ni dispara sus lecturas antes de autorizar', () => {
  for (const [state, pathname, mounted] of [
    [{ ...ready, initialized: false }, '/', false],
    [ready, '/', false],
    [{ ...ready, user }, '/', false],
    [{ ...ready, loading: true, user }, '/', false],
    [{ ...ready, user, permisos: permissions }, '/', true],
    [ready, '/login', true],
  ]) {
    let calls = 0
    const Shell = loadModule('components/AuthShell.tsx', {
      'next/navigation': { usePathname: () => pathname, useRouter: () => ({ replace() {} }) },
      '@/lib/store/auth-store': { useAuthStore: selector => selector({ ...state, init() {}, logout() {} }) },
      '@/components/AuthenticatedLayout': { default: ({ children }) => createElement('div', null, children) },
    }).default
    function ProtectedData() { calls++; return createElement('p', null, 'CONTENIDO-PRIVADO') }
    const html = renderToStaticMarkup(createElement(Shell, null, createElement(ProtectedData)))
    assert.equal(calls, mounted ? 1 : 0)
    assert.equal(html.includes('CONTENIDO-PRIVADO'), mounted)
  }
})

test('la restauración privada usa transición neutral y no anticipa login ni dashboard', () => {
  for (const pathname of ['/', '/quejas', '/usuarios', '/configuracion', '/login']) {
    for (const state of [
      { ...ready, initialized: false, loading: true },
      { ...ready, loading: true },
      { ...ready, initialized: false, user },
      { ...ready, loading: true, user },
      { ...ready, loading: true, signingOut: true },
    ]) {
      let privateReads = 0
      const Shell = loadModule('components/AuthShell.tsx', {
        'next/navigation': { usePathname: () => pathname, useRouter: () => ({ replace() {} }) },
        '@/lib/store/auth-store': { useAuthStore: selector => selector({ ...state, init() {}, logout() {} }) },
        '@/components/AuthenticatedLayout': { default: 'div' },
      }).default
      function ProtectedData() { privateReads++; return createElement('p', null, 'DATOS-PRIVADOS') }
      const html = renderToStaticMarkup(createElement(Shell, null, createElement(ProtectedData)))
      const expectedLayout = state.signingOut || pathname === '/login' && !state.user ? 'login' : 'neutral'
      assert.equal(html.includes('data-session-layout="' + expectedLayout + '"'), true)
      assert.equal(html.includes('data-session-layout="workspace"'), false)
      assert.equal(html.includes('w-[250px]'), false)
      assert.equal(html.includes('DATOS-PRIVADOS'), false)
      assert.equal(privateReads, 0)
    }
  }
})

test('login solo se anticipa con destino confirmado y no existe workspace genérico', () => {
  const Screen = loadModule('components/SessionScreen.tsx').default
  const neutralHtml = renderToStaticMarkup(createElement(Screen))
  assert.match(neutralHtml, /data-session-layout="neutral"/)
  assert.equal(neutralHtml.includes('max-w-md'), false)
  assert.equal(neutralHtml.includes('min-w-[640px]'), false)
  for (const [state, expected] of [
    [ready, 'login'],
    [{ ...ready, user, permisos: permissions }, 'neutral'],
    [{ ...ready, user, permisos: permissions, signingOut: true }, 'login'],
  ]) {
    const Shell = loadModule('components/AuthShell.tsx', {
      'next/navigation': { usePathname: () => state.user ? '/login' : '/', useRouter: () => ({ replace() {} }) },
      '@/lib/store/auth-store': { useAuthStore: selector => selector({ ...state, init() {}, logout() {} }) },
      '@/components/AuthenticatedLayout': { default: 'div' },
    }).default
    const html = renderToStaticMarkup(createElement(Shell))
    assert.equal(html.includes(`data-session-layout="${expected}"`), true)
  }
})

test('una sesión resuelta monta la ruta solicitada directamente y su única carga es la del módulo', () => {
  const Loading = loadModule('components/ui/LoadingSkeleton.tsx').default
  for (const [pathname, modulo] of [['/quejas', 'quejas'], ['/documentos', 'documentos'], ['/usuarios', 'usuarios'], ['/revision', 'revision']]) {
    let state = { ...ready, initialized: false, loading: true }
    const Shell = loadModule('components/AuthShell.tsx', {
      'next/navigation': { usePathname: () => pathname, useRouter: () => ({ replace() {} }) },
      '@/lib/store/auth-store': { useAuthStore: selector => selector({ ...state, init() {}, logout() {} }) },
      '@/components/AuthenticatedLayout': { default: ({ children }) => createElement('div', null, children) },
    }).default
    const moduleContent = createElement('section', { 'data-module': modulo }, createElement(Loading, { label: 'Cargando ' + modulo }))
    const initial = renderToStaticMarkup(createElement(Shell, null, moduleContent))
    assert.match(initial, /data-session-layout="neutral"/)
    assert.equal(initial.includes('data-module='), false)
    state = { ...ready, user, permisos: [{ rol: 'admin', modulo, leer: true, escribir: true }] }
    assert.equal(authRoute(pathname, state).redirect, undefined)
    const restored = renderToStaticMarkup(createElement(Shell, null, moduleContent))
    assert.equal(restored.includes('data-module="' + modulo + '"'), true)
    assert.equal(restored.includes('data-session-layout'), false)
    assert.equal(restored.includes('w-[250px]'), false)
    assert.equal(restored.includes('min-w-[640px]'), true)
  }
})

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = () => new Promise(resolve => setImmediate(resolve))

function storeFixture({ session = { user: { id: 'auth-a' } }, profile = async () => user, getSession, getUser, storage, login = async () => ({ user, authId: 'auth-a' }), rpc = async () => ({ data: permissions, error: null }) } = {}) {
  let listener
  let activeSession = session
  const signOutPending = deferred()
  const scheduled = []
  const store = loadModule('lib/store/auth-store.ts', {
    '@/lib/supabase': { supabase: {
      auth: {
        getSession: getSession ?? (async () => ({ data: { session: activeSession }, error: null })),
        getUser: getUser ?? (async () => ({ data: { user: activeSession?.user ?? null }, error: null })),
        onAuthStateChange: callback => { listener = callback; return { data: { subscription: {} } } },
        signOut: async () => ({ error: null }),
      },
      rpc,
    } },
    '@/lib/auth': { getAppUser: profile, signOut: () => signOutPending.promise, signIn: login },
    '@/lib/queries/usePermisos': { fetchPermisosByRol: async () => permissions },
    '@/lib/utils/logger': { logger: { error() {} } },
  }, { setTimeout: task => { scheduled.push(task); return scheduled.length }, ...(storage ? { window: { sessionStorage: storage } } : {}) }).useAuthStore
  return { store, signOutPending, event: (event, value) => { activeSession = value; listener(event, value) }, runScheduled: () => { scheduled.splice(0).forEach(task => task()) } }
}

test('llamadas repetidas a init durante restauración no duplican lecturas de sesión ni permisos', async () => {
  const identity=deferred()
  const reads={session:0,identity:0,profile:0,permissions:0}
  const fixture=storeFixture({
    getSession:async()=>{reads.session++;return {data:{session:{user:{id:'auth-a'}}},error:null}},
    getUser:()=>{reads.identity++;return identity.promise},
    profile:async()=>{reads.profile++;return user},
    rpc:async()=>{reads.permissions++;return {data:permissions,error:null}},
  })
  const first=fixture.store.getState().init()
  await fixture.store.getState().init()
  await flush()
  assert.deepEqual(reads,{session:1,identity:1,profile:0,permissions:0})
  identity.resolve({data:{user:{id:'auth-a'}},error:null})
  await first
  await fixture.store.getState().init()
  assert.deepEqual(reads,{session:1,identity:1,profile:1,permissions:1})
  assert.equal(fixture.store.getState().user.id,user.id)
})

test('cerrar sesión desmonta usuario/permisos antes de esperar la red y descarta perfiles tardíos', async () => {
  const pendingProfile = deferred()
  const fixture = storeFixture({ profile: () => pendingProfile.promise })
  const init = fixture.store.getState().init()
  await flush()
  fixture.store.setState({ user, permisos: permissions, vistaActiva: 'calidad' })
  const logout = fixture.store.getState().logout()
  assert.equal(fixture.store.getState().user, null)
  assert.equal(fixture.store.getState().permisos.length, 0)
  assert.equal(fixture.store.getState().vistaActiva, null)
  assert.equal(fixture.store.getState().loading, true)
  assert.equal(fixture.store.getState().signingOut, true)
  pendingProfile.resolve(user)
  await init
  fixture.event('SIGNED_IN', { user: { id: 'auth-a' } })
  fixture.runScheduled()
  await flush()
  assert.equal(fixture.store.getState().user, null)
  fixture.signOutPending.resolve()
  await logout
  assert.equal(fixture.store.getState().user, null)
  assert.equal(fixture.store.getState().loading, false)
  assert.equal(fixture.store.getState().signingOut, false)
})

test('una respuesta de permisos/perfil anterior no puede restaurar sesión después de SIGNED_OUT', async () => {
  const pendingProfile = deferred()
  const fixture = storeFixture({ session: null, profile: () => pendingProfile.promise })
  await fixture.store.getState().init()
  fixture.event('SIGNED_IN', { user: { id: 'auth-a' } })
  fixture.runScheduled()
  await flush()
  fixture.event('SIGNED_OUT', null)
  pendingProfile.resolve(user)
  await flush()
  assert.equal(fixture.store.getState().user, null)
  assert.equal(fixture.store.getState().permisos.length, 0)
})

test('un cambio de identidad bloquea la anterior y los refresh no reinician permisos ni vista', async () => {
  const fixture = storeFixture()
  await fixture.store.getState().init()
  fixture.store.setState({ vistaActiva: 'calidad' })
  fixture.event('TOKEN_REFRESHED', { user: { id: 'auth-a' } })
  assert.equal(fixture.store.getState().vistaActiva, 'calidad')
  assert.equal(fixture.store.getState().user.id, 'perfil')
  fixture.event('SIGNED_IN', { user: { id: 'auth-b' } })
  assert.equal(fixture.store.getState().user, null)
  assert.equal(fixture.store.getState().loading, true)
  fixture.runScheduled()
  await flush()
  assert.equal(fixture.store.getState().user.id, 'perfil')
})

test('un fallo al leer sesión termina en estado cerrado y permite volver al login', async () => {
  const fixture = storeFixture({ getSession: async () => { throw new Error('sin red') } })
  await fixture.store.getState().init()
  assert.equal(fixture.store.getState().user, null)
  assert.equal(fixture.store.getState().initialized, true)
  assert.equal(fixture.store.getState().loading, false)
  assert.equal(authRoute('/', fixture.store.getState()).redirect, '/login')
})

test('las respuestas de permisos tampoco restauran al usuario después de cerrar sesión', async () => {
  const pendingPermissions = deferred()
  const fixture = storeFixture({ rpc: () => pendingPermissions.promise })
  const init = fixture.store.getState().init()
  await flush()
  fixture.event('SIGNED_OUT', null)
  pendingPermissions.resolve({ data: permissions, error: null })
  await init
  assert.equal(fixture.store.getState().user, null)
  assert.equal(fixture.store.getState().permisos.length, 0)
})

test('login autorizado valida identidad y permisos; una identidad diferente no mezcla perfiles', async () => {
  for (const authId of ['auth-a', 'auth-b']) {
    const fixture = storeFixture({ session: { user: { id: authId } } })
    const result = await fixture.store.getState().login('prueba@example.test', 'no-real')
    if (authId === 'auth-a') {
      assert.equal(result.error, undefined)
      assert.equal(fixture.store.getState().user.id, user.id)
      assert.equal(fixture.store.getState().permisos.length, 1)
      assert.equal(fixture.store.getState().initialized, true)
    } else {
      assert.match(result.error, /sesión cambió/)
      assert.equal(fixture.store.getState().user, null)
    }
  }
})

test('logout cancela también un login que todavía esperaba su respuesta', async () => {
  const pendingLogin = deferred()
  const fixture = storeFixture({ login: () => pendingLogin.promise })
  const login = fixture.store.getState().login('prueba@example.test', 'no-real')
  const logout = fixture.store.getState().logout()
  pendingLogin.resolve({ user, authId: 'auth-a' })
  assert.match((await login).error, /sesión cambió/)
  assert.equal(fixture.store.getState().user, null)
  fixture.signOutPending.resolve()
  await logout
  assert.equal(fixture.store.getState().user, null)
})

test('la identidad guardada localmente no autoriza sin confirmación de Supabase Auth', async () => {
  for (const response of [
    { data: { user: null }, error: { status: 401 } },
    { data: { user: { id: 'otra-identidad' } }, error: null },
    { data: { user: null }, error: null },
  ]) {
    let profileReads = 0
    const fixture = storeFixture({ getUser: async () => response, profile: async () => { profileReads++; return user } })
    await fixture.store.getState().init()
    assert.equal(fixture.store.getState().user, null)
    assert.equal(fixture.store.getState().loading, false)
    assert.equal(profileReads, 0)
    assert.equal(authRoute('/', fixture.store.getState()).redirect, '/login')
  }
})

test('un cierre de sesión durante la comprobación remota descarta esa comprobación tardía', async () => {
  const remoteIdentity = deferred()
  let profileReads = 0
  const fixture = storeFixture({ getUser: () => remoteIdentity.promise, profile: async () => { profileReads++; return user } })
  const init = fixture.store.getState().init()
  await flush()
  const logout = fixture.store.getState().logout()
  remoteIdentity.resolve({ data: { user: { id: 'auth-a' } }, error: null })
  await init
  assert.equal(profileReads, 0)
  assert.equal(fixture.store.getState().user, null)
  fixture.signOutPending.resolve()
  await logout
})

test('login tampoco acepta un usuario local cuando Auth confirma otra identidad', async () => {
  const fixture = storeFixture({ getUser: async () => ({ data: { user: { id: 'auth-b' } }, error: null }) })
  const result = await fixture.store.getState().login('prueba@example.test', 'no-real')
  assert.match(result.error, /sesión cambió/)
  assert.equal(fixture.store.getState().user, null)
  assert.equal(fixture.store.getState().permisos.length, 0)
})

test('restaurar sesión consulta perfil y permisos en paralelo después de confirmar identidad', async () => {
  const identity = deferred(), profile = deferred(), permissionsResponse = deferred()
  const reads = []
  const fixture = storeFixture({
    getUser: () => identity.promise,
    profile: () => { reads.push('perfil'); return profile.promise },
    rpc: () => { reads.push('permisos'); return permissionsResponse.promise },
  })
  const init = fixture.store.getState().init()
  await flush()
  assert.deepEqual(reads, [])
  identity.resolve({ data: { user: { id: 'auth-a' } }, error: null })
  await flush()
  assert.deepEqual(reads, ['perfil', 'permisos'])
  profile.resolve(user)
  await flush()
  assert.equal(fixture.store.getState().user, null)
  assert.equal(fixture.store.getState().loading, true)
  permissionsResponse.resolve({ data: permissions, error: null })
  await init
  assert.equal(fixture.store.getState().user.id, user.id)
  assert.equal(fixture.store.getState().loading, false)
})

test('login confirma identidad y carga permisos en paralelo sin publicar resultados incompletos', async () => {
  const identity = deferred(), permissionsResponse = deferred()
  const reads = []
  const fixture = storeFixture({
    getUser: () => { reads.push('identidad'); return identity.promise },
    rpc: () => { reads.push('permisos'); return permissionsResponse.promise },
  })
  const login = fixture.store.getState().login('prueba@example.test', 'no-real')
  await flush()
  assert.deepEqual(reads, ['permisos', 'identidad'])
  permissionsResponse.resolve({ data: permissions, error: null })
  await flush()
  assert.equal(fixture.store.getState().user, null)
  assert.equal(fixture.store.getState().permisos.length, 0)
  identity.resolve({ data: { user: { id: 'auth-a' } }, error: null })
  assert.equal((await login).error, undefined)
  assert.equal(fixture.store.getState().user.id, user.id)
})

test('la recuperación de una espera larga no se habilita hasta el aviso y limpia su temporizador', () => {
  let slow = false, effect, retries = 0, scheduled, cleaned = false
  const Screen = loadModule('components/SessionScreen.tsx', {
    react: { useId: () => 'session-title', useState: () => [slow, value => { slow = value }], useEffect: callback => { effect = callback } },
    '@/components/ui/Button': { default: 'button' },
  }, { setTimeout: callback => { scheduled = callback; return 1 }, clearTimeout: () => { cleaned = true } }).default
  const visit = value => Array.isArray(value) ? value.flatMap(visit) : value?.props ? [value, ...visit(value.props.children)] : []
  const props = { onRetry: () => retries++ }
  assert.equal(visit(Screen(props)).filter(node => node.type === 'button').length, 0)
  const cleanup = effect()
  scheduled()
  const button = visit(Screen(props)).find(node => node.type === 'button')
  assert.equal(button.props.children, 'Reintentar')
  button.props.onClick()
  assert.equal(retries, 1)
  cleanup()
  assert.equal(cleaned, true)
})

function tabStorage() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}

test('recargar durante logout continúa el cierre sin leer ni restaurar la sesión anterior', async () => {
  const storage = tabStorage()
  const firstPage = storeFixture({ storage })
  await firstPage.store.getState().init()
  const firstLogout = firstPage.store.getState().logout()
  assert.equal(storage.getItem('qms:logout-pending'), 'true')
  let sessionReads = 0
  const reloadedPage = storeFixture({ storage, getSession: async () => { sessionReads++; return { data: { session: { user: { id: 'auth-a' } } }, error: null } } })
  const init = reloadedPage.store.getState().init()
  await flush()
  assert.equal(sessionReads, 0)
  assert.equal(reloadedPage.store.getState().user, null)
  assert.equal(reloadedPage.store.getState().signingOut, true)
  assert.equal(authRoute('/', reloadedPage.store.getState()).view, 'pending')
  reloadedPage.signOutPending.resolve()
  await init
  assert.equal(storage.getItem('qms:logout-pending'), null)
  assert.equal(authRoute('/', reloadedPage.store.getState()).redirect, '/login')
  firstPage.signOutPending.resolve()
  await firstLogout
})

test('un cierre fallido conserva el bloqueo; solo un login explícito confirmado puede retirarlo', async () => {
  const storage = tabStorage()
  const fixture = storeFixture({ storage })
  await fixture.store.getState().init()
  const logout = fixture.store.getState().logout()
  fixture.signOutPending.reject(new Error('sin red'))
  await logout
  assert.equal(storage.getItem('qms:logout-pending'), 'true')
  fixture.event('SIGNED_IN', { user: { id: 'auth-a' } })
  fixture.runScheduled()
  await flush()
  assert.equal(fixture.store.getState().user, null)
  const result = await fixture.store.getState().login('prueba@example.test', 'no-real')
  assert.equal(result.error, undefined)
  assert.equal(storage.getItem('qms:logout-pending'), null)
  assert.equal(fixture.store.getState().user.id, user.id)
})
