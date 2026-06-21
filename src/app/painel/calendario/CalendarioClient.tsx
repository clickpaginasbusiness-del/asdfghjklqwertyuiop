'use client'

import { AgendaDoDiaSection } from './AgendaDoDiaSection'
import type { AgendaSlotAg } from './page'
import type { Prestadora, HorarioFuncionamento } from '@/lib/types'

export default function CalendarioClient({
  prestadora,
  horariosFuncionamento,
  profissionais,
  agendamentos,
}: {
  prestadora: Prestadora
  horariosFuncionamento: HorarioFuncionamento[]
  profissionais: { id: string; nome: string }[]
  agendamentos: AgendaSlotAg[]
}) {
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold text-gray-900">Calendário</h1>

      <AgendaDoDiaSection
        prestadora={prestadora}
        horariosFuncionamento={horariosFuncionamento}
        profissionais={profissionais}
        agendamentos={agendamentos}
      />
    </div>
  )
}
