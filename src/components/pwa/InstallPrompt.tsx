'use client'

import { useEffect, useState } from 'react'
import { X, Download, Share } from 'lucide-react'

const DISMISS_KEY = 'bb_install_prompt_dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return
    if (isStandalone()) return

    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    if (isIos()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- detecção de plataforma só é possível após montar (window/navigator)
      setShowIosHint(true)
      setVisible(true)
    }

    function handleInstalled() {
      setVisible(false)
      localStorage.setItem(DISMISS_KEY, '1')
    }
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  function dismiss() {
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-4 sm:right-auto sm:max-w-sm z-[200] bg-white rounded-2xl shadow-xl border border-rose-100 p-4 flex items-start gap-3">
      <div className="w-11 h-11 shrink-0 rounded-xl bg-rose-50 flex items-center justify-center">
        <Download className="w-5 h-5 text-rose-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">Instalar BelleBook</p>
        {showIosHint ? (
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Toque em <Share className="w-3 h-3 inline -mt-0.5" /> e depois em &quot;Adicionar à Tela de Início&quot;
          </p>
        ) : (
          <p className="text-xs text-gray-500 mt-0.5">Acesse mais rápido, direto da sua tela inicial</p>
        )}
        {!showIosHint && (
          <button
            onClick={handleInstall}
            className="mt-2.5 text-xs font-semibold text-white bg-rose-400 hover:bg-rose-500 rounded-lg px-3 py-2 min-h-9 transition-colors"
          >
            Instalar
          </button>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Fechar"
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
