import { preApproval, mpPayment, darDiasGratis } from '@/lib/mercadopago'
import { aplicarDowngradeParaBasico } from '@/lib/downgrade'
import { concluirMissaoIndicacaoBonus } from '@/lib/missoes'
import { criarComissaoSeAplicavel, cancelarComissaoPendente } from '@/lib/parceiras'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago'
import { NextRequest, NextResponse } from 'next/server'

// Webhook usa service role pois não tem sessão de usuário
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MS_DIA = 24 * 60 * 60 * 1000
const MS_30_DIAS = 30 * MS_DIA
const MS_365_DIAS = 365 * MS_DIA

type PrestadoraIndicacao = {
  plano: 'basico' | 'pro' | null
  indicado_por: string | null
  indicacao_recompensa_processada: boolean
} | null | undefined

/** Extrai o `ts=` do header x-signature manualmente, sem depender da
 * validação passar — só pra diagnóstico (loga o delta contra o relógio do
 * servidor mesmo quando a validação real rejeita por TimestampOutOfTolerance). */
function extrairTimestampSignature(xSignature: string | null): { tsBruto: string | null; deltaSegundos: number | null } {
  if (!xSignature) return { tsBruto: null, deltaSegundos: null }
  const match = xSignature.match(/ts=(\d+)/)
  if (!match) return { tsBruto: null, deltaSegundos: null }
  const tsBruto = match[1]
  const tsNum = Number(tsBruto)
  // MP documenta `ts` em segundos desde epoch — se vier maior que ~10^12 é
  // porque na verdade está em milissegundos (bug do lado de quem gerou, ou
  // mudança de formato não documentada); normaliza pra segundos antes do delta.
  const tsSegundos = tsNum > 1e12 ? Math.floor(tsNum / 1000) : tsNum
  const agoraSegundos = Math.floor(Date.now() / 1000)
  return { tsBruto, deltaSegundos: agoraSegundos - tsSegundos }
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const dataId = url.searchParams.get('data.id')
  const xSignature = request.headers.get('x-signature')
  const xRequestId = request.headers.get('x-request-id')

  // Log de TODA requisição recebida, antes de qualquer validação — confirma
  // se o MP está de fato chamando o webhook, independente do que acontece depois.
  const { tsBruto, deltaSegundos } = extrairTimestampSignature(xSignature)
  console.log('[mp webhook] requisição recebida', {
    url: request.url,
    dataIdQuery: dataId,
    xSignaturePresente: !!xSignature,
    xSignatureRaw: xSignature,
    xRequestId,
    tsBrutoHeader: tsBruto,
    agoraServidorEpochSegundos: Math.floor(Date.now() / 1000),
    deltaSegundos, // positivo = header mais antigo que o relógio do servidor
    secretConfigurado: !!process.env.MP_WEBHOOK_SECRET,
  })

  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId,
      secret: process.env.MP_WEBHOOK_SECRET!,
      // O MP pode demorar bastante pra entregar a notificação (fila própria,
      // retries) — 300s (5min) rejeitava 100% das chamadas reais em produção
      // (confirmado nos logs). Ainda é seguro contra replay porque
      // mp_eventos_processados garante idempotência por payment_id
      // independente da janela de tolerância.
      toleranceSeconds: 3600,
    })
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) {
      console.error('[mp webhook] assinatura inválida', {
        reason: err.reason,
        requestId: err.requestId,
        timestamp: err.timestamp,
        deltaSegundosCalculado: deltaSegundos,
        secretConfigurado: !!process.env.MP_WEBHOOK_SECRET,
      })
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
    }
    throw err
  }

  const body = await request.json().catch(() => null) as { type?: string; data?: { id?: string } } | null
  const tipo = body?.type
  const id = body?.data?.id
  console.log('[mp webhook] assinatura válida, evento identificado', { tipo, id, body })
  if (!tipo || !id) return NextResponse.json({ received: true })

  try {
    if (tipo === 'payment') {
      await processarPayment(id)
    } else if (tipo === 'subscription_preapproval' || tipo === 'preapproval') {
      await processarPreapproval(id)
    }
  } catch (err) {
    console.error('[mp webhook] erro ao processar evento', tipo, id, err)
    return NextResponse.json({ error: 'Erro ao processar evento' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function processarPayment(paymentId: string) {
  const pago = await mpPayment.get({ id: paymentId })
  console.log('[mp webhook][payment] detalhes do pagamento', {
    paymentId,
    status: pago.status,
    statusDetail: pago.status_detail,
    externalReference: pago.external_reference,
    transactionAmount: pago.transaction_amount,
    payerEmail: pago.payer?.email,
  })

  if (pago.status === 'refunded' || pago.status === 'cancelled') {
    console.log('[mp webhook][payment] status refunded/cancelled — cancelando comissão pendente, se houver', { paymentId })
    await cancelarComissaoPendente(supabaseAdmin, String(pago.id))
    return
  }

  if (pago.status !== 'approved') {
    console.log('[mp webhook][payment] status ainda não é approved — nada a fazer por enquanto', { paymentId, status: pago.status })
    return
  }

  // Idempotência — o MP pode reentregar a mesma notificação; o índice único
  // de payment_id é quem garante isso de verdade em entregas concorrentes.
  const { error: duplicado } = await supabaseAdmin
    .from('mp_eventos_processados')
    .insert({ payment_id: String(pago.id) })
  if (duplicado) {
    console.log('[mp webhook][payment] payment_id já processado antes (reentrega do MP) — ignorando', { paymentId })
    return
  }

  const externalRef = pago.external_reference
  console.log('[mp webhook][payment] buscando checkout correspondente', { paymentId, externalRef })

  const { data: checkout } = externalRef
    ? await supabaseAdmin
        .from('mp_checkouts')
        .select('id, prestadora_id, plano, ciclo, metodo, valor')
        .eq('mp_referencia', externalRef)
        .eq('consumido', false)
        .maybeSingle()
    : { data: null }

  console.log('[mp webhook][payment] resultado da busca em mp_checkouts', { paymentId, externalRef, encontrouCheckout: !!checkout, checkout })

  if (!checkout) {
    // Não veio de uma Preference nossa (Pix/débito, anual) — é provavelmente
    // uma cobrança recorrente de uma assinatura por cartão, que o MP gera
    // sozinho sem passar pelo nosso /api/mp/checkout (sem external_reference
    // nosso). Identifica por payer_email; a ativação de plano/período de uma
    // assinatura por cartão já é feita inteiramente por processarPreapproval
    // (evento subscription_preapproval) — aqui só falta tratar a comissão de
    // parceira e reverter um desconto de 1 ciclo que o cron tenha aplicado.
    console.log('[mp webhook][payment] sem checkout — tratando como cobrança recorrente de cartão', { paymentId, payerEmail: pago.payer?.email })
    await processarCobrancaRecorrenteCartao(pago)
    return
  }

  await supabaseAdmin.from('mp_checkouts').update({ consumido: true }).eq('id', checkout.id)

  const { plano, ciclo, metodo, prestadora_id: prestadoraId } = checkout

  const { data: prestadoraAntes } = await supabaseAdmin
    .from('prestadoras')
    .select('plano, indicado_por, indicacao_recompensa_processada')
    .eq('id', prestadoraId)
    .single() as { data: PrestadoraIndicacao }

  const periodoFim = new Date(Date.now() + (ciclo === 'anual' ? MS_365_DIAS : MS_30_DIAS)).toISOString()

  const { error: erroUpdatePlano } = await supabaseAdmin.from('prestadoras').update({
    plano,
    assinatura_ativa: true,
    e_trial: false,
    trial_fim: null,
    mp_ciclo: ciclo,
    mp_metodo_pagamento: metodo,
    mp_periodo_fim: periodoFim,
    mp_pagamento_pendente_id: null,
    cancelamento_agendado: false,
  }).eq('id', prestadoraId)

  console.log('[mp webhook][payment] update de plano na prestadora', {
    paymentId, prestadoraId, plano, ciclo, metodo, periodoFim,
    sucesso: !erroUpdatePlano,
    erro: erroUpdatePlano ?? null,
  })

  await aplicarMudancaDePlano(prestadoraId, prestadoraAntes?.plano ?? null, plano)
  await processarRecompensaIndicacaoEComissao(prestadoraId, prestadoraAntes, pago.transaction_amount ?? 0, String(pago.id))
}

/**
 * Cobrança recorrente de uma assinatura por cartão (o MP gera sozinho, sem
 * passar pelo nosso /api/mp/checkout — não tem external_reference nosso pra
 * correlacionar via mp_checkouts). plano/assinatura_ativa/mp_periodo_fim já
 * são mantidos por processarPreapproval a cada ping de status; o valor da
 * cobrança (com ou sem desconto de missão/cupom) já é ajustado com
 * antecedência pelo cron, na véspera de cada ciclo (ver
 * /api/cron/mp-renovacoes — só ele sabe quando reverter pro preço cheio,
 * então não há nada reativo a fazer aqui). Só falta gerar a comissão de
 * parceira desse ciclo.
 */
async function processarCobrancaRecorrenteCartao(pago: Awaited<ReturnType<typeof mpPayment.get>>): Promise<void> {
  const email = pago.payer?.email
  if (!email) return

  const { data: prestadora } = await supabaseAdmin
    .from('prestadoras')
    .select('id, plano, mp_subscription_id, mp_metodo_pagamento, indicado_por, indicacao_recompensa_processada')
    .eq('email', email)
    .maybeSingle() as { data: (PrestadoraIndicacao & { id: string; mp_subscription_id: string | null; mp_metodo_pagamento: string | null }) | null }

  if (!prestadora?.mp_subscription_id || prestadora.mp_metodo_pagamento !== 'cartao' || !prestadora.plano) return

  await processarRecompensaIndicacaoEComissao(prestadora.id, prestadora, pago.transaction_amount ?? 0, String(pago.id))
}

async function processarPreapproval(preapprovalId: string) {
  const sub = await preApproval.get({ id: preapprovalId })
  // `preapproval_plan_id` existe na resposta real da API (documentado pela
  // MP) mas não está no tipo `PreApprovalResponse` do SDK — só no tipo de
  // resultado de busca (`PreApprovalResults`).
  const preapprovalPlanId = (sub as unknown as { preapproval_plan_id?: string }).preapproval_plan_id

  if (sub.status === 'authorized') {
    const { data: jaVinculada } = await supabaseAdmin
      .from('prestadoras')
      .select('id')
      .eq('mp_subscription_id', preapprovalId)
      .maybeSingle()

    if (jaVinculada) {
      // Já é a assinatura vinculada — só reflete o próximo vencimento.
      await supabaseAdmin.from('prestadoras').update({
        assinatura_ativa: true,
        mp_periodo_fim: sub.next_payment_date ?? null,
      }).eq('id', jaVinculada.id)
      return
    }

    // Primeira ativação dessa assinatura — resolve prestadora/plano via
    // mp_checkouts (plano criado sob medida, com cupom/trial) ou via
    // payer_email + id do plano compartilhado (caminho padrão).
    let prestadoraId: string | null = null
    let plano: 'basico' | 'pro' | null = null

    const { data: checkout } = await supabaseAdmin
      .from('mp_checkouts')
      .select('id, prestadora_id, plano')
      .eq('mp_referencia', preapprovalPlanId ?? '__sem_plano__')
      .eq('consumido', false)
      .maybeSingle()

    if (checkout) {
      prestadoraId = checkout.prestadora_id
      plano = checkout.plano as 'basico' | 'pro'
      await supabaseAdmin.from('mp_checkouts').update({ consumido: true }).eq('id', checkout.id)
    } else if (sub.payer_email) {
      const [{ data: basicoCfg }, { data: proCfg }] = await Promise.all([
        supabaseAdmin.from('app_config').select('valor').eq('chave', 'mp_plano_basico_mensal').maybeSingle(),
        supabaseAdmin.from('app_config').select('valor').eq('chave', 'mp_plano_pro_mensal').maybeSingle(),
      ])
      if (preapprovalPlanId === basicoCfg?.valor) plano = 'basico'
      else if (preapprovalPlanId === proCfg?.valor) plano = 'pro'

      const { data: prestadora } = await supabaseAdmin
        .from('prestadoras')
        .select('id')
        .eq('email', sub.payer_email)
        .maybeSingle()
      prestadoraId = prestadora?.id ?? null
    }

    if (!prestadoraId || !plano) {
      console.error('[mp webhook] preapproval autorizado sem correlação encontrada', preapprovalId, sub.payer_email, preapprovalPlanId)
      return
    }

    const { data: prestadoraAntes } = await supabaseAdmin
      .from('prestadoras')
      .select('plano, mp_subscription_id, indicado_por, indicacao_recompensa_processada')
      .eq('id', prestadoraId)
      .single()

    // Substituindo uma assinatura anterior (upgrade/downgrade/troca de
    // método de pagamento) — cancela a antiga pra não cobrar as duas.
    const subscriptionAntiga = prestadoraAntes?.mp_subscription_id
    if (subscriptionAntiga && subscriptionAntiga !== preapprovalId) {
      try {
        await preApproval.update({ id: subscriptionAntiga, body: { status: 'cancelled' } })
      } catch (err) {
        console.error('[mp webhook] falha ao cancelar assinatura antiga substituída', subscriptionAntiga, err)
      }
    }

    await supabaseAdmin.from('prestadoras').update({
      plano,
      assinatura_ativa: true,
      e_trial: false,
      trial_fim: null,
      mp_subscription_id: preapprovalId,
      mp_metodo_pagamento: 'cartao',
      mp_ciclo: 'mensal',
      mp_periodo_fim: sub.next_payment_date ?? null,
      cancelamento_agendado: false,
    }).eq('id', prestadoraId)

    await aplicarMudancaDePlano(prestadoraId, prestadoraAntes?.plano ?? null, plano)
    // O primeiro pagamento dessa assinatura chega separadamente como evento
    // `payment` (processarPayment) — mas sem linha em mp_checkouts (já
    // consumida aqui), então a comissão de parceira é tratada lá via
    // mp_subscription_id, não aqui.
    await processarRecompensaIndicacaoEComissao(prestadoraId, prestadoraAntes, null, null)
    return
  }

  if (sub.status === 'cancelled') {
    const { data: prestadora } = await supabaseAdmin
      .from('prestadoras')
      .select('id, e_parceira')
      .eq('mp_subscription_id', preapprovalId)
      .maybeSingle()
    if (!prestadora) return
    // Parceira: o cargo cancela a assinatura de propósito (Pro grátis) e já
    // zera mp_subscription_id na hora — esse evento chega depois, de forma
    // assíncrona, então ignora pra não apagar o que já foi setado.
    if (prestadora.e_parceira) return

    await supabaseAdmin.from('prestadoras').update({
      assinatura_ativa: false,
      plano: null,
      mp_subscription_id: null,
      mp_periodo_fim: null,
    }).eq('id', prestadora.id)
    return
  }

  if (sub.status === 'paused') {
    const { data: prestadora } = await supabaseAdmin
      .from('prestadoras')
      .select('id')
      .eq('mp_subscription_id', preapprovalId)
      .maybeSingle()
    if (!prestadora) return
    await supabaseAdmin.from('prestadoras').update({ assinatura_ativa: false }).eq('id', prestadora.id)
  }
}

async function aplicarMudancaDePlano(prestadoraId: string, planoAnterior: 'basico' | 'pro' | null, planoNovo: 'basico' | 'pro') {
  if (planoAnterior === 'pro' && planoNovo === 'basico') {
    await aplicarDowngradeParaBasico(supabaseAdmin, prestadoraId)
    await supabaseAdmin.from('prestadoras').update({ downgrade_aviso: true }).eq('id', prestadoraId)
  } else if (planoAnterior === 'basico' && planoNovo === 'pro') {
    await supabaseAdmin.from('profissionais').update({ ativa: true }).eq('prestadora_id', prestadoraId)
    await supabaseAdmin.from('prestadoras').update({ downgrade_aviso: false }).eq('id', prestadoraId)
  }
}

/**
 * Recompensa de indicação (estágio 2, quando a indicada assina um plano) e
 * comissão de parceira. `paymentId`/`valorPago` só existem quando esse
 * evento veio de um `payment` de verdade — a ativação de um preapproval
 * sozinha não tem cobrança pra vincular a comissão.
 */
async function processarRecompensaIndicacaoEComissao(
  prestadoraId: string,
  prestadoraAntes: PrestadoraIndicacao,
  valorPago: number | null,
  paymentId: string | null
) {
  if (paymentId && valorPago != null) {
    try {
      await criarComissaoSeAplicavel(supabaseAdmin, {
        indicadaId: prestadoraId,
        paymentId,
        valorAssinatura: valorPago,
      })
    } catch (err) {
      console.error('[mp webhook] erro ao criar comissão de parceira', prestadoraId, err)
    }
  }

  if (!prestadoraAntes?.indicado_por || prestadoraAntes.indicacao_recompensa_processada) return

  try {
    // Marca como processada imediatamente para evitar double-reward
    await supabaseAdmin
      .from('prestadoras')
      .update({ indicacao_recompensa_processada: true })
      .eq('id', prestadoraId)

    await darDiasGratis(supabaseAdmin, prestadoraAntes.indicado_por, 30, 'indicacao_estagio2')

    // Missão "Indique uma amiga": a recompensa (30 dias grátis / desconto)
    // já foi concedida acima, isso só marca a missão como concluída no
    // drawer, se ela estiver ativa no mês corrente do referrer.
    try {
      await concluirMissaoIndicacaoBonus(supabaseAdmin, prestadoraAntes.indicado_por)
    } catch (err) {
      console.error('[mp webhook] erro ao concluir missão de indicação', prestadoraAntes.indicado_por, err)
    }
  } catch (err) {
    console.error('[mp webhook] erro ao processar recompensa de indicação', prestadoraId, err)
  }
}
