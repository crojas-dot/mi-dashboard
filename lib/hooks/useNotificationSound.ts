'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/lib/store/auth-store'
import { prepareNotificationSound } from '@/lib/services/sonidosNotificacion'
import { claimNotificationSound, createNotificationSoundTracker } from '@/lib/utils/notificationSound'

interface NotificationSoundOptions {
  userId: string | null
  ready: boolean
  notifications: readonly { id: string; leida: boolean }[]
  enabled: boolean
  soundEnabled: boolean
  soundId?: string
}

export function useNotificationSound({ userId, ready, notifications, enabled, soundEnabled, soundId }: NotificationSoundOptions) {
  const tracker = useRef(createNotificationSoundTracker())
  const scope = useRef({ active: false })

  useEffect(() => {
    const visit = { active: true }
    scope.current = visit
    return () => { visit.active = false }
  }, [userId, enabled, soundEnabled, soundId])

  useEffect(() => {
    const ids = tracker.current.observe({ userId, ready, enabled: enabled && soundEnabled, notifications })
    if (!userId || !ids.length) return
    const visit = scope.current
    const isCurrent = () => {
      const auth = useAuthStore.getState()
      return visit.active && !auth.signingOut && auth.user?.id === userId
        && auth.user.notif_habilitadas !== false && auth.user.notif_sonido !== false
    }
    // Otra pestaña puede estar mostrando el formulario. Solo reclama quien tiene
    // audio preparado; una pestaña bloqueada por autoplay no silencia a las demás.
    void prepareNotificationSound(soundId, isCurrent).then(async (prepared) => {
      if (!prepared || !isCurrent()) return
      const claimed = await claimNotificationSound(userId, ids, () => isCurrent() && prepared.ready())
      if (claimed && isCurrent()) prepared.play()
    })
  }, [userId, ready, notifications, enabled, soundEnabled, soundId])
}
