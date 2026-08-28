'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'
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

    // Mensagens FCM notification+data (ver src/app/api/push/send/route.ts) só
    // chegam aqui com o app em foreground — em background/fechado o Android
    // já mostra a notificação sozinho, e o toque nela dispara
    // pushNotificationActionPerformed, nunca pushNotificationReceived. Por
    // isso não precisa de nenhuma checagem extra pra evitar duplicata.
    const receivedListener = PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      const { display } = await LocalNotifications.checkPermissions()
      if (display !== 'granted') return // já deveria estar granted, já que o push registrou com sucesso

      await LocalNotifications.schedule({
        notifications: [{
          id: Date.now() % 2147483647,
          title: notification.title ?? 'BelleBook',
          body: notification.body ?? '',
        }],
      })
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
      receivedListener.then((handle) => handle.remove())
      authListener.subscription.unsubscribe()
    }
  }, [])

  return null
}
