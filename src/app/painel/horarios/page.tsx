import { redirect } from 'next/navigation'
import { getPrestadoraAutenticada } from '@/lib/painelAuth'
import HorariosClient from './HorariosClient'

export default async function HorariosPage() {
  const { supabase, prestadora } = await getPrestadoraAutenticada()
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
