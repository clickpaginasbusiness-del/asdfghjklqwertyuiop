import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Plano } from '@/lib/mercadopago'
import CheckoutClient from './CheckoutClient'

export const metadata = { title: 'Confirmar assinatura — BelleBook' }

const PLANOS_VALIDOS: Plano[] = ['start', 'pro', 'studio', 'studio_pro']
type Ciclo = 'mensal' | 'anual'

export default async function PlanosCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string; ciclo?: string }>
}) {
  const { plano, ciclo } = await searchParams

  if (!PLANOS_VALIDOS.includes(plano as Plano)) redirect('/planos')
  const cicloValido: Ciclo = ciclo === 'anual' ? 'anual' : 'mensal'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/painel/cadastro?plano=${plano}`)

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('assinatura_ativa, e_trial')
    .eq('user_id', user.id)
    .single()

  // Assinatura PAGA ativa (não trial gratuito) → nada pra confirmar aqui
  if (prestadora?.assinatura_ativa && !prestadora?.e_trial) redirect('/painel')

  return <CheckoutClient plano={plano as Plano} ciclo={cicloValido} />
}
