'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Gift, Loader2, Mail, Phone, ExternalLink, Calendar, Users, Scissors, Clock, Sparkles, UserMinus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminNav } from '@/components/admin/AdminNav'
import toast from 'react-hot-toast'

type PrestadoraDetalhe = {
  id: string
  nome: string
  email: string
  telefone: string | null
  slug: string
  created_at: string
  plano: string | null
  assinatura_ativa: boolean
  trial_fim: string | null
  e_trial: boolean
  last_seen_at: string | null
  mp_metodo_pagamento: string | null
  e_parceira: boolean
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

function statusInfo(p: PrestadoraDetalhe): { label: string; variant: 'success' | 'default' | 'warning' } {
  const now = new Date()
  if (p.e_trial && p.assinatura_ativa && p.trial_fim && new Date(p.trial_fim) > now) {
    return { label: 'Trial ativo', variant: 'warning' }
  }
  if (!p.e_trial && p.assinatura_ativa) {
    return { label: p.plano === 'pro' ? 'Pro ativo' : 'Básico ativo', variant: 'success' }
  }
  return { label: 'Sem plano / expirado', variant: 'default' }
}

function diasRestantesTrial(p: PrestadoraDetalhe): number | null {
  if (!(p.e_trial && p.assinatura_ativa && p.trial_fim)) return null
  const dias = Math.ceil((new Date(p.trial_fim).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  return Math.max(0, dias)
}

function formatUltimoAcesso(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Nunca acessou'
  const online = Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS
  if (online) return 'Online agora'
  return new Date(lastSeenAt).toLocaleString('pt-BR')
}

export default function PrestadoraDetalheClient({
  prestadora,
  totalAgendamentos,
  totalClientes,
  totalServicos,
}: {
  prestadora: PrestadoraDetalhe
  totalAgendamentos: number
  totalClientes: number
  totalServicos: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<'gratis' | 'pro' | null>(null)
  const [confirmandoCargo, setConfirmandoCargo] = useState(false)
  const [processandoCargo, setProcessandoCargo] = useState(false)

  const { label: statusLabel, variant: statusVariant } = statusInfo(prestadora)
  const dias = diasRestantesTrial(prestadora)
  const [online] = useState(
    () => Date.now() - new Date(prestadora.last_seen_at ?? 0).getTime() < ONLINE_THRESHOLD_MS
  )

  async function darBeneficio(tipo: 'gratis' | 'pro') {
    setLoading(tipo)
    try {
      const endpoint = tipo === 'pro' ? '/api/admin/dar-mes-pro' : '/api/admin/dar-mes-gratis'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prestadora_id: prestadora.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao processar')
        return
      }
      toast.success(tipo === 'pro' ? '30 dias de Plano Pro concedidos!' : '30 dias grátis concedidos!')
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  async function alternarCargoParceira() {
    setProcessandoCargo(true)
    try {
      const acao = prestadora.e_parceira ? 'remover' : 'dar'
      const res = await fetch(`/api/admin/parceiras/${prestadora.id}/cargo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao processar')
        return
      }
      toast.success(acao === 'dar' ? 'Cargo de parceira concedido!' : 'Cargo de parceira removido.')
      setConfirmandoCargo(false)
      router.refresh()
    } finally {
      setProcessandoCargo(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-10 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-serif text-xl font-bold text-rose-400">BelleBook</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-semibold text-gray-700">Painel Admin</span>
        </div>
        <AdminNav />
        <Link
          href="/admin"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
      </header>

      <main className="max-w-4xl mx-auto p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${online ? 'bg-emerald-500' : 'bg-gray-300'}`} />
          <h1 className="text-2xl font-bold text-gray-900">{prestadora.nome}</h1>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados de contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              {prestadora.email}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              {prestadora.telefone ?? '—'}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
              <a
                href={`/n/${prestadora.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-500 hover:text-rose-700 hover:underline"
              >
                /n/{prestadora.slug}
              </a>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              Conta criada em {new Date(prestadora.created_at).toLocaleDateString('pt-BR')}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              Último acesso: {formatUltimoAcesso(prestadora.last_seen_at)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plano</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Plano atual</p>
              <p className="font-medium text-gray-900 capitalize">{prestadora.plano ?? '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-0.5">Status</p>
              <Badge variant={statusVariant}>{statusLabel}</Badge>
            </div>
            {dias !== null && (
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Dias restantes do trial</p>
                <p className="font-medium text-gray-900">{dias}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Agendamentos</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{totalAgendamentos}</p>
              </div>
              <Calendar className="w-5 h-5 text-gray-400" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Clientes</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{totalClientes}</p>
              </div>
              <Users className="w-5 h-5 text-gray-400" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Serviços</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{totalServicos}</p>
              </div>
              <Scissors className="w-5 h-5 text-gray-400" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ações</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" disabled={!!loading} onClick={() => darBeneficio('gratis')}>
              {loading === 'gratis' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
              Dar 30 dias grátis
            </Button>
            <Button variant="outline" disabled={!!loading} onClick={() => darBeneficio('pro')}>
              {loading === 'pro' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
              Dar Pro
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parceira</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between flex-wrap gap-3">
            {prestadora.e_parceira ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="pink" className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Parceira
                  </Badge>
                  <Link href={`/admin/parceiras/${prestadora.id}`} className="text-sm text-rose-500 hover:text-rose-700 hover:underline">
                    Ver relatório de parceira
                  </Link>
                </div>
                <Button variant="outline" size="sm" onClick={() => setConfirmandoCargo(true)}>
                  <UserMinus className="w-4 h-4" />
                  Remover cargo
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">Essa prestadora ainda não é parceira.</p>
                <Button variant="outline" size="sm" onClick={() => setConfirmandoCargo(true)}>
                  <Sparkles className="w-4 h-4" />
                  Tornar parceira
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {confirmandoCargo && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-rose-400" />
              </div>
              <button onClick={() => setConfirmandoCargo(false)} disabled={processandoCargo} className="text-gray-400 hover:text-gray-600 disabled:opacity-40">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {prestadora.e_parceira ? 'Remover cargo de parceira?' : 'Tornar parceira?'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {prestadora.e_parceira
                  ? `${prestadora.nome} volta pro Plano Básico e perde acesso ao relatório de parceira. Comissões já geradas continuam valendo.`
                  : `${prestadora.nome} ganha Plano Pro grátis (assinatura paga ativa, se houver, será cancelada) e passa a receber comissão sobre as indicadas dela.`}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmandoCargo(false)} disabled={processandoCargo}>
                Cancelar
              </Button>
              <Button
                variant={prestadora.e_parceira ? 'danger' : 'primary'}
                className="flex-1"
                onClick={alternarCargoParceira}
                disabled={processandoCargo}
              >
                {processandoCargo ? <Loader2 className="w-4 h-4 animate-spin" /> : (prestadora.e_parceira ? 'Remover cargo' : 'Tornar parceira')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
