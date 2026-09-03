'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ToggleComSubtexto } from '@/components/ui/switch'
import { formatCurrency, cn, startOfTodaySP, formatDateKey } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  Wallet, TrendingDown, TrendingUp, PieChart as PieChartIcon, Plus, Pencil, Trash2,
  ArrowUpCircle, ArrowDownCircle, Receipt, Percent, Repeat, Ban,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { startOfDay, endOfDay, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import type { Ag, LancamentoFinanceiro } from '@/app/painel/relatorios/RelatoriosClient'

const ROSE = '#fb7185'
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const CATEGORIAS = ['Aluguel', 'Salario', 'Equipamento', 'Material', 'Comissao', 'Outro'] as const
const LABEL_CATEGORIA: Record<string, string> = { Salario: 'Salário', Comissao: 'Comissão' }
type Categoria = typeof CATEGORIAS[number]

/** 'yyyy-MM-dd' -> 'dd/MM/yyyy', sem passar por Date/timezone. */
function formatDataKeyBR(dataChave: string): string {
  const [y, m, d] = dataChave.split('-')
  return `${d}/${m}/${y}`
}

/** Diferença em dias entre duas chaves 'yyyy-MM-dd' — âncora em UTC pra não deslocar por fuso. */
function diasEntre(inicioKey: string, fimKey: string): number {
  const inicio = new Date(`${inicioKey}T00:00:00Z`)
  const fim = new Date(`${fimKey}T00:00:00Z`)
  return Math.round((fim.getTime() - inicio.getTime()) / 86400000)
}

interface Props {
  prestadoraId: string
  agendamentos: Ag[]
  lancamentos: LancamentoFinanceiro[]
  profissionais: { id: string; nome: string; comissao_percentual: number }[]
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
  const [temPeriodo, setTemPeriodo] = useState(false)
  const [lancamentoDataFim, setLancamentoDataFim] = useState('')
  const [temRecorrencia, setTemRecorrencia] = useState(false)
  const [recorrenciaIntervalo, setRecorrenciaIntervalo] = useState('')
  const [recorrenciaAte, setRecorrenciaAte] = useState('')
  const [cancelarAlvo, setCancelarAlvo] = useState<LancamentoFinanceiro | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [pagandoComissao, setPagandoComissao] = useState<string | null>(null)

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
  // formatDataKeyBR acima). Lançamento com período (data_fim) conta o valor
  // inteiro em qualquer relatório cujo intervalo toque o período — sem
  // rateio proporcional, decisão de produto: a prestadora lança de forma
  // consistente com o que faz sentido pro caso dela.
  const lancamentosNoPeriodo = useMemo(
    () => items
      .filter((l) => l.data <= dataFim && (l.data_fim ?? l.data) >= dataInicio)
      .sort((a, b) => b.data.localeCompare(a.data)),
    [items, dataInicio, dataFim]
  )

  const despesas = lancamentosNoPeriodo.filter((l) => l.valor < 0).reduce((acc, l) => acc + Math.abs(l.valor), 0)
  const entradasExtras = lancamentosNoPeriodo.filter((l) => l.valor > 0).reduce((acc, l) => acc + l.valor, 0)
  const saldoLancamentos = entradasExtras - despesas

  // Nomes com comissão já lançada como despesa nesse período (mesmo texto
  // gravado por marcarComissaoPaga) — evita contar a mesma comissão duas
  // vezes no lucro: uma vez via despesas (a lançamento em si), outra via o
  // cálculo direto abaixo (que não tem como saber sozinho que ela já foi paga).
  const nomesComissaoPagaNoPeriodo = useMemo(
    () => new Set(lancamentosNoPeriodo.filter((l) => l.categoria === 'Comissao').map((l) => l.descricao)),
    [lancamentosNoPeriodo]
  )

  /* Comissões por profissional — só profissionais com comissao_percentual > 0.
   * Agrupa por nome (mesma chave que receitaPorProfissional já usa) porque o
   * agendamento só traz o nome da profissional via join, não o id. */
  const comissoesPorProfissional = useMemo(() => {
    return profissionais
      .filter((p) => p.comissao_percentual > 0)
      .map((p) => {
        const agsDaProf = concluidosNoPeriodo.filter((a) => a.profissionais?.nome === p.nome)
        const faturamento = agsDaProf.reduce((acc, a) => acc + (a.servicos?.preco ?? 0), 0)
        return {
          nome: p.nome,
          totalServicos: agsDaProf.length,
          faturamento,
          comissao: faturamento * (p.comissao_percentual / 100),
          paga: nomesComissaoPagaNoPeriodo.has(`Comissão paga a ${p.nome}`),
        }
      })
      .filter((p) => p.totalServicos > 0)
      .sort((a, b) => b.comissao - a.comissao)
  }, [profissionais, concluidosNoPeriodo, nomesComissaoPagaNoPeriodo])

  // Só soma no total (e no desconto do lucro abaixo) quem ainda não tem
  // lançamento de comissão paga no período — quem já tem está representada
  // via despesas, contar aqui de novo duplicaria o desconto.
  const totalComissoes = comissoesPorProfissional.filter((p) => !p.paga).reduce((acc, p) => acc + p.comissao, 0)

  // Lucro conta as entradas extras dos lançamentos também — não é só receita
  // de serviço menos despesa — e desconta as comissões de profissionais
  // (estimadas a partir de comissao_percentual, ver comissoesPorProfissional
  // acima), já que isso também é dinheiro que sai do caixa.
  const lucro = receita + saldoLancamentos - totalComissoes
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
    setTemPeriodo(false)
    setLancamentoDataFim('')
    setTemRecorrencia(false)
    setRecorrenciaIntervalo('')
    setRecorrenciaAte('')
    setModalOpen(true)
  }

  function abrirEdicao(l: LancamentoFinanceiro) {
    setEditando(l)
    setDescricao(l.descricao)
    setValor(String(Math.abs(l.valor)))
    setTipo(l.valor < 0 ? 'saida' : 'entrada')
    setCategoria(l.categoria as Categoria)
    setData(l.data)
    setTemPeriodo(!!l.data_fim)
    setLancamentoDataFim(l.data_fim ?? '')
    // Recorrência não é adicionável retroativamente a um lançamento que já
    // existe — só na criação. Editar uma ocorrência de série usa os botões
    // dedicados (salvarOcorrenciaDaSerie), não este formulário genérico.
    setTemRecorrencia(false)
    setRecorrenciaIntervalo('')
    setRecorrenciaAte('')
    setModalOpen(true)
  }

  /** Valida os campos comuns do formulário — usado tanto por salvar() quanto por salvarOcorrenciaDaSerie(). */
  function validarFormulario(): { valorFinal: number; dataFimFinal: string | null } | null {
    const valorNumero = parseFloat(valor.replace(',', '.'))
    if (!descricao.trim()) {
      toast.error('Informe uma descrição.')
      return null
    }
    if (!valorNumero || valorNumero <= 0) {
      toast.error('Informe um valor válido.')
      return null
    }
    if (temPeriodo && (!lancamentoDataFim || lancamentoDataFim < data)) {
      toast.error('A data de término do período deve ser igual ou depois da data inicial.')
      return null
    }
    return {
      valorFinal: tipo === 'saida' ? -Math.abs(valorNumero) : Math.abs(valorNumero),
      dataFimFinal: temPeriodo ? lancamentoDataFim : null,
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    // Ocorrência de série usa os botões "só esta"/"esta e as futuras" — ver JSX do form.
    if (editando?.recorrencia_id) return

    const validado = validarFormulario()
    if (!validado) return
    const { valorFinal, dataFimFinal } = validado

    let intervalo = 0
    if (!editando && temRecorrencia) {
      intervalo = parseInt(recorrenciaIntervalo, 10)
      if (!intervalo || intervalo <= 0) { toast.error('Informe um intervalo de dias válido.'); return }
      if (!recorrenciaAte || recorrenciaAte < data) { toast.error('A data final da recorrência deve ser igual ou depois da data inicial.'); return }
    }

    setSalvando(true)
    const supabase = createClient()

    try {
      if (editando) {
        const { data: atualizado, error } = await supabase
          .from('lancamentos_financeiros')
          .update({ descricao: descricao.trim(), valor: valorFinal, categoria, data, data_fim: dataFimFinal })
          .eq('id', editando.id)
          .select()
          .single()
        if (error || !atualizado) throw error ?? new Error('sem dados')
        setItems((prev) => prev.map((l) =>
          l.id === editando.id ? { ...(atualizado as LancamentoFinanceiro), recorrencia_ativa: l.recorrencia_ativa } : l
        ))
        toast.success('Lançamento atualizado!')
      } else if (temRecorrencia) {
        const duracaoDias = dataFimFinal ? diasEntre(data, dataFimFinal) : null
        const { data: regra, error: erroRegra } = await supabase
          .from('lancamentos_recorrencias')
          .insert({
            prestadora_id: prestadoraId, descricao: descricao.trim(), valor: valorFinal, categoria,
            intervalo_dias: intervalo, data_inicio: data, ate: recorrenciaAte, duracao_dias: duracaoDias,
          })
          .select('id')
          .single()
        if (erroRegra || !regra) throw erroRegra ?? new Error('sem dados')

        const { data: criado, error } = await supabase
          .from('lancamentos_financeiros')
          .insert({
            prestadora_id: prestadoraId, descricao: descricao.trim(), valor: valorFinal, categoria, data,
            data_fim: dataFimFinal, recorrencia_id: regra.id,
          })
          .select()
          .single()
        if (error || !criado) throw error ?? new Error('sem dados')
        setItems((prev) => [{ ...(criado as LancamentoFinanceiro), recorrencia_ativa: true }, ...prev])
        toast.success('Lançamento recorrente criado!')
      } else {
        const { data: criado, error } = await supabase
          .from('lancamentos_financeiros')
          .insert({ prestadora_id: prestadoraId, descricao: descricao.trim(), valor: valorFinal, categoria, data, data_fim: dataFimFinal })
          .select()
          .single()
        if (error || !criado) throw error ?? new Error('sem dados')
        setItems((prev) => [{ ...(criado as LancamentoFinanceiro), recorrencia_ativa: null }, ...prev])
        toast.success('Lançamento adicionado!')
      }
      setModalOpen(false)
    } catch {
      toast.error('Erro ao salvar lançamento.')
    } finally {
      setSalvando(false)
    }
  }

  /**
   * Edita uma ocorrência que pertence a uma série (editando.recorrencia_id
   * != null) — "só esta" atualiza uma linha isolada, sem tocar a regra nem
   * outras ocorrências; "futuras" também propaga descrição/valor/categoria
   * pras ocorrências já geradas com data posterior e atualiza a regra, pra
   * quem ainda vai ser gerado usar os novos valores.
   */
  async function salvarOcorrenciaDaSerie(escopo: 'so-esta' | 'futuras') {
    if (!editando?.recorrencia_id) return
    const validado = validarFormulario()
    if (!validado) return
    const { valorFinal, dataFimFinal } = validado
    const recorrenciaId = editando.recorrencia_id

    setSalvando(true)
    const supabase = createClient()

    try {
      const { data: atualizado, error } = await supabase
        .from('lancamentos_financeiros')
        .update({ descricao: descricao.trim(), valor: valorFinal, categoria, data, data_fim: dataFimFinal })
        .eq('id', editando.id)
        .select()
        .single()
      if (error || !atualizado) throw error ?? new Error('sem dados')

      if (escopo === 'futuras') {
        const { error: erroFuturas } = await supabase
          .from('lancamentos_financeiros')
          .update({ descricao: descricao.trim(), valor: valorFinal, categoria })
          .eq('recorrencia_id', recorrenciaId)
          .gt('data', editando.data)
        if (erroFuturas) throw erroFuturas

        const duracaoDias = dataFimFinal ? diasEntre(data, dataFimFinal) : null
        const { error: erroRegra } = await supabase
          .from('lancamentos_recorrencias')
          .update({ descricao: descricao.trim(), valor: valorFinal, categoria, duracao_dias: duracaoDias })
          .eq('id', recorrenciaId)
        if (erroRegra) throw erroRegra

        setItems((prev) => prev.map((l) => {
          if (l.id === editando.id) return { ...(atualizado as LancamentoFinanceiro), recorrencia_ativa: l.recorrencia_ativa }
          if (l.recorrencia_id === recorrenciaId && l.data > editando.data) {
            return { ...l, descricao: descricao.trim(), valor: valorFinal, categoria }
          }
          return l
        }))
      } else {
        setItems((prev) => prev.map((l) =>
          l.id === editando.id ? { ...(atualizado as LancamentoFinanceiro), recorrencia_ativa: l.recorrencia_ativa } : l
        ))
      }
      toast.success('Lançamento atualizado!')
      setModalOpen(false)
    } catch {
      toast.error('Erro ao salvar lançamento.')
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarCancelarRecorrencia() {
    if (!cancelarAlvo?.recorrencia_id) return
    setCancelando(true)
    const supabase = createClient()
    const { data: atualizada, error } = await supabase
      .from('lancamentos_recorrencias')
      .update({ ativo: false })
      .eq('id', cancelarAlvo.recorrencia_id)
      .select('id')
      .maybeSingle()
    if (error || !atualizada) {
      toast.error('Erro ao cancelar recorrência.')
    } else {
      const recorrenciaId = cancelarAlvo.recorrencia_id
      setItems((prev) => prev.map((l) => l.recorrencia_id === recorrenciaId ? { ...l, recorrencia_ativa: false } : l))
      toast.success('Recorrência cancelada — os lançamentos já gerados continuam no histórico.')
      setCancelarAlvo(null)
    }
    setCancelando(false)
  }

  /**
   * Registra a comissão (estimada em comissoesPorProfissional) como paga —
   * cria um lançamento de despesa pra dar transparência de onde o dinheiro
   * foi. Ação simples de propósito: sem tabela de "já pago" — mesmo espírito
   * de editar/excluir lançamento, que também não têm undo. Clicar de novo
   * pro mesmo período cria outro lançamento; fica a critério da prestadora.
   */
  async function marcarComissaoPaga(nomeProfissional: string, valor: number) {
    setPagandoComissao(nomeProfissional)
    const supabase = createClient()
    const { data: criado, error } = await supabase
      .from('lancamentos_financeiros')
      .insert({
        prestadora_id: prestadoraId,
        descricao: `Comissão paga a ${nomeProfissional}`,
        valor: -Math.abs(valor),
        categoria: 'Comissao',
        data: formatDateKey(startOfTodaySP()),
      })
      .select()
      .single()
    if (error || !criado) {
      toast.error('Erro ao registrar comissão paga.')
    } else {
      setItems((prev) => [{ ...(criado as LancamentoFinanceiro), recorrencia_ativa: null }, ...prev])
      toast.success('Comissão registrada como paga!')
    }
    setPagandoComissao(null)
  }

  async function confirmarExclusao() {
    if (!deleteAlvo) return
    setExcluindo(true)
    const supabase = createClient()
    // .select() é o que permite detectar exclusão bloqueada silenciosamente
    // (RLS ou outro motivo) — sem isso, .delete() sozinho retorna sucesso
    // mesmo quando zero linhas são de fato apagadas.
    const { data: excluido, error } = await supabase
      .from('lancamentos_financeiros')
      .delete()
      .eq('id', deleteAlvo.id)
      .select()
      .maybeSingle()
    if (error || !excluido) {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <div className="bg-emerald-50 p-2.5 rounded-xl w-fit mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(entradasExtras)}</p>
            <p className="text-sm text-gray-500 mt-1">Entradas lançadas</p>
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

      {/* Comissões por profissional */}
      {comissoesPorProfissional.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-rose-400" />
              <CardTitle>Comissões por profissional</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-50">
              {comissoesPorProfissional.map((p) => (
                <div key={p.nome} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                      {p.nome}
                      {p.paga && (
                        <span className="inline-flex items-center bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0">
                          Paga
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.totalServicos} serviço{p.totalServicos !== 1 ? 's' : ''} · faturou {formatCurrency(p.faturamento)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-rose-500 shrink-0">{formatCurrency(p.comissao)}</span>
                  {p.paga ? (
                    <span className="text-xs text-gray-400 shrink-0">Já lançada nesse período</span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      loading={pagandoComissao === p.nome}
                      onClick={() => marcarComissaoPaga(p.nome, p.comissao)}
                      className="shrink-0"
                    >
                      Marcar como paga
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700">Total de comissões a pagar</p>
            <p className="text-base font-bold text-gray-900">{formatCurrency(totalComissoes)}</p>
          </div>
          <p className="text-xs text-gray-400 px-5 pb-4">
            Valores calculados com base nos agendamentos concluídos no período selecionado. Comissões já marcadas
            como pagas não entram nesse total — elas já aparecem em Despesas lançadas.
          </p>
        </Card>
      )}

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
                    <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                      {l.descricao}
                      {l.recorrencia_id && (
                        <Repeat
                          className={cn('w-3 h-3 shrink-0', l.recorrencia_ativa ? 'text-rose-400' : 'text-gray-300')}
                          aria-label={l.recorrencia_ativa ? 'Recorrente' : 'Recorrência cancelada'}
                        />
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {LABEL_CATEGORIA[l.categoria] ?? l.categoria} · {formatDataKeyBR(l.data)}{l.data_fim ? ` – ${formatDataKeyBR(l.data_fim)}` : ''}
                      {l.recorrencia_id && l.recorrencia_ativa === false && ' · Recorrência cancelada'}
                    </p>
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
                    {l.recorrencia_id && l.recorrencia_ativa && (
                      <button
                        type="button"
                        onClick={() => setCancelarAlvo(l)}
                        className="p-1.5 text-gray-300 hover:text-amber-500 transition-colors"
                        title="Cancelar recorrência"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteAlvo(l)}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                      title={l.recorrencia_id ? 'Excluir esta ocorrência' : 'Excluir'}
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
              {CATEGORIAS.map((c) => <option key={c} value={c}>{LABEL_CATEGORIA[c] ?? c}</option>)}
            </select>
          </div>

          <Input
            label="Data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
          />

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <ToggleComSubtexto
              label="Este lançamento tem um período"
              subtexto="Representa um intervalo (ex.: faturamento de um mês) em vez de um dia só"
              checked={temPeriodo}
              onChange={setTemPeriodo}
            />
            {temPeriodo && (
              <Input
                label="Até"
                type="date"
                min={data}
                value={lancamentoDataFim}
                onChange={(e) => setLancamentoDataFim(e.target.value)}
                required
              />
            )}
          </div>

          {!editando && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <ToggleComSubtexto
                label="Repetir automaticamente"
                subtexto="Gera um novo lançamento a cada X dias, até uma data final"
                checked={temRecorrencia}
                onChange={setTemRecorrencia}
              />
              {temRecorrencia && (
                <div className="space-y-3">
                  <Input
                    label="Repetir a cada quantos dias"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Ex.: 30 (mensal), 10 (a cada 10 dias)"
                    value={recorrenciaIntervalo}
                    onChange={(e) => setRecorrenciaIntervalo(e.target.value)}
                    required
                  />
                  <Input
                    label="Repetir até"
                    type="date"
                    min={data}
                    value={recorrenciaAte}
                    onChange={(e) => setRecorrenciaAte(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          )}

          {editando?.recorrencia_id ? (
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-xs text-gray-400">Este lançamento faz parte de uma recorrência — escolha o alcance da edição:</p>
              <div className="flex gap-3">
                <Button type="button" variant="outline" loading={salvando} onClick={() => salvarOcorrenciaDaSerie('so-esta')} className="flex-1">
                  Salvar só esta
                </Button>
                <Button type="button" loading={salvando} onClick={() => salvarOcorrenciaDaSerie('futuras')} className="flex-1">
                  Salvar esta e as futuras
                </Button>
              </div>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="w-full">
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" loading={salvando} className="flex-1">
                {editando ? 'Salvar' : 'Adicionar'}
              </Button>
            </div>
          )}
        </form>
      </Modal>

      {/* Modal: confirmar exclusão */}
      <Modal open={!!deleteAlvo} onClose={() => setDeleteAlvo(null)} title={deleteAlvo?.recorrencia_id ? 'Excluir esta ocorrência' : 'Excluir lançamento'}>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Tem certeza que quer excluir <span className="font-semibold text-gray-900">{deleteAlvo?.descricao}</span>
            {deleteAlvo?.recorrencia_id ? ` de ${formatDataKeyBR(deleteAlvo.data)}` : ''}?
          </p>
          {deleteAlvo?.recorrencia_id && (
            <p className="text-xs text-gray-400">A recorrência continua gerando os próximos lançamentos normalmente.</p>
          )}
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

      {/* Modal: confirmar cancelamento de recorrência */}
      <Modal open={!!cancelarAlvo} onClose={() => setCancelarAlvo(null)} title="Cancelar recorrência">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Cancelar a recorrência de <span className="font-semibold text-gray-900">{cancelarAlvo?.descricao}</span>?
          </p>
          <p className="text-xs text-gray-400">
            Os lançamentos já gerados continuam no histórico — nenhum novo será criado a partir de hoje.
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setCancelarAlvo(null)} className="flex-1">
              Voltar
            </Button>
            <Button type="button" variant="danger" loading={cancelando} onClick={confirmarCancelarRecorrencia} className="flex-1">
              Cancelar recorrência
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
