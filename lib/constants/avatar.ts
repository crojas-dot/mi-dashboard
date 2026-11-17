export const AVATAR_BUCKET = 'qms-avatars'
export const AVATAR_ENDPOINT = '/api/perfil/avatar'
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp'
export const AVATAR_UPLOAD_BYTES = 2 * 1024 * 1024
export const AVATAR_STORED_BYTES = 512 * 1024

export function rutaAvatar(value: unknown, userId: string): string | null {
  if (typeof value !== 'string' || !value.startsWith(userId + '/')) return null
  const name = value.slice(userId.length + 1)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(name) ? value : null
}
