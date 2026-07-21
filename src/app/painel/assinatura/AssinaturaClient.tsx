'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CreditCard, Check, X, Zap, Sparkles, AlertCircle, RefreshCw, ArrowUpRight, Tag, FlaskConical } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCupom, precoComDesconto } from '@/hooks/use-cupom'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Ciclo = 'mensal' | 'anual'

const PLANO_INFO = {
  basico: {
    nome: 'Plano Básico',
    precos: { mensal: 'R$49/mês', anual: 'R$470/ano · R$39/mês' },
    icon: Zap,
    features: [
      'Agendamentos ilimitados',
      'Página pública de agendamento',
      'Gestão de clientes',
      'Notificações por WhatsApp',
      '1 profissional cadastrada',
    ],
  },
  pro: {
    nome: 'Plano Pro',
    precos: { mensal: 'R$89/mês', anual: 'R$855/ano · R$71/mês' },
    icon: Sparkles,
    features: [
      'Tudo do Plano Básico',
      'Profissionais ilimitadas',
      'Galeria de fotos e vídeos',
      'Suporte prioritário',
    ],
  },
} as const

const UPGRADE_PRO = {
  mensal: { valor: 'R$89', sufixo: '/mês', equivalente: null, label: 'Profissionais ilimitadas + Galeria de fotos e vídeos' },
  anual:  { valor: 'R$855', sufixo: '/ano', equivalente: 'R$71/mês', label: 'Profissionais ilimitadas + Galeria — no ciclo anual' },
}

function formatData(iso: string | null): string {
  if (!iso) return '—'
  return format(parseISO(iso), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

function StatusBadge({ status, cancelAtPeriodEnd }: { status: string | null; cancelAtPeriodEnd: boolean }) {
  if (cancelAtPeriodEnd) return <Badge variant="danger">Cancelado</Badge>
  if (status === 'trialing')  return <Badge variant="pink">Trial gratuito</Badge>
  if (status === 'active')    return <Badge variant="success">Ativo</Badge>
  if (status === 'past_due')  return <Badge variant="danger">Pagamento pendente</Badge>
  if (status === 'canceled')  return <Badge variant="default">Cancelado</Badge>
  return <Badge variant="default">—</Badge>
}

type EstadoSimulado = 'trial' | 'basico' | 'pro'

const ESTADO_LABEL: Record<EstadoSimulado, string> = {
  trial: 'Trial',
  basico: 'Básico',
  pro: 'Pro',
}

function estadoSimuladoAtual(plano: 'basico' | 'pro' | null, eTrial: boolean): EstadoSimulado | null {
  if (eTrial && plano === 'basico') return 'trial'
  if (!eTrial && plano === 'basico') return 'basico'
  if (!eTrial && plano === 'pro') return 'pro'
  return null
}

/**
 * Ferramenta de QA visível só pra conta admin — troca plano/trial direto no
 * banco (sem mexer no Stripe de verdade) pra testar os estados da página e os
 * gates de feature sem precisar de contas de teste separadas.
 */
function SimuladorPlanoAdmin({ plano, eTrial }: { plano: 'basico' | 'pro' | null; eTrial: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState<EstadoSimulado | 'real' | null>(null)
  const atual = estadoSimuladoAtual(plano, eTrial)

  async function simular(estado: EstadoSimulado | 'real') {
    setLoading(estado)
    try {
      const res = await fetch('/api/admin/simular-plano', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao simular plano')
        return
      }
      toast.success(estado === 'real' ? 'Resetado para o status real do Stripe' : `Simulando: ${ESTADO_LABEL[estado]}`)
      router.refresh()
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card className="border-2 border-dashed border-purple-300 bg-purple-50/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-purple-500" />
          <CardTitle className="text-base">🧪 Modo de teste (Admin)</CardTitle>
        </div>
        <p className="text-sm text-gray-500">
          Simula o plano só no banco — não mexe na assinatura real do Stripe.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Estado de plano simulado">
          {(['trial', 'basico', 'pro'] as const).map((estado) => (
            <button
              key={estado}
              type="button"
              role="radio"
              aria-checked={atual === estado}
              onClick={() => simular(estado)}
              disabled={loading !== null}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                atual === estado
                  ? 'bg-purple-500 border-purple-500 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300'
              )}
            >
              {loading === estado ? 'Aplicando...' : ESTADO_LABEL[estado]}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-500">
          Simulando agora: <strong className="text-gray-700">{atual ? ESTADO_LABEL[atual] : 'nenhum dos 3 estados (estado real ou personalizado)'}</strong>
        </p>

        <button
          type="button"
          onClick={() => simular('real')}
          disabled={loading !== null}
          className="text-xs font-semibold text-purple-600 hover:text-purple-700 underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'real' ? 'Resetando...' : 'Resetar para real'}
        </button>
      </CardContent>
    </Card>
  )
}

export default function AssinaturaClient({
  plano,
  assinaturaAtiva,
  trialFim,
  periodoFim,
  stripeStatus,
  cancelAtPeriodEnd,
  temCustomer,
  cicloAtual,
  eTrial,
  isAdmin,
}: {
  plano: 'basico' | 'pro' | null
  assinaturaAtiva: boolean
  trialFim: string | null
  periodoFim: string | null
  stripeStatus: string | null
  cancelAtPeriodEnd: boolean
  temCustomer: boolean
  cicloAtual: Ciclo
  eTrial: boolean
  isAdmin: boolean
}) {
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [loadingUpgrade, setLoadingUpgrade] = useState(false)

  const {
    cupomAberto, setCupomAberto,
    cupomInput, onCupomInputChange,
    cupomStatus, cupomAplicado, desconto,
    aplicarCupom, marcarCupomInvalido,
  } = useCupom()

  const info = plano ? PLANO_INFO[plano] : null
  const PlanIcon = info?.icon ?? CreditCard
  const emTrial = stripeStatus === 'trialing'
  const dataChave = emTrial ? trialFim : periodoFim

  async function abrirPortal() {
    setLoadingPortal(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao abrir portal'); return }
      window.location.href = data.url
    } catch {
      toast.error('Erro de conexão')
      setLoadingPortal(false)
    }
  }

  async function fazerUpgrade() {
    setLoadingUpgrade(true)
    try {
      if (!stripeStatus) {
        // Sem assinatura Stripe ativa: cria checkout Pro direto sem trial
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plano: 'pro', ciclo: cicloAtual, ...(cupomAplicado ? { cupom: cupomAplicado } : {}) }),
        })
        const data = await res.json()
        if (!res.ok) {
          if (data.tipo === 'cupom') { marcarCupomInvalido(); toast.error('Cupom inválido ou expirado') }
          else { toast.error(data.error ?? 'Erro ao iniciar pagamento') }
          setLoadingUpgrade(false)
          return
        }
        window.location.href = data.url
        return
      }
      const res = await fetch('/api/stripe/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cupomAplicado ? { cupom: cupomAplicado } : {}),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.tipo === 'cupom') { marcarCupomInvalido(); toast.error('Cupom inválido ou expirado') }
        else { toast.error(data.error ?? 'Erro ao fazer upgrade') }
        setLoadingUpgrade(false)
        return
      }
      toast.success('Upgrade realizado! Bem-vinda ao Plano Pro 🎉')
      window.location.reload()
    } catch {
      toast.error('Erro de conexão')
      setLoadingUpgrade(false)
    }
  }

  const renovacaoLabel = cancelAtPeriodEnd
    ? 'Acesso até'
    : cicloAtual === 'anual'
      ? 'Renovação anual em'
      : 'Próxima cobrança'

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <CreditCard className="w-6 h-6 text-rose-400" />
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Assinatura</h1>
      </div>

      {isAdmin && <SimuladorPlanoAdmin plano={plano} eTrial={eTrial} />}

      {/* Card do plano atual */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
                <PlanIcon className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <CardTitle className="text-base">{info?.nome ?? 'Sem plano'}</CardTitle>
                <p className="text-sm text-gray-400">
                  {info ? info.precos[cicloAtual] : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Badge de ciclo */}
              {info && assinaturaAtiva && (
                <Badge variant={cicloAtual === 'anual' ? 'success' : 'default'}>
                  {cicloAtual === 'anual' ? 'Plano Anual' : 'Plano Mensal'}
                </Badge>
              )}
              <StatusBadge status={stripeStatus} cancelAtPeriodEnd={cancelAtPeriodEnd} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cancelAtPeriodEnd && dataChave && (
              <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 sm:col-span-2">
                <p className="text-xs text-red-500 font-medium mb-0.5">{renovacaoLabel}</p>
                <p className="text-sm font-semibold text-red-800">{formatData(dataChave)}</p>
                <p className="text-xs text-red-500 mt-0.5">
                  Seu acesso continua até {formatData(dataChave)} — sem renovação automática
                </p>
              </div>
            )}
            {!cancelAtPeriodEnd && emTrial && dataChave && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-amber-600 font-medium mb-0.5">Trial gratuito termina em</p>
                <p className="text-sm font-semibold text-amber-800">{formatData(dataChave)}</p>
                <p className="text-xs text-amber-500 mt-0.5">Você será cobrada automaticamente</p>
              </div>
            )}
            {!cancelAtPeriodEnd && !emTrial && dataChave && (
              <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-500 font-medium mb-0.5">{renovacaoLabel}</p>
                <p className="text-sm font-semibold text-gray-800">{formatData(dataChave)}</p>
                {cicloAtual === 'anual' && (
                  <p className="text-xs text-emerald-600 mt-0.5">Cobrança anual — 20% de economia</p>
                )}
              </div>
            )}
          </div>

          {/* Features do plano atual */}
          {info && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                O que está incluso
              </p>
              <ul className="space-y-2">
                {info.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 text-emerald-600" strokeWidth={3} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ações */}
          {temCustomer && (
            <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-3">
              {(eTrial || !stripeStatus) ? (
                <Button
                  variant="outline"
                  onClick={() => { window.location.href = '/planos' }}
                  className="gap-2"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Escolher plano
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={abrirPortal}
                  loading={loadingPortal}
                  className="gap-2"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Gerenciar assinatura
                </Button>
              )}
              <p className="text-xs text-gray-400 self-center">
                {(eTrial || !stripeStatus)
                  ? 'Inicie sua assinatura'
                  : cancelAtPeriodEnd
                    ? 'Reative sua assinatura ou veja faturas'
                    : 'Ver faturas, atualizar cartão e cancelar'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card de upgrade — só no Básico */}
      {plano === 'basico' && assinaturaAtiva && (
        <Card className="border-rose-100 bg-rose-50/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-rose-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 mb-1">
                  Faça upgrade para o Plano Pro{cicloAtual === 'anual' ? ' Anual' : ''}
                </h3>
                <p className="text-sm text-gray-500 mb-1 flex items-baseline gap-1.5">
                  {cupomStatus === 'ok' ? (
                    <>
                      <span className="line-through text-gray-400">{UPGRADE_PRO[cicloAtual].valor}</span>
                      <span className="font-semibold text-emerald-600">{precoComDesconto(UPGRADE_PRO[cicloAtual].valor, desconto)}</span>
                    </>
                  ) : (
                    <span>{UPGRADE_PRO[cicloAtual].valor}</span>
                  )}
                  <span>{UPGRADE_PRO[cicloAtual].sufixo}</span>
                  {UPGRADE_PRO[cicloAtual].equivalente && cupomStatus !== 'ok' && (
                    <span>· {UPGRADE_PRO[cicloAtual].equivalente}</span>
                  )}
                  <span>· {UPGRADE_PRO[cicloAtual].label}</span>
                </p>
                <ul className="space-y-1.5 mb-4">
                  {['Profissionais ilimitadas', 'Galeria de fotos e vídeos', 'Suporte prioritário'].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Cupom de desconto */}
                <div className="mb-4">
                  {!cupomAberto ? (
                    <button
                      onClick={() => setCupomAberto(true)}
                      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      Tem um cupom?
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
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

                <Button
                  onClick={fazerUpgrade}
                  loading={loadingUpgrade}
                  size="sm"
                  className="gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Fazer upgrade agora
                </Button>
                <p className="text-xs text-gray-400 mt-2">
                  Cobrança proporcional ao período restante. Sem novo trial.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aviso sem assinatura */}
      {!assinaturaAtiva && (
        <Card className="border-amber-100">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Sem assinatura ativa</p>
                <p className="text-sm text-gray-500 mt-1">
                  Escolha um plano para continuar usando o BelleBook.
                </p>
                <Link
                  href="/planos"
                  className="inline-block mt-3 text-sm font-semibold text-rose-500 hover:text-rose-600 transition-colors"
                >
                  Ver planos →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formas de pagamento */}
      <p className="text-center text-xs text-gray-400">
        💳 Aceitamos: Cartão de crédito, Boleto e Apple/Google Pay
      </p>
    </div>
  )
}
