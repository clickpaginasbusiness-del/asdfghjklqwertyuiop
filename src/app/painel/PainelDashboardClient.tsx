'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateShort, buildWhatsappUrl } from '@/lib/utils'
import { Calendar, DollarSign, Clock, MessageCircle, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  format, isToday, startOfDay, endOfDay, parseISO, subDays, addDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { renderTemplate, MSG_CONFIRMACAO_DEFAULT, MSG_CANCELAMENTO_DEFAULT, MSG_LEMBRETE_DEFAULT } from '@/lib/whatsappTemplates'

/* ── Types ── */
type QuickSel = 'hoje' | '7d' | '30d' | null

type Ag = {
  id: string
  data_hora: string
  status: string
  servicos: { nome: string; preco: number; duracao_minutos: number } | null
  clientes: { id: string; nome: string; telefone: string } | null
  profissionais: { nome: string } | null
}

interface Props {
  agendamentosAno: Ag[]
  horarioAbertura: string
  horarioFechamento: string
  prestadoraId: string
  nomeUsuario: string
  msgConfirmacao: string | null
  msgCancelamento: string | null
  msgLembrete: string | null
}

/* ── Constants ── */
const QUICK_BUTTONS: { value: Exclude<QuickSel, null>; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d',   label: '7 dias' },
  { value: '30d',  label: '30 dias' },
]

function formatHorario(h: string) { return h.slice(0, 5) }

/* ── Appointment item ── */
function AgendamentoItem({
  a, showDate, waOpenId, setWaOpenId, concluindoId, concluir, setConfirmModalId,
  prestadoraNome, msgConfirmacao, msgCancelamento, msgLembrete,
}: {
  a: Ag; showDate: boolean
  waOpenId: string | null; setWaOpenId: (id: string | null) => void
  concluindoId: string | null; concluir: (id: string) => void
  setConfirmModalId: (id: string) => void
  prestadoraNome: string
  msgConfirmacao: string | null; msgCancelamento: string | null; msgLembrete: string | null
}) {
  const passou = new Date(a.data_hora) < new Date()
  const timeLabel = showDate
    ? format(new Date(a.data_hora), 'dd/MM HH:mm')
    : format(new Date(a.data_hora), 'HH:mm')
  const amanha = startOfDay(addDays(new Date(), 1))

  return (
    <div className="flex items-start sm:items-center gap-3 p-3 hover:bg-gray-50/80 rounded-xl transition-colors">
      <div className="shrink-0 bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap" suppressHydrationWarning>
        {timeLabel}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm">{a.clientes?.nome}</p>
        <p className="text-xs text-gray-500 truncate">
          {a.servicos?.nome}
          {a.servicos?.duracao_minutos && <span className="text-gray-400"> · {a.servicos.duracao_minutos} min</span>}
          {a.profissionais && <span className="text-gray-400"> · {a.profissionais.nome}</span>}
        </p>

        {a.clientes?.telefone && (
          <div className="relative mt-1 inline-block">
            <button
              onClick={(e) => { e.stopPropagation(); setWaOpenId(waOpenId === a.id ? null : a.id) }}
              className="flex items-center gap-1 bg-green-50 hover:bg-green-100 border border-green-100 text-green-600 rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
            >
              <MessageCircle className="w-3 h-3" />
              WhatsApp
            </button>
            {waOpenId === a.id && (
              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-100 rounded-xl shadow-xl p-1.5 space-y-0.5 w-52" onClick={(e) => e.stopPropagation()}>
                <a href={buildWhatsappUrl(a.clientes!.telefone, renderTemplate(msgConfirmacao || MSG_CONFIRMACAO_DEFAULT, a, prestadoraNome))} target="_blank" rel="noopener noreferrer" onClick={() => setWaOpenId(null)} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-green-50 rounded-lg transition-colors">
                  ✅ Enviar confirmação
                </a>
                <a href={buildWhatsappUrl(a.clientes!.telefone, renderTemplate(msgCancelamento || MSG_CANCELAMENTO_DEFAULT, a, prestadoraNome))} target="_blank" rel="noopener noreferrer" onClick={() => setWaOpenId(null)} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-red-50 rounded-lg transition-colors">
                  ❌ Enviar cancelamento
                </a>
                {a.status === 'confirmado' && new Date(a.data_hora) >= amanha && (
                  <a href={buildWhatsappUrl(a.clientes!.telefone, renderTemplate(msgLembrete || MSG_LEMBRETE_DEFAULT, a, prestadoraNome))} target="_blank" rel="noopener noreferrer" onClick={() => setWaOpenId(null)} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-amber-50 rounded-lg transition-colors">
                    🔔 Enviar lembrete
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1">
        <p className="text-sm font-semibold text-gray-800">{formatCurrency(a.servicos?.preco ?? 0)}</p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => passou && !concluindoId && concluir(a.id)}
            disabled={!passou || concluindoId === a.id}
            title={!passou ? 'Disponível após o horário do atendimento' : 'Marcar como concluído'}
            className={cn(
              'flex items-center gap-1 text-xs rounded-lg px-2 py-1 font-medium transition-all border',
              passou
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
                : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
            )}
          >
            <CheckCheck className="w-3 h-3" />
            {concluindoId === a.id ? '...' : 'Concluído'}
          </button>
          <button onClick={() => setConfirmModalId(a.id)} className="text-xs text-red-400 hover:text-red-500 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main component ── */
export default function PainelDashboardClient({
  agendamentosAno: initialAno,
  horarioAbertura,
  horarioFechamento,
  prestadoraId,
  nomeUsuario,
  msgConfirmacao,
  msgCancelamento,
  msgLembrete,
}: Props) {
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const [agendamentos, setAgendamentos] = useState<Ag[]>(initialAno)
  const [quickSel, setQuickSel] = useState<QuickSel>('hoje')
  const [dataInicio, setDataInicio] = useState(todayStr)
  const [dataFim, setDataFim] = useState(todayStr)
  const [waOpenId, setWaOpenId] = useState<string | null>(null)
  const [confirmModalId, setConfirmModalId] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [concluindoId, setConcluindoId] = useState<string | null>(null)
  const [dataHoje, setDataHoje] = useState('')

  /* Horário sempre fresco — ignora cache do server render */
  const [horario, setHorario] = useState({ abertura: horarioAbertura, fechamento: horarioFechamento })

  useEffect(() => {
    createClient()
      .from('prestadoras')
      .select('hora_abertura, hora_fechamento')
      .eq('id', prestadoraId)
      .single()
      .then(({ data }) => {
        if (data) setHorario({ abertura: data.hora_abertura, fechamento: data.hora_fechamento })
      })
  }, [prestadoraId])

  /* ── Realtime: agendamentos ── */
  useEffect(() => {
    const supabase = createClient()
    // cancelado_por deliberadamente fora do SELECT — lemos direto do payload.new
    const AG_SELECT = 'id, data_hora, status, servicos(nome, preco, duracao_minutos), clientes(id, nome, telefone), profissionais(nome)'

    const channel = supabase
      .channel(`ag-painel-${prestadoraId}`)
      /* Nova reserva feita pela cliente */
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agendamentos',
        filter: `prestadora_id=eq.${prestadoraId}`,
      }, async (payload) => {
        const { data, error } = await supabase
          .from('agendamentos')
          .select(AG_SELECT)
          .eq('id', (payload.new as Record<string, unknown>).id as string)
          .single()

        if (error || !data) return

        const ag = data as unknown as Ag
        // Adiciona ao estado — métricas e receita atualizam via useMemo
        setAgendamentos(prev => prev.some(a => a.id === ag.id) ? prev : [...prev, ag])
        toast.success(
          `Novo agendamento! 💅 ${ag.clientes?.nome ?? 'Cliente'} — ${ag.servicos?.nome ?? ''}`,
          { duration: 6000 },
        )
      })
      /* Cancelamento ou conclusão */
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'agendamentos',
        filter: `prestadora_id=eq.${prestadoraId}`,
      }, async (payload) => {
        const row = payload.new as Record<string, unknown>
        const oldRow = (payload.old ?? {}) as Record<string, unknown>

        const { data, error } = await supabase
          .from('agendamentos')
          .select(AG_SELECT)
          .eq('id', row.id as string)
          .single()

        if (error || !data) return

        const ag = data as unknown as Ag
        setAgendamentos(prev => prev.map(a => a.id === ag.id ? ag : a))

        // Toast apenas para cancelamentos feitos pela própria cliente
        if (
          row.status === 'cancelado' &&
          oldRow.status !== 'cancelado' &&
          row.cancelado_por === 'cliente'
        ) {
          toast.error(
            `Cancelamento: ${ag.clientes?.nome ?? 'Cliente'} — ${ag.servicos?.nome ?? ''}`,
            { duration: 6000 },
          )
        }
      })
      .subscribe((status, err) => {
        if (err) console.error('[Realtime ag-painel] erro:', status, err)
      })

    return () => { supabase.removeChannel(channel) }
  }, [prestadoraId])

  /* Evita hydration mismatch de fuso horário no nome do dia */
  useEffect(() => {
    setDataHoje(format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR }))
  }, [])

  /* ── Filtro rápido ── */
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

  /* ── Métricas do intervalo selecionado ── */
  const agendamentosPeriodo = useMemo(() => {
    const start = startOfDay(parseISO(dataInicio))
    const end = endOfDay(parseISO(dataFim))
    return agendamentos.filter((a) => {
      const d = new Date(a.data_hora)
      return d >= start && d <= end
    })
  }, [agendamentos, dataInicio, dataFim])

  const totalPeriodo = agendamentosPeriodo.length
  const receitaPeriodo = agendamentosPeriodo.reduce((acc, a) => acc + (a.servicos?.preco ?? 0), 0)

  /* ── Agenda de hoje — sempre hoje ── */
  const agendaHoje = useMemo(() => {
    return agendamentos
      .filter((a) => a.status === 'confirmado' && isToday(new Date(a.data_hora)))
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
  }, [agendamentos])

  /* ── Agenda do período — excluindo hoje ── */
  const isHojeExato = dataInicio === todayStr && dataFim === todayStr
  const agendaPeriodo = useMemo(() => {
    if (isHojeExato) return []
    const start = startOfDay(parseISO(dataInicio))
    const end = endOfDay(parseISO(dataFim))
    const todayStart = startOfDay(new Date())
    const todayEnd = endOfDay(new Date())
    return agendamentos
      .filter((a) => {
        const d = new Date(a.data_hora)
        const inRange = d >= start && d <= end
        const notToday = d < todayStart || d > todayEnd
        return a.status === 'confirmado' && inRange && notToday
      })
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
  }, [agendamentos, dataInicio, dataFim, isHojeExato, todayStr])

  /* ── Próximos — sempre a partir de amanhã ── */
  const proximos = useMemo(() => {
    const amanha = startOfDay(addDays(new Date(), 1))
    return agendamentos
      .filter((a) => a.status === 'confirmado' && new Date(a.data_hora) >= amanha)
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
      .slice(0, 8)
  }, [agendamentos])

  /* ── Ações ── */
  async function cancelar(id: string) {
    setCancelando(id)
    const supabase = createClient()
    const ag = agendamentos.find((a) => a.id === id)
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: 'cancelado', cancelado_por: 'prestadora' })
      .eq('id', id)

    if (error) {
      toast.error('Erro ao cancelar')
    } else {
      if (ag) {
        const profNome = ag.profissionais?.nome ? ` com ${ag.profissionais.nome}` : ''
        const dt = formatDateShort(ag.data_hora)
        await supabase.from('notificacoes').insert({
          prestadora_id: prestadoraId,
          tipo: 'cancelamento',
          mensagem: `Você cancelou o agendamento de ${ag.clientes?.nome} - ${ag.servicos?.nome}${profNome} em ${dt}`,
        })
      }
      setAgendamentos((prev) => prev.map((a) => a.id === id ? { ...a, status: 'cancelado' } : a))
      toast.success('Agendamento cancelado')
    }
    setCancelando(null)
    setConfirmModalId(null)
  }

  async function concluir(id: string) {
    setConcluindoId(id)
    const supabase = createClient()
    const { error } = await supabase.from('agendamentos').update({ status: 'concluido' }).eq('id', id)
    if (error) {
      toast.error('Erro ao concluir')
    } else {
      setAgendamentos((prev) => prev.map((a) => a.id === id ? { ...a, status: 'concluido' } : a))
      toast.success('Atendimento concluído! ✓')
    }
    setConcluindoId(null)
  }

  const itemProps = {
    waOpenId, setWaOpenId, concluindoId, concluir, setConfirmModalId,
    prestadoraNome: nomeUsuario, msgConfirmacao, msgCancelamento, msgLembrete,
  }

  /* ── Agenda do período — label do card ── */
  const agendaPeriodoLabel = quickSel === '7d' ? 'Agenda — últimos 7 dias'
    : quickSel === '30d' ? 'Agenda — últimos 30 dias'
    : `Agenda — ${dataInicio.slice(8)}/${dataInicio.slice(5, 7)} a ${dataFim.slice(8)}/${dataFim.slice(5, 7)}`

  return (
    <div className="space-y-6" onClick={() => waOpenId && setWaOpenId(null)}>

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-gray-900">Painel</h1>
          <p className="text-gray-500 text-sm mt-1 capitalize">{dataHoje}</p>
        </div>

        {/* Filtro de período */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botões rápidos */}
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

          {/* Date pickers */}
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

      {/* ── Cards de métricas ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-rose-50 p-2.5 rounded-xl">
                <Calendar className="w-5 h-5 text-rose-400" />
              </div>
              <Badge variant="pink">{periodoLabel}</Badge>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalPeriodo}</p>
            <p className="text-sm text-gray-500 mt-1">Agendamentos</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-emerald-50 p-2.5 rounded-xl">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <Badge variant="success">Estimado</Badge>
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(receitaPeriodo)}</p>
            <p className="text-sm text-gray-500 mt-1">Receita — {periodoLabel.toLowerCase()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-50 p-2.5 rounded-xl">
                <Clock className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {formatHorario(horario.abertura)} – {formatHorario(horario.fechamento)}
            </p>
            <p className="text-sm text-gray-500 mt-1">Horário de funcionamento</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Agenda de hoje ── */}
      <Card>
        <CardHeader>
          <CardTitle>Agenda de hoje</CardTitle>
        </CardHeader>
        <CardContent>
          {agendaHoje.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum agendamento confirmado para hoje</p>
            </div>
          ) : (
            <div className="space-y-1">
              {agendaHoje.map((a) => (
                <AgendamentoItem key={a.id} a={a} showDate={false} {...itemProps} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Agenda do período (excluindo hoje) ── */}
      {!isHojeExato && (
        <Card>
          <CardHeader>
            <CardTitle>{agendaPeriodoLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            {agendaPeriodo.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum agendamento confirmado neste período</p>
              </div>
            ) : (
              <div className="space-y-1">
                {agendaPeriodo.map((a) => (
                  <AgendamentoItem key={a.id} a={a} showDate={true} {...itemProps} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Próximos agendamentos ── */}
      {proximos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Próximos agendamentos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-50">
              {proximos.map((a) => (
                <div key={a.id} className="px-1">
                  <AgendamentoItem a={a} showDate={true} {...itemProps} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Modal cancelar ── */}
      <Modal open={!!confirmModalId} onClose={() => setConfirmModalId(null)} title="Cancelar agendamento?">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Essa ação não pode ser desfeita.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setConfirmModalId(null)} className="flex-1">Voltar</Button>
            <Button
              variant="danger"
              onClick={() => confirmModalId && cancelar(confirmModalId)}
              loading={!!cancelando}
              className="flex-1"
            >
              Cancelar agendamento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
