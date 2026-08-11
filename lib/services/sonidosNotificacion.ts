export const SONIDOS_NOTIFICACION = [
  { id: 'notification/info', label: 'Info' },
  { id: 'notification/success', label: 'Éxito' },
  { id: 'notification/popup', label: 'Popup' },
  { id: 'notification/error', label: 'Error' },
  { id: 'game/coin', label: 'Moneda' },
  { id: 'game/void', label: 'Vacío' },
  { id: 'game/hit', label: 'Golpe' },
  { id: 'game/miss', label: 'Fallo' },
] as const

export type SonidoNotificacionId = (typeof SONIDOS_NOTIFICACION)[number]['id']

export const SONIDO_DEFAULT: SonidoNotificacionId = 'notification/info'

// MP3 reales de react-sounds (mismos 8 sonidos de la web) autocontenidos en
// /public/sounds — sin CDN externo. Fuente: @url{https://www.reactsounds.com/}
const SONIDO_FILES: Record<SonidoNotificacionId, string> = {
  'notification/info': '/sounds/notification-info.mp3',
  'notification/success': '/sounds/notification-success.mp3',
  'notification/popup': '/sounds/notification-popup.mp3',
  'notification/error': '/sounds/notification-error.mp3',
  'game/coin': '/sounds/game-coin.mp3',
  'game/void': '/sounds/game-void.mp3',
  'game/hit': '/sounds/game-hit.mp3',
  'game/miss': '/sounds/game-miss.mp3',
}

// Contexto de audio único para toda la app. Se crea en el primer gesto del
// usuario (click/tecla) y se reutiliza para reproducir sin fricción.
let audioCtx: AudioContext | null = null
let unlocking = false

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return null
    try {
      audioCtx = new Ctx({ latencyHint: 'interactive' })
    } catch {
      return null
    }
  }
  return audioCtx
}

async function unlockAudioContext(): Promise<AudioContext | null> {
  const ctx = getAudioContext()
  if (!ctx) return null
  if (ctx.state === 'running') return ctx
  try {
    await ctx.resume()
  } catch {
    // Sigue suspendido hasta el próximo gesto; el desbloqueo por listener lo retoma.
  }
  return ctx
}

// Desbloquea el audio en el primer gesto del usuario (política de autoplay).
if (typeof window !== 'undefined') {
  const unlock = () => {
    if (unlocking) return
    unlocking = true
    unlockAudioContext().finally(() => {
      unlocking = false
    })
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  window.addEventListener('touchstart', unlock)
}

// Cache de buffers decodificados para no re-decodificar mp3 en cada play.
const buffersCache = new Map<string, Promise<AudioBuffer | null>>()

function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  const cached = buffersCache.get(url)
  if (cached) return cached
  const p = (async () => {
    try {
      const res = await fetch(url)
      const arrayBuffer = await res.arrayBuffer()
      return await ctx.decodeAudioData(arrayBuffer)
    } catch {
      return null
    }
  })()
  buffersCache.set(url, p)
  return p
}

export async function playNotificationSound(id?: string) {
  const sonidoId = (id as SonidoNotificacionId) || SONIDO_DEFAULT
  const url = SONIDO_FILES[sonidoId] ?? SONIDO_FILES[SONIDO_DEFAULT]
  const ctx = await unlockAudioContext()
  if (!ctx || ctx.state !== 'running') return

  const buffer = await loadBuffer(ctx, url)
  if (!buffer) return

  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.9, 0)
  source.connect(gain)
  gain.connect(ctx.destination)
  source.start()
}