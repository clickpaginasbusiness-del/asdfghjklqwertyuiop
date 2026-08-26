import { redirect } from 'next/navigation'
import { getPrestadoraAutenticada } from '@/lib/painelAuth'
import GaleriaClient from './GaleriaClient'

export default async function GaleriaPage() {
  const { supabase, prestadora } = await getPrestadoraAutenticada()
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
    />
  )
}
