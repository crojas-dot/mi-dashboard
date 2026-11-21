'use client'

import { useEffect } from 'react'

export default function PublicFormFrameHeight({ origin }: { origin: string | null }) {
  useEffect(() => {
    if (window.parent === window) return
    const targetOrigin = origin ?? window.location.origin
    let lastHeight = 0
    const send = () => {
      const h = document.body.scrollHeight
      if (h <= 0 || h === lastHeight) return
      lastHeight = h
      window.parent.postMessage({ type: 'eca-height', h }, targetOrigin)
    }
    const observer = new ResizeObserver(send)
    observer.observe(document.body)
    send()
    return () => observer.disconnect()
  }, [origin])

  return null
}
