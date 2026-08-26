import { redirect } from 'next/navigation'
import { getPrestadoraAutenticada } from '@/lib/painelAuth'
import { planoEfetivo } from '@/lib/plano'
import ProfissionaisClient from './ProfissionaisClient'

export default async function ProfissionaisPage() {
  const { supabase, prestadora } = await getPrestadoraAutenticada()
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
