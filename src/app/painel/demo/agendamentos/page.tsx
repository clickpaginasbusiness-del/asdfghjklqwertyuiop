import AgendamentosDemoClient from './AgendamentosDemoClient'
import { getDemoAgendamentos, DEMO_PROFISSIONAIS, DEMO_PRESTADORA } from '@/lib/demoData'

export default function AgendamentosDemoPage() {
  return (
    <AgendamentosDemoClient
      agendamentos={getDemoAgendamentos(new Date())}
      profissionais={DEMO_PROFISSIONAIS}
      prestadoraNome={DEMO_PRESTADORA.nome}
      msgConfirmacao={DEMO_PRESTADORA.mensagem_confirmacao}
      msgCancelamento={DEMO_PRESTADORA.mensagem_cancelamento}
      msgLembrete={DEMO_PRESTADORA.mensagem_lembrete}
    />
  )
}
