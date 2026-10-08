'use client'

import { useRef, useState } from 'react'

/** El ref cierra el intervalo entre el evento y el render del control disabled. */
export function useOperationLock<Operation extends string>() {
  const lockedRef = useRef(false)
  const [operation, setOperation] = useState<Operation | null>(null)

  function begin(next: Operation): boolean {
    if (lockedRef.current) return false
    lockedRef.current = true
    setOperation(next)
    return true
  }

  function finish() {
    lockedRef.current = false
    setOperation(null)
  }

  return { operation, begin, finish, isLocked: () => lockedRef.current }
}
