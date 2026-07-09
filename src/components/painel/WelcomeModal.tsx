'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, Sparkles, X } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { buildWhatsappUrl } from '@/lib/utils'

const SUPORTE_WHATSAPP = '5531971192930'

function welcomeKey(prestadoraId: string) {
  return `bb_welcome_modal_seen_${prestadoraId}`
}

export function WelcomeModal({ prestadoraId }: { prestadoraId: string }) {
  const [open, setOpen] = useState(false)

  // Primeiro passo do onboarding: aparece imediatamente no primeiro acesso.
  // O tour (OnboardingTour) espera o evento disparado em handleClose antes
  // de começar, garantindo que só um overlay apareça por vez.
  useEffect(() => {
    if (localStorage.getItem(welcomeKey(prestadoraId))) return
    setOpen(true)
  }, [prestadoraId])

  function handleClose() {
    setOpen(false)
    localStorage.setItem(welcomeKey(prestadoraId), '1')
    window.dispatchEvent(new Event('bb-welcome-done'))
  }

  const whatsappUrl = buildWhatsappUrl(
    SUPORTE_WHATSAPP,
    'Olá! Sou nova no BelleBook e tenho uma dúvida.'
  )

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
          <Sparkles className="w-8 h-8 text-rose-400" />
        </div>

        <h2 className="font-serif text-2xl font-bold text-gray-900">
          Bem-vinda ao BelleBook! 🌸
        </h2>
        <p className="text-sm text-gray-500 mt-3 leading-relaxed">
          Obrigado por fazer parte do nosso Beta! Estamos construindo o BelleBook
          juntos. Qualquer dúvida, erro ou sugestão, nosso suporte está sempre
          disponível pelo WhatsApp ou email. Seu feedback é muito valioso para nós!
        </p>

        <div className="space-y-2.5 mt-7">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="block">
            <Button className="w-full gap-2 bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-300">
              <MessageCircle className="w-4 h-4" />
              Falar com o suporte
            </Button>
          </a>
          <Button variant="outline" className="w-full" onClick={handleClose}>
            Começar a usar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
