import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HorariosClient from './HorariosClient'

export default async function HorariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/login')

  const [
    { data: diasBloqueados },
    { data: horariosFuncionamento },
  ] = await Promise.all([
    supabase
      .from('dias_bloqueados')
      .select('*')
      .eq('prestadora_id', prestadora.id)
      .order('data'),
    supabase
      .from('horarios_funcionamento')
      .select('*')
      .eq('prestadora_id', prestadora.id)
      .order('dia_semana'),
  ])

  return (
    <HorariosClient
      prestadora={prestadora}
      diasBloqueados={diasBloqueados ?? []}
      horariosFuncionamento={horariosFuncionamento ?? []}
    />
  )
}
