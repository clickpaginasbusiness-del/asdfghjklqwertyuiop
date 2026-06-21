'use client'

import { useEffect, useState } from 'react'
import { Bell, Settings, X } from 'lucide-react'
import { isPushSupported, subscribeToPush } from '@/lib/push'

const DISMISS_KEY = 'bb_push_prompt_dismissed_until'
const DISMISS_DAYS = 30

function tourKey(prestadoraId: string) {
  return `bb_onboarding_done_${prestadoraId}`
}

function isDismissed() {
  const until = localStorage.getItem(DISMISS_KEY)
  return !!until && Date.now() < Number(until)
}

function dismissForDays(days: number) {
  localStorage.setItem(DISMISS_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000))
}

export function PushNotificationPrompt({ prestadoraId }: { prestadoraId: string }) {
  const [visible, setVisible] = useState(false)
  const [denied, setDenied] = useState(false)
  const [ativando, setAtivando] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return

    if (Notification.permission === 'denied') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- estado da permissão só é conhecido após montar (Notification API)
      setDenied(true)
      return
    }
    if (Notification.permission !== 'default') return
    if (isDismissed()) return

    function mostrar() {
      setVisible(true)
    }

    if (localStorage.getItem(tourKey(prestadoraId))) {
      mostrar()
      return
    }

    window.addEventListener('bb-onboarding-done', mostrar)
    return () => window.removeEventListener('bb-onboarding-done', mostrar)
  }, [prestadoraId])

  async function ativar() {
    setAtivando(true)
    const ok = await subscribeToPush()
    setAtivando(false)
    if (ok) {
      setVisible(false)
    } else if (Notification.permission === 'denied') {
      setVisible(false)
      setDenied(true)
    }
  }

  function dismiss() {
    setVisible(false)
    dismissForDays(DISMISS_DAYS)
  }

  if (denied) {
    return (
      <div className="px-4 lg:px-8 py-2 flex items-center gap-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-400">
        <Settings className="w-3.5 h-3.5 shrink-0" />
        Notificações bloqueadas. Para ativar, permita notificações para o BelleBook nas configurações do seu celular.
      </div>
    )
  }

  if (!visible) return null

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
        <button onClick={dismiss} aria-label="Fechar" className="text-rose-300 hover:text-rose-500 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
