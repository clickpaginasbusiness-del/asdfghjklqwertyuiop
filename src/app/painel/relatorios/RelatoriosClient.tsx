'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Lock, DollarSign, Percent, UserPlus, TrendingUp, Eye,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  format, startOfDay, endOfDay, parseISO, subDays, eachDayOfInterval, getDay,
} from 'date-fns'

const ROSE = '#fb7185'
const ROSE_LIGHT = '#fecdd3'
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export type Ag = {
  id: string
  data_hora: string
  created_at: string
  status: 'confirmado' | 'cancelado' | 'concluido'
  servicos: { nome: string; preco: number } | null
  clientes: { id: string; nome: string } | null
  profissionais: { nome: string } | null
}

type ProfissionalLite = { id: string; nome: string }
type VisitaLite = { id: string; created_at: string }

interface Props {
  plano: 'basico' | 'pro'
  agendamentos: Ag[]
  profissionais: ProfissionalLite[]
  visitas: VisitaLite[]
  horaAbertura: string
  horaFechamento: string
}

type QuickSel = 'hoje' | '7d' | '30d' | null

const QUICK_BUTTONS: { value: Exclude<QuickSel, null>; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
]

function heatColor(value: number, max: number) {
  if (value === 0) return '#f9fafb'
  const intensity = value / max
  if (intensity > 0.75) return '#f43f5e'
  if (intensity > 0.5) return '#fb7185'
  if (intensity > 0.25) return '#fda4af'
  return '#fecdd3'
}

export default function RelatoriosClient({
  plano, agendamentos, profissionais, visitas, horaAbertura, horaFechamento,
}: Props) {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [quickSel, setQuickSel] = useState<QuickSel>('30d')
  const [dataInicio, setDataInicio] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [dataFim, setDataFim] = useState(todayStr)

  function handleQuick(q: Exclude<QuickSel, null>) {
    const today = new Date()
    setQuickSel(q)
    if (q === 'hoje') {
      setDataInicio(format(today, 'yyyy-MM-dd'))
      setDataFim(format(today, 'yyyy-MM-dd'))
    } else if (q === '7d') {
      setDataInicio(format(subDays(today, 6), 'yyyy-MM-dd'))
      setDataFim(format(today, 'yyyy-MM-dd'))
    } else if (q === '30d') {
      setDataInicio(format(subDays(today, 29), 'yyyy-MM-dd'))
      setDataFim(format(today, 'yyyy-MM-dd'))
    }
  }

  const periodoLabel = quickSel === 'hoje' ? 'Hoje'
    : quickSel === '7d' ? 'Últimos 7 dias'
    : quickSel === '30d' ? 'Últimos 30 dias'
    : 'Personalizado'

  const start = useMemo(() => startOfDay(parseISO(dataInicio)), [dataInicio])
  const end = useMemo(() => endOfDay(parseISO(dataFim)), [dataFim])

  const noPeriodo = useMemo(() => agendamentos.filter((a) => {
    const d = new Date(a.data_hora)
    return d >= start && d <= end
  }), [agendamentos, start, end])

  const ativosNoPeriodo = useMemo(
    () => noPeriodo.filter((a) => a.status === 'confirmado' || a.status === 'concluido'),
    [noPeriodo]
  )
  const canceladosNoPeriodo = useMemo(() => noPeriodo.filter((a) => a.status === 'cancelado'), [noPeriodo])

  const taxaCancelamento = noPeriodo.length > 0 ? (canceladosNoPeriodo.length / noPeriodo.length) * 100 : 0

  const receitaTotal = ativosNoPeriodo.reduce((acc, a) => acc + (a.servicos?.preco ?? 0), 0)
  const ticketMedio = ativosNoPeriodo.length > 0 ? receitaTotal / ativosNoPeriodo.length : 0

  /* ── Serviço mais vendido ── */
  const rankingServicos = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; receita: number }>()
    for (const a of ativosNoPeriodo) {
      const nome = a.servicos?.nome ?? 'Sem serviço'
      const entry = map.get(nome) ?? { nome, qtd: 0, receita: 0 }
      entry.qtd += 1
      entry.receita += a.servicos?.preco ?? 0
      map.set(nome, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd)
  }, [ativosNoPeriodo])

  /* ── Receita por período ── */
  const receitaPorDia = useMemo(() => {
    const dias = eachDayOfInterval({ start, end })
    const map = new Map<string, number>()
    for (const a of ativosNoPeriodo) {
      const key = format(new Date(a.data_hora), 'dd/MM')
      map.set(key, (map.get(key) ?? 0) + (a.servicos?.preco ?? 0))
    }
    return dias.map((d) => {
      const key = format(d, 'dd/MM')
      return { dia: key, receita: map.get(key) ?? 0 }
    })
  }, [ativosNoPeriodo, start, end])

  /* ── Clientes novos vs recorrentes ── */
  const primeiraVisitaPorCliente = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of agendamentos) {
      if (a.status !== 'confirmado' && a.status !== 'concluido') continue
      const clienteId = a.clientes?.id
      if (!clienteId) continue
      const t = new Date(a.data_hora).getTime()
      const atual = map.get(clienteId)
      if (atual === undefined || t < atual) map.set(clienteId, t)
    }
    return map
  }, [agendamentos])

  const clientesNoPeriodo = useMemo(() => {
    const vistos = new Set<string>()
    let novos = 0
    let recorrentes = 0
    for (const a of ativosNoPeriodo) {
      const clienteId = a.clientes?.id
      if (!clienteId || vistos.has(clienteId)) continue
      vistos.add(clienteId)
      const primeira = primeiraVisitaPorCliente.get(clienteId)
      const isNovo = primeira !== undefined && primeira >= start.getTime() && primeira <= end.getTime()
      if (isNovo) novos += 1
      else recorrentes += 1
    }
    return { novos, recorrentes }
  }, [ativosNoPeriodo, primeiraVisitaPorCliente, start, end])

  /* ── Profissional com mais agendamentos ── */
  const temMultiplasProfissionais = profissionais.length > 1
  const rankingProfissionais = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; receita: number }>()
    for (const a of ativosNoPeriodo) {
      const nome = a.profissionais?.nome ?? 'Sem profissional'
      const entry = map.get(nome) ?? { nome, qtd: 0, receita: 0 }
      entry.qtd += 1
      entry.receita += a.servicos?.preco ?? 0
      map.set(nome, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd)
  }, [ativosNoPeriodo])

  /* ── Horários de pico ── */
  const horaInicioGrid = parseInt(horaAbertura.slice(0, 2), 10) || 8
  const horaFimGrid = Math.max(horaInicioGrid + 1, parseInt(horaFechamento.slice(0, 2), 10) || 20)
  const horasGrid = Array.from({ length: horaFimGrid - horaInicioGrid }, (_, i) => horaInicioGrid + i)

  const heatmap = useMemo(() => {
    const grid: number[][] = DIAS_SEMANA.map(() => horasGrid.map(() => 0))
    for (const a of ativosNoPeriodo) {
      const d = new Date(a.data_hora)
      const dia = getDay(d)
      const col = horasGrid.indexOf(d.getHours())
      if (col === -1) continue
      grid[dia][col] += 1
    }
    return grid
  }, [ativosNoPeriodo, horasGrid])

  const maxHeat = Math.max(1, ...heatmap.flat())

  /* ── Visitas e conversão ── */
  const visitasNoPeriodo = useMemo(() => visitas.filter((v) => {
    const d = new Date(v.created_at)
    return d >= start && d <= end
  }), [visitas, start, end])

  const agendamentosCriadosNoPeriodo = useMemo(() => agendamentos.filter((a) => {
    if (a.status !== 'confirmado' && a.status !== 'concluido') return false
    const d = new Date(a.created_at)
    return d >= start && d <= end
  }), [agendamentos, start, end])

  const taxaConversao = visitasNoPeriodo.length > 0
    ? (agendamentosCriadosNoPeriodo.length / visitasNoPeriodo.length) * 100
    : 0

  const pieData = [
    { name: 'Novos', value: clientesNoPeriodo.novos },
    { name: 'Recorrentes', value: clientesNoPeriodo.recorrentes },
  ]
  const temClientesNoPeriodo = clientesNoPeriodo.novos + clientesNoPeriodo.recorrentes > 0

  if (plano === 'basico') {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Relatórios</h1>
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="font-serif text-xl font-semibold text-gray-900 mb-2">
            Relatórios disponíveis no Plano Pro
          </h2>
          <p className="text-gray-500 text-sm max-w-xs mx-auto mb-6">
            Acompanhe receita, serviços mais vendidos, taxa de cancelamento e muito mais com relatórios completos do seu negócio.
          </p>
          <Link
            href="/planos"
            className="inline-flex items-center gap-2 bg-rose-400 text-white px-6 py-3 rounded-2xl font-semibold text-sm hover:bg-rose-500 transition-colors"
          >
            Fazer upgrade para Pro
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + filtro de período */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Relatórios</h1>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 shrink-0">
            {QUICK_BUTTONS.map((q) => (
              <button
                key={q.value}
                onClick={() => handleQuick(q.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  quickSel === q.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="font-medium">De:</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => { setDataInicio(e.target.value); setQuickSel(null) }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 text-xs focus:outline-none focus:border-rose-300 focus:ring-1 focus:ring-rose-200 transition-all bg-white"
            />
            <span className="font-medium">Até:</span>
            <input
              type="date"
              value={dataFim}
              min={dataInicio}
              onChange={(e) => { setDataFim(e.target.value); setQuickSel(null) }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 text-xs focus:outline-none focus:border-rose-300 focus:ring-1 focus:ring-rose-200 transition-all bg-white"
            />
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="bg-emerald-50 p-2.5 rounded-xl w-fit mb-4">
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(ticketMedio)}</p>
            <p className="text-sm text-gray-500 mt-1">Ticket médio — {periodoLabel.toLowerCase()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="bg-amber-50 p-2.5 rounded-xl w-fit mb-4">
              <Percent className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{taxaCancelamento.toFixed(1)}%</p>
            <p className="text-sm text-gray-500 mt-1">Cancelamentos ({canceladosNoPeriodo.length})</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="bg-rose-50 p-2.5 rounded-xl w-fit mb-4">
              <UserPlus className="w-5 h-5 text-rose-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{clientesNoPeriodo.novos}</p>
            <p className="text-sm text-gray-500 mt-1">Clientes novos</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="bg-purple-50 p-2.5 rounded-xl w-fit mb-4">
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{taxaConversao.toFixed(1)}%</p>
            <p className="text-sm text-gray-500 mt-1">Taxa de conversão</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Serviço mais vendido</CardTitle>
          </CardHeader>
          <CardContent>
            {rankingServicos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Sem dados no período</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(180, rankingServicos.slice(0, 6).length * 40)}>
                  <BarChart data={rankingServicos.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => [value, 'Agendamentos']} />
                    <Bar dataKey="qtd" fill={ROSE} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {rankingServicos.slice(0, 6).map((s, i) => (
                    <div key={s.nome} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700"><span className="text-gray-400 mr-1.5">{i + 1}.</span>{s.nome}</span>
                      <span className="text-gray-500">{s.qtd}x · <span className="font-medium text-gray-900">{formatCurrency(s.receita)}</span></span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receita por período</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={receitaPorDia}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={50} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="receita" stroke={ROSE} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clientes novos vs recorrentes</CardTitle>
          </CardHeader>
          <CardContent>
            {!temClientesNoPeriodo ? (
              <p className="text-sm text-gray-400 text-center py-10">Sem dados no período</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    <Cell fill={ROSE} />
                    <Cell fill={ROSE_LIGHT} />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {temMultiplasProfissionais && (
          <Card>
            <CardHeader>
              <CardTitle>Profissional com mais agendamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {rankingProfissionais.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">Sem dados no período</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(180, rankingProfissionais.length * 40)}>
                    <BarChart data={rankingProfissionais} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => [value, 'Agendamentos']} />
                      <Bar dataKey="qtd" fill={ROSE} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {rankingProfissionais.map((p, i) => (
                      <div key={p.nome} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700"><span className="text-gray-400 mr-1.5">{i + 1}.</span>{p.nome}</span>
                        <span className="text-gray-500">{p.qtd}x · <span className="font-medium text-gray-900">{formatCurrency(p.receita)}</span></span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Horários de pico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs w-full">
                <thead>
                  <tr>
                    <th className="p-1"></th>
                    {horasGrid.map((h) => (
                      <th key={h} className="p-1 text-gray-400 font-normal">{h}h</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DIAS_SEMANA.map((dia, di) => (
                    <tr key={dia}>
                      <td className="p-1 pr-2 text-gray-500 font-medium whitespace-nowrap">{dia}</td>
                      {horasGrid.map((h, hi) => {
                        const valor = heatmap[di][hi]
                        const cor = heatColor(valor, maxHeat)
                        return (
                          <td key={h} className="p-0.5">
                            <div
                              className="w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-medium"
                              style={{ backgroundColor: cor, color: valor / maxHeat > 0.5 ? 'white' : '#78716c' }}
                              title={`${dia} ${h}h: ${valor} agendamento(s)`}
                            >
                              {valor > 0 ? valor : ''}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-gray-400" />
              Visitas à página pública
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 text-sm">
              <span className="font-semibold text-gray-900">{visitasNoPeriodo.length}</span> visitas,{' '}
              <span className="font-semibold text-gray-900">{agendamentosCriadosNoPeriodo.length}</span> agendamentos,{' '}
              <span className="font-semibold text-rose-500">{taxaConversao.toFixed(1)}%</span> de conversão
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
