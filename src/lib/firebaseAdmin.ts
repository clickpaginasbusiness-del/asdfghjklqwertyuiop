import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging, type Messaging } from 'firebase-admin/messaging'

/**
 * google-services.json (capacitor-test/android/app/) só tem chaves públicas,
 * usadas pelo app cliente pra falar com o Firebase — enviar via FCM a partir
 * do servidor exige uma Service Account separada (Firebase Console > Config.
 * do projeto > Contas de serviço > Gerar nova chave privada), configurada
 * aqui via env vars.
 */
export function getFcmMessaging(): Messaging | null {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) return null

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    })
  }

  return getMessaging()
}
