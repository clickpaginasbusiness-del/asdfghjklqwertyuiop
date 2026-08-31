'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CreditCard, Check, Zap, Sparkles, AlertCircle, ArrowUpRight, FlaskConical, QrCode, Landmark } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { PRECOS, formatarPrecoInteiro, mensalEquivalenteFormatado, type Plano } from '@/lib/precos'
import { ehStudio } from '@/lib/plano'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Ciclo = 'mensal' | 'anual'
type Metodo = 'cartao' | 'pix' | 'debito'

// Preços derivados de @/lib/precos, nunca duplicados aqui de novo (mesma
// causa da divergência que já aconteceu com o preço do Start antes de
// centralizar a fonte).
function precoAnualLabel(plano: Plano): string {
  return `${formatarPrecoInteiro(PRECOS[plano].anual)}/ano · ${mensalEquivalenteFormatado(PRECOS[plano].anual)}/mês`
}

const PLANO_INFO: Record<Plano, { nome: string; precos: Record<Ciclo, string>; icon: typeof Zap; features: string[] }> = {
  start: {
    nome: 'Plano Start',
    precos: { mensal: `${formatarPrecoInteiro(PRECOS.start.mensal)}/mês`, anual: precoAnualLabel('start') },
    icon: Zap,
    features: [
      'Agendamentos ilimitados',
      'Página pública de agendamento',
      'Gestão de clientes',
      'Notificações por WhatsApp',
      '1 profissional cadastrada',
      'Galeria de trabalhos (4 fotos)',
    ],
  },
  pro: {
    nome: 'Plano Pro',
    precos: { mensal: `${formatarPrecoInteiro(PRECOS.pro.mensal)}/mês`, anual: precoAnualLabel('pro') },
    icon: Sparkles,
    features: [
      'Tudo do Plano Start',
      'Até 3 profissionais',
      'Galeria de trabalhos e do estabelecimento (8 fotos cada)',
      'Relatórios completos',
      'Suporte prioritário',
    ],
  },
  studio: {
    nome: 'Plano Studio',
    precos: { mensal: `${formatarPrecoInteiro(PRECOS.studio.mensal)}/mês`, anual: precoAnualLabel('studio') },
    icon: Sparkles,
    features: [
      'Tudo do Plano Pro',
      'Profissionais ilimitadas',
      'Fotos ilimitadas',
      'Presets de página',
    ],
  },
}

const METODO_LABEL: Record<Metodo, string> = {
  cartao: 'Cartão de crédito',
  pix: 'Pix',
  debito: 'Cartão de débito',
}

const METODO_ICON: Record<Metodo, typeof CreditCard> = {
  cartao: CreditCard,
  pix: QrCode,
  debito: Landmark,
}

function formatData(iso: string | null): string {
  if (!iso) return '—'
  return format(parseISO(iso), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

function StatusBadge({ assinaturaAtiva, eTrial, cancelamentoAgendado }: { assinaturaAtiva: boolean; eTrial: boolean; cancelamentoAgendado: boolean }) {
  if (cancelamentoAgendado) return <Badge variant="danger">Cancelado</Badge>
  if (!assinaturaAtiva) return <Badge variant="default">Sem assinatura</Badge>
  if (eTrial) return <Badge variant="pink">Trial gratuito</Badge>
  return <Badge variant="success">Ativo</Badge>
}

type EstadoSimulado = 'trial' | Plano

const ESTADO_LABEL: Record<EstadoSimulado, string> = {
  trial: 'Trial',
  start: 'Start',
  pro: 'Pro',
  studio: 'Studio',
}

const ESTADOS_SIMULADOS: EstadoSimulado[] = ['trial', 'start', 'pro', 'studio']

function estadoSimuladoAtual(plano: Plano | null, eTrial: boolean): EstadoSimulado | null {
  if (eTrial && plano === 'start') return 'trial'
  if (!eTrial && plano) return plano
  return null
}

/**
 * Ferramenta de QA visível só pra conta admin — troca plano/trial direto no
 * banco (sem mexer no Mercado Pago de verdade) pra testar os estados da
 * página e os gates de feature sem precisar de contas de teste separadas.
 */
function SimuladorPlanoAdmin({ plano, eTrial }: { plano: Plano | null; eTrial: boolean }) {
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
      toast.success(estado === 'real' ? 'Resetado para o status real do Mercado Pago' : `Simulando: ${ESTADO_LABEL[estado]}`)
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
          Simula o plano só no banco — não mexe na assinatura real do Mercado Pago.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Estado de plano simulado">
          {ESTADOS_SIMULADOS.map((estado) => (
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
          Simulando agora: <strong className="text-gray-700">{atual ? ESTADO_LABEL[atual] : 'nenhum dos estados (estado real ou personalizado)'}</strong>
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
  metodoPagamento,
  cicloAtual,
  cancelamentoAgendado,
  linkPagamentoPendente,
  eTrial,
  eParceira,
  isAdmin,
}: {
  plano: Plano | null
  assinaturaAtiva: boolean
  trialFim: string | null
  periodoFim: string | null
  metodoPagamento: Metodo | null
  cicloAtual: Ciclo
  cancelamentoAgendado: boolean
  linkPagamentoPendente: string | null
  eTrial: boolean
  eParceira: boolean
  isAdmin: boolean
}) {
  const [loadingCancelar, setLoadingCancelar] = useState(false)

  const info = plano ? PLANO_INFO[plano] : null
  const PlanIcon = info?.icon ?? CreditCard
  const dataChave = eTrial ? trialFim : periodoFim
  const temMetodoPago = assinaturaAtiva && !eTrial && metodoPagamento !== null

  async function cancelarAssinatura() {
    setLoadingCancelar(true)
    try {
      const res = await fetch('/api/mp/cancelar-assinatura', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao cancelar'); return }
      toast.success('Assinatura cancelada — seu acesso continua até o fim do período pago.')
      window.location.reload()
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setLoadingCancelar(false)
    }
  }

  const renovacaoLabel = cancelamentoAgendado
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

      {linkPagamentoPendente && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">Pagamento pendente</p>
            <p className="text-xs text-amber-600">Sua cobrança deste mês ainda não foi paga.</p>
          </div>
          <a href={linkPagamentoPendente} target="_blank" rel="noopener noreferrer">
            <Button size="sm">Pagar agora</Button>
          </a>
        </div>
      )}

      {/* Parceira: acesso Pro gratuito por cargo — sem nada de assinatura/cobrança real */}
      {eParceira ? (
        <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">Você tem acesso Pro como parceira BelleBook</h2>
                <p className="text-sm text-gray-600">
                  Profissionais ilimitadas, galeria de fotos e vídeos e suporte prioritário — liberados como
                  benefício do programa de parceiras, sem nenhuma cobrança.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
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
              {info && assinaturaAtiva && (
                <Badge variant={cicloAtual === 'anual' ? 'success' : 'default'}>
                  {cicloAtual === 'anual' ? 'Plano Anual' : 'Plano Mensal'}
                </Badge>
              )}
              <StatusBadge assinaturaAtiva={assinaturaAtiva} eTrial={eTrial} cancelamentoAgendado={cancelamentoAgendado} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Método de pagamento */}
          {temMetodoPago && metodoPagamento && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {(() => { const Icone = METODO_ICON[metodoPagamento]; return <Icone className="w-4 h-4 text-gray-400" /> })()}
              Pagamento via {METODO_LABEL[metodoPagamento]}
            </div>
          )}

          {/* Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cancelamentoAgendado && dataChave && (
              <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 sm:col-span-2">
                <p className="text-xs text-red-500 font-medium mb-0.5">{renovacaoLabel}</p>
                <p className="text-sm font-semibold text-red-800">{formatData(dataChave)}</p>
                <p className="text-xs text-red-500 mt-0.5">
                  Seu acesso continua até {formatData(dataChave)} — sem renovação automática
                </p>
              </div>
            )}
            {!cancelamentoAgendado && eTrial && dataChave && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                <p className="text-xs text-amber-600 font-medium mb-0.5">Trial gratuito termina em</p>
                <p className="text-sm font-semibold text-amber-800">{formatData(dataChave)}</p>
                <p className="text-xs text-amber-500 mt-0.5">Você será cobrada automaticamente</p>
              </div>
            )}
            {!cancelamentoAgendado && !eTrial && dataChave && (
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
          <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-3">
            {(eTrial || !assinaturaAtiva) ? (
              <Button
                variant="outline"
                onClick={() => { window.location.href = '/planos' }}
                className="gap-2"
              >
                <ArrowUpRight className="w-4 h-4" />
                Escolher plano
              </Button>
            ) : cancelamentoAgendado ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => { window.location.href = '/planos' }}
                  className="gap-2"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Assinar novamente
                </Button>
                <p className="text-xs text-gray-400 self-center">Reative antes do fim do período pra não perder o acesso</p>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={cancelarAssinatura}
                  loading={loadingCancelar}
                  className="gap-2"
                >
                  Cancelar assinatura
                </Button>
                <p className="text-xs text-gray-400 self-center">Seu acesso continua até o fim do período já pago</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Card de upgrade — qualquer plano abaixo do topo de linha */}
      {!eParceira && plano && !ehStudio(plano) && assinaturaAtiva && !eTrial && !cancelamentoAgendado && (
        <Card className="border-rose-100 bg-rose-50/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-rose-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 mb-1">
                  Quer mais recursos?
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Mais profissionais, mais fotos na página pública e relatórios completos nos planos Pro e Studio.
                </p>
                <Link href="/planos">
                  <Button size="sm" className="gap-2">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    Ver planos
                  </Button>
                </Link>
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
      {!eParceira && (
        <p className="text-center text-xs text-gray-400">
          💳 Aceitamos Pix, cartão de crédito e cartão de débito via Mercado Pago
        </p>
      )}
    </div>
  )
}
