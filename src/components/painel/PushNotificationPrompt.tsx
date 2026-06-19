'use client'

import { useEffect } from 'react'
import { isPushSupported, subscribeToPush } from '@/lib/push'

function tourKey(prestadoraId: string) {
  return `bb_onboarding_done_${prestadoraId}`
}

export function PushNotificationPrompt({ prestadoraId }: { prestadoraId: string }) {
  useEffect(() => {
    if (!isPushSupported()) return
    if (Notification.permission !== 'default') return

    function attemptRequest() {
      subscribeToPush()
    }

    if (localStorage.getItem(tourKey(prestadoraId))) {
      attemptRequest()
      return
    }

    window.addEventListener('bb-onboarding-done', attemptRequest)
    return () => window.removeEventListener('bb-onboarding-done', attemptRequest)
  }, [prestadoraId])

  return null
}
