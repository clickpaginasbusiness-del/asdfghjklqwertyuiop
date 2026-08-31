import { preApproval, preference, NOME_PLANO, PRECOS, calcularProximaCobranca, incrementarUsoCupom, type Plano } from '@/lib/mercadopago'
import { liberarCaixaVencido } from '@/lib/caixa'
import { payerEmailPlanoCliente } from '@/lib/planosPrestadora'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const MS_DIA = 24 * 60 * 60 * 1000
const DIAS_TOLERANCIA_ATRASO = 5

/**
 * Roda 1x/dia (ver vercel.json). Cuida do que o MP não faz sozinho:
 * - Pix/débito mensal: gera a cobrança avulsa do próximo ciclo quando vence,
 *   e suspende o acesso se passar de 5 dias sem pagar.
 * - Cartão mensal: ajusta o valor da cobrança que está prestes a disparar —
 *   com desconto de missão pendente e/ou cupom ainda dentro da duração
 *   contratada, ou de volta pro preço cheio quando nenhum dos dois se aplica
 *   mais. O MP cobra automaticamente; só dá pra ajustar o valor antes, nunca
 *   depois — por isso sempre define o valor correto na véspera de cada ciclo,
 *   em vez de reagir depois que a cobrança já aconteceu.
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
  let precosAjustados = 0

  // ── Pix/débito mensal — cobrança avulsa recorrente ──────────────────────
  const { data: manuais } = await admin
    .from('prestadoras')
    .select('id, email, plano, mp_periodo_fim, mp_pagamento_pendente_id, cancelamento_agendado')
    .in('mp_metodo_pagamento', ['pix', 'debito'])
    .eq('mp_ciclo', 'mensal')
    .eq('assinatura_ativa', true)
    .eq('e_parceira', false)
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
      const plano = p.plano as Plano
      const { valor, missaoDescontoIds, cupomUsoId } = await calcularProximaCobranca(admin, p.id, PRECOS[plano].mensal)
      const referencia = randomUUID()

      const pref = await preference.create({
        body: {
          items: [{ id: `${plano}_mensal`, title: `BelleBook Plano ${NOME_PLANO[plano]} Mensal`, quantity: 1, unit_price: valor, currency_id: 'BRL' }],
          payer: { email: p.email },
          back_urls: { success: `${appUrl}/painel?subscribed=1`, failure: `${appUrl}/painel/assinatura`, pending: `${appUrl}/painel/assinatura` },
          auto_return: 'approved',
          external_reference: referencia,
          payment_methods: { excluded_payment_types: [{ id: 'credit_card' }] },
        },
      })

      await admin.from('mp_checkouts').insert({
        prestadora_id: p.id, plano, ciclo: 'mensal', metodo: 'pix', valor,
        mp_referencia: referencia,
      })
      await admin.from('prestadoras').update({ mp_pagamento_pendente_id: pref.id }).eq('id', p.id)
      if (missaoDescontoIds.length > 0) {
        await admin.from('missoes_descontos').update({ aplicado: true, aplicado_em: new Date().toISOString() }).in('id', missaoDescontoIds)
      }
      if (cupomUsoId) await incrementarUsoCupom(admin, cupomUsoId)

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

  // ── Cartão mensal — ajusta o valor da cobrança prestes a disparar ───────
  const { data: cartoes } = await admin
    .from('prestadoras')
    .select('id, plano, mp_subscription_id, mp_periodo_fim')
    .eq('mp_metodo_pagamento', 'cartao')
    .eq('assinatura_ativa', true)
    .eq('e_parceira', false)
    .not('mp_subscription_id', 'is', null)
    .not('mp_periodo_fim', 'is', null)

  for (const p of cartoes ?? []) {
    if (!p.plano || !p.mp_subscription_id || !p.mp_periodo_fim) continue
    const diasAteVencimento = (new Date(p.mp_periodo_fim).getTime() - agora) / MS_DIA
    if (diasAteVencimento < 0 || diasAteVencimento > 1) continue // só ajusta na véspera

    try {
      const plano = p.plano as Plano
      const { valor, missaoDescontoIds, cupomUsoId } = await calcularProximaCobranca(admin, p.id, PRECOS[plano].mensal)

      // Sempre define o valor certo (cheio ou descontado) — é a única forma
      // de garantir que um desconto vencido (missão já usada, cupom que
      // bateu a duração) volte pro preço cheio, já que não há como reverter
      // depois que a cobrança já aconteceu.
      await preApproval.update({ id: p.mp_subscription_id, body: { auto_recurring: { transaction_amount: valor, currency_id: 'BRL' } } })

      if (missaoDescontoIds.length > 0) {
        await admin.from('missoes_descontos').update({ aplicado: true, aplicado_em: new Date().toISOString() }).in('id', missaoDescontoIds)
      }
      if (cupomUsoId) await incrementarUsoCupom(admin, cupomUsoId)
      precosAjustados++
    } catch (err) {
      console.error('[cron/mp-renovacoes] erro ao ajustar valor da cobrança', p.id, err)
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
    .eq('e_parceira', false)
    .is('mp_subscription_id', null)
    .not('mp_periodo_fim', 'is', null)

  for (const p of cancelados ?? []) {
    if (!p.mp_periodo_fim || new Date(p.mp_periodo_fim).getTime() > agora) continue
    await admin.from('prestadoras').update({
      assinatura_ativa: false, plano: null, mp_metodo_pagamento: null, mp_ciclo: null,
      mp_periodo_fim: null, cancelamento_agendado: false,
    }).eq('id', p.id)
  }

  // ── Planos de assinatura de CLIENTES (não da prestadora) ────────────────
  let planosRenovados = 0
  let planosSuspensos = 0

  // Pix: sem recorrência automática nativa (mesma limitação já assumida
  // acima pro Pix/débito da prestadora) — gera a cobrança avulsa do próximo
  // ciclo na véspera do vencimento. Cartão não precisa de nada aqui: o MP
  // cobra sozinho, e o webhook (processarPreapproval/processarPayment)
  // renova o período quando a cobrança chega.
  const { data: assinaturasPix } = await admin
    .from('planos_assinaturas')
    .select('id, plano_id, cliente_id, prestadora_id, periodo_fim, mp_pagamento_pendente_id, planos_prestadora(nome, preco, ativo)')
    .eq('mp_metodo', 'pix')
    .eq('status', 'ativa')
    .not('periodo_fim', 'is', null)

  for (const a of assinaturasPix ?? []) {
    const plano = a.planos_prestadora as unknown as { nome: string; preco: number; ativo: boolean } | null
    if (!plano || !a.periodo_fim) continue
    const diasAteVencimento = (new Date(a.periodo_fim).getTime() - agora) / MS_DIA
    if (diasAteVencimento < 0 || diasAteVencimento > 1) continue // só gera na véspera
    if (a.mp_pagamento_pendente_id) continue // já gerou a cobrança desse ciclo, só aguardando pagamento

    try {
      const referencia = `plano_cliente:${a.plano_id}:${a.cliente_id}:${randomUUID()}`
      const pref = await preference.create({
        body: {
          items: [{ id: `plano_${a.plano_id}`, title: `Plano ${plano.nome}`, quantity: 1, unit_price: plano.preco, currency_id: 'BRL' }],
          payer: { email: payerEmailPlanoCliente(a.plano_id, a.cliente_id) },
          back_urls: { success: appUrl, failure: appUrl, pending: appUrl },
          auto_return: 'approved',
          external_reference: referencia,
          payment_methods: { excluded_payment_types: [{ id: 'credit_card' }] },
        },
      })
      if (pref.init_point) {
        await admin.from('planos_assinaturas').update({ mp_pagamento_pendente_id: pref.id }).eq('id', a.id)
        planosRenovados++
      }
    } catch (err) {
      console.error('[cron/mp-renovacoes] erro ao gerar cobrança de plano de cliente', a.id, err)
    }
  }

  // Suspende quem passou do período pago sem renovar (Pix que não pagou a
  // tempo, ou cartão cujo preapproval morreu sem o webhook de cancelamento
  // chegar — rede de segurança).
  const { data: assinaturasVencidas } = await admin
    .from('planos_assinaturas')
    .select('id')
    .eq('status', 'ativa')
    .not('periodo_fim', 'is', null)
    .lt('periodo_fim', new Date(agora).toISOString())

  if (assinaturasVencidas && assinaturasVencidas.length > 0) {
    await admin
      .from('planos_assinaturas')
      .update({ status: 'suspensa' })
      .in('id', assinaturasVencidas.map((a) => a.id))
    planosSuspensos = assinaturasVencidas.length
  }

  // ── Caixa da prestadora — libera saldo cujo prazo de 7 dias já passou ───
  await liberarCaixaVencido(admin)

  return NextResponse.json({ ok: true, renovadas, suspensas, precosAjustados, planosRenovados, planosSuspensos })
}
