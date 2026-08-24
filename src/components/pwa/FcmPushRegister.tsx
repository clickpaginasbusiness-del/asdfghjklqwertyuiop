'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { createClient } from '@/lib/supabase/client'

/**
 * Contraparte nativa de subscribeToPush (src/lib/push.ts, Web Push/VAPID) —
 * Web Push não funciona dentro da WebView empacotada pelo Capacitor, então o
 * app nativo precisa de FCM em paralelo. Os dois canais coexistem: a mesma
 * prestadora pode ter linhas em push_subscriptions (navegador/PWA) e em
 * fcm_tokens (app Android) ao mesmo tempo.
 *
 * Só age depois de confirmar sessão — sem isso, o prompt nativo de permissão
 * dispara já na tela de login (sem prestadora pra vincular o token).
 */
export function FcmPushRegister() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const supabase = createClient()
    let registrado = false

    async function registrar() {
      if (registrado) return
      registrado = true

      const permStatus = await PushNotifications.checkPermissions()
      let receive = permStatus.receive
      if (receive === 'prompt' || receive === 'prompt-with-rationale') {
        const result = await PushNotifications.requestPermissions()
        receive = result.receive
      }
      if (receive !== 'granted') {
        registrado = false
        return
      }

      await PushNotifications.register()
    }

    const registrationListener = PushNotifications.addListener('registration', async (token) => {
      try {
        const response = await fetch('/api/push/fcm-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token.value }),
        })
        if (!response.ok) {
          console.error('[FcmPushRegister] fcm-subscribe falhou — status:', response.status)
        }
      } catch (err) {
        console.error('[FcmPushRegister] erro de rede ao salvar token FCM:', err)
      }
    })

    const errorListener = PushNotifications.addListener('registrationError', (err) => {
      console.error('[FcmPushRegister] erro ao registrar dispositivo para push nativo:', err)
      registrado = false
    })

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) registrar()
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') registrar()
    })

    return () => {
      registrationListener.then((handle) => handle.remove())
      errorListener.then((handle) => handle.remove())
      authListener.subscription.unsubscribe()
    }
  }, [])

  return null
}
