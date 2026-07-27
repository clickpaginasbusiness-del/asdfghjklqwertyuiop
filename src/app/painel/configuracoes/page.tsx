import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConfiguracoesClient from './ConfiguracoesClient'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('email')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  return <ConfiguracoesClient email={prestadora.email} />
}
