import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const { getCaseRoleCycle, CASE_ACTIONS, CASE_FLOW } = loadModule('app/quejas/components/quejaExpedienteModel.ts')
const flags = cycle => Array.from(cycle.steps, step => `${Number(step.current)}:${Number(step.completed)}`).join(',')

test('Calidad muestra solo sus tareas y espera al responsable sin inventar una revisión activa', () => {
  const cases = {
    Recibido: '1:0,0:0,0:0',
    'En Investigación': '0:1,0:0,0:0',
    'Pendiente de Revisión GC': '0:1,1:0,0:0',
    Resuelto: '0:1,0:1,1:0',
    Finalizado: '0:1,0:1,0:1',
  }
  for (const [estado, expected] of Object.entries(cases)) {
    const cycle = getCaseRoleCycle({ estado }, 'quality')
    assert.equal(cycle.label, 'Gestión de Calidad')
    assert.equal(Array.from(cycle.steps, step => step.label).join('|'), 'Evaluación|Revisión de Calidad|Cierre')
    assert.equal(flags(cycle), expected, estado)
  }
  assert.equal(getCaseRoleCycle({ estado: 'En Investigación' }, 'quality').detail, 'Investigación a cargo del responsable.')
})

test('el responsable ve asignación, investigación y propuesta sin tareas de aprobación de Calidad', () => {
  const cases = {
    Recibido: '1:0,0:0,0:0',
    'En Investigación': '0:1,1:0,0:0',
    'Pendiente de Revisión GC': '0:1,0:1,0:1',
    Resuelto: '0:1,0:1,0:1',
    Finalizado: '0:1,0:1,0:1',
  }
  for (const [estado, expected] of Object.entries(cases)) {
    const cycle = getCaseRoleCycle({ estado }, 'investigator')
    assert.equal(cycle.label, 'Tu trabajo')
    assert.equal(cycle.detail, 'Calidad continúa después del envío.')
    assert.equal(Array.from(cycle.steps, step => step.label).join('|'), 'Asignación|Investigación|Propuesta enviada')
    assert.equal(flags(cycle), expected, estado)
  }
})

test('No Procede omite revisión de Calidad e investigación que nunca ocurrió', () => {
  const quality = getCaseRoleCycle({ estado: 'No Procede' }, 'quality')
  assert.equal(Array.from(quality.steps, step => step.label).join('|'), 'Evaluación|Cierre')
  assert.equal(flags(quality), '0:1,0:1')
  const researcher = getCaseRoleCycle({ estado: 'No Procede' }, 'investigator')
  assert.equal(researcher.steps.length, 1)
  assert.equal(researcher.steps[0].label, 'Sin investigación')
  assert.equal(flags(researcher), '1:0')
  assert.match(researcher.detail, /no requiere investigación/)
})

test('estados desconocidos no atribuyen tareas actuales ni completadas', () => {
  for (const audience of ['quality', 'investigator']) {
    for (const estado of ['Desconocido', '', 'constructor', 'toString', '__proto__']) {
      const cycle = getCaseRoleCycle({ estado }, audience)
      assert.ok(cycle.steps.every(step => !step.current && !step.completed), `${audience}: ${estado}`)
    }
  }
})

test('devolver a investigación refleja el estado actual sin conservar aprobaciones anteriores', () => {
  for (const audience of ['quality', 'investigator']) {
    getCaseRoleCycle({ estado: 'Pendiente de Revisión GC' }, audience)
    const reopened = getCaseRoleCycle({ estado: 'En Investigación' }, audience)
    assert.equal(flags(reopened), audience === 'quality' ? '0:1,0:0,0:0' : '0:1,1:0,0:0')
  }
})

test('proyectar ciclos no modifica el expediente ni los contratos del workflow compartido', () => {
  const beforeActions = JSON.stringify(CASE_ACTIONS)
  const beforeFlow = JSON.stringify(CASE_FLOW)
  const queja = Object.freeze({ estado: 'En Investigación', revision: 7, plazo_vence: '2026-11-05T23:59:00-06:00' })
  const cycle = getCaseRoleCycle(queja, 'quality')
  cycle.steps[0].completed = false
  assert.equal(getCaseRoleCycle(queja, 'quality').steps[0].completed, true)
  assert.equal(queja.revision, 7)
  assert.equal(queja.plazo_vence, '2026-11-05T23:59:00-06:00')
  assert.equal(JSON.stringify(CASE_ACTIONS), beforeActions)
  assert.equal(JSON.stringify(CASE_FLOW), beforeFlow)
  assert.equal(CASE_ACTIONS['En Investigación'].action, 'Resolver')
  assert.equal(CASE_ACTIONS['Pendiente de Revisión GC'].step, 3)
})
