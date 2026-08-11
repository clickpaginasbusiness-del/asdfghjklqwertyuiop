import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { aplicarRestricoesDoPlano } from '@/lib/downgrade'
import { preApproval } from '@/lib/mercadopago'
import { ehPro } from '@/lib/plano'
import type { PlanoTier } from '@/lib/planoLimites'
import { NextRequest, NextResponse } from 'next/server'

type Estado = 'trial' | 'start' | 'pro' | 'studio' | 'real'
const ESTADOS_VALIDOS: Estado[] = ['trial', 'start', 'pro', 'studio', 'real']

/**
 * Ferramenta de QA exclusiva da conta admin — simula os estados de plano
 * direto no banco (sem tocar no Mercado Pago de verdade) pra conseguir ver a
 * página de assinatura, os gates de feature, etc. em cada estado sem
 * precisar de contas de teste separadas nem esperar trial/cobrança de verdade.
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
    return NextResponse.json({ error: 'estado inválido — use trial, start, pro, studio ou real' }, { status: 400 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, mp_subscription_id, mp_metodo_pagamento')
    .eq('user_id', user!.id)
    .single()

  if (!prestadora) {
    return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })
  }

  const admin = createAdminClient()

  if (estado === 'real') {
    let update: Record<string, unknown> = {
      // Sem trial_pro_fim: essa simulação nunca teve assinatura de verdade,
      // então volta pro estado limpo — sem isso um trial_pro_fim simulado no
      // passado dispararia a expiração do trial Pro no próximo carregamento.
      trial_pro_fim: null,
    }

    if (prestadora.mp_subscription_id && prestadora.mp_metodo_pagamento === 'cartao') {
      try {
        const sub = await preApproval.get({ id: prestadora.mp_subscription_id })
        const ativa = sub.status === 'authorized'
        update = {
          ...update,
          assinatura_ativa: ativa,
          mp_periodo_fim: sub.next_payment_date ?? null,
          e_trial: false,
        }
      } catch {
        // Assinatura pode ter sido deletada no MP — trata como sem assinatura
        update = { ...update, assinatura_ativa: false, plano: null, mp_periodo_fim: null, e_trial: false }
      }
    } else {
      update = { ...update, assinatura_ativa: false, plano: null, mp_periodo_fim: null, e_trial: false }
    }

    // Se o status real não é Pro+, reaplica as mesmas restrições do downgrade
    // (profissionais extras, avaliações em destaque, cor do tema) — senão o
    // reset só troca o rótulo do plano e deixa as features Pro liberadas.
    if (!ehPro(update.plano as PlanoTier | null ?? null)) {
      await aplicarRestricoesDoPlano(admin, prestadora.id, 'start')
    }

    const { error } = await admin.from('prestadoras').update(update).eq('id', prestadora.id)
    if (error) return NextResponse.json({ error: 'Erro ao resetar' }, { status: 500 })
    return NextResponse.json({ ok: true, estado: 'real' })
  }

  const updatesPorEstado: Record<Exclude<Estado, 'real'>, Record<string, unknown>> = {
    trial: {
      e_trial: true,
      trial_fim: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      plano: 'start',
      assinatura_ativa: true,
      trial_pro_fim: null,
    },
    start: {
      e_trial: false,
      plano: 'start',
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
    studio: {
      e_trial: false,
      plano: 'studio',
      assinatura_ativa: true,
      trial_pro_fim: null,
    },
  }

  // Trial e Start não têm acesso às features Pro+ — reaplica as mesmas
  // restrições do downgrade real (profissionais extras, destaques, cor do
  // tema). Sem isso a simulação só troca o rótulo do plano na tela, mas as
  // features Pro+ continuam liberadas por baixo.
  if (estado === 'trial' || estado === 'start') {
    await aplicarRestricoesDoPlano(admin, prestadora.id, 'start')
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
