import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { aplicarRestricoesDoPlano } from '@/lib/downgrade'
import { preApproval } from '@/lib/mercadopago'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { id } = await params

  let body: { acao?: 'dar' | 'remover' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (body.acao !== 'dar' && body.acao !== 'remover') {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: prestadora } = await admin
    .from('prestadoras')
    .select('id, plano, mp_subscription_id')
    .eq('id', id)
    .maybeSingle()

  if (!prestadora) {
    return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })
  }

  if (body.acao === 'dar') {
    // Ela vai ter Pro grátis — cancela qualquer assinatura por cartão ativa,
    // não faz sentido continuar cobrando quem virou parceira.
    if (prestadora.mp_subscription_id) {
      try {
        await preApproval.update({ id: prestadora.mp_subscription_id, body: { status: 'cancelled' } })
      } catch (err) {
        console.error('[admin/parceiras/cargo] falha ao cancelar assinatura MP', id, err)
      }
    }

    // Reativa todas as profissionais (mesmo efeito de um upgrade real pra Pro).
    await admin.from('profissionais').update({ ativa: true }).eq('prestadora_id', id)

    const { error } = await admin.from('prestadoras').update({
      e_parceira: true,
      plano: 'pro',
      assinatura_ativa: true,
      e_trial: false,
      trial_fim: null,
      mp_subscription_id: null,
      mp_metodo_pagamento: null,
      mp_periodo_fim: null,
      mp_pagamento_pendente_id: null,
      parceira_desde: new Date().toISOString(),
      downgrade_aviso: false,
    }).eq('id', id)

    if (error) {
      console.error('[admin/parceiras/cargo] erro ao dar cargo', id, error)
      return NextResponse.json({ error: 'Erro ao dar cargo de parceira.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  // Remover
  await aplicarRestricoesDoPlano(admin, id, 'start')

  const { error } = await admin.from('prestadoras').update({
    e_parceira: false,
    plano: 'start',
    parceira_desde: null,
    parceira_periodo_30_inicio: null,
    parceira_comissao_percentual: 20,
  }).eq('id', id)

  if (error) {
    console.error('[admin/parceiras/cargo] erro ao remover cargo', id, error)
    return NextResponse.json({ error: 'Erro ao remover cargo de parceira.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
