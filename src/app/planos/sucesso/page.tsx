import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PRECOS, NOME_PLANO, type Plano, type Ciclo } from '@/lib/mercadopago'
import PlanoSucessoClient from './PlanoSucessoClient'

export const metadata = { title: 'Assinatura confirmada — BelleBook' }

export default async function PlanoSucessoPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string; ciclo?: string }>
}) {
  const { plano, ciclo } = await searchParams
  const PLANOS_VALIDOS: Plano[] = ['start', 'pro', 'studio']
  const planoValido: Plano = PLANOS_VALIDOS.includes(plano as Plano) ? (plano as Plano) : 'start'
  const cicloValido: Ciclo = ciclo === 'anual' ? 'anual' : 'mensal'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, nome, plano, assinatura_ativa')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  return (
    <PlanoSucessoClient
      planoConfirmadoAtivo={prestadora.assinatura_ativa && prestadora.plano === planoValido}
      nomePlano={NOME_PLANO[planoValido]}
      ciclo={cicloValido}
      valor={PRECOS[planoValido][cicloValido]}
    />
  )
}
