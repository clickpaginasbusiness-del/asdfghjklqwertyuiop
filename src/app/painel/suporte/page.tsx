import { redirect } from 'next/navigation'
import { getPrestadoraAutenticada } from '@/lib/painelAuth'
import SuporteClient from './SuporteClient'

export default async function SuportePage() {
  const { prestadora } = await getPrestadoraAutenticada()
  if (!prestadora) redirect('/painel/login')

  return <SuporteClient nome={prestadora.nome} email={prestadora.email} />
}
