import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const model = loadModule('app/quejas/components/quejaExpedienteModel.ts')
const { CaseCycle } = loadModule('app/quejas/components/QuejaExpedientePanels.tsx', {
  '@/app/quejas/components/quejaExpedienteModel': {
    ...model,
    caseDeadline: () => ({}),
  },
  '@/components/quejas/QuejaPlazoIndicator': { default: 'Plazo' },
  '@/components/ui/Badge': { default: 'Badge' },
  '@/components/ui/Button': { default: 'Button' },
  '@/lib/constants/estados': { varianteEstado: () => 'gray' },
  '@/lib/constants/quejas': { tipoVisible: value => value },
})
const walk = value => Array.isArray(value) ? value.flatMap(walk) : value?.props ? [value, ...walk(value.props.children)] : []

test('el stepper no cambia estado: únicamente notifica la etapa solicitada', () => {
  const visited = []
  const queja = { estado: 'Resuelto' }
  const tree = CaseCycle({ queja, process: true, selectedStage: 'evaluation', onStageChange: stage => visited.push(stage) })
  const buttons = walk(tree).filter(node => node.type === 'button' && node.props['data-case-stage'])
  assert.deepEqual(buttons.map(b => b.props['data-case-stage']), ['evaluation', 'investigation', 'quality_review', 'finished'])
  assert.equal(buttons[0].props['aria-pressed'], true)
  assert.match(buttons[0].props['aria-label'], /solo lectura/)
  buttons[1].props.onClick()
  buttons[3].props.onClick()
  assert.deepEqual(visited, ['investigation', 'finished'])
  assert.equal(queja.estado, 'Resuelto')
})

test('el stepper bloquea sus controles durante una edición pendiente', () => {
  const tree = CaseCycle({ queja: { estado: 'Recibido' }, process: true, disabled: true, onStageChange() { throw Error('No se debe navegar') } })
  const buttons = walk(tree).filter(node => node.type === 'button' && node.props['data-case-stage'])
  assert.equal(buttons.length, 4)
  assert.ok(buttons.every(button => button.props.disabled === true))
})

test('No Procede conserva su recorrido abreviado sin fingir investigación o revisión', () => {
  const cycle = model.getCaseProcessCycle({ estado: 'No Procede' })
  assert.deepEqual(cycle.steps.map(step => step.id), ['evaluation', 'finished'])
})
