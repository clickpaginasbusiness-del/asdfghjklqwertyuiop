import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import SucessoClient from './SucessoClient'

export const metadata = { title: 'Agendamento confirmado — BelleBook' }

export default async function AgendamentoSucessoPage({
  searchParams,
}: {
  searchParams: Promise<{ agendamento_id?: string }>
}) {
  const { agendamento_id: agendamentoId } = await searchParams
  if (!agendamentoId) redirect('/')

  const admin = createAdminClient()

  const { data: agendamento } = await admin
    .from('agendamentos')
    .select(`
      id, status, data_hora,
      servicos(nome, duracao_minutos),
      profissionais(nome),
      prestadoras(nome, slug)
    `)
    .eq('id', agendamentoId)
    .maybeSingle()

  if (!agendamento) redirect('/')

  const servico = agendamento.servicos as unknown as { nome: string; duracao_minutos: number } | null
  const profissional = agendamento.profissionais as unknown as { nome: string } | null
  const prestadora = agendamento.prestadoras as unknown as { nome: string; slug: string } | null

  if (!servico || !prestadora) redirect('/')

  return (
    <SucessoClient
      status={agendamento.status}
      dataHora={agendamento.data_hora}
      duracaoMinutos={servico.duracao_minutos}
      servicoNome={servico.nome}
      profissionalNome={profissional?.nome ?? null}
      prestadoraNome={prestadora.nome}
      prestadoraSlug={prestadora.slug}
    />
  )
}
