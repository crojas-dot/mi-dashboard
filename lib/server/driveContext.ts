import 'server-only'
import { after } from 'next/server'

export function programarContextoDrive(folderId: string) {
  const url = process.env.APPS_SCRIPT_WEBAPP_URL
  if (!url) return
  // after mantiene el trabajo asociado a la respuesta en el runtime de Next.
  after(async () => {
    for (let intento = 0; intento < 3; intento++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId }),
          signal: AbortSignal.timeout(8_000),
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        await response.body?.cancel()
        return
      } catch (error) {
        console.error('[drive/contexto]', { folderId, intento: intento + 1 }, error)
        if (intento < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (intento + 1)))
      }
    }
  })
}
