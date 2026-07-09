'use client'

import { useEffect, useState } from 'react'
import { Star, X } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import toast from 'react-hot-toast'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function neverKey(prestadoraId: string) {
  return `bb_feedback_never_${prestadoraId}`
}

function lastShownKey(prestadoraId: string) {
  return `bb_feedback_last_shown_${prestadoraId}`
}

export function FeedbackModal({ prestadoraId }: { prestadoraId: string }) {
  const [open, setOpen] = useState(false)
  const [nota, setNota] = useState(0)
  const [hoverNota, setHoverNota] = useState(0)
  const [comentario, setComentario] = useState('')
  const [naoMostrarMais, setNaoMostrarMais] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(neverKey(prestadoraId))) return
    const ultimaVez = Number(localStorage.getItem(lastShownKey(prestadoraId)) ?? 0)
    if (Date.now() - ultimaVez >= SEVEN_DAYS_MS) {
      setOpen(true)
    }
  }, [prestadoraId])

  function adiarPorSeteDias() {
    if (naoMostrarMais) {
      localStorage.setItem(neverKey(prestadoraId), '1')
    } else {
      localStorage.setItem(lastShownKey(prestadoraId), String(Date.now()))
    }
  }

  function fechar() {
    setOpen(false)
    adiarPorSeteDias()
  }

  async function enviar() {
    if (nota === 0) {
      toast.error('Escolha uma nota de 1 a 5 estrelas')
      return
    }
    setEnviando(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota, comentario: comentario.trim() || null }),
      })
      if (!res.ok) {
        toast.error('Erro ao enviar feedback. Tente novamente.')
        return
      }
      toast.success('Obrigado pelo seu feedback! 💜')
      setOpen(false)
      adiarPorSeteDias()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal open={open} onClose={fechar} className="max-w-sm">
      <div className="relative p-8">
        <button
          onClick={fechar}
          aria-label="Fechar"
          className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h2 className="font-serif text-2xl font-bold text-gray-900">
            Está gostando do BelleBook? 💜
          </h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Nos ajude a melhorar! Conte sua experiência e se mudaria algo.
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNota(n)}
              onMouseEnter={() => setHoverNota(n)}
              onMouseLeave={() => setHoverNota(0)}
              aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
              className="p-1"
            >
              <Star
                className={`w-8 h-8 transition-colors ${
                  n <= (hoverNota || nota) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
                }`}
              />
            </button>
          ))}
        </div>

        <Textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="O que você mudaria? (opcional)"
          className="mt-5"
          rows={3}
        />

        <Button onClick={enviar} loading={enviando} className="w-full mt-4" size="lg">
          Enviar feedback
        </Button>

        <label className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={naoMostrarMais}
            onChange={(e) => setNaoMostrarMais(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300 text-rose-400 focus:ring-rose-300"
          />
          Não mostrar novamente
        </label>
      </div>
    </Modal>
  )
}
