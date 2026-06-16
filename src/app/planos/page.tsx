import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlanosClient from './PlanosClient'

export const metadata = {
  title: 'Planos — NailBook',
  description: 'Escolha o plano ideal para o seu estúdio de nail design',
}

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const params = await searchParams

  let prestadora: {
    id: string
    plano: string | null
    assinatura_ativa: boolean
    trial_fim: string | null
    e_trial: boolean
    stripe_subscription_id: string | null
  } | null = null

  if (user) {
    const { data } = await supabase
      .from('prestadoras')
      .select('id, plano, assinatura_ativa, trial_fim, e_trial, stripe_subscription_id')
      .eq('user_id', user.id)
      .single()

    prestadora = data

    // Redireciona pro painel somente se tiver assinatura PAGA ativa (não trial gratuito)
    const isActivePaid = prestadora?.assinatura_ativa && !prestadora?.e_trial
    if (isActivePaid) redirect('/painel')
  }

  const cicloInicial = params.ciclo === 'anual' ? 'anual' : 'mensal'
  const eTrial = Boolean(prestadora?.e_trial && !prestadora?.stripe_subscription_id)

  return (
    <PlanosClient
      isLoggedIn={!!user}
      planoAtual={(prestadora?.plano as 'basico' | 'pro' | null) ?? null}
      cicloInicial={cicloInicial}
      eTrial={eTrial}
    />
  )
}
