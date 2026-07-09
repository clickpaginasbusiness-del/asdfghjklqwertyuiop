import { stripe, PRICE_IDS } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const VALID_KEYS = new Set(Object.keys(PRICE_IDS))

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await request.json()
  const plano = body.plano as string
  const ciclo = (body.ciclo as string) === 'anual' ? 'anual' : 'mensal'
  const cupom = (body.cupom as string | undefined)?.trim() || undefined

  if (plano !== 'basico' && plano !== 'pro') {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }

  const priceKey = ciclo === 'anual' ? `${plano}_anual` : plano
  if (!VALID_KEYS.has(priceKey)) {
    return NextResponse.json({ error: 'Ciclo inválido' }, { status: 400 })
  }

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, email, stripe_customer_id, e_trial')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) {
    return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })
  }

  // Cria ou reutiliza o Stripe Customer
  let customerId = prestadora.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: prestadora.email,
      metadata: { prestadora_id: prestadora.id },
    })
    customerId = customer.id
    await supabase
      .from('prestadoras')
      .update({ stripe_customer_id: customerId })
      .eq('id', prestadora.id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not set')

  // Trial de 30 dias é exclusivo do Plano Básico e apenas para quem nunca usou trial grátis
  const jaUsouTrialGratis = Boolean((prestadora as { e_trial?: boolean }).e_trial)
  const incluirTrial = plano === 'basico' && !jaUsouTrialGratis

  let session
  try {
    session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PRICE_IDS[priceKey as keyof typeof PRICE_IDS], quantity: 1 }],
      subscription_data: {
        ...(incluirTrial ? { trial_period_days: 30 } : {}),
        metadata: { prestadora_id: prestadora.id, plano, ciclo },
      },
      ...(cupom ? { discounts: [{ coupon: cupom }] } : {}),
      metadata: { prestadora_id: prestadora.id, plano, ciclo },
      success_url: `${appUrl}/painel?subscribed=1`,
      cancel_url: `${appUrl}/planos`,
      locale: 'pt-BR',
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.toLowerCase().includes('coupon') || msg.toLowerCase().includes('discount')) {
      return NextResponse.json({ error: 'Cupom inválido ou expirado', tipo: 'cupom' }, { status: 400 })
    }
    console.error('[stripe/checkout] erro ao criar sessão:', err)
    return NextResponse.json({ error: 'Erro ao criar sessão de pagamento' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
