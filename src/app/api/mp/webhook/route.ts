import { preApproval, mpPayment, darDiasGratis, type Plano } from '@/lib/mercadopago'
import { aplicarRestricoesDoPlano } from '@/lib/downgrade'
import { concluirMissaoIndicacaoBonus } from '@/lib/missoes'
import { criarComissaoSeAplicavel, cancelarComissaoPendente } from '@/lib/parceiras'
import { criarEntradaCaixa, reembolsarEntradaCaixa } from '@/lib/caixa'
import {
  criarOuRenovarAssinatura, creditarCaixaPlano, notificarRenovacaoPlano, parsePayerEmailPlanoCliente, aplicarUsoCredito,
} from '@/lib/planosPrestadora'
import { formatCurrency } from '@/lib/utils'
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

// Ordem dos planos, do mais pro menos restrito — decide se uma troca de plano
// é upgrade (reativa profissionais) ou downgrade (aplica restrições).
const RANK_PLANO: Record<Plano, number> = { start: 0, pro: 1, studio: 2 }

type PrestadoraIndicacao = {
  plano: Plano | null
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
    // NÃO passa `toleranceSeconds` de propósito: o SDK (mercadopago@3.2.1,
    // node_modules/mercadopago/dist/utils/webhook/index.js) compara
    // `Date.now()` (milissegundos) direto contra o `ts` do header (que o MP
    // manda em SEGUNDOS) sem normalizar unidade — dá um "drift" de ~56 anos e
    // estoura qualquer tolerância configurada, sempre (confirmado nos logs:
    // delta real calculado à mão = 0s, mesmo assim rejeitado como
    // TimestampOutOfTolerance mesmo com 3600s de tolerância). A checagem de
    // timestamp no SDK só roda quando essa opção é passada — omitir desativa
    // só essa parte quebrada, mantendo a validação HMAC (que não tem esse bug)
    // como proteção real. Replay continua coberto pela idempotência de
    // mp_eventos_processados, independente de timestamp.
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId,
      secret: process.env.MP_WEBHOOK_SECRET!,
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
    console.log('[mp webhook][payment] status refunded/cancelled — cancelando comissão pendente e entrada de caixa, se houver', { paymentId })
    await cancelarComissaoPendente(supabaseAdmin, String(pago.id))
    await reembolsarEntradaCaixa(supabaseAdmin, String(pago.id))
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

  // Pagamento de agendamento (sinal ou valor total do serviço) — identificado
  // porque o external_reference é o id do próprio agendamento temporário
  // (aguardando_pagamento), criado em /api/agendamentos/criar-pendente. Não
  // usa mp_checkouts porque aquela tabela é específica de plano/ciclo de
  // assinatura, sem nada a ver com um agendamento avulso.
  const processouAgendamento = externalRef ? await processarPagamentoAgendamento(externalRef, pago) : false
  if (processouAgendamento) return

  // Pagamento de plano de assinatura de cliente via Pix — external_reference
  // no formato 'plano_cliente:{planoId}:{clienteId}:{uuid}' (ver
  // /api/planos/[id]/assinar). Preference garante external_reference
  // confiável, diferente do preapproval hospedado usado no caminho cartão
  // (ver processarPreapproval/processarCobrancaRecorrenteCartao).
  if (externalRef?.startsWith('plano_cliente:')) {
    const [, planoId, clienteId] = externalRef.split(':')
    if (planoId && clienteId) {
      await processarPagamentoPlanoCliente({ planoId, clienteId, metodo: 'pix', pago })
      return
    }
  }

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
 * Confirma o agendamento temporário (aguardando_pagamento) cujo id é o
 * external_reference do pagamento, lança a entrada correspondente no caixa
 * da prestadora e notifica ela. Retorna `false` quando o external_reference
 * não corresponde a nenhum agendamento pendente de pagamento — nesse caso
 * quem chamou segue pro fluxo normal de checkout de plano/assinatura.
 */
async function processarPagamentoAgendamento(
  agendamentoId: string,
  pago: Awaited<ReturnType<typeof mpPayment.get>>
): Promise<boolean> {
  const { data: agendamento } = await supabaseAdmin
    .from('agendamentos')
    .select('id, prestadora_id, plano_assinatura_id, servicos(nome, preco), clientes(nome)')
    .eq('id', agendamentoId)
    .eq('status', 'aguardando_pagamento')
    .maybeSingle()

  if (!agendamento) return false

  const servico = agendamento.servicos as unknown as { nome: string; preco: number } | null
  const cliente = agendamento.clientes as unknown as { nome: string } | null
  const valorBruto = pago.transaction_amount ?? 0

  await supabaseAdmin.from('agendamentos').update({ status: 'confirmado' }).eq('id', agendamento.id)

  // Reservado com crédito de plano — debita agora que o pagamento (sinal ou
  // valor total, já com desconto do plano aplicado) foi de fato confirmado.
  if (agendamento.plano_assinatura_id) {
    const { data: assinatura } = await supabaseAdmin
      .from('planos_assinaturas')
      .select('id, creditos_restantes')
      .eq('id', agendamento.plano_assinatura_id)
      .maybeSingle()
    if (assinatura && assinatura.creditos_restantes > 0) {
      await aplicarUsoCredito(supabaseAdmin, {
        assinaturaId: assinatura.id,
        agendamentoId: agendamento.id,
        creditosRestantes: assinatura.creditos_restantes,
      })
    }
  }

  // Cobrou menos que o preço cheio do serviço → foi sinal; senão foi o
  // valor total (cenário de pagamento online opcional).
  const tipo = servico && valorBruto < servico.preco - 0.01 ? 'sinal' : 'pagamento_servico'

  await criarEntradaCaixa(supabaseAdmin, {
    prestadoraId: agendamento.prestadora_id,
    agendamentoId: agendamento.id,
    tipo,
    valorBruto,
    paymentId: String(pago.id),
  })

  const label = tipo === 'sinal' ? 'o sinal' : 'o pagamento'
  await supabaseAdmin.from('notificacoes').insert({
    prestadora_id: agendamento.prestadora_id,
    tipo: 'pagamento',
    mensagem: `${cliente?.nome ?? 'Cliente'} pagou ${label} de ${formatCurrency(valorBruto)} e confirmou o agendamento${servico ? ` de ${servico.nome}` : ''}.`,
  })

  return true
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

  // Cobrança recorrente de plano de assinatura de CLIENTE (não da
  // prestadora) — identificada pelo payer_email sintético (ver
  // payerEmailPlanoCliente em src/lib/planosPrestadora.ts). Preapproval
  // hospedado não garante external_reference de volta, então é esse o único
  // jeito confiável de correlacionar aqui.
  const refPlanoCliente = parsePayerEmailPlanoCliente(email)
  if (refPlanoCliente) {
    await processarPagamentoPlanoCliente({ ...refPlanoCliente, metodo: 'cartao', pago })
    return
  }

  const { data: prestadora } = await supabaseAdmin
    .from('prestadoras')
    .select('id, plano, mp_subscription_id, mp_metodo_pagamento, indicado_por, indicacao_recompensa_processada')
    .eq('email', email)
    .maybeSingle() as { data: (PrestadoraIndicacao & { id: string; mp_subscription_id: string | null; mp_metodo_pagamento: string | null }) | null }

  if (!prestadora?.mp_subscription_id || prestadora.mp_metodo_pagamento !== 'cartao' || !prestadora.plano) return

  await processarRecompensaIndicacaoEComissao(prestadora.id, prestadora, pago.transaction_amount ?? 0, String(pago.id))
}

/**
 * Pagamento (Pix avulso ou cobrança recorrente de cartão) de um plano de
 * assinatura de cliente aprovado — cria/renova a assinatura, credita o
 * caixa da prestadora e notifica ela. Idempotência já garantida por quem
 * chama (mp_eventos_processados, no topo de processarPayment).
 */
async function processarPagamentoPlanoCliente(
  { planoId, clienteId, metodo, pago }: {
    planoId: string
    clienteId: string
    metodo: 'cartao' | 'pix'
    pago: Awaited<ReturnType<typeof mpPayment.get>>
  }
): Promise<void> {
  const [{ data: plano }, { data: cliente }] = await Promise.all([
    supabaseAdmin.from('planos_prestadora').select('id, nome, prestadora_id').eq('id', planoId).maybeSingle(),
    supabaseAdmin.from('clientes').select('nome').eq('id', clienteId).maybeSingle(),
  ])
  if (!plano) {
    console.error('[mp webhook][payment] plano de cliente não encontrado', planoId)
    return
  }

  const { data: assinaturaExistente } = await supabaseAdmin
    .from('planos_assinaturas')
    .select('id, mp_subscription_id')
    .eq('plano_id', planoId)
    .eq('cliente_id', clienteId)
    .maybeSingle()

  const assinatura = await criarOuRenovarAssinatura(supabaseAdmin, {
    planoId,
    clienteId,
    prestadoraId: plano.prestadora_id,
    mpSubscriptionId: assinaturaExistente?.mp_subscription_id ?? null,
    metodo,
  })

  await creditarCaixaPlano(supabaseAdmin, {
    prestadoraId: plano.prestadora_id,
    assinaturaId: assinatura.id,
    valorBruto: pago.transaction_amount ?? 0,
    paymentId: String(pago.id),
  })

  await notificarRenovacaoPlano(supabaseAdmin, {
    prestadoraId: plano.prestadora_id,
    clienteNome: cliente?.nome ?? 'Uma cliente',
    planoNome: plano.nome,
  })
}

async function processarPreapproval(preapprovalId: string) {
  const sub = await preApproval.get({ id: preapprovalId })

  // Preapproval de plano de assinatura de CLIENTE (não da prestadora) —
  // identificado pelo payer_email sintético. Só captura/atualiza o
  // mp_subscription_id aqui (pra permitir cancelar depois) — crédito de
  // caixa e renovação de período/créditos ficam a cargo do evento `payment`
  // correspondente (processarPagamentoPlanoCliente), que tem payment_id pra
  // deduplicar; repetir isso aqui arriscaria contar a mesma cobrança 2x.
  const refPlanoCliente = parsePayerEmailPlanoCliente(sub.payer_email)
  if (refPlanoCliente) {
    if (sub.status === 'cancelled') {
      await supabaseAdmin
        .from('planos_assinaturas')
        .update({ status: 'cancelada', cancelado_em: new Date().toISOString() })
        .eq('mp_subscription_id', preapprovalId)
      return
    }
    if (sub.status === 'authorized') {
      // upsert (cria se o evento `payment` ainda não criou a linha, ou só
      // garante o mp_subscription_id se já criou) — mesma função usada pelo
      // lado do pagamento, então o pior caso de ambos dispararem próximos é
      // renovar o período uma vez a mais, não perder o vínculo com o MP.
      const { data: plano } = await supabaseAdmin
        .from('planos_prestadora')
        .select('id, prestadora_id')
        .eq('id', refPlanoCliente.planoId)
        .maybeSingle()
      if (plano) {
        await criarOuRenovarAssinatura(supabaseAdmin, {
          planoId: refPlanoCliente.planoId,
          clienteId: refPlanoCliente.clienteId,
          prestadoraId: plano.prestadora_id,
          mpSubscriptionId: preapprovalId,
          metodo: 'cartao',
        })
      }
    }
    return
  }

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
    let plano: Plano | null = null

    const { data: checkout } = await supabaseAdmin
      .from('mp_checkouts')
      .select('id, prestadora_id, plano')
      .eq('mp_referencia', preapprovalPlanId ?? '__sem_plano__')
      .eq('consumido', false)
      .maybeSingle()

    if (checkout) {
      prestadoraId = checkout.prestadora_id
      plano = checkout.plano as Plano
      await supabaseAdmin.from('mp_checkouts').update({ consumido: true }).eq('id', checkout.id)
    } else if (sub.payer_email) {
      const { data: configs } = await supabaseAdmin
        .from('app_config')
        .select('chave, valor')
        .in('chave', ['mp_plan_start_mensal', 'mp_plan_pro_mensal', 'mp_plan_studio_mensal'])

      const planoPorChave: Record<string, Plano> = {
        mp_plan_start_mensal: 'start',
        mp_plan_pro_mensal: 'pro',
        mp_plan_studio_mensal: 'studio',
      }
      const config = (configs ?? []).find((c) => c.valor === preapprovalPlanId)
      if (config) plano = planoPorChave[config.chave]

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

async function aplicarMudancaDePlano(prestadoraId: string, planoAnterior: Plano | null, planoNovo: Plano) {
  const rankAnterior = planoAnterior ? RANK_PLANO[planoAnterior] : -1
  const rankNovo = RANK_PLANO[planoNovo]

  if (rankNovo < rankAnterior) {
    await aplicarRestricoesDoPlano(supabaseAdmin, prestadoraId, planoNovo)
    await supabaseAdmin.from('prestadoras').update({ downgrade_aviso: true }).eq('id', prestadoraId)
  } else if (rankNovo > rankAnterior) {
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
