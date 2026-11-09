import 'server-only'
import { checkBotId } from 'botid/server'
import { PublicFormsInputError } from './validation'
import { PublicFormsUnavailableError } from './config'

/** Las pruebas locales no deben convertirse en una excepción de producción. */
export async function verifyPublicBot(request: Request) {
  if (process.env.VERCEL !== '1') {
    if (process.env.NODE_ENV === 'development') return
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)
    if (process.env.PUBLIC_FORMS_LOCAL_TESTING === 'true' && loopback) return
    throw new PublicFormsUnavailableError()
  }
  try {
    // Impedir el bypass de desarrollo del SDK incluso si se configuró mal NODE_ENV.
    const result = await checkBotId({ developmentOptions: { isDevelopment: false }, advancedOptions: { checkLevel: 'basic' } })
    if (typeof result.isBot !== 'boolean' || typeof result.isHuman !== 'boolean') throw new PublicFormsUnavailableError()
    if (result.isBot || !result.isHuman || result.isVerifiedBot) throw new PublicFormsInputError(403, 'verification_failed')
  } catch (error) {
    if (error instanceof PublicFormsInputError) throw error
    throw new PublicFormsUnavailableError()
  }
}
