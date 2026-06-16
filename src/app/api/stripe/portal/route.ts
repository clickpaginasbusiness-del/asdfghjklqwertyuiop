import { stripe } from '@/lib/stripe'
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
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!prestadora?.stripe_customer_id) {
    return NextResponse.json({ error: 'Sem assinatura encontrada' }, { status: 400 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: prestadora.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/painel/assinatura`,
  })

  return NextResponse.json({ url: session.url })
}
