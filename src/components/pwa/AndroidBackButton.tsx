'use client'

import { useEffect, useRef } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import toast from 'react-hot-toast'

const EXIT_CONFIRM_MS = 2000

/**
 * Sem isso, o botão/gesto de voltar do Android fecha o app inteiro em
 * qualquer tela. O plugin nativo do @capacitor/app só intercepta o back
 * press e navega a WebView sozinho quando NÃO há listener JS registrado —
 * assim que registramos um, ele delega 100% pra cá (nos manda `canGoBack`
 * e espera que a gente decida). `history.back()` cobre tanto navegação
 * client-side do Next quanto full reload, porque os dois entram no
 * histórico da própria WebView.
 *
 * Na raiz (canGoBack false), exige toque duplo antes de fechar — padrão
 * "double back to exit" — pra não fechar o app sem querer com um toque só.
 */
export function AndroidBackButton() {
  const aguardandoConfirmacaoRef = useRef(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const listenerPromise = App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back()
        return
      }

      if (aguardandoConfirmacaoRef.current) {
        App.exitApp()
        return
      }

      aguardandoConfirmacaoRef.current = true
      toast('Toque voltar de novo para sair', { icon: '👋', duration: EXIT_CONFIRM_MS })
      timeoutId = setTimeout(() => {
        aguardandoConfirmacaoRef.current = false
      }, EXIT_CONFIRM_MS)
    })

    return () => {
      listenerPromise.then((handle) => handle.remove())
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  return null
}
