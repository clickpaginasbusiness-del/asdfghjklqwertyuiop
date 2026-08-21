import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OnboardingClient from './OnboardingClient'

export const metadata: Metadata = {
  title: 'Bem-vinda — BelleBook',
  robots: { index: false, follow: false },
}

export default async function OnboardingPage() {
  // Guard de rota: quem já está autenticada nunca deveria ver o carrossel de
  // boas-vindas de novo — não importa como chegou aqui (botão/gesto de
  // voltar do Android, link direto, favorito). Independente do
  // AndroidBackButton (que só resolve fechar o app na raiz, não impede
  // voltar até aqui pelo histórico normal).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/painel')

  return <OnboardingClient />
}
