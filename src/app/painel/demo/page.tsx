import DemoDashboardClient from './DemoDashboardClient'
import { DEMO_AGENDAMENTOS, DEMO_PRESTADORA } from '@/lib/demoData'

export default function PainelDemoPage() {
  return (
    <DemoDashboardClient
      agendamentos={DEMO_AGENDAMENTOS}
      horarioAbertura={DEMO_PRESTADORA.hora_abertura}
      horarioFechamento={DEMO_PRESTADORA.hora_fechamento}
      nomeUsuario={DEMO_PRESTADORA.nome}
      msgConfirmacao={DEMO_PRESTADORA.mensagem_confirmacao}
      msgCancelamento={DEMO_PRESTADORA.mensagem_cancelamento}
      msgLembrete={DEMO_PRESTADORA.mensagem_lembrete}
    />
  )
}
