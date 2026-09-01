'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Copy, MessageCircle, CheckCircle2, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ChecklistStatus } from '@/lib/checklist'

function celebradoKey(prestadoraId: string) {
  return `bb_checklist_celebrado_${prestadoraId}`
}

export default function ChecklistClient({
  prestadoraId,
  slug,
  status: statusInicial,
}: {
  prestadoraId: string
  slug: string
  status: ChecklistStatus
}) {
  const [status, setStatus] = useState(statusInicial)
  const [celebrar, setCelebrar] = useState(false)

  const linkPublico = `${process.env.NEXT_PUBLIC_APP_URL}/n/${slug}`
  const mensagemWhatsapp = `Oi! Agora você pode marcar horário comigo direto por aqui: ${linkPublico} 💅`
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagemWhatsapp)}`

  // Só celebra quando o perfil vira 100% e ainda não celebrou antes nesse
  // aparelho — sem coluna nova no banco pra isso (mesmo padrão de
  // "visto uma vez" já usado pelo WelcomeModal via localStorage).
  useEffect(() => {
    if (status.completo && !localStorage.getItem(celebradoKey(prestadoraId))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage só existe no cliente; celebração só pode ser decidida depois do mount
      setCelebrar(true)
    }
  }, [status.completo, prestadoraId])

  // Otimista: marca concluído na hora (igual ao DowngradeBanner) — a escrita
  // no banco roda em segundo plano, sem travar o clique no link do WhatsApp.
  function marcarLinkCompartilhado() {
    setStatus((atual) => {
      if (atual.itens.find((i) => i.id === 'compartilhar_link')?.completo) return atual
      const itens = atual.itens.map((i) => (i.id === 'compartilhar_link' ? { ...i, completo: true } : i))
      const completos = itens.filter((i) => i.completo).length
      return {
        ...atual,
        itens,
        completos,
        percentual: Math.round((completos / atual.total) * 100),
        completo: completos === atual.total,
      }
    })

    const supabase = createClient()
    supabase
      .from('prestadoras')
      .update({ link_compartilhado_em: new Date().toISOString() })
      .eq('id', prestadoraId)
      .then(({ error }) => {
        if (error) console.error('[checklist] erro ao salvar link_compartilhado_em', error)
      })
  }

  function handleCopiarLink() {
    navigator.clipboard.writeText(linkPublico)
    toast.success('Link copiado!')
    marcarLinkCompartilhado()
  }

  function fecharCelebracao() {
    localStorage.setItem(celebradoKey(prestadoraId), '1')
    setCelebrar(false)
  }

  const compartilharCompleto = status.itens.find((i) => i.id === 'compartilhar_link')?.completo ?? false

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Complete seu perfil</CardTitle>
            <span className={cn('text-2xl font-bold shrink-0', status.percentual === 100 ? 'text-green-600' : 'text-rose-500')}>
              {status.percentual}%
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', status.percentual === 100 ? 'bg-green-500' : 'bg-rose-400')}
                style={{ width: `${status.percentual}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">{status.completos} de {status.total} concluídos</p>
          </div>

          <ul className="flex flex-col divide-y divide-gray-50">
            {status.itens.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 py-3">
                <div className="flex items-center gap-3">
                  {item.completo ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 shrink-0" />
                  )}
                  <span className={cn('text-sm', item.completo ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-900 font-medium')}>
                    {item.titulo}
                  </span>
                </div>

                {item.id === 'compartilhar_link' && !compartilharCompleto && (
                  <div className="flex flex-col sm:flex-row gap-2 pl-8">
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={marcarLinkCompartilhado}>
                      <Button size="sm" className="w-full sm:w-auto gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5" />
                        Compartilhar agora
                      </Button>
                    </a>
                    <Button size="sm" variant="outline" onClick={handleCopiarLink} className="gap-1.5">
                      <Copy className="w-3.5 h-3.5" />
                      Copiar link
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {celebrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-rose-100/90 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
            <span className="font-serif text-3xl font-bold text-rose-400 block mb-4">BelleBook</span>
            <p className="text-lg font-semibold text-gray-900 leading-relaxed">
              Perfil completo! Agora é só esperar a agenda lotar 💅
            </p>
            <Link href="/painel" className="block mt-7" onClick={fecharCelebracao}>
              <Button className="w-full">Ir para o painel</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
