import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PerfilPainelClient from './PerfilPainelClient'

export default async function PerfilPainelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  return <PerfilPainelClient prestadora={prestadora} />
}
