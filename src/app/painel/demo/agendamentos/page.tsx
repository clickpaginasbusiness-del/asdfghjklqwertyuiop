import AgendamentosDemoClient from './AgendamentosDemoClient'
import { DEMO_AGENDAMENTOS, DEMO_PROFISSIONAIS, DEMO_PRESTADORA } from '@/lib/demoData'

export default function AgendamentosDemoPage() {
  return (
    <AgendamentosDemoClient
      agendamentos={DEMO_AGENDAMENTOS}
      profissionais={DEMO_PROFISSIONAIS}
      prestadoraNome={DEMO_PRESTADORA.nome}
      msgConfirmacao={DEMO_PRESTADORA.mensagem_confirmacao}
      msgCancelamento={DEMO_PRESTADORA.mensagem_cancelamento}
      msgLembrete={DEMO_PRESTADORA.mensagem_lembrete}
    />
  )
}
