'use client'

import { useCallback, useEffect, useId, useRef } from 'react'
import { useHeaderActionStore, type HeaderAction } from '@/lib/store/header-action-store'

export function useHeaderAction(action: HeaderAction | null) {
  const owner = useId()
  const registerAction = useHeaderActionStore((s) => s.registerAction)
  const clearAction = useHeaderActionStore((s) => s.clearAction)
  const actionRef = useRef(action)
  useEffect(() => { actionRef.current = action }, [action])
  // El header recibe una función estable; al pulsarla usa los datos del render actual.
  // No publicar el objeto inline en cada render: haría repintar todo el header al escribir.
  const onClick = useCallback(() => actionRef.current?.onClick(), [])
  const label = action?.label
  useEffect(() => {
    if (label !== undefined) registerAction(owner, { label, onClick })
    return () => clearAction(owner)
  }, [owner, label, onClick, registerAction, clearAction])
}
