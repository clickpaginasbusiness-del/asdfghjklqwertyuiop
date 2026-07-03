'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { X, Share } from 'lucide-react'
import { useInstallPrompt } from './useInstallPrompt'

const DISMISS_KEY = 'bb_install_prompt_dismissed_until'
const DISMISS_DAYS = 7

export function InstallPrompt() {
  const pathname = usePathname()
  const { visible, showIosHint, install, dismiss } = useInstallPrompt(DISMISS_KEY, DISMISS_DAYS)

  // Dentro do painel, o InstallPwaModal (modal, mobile-only) assume esse papel.
  if (pathname?.startsWith('/painel')) return null
  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-[200] bg-white border-t border-rose-100 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-start gap-3">
      <div className="w-12 h-12 shrink-0 rounded-2xl overflow-hidden">
        <Image src="/icon-192.png" alt="BelleBook" width={48} height={48} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm leading-snug">
          Instale o BelleBook no seu celular para acesso rápido!
        </p>
        {showIosHint ? (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Toque em <Share className="w-3 h-3 inline -mt-0.5" /> compartilhar → Adicionar à tela inicial
          </p>
        ) : (
          <button
            onClick={install}
            className="mt-2.5 text-xs font-semibold text-white bg-rose-400 hover:bg-rose-500 rounded-lg px-4 py-2 min-h-9 transition-colors"
          >
            Instalar app
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
