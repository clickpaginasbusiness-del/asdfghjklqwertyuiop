'use client'

import { Fragment, useMemo, useState } from 'react'
import { parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Phone, Scissors, UserCircle2, DollarSign } from 'lucide-react'
import {
  cn,
  formatCurrency,
  maskTelefone,
  formatTime,
  formatDateTime,
  formatDateKey,
  formatDayMonth,
  formatWeekdayShort,
  startOfTodaySP,
  dateKeyToDate,
} from '@/lib/utils'
import type { Prestadora, HorarioFuncionamento } from '@/lib/types'
import type { AgendaSlotAg } from './page'

const SLOT_MINUTOS = 30
const DIAS_BUTTON = 8

interface ProfissionalLite {
  id: string
  nome: string
}

function gerarSlots(abertura: string, fechamento: string): string[] {
  const [hAb, mAb] = abertura.slice(0, 5).split(':').map(Number)
  const [hFe, mFe] = fechamento.slice(0, 5).split(':').map(Number)
  const inicioMin = hAb * 60 + mAb
  const fimMin = hFe * 60 + mFe
  const slots: string[] = []
  for (let m = inicioMin; m < fimMin; m += SLOT_MINUTOS) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }
  return slots
}

export function AgendaDoDiaSection({
  prestadora,
  horariosFuncionamento,
  profissionais,
  agendamentos,
}: {
  prestadora: Prestadora
  horariosFuncionamento: HorarioFuncionamento[]
  profissionais: ProfissionalLite[]
  agendamentos: AgendaSlotAg[]
}) {
  const hoje = startOfTodaySP()
  const [selectedDate, setSelectedDate] = useState(formatDateKey(hoje))
  const [modalAg, setModalAg] = useState<AgendaSlotAg | null>(null)

  const diasFiltro = useMemo(
    () => Array.from({ length: DIAS_BUTTON }, (_, i) => new Date(hoje.getTime() + i * 86400000)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const dataSelecionada = dateKeyToDate(selectedDate)
  const diaSemana = dataSelecionada.getUTCDay()
  const horarioDoDia = horariosFuncionamento.find((h) => h.dia_semana === diaSemana)
  const ativo = horarioDoDia ? horarioDoDia.ativo : true
  const abertura = horarioDoDia?.hora_abertura ?? prestadora.hora_abertura
  const fechamento = horarioDoDia?.hora_fechamento ?? prestadora.hora_fechamento

  const agendamentosDoDia = useMemo(
    () => agendamentos.filter((a) => formatDateKey(a.data_hora) === selectedDate),
    [agendamentos, selectedDate]
  )

  // Slots padrão de 30 em 30 min (mostram os horários livres) + horários
  // exatos de agendamentos que não caem nessa grade (ex.: 09:45) — sem isso
  // um agendamento fora do padrão de 30 min simplesmente não apareceria.
  const slots = useMemo(() => {
    if (!ativo) return []
    const padrao = gerarSlots(abertura, fechamento)
    const horariosAgendados = agendamentosDoDia.map((a) => formatTime(a.data_hora))
    return Array.from(new Set([...padrao, ...horariosAgendados])).sort()
  }, [ativo, abertura, fechamento, agendamentosDoDia])

  const colunas: ProfissionalLite[] = profissionais.length > 0
    ? profissionais
    : [{ id: 'solo', nome: prestadora.nome }]

  function agendamentoNoSlot(slot: string, colunaId: string): AgendaSlotAg | undefined {
    return agendamentosDoDia.find((a) => {
      const horaAg = formatTime(a.data_hora)
      if (horaAg !== slot) return false
      if (profissionais.length === 0) return true
      return a.profissional_id === colunaId
    })
  }

  function formatFaixaHorario(ag: AgendaSlotAg): string {
    const inicio = parseISO(ag.data_hora)
    const fim = new Date(inicio.getTime() + (ag.servicos?.duracao_minutos ?? 30) * 60000)
    return `${formatTime(inicio)} - ${formatTime(fim)}`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-rose-400" />
          <CardTitle>Agenda</CardTitle>
        </div>
        <p className="text-sm text-gray-400">Veja os horários ocupados e livres de cada dia</p>
      </CardHeader>
      <CardContent>
        {/* Filtro de dias */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 -mx-1 px-1">
          {diasFiltro.map((d) => {
            const valor = formatDateKey(d)
            const selecionado = valor === selectedDate
            return (
              <button
                key={valor}
                onClick={() => setSelectedDate(valor)}
                className={cn(
                  'shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium transition-all min-w-14',
                  selecionado ? 'bg-rose-400 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <span className="capitalize">{formatWeekdayShort(d)}</span>
                <span className="text-sm font-semibold">{formatDayMonth(d)}</span>
              </button>
            )
          })}
        </div>

        {!ativo ? (
          <div className="text-center py-10 text-gray-400">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Fechado neste dia</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid gap-1 min-w-fit"
              style={{ gridTemplateColumns: `4.5rem repeat(${colunas.length}, minmax(9rem, 1fr))` }}
            >
              {/* Cabeçalho com nomes das profissionais */}
              {profissionais.length > 0 && (
                <>
                  <div />
                  {colunas.map((c) => (
                    <div key={c.id} className="text-xs font-semibold text-gray-500 px-2 pb-1 truncate">
                      {c.nome}
                    </div>
                  ))}
                </>
              )}

              {slots.map((slot) => (
                <Fragment key={slot}>
                  <div className="text-xs text-gray-400 font-medium flex items-center px-1">{slot}</div>
                  {colunas.map((c) => {
                    const ag = agendamentoNoSlot(slot, c.id)
                    return (
                      <button
                        key={c.id}
                        disabled={!ag}
                        onClick={() => ag && setModalAg(ag)}
                        className={cn(
                          'rounded-lg px-2 py-1.5 text-left text-xs transition-colors min-h-11',
                          ag
                            ? 'bg-rose-50 border border-rose-200 hover:bg-rose-100 cursor-pointer'
                            : 'bg-gray-50 border border-gray-100 text-gray-300'
                        )}
                      >
                        {ag ? (
                          <>
                            <p className="font-medium text-rose-700 truncate">{ag.clientes?.nome}</p>
                            <p className="text-[11px] text-rose-500 truncate">{ag.servicos?.nome}</p>
                            <p className="text-[10px] text-rose-400">{formatFaixaHorario(ag)}</p>
                          </>
                        ) : (
                          <span>—</span>
                        )}
                      </button>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Modal de detalhes */}
      <Modal open={!!modalAg} onClose={() => setModalAg(null)} title="Detalhes do agendamento">
        {modalAg && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">{modalAg.clientes?.nome}</p>
              <Badge variant={modalAg.status === 'concluido' ? 'concluido' : 'success'}>
                {modalAg.status === 'concluido' ? 'Concluído' : 'Confirmado'}
              </Badge>
            </div>
            <div className="space-y-2.5 text-sm text-gray-600">
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                {modalAg.clientes?.telefone ? maskTelefone(modalAg.clientes.telefone) : '—'}
              </p>
              <p className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-gray-400 shrink-0" />
                {modalAg.servicos?.nome ?? '—'}
              </p>
              <p className="flex items-center gap-2">
                <UserCircle2 className="w-4 h-4 text-gray-400 shrink-0" />
                {modalAg.profissionais?.nome ?? 'Sem profissional definido'}
              </p>
              <p className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400 shrink-0" />
                {formatCurrency(modalAg.servicos?.preco ?? 0)}
              </p>
              <p className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
                {formatDateTime(modalAg.data_hora)}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}
