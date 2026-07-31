'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { formatCurrency, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  Wallet, TrendingDown, TrendingUp, PieChart as PieChartIcon, Plus, Pencil, Trash2,
  ArrowUpCircle, ArrowDownCircle, Receipt,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { startOfDay, endOfDay, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import type { Ag, LancamentoFinanceiro } from '@/app/painel/relatorios/RelatoriosClient'

const ROSE = '#fb7185'
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const CATEGORIAS = ['Aluguel', 'Salario', 'Equipamento', 'Material', 'Outro'] as const
type Categoria = typeof CATEGORIAS[number]

/** 'yyyy-MM-dd' -> 'dd/MM/yyyy', sem passar por Date/timezone. */
function formatDataKeyBR(dataChave: string): string {
  const [y, m, d] = dataChave.split('-')
  return `${d}/${m}/${y}`
}

interface Props {
  prestadoraId: string
  agendamentos: Ag[]
  lancamentos: LancamentoFinanceiro[]
  profissionais: { id: string; nome: string }[]
  dataInicio: string
  dataFim: string
  periodoLabel: string
}

export function FinanceiroTabClient({
  prestadoraId, agendamentos, lancamentos, profissionais, dataInicio, dataFim, periodoLabel,
}: Props) {
  const [items, setItems] = useState(lancamentos)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<LancamentoFinanceiro | null>(null)
  const [deleteAlvo, setDeleteAlvo] = useState<LancamentoFinanceiro | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida')
  const [categoria, setCategoria] = useState<Categoria>('Outro')
  const [data, setData] = useState(dataFim)

  const start = useMemo(() => startOfDay(parseISO(dataInicio)), [dataInicio])
  const end = useMemo(() => endOfDay(parseISO(dataFim)), [dataFim])

  const concluidosNoPeriodo = useMemo(() => agendamentos.filter((a) => {
    if (a.status !== 'concluido') return false
    const d = new Date(a.data_hora)
    return d >= start && d <= end
  }), [agendamentos, start, end])

  const receita = concluidosNoPeriodo.reduce((acc, a) => acc + (a.servicos?.preco ?? 0), 0)

  // lançamentos.data é 'yyyy-MM-dd' puro — compara como string, sem Date, pra
  // não arriscar deslocar um dia por causa de fuso (mesmo motivo do
  // formatDataKeyBR acima).
  const lancamentosNoPeriodo = useMemo(
    () => items.filter((l) => l.data >= dataInicio && l.data <= dataFim).sort((a, b) => b.data.localeCompare(a.data)),
    [items, dataInicio, dataFim]
  )

  const despesas = lancamentosNoPeriodo.filter((l) => l.valor < 0).reduce((acc, l) => acc + Math.abs(l.valor), 0)
  const entradasExtras = lancamentosNoPeriodo.filter((l) => l.valor > 0).reduce((acc, l) => acc + l.valor, 0)
  const saldoLancamentos = entradasExtras - despesas

  // Lucro conta as entradas extras dos lançamentos também — não é só receita
  // de serviço menos despesa. saldoLancamentos já é (entradas - despesas), só
  // soma na receita.
  const lucro = receita + saldoLancamentos
  const baseMargem = receita + entradasExtras
  const margem = baseMargem > 0 ? (lucro / baseMargem) * 100 : 0

  /* Período anterior — mesma duração, imediatamente antes do início selecionado. */
  const { prevStart, prevEnd } = useMemo(() => {
    const duracaoMs = end.getTime() - start.getTime()
    const pEnd = new Date(start.getTime() - 1)
    const pStart = new Date(pEnd.getTime() - duracaoMs)
    return { prevStart: pStart, prevEnd: pEnd }
  }, [start, end])

  const receitaAnterior = useMemo(() => agendamentos
    .filter((a) => a.status === 'concluido')
    .filter((a) => { const d = new Date(a.data_hora); return d >= prevStart && d <= prevEnd })
    .reduce((acc, a) => acc + (a.servicos?.preco ?? 0), 0),
  [agendamentos, prevStart, prevEnd])

  const crescimentoReceita = receitaAnterior > 0
    ? ((receita - receitaAnterior) / receitaAnterior) * 100
    : (receita > 0 ? 100 : 0)

  /* Receita por serviço */
  const receitaPorServico = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; receita: number }>()
    for (const a of concluidosNoPeriodo) {
      const nome = a.servicos?.nome ?? 'Sem serviço'
      const entry = map.get(nome) ?? { nome, qtd: 0, receita: 0 }
      entry.qtd += 1
      entry.receita += a.servicos?.preco ?? 0
      map.set(nome, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.receita - a.receita)
  }, [concluidosNoPeriodo])

  /* Receita por profissional (só renderiza se houver mais de uma) */
  const temMultiplasProfissionais = profissionais.length > 1
  const receitaPorProfissional = useMemo(() => {
    const map = new Map<string, { nome: string; receita: number }>()
    for (const a of concluidosNoPeriodo) {
      const nome = a.profissionais?.nome ?? 'Sem profissional'
      const entry = map.get(nome) ?? { nome, receita: 0 }
      entry.receita += a.servicos?.preco ?? 0
      map.set(nome, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.receita - a.receita)
  }, [concluidosNoPeriodo])

  /* Receita por dia da semana */
  const receitaPorDiaSemana = useMemo(() => {
    const somas = DIAS_SEMANA.map(() => 0)
    for (const a of concluidosNoPeriodo) {
      somas[new Date(a.data_hora).getDay()] += a.servicos?.preco ?? 0
    }
    return DIAS_SEMANA.map((dia, i) => ({ dia, receita: somas[i] }))
  }, [concluidosNoPeriodo])

  const melhorDia = useMemo(
    () => receitaPorDiaSemana.reduce((max, d) => d.receita > max.receita ? d : max, receitaPorDiaSemana[0]),
    [receitaPorDiaSemana]
  )

  function abrirNovo() {
    setEditando(null)
    setDescricao('')
    setValor('')
    setTipo('saida')
    setCategoria('Outro')
    setData(dataFim)
    setModalOpen(true)
  }

  function abrirEdicao(l: LancamentoFinanceiro) {
    setEditando(l)
    setDescricao(l.descricao)
    setValor(String(Math.abs(l.valor)))
    setTipo(l.valor < 0 ? 'saida' : 'entrada')
    setCategoria(l.categoria as Categoria)
    setData(l.data)
    setModalOpen(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const valorNumero = parseFloat(valor.replace(',', '.'))
    if (!descricao.trim()) {
      toast.error('Informe uma descrição.')
      return
    }
    if (!valorNumero || valorNumero <= 0) {
      toast.error('Informe um valor válido.')
      return
    }

    setSalvando(true)
    const supabase = createClient()
    const valorFinal = tipo === 'saida' ? -Math.abs(valorNumero) : Math.abs(valorNumero)

    try {
      if (editando) {
        const { data: atualizado, error } = await supabase
          .from('lancamentos_financeiros')
          .update({ descricao: descricao.trim(), valor: valorFinal, categoria, data })
          .eq('id', editando.id)
          .select()
          .single()
        if (error || !atualizado) throw error ?? new Error('sem dados')
        setItems((prev) => prev.map((l) => l.id === editando.id ? (atualizado as LancamentoFinanceiro) : l))
        toast.success('Lançamento atualizado!')
      } else {
        const { data: criado, error } = await supabase
          .from('lancamentos_financeiros')
          .insert({ prestadora_id: prestadoraId, descricao: descricao.trim(), valor: valorFinal, categoria, data })
          .select()
          .single()
        if (error || !criado) throw error ?? new Error('sem dados')
        setItems((prev) => [criado as LancamentoFinanceiro, ...prev])
        toast.success('Lançamento adicionado!')
      }
      setModalOpen(false)
    } catch {
      toast.error('Erro ao salvar lançamento.')
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarExclusao() {
    if (!deleteAlvo) return
    setExcluindo(true)
    const supabase = createClient()
    const { error } = await supabase.from('lancamentos_financeiros').delete().eq('id', deleteAlvo.id)
    if (error) {
      toast.error('Erro ao excluir.')
    } else {
      setItems((prev) => prev.filter((l) => l.id !== deleteAlvo.id))
      toast.success('Lançamento excluído')
      setDeleteAlvo(null)
    }
    setExcluindo(false)
  }

  return (
    <div className="space-y-6">
      {/* Resumo do período */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="bg-emerald-50 p-2.5 rounded-xl w-fit mb-4">
              <Wallet className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(receita)}</p>
            <p className="text-sm text-gray-500 mt-1">Receita (serviços concluídos)</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="bg-red-50 p-2.5 rounded-xl w-fit mb-4">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(despesas)}</p>
            <p className="text-sm text-gray-500 mt-1">Despesas lançadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className={cn('p-2.5 rounded-xl w-fit mb-4', lucro >= 0 ? 'bg-rose-50' : 'bg-red-50')}>
              <PieChartIcon className={cn('w-5 h-5', lucro >= 0 ? 'text-rose-500' : 'text-red-500')} />
            </div>
            <p className={cn('text-3xl font-bold', lucro >= 0 ? 'text-gray-900' : 'text-red-500')}>{formatCurrency(lucro)}</p>
            <p className="text-sm text-gray-500 mt-1">Lucro estimado</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="bg-purple-50 p-2.5 rounded-xl w-fit mb-4">
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{baseMargem > 0 ? `${margem.toFixed(1)}%` : '—'}</p>
            <p className="text-sm text-gray-500 mt-1">Margem</p>
          </CardContent>
        </Card>
      </div>

      {/* Comparativo com período anterior */}
      <div className={cn(
        'flex items-center gap-2.5 text-sm rounded-xl px-4 py-3',
        crescimentoReceita >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
      )}>
        {crescimentoReceita >= 0 ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
        <span>
          Receita {crescimentoReceita >= 0 ? 'cresceu' : 'caiu'} <strong>{Math.abs(crescimentoReceita).toFixed(1)}%</strong> em relação ao período anterior
          <span className="opacity-70"> ({formatCurrency(receitaAnterior)})</span>
        </span>
      </div>

      {/* Receita por serviço / profissional / dia da semana */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Receita por serviço</CardTitle>
          </CardHeader>
          <CardContent>
            {receitaPorServico.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Sem dados no período</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(180, receitaPorServico.slice(0, 6).length * 40)}>
                  <BarChart data={receitaPorServico.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(Number(v))} />
                    <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="receita" fill={ROSE} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {receitaPorServico.map((s, i) => {
                    const pct = receita > 0 ? Math.min(100, (s.receita / receita) * 100) : 0
                    return (
                      <div key={s.nome} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 min-w-0 truncate">
                          <span className="text-gray-400 mr-1.5">{i + 1}.</span>{s.nome}
                          <span className="text-gray-400"> · {s.qtd}x</span>
                        </span>
                        <span className="text-gray-500 shrink-0 ml-2">
                          <span className="font-medium text-gray-900">{formatCurrency(s.receita)}</span> · {pct.toFixed(1)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receita por dia da semana</CardTitle>
          </CardHeader>
          <CardContent>
            {receita === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Sem dados no período</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={receitaPorDiaSemana} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} width={50} tickFormatter={(v) => formatCurrency(Number(v))} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="receita" fill={ROSE} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {melhorDia.receita > 0 && (
                  <p className="text-sm text-gray-600 mt-3 text-center">
                    <span className="font-semibold text-rose-500">{melhorDia.dia}</span> é o dia que mais rende, com{' '}
                    <span className="font-semibold text-gray-900">{formatCurrency(melhorDia.receita)}</span>
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {temMultiplasProfissionais && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Receita por profissional</CardTitle>
            </CardHeader>
            <CardContent>
              {receitaPorProfissional.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">Sem dados no período</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(140, receitaPorProfissional.length * 40)}>
                    <BarChart data={receitaPorProfissional} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(Number(v))} />
                      <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="receita" fill={ROSE} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {receitaPorProfissional.map((p, i) => {
                      const pct = receita > 0 ? Math.min(100, (p.receita / receita) * 100) : 0
                      return (
                        <div key={p.nome} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700"><span className="text-gray-400 mr-1.5">{i + 1}.</span>{p.nome}</span>
                          <span className="text-gray-500"><span className="font-medium text-gray-900">{formatCurrency(p.receita)}</span> · {pct.toFixed(1)}%</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Lançamentos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Lançamentos</CardTitle>
            <Button size="sm" onClick={abrirNovo}>
              <Plus className="w-4 h-4" />
              Adicionar lançamento
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {lancamentosNoPeriodo.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm px-6">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhum lançamento em {periodoLabel.toLowerCase()}.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {lancamentosNoPeriodo.map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                  {l.valor < 0 ? (
                    <ArrowDownCircle className="w-5 h-5 text-red-400 shrink-0" />
                  ) : (
                    <ArrowUpCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{l.descricao}</p>
                    <p className="text-xs text-gray-400">{l.categoria} · {formatDataKeyBR(l.data)}</p>
                  </div>
                  <span className={cn('text-sm font-semibold shrink-0', l.valor < 0 ? 'text-red-500' : 'text-emerald-600')}>
                    {l.valor < 0 ? '-' : '+'}{formatCurrency(Math.abs(l.valor))}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(l)}
                      className="p-1.5 text-gray-300 hover:text-gray-500 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteAlvo(l)}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        {lancamentosNoPeriodo.length > 0 && (
          <div className="grid grid-cols-3 gap-3 px-5 py-4 border-t border-gray-100 text-center">
            <div>
              <p className="text-xs text-gray-400">Entradas extras</p>
              <p className="text-sm font-semibold text-emerald-600">{formatCurrency(entradasExtras)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Saídas</p>
              <p className="text-sm font-semibold text-red-500">{formatCurrency(despesas)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Saldo</p>
              <p className={cn('text-sm font-semibold', saldoLancamentos >= 0 ? 'text-gray-900' : 'text-red-500')}>
                {formatCurrency(saldoLancamentos)}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Modal: novo/editar lançamento */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar lançamento' : 'Novo lançamento'}>
        <form onSubmit={salvar} className="p-6 space-y-4">
          <Input
            label="Nome/descrição"
            placeholder="Ex.: Aluguel do salão"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            required
          />

          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            <button
              type="button"
              onClick={() => setTipo('entrada')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                tipo === 'entrada' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              + Entrada
            </button>
            <button
              type="button"
              onClick={() => setTipo('saida')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                tipo === 'saida' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              − Saída
            </button>
          </div>

          <Input
            label="Valor (R$)"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Categoria</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as Categoria)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 transition-all"
            >
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c === 'Salario' ? 'Salário' : c}</option>)}
            </select>
          </div>

          <Input
            label="Data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
          />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" loading={salvando} className="flex-1">
              {editando ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: confirmar exclusão */}
      <Modal open={!!deleteAlvo} onClose={() => setDeleteAlvo(null)} title="Excluir lançamento">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Tem certeza que quer excluir <span className="font-semibold text-gray-900">{deleteAlvo?.descricao}</span>?
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteAlvo(null)} className="flex-1">
              Cancelar
            </Button>
            <Button type="button" variant="danger" loading={excluindo} onClick={confirmarExclusao} className="flex-1">
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
