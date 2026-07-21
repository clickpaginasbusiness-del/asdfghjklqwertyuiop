import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const TRIAL_PRO_DIAS = 7

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, plano, trial_pro_usado')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) {
    return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })
  }
  if (prestadora.plano !== 'basico') {
    return NextResponse.json({ error: 'O trial gratuito do Pro é exclusivo de quem está no Plano Básico.' }, { status: 400 })
  }
  if (prestadora.trial_pro_usado) {
    return NextResponse.json({ error: 'Você já usou seu trial gratuito do Pro.' }, { status: 400 })
  }

  // Reativa todas as profissionais (mesmo comportamento do upgrade real via
  // Stripe) — se ela tinha desativado alguma num downgrade anterior, o trial
  // deve destravar o limite do Pro de verdade, não só o rótulo do plano.
  await supabase
    .from('profissionais')
    .update({ ativa: true })
    .eq('prestadora_id', prestadora.id)

  const trialProFim = new Date(Date.now() + TRIAL_PRO_DIAS * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('prestadoras')
    .update({
      plano: 'pro',
      trial_pro_usado: true,
      trial_pro_fim: trialProFim,
      downgrade_aviso: false,
    })
    .eq('id', prestadora.id)

  if (error) {
    console.error('[trial-pro] erro ao ativar trial', error)
    return NextResponse.json({ error: 'Erro ao ativar trial. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, trialProFim })
}
