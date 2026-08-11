import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getChecklistStatus } from '@/lib/checklist'
import ChecklistClient from './ChecklistClient'

export const metadata = { title: 'Checklist — BelleBook' }

export default async function ChecklistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  const status = await getChecklistStatus(supabase, prestadora)

  return <ChecklistClient prestadoraId={prestadora.id} slug={prestadora.slug} status={status} />
}
