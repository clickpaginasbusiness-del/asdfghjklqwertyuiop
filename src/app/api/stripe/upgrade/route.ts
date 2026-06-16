import { stripe, PRICE_IDS, isAnualByPrice } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, plano, stripe_subscription_id')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) {
    return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })
  }
  if (prestadora.plano !== 'basico') {
    return NextResponse.json({ error: 'Já está no Plano Pro' }, { status: 400 })
  }
  if (!prestadora.stripe_subscription_id) {
    return NextResponse.json({ error: 'Sem assinatura encontrada' }, { status: 400 })
  }

  const sub = await stripe.subscriptions.retrieve(prestadora.stripe_subscription_id)
  const itemId = sub.items.data[0]?.id
  const currentPriceId = sub.items.data[0]?.price?.id

  if (!itemId) {
    return NextResponse.json({ error: 'Item de assinatura não encontrado' }, { status: 500 })
  }

  // Mantém o mesmo ciclo (mensal→pro, anual→pro_anual)
  const targetPriceId = isAnualByPrice(currentPriceId ?? '')
    ? PRICE_IDS.pro_anual
    : PRICE_IDS.pro

  await stripe.subscriptions.update(prestadora.stripe_subscription_id, {
    items: [{ id: itemId, price: targetPriceId }],
    proration_behavior: 'always_invoice',
    metadata: { ...sub.metadata, plano: 'pro' },
  })

  // Atualiza no banco imediatamente (webhook também vai atualizar)
  await supabase
    .from('prestadoras')
    .update({ plano: 'pro' })
    .eq('id', prestadora.id)

  return NextResponse.json({ ok: true })
}
