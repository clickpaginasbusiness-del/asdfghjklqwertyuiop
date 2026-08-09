import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlanosClient from './PlanosClient'
import { SITE_URL } from '@/lib/seo'
import type { Plano } from '@/lib/mercadopago'

const PLANOS_VALIDOS: Plano[] = ['start', 'pro', 'studio', 'studio_pro']

const TITLE = 'Planos — BelleBook'
const DESCRIPTION = 'Escolha o plano ideal para o seu negócio de beleza'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/planos` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/planos`,
    siteName: 'BelleBook',
    locale: 'pt_BR',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'BelleBook' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og-image.png'] },
}

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string; auto?: string }>
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
    mp_subscription_id: string | null
  } | null = null

  if (user) {
    const { data } = await supabase
      .from('prestadoras')
      .select('id, plano, assinatura_ativa, trial_fim, e_trial, mp_subscription_id')
      .eq('user_id', user.id)
      .single()

    prestadora = data

    // Redireciona pro painel somente se tiver assinatura PAGA ativa (não trial gratuito)
    const isActivePaid = prestadora?.assinatura_ativa && !prestadora?.e_trial
    if (isActivePaid) redirect('/painel')
  }

  const cicloInicial = params.ciclo === 'anual' ? 'anual' : 'mensal'
  const eTrial = Boolean(prestadora?.e_trial && !prestadora?.mp_subscription_id)
  const trialExpirado = Boolean(
    eTrial && prestadora?.trial_fim && new Date(prestadora.trial_fim) < new Date()
  )
  const auto = PLANOS_VALIDOS.includes(params.auto as Plano) ? (params.auto as Plano) : undefined

  return (
    <PlanosClient
      isLoggedIn={!!user}
      planoAtual={(prestadora?.plano as Plano | null) ?? null}
      cicloInicial={cicloInicial}
      eTrial={eTrial}
      trialExpirado={trialExpirado}
      auto={auto}
    />
  )
}
