'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, Wallet, Percent, TrendingUp, Landmark, Clock, CheckCircle2, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdminNav } from '@/components/admin/AdminNav'
import { formatCurrency } from '@/lib/utils'
import { format, startOfDay, endOfDay, parseISO, subDays } from 'date-fns'

// Taxas estimadas do Mercado Pago por método de pagamento. `caixa_prestadora`
// não guarda o método usado em cada transação (só valor bruto/líquido), então
// não dá pra saber qual dessas 3 taxas se aplica a cada linha — por isso o
// cálculo abaixo usa sempre PIX (a mais comum e mais barata) como estimativa
// padrão pra todos os registros, como combinado.
const TAXA_MP = { pix: 0.0119, cartao: 0.0498, debito: 0.0199 }
const TAXA_MP_PADRAO = TAXA_MP.pix

type CaixaLinha = {
  id: string
  prestadoraId: string
  prestadoraNome: string
  tipo: 'sinal' | 'pagamento_servico' | 'saque'
  valor: number
  valorBruto: number
  status: 'pendente' | 'disponivel' | 'sacado' | 'reembolsado'
  createdAt: string
}

type SaqueLinha = {
  id: string
  prestadoraId: string
  valor: number
  status: 'solicitado' | 'pago'
  pagoEm: string | null
  solicitadoEm: string
}

type QuickSel = 'hoje' | '7d' | '30d' | null

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export default function FinanceiroAdminClient({ caixa, saques }: { caixa: CaixaLinha[]; saques: SaqueLinha[] }) {
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

  const periodoLabel = quickSel === 'hoje' ? 'hoje'
    : quickSel === '7d' ? 'últimos 7 dias'
    : quickSel === '30d' ? 'últimos 30 dias'
    : 'período selecionado'

  const start = useMemo(() => startOfDay(parseISO(dataInicio)), [dataInicio])
  const end = useMemo(() => endOfDay(parseISO(dataFim)), [dataFim])

  const caixaNoPeriodo = useMemo(
    () => caixa.filter((c) => { const d = new Date(c.createdAt); return d >= start && d <= end }),
    [caixa, start, end]
  )
  const saquesPagosNoPeriodo = useMemo(
    () => saques.filter((s) => s.status === 'pago' && s.pagoEm && new Date(s.pagoEm) >= start && new Date(s.pagoEm) <= end),
    [saques, start, end]
  )

  // ── Resumo geral (período) ────────────────────────────────────────────
  const totalBruto = round2(caixaNoPeriodo.reduce((s, c) => s + c.valorBruto, 0))
  const taxaMp = round2(totalBruto * TAXA_MP_PADRAO)
  const totalMpBruto = round2(totalBruto - taxaMp)
  const totalPrestadoras = round2(caixaNoPeriodo.reduce((s, c) => s + c.valor, 0))
  const suaReceita = round2(totalMpBruto - totalPrestadoras)
  const totalSacado = round2(saquesPagosNoPeriodo.reduce((s, sq) => s + sq.valor, 0))

  // Disponível/pendente são saldo atual (estado, não fluxo do período).
  const totalDisponivel = round2(caixa.filter((c) => c.status === 'disponivel').reduce((s, c) => s + c.valor, 0))
  const totalPendente = round2(caixa.filter((c) => c.status === 'pendente').reduce((s, c) => s + c.valor, 0))

  // ── Extrato por prestadora (período) ────────────────────────────────────
  const porPrestadora = useMemo(() => {
    const mapa = new Map<string, {
      nome: string
      totalBruto: number
      totalLiquido: number
      disponivel: number
      pendente: number
      sacado: number
    }>()
    for (const c of caixaNoPeriodo) {
      let e = mapa.get(c.prestadoraId)
      if (!e) {
        e = { nome: c.prestadoraNome, totalBruto: 0, totalLiquido: 0, disponivel: 0, pendente: 0, sacado: 0 }
        mapa.set(c.prestadoraId, e)
      }
      e.totalBruto += c.valorBruto
      e.totalLiquido += c.valor
      if (c.status === 'disponivel') e.disponivel += c.valor
      else if (c.status === 'pendente') e.pendente += c.valor
      else if (c.status === 'sacado') e.sacado += c.valor
    }
    return Array.from(mapa.entries())
      .map(([id, e]) => {
        const taxaMpPrestadora = round2(e.totalBruto * TAXA_MP_PADRAO)
        const totalMpBrutoPrestadora = round2(e.totalBruto - taxaMpPrestadora)
        return {
          id,
          nome: e.nome,
          totalBruto: round2(e.totalBruto),
          taxaMp: taxaMpPrestadora,
          totalMpBruto: totalMpBrutoPrestadora,
          totalLiquido: round2(e.totalLiquido),
          suaReceita: round2(totalMpBrutoPrestadora - e.totalLiquido),
          disponivel: round2(e.disponivel),
          pendente: round2(e.pendente),
          sacado: round2(e.sacado),
        }
      })
      .sort((a, b) => b.totalBruto - a.totalBruto)
  }, [caixaNoPeriodo])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-10 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-serif text-xl font-bold text-rose-400">BelleBook</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-semibold text-gray-700">Painel Admin</span>
        </div>
        <AdminNav />
        <Link href="/painel" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao painel
        </Link>
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-serif text-2xl font-semibold text-gray-900">Financeiro</h1>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 shrink-0">
              {([['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias']] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => handleQuick(value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${quickSel === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {label}
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

        {/* Aviso importante */}
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">
            O saldo na sua conta do Mercado Pago inclui sua receita + valores das prestadoras.
            Reserve sempre o valor <strong>&quot;Total das Prestadoras&quot;</strong> para os saques delas.
          </p>
        </div>

        {/* Resumo geral */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-gray-100 p-2 rounded-xl"><Wallet className="w-4 h-4 text-gray-600" /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalBruto)}</p>
              <p className="text-xs text-gray-400 mt-1">Total bruto — {periodoLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-red-50 p-2 rounded-xl"><Percent className="w-4 h-4 text-red-500" /></div>
              </div>
              <p className="text-2xl font-bold text-red-500">-{formatCurrency(taxaMp)}</p>
              <p className="text-xs text-gray-400 mt-1">Taxa Mercado Pago (estimada, {(TAXA_MP_PADRAO * 100).toFixed(2)}%)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-blue-50 p-2 rounded-xl"><Landmark className="w-4 h-4 text-blue-500" /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalMpBruto)}</p>
              <p className="text-xs text-gray-400 mt-1">Total MP bruto (caiu na sua conta)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-violet-50 p-2 rounded-xl"><Wallet className="w-4 h-4 text-violet-500" /></div>
              </div>
              <p className="text-2xl font-bold text-violet-600">{formatCurrency(totalPrestadoras)}</p>
              <p className="text-xs text-gray-400 mt-1">Total das prestadoras (você deve a elas)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-emerald-50 p-2 rounded-xl"><TrendingUp className="w-4 h-4 text-emerald-600" /></div>
              </div>
              <p className={`text-2xl font-bold ${suaReceita >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(suaReceita)}</p>
              <p className="text-xs text-gray-400 mt-1">Sua receita líquida — {periodoLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-gray-100 p-2 rounded-xl"><CheckCircle2 className="w-4 h-4 text-gray-600" /></div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalSacado)}</p>
              <p className="text-xs text-gray-400 mt-1">Já sacado pelas prestadoras — {periodoLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-emerald-50 p-2 rounded-xl"><DollarSign className="w-4 h-4 text-emerald-600" /></div>
                <Badge variant="success">Disponível</Badge>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalDisponivel)}</p>
              <p className="text-xs text-gray-400 mt-1">Saldo atual disponível para saque</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-amber-50 p-2 rounded-xl"><Clock className="w-4 h-4 text-amber-500" /></div>
                <Badge variant="warning">Pendente</Badge>
              </div>
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalPendente)}</p>
              <p className="text-xs text-gray-400 mt-1">Saldo atual aguardando 7 dias</p>
            </CardContent>
          </Card>
        </div>

        {/* Extrato por prestadora */}
        <Card>
          <CardHeader>
            <CardTitle>Extrato por prestadora — {periodoLabel} ({porPrestadora.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {porPrestadora.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">Nenhuma transação no período selecionado</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="px-5 py-2.5 font-medium">Prestadora</th>
                      <th className="px-5 py-2.5 font-medium text-right">Total bruto</th>
                      <th className="px-5 py-2.5 font-medium text-right">Taxa MP</th>
                      <th className="px-5 py-2.5 font-medium text-right">Total MP bruto</th>
                      <th className="px-5 py-2.5 font-medium text-right">Valor líquido dela</th>
                      <th className="px-5 py-2.5 font-medium text-right">Sua receita</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {porPrestadora.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">{p.nome}</td>
                        <td className="px-5 py-3 text-gray-700 text-right whitespace-nowrap">{formatCurrency(p.totalBruto)}</td>
                        <td className="px-5 py-3 text-red-500 text-right whitespace-nowrap">-{formatCurrency(p.taxaMp)}</td>
                        <td className="px-5 py-3 text-gray-700 text-right whitespace-nowrap">{formatCurrency(p.totalMpBruto)}</td>
                        <td className="px-5 py-3 text-violet-600 font-medium text-right whitespace-nowrap">{formatCurrency(p.totalLiquido)}</td>
                        <td className={`px-5 py-3 font-semibold text-right whitespace-nowrap ${p.suaReceita >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(p.suaReceita)}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {p.disponivel > 0 && <Badge variant="success">{formatCurrency(p.disponivel)} disp.</Badge>}
                            {p.pendente > 0 && <Badge variant="warning">{formatCurrency(p.pendente)} pend.</Badge>}
                            {p.sacado > 0 && <Badge variant="default">{formatCurrency(p.sacado)} sacado</Badge>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
