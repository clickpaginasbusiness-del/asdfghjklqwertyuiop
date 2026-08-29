'use client'

import { useEffect, useState } from 'react'
import { Bell, Settings, X } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { getPushPermissionState, requestPushPermission, subscribeToPush } from '@/lib/push'

const DISMISS_FOREVER_KEY = 'bb_push_prompt_never'

function tourKey(prestadoraId: string) {
  return `bb_onboarding_done_${prestadoraId}`
}

function isDismissedForever() {
  return localStorage.getItem(DISMISS_FOREVER_KEY) === '1'
}

/** Banner só faz sentido em celular/PWA/app nativo — no desktop o fluxo de permissão é outro contexto. */
function isMobileOuPwa(): boolean {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  const mobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  return Capacitor.isNativePlatform() || standalone || mobileUA
}

export function PushNotificationPrompt({ prestadoraId }: { prestadoraId: string }) {
  const [visible, setVisible] = useState(false)
  const [denied, setDenied] = useState(false)
  const [ativando, setAtivando] = useState(false)

  useEffect(() => {
    if (!isMobileOuPwa()) return

    let cancelado = false
    let mostrarHandler: (() => void) | null = null

    getPushPermissionState().then((status) => {
      if (cancelado || status === 'unsupported') return

      if (status === 'granted') {
        // Re-inscreve silenciosamente (só no fluxo web): cobre tanto
        // subscription expirada (FCM rotaciona o token) quanto o caso de a
        // prestadora ter ativado a permissão direto nas configurações do
        // celular — sem passar pelo botão "Ativar" daqui, a permissão fica
        // concedida mas nenhuma subscription é salva no banco. No nativo o
        // FcmPushRegister.tsx já cuida disso sozinho no mount.
        if (!Capacitor.isNativePlatform()) subscribeToPush().catch(() => {})
        return
      }

      if (isDismissedForever()) return

      function mostrar() {
        setDenied(status === 'denied')
        setVisible(true)
      }

      // Mostra assim que o tour de boas-vindas já foi concluído; se ainda não foi,
      // espera o evento de conclusão em vez de competir com o tour na tela.
      if (localStorage.getItem(tourKey(prestadoraId))) {
        mostrar()
        return
      }

      mostrarHandler = mostrar
      window.addEventListener('bb-onboarding-done', mostrar)
    })

    return () => {
      cancelado = true
      if (mostrarHandler) window.removeEventListener('bb-onboarding-done', mostrarHandler)
    }
  }, [prestadoraId])

  async function ativar() {
    setAtivando(true)
    const ok = await requestPushPermission()
    setAtivando(false)
    if (ok) {
      setVisible(false)
      return
    }
    const status = await getPushPermissionState()
    if (status === 'denied') setDenied(true)
  }

  // Fecha só desta vez — sem persistir nada, o banner volta a aparecer na
  // próxima vez que o app for aberto (enquanto a permissão continuar desativada).
  function fechar() {
    setVisible(false)
  }

  function naoMostrarMais() {
    localStorage.setItem(DISMISS_FOREVER_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  if (denied) {
    return (
      <div className="px-4 lg:px-8 py-2 flex items-center justify-between gap-3 bg-gray-50 border-b border-gray-100 text-xs text-gray-400">
        <span className="flex items-center gap-2 min-w-0">
          <Settings className="w-3.5 h-3.5 shrink-0" />
          Notificações bloqueadas. Para ativar, permita notificações para o BelleBook nas configurações do seu celular.
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={naoMostrarMais} className="font-semibold text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">
            Não mostrar mais
          </button>
          <button onClick={fechar} aria-label="Fechar" className="text-gray-300 hover:text-gray-500 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-8 py-3 flex items-center justify-between gap-4 bg-rose-50 border-b border-rose-100">
      <div className="flex items-center gap-2 min-w-0">
        <Bell className="w-4 h-4 text-rose-400 shrink-0" />
        <p className="text-sm text-rose-700 truncate">
          Ative as notificações para saber na hora quando alguém agendar!
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={ativar}
          disabled={ativando}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-400 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
        >
          {ativando ? 'Ativando...' : 'Ativar notificações'}
        </button>
        <button onClick={naoMostrarMais} className="text-xs font-medium text-rose-400 hover:text-rose-600 transition-colors whitespace-nowrap hidden sm:block">
          Não mostrar mais
        </button>
        <button onClick={fechar} aria-label="Fechar" className="text-rose-300 hover:text-rose-500 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
