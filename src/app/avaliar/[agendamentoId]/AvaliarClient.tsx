'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Star, CheckCircle2 } from 'lucide-react'
import { getTema } from '@/lib/theme'
import toast from 'react-hot-toast'

interface Props {
  agendamentoId: string
  prestadoraNome: string
  corTema: string | null
  servicoNome: string
  profissionalNome: string | null
  jaAvaliado: boolean
}

export default function AvaliarClient({
  agendamentoId, prestadoraNome, corTema, servicoNome, profissionalNome, jaAvaliado,
}: Props) {
  const tema = getTema(corTema)
  const [nota, setNota] = useState(0)
  const [hoverNota, setHoverNota] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(jaAvaliado)

  async function enviarAvaliacao() {
    if (nota === 0) {
      toast.error('Escolha uma nota de 1 a 5 estrelas')
      return
    }
    setEnviando(true)
    const res = await fetch('/api/avaliacoes/criar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agendamentoId, nota, comentario: comentario.trim() || null }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Erro ao enviar avaliação')
      setEnviando(false)
      return
    }
    setEnviado(true)
    setEnviando(false)
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-3 max-w-sm">
          <CheckCircle2 className="w-14 h-14 mx-auto" style={{ color: tema.hex }} />
          <h1 className="font-serif text-xl font-bold text-gray-900">Obrigada pela avaliação!</h1>
          <p className="text-sm text-gray-500">Seu feedback ajuda {prestadoraNome} a melhorar cada vez mais.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-sm w-full space-y-5">
        <div className="text-center space-y-1">
          <h1 className="font-serif text-xl font-bold text-gray-900">Como foi sua experiência?</h1>
          <p className="text-sm text-gray-500">
            {servicoNome}{profissionalNome ? ` com ${profissionalNome}` : ''} — {prestadoraNome}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNota(n)}
              onMouseEnter={() => setHoverNota(n)}
              onMouseLeave={() => setHoverNota(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`w-8 h-8 ${(hoverNota || nota) >= n ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
              />
            </button>
          ))}
        </div>

        <Textarea
          label="Comentário (opcional)"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Conte como foi seu atendimento..."
          rows={3}
        />

        <Button
          onClick={enviarAvaliacao}
          loading={enviando}
          className="w-full"
          style={{ backgroundColor: tema.hex }}
        >
          Enviar avaliação
        </Button>
      </div>
    </div>
  )
}
