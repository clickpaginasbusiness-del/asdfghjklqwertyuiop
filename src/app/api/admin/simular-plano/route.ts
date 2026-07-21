import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { stripe, planByPrice } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

type Estado = 'trial' | 'basico' | 'pro' | 'real'
const ESTADOS_VALIDOS: Estado[] = ['trial', 'basico', 'pro', 'real']

/**
 * Ferramenta de QA exclusiva da conta admin — simula os 3 estados de plano
 * direto no banco (sem tocar no Stripe de verdade) pra conseguir ver a página
 * de assinatura, os gates de feature, etc. em cada estado sem precisar de
 * contas de teste separadas nem esperar trial/cobrança de verdade.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  let body: { estado?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const estado = body.estado as Estado
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return NextResponse.json({ error: 'estado inválido — use trial, basico, pro ou real' }, { status: 400 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, stripe_subscription_id')
    .eq('user_id', user!.id)
    .single()

  if (!prestadora) {
    return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })
  }

  const admin = createAdminClient()

  if (estado === 'real') {
    let update: Record<string, unknown> = {
      // Sem trial_pro_fim: essa simulação nunca teve subscription de verdade,
      // então volta pro estado limpo — sem isso um trial_pro_fim simulado no
      // passado dispararia a expiração do trial Pro no próximo carregamento.
      trial_pro_fim: null,
    }

    if (prestadora.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(prestadora.stripe_subscription_id)
        const priceId = sub.items.data[0]?.price.id
        const ativa = sub.status === 'active' || sub.status === 'trialing'
        update = {
          ...update,
          assinatura_ativa: ativa,
          plano: ativa ? (planByPrice(priceId ?? '') ?? sub.metadata?.plano ?? null) : null,
          trial_fim: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          e_trial: false,
        }
      } catch {
        // Subscription pode ter sido deletada no Stripe — trata como sem assinatura
        update = { ...update, assinatura_ativa: false, plano: null, trial_fim: null, e_trial: false }
      }
    } else {
      update = { ...update, assinatura_ativa: false, plano: null, trial_fim: null, e_trial: false }
    }

    const { error } = await admin.from('prestadoras').update(update).eq('id', prestadora.id)
    if (error) return NextResponse.json({ error: 'Erro ao resetar' }, { status: 500 })
    return NextResponse.json({ ok: true, estado: 'real' })
  }

  const updatesPorEstado: Record<Exclude<Estado, 'real'>, Record<string, unknown>> = {
    trial: {
      e_trial: true,
      trial_fim: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      plano: 'basico',
      assinatura_ativa: true,
      trial_pro_fim: null,
    },
    basico: {
      e_trial: false,
      plano: 'basico',
      assinatura_ativa: true,
      trial_pro_usado: false,
      trial_pro_fim: null,
    },
    pro: {
      e_trial: false,
      plano: 'pro',
      assinatura_ativa: true,
      trial_pro_fim: null,
    },
  }

  const { error } = await admin
    .from('prestadoras')
    .update(updatesPorEstado[estado])
    .eq('id', prestadora.id)

  if (error) {
    console.error('[admin/simular-plano] erro ao simular estado', estado, error)
    return NextResponse.json({ error: 'Erro ao simular plano' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, estado })
}
