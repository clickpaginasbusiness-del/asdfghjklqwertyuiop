import RelatoriosClient from '@/app/painel/relatorios/RelatoriosClient'
import { DEMO_AGENDAMENTOS, DEMO_PROFISSIONAIS, DEMO_AVALIACOES, DEMO_VISITAS_PAGINA, DEMO_PRESTADORA } from '@/lib/demoData'

export default function RelatoriosDemoPage() {
  const agendamentos = DEMO_AGENDAMENTOS.map((a) => ({
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
      agendamentos={agendamentos}
      profissionais={DEMO_PROFISSIONAIS.map((p) => ({ id: p.id, nome: p.nome }))}
      visitas={DEMO_VISITAS_PAGINA}
      avaliacoes={DEMO_AVALIACOES}
      horaAbertura={DEMO_PRESTADORA.hora_abertura}
      horaFechamento={DEMO_PRESTADORA.hora_fechamento}
    />
  )
}
