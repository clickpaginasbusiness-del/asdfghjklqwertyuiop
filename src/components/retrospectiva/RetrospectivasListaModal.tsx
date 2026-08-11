'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { CartaoRetrospectiva } from './CartaoRetrospectiva'
import { RetrospectivaAcoes } from './RetrospectivaAcoes'
import { NOMES_MESES, type DadosRetrospectiva } from '@/lib/retrospectiva'

type Item = { id: string; mes: number; ano: number; dados: DadosRetrospectiva }

/** Lista de retrospectivas passadas, aberta a partir de /painel/perfil —
 * mesmo modal alterna entre a lista e o card selecionado, em vez de empilhar
 * um segundo modal por cima. */
export function RetrospectivasListaModal({
  open, onClose, prestadoraId, mostrarProfissionalDestaque,
}: {
  open: boolean
  onClose: () => void
  prestadoraId: string
  mostrarProfissionalDestaque: boolean
}) {
  const [carregando, setCarregando] = useState(true)
  const [lista, setLista] = useState<Item[]>([])
  const [selecionada, setSelecionada] = useState<Item | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setCarregando(true)
    setSelecionada(null)
    const supabase = createClient()
    supabase
      .from('retrospectivas')
      .select('id, mes, ano, dados')
      .eq('prestadora_id', prestadoraId)
      .order('ano', { ascending: false })
      .order('mes', { ascending: false })
      .then(({ data }) => {
        setLista((data ?? []) as Item[])
        setCarregando(false)
      })
  }, [open, prestadoraId])

  function fechar() {
    setSelecionada(null)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={fechar}
      title={selecionada ? `${NOMES_MESES[selecionada.mes - 1]} ${selecionada.ano}` : 'Minhas Retrospectivas'}
    >
      {selecionada ? (
        <div className="p-6 pt-4 flex flex-col items-center gap-4">
          <button
            onClick={() => setSelecionada(null)}
            className="self-start flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors -mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <div className="overflow-hidden rounded-2xl">
            <CartaoRetrospectiva
              ref={cardRef}
              mes={selecionada.mes}
              ano={selecionada.ano}
              dados={selecionada.dados}
              mostrarProfissionalDestaque={mostrarProfissionalDestaque}
            />
          </div>
          <RetrospectivaAcoes cardRef={cardRef} mes={selecionada.mes} ano={selecionada.ano} />
        </div>
      ) : (
        <div className="p-6 pt-2">
          {carregando ? (
            <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>
          ) : lista.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="w-8 h-8 text-rose-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Sua primeira retrospectiva aparece no início do próximo mês</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lista.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3"
                >
                  <p className="text-sm font-medium text-gray-800 min-w-0 truncate">
                    {NOMES_MESES[item.mes - 1]} {item.ano}
                    {item.dados.tem_dados && (
                      <span className="text-gray-400 font-normal"> — {item.dados.total_agendamentos} atendimento{item.dados.total_agendamentos === 1 ? '' : 's'}</span>
                    )}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setSelecionada(item)} className="shrink-0">
                    Ver card
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
