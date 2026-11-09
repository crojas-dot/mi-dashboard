import test from 'node:test'
import assert from 'node:assert/strict'
import { loadModule } from './load-module.mjs'

const core = loadModule('lib/utils/publicQuejaValidation.ts')
const client = loadModule('lib/services/publicQuejasClient.ts')
const server = loadModule('lib/server/publicForms/validation.ts')
const DRAFT = { nombre: 'Persona sintética', email: 'persona@example.test', telefono: '', categoria: 'Queja', descripcion: 'Estoy probando una nueva queja,' }
const ADMIN = { formToken: '12345678123442348234123456789abc', submissionId: '22345678-1234-4234-8234-123456789abc', honeypot: '' }
const fields = ['nombre', 'email', 'telefono', 'categoria', 'descripcion']
const catchError = (action) => { try { action() } catch (error) { return error }; assert.fail('La validación debía rechazar los datos') }

test('cliente y API aceptan el borrador normal de prueba y normalizan el mismo contenido', () => {
  const draft = { ...DRAFT, nombre: '  Nombre sinte\u0301tico  ', email: ' Persona@Example.TEST ', telefono: ' 1234 ', descripcion: ' Primera línea\r\nSegunda línea\rTercera\tparte ' }
  const clientDraft = client.validarBorradorPublico(draft)
  const serverDraft = server.validatePublicSubmission({ ...draft, ...ADMIN })
  for (const field of fields) assert.equal(clientDraft[field], serverDraft[field], field)
  assert.equal(clientDraft.email, 'persona@example.test')
  assert.equal(clientDraft.nombre, 'Nombre sintético')
  assert.equal(clientDraft.descripcion, 'Primera línea\nSegunda línea\nTercera\tparte')
  assert.equal(draft.email, ' Persona@Example.TEST ')
  assert.deepEqual(Object.keys(clientDraft).sort(), [...fields].sort())
  assert.equal(server.validatePublicSubmission({ ...DRAFT, ...ADMIN }).descripcion, DRAFT.descripcion)
})

test('ambas capas rechazan los mismos correos y controles con código y campo precisos', () => {
  const cases = [
    ['nombre', 'Persona\nSintética'], ['nombre', 'Persona\tSintética'], ['nombre', 'Persona\u0000Sintética'],
    ['email', 'uno,dos@example.test'], ['email', 'uno;dos@example.test'], ['email', '<uno>@example.test'],
    ['email', 'uno@example.test\notro@example.test'], ['email', 'uno\u0001@example.test'],
    ['telefono', '123\n456'], ['telefono', '123\t456'], ['telefono', '123\u007f456'],
    ['categoria', 'Tipo no admitido'], ['categoria', 'Queja\nOtra'], ['descripcion', 'Texto\u0001sintético'],
  ]
  for (const [field, value] of cases) {
    const draft = { ...DRAFT, [field]: value }
    const clientError = catchError(() => client.validarBorradorPublico(draft))
    const serverError = catchError(() => server.validatePublicSubmission({ ...draft, ...ADMIN }))
    assert.equal(clientError.field, field)
    assert.equal(clientError.code, `invalid_public_${field}`)
    assert.equal(client.fieldFromPublicError(clientError), field)
    assert.equal(serverError.status, 400)
    assert.equal(serverError.code, clientError.code)
    assert.equal(serverError.field, field)
    assert.equal(client.publicErrorMessage(clientError, 'Error'), client.publicErrorMessage(new client.PublicRequestError(400, serverError.code), 'Error'))
    assert.ok(!client.publicErrorMessage(clientError, 'Error').includes(value), field)
  }
})

test('cliente y API conservan límites exactos, cinco categorías y teléfono opcional', () => {
  for (const [field, maximum] of [['nombre', 150], ['telefono', 40], ['descripcion', 10000]]) {
    const accepted = { ...DRAFT, [field]: 'a'.repeat(maximum) }
    assert.equal(client.validarBorradorPublico(accepted)[field].length, maximum)
    assert.equal(server.validatePublicSubmission({ ...accepted, ...ADMIN })[field].length, maximum)
    const rejected = { ...DRAFT, [field]: 'a'.repeat(maximum + 1) }
    assert.equal(catchError(() => client.validarBorradorPublico(rejected)).field, field)
    assert.equal(catchError(() => server.validatePublicSubmission({ ...rejected, ...ADMIN })).field, field)
  }
  const exactEmail = 'a'.repeat(247) + '@ex.tst'
  assert.equal(exactEmail.length, 254)
  assert.equal(client.validarBorradorPublico({ ...DRAFT, email: exactEmail }).email, exactEmail)
  assert.equal(server.validatePublicSubmission({ ...DRAFT, ...ADMIN, email: exactEmail }).email, exactEmail)
  assert.equal(catchError(() => client.validarBorradorPublico({ ...DRAFT, email: `a${exactEmail}` })).field, 'email')
  const expandsWhenLowercased = '\u0130'.repeat(124) + '@ex.tst'
  assert.ok(expandsWhenLowercased.length < 254)
  assert.ok(expandsWhenLowercased.toLowerCase().length > 254)
  assert.equal(catchError(() => client.validarBorradorPublico({ ...DRAFT, email: expandsWhenLowercased })).field, 'email')
  assert.equal(catchError(() => server.validatePublicSubmission({ ...DRAFT, ...ADMIN, email: expandsWhenLowercased })).field, 'email')
  for (const categoria of ['Queja', 'Observación', 'Sugerencia', 'Reclamo', 'Felicitación']) {
    assert.equal(client.validarBorradorPublico({ ...DRAFT, categoria }).categoria, categoria)
    assert.equal(server.validatePublicSubmission({ ...DRAFT, ...ADMIN, categoria }).categoria, categoria)
  }
  assert.equal(catchError(() => client.validarBorradorPublico({ ...DRAFT, categoria: 'Denuncia' })).field, 'categoria')
  assert.equal(catchError(() => server.validatePublicSubmission({ ...DRAFT, ...ADMIN, categoria: 'Denuncia' })).field, 'categoria')
  assert.equal(client.validarBorradorPublico({ ...DRAFT, telefono: undefined }).telefono, '')
  assert.equal(server.validatePublicSubmission({ ...DRAFT, ...ADMIN, telefono: undefined }).telefono, '')
  for (const field of fields) {
    assert.equal(catchError(() => client.validarBorradorPublico({ ...DRAFT, [field]: null })).field, field)
    assert.equal(catchError(() => server.validatePublicSubmission({ ...DRAFT, ...ADMIN, [field]: null })).field, field)
  }
})

test('solo los códigos permitidos de una respuesta de validación identifican campos', () => {
  for (const field of fields) {
    for (const status of [400, 422]) {
      const error = new client.PublicRequestError(status, `invalid_public_${field}`, '<diagnóstico privado>')
      assert.equal(client.fieldFromPublicError(error), field)
      const message = client.publicErrorMessage(error, 'Error')
      assert.ok(message.length > 15)
      assert.doesNotMatch(message, /diagnóstico|privado|</)
    }
  }
  for (const code of ['invalid_public_request', 'invalid_public_formToken', 'invalid_public_submissionId', 'honeypot_rejected', '__proto__', 'constructor', undefined]) {
    assert.equal(client.fieldFromPublicError(new client.PublicRequestError(400, code)), null)
    assert.equal(core.publicQuejaFieldFromCode(code), null)
  }
  assert.equal(client.fieldFromPublicError(new client.PublicRequestError(503, 'invalid_public_email')), null)
  assert.equal(client.fieldFromPublicError({ field: 'email', code: 'invalid_public_email' }), null)
  assert.equal(client.fieldFromPublicError(new Error('invalid_public_email')), null)
})

test('errores de tokens, IDs, antispam y campos administrativos no se atribuyen al ciudadano', () => {
  for (const changes of [
    { formToken: 'token-inválido' }, { submissionId: 'no-es-uuid' }, { honeypot: 'autocompletado' },
    { estado: 'Resuelto' }, { responsable_id: 'sintético' }, { categoria: 'Queja', revision: 1 },
  ]) {
    const error = catchError(() => server.validatePublicSubmission({ ...DRAFT, ...ADMIN, ...changes }))
    assert.equal(error.field, undefined)
    assert.equal(core.publicQuejaFieldFromCode(error.code), null)
  }
})
