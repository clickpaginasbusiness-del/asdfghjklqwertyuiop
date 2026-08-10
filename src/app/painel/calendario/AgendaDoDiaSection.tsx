'use client'

import { Fragment, useMemo, useState } from 'react'
import { addDays, parseISO, startOfDay } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarDays, Phone, Scissors, UserCircle2, DollarSign, MessageCircle, CheckCheck } from 'lucide-react'
import { VoceBadge } from '@/components/painel/VoceBadge'
import { ManualBadge } from '@/components/painel/ManualBadge'
import { PlanoBadge } from '@/components/painel/PlanoBadge'
import { WhatsappAcoesMenu } from '@/components/painel/WhatsappAcoesMenu'
import { cancelarAgendamento, concluirAgendamento } from '@/lib/agendamentoAcoes'
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
  computeHorasDoDia,
} from '@/lib/utils'
import type { Prestadora, HorarioFuncionamento } from '@/lib/types'
import type { AgendaSlotAg, ProfissionalCalendario } from './page'
import toast from 'react-hot-toast'

const SLOT_MINUTOS = 30
const DIAS_BUTTON = 8

type ProfissionalLite = ProfissionalCalendario

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
  agendamentos: agendamentosIniciais,
}: {
  prestadora: Prestadora
  horariosFuncionamento: HorarioFuncionamento[]
  profissionais: ProfissionalLite[]
  agendamentos: AgendaSlotAg[]
}) {
  const hoje = startOfTodaySP()
  const [selectedDate, setSelectedDate] = useState(formatDateKey(hoje))
  const [agendamentos, setAgendamentos] = useState(agendamentosIniciais)
  const [modalAg, setModalAg] = useState<AgendaSlotAg | null>(null)
  const [confirmCancelar, setConfirmCancelar] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [concluindo, setConcluindo] = useState(false)
  const [waOpen, setWaOpen] = useState(false)

  const amanha = startOfDay(addDays(new Date(), 1))
  const passouAgendamento = modalAg ? new Date(modalAg.data_hora) < new Date() : false

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
  // horarios_funcionamento guarda DOIS turnos possíveis — hora_abertura/
  // hora_fechamento é o turno1 (ex.: manhã) e turno2_inicio/turno2_fim é um
  // turno2 opcional (ex.: tarde, depois do almoço). "fechamento" sozinho só
  // cobre o turno1 — se ignorado aqui, a grade nem gera linha pros horários
  // do turno2 (é exatamente o bug: sumia 12h-16h porque isso nunca gerava
  // slot nenhum, só apareciam os horários que por acaso tinham agendamento).
  const turno2FimDoDia = horarioDoDia?.turno2_fim ?? null
  const fechamentoGrade = turno2FimDoDia && turno2FimDoDia.slice(0, 5) > fechamento.slice(0, 5)
    ? turno2FimDoDia
    : fechamento

  const agendamentosDoDia = useMemo(
    () => agendamentos.filter((a) => formatDateKey(a.data_hora) === selectedDate),
    [agendamentos, selectedDate]
  )

  // Slots padrão de 30 em 30 min, cobrindo o envelope INTEIRO do
  // estabelecimento (abertura do turno1 até o fim do turno2, se houver) —
  // de propósito NÃO pula o intervalo entre os turnos: mesmo o horário de
  // almoço do estabelecimento deve aparecer como linha na grade (acinzentada
  // pra todo mundo via colunaIndisponivel), só não deve sumir. + horários
  // exatos de agendamentos que não caem nessa grade (ex.: 09:45) — sem isso
  // um agendamento fora do padrão de 30 min simplesmente não apareceria.
  // Sempre baseado no horário do ESTABELECIMENTO (nunca no de uma
  // profissional individual) — quem limita colunas específicas é
  // colunaIndisponivel, não a grade inteira.
  const slots = useMemo(() => {
    if (!ativo) return []
    const padrao = gerarSlots(abertura, fechamentoGrade)
    const horariosAgendados = agendamentosDoDia.map((a) => formatTime(a.data_hora))
    return Array.from(new Set([...padrao, ...horariosAgendados])).sort()
  }, [ativo, abertura, fechamentoGrade, agendamentosDoDia])

  const colunas: ProfissionalLite[] = profissionais.length > 0
    ? profissionais
    : [{ id: 'solo', nome: prestadora.nome, hora_abertura: null, hora_fechamento: null, dias_semana: null, intervalo_inicio: null, intervalo_fim: null }]

  function agendamentoNoSlot(slot: string, colunaId: string): AgendaSlotAg | undefined {
    return agendamentosDoDia.find((a) => {
      const horaAg = formatTime(a.data_hora)
      if (horaAg !== slot) return false
      if (profissionais.length === 0) return true
      return a.profissional_id === colunaId
    })
  }

  /** Slot fora do horário de trabalho dessa profissional especificamente —
   * a grade em si nunca encolhe, só a coluna dela fica bloqueada/acinzentada
   * nesses horários. computeHorasDoDia devolve dois turnos possíveis
   * (abertura/fechamento = turno1, turno2Inicio/turno2Fim = turno2 opcional
   * DEPOIS do intervalo) — são duas janelas váLIDAS somadas, não uma janela
   * com um buraco no meio. Disponível = dentro do turno1 OU dentro do
   * turno2; bloqueado é tudo que sobra (incluindo o intervalo entre eles). */
  function colunaIndisponivel(prof: ProfissionalLite, slot: string): boolean {
    if (prof.dias_semana && !prof.dias_semana.includes(diaSemana)) return true
    const horas = computeHorasDoDia(diaSemana, horariosFuncionamento, prof, prestadora.hora_abertura, prestadora.hora_fechamento)
    const dentroTurno1 = slot >= horas.abertura.slice(0, 5) && slot < horas.fechamento.slice(0, 5)
    const dentroTurno2 = !!(horas.turno2Inicio && horas.turno2Fim && slot >= horas.turno2Inicio.slice(0, 5) && slot < horas.turno2Fim.slice(0, 5))
    return !dentroTurno1 && !dentroTurno2
  }

  function formatFaixaHorario(ag: AgendaSlotAg): string {
    const inicio = parseISO(ag.data_hora)
    const fim = new Date(inicio.getTime() + (ag.servicos?.duracao_minutos ?? 30) * 60000)
    return `${formatTime(inicio)} - ${formatTime(fim)}`
  }

  function fecharModal() {
    setModalAg(null)
    setWaOpen(false)
    setConfirmCancelar(false)
  }

  async function handleCancelar() {
    if (!modalAg) return
    setCancelando(true)
    const res = await cancelarAgendamento(modalAg, prestadora.id)
    setCancelando(false)
    if (!res.ok) { toast.error(res.error); return }
    setAgendamentos((prev) => prev.map((a) => a.id === modalAg.id ? { ...a, status: 'cancelado' as const } : a))
    toast.success('Agendamento cancelado')
    fecharModal()
  }

  async function handleConcluir() {
    if (!modalAg) return
    setConcluindo(true)
    const res = await concluirAgendamento(modalAg.id)
    setConcluindo(false)
    if (!res.ok) { toast.error(res.error); return }
    setAgendamentos((prev) => prev.map((a) => a.id === modalAg.id ? { ...a, status: 'concluido' as const } : a))
    setModalAg((prev) => prev ? { ...prev, status: 'concluido' as const } : prev)
    toast.success('Atendimento concluído! ✓')
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
                    const bloqueado = !ag && profissionais.length > 0 && colunaIndisponivel(c, slot)
                    return (
                      <button
                        key={c.id}
                        disabled={!ag}
                        onClick={() => ag && setModalAg(ag)}
                        title={bloqueado ? 'Fora do horário de trabalho dessa profissional' : undefined}
                        className={cn(
                          'rounded-lg px-2 py-1.5 text-left text-xs transition-colors min-h-11',
                          ag
                            ? 'bg-rose-50 border border-rose-200 hover:bg-rose-100 cursor-pointer'
                            : bloqueado
                              ? 'bg-gray-100 border border-gray-200 text-gray-300 cursor-not-allowed'
                              : 'bg-gray-50 border border-gray-100 text-gray-300'
                        )}
                        style={bloqueado ? { backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 4px, transparent 4px, transparent 8px)' } : undefined}
                      >
                        {ag ? (
                          <>
                            <p className="font-medium text-rose-700 truncate">
                              {ag.clientes?.nome}
                              {ag.cliente_e_prestadora && <VoceBadge />}
                              {ag.agendamento_manual && <ManualBadge />}
                              {ag.planos_assinaturas?.planos_prestadora?.nome && <PlanoBadge nome={ag.planos_assinaturas.planos_prestadora.nome} />}
                            </p>
                            <p className="text-[11px] text-rose-500 truncate">{ag.servicos?.nome}</p>
                            <p className="text-[10px] text-rose-400">{formatFaixaHorario(ag)}</p>
                          </>
                        ) : bloqueado ? null : (
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
      <Modal open={!!modalAg} onClose={fecharModal} title="Detalhes do agendamento">
        {modalAg && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">
                {modalAg.clientes?.nome}
                {modalAg.cliente_e_prestadora && <VoceBadge />}
                {modalAg.agendamento_manual && <ManualBadge />}
                {modalAg.planos_assinaturas?.planos_prestadora?.nome && <PlanoBadge nome={modalAg.planos_assinaturas.planos_prestadora.nome} />}
              </p>
              <Badge variant={modalAg.status === 'concluido' ? 'concluido' : modalAg.status === 'aguardando_pagamento' ? 'warning' : 'success'}>
                {modalAg.status === 'concluido' ? 'Concluído' : modalAg.status === 'aguardando_pagamento' ? 'Aguardando pagamento' : 'Confirmado'}
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
              {modalAg.clientes?.notas && (
                <p className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  <span className="shrink-0">📝</span>
                  {modalAg.clientes.notas}
                </p>
              )}
            </div>

            {modalAg.status === 'confirmado' && (
              <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-gray-100">
                {modalAg.clientes?.telefone && (
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setWaOpen((v) => !v) }}
                      className="flex items-center gap-1 bg-green-50 hover:bg-green-100 border border-green-100 text-green-600 rounded-full px-2.5 min-h-11 text-xs font-medium transition-colors"
                    >
                      <MessageCircle className="w-3 h-3" />
                      WhatsApp
                    </button>
                    {waOpen && (
                      <WhatsappAcoesMenu
                        agendamento={modalAg}
                        telefone={modalAg.clientes.telefone}
                        prestadoraNome={prestadora.nome}
                        msgConfirmacao={prestadora.mensagem_confirmacao}
                        msgCancelamento={prestadora.mensagem_cancelamento}
                        msgLembrete={prestadora.mensagem_lembrete}
                        amanha={amanha}
                        onClose={() => setWaOpen(false)}
                      />
                    )}
                  </div>
                )}

                <button
                  onClick={() => passouAgendamento && !concluindo && handleConcluir()}
                  disabled={!passouAgendamento || concluindo}
                  title={!passouAgendamento ? 'Disponível após o horário do atendimento' : 'Marcar como concluído'}
                  className={cn(
                    'flex items-center gap-1 text-xs rounded-lg px-2.5 font-medium transition-all border min-h-11',
                    passouAgendamento
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
                      : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                  )}
                >
                  <CheckCheck className="w-3 h-3" />
                  {concluindo ? '...' : 'Concluído'}
                </button>

                <button
                  onClick={() => setConfirmCancelar(true)}
                  className="text-xs text-red-400 hover:text-red-500 transition-colors px-2.5 min-h-11 ml-auto"
                >
                  Cancelar agendamento
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal confirmar cancelamento */}
      <Modal open={confirmCancelar} onClose={() => setConfirmCancelar(false)} title="Cancelar agendamento?">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Essa ação não pode ser desfeita.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setConfirmCancelar(false)} className="flex-1">
              Voltar
            </Button>
            <Button variant="danger" onClick={handleCancelar} loading={cancelando} className="flex-1">
              Cancelar agendamento
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
