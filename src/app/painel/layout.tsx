import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { differenceInCalendarDays } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import PainelLayoutClient from './PainelLayoutClient'

const PUBLIC_PATHS = ['/painel/login', '/painel/cadastro', '/painel/recuperar-senha', '/painel/nova-senha', '/painel/completar-cadastro-google']

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  // Login e cadastro não precisam de auth
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) redirect('/painel/cadastro')

  // Sem assinatura ativa → página de planos
  // Trial gratuito expirado (sem Stripe ativo) → página de planos
  const isExpiredTrial = Boolean(
    prestadora.e_trial &&
    !prestadora.stripe_subscription_id &&
    prestadora.trial_fim &&
    new Date(prestadora.trial_fim) < new Date()
  )
  if (!prestadora.assinatura_ativa || isExpiredTrial) redirect('/planos')

  // Calculado no servidor (não no relógio do cliente) para evitar inconsistências
  // de fuso horário / clock drift. Usa diferença em dias de calendário, não horas
  // cheias — assim "termina amanhã" sempre mostra "1 dia" independente da hora do dia.
  const trialDiasRestantes = prestadora.trial_fim
    ? Math.max(0, differenceInCalendarDays(new Date(prestadora.trial_fim), new Date()))
    : null

  return (
    <PainelLayoutClient prestadora={prestadora} trialDiasRestantes={trialDiasRestantes}>
      {children}
    </PainelLayoutClient>
  )
}
