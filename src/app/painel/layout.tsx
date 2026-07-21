import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { differenceInCalendarDays } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { aplicarDowngradeParaBasico } from '@/lib/downgrade'
import PainelLayoutClient from './PainelLayoutClient'

const PUBLIC_PATHS = ['/painel/login', '/painel/cadastro', '/painel/recuperar-senha', '/painel/nova-senha', '/painel/completar-cadastro-google']

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  // Login e cadastro não precisam de auth — /painel/demo/* também é público
  // (demo interativa com dados fictícios, sem sessão real)
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/painel/demo')) {
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

  // Trial gratuito de 7 dias do Pro expirou → volta pro Básico. Verificado no
  // servidor (não só no cliente) porque esse campo controla acesso a
  // funcionalidades pagas — sem essa checagem aqui, quem nunca recarregasse o
  // JS do cliente continuaria com plano='pro' no banco indefinidamente.
  let trialProAcabouDeExpirar = false
  if (
    prestadora.plano === 'pro' &&
    prestadora.trial_pro_fim &&
    new Date(prestadora.trial_pro_fim) < new Date()
  ) {
    await aplicarDowngradeParaBasico(supabase, prestadora.id)

    await supabase
      .from('prestadoras')
      .update({ plano: 'basico', trial_pro_fim: null })
      .eq('id', prestadora.id)

    prestadora.plano = 'basico'
    prestadora.trial_pro_fim = null
    prestadora.cor_tema = 'rosa'
    trialProAcabouDeExpirar = true
  }

  // Calculado no servidor (não no relógio do cliente) para evitar inconsistências
  // de fuso horário / clock drift. Usa diferença em dias de calendário, não horas
  // cheias — assim "termina amanhã" sempre mostra "1 dia" independente da hora do dia.
  const trialDiasRestantes = prestadora.trial_fim
    ? Math.max(0, differenceInCalendarDays(new Date(prestadora.trial_fim), new Date()))
    : null

  // Idem, mas pro trial Pro de 7 dias — a checagem de expiração acima já
  // garante que, se chegou aqui, trial_pro_fim (quando existe) está no futuro.
  const trialProDiasRestantes = prestadora.plano === 'pro' && prestadora.trial_pro_fim
    ? Math.max(0, differenceInCalendarDays(new Date(prestadora.trial_pro_fim), new Date()))
    : null

  return (
    <PainelLayoutClient
      prestadora={prestadora}
      trialDiasRestantes={trialDiasRestantes}
      trialProAcabouDeExpirar={trialProAcabouDeExpirar}
      trialProDiasRestantes={trialProDiasRestantes}
    >
      {children}
    </PainelLayoutClient>
  )
}
