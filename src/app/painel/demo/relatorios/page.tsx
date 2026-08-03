import RelatoriosClient from '@/app/painel/relatorios/RelatoriosClient'
import { getDemoAgendamentos, DEMO_PROFISSIONAIS, DEMO_AVALIACOES, DEMO_VISITAS_PAGINA, DEMO_PRESTADORA } from '@/lib/demoData'

export default function RelatoriosDemoPage() {
  const agendamentos = getDemoAgendamentos(new Date()).map((a) => ({
    id: a.id,
    data_hora: a.data_hora,
    created_at: a.created_at,
    status: a.status,
    servicos: a.servicos ? { nome: a.servicos.nome, preco: a.servicos.preco } : null,
    clientes: a.clientes ? { id: a.clientes.id, nome: a.clientes.nome } : null,
    profissionais: a.profissionais ? { nome: a.profissionais.nome } : null,
  }))

  return (
    <RelatoriosClient
      plano="pro"
      prestadoraId={DEMO_PRESTADORA.id}
      agendamentos={agendamentos}
      profissionais={DEMO_PROFISSIONAIS.map((p) => ({ id: p.id, nome: p.nome }))}
      visitas={DEMO_VISITAS_PAGINA}
      avaliacoes={DEMO_AVALIACOES}
      lancamentos={[]}
      horaAbertura={DEMO_PRESTADORA.hora_abertura}
      horaFechamento={DEMO_PRESTADORA.hora_fechamento}
      eParceira={false}
      codigoIndicacao={null}
      resumoParceira={null}
    />
  )
}
