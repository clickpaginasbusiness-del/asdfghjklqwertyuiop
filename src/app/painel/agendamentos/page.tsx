import { redirect } from 'next/navigation'
import { getPrestadoraAutenticada } from '@/lib/painelAuth'
import AgendamentosClient from './AgendamentosClient'

export default async function AgendamentosPage() {
  const { supabase, prestadora } = await getPrestadoraAutenticada()
  if (!prestadora) redirect('/painel/login')

  const [{ data: agendamentos }, { data: profissionais }] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('*, servicos(*), clientes(*), profissionais(*), planos_assinaturas(planos_prestadora(nome, desconto_tipo, desconto_valor)), caixa_prestadora(valor_bruto, status)')
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
