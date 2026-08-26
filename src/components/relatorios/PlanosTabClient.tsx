'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDateShort, formatDateTime, maskTelefone } from '@/lib/utils'
import { Users, DollarSign, Tag, ChevronDown, ChevronUp, Trash2, Pencil } from 'lucide-react'
import type { ResumoPlanos, CreditoServico, UsoHistorico } from '@/lib/planosPrestadora'
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

const TIPO_LABEL: Record<UsoHistorico['tipo'], string> = {
  automatico: 'Uso automático (agendamento)',
  manual: 'Desconto manual',
  ajuste: 'Ajuste manual',
}

export function PlanosTabClient({ resumo }: { resumo: ResumoPlanos }) {
  const [expandido, setExpandido] = useState<string | null>(null)
  const [assinantesPorPlano, setAssinantesPorPlano] = useState<Record<string, AssinanteLinha[]>>({})
  const [carregando, setCarregando] = useState<string | null>(null)
  const [editarId, setEditarId] = useState<string | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [observacao, setObservacao] = useState('')
  const [salvandoServico, setSalvandoServico] = useState<string | null>(null)
  const [historico, setHistorico] = useState<UsoHistorico[] | null>(null)
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)

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

  async function carregarHistorico(assinaturaId: string) {
    setCarregandoHistorico(true)
    const res = await fetch(`/api/planos/assinaturas/${assinaturaId}/usos`)
    const data = await res.json()
    setCarregandoHistorico(false)
    if (res.ok) setHistorico(data.usos)
  }

  function abrirEdicao(linha: AssinanteLinha) {
    setEditarId(linha.id)
    setObservacao('')
    const iniciais: Record<string, string> = {}
    if (linha.creditosPorServico.length > 0) {
      for (const cs of linha.creditosPorServico) iniciais[cs.servicoId] = String(cs.restantes)
    } else {
      iniciais.generico = String(linha.creditos_restantes)
    }
    setValores(iniciais)
    setHistorico(null)
    carregarHistorico(linha.id)
  }

  function podeSalvar(chave: string, valorAtual: number): boolean {
    const bruto = valores[chave]
    if (bruto === undefined || bruto === '') return false
    const n = Number(bruto)
    return Number.isInteger(n) && n >= 0 && n !== valorAtual
  }

  async function salvarAjuste(planoId: string, servicoId: string | null, chave: string) {
    if (!editarId) return
    const novoValor = Number(valores[chave])

    setSalvandoServico(chave)
    const res = await fetch(`/api/planos/assinaturas/${editarId}/ajustar-credito`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ servicoId, novoValor, descricao: observacao.trim() || undefined }),
    })
    const data = await res.json()
    setSalvandoServico(null)
    if (!res.ok) { toast.error(data.error ?? 'Erro ao salvar'); return }

    setAssinantesPorPlano((prev) => ({
      ...prev,
      [planoId]: prev[planoId].map((a) => a.id !== editarId ? a : (
        servicoId
          ? {
              ...a,
              creditosPorServico: a.creditosPorServico.map((cs) => cs.servicoId !== servicoId
                ? cs
                : { ...cs, restantes: novoValor, usados: cs.quantidadeTotal - novoValor }),
            }
          : { ...a, creditos_restantes: novoValor }
      )),
    }))
    toast.success('Crédito atualizado')
    carregarHistorico(editarId)
  }

  const assinanteEditando = Object.values(assinantesPorPlano).flat().find((a) => a.id === editarId)
  const planoIdEditando = resumo.planos.find((p) => assinantesPorPlano[p.plano.id]?.some((a) => a.id === editarId))?.plano.id

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
                                onClick={() => abrirEdicao(a)}
                                title="Editar créditos"
                                className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-amber-50"
                              >
                                <Pencil className="w-4 h-4" />
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

      <Modal open={!!editarId} onClose={() => setEditarId(null)} title="Editar créditos">
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {assinanteEditando && (
            <>
              <div className="space-y-2">
                {assinanteEditando.creditosPorServico.length > 0 ? (
                  assinanteEditando.creditosPorServico.map((cs) => (
                    <div key={cs.servicoId} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-700 truncate">{cs.servicoNome}</span>
                      <input
                        type="number"
                        min={0}
                        max={cs.quantidadeTotal}
                        value={valores[cs.servicoId] ?? ''}
                        onChange={(e) => setValores((prev) => ({ ...prev, [cs.servicoId]: e.target.value }))}
                        className="w-16 h-11 rounded-xl border border-gray-200 px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300"
                      />
                      <span className="text-xs text-gray-400 shrink-0">/ {cs.quantidadeTotal}</span>
                      <Button
                        size="sm"
                        onClick={() => planoIdEditando && salvarAjuste(planoIdEditando, cs.servicoId, cs.servicoId)}
                        loading={salvandoServico === cs.servicoId}
                        disabled={!podeSalvar(cs.servicoId, cs.restantes)}
                      >
                        Salvar
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-gray-700">Créditos</span>
                    <input
                      type="number"
                      min={0}
                      max={assinanteEditando.creditos_totais}
                      value={valores.generico ?? ''}
                      onChange={(e) => setValores((prev) => ({ ...prev, generico: e.target.value }))}
                      className="w-16 h-11 rounded-xl border border-gray-200 px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300"
                    />
                    <span className="text-xs text-gray-400 shrink-0">/ {assinanteEditando.creditos_totais}</span>
                    <Button
                      size="sm"
                      onClick={() => planoIdEditando && salvarAjuste(planoIdEditando, null, 'generico')}
                      loading={salvandoServico === 'generico'}
                      disabled={!podeSalvar('generico', assinanteEditando.creditos_restantes)}
                    >
                      Salvar
                    </Button>
                  </div>
                )}
              </div>

              <Textarea
                label="Observação (opcional)"
                placeholder="Ex: correção de erro de digitação"
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />

              <div>
                <p className="text-sm font-medium text-gray-700 mb-1.5">Histórico</p>
                {carregandoHistorico ? (
                  <p className="text-xs text-gray-400">Carregando...</p>
                ) : !historico || historico.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhum uso registrado ainda</p>
                ) : (
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                    {historico.map((u) => (
                      <li key={u.id} className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5">
                        <span className="font-medium text-gray-700">{formatDateTime(u.createdAt)}</span>
                        {' · '}{TIPO_LABEL[u.tipo]}
                        {u.servicoNome && ` · ${u.servicoNome}`}
                        {u.descricao && <div className="mt-0.5 text-gray-400">{u.descricao}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setEditarId(null)}>Fechar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
