import { redirect } from 'next/navigation'
import { getPrestadoraAutenticada } from '@/lib/painelAuth'
import { getChecklistStatus } from '@/lib/checklist'
import ChecklistClient from './ChecklistClient'

export const metadata = { title: 'Checklist — BelleBook' }

export default async function ChecklistPage() {
  const { supabase, prestadora } = await getPrestadoraAutenticada()
  if (!prestadora) redirect('/painel/login')

  const status = await getChecklistStatus(supabase, prestadora)

  return <ChecklistClient prestadoraId={prestadora.id} slug={prestadora.slug} status={status} />
}
