export function esDrive(storagePath: string): boolean {
  return !storagePath.includes('/')
}

export function getDriveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`
}

export function getDrivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`
}

export function getDriveThumbnailUrl(fileId: string, size: number = 220): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`
}