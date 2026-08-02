import { preApproval, preference, NOME_PLANO, PRECOS, somarDescontosMissoesPendentes, aplicarDesconto } from '@/lib/mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const MS_DIA = 24 * 60 * 60 * 1000
const DIAS_TOLERANCIA_ATRASO = 5

/**
 * Roda 1x/dia (ver vercel.json). Cuida do que o MP não faz sozinho:
 * - Pix/débito mensal: gera a cobrança avulsa do próximo ciclo quando vence,
 *   e suspende o acesso se passar de 5 dias sem pagar.
 * - Cartão mensal: aplica desconto de missão pendente na cobrança que está
 *   prestes a disparar (o MP cobra automaticamente — só dá pra ajustar o
 *   valor antes, não depois; o webhook reverte pro preço cheio assim que a
 *   cobrança descontada é confirmada).
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not set')

  const agora = Date.now()
  let renovadas = 0
  let suspensas = 0
  let descontosAplicados = 0

  // ── Pix/débito mensal — cobrança avulsa recorrente ──────────────────────
  const { data: manuais } = await admin
    .from('prestadoras')
    .select('id, email, plano, mp_periodo_fim, mp_pagamento_pendente_id, cancelamento_agendado')
    .in('mp_metodo_pagamento', ['pix', 'debito'])
    .eq('mp_ciclo', 'mensal')
    .eq('assinatura_ativa', true)
    .not('mp_periodo_fim', 'is', null)

  for (const p of manuais ?? []) {
    if (!p.plano || !p.mp_periodo_fim) continue
    const diasDesdeVencimento = Math.floor((agora - new Date(p.mp_periodo_fim).getTime()) / MS_DIA)
    if (diasDesdeVencimento < 0) continue // ainda dentro do ciclo pago

    // Cancelamento agendado: não gera nova cobrança — expira assim que o
    // período já pago termina, sem esperar os dias de tolerância de atraso
    // (essa tolerância é só pra quem esqueceu de pagar, não pra quem já
    // pediu pra não renovar).
    if (p.cancelamento_agendado) {
      await admin.from('prestadoras').update({
        assinatura_ativa: false, plano: null, mp_metodo_pagamento: null, mp_ciclo: null,
        mp_periodo_fim: null, mp_pagamento_pendente_id: null, cancelamento_agendado: false,
      }).eq('id', p.id)
      continue
    }

    if (diasDesdeVencimento >= DIAS_TOLERANCIA_ATRASO) {
      await admin.from('prestadoras').update({ assinatura_ativa: false }).eq('id', p.id)
      await admin.from('notificacoes').insert({
        prestadora_id: p.id,
        tipo: 'pagamento',
        mensagem: 'Sua assinatura foi suspensa por falta de pagamento. Regularize para voltar a usar o BelleBook.',
      })
      suspensas++
      continue
    }

    if (p.mp_pagamento_pendente_id) continue // já gerou a cobrança desse ciclo, só aguardando pagamento

    try {
      const { percentual, ids } = await somarDescontosMissoesPendentes(admin, p.id)
      const valor = aplicarDesconto(PRECOS[p.plano as 'basico' | 'pro'].mensal, percentual > 0 ? { percentual, valor_fixo: null } : null)
      const referencia = randomUUID()

      const pref = await preference.create({
        body: {
          items: [{ id: `${p.plano}_mensal`, title: `BelleBook Plano ${NOME_PLANO[p.plano as 'basico' | 'pro']} Mensal`, quantity: 1, unit_price: valor, currency_id: 'BRL' }],
          payer: { email: p.email },
          back_urls: { success: `${appUrl}/painel?subscribed=1`, failure: `${appUrl}/painel/assinatura`, pending: `${appUrl}/painel/assinatura` },
          auto_return: 'approved',
          external_reference: referencia,
          payment_methods: { excluded_payment_types: [{ id: 'credit_card' }] },
        },
      })

      await admin.from('mp_checkouts').insert({
        prestadora_id: p.id, plano: p.plano, ciclo: 'mensal', metodo: 'pix', valor,
        mp_referencia: referencia,
      })
      await admin.from('prestadoras').update({ mp_pagamento_pendente_id: pref.id }).eq('id', p.id)
      if (ids.length > 0) await admin.from('missoes_descontos').update({ aplicado: true, aplicado_em: new Date().toISOString() }).in('id', ids)

      await admin.from('notificacoes').insert({
        prestadora_id: p.id,
        tipo: 'pagamento',
        mensagem: `Sua cobrança mensal (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)}) já está disponível. Pague via Pix ou débito para manter seu acesso.`,
      })
      renovadas++
    } catch (err) {
      console.error('[cron/mp-renovacoes] erro ao gerar cobrança avulsa', p.id, err)
    }
  }

  // ── Cartão mensal — desconto de missão na cobrança prestes a disparar ───
  const { data: cartoes } = await admin
    .from('prestadoras')
    .select('id, plano, mp_subscription_id, mp_periodo_fim')
    .eq('mp_metodo_pagamento', 'cartao')
    .eq('assinatura_ativa', true)
    .not('mp_subscription_id', 'is', null)
    .not('mp_periodo_fim', 'is', null)

  for (const p of cartoes ?? []) {
    if (!p.plano || !p.mp_subscription_id || !p.mp_periodo_fim) continue
    const diasAteVencimento = (new Date(p.mp_periodo_fim).getTime() - agora) / MS_DIA
    if (diasAteVencimento < 0 || diasAteVencimento > 1) continue // só ajusta na véspera

    try {
      const { percentual, ids } = await somarDescontosMissoesPendentes(admin, p.id)
      if (percentual <= 0) continue

      const valor = aplicarDesconto(PRECOS[p.plano as 'basico' | 'pro'].mensal, { percentual, valor_fixo: null })
      await preApproval.update({ id: p.mp_subscription_id, body: { auto_recurring: { transaction_amount: valor, currency_id: 'BRL' } } })
      await admin.from('missoes_descontos').update({ aplicado: true, aplicado_em: new Date().toISOString() }).in('id', ids)
      descontosAplicados++
    } catch (err) {
      console.error('[cron/mp-renovacoes] erro ao aplicar desconto de missão', p.id, err)
    }
  }

  // ── Expira quem cancelou e já não tem assinatura ativa no MP ────────────
  // Cartão: cancelar-assinatura já cancela o preapproval e zera
  // mp_subscription_id na hora, mas mantém acesso até mp_periodo_fim —
  // aqui é quem fecha isso quando o período pago termina.
  const { data: cancelados } = await admin
    .from('prestadoras')
    .select('id, mp_periodo_fim')
    .eq('cancelamento_agendado', true)
    .eq('assinatura_ativa', true)
    .is('mp_subscription_id', null)
    .not('mp_periodo_fim', 'is', null)

  for (const p of cancelados ?? []) {
    if (!p.mp_periodo_fim || new Date(p.mp_periodo_fim).getTime() > agora) continue
    await admin.from('prestadoras').update({
      assinatura_ativa: false, plano: null, mp_metodo_pagamento: null, mp_ciclo: null,
      mp_periodo_fim: null, cancelamento_agendado: false,
    }).eq('id', p.id)
  }

  return NextResponse.json({ ok: true, renovadas, suspensas, descontosAplicados })
}
