'use client'

import { useEffect } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/**
 * Sem isso, o botão/gesto de voltar do Android fecha o app inteiro em
 * qualquer tela. O plugin nativo do @capacitor/app só intercepta o back
 * press e navega a WebView sozinho quando NÃO há listener JS registrado —
 * assim que registramos um, ele delega 100% pra cá (nos manda `canGoBack`
 * e espera que a gente decida). `history.back()` cobre tanto navegação
 * client-side do Next quanto full reload, porque os dois entram no
 * histórico da própria WebView.
 */
export function AndroidBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const listenerPromise = App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back()
      else App.exitApp()
    })

    return () => {
      listenerPromise.then((handle) => handle.remove())
    }
  }, [])

  return null
}
