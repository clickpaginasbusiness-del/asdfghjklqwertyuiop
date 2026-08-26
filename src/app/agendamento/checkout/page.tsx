import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularValorFinalAgendamento, type DescontoPlano } from '@/lib/sinal'
import CheckoutClient from './CheckoutClient'

export const metadata = { title: 'Confirmar pagamento — BelleBook' }

export default async function AgendamentoCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ agendamento_temp?: string; pendente?: string; erro?: string }>
}) {
  const { agendamento_temp: agendamentoId, pendente, erro } = await searchParams
  if (!agendamentoId) redirect('/')

  const admin = createAdminClient()

  const { data: agendamento } = await admin
    .from('agendamentos')
    .select(`
      id, status, data_hora, plano_assinatura_id, tipo_pagamento,
      servicos(nome, preco, sinal_tipo, sinal_valor, sinal_obrigatorio, aceitar_pagamento_online),
      profissionais(nome),
      prestadoras(nome, slug),
      planos_assinaturas(plano:planos_prestadora(desconto_tipo, desconto_valor))
    `)
    .eq('id', agendamentoId)
    .maybeSingle()

  if (!agendamento) redirect('/')

  const servico = agendamento.servicos as unknown as {
    nome: string; preco: number; sinal_tipo: 'fixo' | 'percentual' | null; sinal_valor: number | null
    sinal_obrigatorio: boolean; aceitar_pagamento_online: boolean
  } | null
  const profissional = agendamento.profissionais as unknown as { nome: string } | null
  const prestadora = agendamento.prestadoras as unknown as { nome: string; slug: string } | null
  const planoAssinatura = agendamento.planos_assinaturas as unknown as
    { plano: { desconto_tipo: 'percentual' | 'fixo'; desconto_valor: number } | null } | null

  if (!servico?.aceitar_pagamento_online || !prestadora) redirect('/')

  const desconto: DescontoPlano | null = planoAssinatura?.plano
    ? { tipo: planoAssinatura.plano.desconto_tipo, valor: planoAssinatura.plano.desconto_valor }
    : null

  // tipo_pagamento é a fonte de verdade da escolha da cliente; só cai pra
  // sinal_obrigatorio quando vem null (agendamento criado antes da Fase 5).
  const cobrarSinal = agendamento.tipo_pagamento
    ? agendamento.tipo_pagamento === 'sinal'
    : servico.sinal_obrigatorio

  // Mesma fórmula de /api/agendamentos/pagar — desconto sempre sobre o preço
  // cheio; sinal nunca é afetado por desconto (o desconto do plano existe
  // pra reduzir o valor do SERVIÇO, não a reserva de compromisso do sinal —
  // só se realiza quando o valor cobrado é o completo).
  const { valorACobrar } = calcularValorFinalAgendamento(
    servico.preco, servico.sinal_tipo, servico.sinal_valor, cobrarSinal, desconto
  )

  return (
    <CheckoutClient
      agendamentoId={agendamento.id}
      status={agendamento.status}
      dataHora={agendamento.data_hora}
      servicoNome={servico.nome}
      profissionalNome={profissional?.nome ?? null}
      prestadoraNome={prestadora.nome}
      prestadoraSlug={prestadora.slug}
      ehSinal={cobrarSinal}
      valor={valorACobrar}
      mostrarAguardandoConfirmacao={pendente === 'true'}
      mostrarErroPagamento={erro === 'pagamento'}
    />
  )
}
