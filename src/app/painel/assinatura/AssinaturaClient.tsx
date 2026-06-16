'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CreditCard, Check, Zap, Sparkles, AlertCircle, RefreshCw, ArrowUpRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  mensal: { preco: 'R$89/mês', label: 'Profissionais ilimitadas + Galeria de fotos e vídeos' },
  anual:  { preco: 'R$855/ano · R$71/mês', label: 'Profissionais ilimitadas + Galeria — no ciclo anual' },
}

function formatData(iso: string | null): string {
  if (!iso) return '—'
  return format(parseISO(iso), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

function StatusBadge({ status, cancelAtPeriodEnd }: { status: string | null; cancelAtPeriodEnd: boolean }) {
  if (cancelAtPeriodEnd) return <Badge variant="danger">Cancela no fim do período</Badge>
  if (status === 'trialing')  return <Badge variant="pink">Trial gratuito</Badge>
  if (status === 'active')    return <Badge variant="success">Ativo</Badge>
  if (status === 'past_due')  return <Badge variant="danger">Pagamento pendente</Badge>
  if (status === 'canceled')  return <Badge variant="default">Cancelado</Badge>
  return <Badge variant="default">—</Badge>
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
}) {
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [loadingUpgrade, setLoadingUpgrade] = useState(false)

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
          body: JSON.stringify({ plano: 'pro', ciclo: cicloAtual }),
        })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error ?? 'Erro ao iniciar pagamento'); setLoadingUpgrade(false); return }
        window.location.href = data.url
        return
      }
      const res = await fetch('/api/stripe/upgrade', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao fazer upgrade'); setLoadingUpgrade(false); return }
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
            {emTrial && dataChave && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-amber-600 font-medium mb-0.5">Trial gratuito termina em</p>
                <p className="text-sm font-semibold text-amber-800">{formatData(dataChave)}</p>
                <p className="text-xs text-amber-500 mt-0.5">Você será cobrada automaticamente</p>
              </div>
            )}
            {!emTrial && dataChave && (
              <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-gray-500 font-medium mb-0.5">{renovacaoLabel}</p>
                <p className="text-sm font-semibold text-gray-800">{formatData(dataChave)}</p>
                {cicloAtual === 'anual' && !cancelAtPeriodEnd && (
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
                {(eTrial || !stripeStatus) ? 'Inicie sua assinatura' : 'Ver faturas, atualizar cartão e cancelar'}
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
                <p className="text-sm text-gray-500 mb-3">
                  {UPGRADE_PRO[cicloAtual].preco} · {UPGRADE_PRO[cicloAtual].label}
                </p>
                <ul className="space-y-1.5 mb-4">
                  {['Profissionais ilimitadas', 'Galeria de fotos e vídeos', 'Suporte prioritário'].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
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
                  Escolha um plano para continuar usando o NailBook.
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
    </div>
  )
}
