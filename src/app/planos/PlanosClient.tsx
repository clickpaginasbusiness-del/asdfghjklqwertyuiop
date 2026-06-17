'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Check, X, Sparkles, Zap, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type Ciclo = 'mensal' | 'anual'

const FEATURES_BASICO = [
  { texto: 'Agendamentos ilimitados', incluido: true },
  { texto: 'Página pública de agendamento', incluido: true },
  { texto: 'Gestão de clientes', incluido: true },
  { texto: 'Notificações por WhatsApp', incluido: true },
  { texto: 'Horários e disponibilidade', incluido: true },
  { texto: '1 profissional cadastrada', incluido: true },
  { texto: 'Galeria de fotos e vídeos', incluido: false },
  { texto: 'Profissionais ilimitadas', incluido: false },
]

const FEATURES_PRO = [
  { texto: 'Tudo do Plano Básico', incluido: true },
  { texto: 'Profissionais ilimitadas', incluido: true },
  { texto: 'Galeria de fotos e vídeos', incluido: true },
  { texto: 'Suporte prioritário', incluido: true },
  { texto: 'Novidades em primeira mão', incluido: true },
]

const PRECOS = {
  basico: { mensal: 'R$49', anual: 'R$470', mensal_equiv: 'R$39' },
  pro:    { mensal: 'R$89', anual: 'R$855', mensal_equiv: 'R$71' },
}

function FeatureItem({ texto, incluido }: { texto: string; incluido: boolean }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      {incluido ? (
        <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <Check className="w-2.5 h-2.5 text-emerald-600" strokeWidth={3} />
        </div>
      ) : (
        <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <X className="w-2.5 h-2.5 text-gray-400" strokeWidth={3} />
        </div>
      )}
      <span className={incluido ? 'text-gray-700' : 'text-gray-400'}>{texto}</span>
    </li>
  )
}

export default function PlanosClient({
  isLoggedIn,
  planoAtual,
  cicloInicial = 'mensal',
  eTrial = false,
  auto,
}: {
  isLoggedIn: boolean
  planoAtual: 'basico' | 'pro' | null
  cicloInicial?: Ciclo
  eTrial?: boolean
  auto?: 'basico' | 'pro'
}) {
  const [ciclo, setCiclo] = useState<Ciclo>(cicloInicial)
  const [loading, setLoading] = useState<'basico' | 'pro' | null>(null)

  const autoFired = useRef(false)
  useEffect(() => {
    if (!auto || autoFired.current) return
    autoFired.current = true
    if (!isLoggedIn) {
      window.location.href = `/painel/cadastro?plano=${auto}`
      return
    }
    assinar(auto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, isLoggedIn])

  const [cupomAberto, setCupomAberto] = useState(false)
  const [cupomInput, setCupomInput] = useState('')
  const [cupomStatus, setCupomStatus] = useState<'idle' | 'loading' | 'ok' | 'erro'>('idle')
  const [cupomAplicado, setCupomAplicado] = useState('')

  async function aplicarCupom() {
    const code = cupomInput.trim().toUpperCase()
    if (!code) return
    setCupomStatus('loading')
    try {
      const res = await fetch('/api/stripe/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: code }),
      })
      if (res.ok) {
        setCupomStatus('ok')
        setCupomAplicado(code)
      } else {
        setCupomStatus('erro')
        setCupomAplicado('')
      }
    } catch {
      setCupomStatus('erro')
      setCupomAplicado('')
    }
  }

  async function assinar(plano: 'basico' | 'pro') {
    if (!isLoggedIn) {
      window.location.href = `/painel/cadastro?plano=${plano}`
      return
    }

    setLoading(plano)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano, ciclo, ...(cupomAplicado ? { cupom: cupomAplicado } : {}) }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.tipo === 'cupom') {
          setCupomStatus('erro')
          setCupomAplicado('')
          toast.error('Cupom inválido ou expirado')
        } else {
          toast.error(data.error ?? 'Erro ao iniciar pagamento')
        }
        setLoading(null)
        return
      }

      window.location.href = data.url
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-rose-50">
      {/* Header */}
      <header className="py-6 px-4 flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="font-serif text-2xl font-bold text-rose-400">BelleBook</Link>
        {isLoggedIn ? (
          <Link href="/painel" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Ir para o painel →
          </Link>
        ) : (
          <div className="flex items-center gap-4">
            <Link href="/painel/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Entrar
            </Link>
            <Link href="/painel/cadastro" className="text-sm bg-rose-400 text-white px-4 py-2 rounded-xl hover:bg-rose-500 transition-colors font-medium">
              Criar conta
            </Link>
          </div>
        )}
      </header>

      {/* Hero */}
      <div className="text-center px-4 pt-8 pb-10 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-rose-100 text-rose-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          30 dias grátis · Sem cobrar agora
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-gray-900 mb-4 leading-tight">
          Escolha seu plano e<br className="hidden sm:block" /> comece a crescer
        </h1>
        <p className="text-gray-500 text-lg mb-6">
          Teste grátis por 30 dias. Cancele quando quiser.
        </p>

        {/* Banner para usuários em trial */}
        {eTrial && (
          <div className="mb-6 inline-flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-left max-w-lg">
            <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Você está no <strong>trial gratuito do Plano Básico</strong>. Para continuar após o período gratuito, assine o Básico abaixo. Para ter acesso a profissionais ilimitadas e galeria, escolha o <strong>Plano Pro</strong>.
            </p>
          </div>
        )}

        {/* Toggle mensal / anual */}
        <div className="inline-flex items-center bg-gray-100 rounded-full p-1 gap-1">
          <button
            onClick={() => setCiclo('mensal')}
            className={cn(
              'px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
              ciclo === 'mensal'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Mensal
          </button>
          <button
            onClick={() => setCiclo('anual')}
            className={cn(
              'flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
              ciclo === 'anual'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            Anual
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors',
              ciclo === 'anual'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-200 text-gray-400'
            )}>
              20% off
            </span>
          </button>
        </div>
      </div>

      {/* Planos */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Plano Básico ── */}
          <div className="bg-white rounded-3xl border border-gray-200 p-8 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-gray-600" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Básico</span>
              </div>

              {ciclo === 'mensal' ? (
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">{PRECOS.basico.mensal}</span>
                    <span className="text-gray-400 text-sm">/mês</span>
                  </div>
                  <p className="text-sm text-emerald-600 font-medium mt-1">30 dias grátis, depois {PRECOS.basico.mensal}/mês</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">{PRECOS.basico.anual}</span>
                    <span className="text-gray-400 text-sm">/ano</span>
                  </div>
                  <p className="text-sm text-emerald-600 font-medium mt-1">30 dias grátis, depois {PRECOS.basico.anual}/ano</p>
                  <p className="text-xs text-gray-400 mt-0.5">{PRECOS.basico.mensal_equiv}/mês equivalente</p>
                </div>
              )}

              <p className="text-sm text-gray-500 mt-2">Ideal para quem está começando</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {FEATURES_BASICO.map((f) => (
                <FeatureItem key={f.texto} {...f} />
              ))}
            </ul>

            <button
              onClick={() => assinar('basico')}
              disabled={loading !== null}
              className="w-full py-3.5 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'basico' ? 'Aguarde...' : 'Começar grátis por 30 dias'}
            </button>
          </div>

          {/* ── Plano Pro ── */}
          <div className="bg-rose-400 rounded-3xl p-8 flex flex-col relative overflow-hidden shadow-[0_16px_60px_rgba(251,113,133,0.3)]">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />

            <div className="relative mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-white/80" />
                  <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Pro</span>
                </div>
                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Mais popular
                </span>
              </div>

              {ciclo === 'mensal' ? (
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">{PRECOS.pro.mensal}</span>
                    <span className="text-white/70 text-sm">/mês</span>
                  </div>
                  <p className="text-sm text-white/60 mt-1">Sem trial · {PRECOS.pro.mensal}/mês</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">{PRECOS.pro.anual}</span>
                    <span className="text-white/70 text-sm">/ano</span>
                  </div>
                  <p className="text-sm text-white/60 mt-1">Sem trial · {PRECOS.pro.anual}/ano</p>
                  <p className="text-xs text-white/50 mt-0.5">{PRECOS.pro.mensal_equiv}/mês equivalente</p>
                </div>
              )}

              <p className="text-sm text-white/75 mt-2">Para estúdios em crescimento</p>
            </div>

            <ul className="relative space-y-3 mb-8 flex-1">
              {FEATURES_PRO.map((f) => (
                <li key={f.texto} className="flex items-center gap-2.5 text-sm">
                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-white/90">{f.texto}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => assinar('pro')}
              disabled={loading !== null}
              className="relative w-full py-3.5 rounded-2xl bg-white text-rose-500 font-bold text-sm hover:bg-rose-50 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'pro' ? 'Aguarde...' : 'Assinar Pro'}
            </button>
          </div>
        </div>

        {/* Cupom de desconto */}
        <div className="mt-8 flex flex-col items-center gap-3">
          {!cupomAberto ? (
            <button
              onClick={() => setCupomAberto(true)}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Tag className="w-3.5 h-3.5" />
              Tem um cupom?
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={cupomInput}
                  onChange={(e) => {
                    setCupomInput(e.target.value.toUpperCase())
                    if (cupomStatus !== 'idle') { setCupomStatus('idle'); setCupomAplicado('') }
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && aplicarCupom()}
                  placeholder="CÓDIGO DO CUPOM"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-center uppercase tracking-widest w-48 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 transition-all"
                  autoFocus
                />
                <button
                  onClick={aplicarCupom}
                  disabled={cupomStatus === 'loading' || !cupomInput.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {cupomStatus === 'loading' ? '...' : 'Aplicar'}
                </button>
              </div>

              {cupomStatus === 'ok' && (
                <p className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                  Cupom aplicado!
                </p>
              )}
              {cupomStatus === 'erro' && (
                <p className="flex items-center gap-1.5 text-sm text-red-500">
                  <X className="w-4 h-4" strokeWidth={2.5} />
                  Cupom inválido ou expirado
                </p>
              )}
            </div>
          )}
        </div>

        {/* Garantia */}
        <p className="text-center text-sm text-gray-400 mt-6">
          30 dias grátis exclusivos do Plano Básico · Plano Pro cobra imediatamente · Cancele quando quiser
        </p>
      </div>
    </div>
  )
}
