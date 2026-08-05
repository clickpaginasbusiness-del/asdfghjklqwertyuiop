import { AgendaDoDiaSection } from '@/app/painel/calendario/AgendaDoDiaSection'
import { DEMO_PRESTADORA, DEMO_HORARIOS_FUNCIONAMENTO, DEMO_PROFISSIONAIS, getDemoAgendamentos } from '@/lib/demoData'
import { CalendarioDemoHeader } from './CalendarioDemoHeader'

export default function CalendarioDemoPage() {
  const agendamentos = getDemoAgendamentos(new Date())
    .filter((a) => a.status !== 'cancelado')
    .map((a) => ({
      id: a.id,
      data_hora: a.data_hora,
      status: a.status,
      profissional_id: a.profissional_id,
      cliente_e_prestadora: a.cliente_e_prestadora,
      agendamento_manual: a.agendamento_manual,
      servicos: a.servicos ? { nome: a.servicos.nome, preco: a.servicos.preco, duracao_minutos: a.servicos.duracao_minutos } : null,
      clientes: a.clientes ? { nome: a.clientes.nome, telefone: a.clientes.telefone } : null,
      profissionais: a.profissionais ? { nome: a.profissionais.nome } : null,
    }))

  return (
    <div className="space-y-6">
      <CalendarioDemoHeader />

      <AgendaDoDiaSection
        prestadora={DEMO_PRESTADORA}
        horariosFuncionamento={DEMO_HORARIOS_FUNCIONAMENTO}
        profissionais={DEMO_PROFISSIONAIS.map((p) => ({ id: p.id, nome: p.nome }))}
        agendamentos={agendamentos}
      />
    </div>
  )
}
