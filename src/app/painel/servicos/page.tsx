import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ServicosClient from './ServicosClient'

export default async function ServicosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  const { data: servicos } = await supabase
    .from('servicos')
    .select('*')
    .eq('prestadora_id', prestadora.id)
    .order('created_at')

  return <ServicosClient servicos={servicos ?? []} prestadoraId={prestadora.id} />
}
