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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const prestadora_id = session.metadata?.prestadora_id
        const plano = session.metadata?.plano
        if (!prestadora_id || !plano) {
          console.error('[stripe webhook] checkout.session.completed sem prestadora_id/plano nos metadados', session.id)
          break
        }

        // Busca o trial_end da subscription
        let trialFim: string | null = null
        if (session.subscription) {
          try {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string)
            trialFim = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
          } catch (err) {
            console.error('[stripe webhook] falha ao buscar subscription do checkout', session.subscription, err)
          }
        }

        // Se a prestadora já tinha outra assinatura (ex: trial antigo sendo substituído
        // por uma nova assinatura via checkout), guarda o id para cancelar depois de
        // confirmar a troca — evita cobrar as duas assinaturas e evita que eventos
        // futuros da assinatura antiga sobrescrevam o plano novo.
        const { data: prestadoraAntes } = await supabaseAdmin
          .from('prestadoras')
          .select('stripe_subscription_id')
          .eq('id', prestadora_id)
          .single()
        const subscriptionAntiga = prestadoraAntes?.stripe_subscription_id

        await supabaseAdmin.from('prestadoras').update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          plano,
          assinatura_ativa: true,
          trial_fim: trialFim,
          e_trial: false,
        }).eq('id', prestadora_id)

        if (subscriptionAntiga && session.subscription && subscriptionAntiga !== session.subscription) {
          try {
            await stripe.subscriptions.cancel(subscriptionAntiga)
          } catch (err) {
            console.error('[stripe webhook] falha ao cancelar assinatura antiga substituída', subscriptionAntiga, err)
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const prestadora_id = sub.metadata?.prestadora_id
        if (!prestadora_id) break

        // Busca o plano e a assinatura atual antes de atualizar para detectar mudança
        const { data: prestadora } = await supabaseAdmin
          .from('prestadoras')
          .select('plano, stripe_subscription_id')
          .eq('id', prestadora_id)
          .single()

        // Ignora eventos de uma assinatura que não é mais a vinculada à prestadora
        // (ex: assinatura antiga substituída por upgrade via novo checkout). Sem essa
        // checagem, um evento tardio da assinatura antiga pode sobrescrever o plano
        // que já foi corretamente atualizado por outro evento mais recente.
        if (prestadora?.stripe_subscription_id && prestadora.stripe_subscription_id !== sub.id) {
          console.error('[stripe webhook] customer.subscription.updated ignorado: assinatura não é a atual', {
            prestadora_id, eventoSub: sub.id, subAtual: prestadora.stripe_subscription_id,
          })
          break
        }

        const ativa = sub.status === 'active' || sub.status === 'trialing'
        const priceId = sub.items.data[0]?.price.id
        const novoPlano = planByPrice(priceId) ?? sub.metadata?.plano ?? null
        const trialFim = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null

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

        const { data: prestadora } = await supabaseAdmin
          .from('prestadoras')
          .select('stripe_subscription_id')
          .eq('id', prestadora_id)
          .single()

        // Só limpa o plano se a assinatura excluída for a que está vinculada hoje.
        // Caso contrário é uma assinatura antiga/substituída sendo cancelada
        // (ex: trial anterior cancelado após upgrade) e não deve afetar o plano atual.
        if (prestadora?.stripe_subscription_id && prestadora.stripe_subscription_id !== sub.id) {
          console.error('[stripe webhook] customer.subscription.deleted ignorado: assinatura não é a atual', {
            prestadora_id, eventoSub: sub.id, subAtual: prestadora.stripe_subscription_id,
          })
          break
        }

        await supabaseAdmin.from('prestadoras').update({
          assinatura_ativa: false,
          plano: null,
          stripe_subscription_id: null,
          trial_fim: null,
        }).eq('id', prestadora_id)
        break
      }
    }
  } catch (err) {
    console.error('[stripe webhook] erro ao processar evento', event.type, err)
    return NextResponse.json({ error: 'Erro ao processar evento' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
