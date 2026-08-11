'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, Clock, CalendarPlus, ListChecks } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

type Status = 'confirmado' | 'cancelado' | 'concluido' | 'aguardando_pagamento'

const MAX_TENTATIVAS_POLL = 15
const INTERVALO_POLL_MS = 2500

function googleCalendarUrl(opts: { titulo: string; detalhes: string; dataHoraISO: string; duracaoMinutos: number }) {
  const inicio = new Date(opts.dataHoraISO)
  const fim = new Date(inicio.getTime() + opts.duracaoMinutos * 60000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.titulo,
    dates: `${fmt(inicio)}/${fmt(fim)}`,
    details: opts.detalhes,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export default function SucessoClient({
  agendamentoId,
  status: statusInicial,
  dataHora,
  duracaoMinutos,
  servicoNome,
  profissionalNome,
  prestadoraNome,
  prestadoraSlug,
}: {
  agendamentoId: string
  status: Status
  dataHora: string
  duracaoMinutos: number
  servicoNome: string
  profissionalNome: string | null
  prestadoraNome: string
  prestadoraSlug: string
}) {
  const tentativasRef = useRef(0)
  const [status, setStatus] = useState(statusInicial)
  const [poolExpirado, setPoolExpirado] = useState(false)

  const confirmado = status === 'confirmado' || status === 'concluido'
  const aindaProcessando = status === 'aguardando_pagamento'

  // Chegou aqui pelo auto_return do MP (pagamento aprovado), mas a confirmação
  // do agendamento em si depende do webhook processar de forma assíncrona —
  // então espera (com teto de tentativas) até o status virar 'confirmado'.
  // Faz fetch direto em /api/agendamentos/status (em vez de router.refresh()
  // + re-render do Server Component) pra não depender de nenhuma camada de
  // cache/RSC do Next — o resultado fica visível até no Network do devtools,
  // o que facilita muito diagnosticar se o polling em si está rodando.
  useEffect(() => {
    if (!aindaProcessando) return
    let cancelado = false

    const id = setInterval(async () => {
      tentativasRef.current += 1
      if (tentativasRef.current > MAX_TENTATIVAS_POLL) {
        setPoolExpirado(true)
        clearInterval(id)
        return
      }
      try {
        const res = await fetch(`/api/agendamentos/status?agendamentoId=${agendamentoId}`, { cache: 'no-store' })
        if (!res.ok || cancelado) return
        const data = await res.json() as { status?: Status }
        if (data.status && data.status !== 'aguardando_pagamento') {
          setStatus(data.status)
          clearInterval(id)
        }
      } catch {
        // Falha de rede pontual — só tenta de novo no próximo tick, até o teto de tentativas.
      }
    }, INTERVALO_POLL_MS)

    return () => { cancelado = true; clearInterval(id) }
  }, [aindaProcessando, agendamentoId])

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-rose-50">
      <header className="py-6 px-4 max-w-5xl mx-auto">
        <Link href="/" className="font-serif text-2xl font-bold text-rose-400">BelleBook</Link>
      </header>

      <main className="max-w-md mx-auto px-4 pb-16">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8">
          {confirmado ? (
            <>
              <div className="text-center py-2">
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4 animate-check-pop" />
                <h1 className="font-serif text-2xl font-bold text-gray-900 mb-1.5">Agendamento confirmado!</h1>
                <p className="text-sm text-gray-500">Seu horário com {prestadoraNome} está reservado.</p>
              </div>

              <div className="space-y-2.5 my-6 py-5 border-y border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Serviço</span>
                  <span className="font-semibold text-gray-900">{servicoNome}</span>
                </div>
                {profissionalNome && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Profissional</span>
                    <span className="font-semibold text-gray-900">{profissionalNome}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Data e horário</span>
                  <span className="font-semibold text-gray-900">{formatDateTime(dataHora)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  href={`/n/${prestadoraSlug}#meus-agendamentos`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-400 hover:bg-rose-500 text-white font-semibold text-sm transition-colors"
                >
                  <ListChecks className="w-4 h-4" />
                  Ver meus agendamentos
                </Link>
                <a
                  href={googleCalendarUrl({
                    titulo: `${servicoNome} — ${prestadoraNome}`,
                    detalhes: `Agendamento com ${prestadoraNome}${profissionalNome ? ` (${profissionalNome})` : ''} via BelleBook.`,
                    dataHoraISO: dataHora,
                    duracaoMinutos,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-gray-200 hover:border-rose-300 hover:bg-rose-50/40 text-gray-700 font-semibold text-sm transition-all"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Adicionar ao Google Calendar
                </a>
              </div>
            </>
          ) : aindaProcessando && !poolExpirado ? (
            <div className="text-center py-6">
              <Loader2 className="w-10 h-10 text-rose-400 mx-auto mb-3 animate-spin" />
              <h1 className="font-serif text-xl font-bold text-gray-900 mb-1.5">Confirmando pagamento...</h1>
              <p className="text-sm text-gray-500">Só um instante enquanto confirmamos com o Mercado Pago.</p>
            </div>
          ) : aindaProcessando && poolExpirado ? (
            <div className="text-center py-6">
              <Clock className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h1 className="font-serif text-xl font-bold text-gray-900 mb-1.5">Ainda processando</h1>
              <p className="text-sm text-gray-500">
                Seu pagamento está sendo confirmado — pode levar alguns minutos. Você receberá a confirmação assim que estiver pronta.
              </p>
              <Link href={`/n/${prestadoraSlug}`} className="inline-block mt-4 text-sm font-semibold text-rose-500 hover:text-rose-600">
                Voltar para {prestadoraNome}
              </Link>
            </div>
          ) : (
            <div className="text-center py-6">
              <Clock className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h1 className="font-serif text-xl font-bold text-gray-900 mb-1.5">Agendamento não está mais ativo</h1>
              <p className="text-sm text-gray-500">Esse agendamento foi cancelado. Volte à página da prestadora para agendar novamente.</p>
              <Link href={`/n/${prestadoraSlug}`} className="inline-block mt-4 text-sm font-semibold text-rose-500 hover:text-rose-600">
                Voltar para {prestadoraNome}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
