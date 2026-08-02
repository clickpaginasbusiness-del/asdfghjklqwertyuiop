import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ADMIN_EMAIL } from '@/lib/admin'
import AssinaturaClient from './AssinaturaClient'

export const metadata = { title: 'Assinatura — BelleBook' }

export default async function AssinaturaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, plano, assinatura_ativa, trial_fim, e_trial, mp_periodo_fim, mp_metodo_pagamento, mp_ciclo, mp_pagamento_pendente_id, cancelamento_agendado')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  return (
    <AssinaturaClient
      plano={(prestadora.plano as 'basico' | 'pro' | null) ?? null}
      assinaturaAtiva={prestadora.assinatura_ativa}
      trialFim={prestadora.trial_fim}
      periodoFim={prestadora.mp_periodo_fim}
      metodoPagamento={prestadora.mp_metodo_pagamento as 'cartao' | 'pix' | 'debito' | null}
      cicloAtual={(prestadora.mp_ciclo as 'mensal' | 'anual') ?? 'mensal'}
      cancelamentoAgendado={prestadora.cancelamento_agendado}
      linkPagamentoPendente={prestadora.mp_pagamento_pendente_id ? `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${prestadora.mp_pagamento_pendente_id}` : null}
      eTrial={Boolean(prestadora.e_trial)}
      isAdmin={user.email === ADMIN_EMAIL}
    />
  )
}
