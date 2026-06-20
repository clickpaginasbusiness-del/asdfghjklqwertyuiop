'use client'

import { Fragment, useMemo, useState } from 'react'
import { addDays, format, getDay, isSameDay, parseISO, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Phone, Scissors, UserCircle2, DollarSign } from 'lucide-react'
import { cn, formatCurrency, maskTelefone } from '@/lib/utils'
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
  const hoje = startOfDay(new Date())
  const [selectedDate, setSelectedDate] = useState(format(hoje, 'yyyy-MM-dd'))
  const [modalAg, setModalAg] = useState<AgendaSlotAg | null>(null)

  const diasFiltro = useMemo(
    () => Array.from({ length: DIAS_BUTTON }, (_, i) => addDays(hoje, i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const dataSelecionada = parseISO(selectedDate)
  const diaSemana = getDay(dataSelecionada)
  const horarioDoDia = horariosFuncionamento.find((h) => h.dia_semana === diaSemana)
  const ativo = horarioDoDia ? horarioDoDia.ativo : true
  const abertura = horarioDoDia?.hora_abertura ?? prestadora.hora_abertura
  const fechamento = horarioDoDia?.hora_fechamento ?? prestadora.hora_fechamento

  const slots = useMemo(
    () => (ativo ? gerarSlots(abertura, fechamento) : []),
    [ativo, abertura, fechamento]
  )

  const agendamentosDoDia = useMemo(
    () => agendamentos.filter((a) => isSameDay(parseISO(a.data_hora), dataSelecionada)),
    [agendamentos, dataSelecionada]
  )

  const colunas: ProfissionalLite[] = profissionais.length > 0
    ? profissionais
    : [{ id: 'solo', nome: prestadora.nome }]

  function agendamentoNoSlot(slot: string, colunaId: string): AgendaSlotAg | undefined {
    return agendamentosDoDia.find((a) => {
      const horaAg = format(parseISO(a.data_hora), 'HH:mm')
      if (horaAg !== slot) return false
      if (profissionais.length === 0) return true
      return a.profissional_id === colunaId
    })
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
            const valor = format(d, 'yyyy-MM-dd')
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
                <span className="capitalize">{format(d, 'EEE', { locale: ptBR })}</span>
                <span className="text-sm font-semibold">{format(d, 'dd/MM')}</span>
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
                {format(parseISO(modalAg.data_hora), "dd/MM/yyyy 'às' HH:mm")}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}
