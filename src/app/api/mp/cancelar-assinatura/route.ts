import { createClient } from '@/lib/supabase/server'
import { preApproval } from '@/lib/mercadopago'
import { NextResponse } from 'next/server'

/**
 * Cancela a renovação da assinatura. O acesso continua até `mp_periodo_fim`
 * (o ciclo já pago) — quem expira de fato é o cron (ver
 * /api/cron/mp-renovacoes), que não gera nova cobrança avulsa nem mantém o
 * plano pra quem tem `cancelamento_agendado=true` depois que o período acaba.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, mp_subscription_id, mp_metodo_pagamento')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) {
    return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })
  }

  if (prestadora.mp_metodo_pagamento === 'cartao' && prestadora.mp_subscription_id) {
    try {
      await preApproval.update({ id: prestadora.mp_subscription_id, body: { status: 'cancelled' } })
    } catch (err) {
      console.error('[mp/cancelar-assinatura] falha ao cancelar no Mercado Pago', prestadora.id, err)
      return NextResponse.json({ error: 'Erro ao cancelar assinatura' }, { status: 500 })
    }
  }

  const { error } = await supabase
    .from('prestadoras')
    .update({
      cancelamento_agendado: true,
      mp_subscription_id: null,
      mp_pagamento_pendente_id: null,
    })
    .eq('id', prestadora.id)

  if (error) {
    console.error('[mp/cancelar-assinatura] erro ao salvar cancelamento', prestadora.id, error)
    return NextResponse.json({ error: 'Erro ao cancelar assinatura' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
