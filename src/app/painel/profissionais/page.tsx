import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { planoEfetivo } from '@/lib/plano'
import ProfissionaisClient from './ProfissionaisClient'

export default async function ProfissionaisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, plano, e_parceira')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  const { data: profissionais } = await supabase
    .from('profissionais')
    .select('*')
    .eq('prestadora_id', prestadora.id)
    .order('created_at')

  return (
    <ProfissionaisClient
      profissionais={profissionais ?? []}
      prestadoraId={prestadora.id}
      plano={planoEfetivo({ plano: prestadora.plano, e_parceira: prestadora.e_parceira })}
    />
  )
}
