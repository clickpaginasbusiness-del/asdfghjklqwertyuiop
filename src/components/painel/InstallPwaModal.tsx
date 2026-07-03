'use client'

import { useEffect, useState } from 'react'
import { Download, MoreVertical, Share, Smartphone, X } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const NEVER_KEY = 'bb_install_modal_never_show'
const SESSION_DISMISS_KEY = 'bb_install_modal_dismissed_session'

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isMobileDevice() {
  const uaMobile = /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent)
  return window.innerWidth < 768 || uaMobile
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function InstallPwaModal() {
  const [open, setOpen] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(NEVER_KEY)) return
    if (sessionStorage.getItem(SESSION_DISMISS_KEY)) return
    if (isStandalone()) return
    if (!isMobileDevice()) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- detecção de mobile/PWA só é possível após montar (window/navigator)
    setOpen(true)

    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    function handleInstalled() {
      setOpen(false)
    }
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) {
      setShowHint(true)
      return
    }
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setOpen(false)
  }

  function handleNever() {
    localStorage.setItem(NEVER_KEY, '1')
    setOpen(false)
  }

  function handleClose() {
    sessionStorage.setItem(SESSION_DISMISS_KEY, '1')
    setOpen(false)
  }

  return (
    <Modal open={open} onClose={handleClose} className="max-w-sm">
      <div className="relative p-8 text-center">
        <button
          onClick={handleClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 flex items-center justify-center mb-5">
          <Smartphone className="w-8 h-8 text-rose-400" />
        </div>

        <h2 className="font-serif text-2xl font-bold text-gray-900">
          Instale o BelleBook no seu celular! 📱
        </h2>
        <p className="text-sm text-gray-500 mt-3 leading-relaxed">
          Tenha acesso mais rápido ao painel e receba notificações de novos agendamentos mesmo com o app fechado!
        </p>

        {showHint && (
          <p className="text-xs text-gray-500 mt-4 leading-relaxed bg-gray-50 rounded-xl px-3 py-2.5">
            {isIos() ? (
              <>Toque em <Share className="w-3.5 h-3.5 inline -mt-0.5" /> compartilhar → <strong>Adicionar à tela inicial</strong></>
            ) : (
              <>Abra no Chrome e toque em <MoreVertical className="w-3.5 h-3.5 inline -mt-0.5" /> → <strong>Adicionar à tela inicial</strong></>
            )}
          </p>
        )}

        <div className="space-y-2.5 mt-7">
          <Button onClick={handleInstall} className="w-full gap-2">
            <Download className="w-4 h-4" />
            Instalar agora
          </Button>
          <button
            onClick={handleNever}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            Nunca mostrar isso
          </button>
        </div>
      </div>
    </Modal>
  )
}
