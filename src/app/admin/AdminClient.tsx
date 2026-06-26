'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Gift, TrendingUp, Users, Zap, DollarSign, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import toast from 'react-hot-toast'

type PrestadoraRow = {
  id: string
  nome: string
  email: string
  plano: string | null
  assinatura_ativa: boolean
  trial_fim: string | null
  e_trial: boolean
  created_at: string
  stripe_customer_id: string | null
}

type Metrics = {
  total: number
  emTrialAtivo: number
  pagasBasico: number
  pagasPro: number
  semPlanOuExpirado: number
  receitaEstimada: number
}

type ChartDay = { date: string; count: number }

function statusLabel(p: PrestadoraRow): { label: string; color: string } {
  const now = new Date()
  if (p.e_trial && p.assinatura_ativa && p.trial_fim && new Date(p.trial_fim) > now) {
    return { label: 'Trial ativo', color: 'bg-blue-100 text-blue-700' }
  }
  if (!p.e_trial && p.assinatura_ativa) {
    return { label: p.plano === 'pro' ? 'Pro ativo' : 'Básico ativo', color: 'bg-emerald-100 text-emerald-700' }
  }
  return { label: 'Sem plano / expirado', color: 'bg-gray-100 text-gray-500' }
}

export default function AdminClient({
  prestadoras,
  metrics,
  chartData,
}: {
  prestadoras: PrestadoraRow[]
  metrics: Metrics
  chartData: ChartDay[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState('')

  const maxCount = Math.max(...chartData.map(d => d.count), 1)

  const selectedPrestadora = prestadoras.find(p => p.id === selectedId)

  async function darMesGratis() {
    if (!selectedId) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/dar-mes-gratis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prestadora_id: selectedId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao processar')
        return
      }
      toast.success(`1 mês grátis concedido para ${selectedPrestadora?.nome}!`)
      setSelectedId(null)
    } finally {
      setLoading(false)
    }
  }

  const filtradas = busca.trim()
    ? prestadoras.filter(p =>
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.email.toLowerCase().includes(busca.toLowerCase())
      )
    : prestadoras

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="font-serif text-xl font-bold text-rose-400">BelleBook</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-semibold text-gray-700">Painel Admin</span>
        </div>
        <Link
          href="/painel"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao painel
        </Link>
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total prestadoras</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{metrics.total}</p>
                </div>
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-gray-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Em trial ativo</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{metrics.emTrialAtivo}</p>
                </div>
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pagas (básico + pro)</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">
                    {metrics.pagasBasico + metrics.pagasPro}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {metrics.pagasBasico} básico · {metrics.pagasPro} pro
                  </p>
                </div>
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Receita estimada</p>
                  <p className="text-3xl font-bold text-rose-500 mt-1">
                    R${metrics.receitaEstimada.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">por mês (planos ativos)</p>
                </div>
                <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-rose-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Novos cadastros — últimos 30 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[2px] h-36">
              {chartData.map((day) => {
                const pct = maxCount > 0 ? (day.count / maxCount) * 100 : 0
                return (
                  <div
                    key={day.date}
                    title={`${day.date.slice(5).replace('-', '/')}: ${day.count} cadastro${day.count !== 1 ? 's' : ''}`}
                    className="flex-1 rounded-t cursor-default transition-colors hover:opacity-80"
                    style={{
                      height: `${Math.max(pct, day.count > 0 ? 3 : 1)}%`,
                      minHeight: '2px',
                      backgroundColor: day.count > 0 ? '#fda4af' : '#f3f4f6',
                    }}
                  />
                )
              })}
            </div>
            <div className="flex mt-1.5">
              {chartData.map((day, i) => (
                <div key={day.date} className="flex-1 text-[9px] text-gray-400 text-center">
                  {i % 7 === 0 ? day.date.slice(5).replace('-', '/') : ''}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
              <span>Pico: {Math.max(...chartData.map(d => d.count))} cadastros/dia</span>
              <span>Últimos 30 dias: {chartData.reduce((s, d) => s + d.count, 0)} total</span>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle>Todas as prestadoras ({prestadoras.length})</CardTitle>
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome ou email..."
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 w-64"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                    <th className="pb-3 pr-4 font-medium">Nome</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Plano</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">Cadastro</th>
                    <th className="pb-3 pr-4 font-medium">Trial fim</th>
                    <th className="pb-3 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtradas.map(p => {
                    const { label, color } = statusLabel(p)
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-4 font-medium text-gray-900 whitespace-nowrap">{p.nome}</td>
                        <td className="py-3 pr-4 text-gray-500">{p.email}</td>
                        <td className="py-3 pr-4 text-gray-600 capitalize">{p.plano ?? '—'}</td>
                        <td className="py-3 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>
                        </td>
                        <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">
                          {new Date(p.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">
                          {p.trial_fim ? new Date(p.trial_fim).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => setSelectedId(p.id)}
                            className="flex items-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-700 transition-colors whitespace-nowrap"
                          >
                            <Gift className="w-3.5 h-3.5" />
                            1 mês grátis
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {filtradas.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">
                        Nenhuma prestadora encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Modal dar 1 mês grátis */}
      {selectedId && selectedPrestadora && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                <Gift className="w-5 h-5 text-rose-400" />
              </div>
              <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Dar 1 mês grátis</h3>
              <p className="text-sm text-gray-500 mt-1">
                Confirma para <span className="font-medium text-gray-800">{selectedPrestadora.nome}</span>?
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {selectedPrestadora.assinatura_ativa && !selectedPrestadora.e_trial && selectedPrestadora.stripe_customer_id
                  ? `Crédito de R$${selectedPrestadora.plano === 'pro' ? '89' : '49'} será adicionado no Stripe.`
                  : selectedPrestadora.e_trial && selectedPrestadora.trial_fim
                  ? 'Trial será estendido por 30 dias.'
                  : 'Trial gratuito de 30 dias será liberado.'}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedId(null)}>
                Cancelar
              </Button>
              <Button className="flex-1" loading={loading} onClick={darMesGratis}>
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
