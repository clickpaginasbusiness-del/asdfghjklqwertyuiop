'use client'

import { useEffect } from 'react'

/**
 * O service worker não tem acesso à Audio() (API só existe no contexto de
 * página) — quando chega um push com tipo 'pagamento', ele avisa a aba aberta
 * via postMessage (ver PLAY_PAYMENT_SOUND em public/sw.js) e é aqui que o som
 * de fato toca. Se o navegador bloquear o autoplay, falha em silêncio — a
 * notificação em si já apareceu normalmente.
 */
export function PaymentSoundListener() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== 'PLAY_PAYMENT_SOUND') return
      new Audio('/checkoutsound.mp3').play().catch(() => {})
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage)
  }, [])

  return null
}
