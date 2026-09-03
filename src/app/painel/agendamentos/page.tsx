import { redirect } from 'next/navigation'
import { getPrestadoraAutenticada } from '@/lib/painelAuth'
import AgendamentosClient from './AgendamentosClient'

export default async function AgendamentosPage() {
  const { supabase, prestadora } = await getPrestadoraAutenticada()
  if (!prestadora) redirect('/painel/login')

  const [{ data: agendamentos }, { data: profissionais }, { data: dadosPrestadora }] = await Promise.all([
    supabase
      .from('agendamentos')
      // clientes(*) traria senha_hash junto (coluna revogada de anon/authenticated
      // mas não de queries assim) -- lista explícita, sem notas/data_nascimento
      // que agora são por prestadora+cliente, não coluna global de clientes.
      .select('*, servicos(*), clientes(id, nome, telefone, cliente_manual, verificado_em, created_at), profissionais(*), planos_assinaturas(planos_prestadora(nome, desconto_tipo, desconto_valor)), caixa_prestadora(valor_bruto, status)')
      .eq('prestadora_id', prestadora.id)
      .eq('arquivado', false)
      .order('data_hora', { ascending: false }),
    supabase
      .from('profissionais')
      .select('*')
      .eq('prestadora_id', prestadora.id)
      .order('nome'),
    supabase
      .from('clientes_prestadora_dados')
      .select('cliente_id, notas, data_nascimento')
      .eq('prestadora_id', prestadora.id),
  ])

  const dadosPorCliente = new Map((dadosPrestadora ?? []).map((d) => [d.cliente_id, d]))
  const agendamentosComDados = (agendamentos ?? []).map((a) => {
    const cliente = a.clientes as unknown as { id: string; nome: string; telefone: string | null; cliente_manual: boolean; verificado_em: string | null; created_at: string } | null
    const dados = cliente ? dadosPorCliente.get(cliente.id) : null
    return {
      ...a,
      clientes: cliente ? { ...cliente, notas: dados?.notas ?? null, data_nascimento: dados?.data_nascimento ?? null } : null,
    }
  })

  return (
    <AgendamentosClient
      agendamentos={agendamentosComDados}
      profissionais={profissionais ?? []}
      prestadoraId={prestadora.id}
      prestadoraNome={prestadora.nome}
      msgConfirmacao={prestadora.mensagem_confirmacao}
      msgCancelamento={prestadora.mensagem_cancelamento}
      msgLembrete={prestadora.mensagem_lembrete}
    />
  )
}
