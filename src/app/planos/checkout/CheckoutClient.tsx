'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, X, CreditCard, QrCode, Landmark, ChevronRight, Loader2 } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { Button } from '@/components/ui/button'
import { useCupom } from '@/hooks/use-cupom'
import { formatCurrency, cn } from '@/lib/utils'
import type { Plano } from '@/lib/mercadopago'
import toast from 'react-hot-toast'

type Ciclo = 'mensal' | 'anual'
type Metodo = 'cartao' | 'pix' | 'debito'

// Mesmos preços mostrados em /planos — mantidos aqui (não importados de
// src/lib/mercadopago.ts) porque aquele módulo inicializa o client do MP com
// a access token e não pode ser importado em código de cliente.
const PRECOS: Record<Plano, Record<Ciclo, number>> = {
  start: { mensal: 29, anual: 240 },
  pro: { mensal: 89, anual: 855 },
  studio: { mensal: 119, anual: 1142 },
}

const NOME_PLANO: Record<Plano, string> = { start: 'Start', pro: 'Pro', studio: 'Studio' }

const METODOS: {
  valor: Metodo
  titulo: string
  icon: typeof CreditCard
  subtextoMensal: string
}[] = [
  {
    valor: 'cartao',
    titulo: 'Pagar com Cartão de Crédito',
    icon: CreditCard,
    subtextoMensal: 'Cobrança automática todo mês, sem precisar fazer nada',
  },
  {
    valor: 'pix',
    titulo: 'Pagar com Pix',
    icon: QrCode,
    subtextoMensal: 'Você receberá um aviso todo mês para renovar',
  },
  {
    valor: 'debito',
    titulo: 'Pagar com Débito',
    icon: Landmark,
    subtextoMensal: 'Você receberá um aviso todo mês para renovar',
  },
]

function calcularPrecoFinal(precoBase: number, desconto: { percentOff: number | null; amountOff: number | null } | null): number {
  if (!desconto) return precoBase
  let final = precoBase
  if (desconto.percentOff != null) final = precoBase * (1 - desconto.percentOff / 100)
  else if (desconto.amountOff != null) final = precoBase - desconto.amountOff / 100
  return Math.max(0, Math.round(final * 100) / 100)
}

export default function CheckoutClient({ plano, ciclo }: { plano: Plano; ciclo: Ciclo }) {
  const router = useRouter()
  const [pagando, setPagando] = useState<Metodo | null>(null)

  const {
    cupomInput, onCupomInputChange,
    cupomStatus, cupomAplicado, desconto,
    aplicarCupom, marcarCupomInvalido,
  } = useCupom()

  const precoBase = PRECOS[plano][ciclo]
  const precoFinal = calcularPrecoFinal(precoBase, cupomStatus === 'ok' ? desconto : null)
  const temDesconto = cupomStatus === 'ok' && precoFinal < precoBase

  async function pagar(metodo: Metodo) {
    // Dentro do app (Capacitor), window.open() não abre nada — a WebView não
    // implementa multi-window por padrão. Nesse caso usamos Browser.open() do
    // @capacitor/browser (Custom Tabs/SFSafariViewController) depois que a
    // Preference já voltou do servidor, sem precisar do truque da aba em
    // branco abaixo (Browser.open() é uma chamada nativa, não sofre o
    // bloqueio de popup que depende do gesto síncrono do clique).
    const nativo = Capacitor.isNativePlatform()
    // No navegador comum, abre a aba ANTES do fetch (síncrono, dentro do
    // próprio clique) — depois de um await, o navegador não reconhece mais o
    // clique original como o gesto que autoriza abrir aba nova, e o Safari em
    // especial bloqueia. Só troca a URL da aba já aberta quando a Preference
    // volta do servidor.
    const novaAba = nativo ? null : window.open('', '_blank')
    setPagando(metodo)
    try {
      const res = await fetch('/api/mp/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano, ciclo, metodo, ...(cupomAplicado ? { cupom: cupomAplicado } : {}) }),
      })
      const data = await res.json()

      if (!res.ok) {
        novaAba?.close()
        if (data.tipo === 'cupom') {
          marcarCupomInvalido()
          toast.error('Cupom inválido ou expirado')
        } else {
          toast.error(data.error ?? 'Erro ao iniciar pagamento')
        }
        setPagando(null)
        return
      }

      if (nativo) await Browser.open({ url: data.url })
      else if (novaAba) novaAba.location.href = data.url
      else window.open(data.url, '_blank', 'noopener,noreferrer')
      // Fica na página do BelleBook (não na do MP) — o pagamento acontece na
      // aba nova, e /planos/sucesso já tem o polling que espera o webhook
      // confirmar a assinatura.
      router.replace(`/planos/sucesso?plano=${plano}&ciclo=${ciclo}`)
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
        <button
          onClick={() => router.push(`/planos?ciclo=${ciclo}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8">
          <h1 className="font-serif text-2xl font-bold text-gray-900 mb-6">Confirmar assinatura</h1>

          {/* Resumo do plano */}
          <div className="space-y-2.5 pb-6 border-b border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Plano</span>
              <span className="font-semibold text-gray-900">Plano {NOME_PLANO[plano]}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Ciclo</span>
              <span className="font-semibold text-gray-900">{ciclo === 'anual' ? 'Anual' : 'Mensal'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Preço original</span>
              <span className={cn('font-medium', temDesconto ? 'text-gray-400 line-through' : 'text-gray-900')}>
                {formatCurrency(precoBase)}
              </span>
            </div>
            {temDesconto && (
              <div className="flex items-center justify-between text-sm text-emerald-600 font-medium">
                <span>Desconto ({cupomAplicado})</span>
                <span>-{formatCurrency(precoBase - precoFinal)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-2">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-3xl font-bold text-rose-500">
                {formatCurrency(precoFinal)}
                <span className="text-sm font-medium text-gray-400">{ciclo === 'anual' ? '/ano' : '/mês'}</span>
              </span>
            </div>
          </div>

          {/* Cupom */}
          <div className="py-6 border-b border-gray-100">
            <label className="text-sm font-medium text-gray-700 block mb-2">Cupom de desconto</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={cupomInput}
                onChange={(e) => onCupomInputChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aplicarCupom() } }}
                placeholder="CÓDIGO DO CUPOM"
                className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 transition-all"
              />
              <Button
                type="button"
                variant="outline"
                onClick={aplicarCupom}
                disabled={cupomStatus === 'loading' || !cupomInput.trim()}
              >
                {cupomStatus === 'loading' ? '...' : 'Aplicar'}
              </Button>
            </div>
            {cupomStatus === 'ok' && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium mt-2">
                <Check className="w-4 h-4" strokeWidth={2.5} />
                Cupom aplicado!
              </p>
            )}
            {cupomStatus === 'erro' && (
              <p className="flex items-center gap-1.5 text-sm text-red-500 mt-2">
                <X className="w-4 h-4" strokeWidth={2.5} />
                Cupom inválido ou expirado
              </p>
            )}
          </div>

          {/* Métodos de pagamento */}
          <div className="pt-6 space-y-3">
            {METODOS.map(({ valor, titulo, icon: Icon, subtextoMensal }) => (
              <button
                key={valor}
                type="button"
                onClick={() => pagar(valor)}
                disabled={pagando !== null}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 hover:border-rose-300 hover:bg-rose-50/40 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-rose-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{titulo}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {ciclo === 'anual' ? 'Pagamento único, sem renovação automática' : subtextoMensal}
                  </p>
                </div>
                {pagando === valor ? (
                  <Loader2 className="w-5 h-5 text-rose-400 animate-spin shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          💳 Pagamento processado com segurança pelo Mercado Pago
        </p>
      </main>
    </div>
  )
}
