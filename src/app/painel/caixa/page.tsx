import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResumoCaixa } from '@/lib/caixa'
import CaixaClient from './CaixaClient'

export const metadata = { title: 'Caixa — BelleBook' }

export default async function CaixaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  const resumo = await getResumoCaixa(createAdminClient(), prestadora.id)

  const ultimoSaque = resumo.historicoSaques[0] ?? null
  const podeSolicitarSaque = !ultimoSaque
    || new Date().getTime() - new Date(ultimoSaque.solicitado_em).getTime() >= 7 * 24 * 60 * 60 * 1000

  return <CaixaClient resumo={resumo} podeSolicitarSaque={podeSolicitarSaque} />
}
