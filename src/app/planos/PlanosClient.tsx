'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, X, Sparkles, Zap, Tag, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCupom, precoComDesconto } from '@/hooks/use-cupom'
import type { Plano } from '@/lib/mercadopago'

type Ciclo = 'mensal' | 'anual'

type Feature = { texto: string; incluido: boolean; emBreve?: boolean }

const FEATURES: Record<Plano, Feature[]> = {
  start: [
    { texto: 'Agendamentos ilimitados', incluido: true },
    { texto: 'Página pública de agendamento', incluido: true },
    { texto: 'Gestão de clientes', incluido: true },
    { texto: 'Notificações por WhatsApp', incluido: true },
    { texto: '1 profissional cadastrada', incluido: true },
    { texto: 'Galeria de trabalhos (4 fotos)', incluido: true },
    { texto: 'Fotos do estabelecimento', incluido: false },
    { texto: 'Relatórios completos', incluido: false },
  ],
  pro: [
    { texto: 'Tudo do Start', incluido: true },
    { texto: 'Até 3 profissionais', incluido: true },
    { texto: 'Galeria de trabalhos (8 fotos)', incluido: true },
    { texto: 'Fotos do estabelecimento (8 fotos)', incluido: true },
    { texto: 'Relatórios completos', incluido: true },
    { texto: 'Personalização da página (cor)', incluido: true },
    { texto: 'Suporte prioritário', incluido: true },
    { texto: 'WhatsApp automático', incluido: true, emBreve: true },
  ],
  studio: [
    { texto: 'Tudo do Pro', incluido: true },
    { texto: 'Profissionais ilimitadas', incluido: true },
    { texto: 'Fotos ilimitadas (trabalhos + estabelecimento)', incluido: true },
    { texto: 'Presets de página', incluido: true },
    { texto: 'WhatsApp automático', incluido: true, emBreve: true },
    { texto: 'Assinaturas de clientes', incluido: true, emBreve: true },
  ],
}

const PRECOS: Record<Plano, { mensal: string; anual: string; mensal_equiv: string }> = {
  start: { mensal: 'R$49', anual: 'R$470', mensal_equiv: 'R$39' },
  pro: { mensal: 'R$89', anual: 'R$855', mensal_equiv: 'R$71' },
  studio: { mensal: 'R$119', anual: 'R$1.142', mensal_equiv: 'R$95' },
}

const NOME_PLANO: Record<Plano, string> = { start: 'Start', pro: 'Pro', studio: 'Studio' }
const SUBTITULO_PLANO: Record<Plano, string> = {
  start: 'Ideal para quem está começando',
  pro: 'Para quem já tem uma agenda cheia',
  studio: 'Para estúdios em crescimento, sem limites',
}

const PLANOS_ORDEM: Plano[] = ['start', 'pro', 'studio']

function FeatureItem({ texto, incluido, emBreve, tema }: Feature & { tema: 'claro' | 'escuro' }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      {incluido ? (
        <div className={cn('w-4 h-4 rounded-full flex items-center justify-center shrink-0', tema === 'escuro' ? 'bg-white/20' : 'bg-emerald-100')}>
          <Check className={cn('w-2.5 h-2.5', tema === 'escuro' ? 'text-white' : 'text-emerald-600')} strokeWidth={3} />
        </div>
      ) : (
        <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <X className="w-2.5 h-2.5 text-gray-400" strokeWidth={3} />
        </div>
      )}
      <span className={incluido ? (tema === 'escuro' ? 'text-white/90' : 'text-gray-700') : 'text-gray-400'}>
        {texto}
      </span>
      {emBreve && (
        <span className={cn(
          'inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
          tema === 'escuro' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
        )}>
          <Clock className="w-2.5 h-2.5" />
          Em breve
        </span>
      )}
    </li>
  )
}

export default function PlanosClient({
  isLoggedIn,
  planoAtual,
  cicloInicial = 'mensal',
  eTrial = false,
  trialExpirado = false,
  auto,
}: {
  isLoggedIn: boolean
  planoAtual: Plano | null
  cicloInicial?: Ciclo
  eTrial?: boolean
  trialExpirado?: boolean
  auto?: Plano
}) {
  const router = useRouter()
  const [ciclo, setCiclo] = useState<Ciclo>(cicloInicial)
  const [loading, setLoading] = useState<Plano | null>(null)

  const autoFired = useRef(false)
  useEffect(() => {
    if (!auto || autoFired.current) return
    autoFired.current = true
    assinar(auto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto])

  const {
    cupomAberto, setCupomAberto,
    cupomInput, onCupomInputChange,
    cupomStatus, aplicarCupom,
    desconto,
  } = useCupom()

  function assinar(plano: Plano) {
    if (!isLoggedIn) {
      window.location.href = `/painel/cadastro?plano=${plano}`
      return
    }

    setLoading(plano)
    router.push(`/planos/checkout?plano=${plano}&ciclo=${ciclo}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-rose-50">
      {/* Header */}
      <header className="py-6 px-4 flex items-center justify-between max-w-6xl mx-auto">
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
          {trialExpirado ? 'Planos simples e diretos' : '30 dias grátis no plano Start · Sem cobrar agora'}
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-gray-900 mb-4 leading-tight">
          Escolha seu plano e<br className="hidden sm:block" /> comece a crescer
        </h1>
        <p className="text-gray-500 text-lg mb-6">
          {trialExpirado ? 'Cancele quando quiser.' : 'Teste grátis por 30 dias no Start. Cancele quando quiser.'}
        </p>

        {/* Banner para usuários em trial */}
        {trialExpirado ? (
          <div className="mb-6 inline-flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-left max-w-lg">
            <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
            <p className="text-sm text-red-800">
              Seu <strong>período de teste gratuito de 30 dias terminou</strong>. Escolha um plano abaixo para continuar usando o BelleBook sem interrupções.
            </p>
          </div>
        ) : eTrial && (
          <div className="mb-6 inline-flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-left max-w-lg">
            <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
            <p className="text-sm text-amber-800">
              {planoAtual && planoAtual !== 'start' ? (
                <>Você está no <strong>trial gratuito do Plano {NOME_PLANO[planoAtual]}</strong>. Para continuar com os recursos desse plano após o período gratuito, assine abaixo.</>
              ) : (
                <>Você está no <strong>trial gratuito do Plano Start</strong>. Para continuar após o período gratuito, assine o Start abaixo. Para mais profissionais, galeria maior e relatórios, escolha um plano superior.</>
              )}
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
      <div className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {PLANOS_ORDEM.map((plano) => {
            const destaque = plano === 'pro'
            const preco = PRECOS[plano]
            return (
              <div
                key={plano}
                className={cn(
                  'rounded-3xl p-7 flex flex-col relative overflow-hidden',
                  destaque
                    ? 'bg-rose-400 shadow-[0_16px_60px_rgba(251,113,133,0.3)]'
                    : 'bg-white border border-gray-200'
                )}
              >
                {destaque && (
                  <>
                    <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 pointer-events-none" />
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
                  </>
                )}

                <div className="relative mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {destaque ? <Sparkles className="w-5 h-5 text-white/80" /> : <Zap className="w-5 h-5 text-gray-600" />}
                      <span className={cn('text-xs font-semibold uppercase tracking-wider', destaque ? 'text-white/80' : 'text-gray-500')}>
                        {NOME_PLANO[plano]}
                      </span>
                    </div>
                    {destaque && (
                      <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                        Popular
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      {cupomStatus === 'ok' ? (
                        <>
                          <span className={cn('text-xl font-bold line-through', destaque ? 'text-white/50' : 'text-gray-400')}>
                            {ciclo === 'mensal' ? preco.mensal : preco.anual}
                          </span>
                          <span className={cn('text-3xl font-bold', destaque ? 'text-white' : 'text-gray-900')}>
                            {precoComDesconto(ciclo === 'mensal' ? preco.mensal : preco.anual, desconto)}
                          </span>
                        </>
                      ) : (
                        <span className={cn('text-3xl font-bold', destaque ? 'text-white' : 'text-gray-900')}>
                          {ciclo === 'mensal' ? preco.mensal : preco.anual}
                        </span>
                      )}
                      <span className={cn('text-sm', destaque ? 'text-white/70' : 'text-gray-400')}>
                        {ciclo === 'mensal' ? '/mês' : '/ano'}
                      </span>
                    </div>
                    {ciclo === 'anual' && cupomStatus !== 'ok' && (
                      <p className={cn('text-xs mt-0.5', destaque ? 'text-white/50' : 'text-gray-400')}>
                        {preco.mensal_equiv}/mês equivalente
                      </p>
                    )}
                    <p className={cn('text-sm mt-1', destaque ? 'text-white/60' : 'text-emerald-600 font-medium')}>
                      {plano === 'start' && !trialExpirado
                        ? `30 dias grátis, depois ${ciclo === 'mensal' ? preco.mensal + '/mês' : preco.anual + '/ano'}`
                        : `Sem trial · ${ciclo === 'mensal' ? preco.mensal + '/mês' : preco.anual + '/ano'}`}
                    </p>
                  </div>

                  <p className={cn('text-sm mt-2', destaque ? 'text-white/75' : 'text-gray-500')}>
                    {SUBTITULO_PLANO[plano]}
                  </p>
                </div>

                <ul className="relative space-y-3 mb-8 flex-1">
                  {FEATURES[plano].map((f) => (
                    <FeatureItem key={f.texto} {...f} tema={destaque ? 'escuro' : 'claro'} />
                  ))}
                </ul>

                <button
                  onClick={() => assinar(plano)}
                  disabled={loading !== null}
                  className={cn(
                    'relative w-full py-3.5 rounded-2xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                    destaque
                      ? 'bg-white text-rose-500 hover:bg-rose-50 shadow-lg'
                      : 'border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  {loading === plano
                    ? 'Aguarde...'
                    : plano === 'start' && !trialExpirado && !eTrial
                      ? 'Começar grátis por 30 dias'
                      : `Assinar ${NOME_PLANO[plano]}`}
                </button>
              </div>
            )
          })}
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
                  onChange={(e) => onCupomInputChange(e.target.value)}
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
          {trialExpirado
            ? 'Planos Pro e Studio cobram imediatamente · Cancele quando quiser'
            : '30 dias grátis exclusivos do Plano Start · Demais planos cobram imediatamente · Cancele quando quiser'}
        </p>

        {/* Formas de pagamento */}
        <p className="text-center text-xs text-gray-400 mt-3">
          💳 Aceita Pix, cartão de crédito e cartão de débito via Mercado Pago
        </p>
      </div>
    </div>
  )
}
