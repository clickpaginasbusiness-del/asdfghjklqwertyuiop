'use client'

import { AgendaDoDiaSection } from './AgendaDoDiaSection'
import { AgendarButton } from '@/components/painel/AgendarButton'
import type { AgendaSlotAg, ProfissionalCalendario } from './page'
import type { Prestadora, HorarioFuncionamento } from '@/lib/types'

export default function CalendarioClient({
  prestadora,
  horariosFuncionamento,
  profissionais,
  agendamentos,
}: {
  prestadora: Prestadora
  horariosFuncionamento: HorarioFuncionamento[]
  profissionais: ProfissionalCalendario[]
  agendamentos: AgendaSlotAg[]
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Calendário</h1>
        <AgendarButton prestadoraId={prestadora.id} />
      </div>

      <AgendaDoDiaSection
        prestadora={prestadora}
        horariosFuncionamento={horariosFuncionamento}
        profissionais={profissionais}
        agendamentos={agendamentos}
      />
    </div>
  )
}
