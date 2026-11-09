import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const initial = { id: 1, weekdays: [1, 2, 3, 4, 5], holidays: [], timezone: 'America/Costa_Rica', created_at: '2026-10-15T00:00:00Z' }
const clone = value => JSON.parse(JSON.stringify(value))
const flush = () => new Promise(resolve => setImmediate(resolve))

function harness(options = {}) {
  const slots = [], pending = new Map(), writes = [], invalidations = [], reads = []
  let cursor = 0, dirty = false, tree, active = true, contextCurrent = true, logout = false
  let auth = { initialized: true, signingOut: false, vistaActiva: null, user: { id: 'admin-a', rol: 'admin' }, ...options.auth }
  let data = options.data === undefined ? clone(initial) : options.data
  let writeResolve, writeReject, readResolve, readReject
  const client = { invalidateQueries: async input => { invalidations.push(input) } }
  const react = {
    useState(initialValue) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initialValue === 'function' ? initialValue() : initialValue
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value
        if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true }
      }]
    },
    useRef(initialValue) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initialValue }; return slots[index] },
    useLayoutEffect(effect, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((dep, offset) => !Object.is(dep, previous.deps[offset]))) pending.set(index, { effect, deps })
    },
  }
  const useAuthStore = selector => selector(auth)
  useAuthStore.getState = () => auth
  const { default: Calendar } = loadModule('app/configuracion/components/CalendarioSettings.tsx', {
    react,
    '@tanstack/react-query': { useQueryClient: () => client },
    '@/lib/store/auth-store': { useAuthStore },
    '@/lib/authLogoutIntent': { isLogoutPending: () => logout },
    '@/lib/queries/queryContextScope': { captureQueryContext: () => () => contextCurrent },
    '@/lib/queries/useQmsCalendar': { qmsCalendarKey: ['qms-calendars'], useQmsCalendar: enabled => {
      reads.push(enabled)
      return { data, isPending: false, error: null, refetch: input => new Promise((resolve, reject) => {
        readResolve = next => { data = clone(next); resolve({ data }) }; readReject = reject
        reads.push(input)
      }) }
    } },
    '@/lib/services/qmsCalendarService': { publicarCalendarioQms: (...input) => new Promise((resolve, reject) => { writes.push(clone(input)); writeResolve = resolve; writeReject = reject }) },
    ...Object.fromEntries(['Button', 'Input', 'Textarea', 'Field', 'ErrorState', 'LoadingSkeleton'].map(name => [`@/components/ui/${name}`, { default: name }])),
    '@/components/usuarios/ConfirmDialog': { default: 'ConfirmDialog' },
  })
  const visit = value => Array.isArray(value) ? value.flatMap(visit) : value?.props ? [value, ...visit(value.props.children)] : []
  const nodes = () => visit(tree)
  const content = value => Array.isArray(value) ? value.map(content).join('') : value?.props ? content(value.props.children) : value ?? ''
  function render(nextActive = active) {
    active = nextActive
    do {
      dirty = false; cursor = 0; tree = Calendar({ active })
      for (const [index, { effect, deps }] of pending) { slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: effect() } }
      pending.clear()
    } while (dirty)
    return tree
  }
  const button = label => nodes().find(node => node.type === 'Button' && content(node.props.children).trim() === label)
  const click = label => { button(label).props.onClick(); render() }
  const input = id => nodes().find(node => node.props.id === id && ['Input', 'Textarea'].includes(node.type))
  const change = (id, value) => { input(id).props.onChange({ target: { value } }); render() }
  const day = label => nodes().find(node => node.type === 'label' && content(node.props.children).trim() === label)?.props.children[0]
  const toggle = label => { const checkbox = day(label); checkbox.props.onChange({ target: { checked: !checkbox.props.checked } }); render() }
  const submit = () => { nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); render() }
  render()
  return { render, nodes, button, click, input, change, day, toggle, submit, writes, invalidations, reads, content: () => content(tree),
    setData: value => { data = clone(value); render() },
    setAuth: value => { auth = { ...auth, ...value }; render() },
    logout: () => { logout = true }, invalidateContext: () => { contextCurrent = false },
    writeResolve: value => writeResolve(value), writeReject: value => writeReject(value),
    readResolve: value => readResolve(value), readReject: value => readReject(value),
    confirmation: () => nodes().find(node => node.type === 'ConfirmDialog'),
  }
}

test('calendario solo habilita la lectura para admin activo; no inventa calendario ni feriados', () => {
  const denied = harness({ auth: { user: { id: 'b', rol: 'colaborador' } } })
  assert.equal(denied.nodes().length, 0); assert.deepEqual(denied.reads, [false])
  const missing = harness({ data: null })
  assert.match(missing.content(), /No hay un calendario laboral publicado/)
  assert.equal(missing.button('Editar calendario'), undefined)
  const h = harness()
  assert.match(h.content(), /3 días hábiles/); assert.match(h.content(), /15 días hábiles/)
  assert.match(h.content(), /America\/Costa_Rica/); assert.match(h.content(), /No hay feriados registrados/)
  assert.equal(h.writes.length, 0)
})

test('añadir y quitar fechas es local; rechaza duplicados sin perder la lista ni el texto', () => {
  const h = harness(); h.click('Editar calendario')
  h.change('qms-holiday-date', '2026-12-25'); h.change('qms-holiday-description', 'Cierre confirmado'); h.click('Añadir')
  assert.match(h.content(), /Cierre confirmado/); assert.equal(h.input('qms-holiday-date').props.value, '')
  h.change('qms-holiday-date', '2026-12-25'); h.change('qms-holiday-description', 'Duplicado'); h.click('Añadir')
  assert.match(h.content(), /fechas de feriado repetidas/)
  assert.equal(h.input('qms-holiday-description').props.value, 'Duplicado')
  assert.equal(h.nodes().filter(node => node.type === 'li').length, 1)
  h.nodes().find(node => node.props['aria-label']?.startsWith('Quitar ')).props.onClick(); h.render()
  assert.equal(h.nodes().filter(node => node.type === 'li').length, 0)
  assert.equal(h.writes.length, 0)
})

test('refetch no sustituye borrador ni revisión esperada; publicar exige cambios y motivo', () => {
  const h = harness(); h.click('Editar calendario')
  h.change('qms-calendar-reason', 'Solo un motivo')
  assert.equal(h.button('Guardar calendario').props.disabled, true)
  h.toggle('Sábado'); h.change('qms-calendar-reason', ''); h.submit()
  assert.match(h.content(), /Indicá el motivo del cambio/); assert.equal(h.writes.length, 0)
  h.change('qms-calendar-reason', 'Apertura sabatina confirmada')
  h.setData({ ...initial, id: 2, weekdays: [1, 2, 3] })
  assert.equal(h.day('Sábado').props.checked, true)
  assert.equal(h.input('qms-calendar-reason').props.value, 'Apertura sabatina confirmada')
  h.submit(); h.submit()
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0][0], 1)
  assert.deepEqual(h.writes[0][1].weekdays, [1, 2, 3, 4, 5, 6])
})

test('conflicto conserva borrador; recargar exige confirmación y no publica otra revisión en silencio', async () => {
  const h = harness(); h.click('Editar calendario'); h.toggle('Sábado'); h.change('qms-calendar-reason', 'Motivo confirmado'); h.submit()
  h.writeReject({ code: '40001' }); await flush(); h.render()
  assert.equal(h.day('Sábado').props.checked, true)
  assert.equal(h.input('qms-calendar-reason').props.value, 'Motivo confirmado')
  assert.equal(h.button('Guardar calendario').props.disabled, true)
  h.click('Cargar versión vigente'); assert.equal(h.confirmation().props.open, true)
  h.confirmation().props.onCancel(); h.render()
  assert.equal(h.reads.some(value => typeof value === 'object'), false)
  h.click('Cargar versión vigente'); h.confirmation().props.onConfirm(); h.render()
  h.readReject(new Error('No se pudo conectar')); await flush(); h.render()
  assert.equal(h.input('qms-calendar-reason').props.value, 'Motivo confirmado')
  h.confirmation().props.onConfirm(); h.render()
  h.readResolve({ ...initial, id: 2, weekdays: [1, 2, 3] }); await flush(); h.render()
  assert.equal(h.confirmation().props.open, false)
  assert.equal(h.day('Sábado').props.checked, false)
  assert.equal(h.input('qms-calendar-reason').props.value, '')
  assert.equal(h.writes.length, 1)
})

test('guardado confirmado y fallo de refresco no permiten repetir la mutación', async () => {
  const h = harness(); h.click('Editar calendario'); h.toggle('Sábado'); h.change('qms-calendar-reason', 'Cambio confirmado'); h.submit()
  h.writeResolve(2); await flush(); h.render()
  h.readReject(new Error('No se pudo conectar')); await flush(); h.render()
  assert.match(h.content(), /El calendario se guardó, pero no se pudo actualizar la vista/)
  assert.equal(h.input('qms-calendar-reason'), undefined)
  assert.equal(h.button('Editar calendario').props.disabled, true)
  assert.equal(h.button('Guardar calendario'), undefined)
  h.click('Reintentar actualización'); h.readResolve({ ...initial, id: 2, weekdays: [1, 2, 3, 4, 5, 6] }); await flush(); h.render()
  assert.equal(h.button('Editar calendario').props.disabled, false)
  assert.equal(h.input('qms-calendar-reason'), undefined)
  assert.equal(h.writes.length, 1); assert.equal(h.invalidations.length, 1)
})

test('visita cerrada invalida lectura de origen pero no modifica el borrador al volver', async () => {
  const h = harness(); h.click('Editar calendario'); h.toggle('Sábado'); h.change('qms-calendar-reason', 'Borrador local'); h.submit()
  h.render(false); h.render(true)
  h.writeResolve(2); await flush(); h.render()
  assert.equal(h.input('qms-calendar-reason').props.value, 'Borrador local')
  assert.equal(h.day('Sábado').props.checked, true)
  assert.equal(h.invalidations.length, 1)
  assert.doesNotMatch(h.content(), /Calendario guardado/)
})

test('una publicación posterior de otro admin también libera la espera de actualización', async () => {
  const h = harness(); h.click('Editar calendario'); h.toggle('Sábado'); h.change('qms-calendar-reason', 'Cambio confirmado'); h.submit()
  h.writeResolve(2); await flush(); h.render()
  h.readResolve({ ...initial, id: 3, weekdays: [1, 2, 3] }); await flush(); h.render()
  assert.equal(h.button('Editar calendario').props.disabled, false)
  assert.equal(h.button('Reintentar actualización'), undefined)
  h.click('Editar calendario'); h.toggle('Sábado'); h.change('qms-calendar-reason', 'Nuevo cambio'); h.submit()
  assert.equal(h.writes[1][0], 3)
})

test('logout y ámbito cambiado bloquean efectos tardíos y nuevas publicaciones', async () => {
  for (const invalidate of [h => h.logout(), h => h.invalidateContext()]) {
    const h = harness(); h.click('Editar calendario'); h.toggle('Sábado'); h.change('qms-calendar-reason', 'Borrador local'); h.submit()
    invalidate(h); h.writeResolve(2); await flush(); h.render()
    assert.equal(h.input('qms-calendar-reason').props.value, 'Borrador local')
    assert.equal(h.invalidations.length, 0)
    assert.doesNotMatch(h.content(), /Calendario guardado/)
  }
  const h = harness(); h.click('Editar calendario'); h.toggle('Sábado'); h.change('qms-calendar-reason', 'Borrador local'); h.logout(); h.submit()
  assert.equal(h.writes.length, 0)
})

test('un feriado sin añadir no se pierde ni se publica accidentalmente con el calendario', () => {
  const h = harness(); h.click('Editar calendario'); h.toggle('Sábado'); h.change('qms-calendar-reason', 'Motivo')
  h.change('qms-holiday-date', '2026-12-25'); h.change('qms-holiday-description', 'Confirmado'); h.submit()
  assert.match(h.content(), /Añadí o limpiá el feriado pendiente/)
  assert.equal(h.input('qms-holiday-description').props.value, 'Confirmado')
  assert.equal(h.writes.length, 0)
})
