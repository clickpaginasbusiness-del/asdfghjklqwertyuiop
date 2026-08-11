'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CreditCard, QrCode, Landmark, ChevronRight, Loader2, CheckCircle2, Clock } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { TAXA_PLATAFORMA_PERCENTUAL } from '@/lib/sinal'
import toast from 'react-hot-toast'

type Metodo = 'cartao' | 'pix' | 'debito'
type Status = 'confirmado' | 'cancelado' | 'concluido' | 'aguardando_pagamento'

const METODOS: { valor: Metodo; titulo: string; icon: typeof CreditCard }[] = [
  { valor: 'cartao', titulo: 'Cartão de crédito', icon: CreditCard },
  { valor: 'pix', titulo: 'Pix', icon: QrCode },
  { valor: 'debito', titulo: 'Cartão de débito', icon: Landmark },
]

const MAX_TENTATIVAS_POLL = 15
const INTERVALO_POLL_MS = 2500

export default function CheckoutClient({
  agendamentoId,
  status,
  dataHora,
  servicoNome,
  profissionalNome,
  prestadoraNome,
  prestadoraSlug,
  ehSinal,
  valor,
  mostrarAguardandoConfirmacao,
  mostrarErroPagamento,
}: {
  agendamentoId: string
  status: Status
  dataHora: string
  servicoNome: string
  profissionalNome: string | null
  prestadoraNome: string
  prestadoraSlug: string
  ehSinal: boolean
  valor: number
  mostrarAguardandoConfirmacao: boolean
  mostrarErroPagamento: boolean
}) {
  const router = useRouter()
  const [pagando, setPagando] = useState<Metodo | null>(null)
  const [concordaNaoReembolsavel, setConcordaNaoReembolsavel] = useState(false)
  const tentativasRef = useRef(0)
  const [poolExpirado, setPoolExpirado] = useState(false)

  const aguardandoConfirmacao = mostrarAguardandoConfirmacao && status === 'aguardando_pagamento'

  // Voltou do checkout do MP com o pagamento aprovado — o webhook confirma o
  // agendamento de forma assíncrona, então aqui só espera (com um teto de
  // tentativas) atualizando a página até o status virar 'confirmado'. Uma vez
  // confirmado, manda pra página de sucesso dedicada em vez de só trocar o
  // estado aqui — mesma experiência de sucesso não importa se o pagamento
  // aprovou na hora (auto_return) ou enquanto esperava aqui (pix pendente).
  useEffect(() => {
    if (!aguardandoConfirmacao) return
    const id = setInterval(() => {
      tentativasRef.current += 1
      if (tentativasRef.current > MAX_TENTATIVAS_POLL) {
        setPoolExpirado(true)
        clearInterval(id)
        return
      }
      router.refresh()
    }, INTERVALO_POLL_MS)
    return () => clearInterval(id)
  }, [aguardandoConfirmacao, router])

  useEffect(() => {
    if (status === 'confirmado' || status === 'concluido') {
      router.replace(`/agendamento/sucesso?agendamento_id=${agendamentoId}`)
    }
  }, [status, agendamentoId, router])

  async function pagar(metodo: Metodo) {
    // Abre a aba ANTES do fetch (síncrono, dentro do próprio clique) — depois
    // de um await, o navegador não reconhece mais o clique original como o
    // gesto que autoriza abrir aba nova, e o Safari em especial bloqueia. Só
    // troca a URL da aba já aberta quando a Preference volta do servidor.
    const novaAba = window.open('', '_blank')
    setPagando(metodo)
    try {
      const res = await fetch('/api/agendamentos/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendamentoId, metodo }),
      })
      const data = await res.json()
      if (!res.ok) {
        novaAba?.close()
        toast.error(data.error ?? 'Erro ao iniciar pagamento')
        setPagando(null)
        return
      }
      if (novaAba) novaAba.location.href = data.url
      else window.open(data.url, '_blank', 'noopener,noreferrer')
      // Fica na página do BelleBook (não na do MP) — o Mercado Pago paga na
      // aba nova, e aqui o polling de /agendamento/sucesso já cobre tanto
      // aprovação instantânea (cartão) quanto Pix pendente.
      router.replace(`/agendamento/sucesso?agendamento_id=${agendamentoId}`)
    } catch {
      novaAba?.close()
      toast.error('Erro de conexão. Tente novamente.')
      setPagando(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-rose-50">
      <header className="py-6 px-4 max-w-5xl mx-auto">
        <Link href="/" className="font-serif text-2xl font-bold text-rose-400">BelleBook</Link>
      </header>

      <main className="max-w-md mx-auto px-4 pb-16">
        <Link
          href={`/n/${prestadoraSlug}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4"
        >
          Voltar para {prestadoraNome}
        </Link>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8">
          {status === 'cancelado' ? (
            <div className="text-center py-6">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h1 className="font-serif text-xl font-bold text-gray-900 mb-1.5">Agendamento cancelado</h1>
              <p className="text-sm text-gray-500">Esse horário não está mais reservado. Volte à página da prestadora para agendar novamente.</p>
            </div>
          ) : status === 'confirmado' || status === 'concluido' ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h1 className="font-serif text-xl font-bold text-gray-900 mb-1.5">Pagamento confirmado!</h1>
              <p className="text-sm text-gray-500">Seu agendamento com {prestadoraNome} está confirmado.</p>
            </div>
          ) : aguardandoConfirmacao && !poolExpirado ? (
            <div className="text-center py-6">
              <Loader2 className="w-10 h-10 text-rose-400 mx-auto mb-3 animate-spin" />
              <h1 className="font-serif text-xl font-bold text-gray-900 mb-1.5">Confirmando pagamento...</h1>
              <p className="text-sm text-gray-500">Só um instante enquanto confirmamos com o Mercado Pago.</p>
            </div>
          ) : aguardandoConfirmacao && poolExpirado ? (
            <div className="text-center py-6">
              <Clock className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h1 className="font-serif text-xl font-bold text-gray-900 mb-1.5">Ainda processando</h1>
              <p className="text-sm text-gray-500">
                Seu pagamento está sendo confirmado — pode levar alguns minutos. Você receberá a confirmação assim que estiver pronta.
              </p>
            </div>
          ) : (
            <>
              <h1 className="font-serif text-2xl font-bold text-gray-900 mb-6">
                {ehSinal ? 'Pagar sinal' : 'Confirmar pagamento'}
              </h1>

              {mostrarErroPagamento && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-6">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 leading-relaxed">
                    Não conseguimos confirmar seu pagamento. Nada foi cobrado — tente novamente.
                  </p>
                </div>
              )}

              <div className="space-y-2.5 pb-6 border-b border-gray-100">
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
                <div className="flex items-baseline justify-between pt-2">
                  <span className="text-sm font-semibold text-gray-700">{ehSinal ? 'Valor do sinal' : 'Total'}</span>
                  <span className="text-3xl font-bold text-rose-500">{formatCurrency(valor)}</span>
                </div>
                <p className="text-xs text-gray-400 text-right">Taxa da plataforma ({TAXA_PLATAFORMA_PERCENTUAL}%) já incluída</p>
              </div>

              <div className="py-5 border-b border-gray-100">
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Este pagamento é não reembolsável. Em caso de cancelamento, o valor não será devolvido.
                  </p>
                </div>
                <label className="flex items-start gap-2.5 mt-3 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={concordaNaoReembolsavel}
                    onChange={(e) => setConcordaNaoReembolsavel(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-rose-400 focus:ring-rose-300 shrink-0"
                  />
                  Li e concordo que este pagamento não é reembolsável
                </label>
              </div>

              <div className="pt-6 space-y-3">
                {METODOS.map(({ valor: metodo, titulo, icon: Icon }) => (
                  <button
                    key={metodo}
                    type="button"
                    onClick={() => pagar(metodo)}
                    disabled={!concordaNaoReembolsavel || pagando !== null}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 hover:border-rose-300 hover:bg-rose-50/40 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6 text-rose-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{titulo}</p>
                    </div>
                    {pagando === metodo ? (
                      <Loader2 className="w-5 h-5 text-rose-400 animate-spin shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          💳 Pagamento processado com segurança pelo Mercado Pago
        </p>
      </main>
    </div>
  )
}
