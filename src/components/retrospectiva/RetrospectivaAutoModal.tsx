'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mesAnoAtualSP, mesAnteriorSP } from '@/lib/utils'
import { CartaoRetrospectiva } from './CartaoRetrospectiva'
import { RetrospectivaAcoes } from './RetrospectivaAcoes'
import type { DadosRetrospectiva } from '@/lib/retrospectiva'

function vistaKey(mes: number, ano: number) {
  return `bb_retrospectiva_vista_${mes}_${ano}`
}

type Retro = { mes: number; ano: number; dados: DadosRetrospectiva }

/**
 * Mostra o modal sozinho na primeira vez que a prestadora abre o painel
 * depois que a retrospectiva do mês anterior fica pronta — checa só o mês
 * mais recente (não um histórico de retrospectivas antigas não vistas) e
 * lembra que já viu via localStorage, sem precisar de coluna nova no banco
 * (mesmo padrão do WelcomeModal/checklist).
 */
export function RetrospectivaAutoModal({
  prestadoraId, mostrarProfissionalDestaque,
}: {
  prestadoraId: string
  mostrarProfissionalDestaque: boolean
}) {
  const [retro, setRetro] = useState<Retro | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const atual = mesAnoAtualSP()
    const { mes, ano } = mesAnteriorSP(atual.mes, atual.ano)
    if (localStorage.getItem(vistaKey(mes, ano))) return

    const supabase = createClient()
    supabase
      .from('retrospectivas')
      .select('mes, ano, dados')
      .eq('prestadora_id', prestadoraId)
      .eq('mes', mes)
      .eq('ano', ano)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setRetro(data as Retro)
      })
  }, [prestadoraId])

  function fechar() {
    if (retro) localStorage.setItem(vistaKey(retro.mes, retro.ano), '1')
    setRetro(null)
  }

  if (!retro) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-5 my-8 relative">
        <button
          onClick={fechar}
          aria-label="Fechar"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex justify-center overflow-hidden rounded-2xl">
          <CartaoRetrospectiva
            ref={cardRef}
            mes={retro.mes}
            ano={retro.ano}
            dados={retro.dados}
            mostrarProfissionalDestaque={mostrarProfissionalDestaque}
          />
        </div>

        <div className="mt-4 space-y-2.5">
          <RetrospectivaAcoes cardRef={cardRef} mes={retro.mes} ano={retro.ano} />
          <button
            onClick={fechar}
            className="w-full text-center text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors py-2"
          >
            Ver mais tarde
          </button>
        </div>
      </div>
    </div>
  )
}
