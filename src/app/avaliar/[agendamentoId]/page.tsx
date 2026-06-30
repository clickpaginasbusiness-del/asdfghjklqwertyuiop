import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import AvaliarClient from './AvaliarClient'

export default async function AvaliarPage({ params }: { params: Promise<{ agendamentoId: string }> }) {
  const { agendamentoId } = await params
  const supabase = await createClient()

  const { data: agendamento } = await supabase
    .from('agendamentos')
    .select('*, servicos(nome), profissionais(nome), prestadoras(nome, cor_tema, foto_url)')
    .eq('id', agendamentoId)
    .single()

  if (!agendamento) notFound()

  const { data: avaliacaoExistente } = await supabase
    .from('avaliacoes')
    .select('*')
    .eq('agendamento_id', agendamentoId)
    .maybeSingle()

  return (
    <AvaliarClient
      agendamentoId={agendamentoId}
      prestadoraNome={agendamento.prestadoras?.nome ?? ''}
      corTema={agendamento.prestadoras?.cor_tema ?? null}
      servicoNome={agendamento.servicos?.nome ?? ''}
      profissionalNome={agendamento.profissionais?.nome ?? null}
      jaAvaliado={!!avaliacaoExistente}
    />
  )
}
