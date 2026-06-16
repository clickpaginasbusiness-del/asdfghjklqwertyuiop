import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { stripe, isAnualByPrice } from '@/lib/stripe'
import AssinaturaClient from './AssinaturaClient'

export const metadata = { title: 'Assinatura — NailBook' }

export default async function AssinaturaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, plano, assinatura_ativa, trial_fim, stripe_subscription_id, stripe_customer_id, e_trial')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  let periodoFim: string | null = null
  let stripeStatus: string | null = null
  let cancelAtPeriodEnd = false
  let cicloAtual: 'mensal' | 'anual' = 'mensal'

  if (prestadora.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(prestadora.stripe_subscription_id)
      const item = sub.items.data[0]
      const itemEnd = item?.current_period_end
      periodoFim = itemEnd ? new Date(itemEnd * 1000).toISOString() : null
      stripeStatus = sub.status
      cancelAtPeriodEnd = sub.cancel_at_period_end
      cicloAtual = isAnualByPrice(item?.price?.id ?? '') ? 'anual' : 'mensal'
    } catch {
      // Subscription pode ter sido deletada; continua sem crash
    }
  }

  return (
    <AssinaturaClient
      plano={(prestadora.plano as 'basico' | 'pro' | null) ?? null}
      assinaturaAtiva={prestadora.assinatura_ativa}
      trialFim={prestadora.trial_fim}
      periodoFim={periodoFim}
      stripeStatus={stripeStatus}
      cancelAtPeriodEnd={cancelAtPeriodEnd}
      temCustomer={!!prestadora.stripe_customer_id}
      cicloAtual={cicloAtual}
      eTrial={Boolean(prestadora.e_trial)}
    />
  )
}
