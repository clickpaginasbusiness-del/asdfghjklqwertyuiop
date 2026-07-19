import { AgendaDoDiaSection } from '@/app/painel/calendario/AgendaDoDiaSection'
import { DEMO_PRESTADORA, DEMO_HORARIOS_FUNCIONAMENTO, DEMO_PROFISSIONAIS, DEMO_AGENDAMENTOS } from '@/lib/demoData'

export default function CalendarioDemoPage() {
  const agendamentos = DEMO_AGENDAMENTOS
    .filter((a) => a.status !== 'cancelado')
    .map((a) => ({
      id: a.id,
      data_hora: a.data_hora,
      status: a.status,
      profissional_id: a.profissional_id,
      servicos: a.servicos ? { nome: a.servicos.nome, preco: a.servicos.preco, duracao_minutos: a.servicos.duracao_minutos } : null,
      clientes: a.clientes ? { nome: a.clientes.nome, telefone: a.clientes.telefone } : null,
      profissionais: a.profissionais ? { nome: a.profissionais.nome } : null,
    }))

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold text-gray-900">Calendário</h1>

      <AgendaDoDiaSection
        prestadora={DEMO_PRESTADORA}
        horariosFuncionamento={DEMO_HORARIOS_FUNCIONAMENTO}
        profissionais={DEMO_PROFISSIONAIS.map((p) => ({ id: p.id, nome: p.nome }))}
        agendamentos={agendamentos}
      />
    </div>
  )
}
