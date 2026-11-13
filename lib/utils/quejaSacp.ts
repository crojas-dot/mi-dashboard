/** La derivación se ofrece al revisar una propuesta real, no al investigar ni al cerrar. */
export function puedeDerivarEnRevisionGC(estado: string, sacpId: string | null | undefined, propuesta: string | null | undefined): boolean {
  return estado === 'Pendiente de Revisión GC' && !sacpId && !!propuesta?.trim()
}
