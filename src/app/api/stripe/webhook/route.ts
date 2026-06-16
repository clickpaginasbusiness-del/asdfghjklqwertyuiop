import { stripe, planByPrice } from '@/lib/stripe'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'

// Webhook usa service role pois não tem sessão de usuário
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Sem assinatura' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const prestadora_id = session.metadata?.prestadora_id
      const plano = session.metadata?.plano
      if (!prestadora_id || !plano) break

      // Busca o trial_end da subscription
      let trialFim: string | null = null
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        trialFim = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
      }

      await supabaseAdmin.from('prestadoras').update({
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plano,
        assinatura_ativa: true,
        trial_fim: trialFim,
        e_trial: false,
      }).eq('id', prestadora_id)
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const prestadora_id = sub.metadata?.prestadora_id
      if (!prestadora_id) break

      const ativa = sub.status === 'active' || sub.status === 'trialing'
      const priceId = sub.items.data[0]?.price.id
      const novoPlano = planByPrice(priceId) ?? sub.metadata?.plano ?? null
      const trialFim = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null

      // Busca o plano atual antes de atualizar para detectar mudança
      const { data: prestadora } = await supabaseAdmin
        .from('prestadoras')
        .select('plano')
        .eq('id', prestadora_id)
        .single()

      const planoAnterior = prestadora?.plano

      // Downgrade: Pro → Básico
      if (planoAnterior === 'pro' && novoPlano === 'basico' && ativa) {
        // Mantém só a profissional mais antiga; desativa as demais
        const { data: ativas } = await supabaseAdmin
          .from('profissionais')
          .select('id')
          .eq('prestadora_id', prestadora_id)
          .eq('ativa', true)
          .order('created_at', { ascending: true })

        if (ativas && ativas.length > 1) {
          const idsDesativar = ativas.slice(1).map((p: { id: string }) => p.id)
          await supabaseAdmin
            .from('profissionais')
            .update({ ativa: false })
            .in('id', idsDesativar)
        }

        await supabaseAdmin.from('prestadoras').update({
          assinatura_ativa: true,
          plano: 'basico',
          stripe_subscription_id: sub.id,
          trial_fim: trialFim,
          downgrade_aviso: true,
        }).eq('id', prestadora_id)
        break
      }

      // Upgrade: Básico → Pro
      if (planoAnterior === 'basico' && novoPlano === 'pro' && ativa) {
        // Reativa todas as profissionais da prestadora
        await supabaseAdmin
          .from('profissionais')
          .update({ ativa: true })
          .eq('prestadora_id', prestadora_id)

        await supabaseAdmin.from('prestadoras').update({
          assinatura_ativa: true,
          plano: 'pro',
          stripe_subscription_id: sub.id,
          trial_fim: trialFim,
          downgrade_aviso: false,
        }).eq('id', prestadora_id)
        break
      }

      // Atualização padrão (renovação, mudança de status, etc.)
      await supabaseAdmin.from('prestadoras').update({
        assinatura_ativa: ativa,
        plano: ativa ? novoPlano : null,
        stripe_subscription_id: sub.id,
        trial_fim: trialFim,
      }).eq('id', prestadora_id)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const prestadora_id = sub.metadata?.prestadora_id
      if (!prestadora_id) break

      await supabaseAdmin.from('prestadoras').update({
        assinatura_ativa: false,
        plano: null,
        stripe_subscription_id: null,
        trial_fim: null,
      }).eq('id', prestadora_id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
