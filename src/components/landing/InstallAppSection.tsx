'use client'

import { useEffect, useState } from 'react'
import { Download, MoreVertical, Share, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function InstallAppSection() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(false)
  const [showAndroidHint, setShowAndroidHint] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detecção do modo de exibição só é possível após montar (matchMedia/navigator)
    setStandalone(isStandalone())

    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    function handleInstalled() {
      setStandalone(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function handleAndroidInstall() {
    if (!deferredPrompt) {
      setShowAndroidHint(true)
      return
    }
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  if (standalone) return null

  return (
    <section
      id="instalar-app"
      className="relative z-[2] bg-white px-6 py-24 rounded-t-[40px] shadow-[0_-4px_60px_rgba(0,0,0,0.04)]"
    >
      <div className="max-w-4xl mx-auto w-full">
        <div className="text-center mb-14">
          <p data-animate className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-4">
            Leve com você
          </p>
          <h2 data-animate data-delay="100" className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-bold text-gray-900 leading-tight">
            Instale o app
            <br />
            <span className="text-rose-400">gratuito no celular</span>
          </h2>
          <p data-animate data-delay="200" className="text-gray-500 mt-4 max-w-xl mx-auto">
            Acesse sua agenda de qualquer lugar, direto da tela inicial do seu celular. Sem loja de aplicativos, sem complicação.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Android */}
          <div data-animate className="bg-[#fdf5f8] rounded-3xl p-8 border border-rose-100/60 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">Android</h3>
            <button
              onClick={handleAndroidInstall}
              className="inline-flex items-center gap-2 bg-rose-400 hover:bg-rose-500 text-white px-6 py-3 rounded-2xl text-sm font-semibold transition-colors shadow-[0_4px_20px_rgba(251,113,133,0.3)]"
            >
              <Download className="w-4 h-4" />
              Instalar app
            </button>
            {showAndroidHint && (
              <p className="text-sm text-gray-500 leading-relaxed">
                Abra no Chrome e toque em <MoreVertical className="w-3.5 h-3.5 inline -mt-0.5" /> → <strong>Adicionar à tela inicial</strong>
              </p>
            )}
          </div>

          {/* iOS */}
          <div data-animate data-delay="100" className="bg-[#fdf5f8] rounded-3xl p-8 border border-rose-100/60 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">iPhone / iPad</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Abra no Safari e toque em <Share className="w-3.5 h-3.5 inline -mt-0.5" /> compartilhar → <strong>Adicionar à tela inicial</strong>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
