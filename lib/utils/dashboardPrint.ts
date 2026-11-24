/** Conserva el título original aun si se cancela la impresión.
 * No restaurar inmediatamente al retornar print(): hay navegadores no bloqueantes.
 */
export function printExecutiveReport(module: string, period: string) {
  const original = document.title
  const reportTitle = 'ECA-QMS - Informe Ejecutivo - ' + module + ' - ' + period
  const media = window.matchMedia('print')
  let finished = false
  let lostFocus = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const restore = () => {
    if (finished) return
    finished = true
    if (timer !== undefined) clearTimeout(timer)
    window.removeEventListener('afterprint', restore)
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('focus', onFocus)
    media.removeEventListener('change', onMedia)
    if (document.title === reportTitle) document.title = original
  }
  const onBlur = () => { lostFocus = true }
  const onFocus = () => { if (lostFocus && !media.matches) restore() }
  const onMedia = (event: MediaQueryListEvent) => { if (!event.matches) restore() }
  const fallback = () => {
    if (finished) return
    if (!media.matches && document.hasFocus()) restore()
    else timer = setTimeout(fallback, 60_000)
  }

  window.addEventListener('afterprint', restore, { once: true })
  window.addEventListener('blur', onBlur)
  window.addEventListener('focus', onFocus)
  media.addEventListener('change', onMedia)
  document.title = reportTitle
  try {
    window.print()
    if (!finished) timer = setTimeout(fallback, 60_000)
  } catch (error) {
    restore()
    throw error
  }
  return restore
}
