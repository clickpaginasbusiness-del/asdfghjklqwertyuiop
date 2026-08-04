import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularValorSinal } from '@/lib/sinal'
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
      id, status, data_hora,
      servicos(nome, preco, sinal_tipo, sinal_valor, sinal_obrigatorio, aceitar_pagamento_online),
      profissionais(nome),
      prestadoras(nome, slug)
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

  if (!servico?.aceitar_pagamento_online || !prestadora) redirect('/')

  const valor = servico.sinal_obrigatorio
    ? calcularValorSinal(servico.preco, servico.sinal_tipo, servico.sinal_valor)
    : servico.preco

  return (
    <CheckoutClient
      agendamentoId={agendamento.id}
      status={agendamento.status}
      dataHora={agendamento.data_hora}
      servicoNome={servico.nome}
      profissionalNome={profissional?.nome ?? null}
      prestadoraNome={prestadora.nome}
      prestadoraSlug={prestadora.slug}
      ehSinal={servico.sinal_obrigatorio}
      valor={valor}
      mostrarAguardandoConfirmacao={pendente === 'true'}
      mostrarErroPagamento={erro === 'pagamento'}
    />
  )
}
