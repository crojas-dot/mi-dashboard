const LOCAL_MIMES: Record<string, 'image' | 'pdf' | 'text' | 'audio' | 'video'> = {
  'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image',
  'image/gif': 'image', 'image/bmp': 'image', 'image/avif': 'image',
  'application/pdf': 'pdf', 'text/plain': 'text', 'text/csv': 'text',
  'audio/mpeg': 'audio', 'audio/wav': 'audio', 'audio/ogg': 'audio',
  'video/mp4': 'video', 'video/webm': 'video',
}

const MIMES_POR_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif',
  txt: 'text/plain', csv: 'text/csv', mp3: 'audio/mpeg', wav: 'audio/wav',
  ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm',
}

export function tipoVistaLocal(mime: string | null | undefined, nombre: string) {
  const declared = mime?.toLowerCase().split(';')[0].trim()
  const extension = nombre.split('.').pop()?.toLowerCase() ?? ''
  const normalized = declared && declared !== 'application/octet-stream'
    ? declared : MIMES_POR_EXTENSION[extension]
  return normalized && Object.hasOwn(LOCAL_MIMES, normalized)
    ? { kind: LOCAL_MIMES[normalized], mime: normalized } : null
}
