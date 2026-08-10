'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, cn } from '@/lib/utils'
import { Plus, Pencil, Trash2, Users, Tag } from 'lucide-react'
import type { ServicoComProfissionais } from './ServicosClient'
import toast from 'react-hot-toast'

type Intervalo = 'mensal' | 'bimensal' | 'trimestral' | 'semestral' | 'anual'

const NOME_INTERVALO: Record<Intervalo, string> = {
  mensal: 'Mensal', bimensal: 'Bimensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual',
}
const SUFIXO_INTERVALO: Record<Intervalo, string> = {
  mensal: '/mês', bimensal: '/2 meses', trimestral: '/3 meses', semestral: '/6 meses', anual: '/ano',
}

export type PlanoServicoLinha = { id: string; servico_id: string; quantidade: number; servicos: { nome: string } | null }
export type PlanoAssinaturaLinha = { id: string; status: 'ativa' | 'cancelada' | 'suspensa' }

export type PlanoComRelacoes = {
  id: string
  nome: string
  descricao: string | null
  preco: number
  intervalo: Intervalo
  desconto_tipo: 'percentual' | 'fixo'
  desconto_valor: number
  creditos_acumulam: boolean
  limite_vagas: number | null
  ativo: boolean
  planos_servicos: PlanoServicoLinha[]
  planos_assinaturas: PlanoAssinaturaLinha[]
}

interface FormServico { servicoId: string; quantidade: string }

interface PlanoForm {
  nome: string
  descricao: string
  preco: string
  intervalo: Intervalo
  descontoTipo: 'percentual' | 'fixo'
  descontoValor: string
  creditosAcumulam: boolean
  limiteVagas: string
  servicos: FormServico[]
}

const emptyForm: PlanoForm = {
  nome: '', descricao: '', preco: '', intervalo: 'mensal',
  descontoTipo: 'percentual', descontoValor: '0', creditosAcumulam: false, limiteVagas: '', servicos: [],
}

export default function PlanosPrestadoraClient({
  planos: initial,
  servicosDisponiveis,
}: {
  planos: PlanoComRelacoes[]
  servicosDisponiveis: ServicoComProfissionais[]
}) {
  const [planos, setPlanos] = useState(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<PlanoForm>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function openCreate() {
    setForm(emptyForm)
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(p: PlanoComRelacoes) {
    setForm({
      nome: p.nome,
      descricao: p.descricao ?? '',
      preco: String(p.preco),
      intervalo: p.intervalo,
      descontoTipo: p.desconto_tipo,
      descontoValor: String(p.desconto_valor),
      creditosAcumulam: p.creditos_acumulam,
      limiteVagas: p.limite_vagas != null ? String(p.limite_vagas) : '',
      servicos: p.planos_servicos.map((ps) => ({ servicoId: ps.servico_id, quantidade: String(ps.quantidade) })),
    })
    setEditId(p.id)
    setModalOpen(true)
  }

  function toggleServico(servicoId: string) {
    setForm((f) => {
      const existe = f.servicos.find((s) => s.servicoId === servicoId)
      if (existe) return { ...f, servicos: f.servicos.filter((s) => s.servicoId !== servicoId) }
      return { ...f, servicos: [...f.servicos, { servicoId, quantidade: '1' }] }
    })
  }

  function setQuantidade(servicoId: string, quantidade: string) {
    setForm((f) => ({
      ...f,
      servicos: f.servicos.map((s) => s.servicoId === servicoId ? { ...s, quantidade } : s),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const preco = parseFloat(form.preco)
    if (!form.nome.trim() || !Number.isFinite(preco) || preco <= 0) {
      toast.error('Preencha nome e preço corretamente')
      return
    }

    setLoading(true)
    const body = {
      nome: form.nome,
      descricao: form.descricao || null,
      preco,
      intervalo: form.intervalo,
      descontoTipo: form.descontoTipo,
      descontoValor: parseFloat(form.descontoValor) || 0,
      creditosAcumulam: form.creditosAcumulam,
      limiteVagas: form.limiteVagas ? parseInt(form.limiteVagas, 10) : null,
      servicos: form.servicos
        .map((s) => ({ servicoId: s.servicoId, quantidade: parseInt(s.quantidade, 10) || 1 }))
        .filter((s) => s.servicoId),
    }

    const res = await fetch(editId ? `/api/planos/${editId}` : '/api/planos', {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      toast.error(data.error ?? 'Erro ao salvar plano')
      return
    }

    const servicosDetalhados = form.servicos.map((s) => ({
      id: s.servicoId, servico_id: s.servicoId, quantidade: parseInt(s.quantidade, 10) || 1,
      servicos: { nome: servicosDisponiveis.find((sv) => sv.id === s.servicoId)?.nome ?? '' },
    }))

    if (editId) {
      setPlanos((prev) => prev.map((p) => p.id === editId ? {
        ...p, nome: body.nome, descricao: body.descricao, preco: body.preco, intervalo: body.intervalo,
        desconto_tipo: body.descontoTipo, desconto_valor: body.descontoValor, creditos_acumulam: body.creditosAcumulam,
        limite_vagas: body.limiteVagas, planos_servicos: servicosDetalhados,
      } : p))
      toast.success('Plano atualizado')
    } else {
      setPlanos((prev) => [{
        id: data.plano.id, nome: body.nome, descricao: body.descricao, preco: body.preco, intervalo: body.intervalo,
        desconto_tipo: body.descontoTipo, desconto_valor: body.descontoValor, creditos_acumulam: body.creditosAcumulam,
        limite_vagas: body.limiteVagas, ativo: true, planos_servicos: servicosDetalhados, planos_assinaturas: [],
      }, ...prev])
      toast.success('Plano criado')
    }
    setModalOpen(false)
  }

  async function toggleAtivo(p: PlanoComRelacoes) {
    const novoAtivo = !p.ativo
    setPlanos((prev) => prev.map((x) => x.id === p.id ? { ...x, ativo: novoAtivo } : x))
    const res = await fetch(`/api/planos/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: novoAtivo }),
    })
    if (!res.ok) {
      setPlanos((prev) => prev.map((x) => x.id === p.id ? { ...x, ativo: p.ativo } : x))
      toast.error('Erro ao atualizar status')
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/planos/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Erro ao excluir plano')
      setDeleteId(null)
      return
    }
    setPlanos((prev) => prev.filter((p) => p.id !== id))
    toast.success('Plano excluído')
    setDeleteId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-gray-900">Planos de assinatura</h2>
          <p className="text-sm text-gray-400 mt-1">Suas clientes assinam e usam créditos pra agendar</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4" />
          Novo Plano
        </Button>
      </div>

      {planos.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-16 text-gray-400">
              <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum plano de assinatura criado</p>
              <Button onClick={openCreate} variant="outline" size="sm" className="mt-4">
                Criar primeiro plano
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {planos.map((p) => {
            const assinantesAtivos = p.planos_assinaturas.filter((a) => a.status === 'ativa').length
            return (
              <Card key={p.id} className={cn('transition-all', !p.ativo && 'opacity-60')}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{p.nome}</h3>
                      <p className="text-lg font-bold text-rose-500 mt-0.5">
                        {formatCurrency(p.preco)}<span className="text-xs font-normal text-gray-400">{SUFIXO_INTERVALO[p.intervalo]}</span>
                      </p>
                    </div>
                    <Switch checked={p.ativo} onChange={() => toggleAtivo(p)} label={p.ativo ? 'Ativo' : 'Inativo'} />
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{assinantesAtivos} assinante{assinantesAtivos !== 1 ? 's' : ''}</span>
                    <span>{p.limite_vagas != null ? `${assinantesAtivos}/${p.limite_vagas} vagas` : 'Vagas ilimitadas'}</span>
                  </div>

                  {p.planos_servicos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.planos_servicos.map((ps) => (
                        <Badge key={ps.id} variant="default">{ps.quantidade}x {ps.servicos?.nome}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button onClick={() => openEdit(p)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button onClick={() => setDeleteId(p.id)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 ml-auto">
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar plano' : 'Novo plano'} className="max-w-lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input label="Nome" placeholder="Ex: Clube da Manicure" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          <Textarea label="Descrição (opcional)" rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Preço (R$)" type="number" min="0" step="0.01" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} required />
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Intervalo</label>
              <select
                value={form.intervalo}
                onChange={(e) => setForm({ ...form, intervalo: e.target.value as Intervalo })}
                className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300"
              >
                {(Object.keys(NOME_INTERVALO) as Intervalo[]).map((i) => (
                  <option key={i} value={i}>{NOME_INTERVALO[i]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Desconto nos serviços do plano</label>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-xl border border-gray-200 p-1 bg-gray-50 shrink-0">
                {(['percentual', 'fixo'] as const).map((t) => (
                  <button
                    key={t} type="button"
                    onClick={() => setForm({ ...form, descontoTipo: t })}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', form.descontoTipo === t ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500')}
                  >
                    {t === 'percentual' ? '%' : 'R$'}
                  </button>
                ))}
              </div>
              <Input type="number" min="0" step="0.01" value={form.descontoValor} onChange={(e) => setForm({ ...form, descontoValor: e.target.value })} className="flex-1" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Serviços incluídos (opcional)</label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-100 rounded-xl p-2">
              {servicosDisponiveis.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">Cadastre serviços primeiro</p>
              ) : servicosDisponiveis.map((s) => {
                const selecionado = form.servicos.find((fs) => fs.servicoId === s.id)
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!selecionado}
                        onChange={() => toggleServico(s.id)}
                        className="rounded border-gray-300 text-rose-400 focus:ring-rose-300 shrink-0"
                      />
                      <span className="text-sm text-gray-700 truncate">{s.nome}</span>
                    </label>
                    {selecionado && (
                      <input
                        type="number"
                        min="1"
                        value={selecionado.quantidade}
                        onChange={(e) => setQuantidade(s.id, e.target.value)}
                        className="w-14 h-8 rounded-lg border border-gray-200 px-2 text-xs text-center shrink-0"
                        title="Quantidade"
                      />
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1">Total de créditos por ciclo = soma das quantidades marcadas</p>
          </div>

          <label className="flex items-center justify-between gap-4 py-1">
            <div>
              <span className="text-sm text-gray-700 block">Créditos acumulam?</span>
              <span className="text-xs text-gray-400">Se não usados, somam com os do próximo ciclo</span>
            </div>
            <Switch checked={form.creditosAcumulam} onChange={(v) => setForm({ ...form, creditosAcumulam: v })} label="Créditos acumulam" />
          </label>

          <Input label="Limite de vagas (opcional)" type="number" min="1" placeholder="Sem limite" value={form.limiteVagas} onChange={(e) => setForm({ ...form, limiteVagas: e.target.value })} />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={loading} className="flex-1">{editId ? 'Salvar' : 'Criar plano'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Excluir plano?">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Essa ação não pode ser desfeita.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1">Cancelar</Button>
            <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)} className="flex-1">Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
