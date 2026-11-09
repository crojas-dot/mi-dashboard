import { initBotId } from 'botid/client/core'

// El SDK solo adjunta prueba a estas operaciones públicas; el panel conserva su Auth.
initBotId({ protect: [
  { path: '/api/public/quejas', method: 'POST', advancedOptions: { checkLevel: 'basic' } },
  { path: '/api/drive/upload-public', method: 'POST', advancedOptions: { checkLevel: 'basic' } },
  { path: '/api/public/quejas/finalizar', method: 'POST', advancedOptions: { checkLevel: 'basic' } },
  { path: '/api/public/seguimiento', method: 'POST', advancedOptions: { checkLevel: 'basic' } },
  { path: '/api/public/seguimiento/documento', method: 'POST', advancedOptions: { checkLevel: 'basic' } },
] })
