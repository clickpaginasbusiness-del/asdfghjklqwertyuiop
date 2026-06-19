'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Star, Lock, MessageSquareQuote } from 'lucide-react'
import { cn, formatDateShort } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import type { AvaliacaoComCliente } from './PerfilPainelClient'

const MAX_DESTAQUES = 3

export function AvaliacoesDestaqueSection({
  ehPro,
  avaliacoesIniciais,
}: {
  ehPro: boolean
  avaliacoesIniciais: AvaliacaoComCliente[]
}) {
  const [avaliacoes, setAvaliacoes] = useState(avaliacoesIniciais)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const destaquesCount = avaliacoes.filter((a) => a.destaque).length

  async function toggleDestaque(av: AvaliacaoComCliente) {
    if (!av.destaque && destaquesCount >= MAX_DESTAQUES) {
      toast.error(`Você já tem ${MAX_DESTAQUES} avaliações em destaque. Remova uma para adicionar outra.`)
      return
    }

    setTogglingId(av.id)
    const supabase = createClient()
    const novoValor = !av.destaque
    const { error } = await supabase.from('avaliacoes').update({ destaque: novoValor }).eq('id', av.id)

    if (error) {
      toast.error('Erro ao atualizar destaque')
    } else {
      setAvaliacoes((prev) => prev.map((a) => a.id === av.id ? { ...a, destaque: novoValor } : a))
      toast.success(novoValor ? 'Avaliação destacada!' : 'Destaque removido')
    }
    setTogglingId(null)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-rose-400" />
          <CardTitle>Avaliações em destaque</CardTitle>
        </div>
        <p className="text-sm text-gray-400">
          Escolha até {MAX_DESTAQUES} avaliações para exibir na seção &quot;O que dizem sobre mim&quot; da sua página pública.
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {avaliacoes.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <MessageSquareQuote className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Você ainda não recebeu avaliações</p>
            </div>
          ) : (
            <div className={cn('space-y-3', !ehPro && 'pointer-events-none')}>
              {avaliacoes.map((av) => (
                <div
                  key={av.id}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border transition-colors',
                    av.destaque ? 'border-rose-200 bg-rose-50/50' : 'border-gray-100'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleDestaque(av)}
                    disabled={togglingId === av.id}
                    title={av.destaque ? 'Remover destaque' : 'Marcar como destaque'}
                    className="shrink-0 mt-0.5 min-w-11 min-h-11 flex items-center justify-center rounded-xl hover:bg-white transition-colors disabled:opacity-50"
                  >
                    <Star className={cn('w-5 h-5', av.destaque ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                      <p className="font-medium text-gray-900 text-sm">
                        {av.agendamentos?.clientes?.nome ?? 'Cliente'}
                      </p>
                      <span className="text-xs text-gray-400">{formatDateShort(av.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-0.5 mb-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className={cn('w-3.5 h-3.5', i < av.nota ? 'fill-amber-400 text-amber-400' : 'text-gray-200')} />
                      ))}
                    </div>
                    {av.comentario && (
                      <p className="text-sm text-gray-600 leading-relaxed">{av.comentario}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!ehPro && avaliacoes.length > 0 && (
            <div className="absolute inset-0 -m-2 rounded-xl bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-center p-4">
              <Lock className="w-6 h-6 text-gray-400" />
              <p className="text-sm font-semibold text-gray-700">Exclusivo do Plano Pro</p>
              <Link href="/painel/assinatura" className="text-xs font-semibold text-rose-500 hover:text-rose-600 underline underline-offset-2">
                Fazer upgrade
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
