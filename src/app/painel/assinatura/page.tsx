import { redirect } from 'next/navigation'
import { getPrestadoraAutenticada } from '@/lib/painelAuth'
import { ADMIN_EMAIL } from '@/lib/admin'
import type { Plano } from '@/lib/mercadopago'
import AssinaturaClient from './AssinaturaClient'

export const metadata = { title: 'Assinatura — BelleBook' }

export default async function AssinaturaPage() {
  const { user, prestadora } = await getPrestadoraAutenticada()
  if (!prestadora) redirect('/painel/login')

  return (
    <AssinaturaClient
      plano={(prestadora.plano as Plano | null) ?? null}
      assinaturaAtiva={prestadora.assinatura_ativa}
      trialFim={prestadora.trial_fim}
      periodoFim={prestadora.mp_periodo_fim}
      metodoPagamento={prestadora.mp_metodo_pagamento as 'cartao' | 'pix' | 'debito' | null}
      cicloAtual={(prestadora.mp_ciclo as 'mensal' | 'anual') ?? 'mensal'}
      cancelamentoAgendado={prestadora.cancelamento_agendado}
      linkPagamentoPendente={prestadora.mp_pagamento_pendente_id ? `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${prestadora.mp_pagamento_pendente_id}` : null}
      eTrial={Boolean(prestadora.e_trial)}
      eParceira={Boolean(prestadora.e_parceira)}
      isAdmin={user.email === ADMIN_EMAIL}
    />
  )
}
