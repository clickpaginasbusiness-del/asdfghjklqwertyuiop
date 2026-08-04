'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Clock, LayoutDashboard } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Ciclo } from '@/lib/mercadopago'

const MAX_TENTATIVAS_POLL = 15
const INTERVALO_POLL_MS = 2500

export default function PlanoSucessoClient({
  planoConfirmadoAtivo,
  nomePlano,
  ciclo,
  valor,
}: {
  planoConfirmadoAtivo: boolean
  nomePlano: string
  ciclo: Ciclo
  valor: number
}) {
  const router = useRouter()
  const tentativasRef = useRef(0)
  const [poolExpirado, setPoolExpirado] = useState(false)

  // Voltou do checkout do MP com o pagamento aprovado, mas a ativação da
  // assinatura em si depende do webhook processar de forma assíncrona —
  // espera (com teto de tentativas) até assinatura_ativa+plano baterem.
  useEffect(() => {
    if (planoConfirmadoAtivo) return
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
  }, [planoConfirmadoAtivo, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-rose-50">
      <header className="py-6 px-4 max-w-5xl mx-auto">
        <Link href="/" className="font-serif text-2xl font-bold text-rose-400">BelleBook</Link>
      </header>

      <main className="max-w-md mx-auto px-4 pb-16">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8">
          {planoConfirmadoAtivo ? (
            <>
              <div className="text-center py-2">
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4 animate-check-pop" />
                <h1 className="font-serif text-2xl font-bold text-gray-900 mb-1.5">Bem-vinda ao BelleBook!</h1>
                <p className="text-sm text-gray-500">Sua assinatura está ativa.</p>
              </div>

              <div className="space-y-2.5 my-6 py-5 border-y border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Plano</span>
                  <span className="font-semibold text-gray-900">{nomePlano}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Cobrança</span>
                  <span className="font-semibold text-gray-900">{ciclo === 'anual' ? 'Anual' : 'Mensal'}</span>
                </div>
                <div className="flex items-baseline justify-between pt-2">
                  <span className="text-sm font-semibold text-gray-700">Valor</span>
                  <span className="text-2xl font-bold text-rose-500">{formatCurrency(valor)}</span>
                </div>
              </div>

              <Link
                href="/painel"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-400 hover:bg-rose-500 text-white font-semibold text-sm transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                Ir para o painel
              </Link>
            </>
          ) : !poolExpirado ? (
            <div className="text-center py-6">
              <Loader2 className="w-10 h-10 text-rose-400 mx-auto mb-3 animate-spin" />
              <h1 className="font-serif text-xl font-bold text-gray-900 mb-1.5">Confirmando pagamento...</h1>
              <p className="text-sm text-gray-500">Só um instante enquanto confirmamos com o Mercado Pago.</p>
            </div>
          ) : (
            <div className="text-center py-6">
              <Clock className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h1 className="font-serif text-xl font-bold text-gray-900 mb-1.5">Ainda processando</h1>
              <p className="text-sm text-gray-500">
                Seu pagamento está sendo confirmado — pode levar alguns minutos. Você receberá a confirmação assim que estiver pronta.
              </p>
              <Link href="/painel" className="inline-block mt-4 text-sm font-semibold text-rose-500 hover:text-rose-600">
                Ir para o painel
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
