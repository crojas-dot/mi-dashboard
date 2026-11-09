import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const item = (id, leida = false) => ({ id, leida })
const snapshot = (notifications, extra = {}) => ({ userId: 'perfil-a', ready: true, enabled: true, notifications, ...extra })
const plain = value => JSON.parse(JSON.stringify(value))
const settle = async () => { for (let count = 0; count < 6; count++) await Promise.resolve() }

test('la primera consulta correcta consume historia; una espera vacía no la convierte en avisos nuevos', () => {
  const { createNotificationSoundTracker } = loadModule('lib/utils/notificationSound.ts')
  const tracker = createNotificationSoundTracker()
  assert.deepEqual(plain(tracker.observe(snapshot([], { ready: false }))), [])
  assert.deepEqual(plain(tracker.observe(snapshot([item('historia')]))), [])
  assert.deepEqual(plain(tracker.observe(snapshot([item('nueva'), item('historia')]))), ['nueva'])
})

test('un ID nuevo suena aunque la lectura de otro compense el conteo; cada lote se consume una vez', () => {
  const { createNotificationSoundTracker } = loadModule('lib/utils/notificationSound.ts')
  const tracker = createNotificationSoundTracker()
  tracker.observe(snapshot([item('anterior')]))
  const rows = [item('nueva-a'), item('nueva-b'), item('anterior', true)]
  assert.deepEqual(plain(tracker.observe(snapshot(rows))), ['nueva-a', 'nueva-b'])
  assert.deepEqual(plain(tracker.observe(snapshot(rows))), [])
  assert.deepEqual(plain(tracker.observe(snapshot([item('nueva-leida', true), ...rows]))), [])
})

test('montar con caché y volver a montar no reproduce la bandeja histórica', () => {
  const { createNotificationSoundTracker } = loadModule('lib/utils/notificationSound.ts')
  for (let mount = 0; mount < 2; mount++) {
    const tracker = createNotificationSoundTracker()
    assert.deepEqual(plain(tracker.observe(snapshot([item('historia')]))), [])
  }
})

test('desactivar y reactivar preferencias consume las entradas acumuladas sin sonido', () => {
  const { createNotificationSoundTracker } = loadModule('lib/utils/notificationSound.ts')
  const tracker = createNotificationSoundTracker()
  tracker.observe(snapshot([item('anterior')]))
  assert.deepEqual(plain(tracker.observe(snapshot([], { enabled: false, ready: false }))), [])
  assert.deepEqual(plain(tracker.observe(snapshot([item('durante-silencio'), item('anterior')]))), [])
  assert.deepEqual(plain(tracker.observe(snapshot([item('nueva'), item('durante-silencio'), item('anterior')]))), ['nueva'])
})

test('cada identidad y la restauración tras logout comienzan con una nueva línea base', () => {
  const { createNotificationSoundTracker } = loadModule('lib/utils/notificationSound.ts')
  const tracker = createNotificationSoundTracker()
  tracker.observe(snapshot([item('a')]))
  assert.deepEqual(plain(tracker.observe(snapshot([item('b')], { userId: 'perfil-b' }))), [])
  tracker.observe(snapshot([], { userId: null, ready: false }))
  assert.deepEqual(plain(tracker.observe(snapshot([item('a')]))), [])
})

function browser({ blockedStorage = false, failedTransaction = false } = {}) {
  const values = new Map()
  let queue = Promise.resolve()
  const document = { visibilityState: 'visible', hasFocus: () => true }
  const indexedDB = { open() {
    const request = {}
    Promise.resolve().then(() => {
      if (blockedStorage) { request.onblocked?.(); return }
      request.result = { close() {}, transaction(storeName, mode) {
        assert.equal(storeName, 'claims'); assert.equal(mode, 'readwrite')
        const transaction = {}, writes = []
        transaction.objectStore = () => ({ get(key) {
          const read = {}
          const result = queue.then(() => {
            if (failedTransaction) { transaction.onabort?.(); return }
            read.result = values.get(key)
            read.onsuccess?.()
            for (const [name, value] of writes) values.set(name, value)
            transaction.oncomplete?.()
          })
          queue = result.then(() => undefined, () => undefined)
          return read
        }, put(value, key) { writes.push([key, plain(value)]) } })
        return transaction
      } }
      request.onsuccess?.()
    })
    return request
  } }
  return { document, indexedDB, values }
}

test('dos pestañas reclaman un lote una sola vez mediante transacciones atómicas sin datos personales', async () => {
  const environment = browser()
  const one = loadModule('lib/utils/notificationSound.ts', {}, environment)
  const two = loadModule('lib/utils/notificationSound.ts', {}, environment)
  const result = await Promise.all([
    one.claimNotificationSound('perfil-a', ['aviso-a', 'aviso-b'], () => true),
    two.claimNotificationSound('perfil-a', ['aviso-a', 'aviso-b'], () => true),
  ])
  assert.deepEqual(result, [true, false])
  const stored = [...environment.values.values()][0]
  assert.equal(stored.length, 2)
  assert.ok(stored.every(entry => Object.keys(entry).sort().join(',') === 'at,id'))
})

test('el diario tiene un tamaño y una retención acotados y separa usuarios', async () => {
  const environment = browser()
  environment.values.set('perfil-a', [
    { id: 'caducado', at: Date.now() - 25 * 60 * 60 * 1000 }, { id: 'invalido', at: 'ayer' },
  ])
  const { claimNotificationSound } = loadModule('lib/utils/notificationSound.ts', {}, environment)
  assert.equal(await claimNotificationSound('perfil-a', Array.from({ length: 150 }, (_, index) => `aviso-${index}`), () => true), true)
  const stored = environment.values.get('perfil-a')
  assert.equal(stored.length, 128)
  assert.ok(!stored.some(entry => entry.id === 'caducado'))
  assert.equal(await claimNotificationSound('perfil-a', Array.from({ length: 150 }, (_, index) => `aviso-${index}`), () => true), false)
  assert.equal(await claimNotificationSound('perfil-b', ['aviso-149'], () => true), true)
})

test('un diario inválido se reemplaza y vuelve a deduplicar entre pestañas', async () => {
  const environment = browser()
  environment.values.set('perfil-a', 'contenido-invalido')
  const { claimNotificationSound } = loadModule('lib/utils/notificationSound.ts', {}, environment)
  assert.equal(await claimNotificationSound('perfil-a', ['aviso'], () => true), true)
  assert.equal(await claimNotificationSound('perfil-a', ['aviso'], () => true), false)
})

test('pestaña en segundo plano reclama sin exigir foco y sigue deduplicando', async () => {
  const environment = browser()
  const { claimNotificationSound } = loadModule('lib/utils/notificationSound.ts', {}, environment)
  environment.document.visibilityState = 'hidden'
  assert.equal(await claimNotificationSound('perfil-a', ['aviso'], () => true), true)
  assert.equal(environment.values.size, 1)
  environment.document.visibilityState = 'visible'
  assert.equal(await claimNotificationSound('perfil-a', ['aviso'], () => true), false)
})

for (const options of [{ blockedStorage: true }, { failedTransaction: true }]) {
  test(`IndexedDB ${options.blockedStorage ? 'bloqueado' : 'abortado'} omite audio sin prometer deduplicación por foco`, async () => {
    const environment = browser(options)
    const { claimNotificationSound } = loadModule('lib/utils/notificationSound.ts', {}, environment)
    assert.equal(await claimNotificationSound('perfil-a', ['aviso'], () => true), false)
    assert.equal(environment.values.size, 0)
  })
}

test('IndexedDB no disponible omite sonido automático aunque la ventana tenga foco', async () => {
  const { claimNotificationSound } = loadModule('lib/utils/notificationSound.ts', {}, { document: { visibilityState: 'visible', hasFocus: () => true } })
  assert.equal(await claimNotificationSound('perfil-a', ['aviso'], () => true), false)
})

test('desfase de reloj pequeño conserva el reclamo reciente de otro renderer', async () => {
  const environment = browser()
  environment.values.set('perfil-a', [{ id: 'aviso', at: Date.now() + 1000 }])
  const { claimNotificationSound } = loadModule('lib/utils/notificationSound.ts', {}, environment)
  assert.equal(await claimNotificationSound('perfil-a', ['aviso'], () => true), false)
})

test('logout mientras se espera abrir el diario impide el reclamo', async () => {
  const environment = browser()
  let active = true
  const { claimNotificationSound } = loadModule('lib/utils/notificationSound.ts', {}, environment)
  const pending = claimNotificationSound('perfil-a', ['aviso'], () => active)
  active = false
  assert.equal(await pending, false)
  assert.equal(environment.values.size, 0)
})

function hookFixture(environment = browser()) {
  const refs = [], effects = [], pending = [], plays = []
  let refIndex = 0, effectIndex = 0
  const auth = { user: { id: 'perfil-a' }, signingOut: false }
  const audio = { ready: true }
  const { useNotificationSound: runHook } = loadModule('lib/hooks/useNotificationSound.ts', {
    react: {
      useRef(value) { const index = refIndex++; refs[index] ??= { current: value }; return refs[index] },
      useEffect(callback, dependencies) {
        const index = effectIndex++, previous = effects[index]
        if (!previous || dependencies.some((value, position) => value !== previous.dependencies[position])) {
          pending.push(() => { previous?.cleanup?.(); effects[index] = { dependencies, cleanup: callback() } })
        }
      },
    },
    '@/lib/store/auth-store': { useAuthStore: { getState: () => auth } },
    '@/lib/services/sonidosNotificacion': { prepareNotificationSound: async (sound, isCurrent) => audio.ready ? {
      ready: () => audio.ready && isCurrent(),
      play: () => { if (audio.ready && isCurrent()) plays.push({ sound, isCurrent }) },
    } : null },
  }, environment)
  const render = (notifications, options = {}) => {
    refIndex = 0; effectIndex = 0
    runHook({ userId: auth.user?.id ?? null, ready: true, notifications, enabled: true, soundEnabled: true, soundId: 'notification/info', ...options })
    pending.splice(0).forEach(commit => commit())
  }
  return { auth, environment, audio, plays, render, cleanup: () => effects.forEach(effect => effect.cleanup?.()) }
}

test('hook reproduce una vez por lote y cambiar sonido/preferencias no reproduce por sí solo', async () => {
  const fixture = hookFixture()
  fixture.render([item('historia')]); await settle()
  assert.equal(fixture.plays.length, 0)
  fixture.render([item('nueva-a'), item('nueva-b'), item('historia')]); await settle()
  assert.equal(fixture.plays.length, 1)
  fixture.render([item('nueva-a'), item('nueva-b'), item('historia')], { soundEnabled: false }); await settle()
  fixture.render([item('nueva-a'), item('nueva-b'), item('historia')], { soundId: 'notification/success' }); await settle()
  assert.equal(fixture.plays.length, 1)
  fixture.cleanup()
})

test('hook consulta sesión viva: logout antes del reclamo o durante audio invalida la reproducción', async () => {
  const fixture = hookFixture()
  fixture.render([item('historia')]); await settle()
  fixture.render([item('nueva'), item('historia')]); await settle()
  assert.equal(fixture.plays.length, 1)
  assert.equal(fixture.plays[0].isCurrent(), true)
  fixture.environment.document.visibilityState = 'hidden'
  assert.equal(fixture.plays[0].isCurrent(), true)
  fixture.environment.document.visibilityState = 'visible'
  fixture.auth.signingOut = true
  fixture.auth.user = null
  assert.equal(fixture.plays[0].isCurrent(), false)
  fixture.render([item('respuesta-tardia')]); await settle()
  assert.equal(fixture.plays.length, 1)
  fixture.cleanup()
})

test('hook desmontado y respuesta tardía de otra identidad no emiten audio', async () => {
  const fixture = hookFixture()
  fixture.render([item('historia')]); await settle()
  fixture.render([item('nueva'), item('historia')])
  fixture.cleanup()
  await settle()
  assert.equal(fixture.plays.length, 0)
  fixture.auth.user = { id: 'perfil-b' }
  fixture.render([item('historia-b')]); await settle()
  assert.equal(fixture.plays.length, 0)
  fixture.cleanup()
})

test('hook notifica mientras el formulario ocupa otra pestaña sin repetir al regresar', async () => {
  const fixture = hookFixture()
  fixture.render([item('historia')]); await settle()
  fixture.environment.document.visibilityState = 'hidden'
  fixture.render([item('recibida'), item('historia')]); await settle()
  assert.equal(fixture.plays.length, 1)
  fixture.environment.document.visibilityState = 'visible'
  fixture.render([item('recibida'), item('historia')]); await settle()
  assert.equal(fixture.plays.length, 1)
  fixture.cleanup()
})

test('pestaña sin audio permitido no reclama el aviso y otra preparada puede emitirlo', async () => {
  const environment = browser()
  const blocked = hookFixture(environment), allowed = hookFixture(environment)
  blocked.audio.ready = false
  blocked.render([item('historia')]); allowed.render([item('historia')]); await settle()
  environment.document.visibilityState = 'hidden'
  blocked.render([item('nueva'), item('historia')]); await settle()
  assert.equal(environment.values.size, 0)
  allowed.render([item('nueva'), item('historia')]); await settle()
  assert.equal(blocked.plays.length, 0)
  assert.equal(allowed.plays.length, 1)
  blocked.cleanup(); allowed.cleanup()
})

test('preferencias revocadas durante la preparación impiden reclamar el aviso', async () => {
  const fixture = hookFixture()
  fixture.render([item('historia')]); await settle()
  fixture.render([item('nueva'), item('historia')])
  fixture.auth.user.notif_sonido = false
  await settle()
  assert.equal(fixture.plays.length, 0)
  assert.equal(fixture.environment.values.size, 0)
  fixture.cleanup()
})

function audioFixture({ state = 'running', failedFetches = 0, activated = false, resumeState = state } = {}) {
  let decode, starts = 0, fetches = 0, resumes = 0
  const contexts = []
  const listeners = new Map()
  class AudioContext {
    constructor() { contexts.push(this) }
    state = state
    destination = {}
    resume() { resumes++; this.state = resumeState; return Promise.resolve() }
    decodeAudioData() { return new Promise(resolve => { decode = resolve }) }
    createBufferSource() { return { connect() {}, start() { starts++ } } }
    createGain() { return { gain: { setValueAtTime() {} }, connect() {} } }
  }
  const service = loadModule('lib/services/sonidosNotificacion.ts', {}, {
    window: { AudioContext, navigator: { userActivation: { hasBeenActive: activated } }, addEventListener(kind, callback) { listeners.set(kind, callback) } },
    fetch: async url => { assert.match(url, /^\/sounds\//); fetches++; return { ok: fetches > failedFetches, arrayBuffer: async () => new ArrayBuffer(1) } },
  })
  return { ...service, gesture: () => listeners.get('pointerdown')(), context: () => contexts[0],
    fetches: () => fetches, resumes: () => resumes, finishDecode: () => decode({}), starts: () => starts }
}

test('el audio comprueba vigencia después de decodificar: una cuenta cerrada ya no suena', async () => {
  const fixture = audioFixture()
  let current = true
  const pending = fixture.playNotificationSound('notification/info', () => current)
  await settle()
  current = false
  fixture.finishDecode()
  await pending
  assert.equal(fixture.starts(), 0)
})

test('la previsualización explícita conserva su contrato sin callback adicional', async () => {
  const fixture = audioFixture()
  const pending = fixture.playNotificationSound('notification/info')
  await settle()
  fixture.finishDecode()
  await pending
  assert.equal(fixture.starts(), 1)
})

test('preparar audio automático sin gesto o con contexto suspendido no espera ni descarga', async () => {
  const fixture = audioFixture({ state: 'suspended' })
  assert.equal(await fixture.prepareNotificationSound(), null)
  assert.equal(fixture.context(), undefined)
  fixture.gesture(); await settle()
  assert.equal(await fixture.prepareNotificationSound(), null)
  assert.equal(fixture.fetches(), 0)
  assert.equal(fixture.resumes(), 1)
})

test('fallo temporal del MP3 se puede recuperar y el buffer correcto se reutiliza', async () => {
  const fixture = audioFixture({ failedFetches: 1 })
  fixture.gesture(); await settle()
  assert.equal(await fixture.prepareNotificationSound(), null)
  const pending = fixture.prepareNotificationSound()
  await settle(); fixture.finishDecode()
  const prepared = await pending
  prepared.play()
  const cached = await fixture.prepareNotificationSound()
  cached.play()
  assert.equal(fixture.fetches(), 2)
  assert.equal(fixture.starts(), 2)
})

test('audio ya preparado vuelve a validar suspensión y sesión inmediatamente al reproducir', async () => {
  const fixture = audioFixture()
  fixture.gesture(); await settle()
  let current = true
  const pending = fixture.prepareNotificationSound('notification/info', () => current)
  await settle(); fixture.finishDecode()
  const prepared = await pending
  fixture.context().state = 'suspended'
  assert.equal(prepared.ready(), false)
  prepared.play()
  fixture.context().state = 'running'
  current = false
  prepared.play()
  assert.equal(fixture.starts(), 0)
})

test('un gesto previo a cargar el módulo permite preparar el primer aviso sin perderlo', async () => {
  const fixture = audioFixture({ activated: true })
  const pending = fixture.prepareNotificationSound()
  await settle(); fixture.finishDecode()
  const prepared = await pending
  prepared.play()
  assert.equal(fixture.starts(), 1)
})

test('un contexto suspendido se recupera solo con interacción previa y respeta logout durante la espera', async () => {
  const fixture = audioFixture({ activated: true, state: 'suspended', resumeState: 'running' })
  const pending = fixture.prepareNotificationSound()
  await new Promise(resolve => setImmediate(resolve)); fixture.finishDecode()
  const prepared = await pending
  prepared.play()
  assert.equal(fixture.resumes(), 1)
  assert.equal(fixture.starts(), 1)
  fixture.context().state = 'suspended'
  let current = true
  const late = fixture.prepareNotificationSound(undefined, () => current)
  current = false
  assert.equal(await late, null)
  assert.equal(fixture.starts(), 1)
})
