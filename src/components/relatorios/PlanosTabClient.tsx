'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDateShort, maskTelefone } from '@/lib/utils'
import { Users, DollarSign, Tag, ChevronDown, ChevronUp, Trash2, MinusCircle } from 'lucide-react'
import type { ResumoPlanos, CreditoServico } from '@/lib/planosPrestadora'
import toast from 'react-hot-toast'

type AssinanteLinha = {
  id: string
  status: 'ativa' | 'cancelada' | 'suspensa'
  creditos_restantes: number
  creditos_totais: number
  periodo_fim: string | null
  clientes: { nome: string; telefone: string | null } | null
  creditosPorServico: CreditoServico[]
}

export function PlanosTabClient({ resumo }: { resumo: ResumoPlanos }) {
  const [expandido, setExpandido] = useState<string | null>(null)
  const [assinantesPorPlano, setAssinantesPorPlano] = useState<Record<string, AssinanteLinha[]>>({})
  const [carregando, setCarregando] = useState<string | null>(null)
  const [descontarId, setDescontarId] = useState<string | null>(null)
  const [descricaoDesconto, setDescricaoDesconto] = useState('')
  const [servicoDesconto, setServicoDesconto] = useState('')
  const [salvandoDesconto, setSalvandoDesconto] = useState(false)

  async function toggleExpandir(planoId: string) {
    if (expandido === planoId) { setExpandido(null); return }
    setExpandido(planoId)
    if (!assinantesPorPlano[planoId]) {
      setCarregando(planoId)
      const res = await fetch(`/api/planos/${planoId}/assinantes`)
      const data = await res.json()
      if (res.ok) setAssinantesPorPlano((prev) => ({ ...prev, [planoId]: data.assinaturas }))
      setCarregando(null)
    }
  }

  async function cancelarAssinatura(assinaturaId: string, planoId: string) {
    const res = await fetch(`/api/planos/assinaturas/${assinaturaId}/cancelar`, { method: 'POST' })
    if (!res.ok) { toast.error('Erro ao cancelar assinatura'); return }
    setAssinantesPorPlano((prev) => ({
      ...prev,
      [planoId]: prev[planoId].map((a) => a.id === assinaturaId ? { ...a, status: 'cancelada' } : a),
    }))
    toast.success('Assinatura cancelada')
  }

  async function confirmarDesconto(planoId: string) {
    if (!descontarId || !descricaoDesconto.trim()) { toast.error('Informe uma descrição'); return }
    if (!servicoDesconto) { toast.error('Selecione o serviço'); return }
    setSalvandoDesconto(true)
    const res = await fetch(`/api/planos/assinaturas/${descontarId}/descontar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descricao: descricaoDesconto, servicoId: servicoDesconto }),
    })
    const data = await res.json()
    setSalvandoDesconto(false)
    if (!res.ok) { toast.error(data.error ?? 'Erro ao descontar uso'); return }
    setAssinantesPorPlano((prev) => ({
      ...prev,
      [planoId]: prev[planoId].map((a) => a.id !== descontarId ? a : {
        ...a,
        creditos_restantes: Math.max(0, a.creditos_restantes - 1),
        creditosPorServico: a.creditosPorServico.map((cs) => cs.servicoId !== servicoDesconto ? cs : {
          ...cs, usados: cs.usados + 1, restantes: Math.max(0, cs.restantes - 1),
        }),
      }),
    }))
    toast.success('Uso descontado')
    setDescontarId(null)
    setDescricaoDesconto('')
    setServicoDesconto('')
  }

  const assinanteEmDesconto = Object.values(assinantesPorPlano).flat().find((a) => a.id === descontarId)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="bg-emerald-50 p-2.5 rounded-xl w-fit mb-4"><Users className="w-5 h-5 text-emerald-500" /></div>
            <p className="text-3xl font-bold text-gray-900">{resumo.totalAssinantesAtivos}</p>
            <p className="text-sm text-gray-500 mt-1">Assinantes ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="bg-rose-50 p-2.5 rounded-xl w-fit mb-4"><DollarSign className="w-5 h-5 text-rose-500" /></div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(resumo.receitaMensalEstimada)}</p>
            <p className="text-sm text-gray-500 mt-1">Receita mensal estimada</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="bg-violet-50 p-2.5 rounded-xl w-fit mb-4"><Tag className="w-5 h-5 text-violet-500" /></div>
            <p className="text-3xl font-bold text-gray-900">{resumo.planosAtivos}</p>
            <p className="text-sm text-gray-500 mt-1">Planos ativos</p>
          </CardContent>
        </Card>
      </div>

      {resumo.planos.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-16 text-gray-400">
              <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum plano de assinatura criado ainda</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {resumo.planos.map(({ plano, assinantesAtivos, receitaHistorica, creditosUsadosEsseMes }) => (
            <Card key={plano.id}>
              <CardContent className="p-5">
                <button onClick={() => toggleExpandir(plano.id)} className="w-full flex items-center justify-between gap-4 text-left">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{plano.nome}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {assinantesAtivos} assinante{assinantesAtivos !== 1 ? 's' : ''} · {formatCurrency(receitaHistorica)} arrecadado · {creditosUsadosEsseMes} créditos usados esse mês
                    </p>
                  </div>
                  {expandido === plano.id ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>

                {expandido === plano.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                    {carregando === plano.id ? (
                      <p className="text-xs text-gray-400 text-center py-4">Carregando assinantes...</p>
                    ) : (assinantesPorPlano[plano.id]?.length ?? 0) === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">Nenhuma assinante ainda</p>
                    ) : (
                      assinantesPorPlano[plano.id].map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{a.clientes?.nome ?? 'Cliente'}</p>
                            <p className="text-xs text-gray-400">
                              {a.clientes?.telefone ? maskTelefone(a.clientes.telefone) : '—'}
                              {a.periodo_fim && ` · Renova em ${formatDateShort(a.periodo_fim)}`}
                              {a.status !== 'ativa' && ` · ${a.status === 'cancelada' ? 'Cancelada' : 'Suspensa'}`}
                            </p>
                            {a.creditosPorServico.length > 0 ? (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {a.creditosPorServico.map((cs, i) => (
                                  <span key={cs.servicoId}>{i > 0 && ' · '}{cs.restantes}/{cs.quantidadeTotal} {cs.servicoNome}</span>
                                ))}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500 mt-0.5">{a.creditos_restantes}/{a.creditos_totais} créditos</p>
                            )}
                          </div>
                          {a.status === 'ativa' && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => { setDescontarId(a.id); setServicoDesconto(a.creditosPorServico[0]?.servicoId ?? '') }}
                                title="Descontar uso manualmente"
                                className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-amber-50"
                              >
                                <MinusCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => cancelarAssinatura(a.id, plano.id)}
                                title="Cancelar assinatura"
                                className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!descontarId} onClose={() => setDescontarId(null)} title="Descontar uso manualmente">
        <div className="p-6 space-y-4">
          {assinanteEmDesconto && assinanteEmDesconto.creditosPorServico.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Serviço</label>
              <select
                value={servicoDesconto}
                onChange={(e) => setServicoDesconto(e.target.value)}
                className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300"
              >
                {assinanteEmDesconto.creditosPorServico.map((cs) => (
                  <option key={cs.servicoId} value={cs.servicoId}>{cs.servicoNome} ({cs.restantes}/{cs.quantidadeTotal} restantes)</option>
                ))}
              </select>
            </div>
          )}
          <Textarea
            label="Descrição"
            placeholder="Ex: Atendimento combinado por WhatsApp"
            rows={3}
            value={descricaoDesconto}
            onChange={(e) => setDescricaoDesconto(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDescontarId(null)} className="flex-1">Cancelar</Button>
            <Button
              onClick={() => {
                const planoId = resumo.planos.find((p) => assinantesPorPlano[p.plano.id]?.some((a) => a.id === descontarId))?.plano.id
                if (planoId) confirmarDesconto(planoId)
              }}
              loading={salvandoDesconto}
              className="flex-1"
            >
              Descontar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
