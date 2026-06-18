import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SuporteClient from './SuporteClient'

export default async function SuportePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('nome, email')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  return <SuporteClient nome={prestadora.nome} email={prestadora.email} />
}
