import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GaleriaClient from './GaleriaClient'

export default async function GaleriaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, plano')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  const { data: galeria } = await supabase
    .from('galeria')
    .select('*')
    .eq('prestadora_id', prestadora.id)
    .order('created_at', { ascending: false })

  return (
    <GaleriaClient
      galeria={galeria ?? []}
      prestadoraId={prestadora.id}
      plano={(prestadora.plano as 'basico' | 'pro' | null) ?? null}
    />
  )
}
