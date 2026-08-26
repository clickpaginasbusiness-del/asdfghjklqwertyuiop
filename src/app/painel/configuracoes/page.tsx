import { redirect } from 'next/navigation'
import { getPrestadoraAutenticada } from '@/lib/painelAuth'
import ConfiguracoesClient from './ConfiguracoesClient'

export default async function ConfiguracoesPage() {
  const { prestadora } = await getPrestadoraAutenticada()
  if (!prestadora) redirect('/painel/login')

  return <ConfiguracoesClient email={prestadora.email} />
}
