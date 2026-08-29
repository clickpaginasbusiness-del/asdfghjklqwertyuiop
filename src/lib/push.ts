import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const registration = await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
  }

  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  })

  return response.ok
}

export type PushPermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported'

/**
 * Versão ciente de plataforma de "isPushSupported() + Notification.permission"
 * — dentro da WebView do Capacitor, Web Push não existe (ver FcmPushRegister.tsx),
 * então checa a permissão nativa do FCM via @capacitor/push-notifications em vez
 * disso. No nativo, 'prompt' cobre tanto o estado 'prompt' quanto
 * 'prompt-with-rationale' do Capacitor — nos dois o Android ainda mostra o
 * diálogo de novo ao chamar requestPermissions(); só 'denied' é terminal (o
 * Android para de mostrar o diálogo depois da negativa ser cacheada como
 * definitiva — chamar requestPermissions() nesse estado não faz nada).
 */
export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (Capacitor.isNativePlatform()) {
    const { receive } = await PushNotifications.checkPermissions()
    if (receive === 'granted') return 'granted'
    if (receive === 'denied') return 'denied'
    return 'prompt'
  }

  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'default') return 'prompt'
  return Notification.permission
}

/** Pede a permissão (mostra o diálogo, se o estado permitir) e já registra pro
 * FCM em caso de sucesso no nativo — dispara o listener global 'registration'
 * de FcmPushRegister.tsx, que salva o token, sem duplicar essa lógica aqui. */
export async function requestPushPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const { receive } = await PushNotifications.requestPermissions()
    if (receive !== 'granted') return false
    await PushNotifications.register()
    return true
  }

  return subscribeToPush()
}
