import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AgendamentosClient from './AgendamentosClient'

export default async function AgendamentosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, nome, mensagem_confirmacao, mensagem_cancelamento, mensagem_lembrete')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  const [{ data: agendamentos }, { data: profissionais }] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('*, servicos(*), clientes(*), profissionais(*)')
      .eq('prestadora_id', prestadora.id)
      .eq('arquivado', false)
      .order('data_hora', { ascending: false }),
    supabase
      .from('profissionais')
      .select('*')
      .eq('prestadora_id', prestadora.id)
      .order('nome'),
  ])

  return (
    <AgendamentosClient
      agendamentos={agendamentos ?? []}
      profissionais={profissionais ?? []}
      prestadoraId={prestadora.id}
      prestadoraNome={prestadora.nome}
      msgConfirmacao={prestadora.mensagem_confirmacao}
      msgCancelamento={prestadora.mensagem_cancelamento}
      msgLembrete={prestadora.mensagem_lembrete}
    />
  )
}
