import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const clone = value => JSON.parse(JSON.stringify(value))
const flush = () => new Promise(resolve => setImmediate(resolve))
const area = { id: 'area-a', modulo: 'quejas', tipo: 'area_afectada', valor: 'Innovación y TI', color: 'secondary', orden: 0, activo: true }
const inactive = { ...area, id: 'area-b', valor: 'SAL', activo: false }
const activeKey = ['catalogos', 'tipo', 'area_afectada', 'quejas']
const text = node => Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : ''

function harness({ role = 'admin', wrapper = false, props: initial = {}, loading = false, failure = null } = {}) {
  const slots = [], effects = new Map(), writes = [], errors = [], cancellations = [], invalidations = [], cacheWrites = [], pendingChanges = [], reads = []
  let cursor = 0, changed = false, tree, currentRole = role, contextCurrent = true, refetches = 0
  const all = { data: [clone(area), clone(inactive), { ...clone(area), id: 'other', modulo: 'riesgos', valor: 'Otra área' }], isLoading: loading, error: failure, refetch: async () => { refetches++ } }
  const active = { data: [{ valor: area.valor, color: area.color }], isLoading: loading, error: failure, refetch: all.refetch }
  const props = { quejaId: 'A', canManage: true, disabled: false, onPendingChange: busy => pendingChanges.push(busy), ...initial }
  const react = {
    useState(initialValue) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initialValue === 'function' ? initialValue() : initialValue
      return [slots[index], value => { const next = typeof value === 'function' ? value(slots[index]) : value; if (!Object.is(next, slots[index])) { slots[index] = next; changed = true } }]
    },
    useRef(initialValue) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initialValue }; return slots[index] },
  }
  function effect(callback, deps) {
    const index = cursor++, previous = slots[index]
    if (!previous || deps.length !== previous.deps.length || deps.some((value, offset) => !Object.is(value, previous.deps[offset]))) effects.set(index, { callback, deps })
  }
  react.useEffect = effect; react.useLayoutEffect = effect
  const deferredWrite = (kind, input) => new Promise((resolve, reject) => writes.push({ kind, input: clone(input), resolve, reject }))
  const queryClient = {
    async cancelQueries(input) { cancellations.push(clone(input)) },
    async invalidateQueries(input) { invalidations.push(clone(input)) },
    setQueryData(key, update) {
      cacheWrites.push(clone(key))
      const target = key.length === 1 ? all : active
      target.data = update(target.data)
    },
  }
  const catalogModule = loadModule('app/quejas/components/AreaQuejaCatalogo.tsx', {
    react,
    '@tanstack/react-query': { useQueryClient: () => queryClient },
    '@/lib/store/auth-store': { useAuthStore: selector => selector({ user: { rol: currentRole } }) },
    '@/lib/queries/useCatalogos': { useCatalogos: enabled => { reads.push(['all', enabled]); return all }, useCatalogoTipo: (tipo, modulo) => { reads.push(['active', tipo, modulo]); return active }, catalogosKey: ['catalogos'], catalogoTipoKey: () => activeKey },
    '@/lib/queries/queryContextScope': { captureQueryContext: () => () => contextCurrent },
    '@/lib/services/quejaWorkflowService': { guardarAreaQueja: value => deferredWrite('create', value), actualizarRegistroQueja: () => { throw new Error('El catálogo no puede asignar el expediente') } },
    '@/lib/services/quejaAreaCatalogService': { actualizarAreaCatalogo: (row, change) => deferredWrite('update', { row, change }) },
    '@/lib/services/errorToast': { showError: (...input) => errors.push(input) },
    '@/components/ui/Button': { default: 'Button' }, '@/components/ui/Input': { default: 'Input' }, '@/components/ui/Field': { default: 'Field' },
    '@/app/quejas/components/AreaCatalogoPicker': { default: 'Picker' },
  })
  const component = wrapper ? catalogModule.default : catalogModule.AreaQuejaCatalogEditor
  const visit = value => Array.isArray(value) ? value.flatMap(visit) : value?.props ? [value, ...visit(value.props.children)] : []
  const nodes = () => visit(tree)
  const byType = type => nodes().find(node => node.type === type)
  const buttons = label => nodes().filter(node => node.type === 'Button' && text(node) === label)
  const button = label => buttons(label)[0]
  const named = label => nodes().find(node => node.type === 'Button' && node.props['aria-label'] === label)
  function render(next = {}) {
    Object.assign(props, next)
    let cycles = 0
    do {
      assert.ok(cycles++ < 25, 'El render debe estabilizarse')
      changed = false; cursor = 0; tree = component(props)
      for (const [index, { callback, deps }] of effects) { slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: callback() } }
      effects.clear()
    } while (changed)
    return tree
  }
  function input(value) { byType('Input').props.onChange({ target: { value } }); render() }
  const picker = () => byType('Picker')
  function select(value) { picker().props.onChange(value); render() }
  function action(name, id) {
    const row = picker().props.rows.find(item => item.row?.id === id)?.row
    assert.ok(row, `La fila ${id} debe estar en el catálogo`)
    picker().props[name](row); render()
  }
  function start(value) { button('Añadir área').props.onClick(); render(); input(value) }
  function submit() { byType('form').props.onSubmit({ preventDefault() {} }); render() }
  function click(label) { button(label).props.onClick(); render() }
  async function resolve(index = writes.length - 1, value = {}) { writes[index].resolve(value); await flush(); render() }
  async function reject(index = writes.length - 1, error = new Error('Fixture failure')) { writes[index].reject(error); await flush(); render() }
  render()
  return { render, nodes, byType, button, buttons, named, input, picker, select, action, start, submit, click, resolve, reject, writes, errors, cancellations, invalidations, cacheWrites, pendingChanges, reads, all, active,
    getTree: () => tree, role: value => { currentRole = value; render() }, invalidateContext: () => { contextCurrent = false }, refetches: () => refetches }
}

test('wrapper no monta catálogo ni consulta para colaborador; admin/calidad lo abren de forma diferida', () => {
  const denied = harness({ role: 'colaborador', wrapper: true })
  assert.equal(denied.getTree(), null); assert.equal(denied.reads.length, 0)
  for (const role of ['admin', 'calidad']) {
    const h = harness({ role, wrapper: true })
    assert.equal(h.reads.length, 0)
    assert.equal(h.nodes().some(node => node.props.canManage !== undefined), false)
    h.nodes().find(node => node.type === 'Button').props.onClick(); h.render()
    const editor = h.nodes().find(node => node.props.canManage !== undefined)
    assert.equal(editor.props.canManage, role === 'admin')
    assert.equal(editor.props.quejaId, 'A')
  }
})

test('colaborador no puede mutar aunque se invoque el editor con canManage true', () => {
  const h = harness({ role: 'colaborador', props: { canManage: true } })
  assert.equal(h.getTree(), null)
  assert.equal(h.writes.length, 0)
  assert.ok(h.reads.some(read => read[0] === 'all' && read[1] === false))
})

test('Calidad solo consulta activas y añade; canManage true no le concede renombrar, eliminar ni restaurar', async () => {
  const h = harness({ role: 'calidad' })
  assert.equal(h.picker().props.canManage, false)
  assert.ok(h.picker().props.rows.every(item => item.row === null))
  h.select(area.valor)
  assert.equal(h.picker().props.canManage, false)
  h.picker().props.onEdit(clone(area)); h.render()
  assert.equal(h.byType('Input'), undefined)
  h.picker().props.onRemove(clone(area)); h.render()
  assert.equal(h.button('Eliminar área'), undefined)
  h.picker().props.onRestore(clone(inactive)); h.render()
  assert.equal(h.writes.length, 0)
  assert.ok(h.reads.some(read => read[0] === 'all' && read[1] === false))
  h.start('  Gestión documental  '); h.submit()
  assert.deepEqual(h.writes.map(({ kind, input }) => ({ kind, input })), [{ kind: 'create', input: 'Gestión documental' }])
  await h.resolve(0, { valor: 'Gestión documental' })
  assert.ok(h.active.data.some(item => item.valor === 'Gestión documental'))
})

test('alta solo amplía catálogo, mantiene anteriores e invalida consultas sin asignar el expediente', async () => {
  const h = harness()
  h.start('  Nueva área  '); h.submit()
  await h.resolve(0, { valor: 'Nueva área' })
  assert.equal(h.byType('Input'), undefined)
  assert.deepEqual(h.cancellations, [{ queryKey: ['catalogos'] }])
  assert.deepEqual(h.invalidations, [{ queryKey: ['catalogos'] }])
  assert.deepEqual(h.cacheWrites, [activeKey])
  assert.ok(h.active.data.some(item => item.valor === area.valor))
  assert.ok(h.active.data.some(item => item.valor === 'Nueva área'))
  assert.match(text(h.getTree()), /Seleccioná el área en el documento/)
  assert.ok(h.pendingChanges.includes(true)); assert.equal(h.pendingChanges.at(-1), false)
})

test('seleccionar activa o eliminada no escribe ni asigna y entrega las filas correctas al desplegable', () => {
  const h = harness()
  assert.equal(h.picker().props.value, '')
  assert.equal(h.picker().props.canManage, true)
  assert.deepEqual(clone(h.picker().props.rows.map(item => item.row.id)), [area.id, inactive.id])
  h.select(area.id)
  assert.equal(h.picker().props.value, area.id)
  h.select(inactive.id)
  assert.equal(h.picker().props.value, inactive.id)
  assert.equal(h.picker().props.rows.find(item => item.row.id === inactive.id).row.activo, false)
  assert.equal(h.writes.length, 0)
  assert.equal(h.cacheWrites.length, 0)
  assert.equal(h.invalidations.length, 0)
})

test('restaurar una opción eliminada usa únicamente el snapshot de su fila, sin selección previa', async () => {
  const h = harness()
  assert.equal(h.picker().props.value, '')
  h.action('onRestore', inactive.id)
  assert.deepEqual(h.writes[0].input, { row: inactive, change: { activo: true } })
  await h.resolve()
  assert.equal(h.all.data.find(item => item.id === inactive.id).activo, true)
  assert.equal(h.all.data.find(item => item.id === area.id).activo, true)
  assert.ok(h.active.data.some(item => item.valor === inactive.valor))
  assert.match(text(h.getTree()), /Área restaurada/)
})

test('editar o eliminar desde una fila no usa el área elegida en otra fila', async () => {
  const editing = harness()
  editing.select(area.id)
  editing.action('onEdit', inactive.id); editing.input('Nombre de la segunda fila'); editing.submit()
  assert.deepEqual(editing.writes[0].input, { row: inactive, change: { valor: 'Nombre de la segunda fila' } })
  await editing.resolve()
  assert.equal(editing.all.data.find(item => item.id === area.id).valor, area.valor)
  assert.equal(editing.all.data.find(item => item.id === inactive.id).valor, 'Nombre de la segunda fila')

  const removing = harness()
  removing.select(inactive.id)
  removing.action('onRemove', area.id)
  assert.equal(removing.writes.length, 0)
  assert.match(text(removing.getTree()), new RegExp(area.valor))
  removing.click('Eliminar área')
  assert.deepEqual(removing.writes[0].input, { row: area, change: { activo: false } })
  await removing.resolve()
  assert.equal(removing.all.data.find(item => item.id === area.id).activo, false)
  assert.equal(removing.all.data.find(item => item.id === inactive.id).activo, false)
  assert.equal(removing.all.data.length, 3)
})

test('una visita nueva reinicia la selección sin elegir un área ni heredar sus acciones', () => {
  const h = harness()
  h.select(area.id)
  h.render({ quejaId: 'B' })
  assert.equal(h.picker().props.value, '')
  h.select(inactive.id)
  h.render({ quejaId: 'A' })
  assert.equal(h.picker().props.value, '')
  assert.equal(h.writes.length, 0)
})

test('refrescar la opción durante renombre conserva el snapshot del editor y su borrador ante conflicto', async () => {
  const h = harness()
  h.action('onEdit', area.id); h.input('Nombre del borrador')
  h.all.data = h.all.data.map(item => item.id === area.id ? { ...item, valor: 'Cambio de otra persona', activo: false } : item)
  h.render()
  assert.equal(h.picker().props.disabled, true)
  h.submit()
  assert.deepEqual(h.writes[0].input, { row: area, change: { valor: 'Nombre del borrador' } })
  await h.reject(0, new Error('Conflicto del snapshot'))
  assert.equal(h.byType('Input').props.value, 'Nombre del borrador')
  assert.equal(h.writes.length, 1)
  assert.equal(h.cacheWrites.length, 0)
  assert.equal(h.invalidations.length, 0)
})

test('admin renombra con el snapshot original y solo actualiza catálogo, conserva históricos de otros módulos', async () => {
  const h = harness()
  assert.equal(h.picker().props.rows.some(item => item.valor === 'Otra área'), false)
  h.action('onEdit', area.id); h.input('  Área nueva  '); h.submit()
  assert.equal(h.picker().props.disabled, true)
  assert.deepEqual(h.writes[0].input, { row: area, change: { valor: '  Área nueva  ' } })
  await h.resolve()
  assert.equal(h.all.data.find(item => item.id === area.id).valor, 'Área nueva')
  assert.ok(h.active.data.some(item => item.valor === 'Área nueva'))
  assert.equal(h.active.data.some(item => item.valor === area.valor), false)
  assert.equal(h.all.data.find(item => item.id === 'other').valor, 'Otra área')
  assert.equal(h.writes.length, 1)
})

test('eliminar requiere confirmación y conserva fila histórica; restaurar devuelve la opción activa', async () => {
  const h = harness()
  h.action('onRemove', area.id)
  assert.equal(h.writes.length, 0)
  assert.match(text(h.getTree()), /expedientes que ya usan esta área se conservan/)
  assert.equal(h.picker().props.disabled, true)
  h.click('Eliminar área')
  assert.deepEqual(h.writes[0].input.change, { activo: false })
  await h.resolve()
  assert.equal(h.all.data.find(item => item.id === area.id).activo, false)
  assert.equal(h.active.data.some(item => item.valor === area.valor), false)
  assert.match(text(h.getTree()), /Área eliminada de la lista/)
  assert.equal(h.picker().props.rows.find(item => item.row.id === area.id).row.activo, false)
  h.action('onRestore', area.id); await h.resolve()
  assert.deepEqual(h.writes[1].input.change, { activo: true })
  assert.ok(h.active.data.some(item => item.valor === area.valor))
  assert.equal(h.all.data.length, 3)
})

test('duplicados se detectan sin distinguir mayúsculas o espacios incluso entre áreas inactivas', () => {
  for (const [role, value] of [['admin', '  sal  '], ['admin', '  INNOVACIÓN Y TI  '], ['calidad', '  innovación y ti  ']]) {
    const h = harness({ role }); h.start(value); h.submit()
    assert.equal(h.writes.length, 0)
    assert.match(h.errors[0][1], /Ya existe un área/)
    assert.equal(h.byType('Input').props.value, value)
  }
})

test('renombrar al propio nombre no se confunde con duplicado y colisionar con otra área no escribe', () => {
  const h = harness()
  h.action('onEdit', area.id); h.input('  SAL '); h.submit()
  assert.equal(h.writes.length, 0); assert.match(h.errors[0][1], /Ya existe/)
  h.input('innovación y ti'); h.submit()
  assert.equal(h.writes.length, 1)
})

test('vacío y más de 150 caracteres se rechazan antes de escribir; límite nativo permanece 150', () => {
  const h = harness(); h.start(' ')
  assert.equal(h.byType('Input').props.maxLength, 150)
  h.submit(); assert.equal(h.writes.length, 0)
  h.input('a'.repeat(151)); h.submit(); assert.equal(h.writes.length, 0)
  assert.equal(h.errors.length, 2)
  h.input('a'.repeat(150)); h.submit(); assert.equal(h.writes.length, 1)
})

test('fallo RLS conserva editor para corregir o reintentar y no modifica caché ni anuncia éxito', async () => {
  const h = harness()
  h.action('onEdit', area.id); h.input('Área privada'); h.submit()
  const cause = { code: '42501', message: 'Synthetic denied' }
  await h.reject(0, cause)
  assert.equal(h.byType('Input').props.value, 'Área privada')
  assert.equal(h.errors[0][0], cause)
  assert.equal(h.button('Guardar nombre').props.loading, false)
  assert.equal(h.cacheWrites.length, 0); assert.equal(h.invalidations.length, 0)
  assert.doesNotMatch(text(h.getTree()), /Catálogo guardado/)
})

test('doble envío inmediato y durante busy genera una sola escritura', async () => {
  const h = harness(); h.start('Área única')
  const submit = h.byType('form').props.onSubmit
  submit({ preventDefault() {} }); submit({ preventDefault() {} }); h.render(); h.submit()
  assert.equal(h.writes.length, 1)
  assert.equal(h.byType('Input').props.disabled, true)
  await h.resolve(0, { valor: 'Área única' })
  assert.equal(h.writes.length, 1)
})

test('A → B → A inicia otra visita, descarta UI anterior y no bloquea el nuevo editor', async () => {
  const h = harness(); h.start('Alta anterior'); h.submit()
  h.render({ quejaId: 'B' }); assert.equal(h.byType('Input'), undefined)
  assert.equal(h.button('Añadir área').props.disabled, false)
  h.render({ quejaId: 'A' }); h.start('Borrador nuevo')
  await h.resolve(0, { valor: 'Alta anterior' })
  assert.equal(h.byType('Input').props.value, 'Borrador nuevo')
  assert.equal(h.errors.length, 0)
  assert.doesNotMatch(text(h.getTree()), /Catálogo guardado/)
  assert.ok(h.active.data.some(item => item.valor === 'Alta anterior'), 'El catálogo confirmado sigue siendo compartido dentro del mismo ámbito')
})

test('respuesta de ámbito anterior no cancela, invalida ni escribe caché en el nuevo ámbito', async () => {
  const h = harness(); h.start('Alta otro ámbito'); h.submit(); h.invalidateContext()
  await h.resolve(0, { valor: 'Alta otro ámbito' })
  assert.equal(h.cancellations.length, 0); assert.equal(h.invalidations.length, 0); assert.equal(h.cacheWrites.length, 0)
  assert.equal(h.errors.length, 0)
})

test('disabled, carga y error bloquean altas; reintentar recupera la misma consulta', () => {
  for (const setup of [{ props: { disabled: true } }, { loading: true }, { failure: new Error('Fixture load error') }]) {
    const h = harness(setup)
    assert.equal(h.button('Añadir área').props.disabled, true)
    h.click('Añadir área'); assert.equal(h.byType('form'), undefined)
    assert.equal(h.writes.length, 0)
    if (setup.failure) { h.click('Reintentar'); assert.equal(h.refetches(), 1) }
  }
})

test('si la lista falla con un editor abierto, enviar conserva borrador sin escribir', () => {
  const h = harness(); h.start('Borrador conservado')
  h.all.error = new Error('Fixture refresh error'); h.render(); h.submit()
  assert.equal(h.byType('Input').props.value, 'Borrador conservado')
  assert.equal(h.byType('Input').props.disabled, true)
  assert.equal(h.writes.length, 0)
})
