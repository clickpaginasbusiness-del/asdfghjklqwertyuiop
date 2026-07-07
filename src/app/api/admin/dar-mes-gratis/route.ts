import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { stripe } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { prestadora_id } = await request.json() as { prestadora_id?: string }
  if (!prestadora_id) return NextResponse.json({ error: 'prestadora_id obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data: p } = await admin
    .from('prestadoras')
    .select('id, nome, plano, assinatura_ativa, e_trial, trial_fim, stripe_customer_id')
    .eq('id', prestadora_id)
    .single()

  if (!p) return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })

  try {
    if (p.assinatura_ativa && !p.e_trial && p.stripe_customer_id) {
      // Plano pago → crédito no Stripe Customer Balance
      const creditCents = p.plano === 'pro' ? 8900 : 4900
      await stripe.customers.createBalanceTransaction(p.stripe_customer_id, {
        amount: -creditCents,
        currency: 'brl',
        description: 'Mês grátis concedido pelo admin',
      })
    } else if (p.assinatura_ativa && p.e_trial && p.trial_fim) {
      // Trial ativo → estende 30 dias
      const base = new Date(p.trial_fim)
      const newEnd = new Date(Math.max(base.getTime(), Date.now()) + 30 * 24 * 60 * 60 * 1000)
      await admin.from('prestadoras').update({ trial_fim: newEnd.toISOString() }).eq('id', prestadora_id)
    } else {
      // Sem plano / expirado → libera trial de 30 dias
      const newEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      await admin.from('prestadoras').update({
        assinatura_ativa: true,
        plano: 'basico',
        e_trial: true,
        trial_fim: newEnd.toISOString(),
      }).eq('id', prestadora_id)
    }
  } catch (err) {
    console.error('[admin/dar-mes-gratis]', err)
    return NextResponse.json({ error: 'Erro ao processar benefício' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
