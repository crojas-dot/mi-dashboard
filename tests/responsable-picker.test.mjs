import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const usuarios = [
  { id: 'ana', nombre: 'Ana López', email: 'ana.lopez@example.invalid' },
  { id: 'jose', nombre: 'José Núñez', email: 'j.nunez@example.invalid' },
  { id: 'maria', nombre: 'María Fernández con ambos apellidos', email: 'maria@example.invalid' },
]

// Se ejecuta el componente real con eventos/estado de React y DOM local.
// La geometría/top layer se verifica además con el diálogo real en navegador.
function pickerHarness(overrides = {}) {
  const slots = [], pending = new Map(), listeners = new Map(), selected = []
  let cursor = 0, changed = false, tree, focusCount = 0
  let props = { id: 'responsable', options: usuarios, value: null, onSelect: user => selected.push(user), ...overrides }
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], value => {
        const next = typeof value === 'function' ? value(slots[index]) : value
        if (!Object.is(next, slots[index])) { slots[index] = next; changed = true }
      }]
    },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index] },
    useMemo: create => create(),
    useCallback: callback => callback,
    useLayoutEffect() {},
    useEffect(effect, deps) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || deps.some((dep, offset) => !Object.is(dep, previous.deps[offset]))) pending.set(index, { effect, deps })
    },
  }
  const { default: Picker } = loadModule('app/quejas/components/ResponsablePicker.tsx', {
    react,
    '@/components/ui/Button': { default: 'Button' },
    '@/components/ui/Input': { default: 'Input' },
  }, {
    document: {
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name) },
    },
  })
  const visit = value => Array.isArray(value) ? value.flatMap(visit) : value?.props ? [value, ...visit(value.props.children)] : []
  const nodes = () => visit(tree)
  const trigger = () => nodes().find(node => node.type === 'Button')
  const input = () => nodes().find(node => node.type === 'Input')
  const options = () => nodes().filter(node => node.props.role === 'option')
  function render(next = {}) {
    props = { ...props, ...next }
    do {
      changed = false; cursor = 0; tree = Picker(props)
      trigger().props.ref.current = { focus: () => focusCount++ }
      for (const [index, { effect, deps }] of pending) {
        slots[index]?.cleanup?.()
        slots[index] = { deps, cleanup: effect() }
      }
      pending.clear()
    } while (changed)
    return tree
  }
  function event(key) {
    return { key, defaultPrevented: false, propagationStopped: false,
      preventDefault() { this.defaultPrevented = true }, stopPropagation() { this.propagationStopped = true } }
  }
  const open = () => { trigger().props.onClick(); render() }
  const search = query => { input().props.onChange({ target: { value: query } }); render() }
  render()
  return { render, nodes, trigger, input, options, open, search, selected, listeners, event, focusCount: () => focusCount }
}

test('el selector filtra nombres con tildes y correo sin distinguir mayúsculas', () => {
  const h = pickerHarness(); h.open(); h.search('JOSE NUNEZ')
  assert.deepEqual(h.options().map(option => option.props.title), ['José Núñez · j.nunez@example.invalid'])
  h.search('ANA.LOPEZ@EXAMPLE.INVALID')
  assert.equal(h.options().length, 1)
  assert.match(h.options()[0].props.title, /^Ana López/)
  h.search('')
  assert.equal(h.options().length, 3)
})

test('flechas y Enter seleccionan una opción válida y devuelven el foco al encabezado', () => {
  const h = pickerHarness(); h.open()
  const down = h.event('ArrowDown'); h.input().props.onKeyDown(down); h.render()
  assert.equal(down.defaultPrevented, true)
  assert.equal(h.input().props['aria-activedescendant'], 'responsable-option-1')
  const enter = h.event('Enter'); h.input().props.onKeyDown(enter); h.render()
  assert.equal(enter.defaultPrevented, true)
  assert.equal(h.selected[0].id, 'jose')
  assert.equal(h.trigger().props['aria-expanded'], false)
  assert.equal(h.focusCount(), 1)
})

test('Escape consume el evento antes del diálogo y cierra solo el selector', () => {
  const h = pickerHarness(); h.open()
  const escape = h.event('Escape')
  h.listeners.get('keydown')(escape); h.render()
  assert.equal(escape.defaultPrevented, true)
  assert.equal(escape.propagationStopped, true)
  assert.equal(h.trigger().props['aria-expanded'], false)
  assert.equal(h.selected.length, 0)
  assert.equal(h.focusCount(), 1)
  assert.equal(h.listeners.has('keydown'), false)
})

test('Tab cierra el desplegable y permanece dentro del diálogo', () => {
  const h = pickerHarness(); h.open()
  const tab = h.event('Tab'); h.input().props.onKeyDown(tab); h.render()
  assert.equal(tab.defaultPrevented, true)
  assert.equal(tab.propagationStopped, true)
  assert.equal(h.trigger().props['aria-expanded'], false)
  assert.equal(h.focusCount(), 1)
})

test('la solicitud de validación abre búsqueda, anuncia error y permite volver a buscar', () => {
  const h = pickerHarness(); h.render({ openRequest: 1, validationMessage: 'Debés asignar un responsable antes de guardar.' })
  assert.equal(h.trigger().props['aria-expanded'], true)
  assert.equal(h.trigger().props['aria-invalid'], true)
  assert.ok(h.nodes().some(node => node.props.role === 'alert' && node.props.children === 'Debés asignar un responsable antes de guardar.'))
  h.search('sin resultado')
  assert.equal(h.options().length, 0)
  assert.equal(h.input().props['aria-activedescendant'], undefined)
  const enter = h.event('Enter'); h.input().props.onKeyDown(enter)
  assert.equal(h.selected.length, 0)
  h.render({ openRequest: 2 })
  assert.equal(h.options().length, 3)
  h.render({ openRequest: 0 })
  h.listeners.get('keydown')(h.event('Escape')); h.render()
  assert.equal(h.trigger().props['aria-expanded'], false)
  h.render({ openRequest: 1 })
  assert.equal(h.trigger().props['aria-expanded'], true)
})

test('selección conserva el nombre completo accesible y disabled no abre ni selecciona', () => {
  const h = pickerHarness({ value: usuarios[2] })
  assert.match(h.trigger().props['aria-label'], /María Fernández con ambos apellidos/)
  assert.equal(h.trigger().props.title, `${usuarios[2].nombre} · ${usuarios[2].email}`)
  h.render({ disabled: true }); h.open()
  assert.equal(h.trigger().props['aria-expanded'], false)
  assert.equal(h.input(), undefined)
  assert.equal(h.selected.length, 0)
})
