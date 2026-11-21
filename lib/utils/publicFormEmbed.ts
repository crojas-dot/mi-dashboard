/** A rendered form and its framing policy must agree on the exact WordPress origin. */
export function publicFormFrameOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i.test(url.hostname)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    return url.origin
  } catch { return null }
}
