'use client'

import Image from 'next/image'
import { X } from 'lucide-react'
import { useInstallPrompt } from '@/components/pwa/useInstallPrompt'

const DISMISS_KEY = 'bb_install_prompt_painel_dismissed_until'
const DISMISS_DAYS = 7

export function InstallPromptBanner() {
  const { visible, showIosHint, install, dismiss } = useInstallPrompt(DISMISS_KEY, DISMISS_DAYS)

  if (!visible) return null

  return (
    <div className="px-4 lg:px-8 py-3 flex items-center justify-between gap-4 bg-rose-50 border-b border-rose-100">
      <div className="flex items-center gap-2.5 min-w-0">
        <Image src="/icon-192.png" alt="BelleBook" width={28} height={28} className="w-7 h-7 rounded-lg shrink-0" />
        <p className="text-sm text-rose-700 truncate">
          Instale o BelleBook para receber notificações mesmo com o app fechado!
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {showIosHint ? (
          <span className="text-xs text-rose-600 hidden sm:inline">
            Toque em compartilhar → Adicionar à tela inicial
          </span>
        ) : (
          <button
            onClick={install}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-400 hover:bg-rose-500 text-white transition-colors"
          >
            Instalar app
          </button>
        )}
        <button onClick={dismiss} aria-label="Fechar" className="text-rose-300 hover:text-rose-500 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
