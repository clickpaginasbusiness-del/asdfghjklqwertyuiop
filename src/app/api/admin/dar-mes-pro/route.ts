import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { darDiasGratis } from '@/lib/mercadopago'
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
    .select('id, plano, assinatura_ativa, e_trial, trial_fim, mp_metodo_pagamento')
    .eq('id', prestadora_id)
    .single()

  if (!p) return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })

  try {
    if (p.assinatura_ativa && p.e_trial && p.trial_fim) {
      // Trial ativo → muda plano para pro e estende trial_fim por 30 dias
      const base = new Date(p.trial_fim)
      const newEnd = new Date(Math.max(base.getTime(), Date.now()) + 30 * 24 * 60 * 60 * 1000)
      await admin
        .from('prestadoras')
        .update({ plano: 'pro', trial_fim: newEnd.toISOString() })
        .eq('id', prestadora_id)
    } else if (p.assinatura_ativa && !p.e_trial && p.mp_metodo_pagamento) {
      // Plano pago (básico ou pro) → 30 dias grátis no método atual + muda para pro
      await darDiasGratis(admin, prestadora_id, 30, 'admin_mes_pro')
      if (p.plano !== 'pro') {
        await admin.from('prestadoras').update({ plano: 'pro' }).eq('id', prestadora_id)
      }
    } else {
      // Sem plano / expirado → libera trial Pro de 30 dias
      const newEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      await admin.from('prestadoras').update({
        assinatura_ativa: true,
        plano: 'pro',
        e_trial: true,
        trial_fim: newEnd.toISOString(),
      }).eq('id', prestadora_id)
    }
  } catch (err) {
    console.error('[admin/dar-mes-pro]', err)
    return NextResponse.json({ error: 'Erro ao processar benefício' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
