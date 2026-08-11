import { MercadoPagoConfig, PreApproval, PreApprovalPlan, Payment, Preference } from 'mercadopago'
import type { SupabaseClient } from '@supabase/supabase-js'

const mpConfig = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })

export const preApproval = new PreApproval(mpConfig)
export const preApprovalPlan = new PreApprovalPlan(mpConfig)
export const mpPayment = new Payment(mpConfig)
export const preference = new Preference(mpConfig)

export type Plano = 'start' | 'pro' | 'studio'
export type Ciclo = 'mensal' | 'anual'
export type MetodoPagamento = 'cartao' | 'pix' | 'debito'

/** Preços em reais — únicos "price IDs" que existem são os 3 preapproval_plan
 * de cartão+mensal (ver getOrCreatePlanoMensal); anual é sempre pagamento
 * avulso via Preference, com o preço fixo lido daqui direto. */
export const PRECOS: Record<Plano, Record<Ciclo, number>> = {
  start: { mensal: 49, anual: 470 },
  pro: { mensal: 89, anual: 855 },
  studio: { mensal: 119, anual: 1142 },
}

export const NOME_PLANO: Record<Plano, string> = {
  start: 'Start',
  pro: 'Pro',
  studio: 'Studio',
}

/**
 * Busca (ou cria, na primeira vez) o preapproval_plan do MP pro plano+mensal
 * via cartão de crédito — o único caso que usa um plano do MP de verdade,
 * já que anual e pix/débito mensal são pagamento avulso (ver checkout). Chave
 * em app_config é `mp_plan_{plano}_mensal` (mesmo nome pedido pro time de
 * produto acompanhar) — o id criado fica lá porque uma rota serverless não
 * tem como persistir variável de ambiente em runtime.
 */
export async function getOrCreatePlanoMensal(admin: SupabaseClient, plano: Plano): Promise<string> {
  const chave = `mp_plan_${plano}_mensal`
  const { data } = await admin.from('app_config').select('valor').eq('chave', chave).maybeSingle()
  if (data?.valor) return data.valor

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not set')

  const criado = await preApprovalPlan.create({
    body: {
      reason: `BelleBook — Plano ${NOME_PLANO[plano]} Mensal`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: PRECOS[plano].mensal,
        currency_id: 'BRL',
      },
      back_url: `${appUrl}/planos/sucesso?plano=${plano}&ciclo=mensal`,
      payment_methods_allowed: { payment_types: [{ id: 'credit_card' }] },
    },
  })

  const id = criado.id
  if (!id) throw new Error('Mercado Pago não retornou id do plano criado')

  await admin.from('app_config').upsert({ chave, valor: id })
  return id
}

/** Calcula o valor final aplicando um cupom (percentual ou valor fixo). */
export function aplicarDesconto(valor: number, cupom: { percentual: number | null; valor_fixo: number | null } | null): number {
  if (!cupom) return valor
  let final = valor
  if (cupom.percentual != null) final = valor * (1 - cupom.percentual / 100)
  else if (cupom.valor_fixo != null) final = valor - cupom.valor_fixo
  return Math.max(0, Math.round(final * 100) / 100)
}

/** Soma os descontos de missões pendentes (não expirados) de uma prestadora,
 * capado em 100% — mesmo critério que o antigo fluxo de coupon do Stripe. */
export async function somarDescontosMissoesPendentes(
  admin: SupabaseClient,
  prestadoraId: string
): Promise<{ percentual: number; ids: string[] }> {
  const { data } = await admin
    .from('missoes_descontos')
    .select('id, percentual')
    .eq('prestadora_id', prestadoraId)
    .eq('aplicado', false)
    .or(`expira_em.is.null,expira_em.gt.${new Date().toISOString()}`)

  const pendentes = data ?? []
  const percentual = Math.min(100, pendentes.reduce((soma, d) => soma + d.percentual, 0))
  return { percentual, ids: pendentes.map((d) => d.id) }
}

/**
 * Cupom ainda válido pra aplicar na próxima cobrança de uma prestadora que já
 * usou ele — pega o registro em cupons_usos (se houver, o mais recente) e
 * confere se ainda não bateu `duracao_cobracas` (null = vitalício). Diferente
 * de "cupom existe e está ativo" (checado na hora do checkout): aqui é
 * especificamente "ela já resgatou esse cupom e ainda tem cobranças
 * restantes com desconto".
 */
export async function buscarCupomAplicavel(
  admin: SupabaseClient,
  prestadoraId: string
): Promise<{ cupomUsoId: string; percentual: number | null; valor_fixo: number | null } | null> {
  const { data } = await admin
    .from('cupons_usos')
    .select('id, cobracas_aplicadas, cupons(percentual, valor_fixo, ativo, duracao_cobracas)')
    .eq('prestadora_id', prestadoraId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  const cupom = data.cupons as unknown as { percentual: number | null; valor_fixo: number | null; ativo: boolean; duracao_cobracas: number | null } | null
  if (!cupom || !cupom.ativo) return null
  if (cupom.duracao_cobracas != null && data.cobracas_aplicadas >= cupom.duracao_cobracas) return null

  return { cupomUsoId: data.id, percentual: cupom.percentual, valor_fixo: cupom.valor_fixo }
}

/** Registra o resgate inicial de um cupom no checkout — a cobrança que está
 * prestes a acontecer já consome a 1ª das `duracao_cobracas` permitidas. */
export async function registrarUsoCupomInicial(admin: SupabaseClient, cupomId: string, prestadoraId: string): Promise<void> {
  await admin.from('cupons_usos').upsert(
    { cupom_id: cupomId, prestadora_id: prestadoraId, cobracas_aplicadas: 1 },
    { onConflict: 'cupom_id,prestadora_id' }
  )
}

/** Soma +1 cobrança aplicada — chamado quando o cron decide descontar a
 * próxima cobrança de uma assinatura já em andamento. */
export async function incrementarUsoCupom(admin: SupabaseClient, cupomUsoId: string): Promise<void> {
  const { data } = await admin.from('cupons_usos').select('cobracas_aplicadas').eq('id', cupomUsoId).maybeSingle()
  if (!data) return
  await admin.from('cupons_usos').update({ cobracas_aplicadas: data.cobracas_aplicadas + 1 }).eq('id', cupomUsoId)
}

export interface ProximaCobranca {
  valor: number
  missaoDescontoIds: string[]
  cupomUsoId: string | null
}

/**
 * Calcula o valor da próxima cobrança de uma prestadora já assinante,
 * combinando desconto de missão pendente (sempre 1 ciclo, consumido na hora)
 * com desconto de cupom ainda válido (por N cobranças, ver
 * buscarCupomAplicavel). Usado tanto pro cron gerar a cobrança avulsa
 * Pix/débito quanto pra ajustar o valor da próxima cobrança automática no
 * cartão — quem chama decide o que fazer com `missaoDescontoIds`/`cupomUsoId`
 * depois (marcar aplicado / incrementar contagem).
 */
export async function calcularProximaCobranca(
  admin: SupabaseClient,
  prestadoraId: string,
  precoBase: number
): Promise<ProximaCobranca> {
  const [missao, cupom] = await Promise.all([
    somarDescontosMissoesPendentes(admin, prestadoraId),
    buscarCupomAplicavel(admin, prestadoraId),
  ])

  let percentual = missao.percentual
  let valorFixo = 0
  if (cupom?.percentual != null) percentual = Math.min(100, percentual + cupom.percentual)
  if (cupom?.valor_fixo != null) valorFixo += cupom.valor_fixo

  let valor = precoBase
  if (percentual > 0) valor = valor * (1 - percentual / 100)
  valor = Math.max(0, Math.round((valor - valorFixo) * 100) / 100)

  return {
    valor,
    missaoDescontoIds: missao.ids,
    cupomUsoId: cupom?.cupomUsoId ?? null,
  }
}

const MS_DIA = 24 * 60 * 60 * 1000

/**
 * Concede N dias grátis a uma prestadora — usado por recompensa de indicação
 * (estágios 1 e 2) e pelos benefícios manuais do admin. Substitui o truque do
 * Stripe de empurrar `trial_end` numa subscription ativa: o SDK do MP não
 * expõe `next_payment_date` no update de um preapproval (só
 * `transaction_amount`/`status`/etc — confirmado nos tipos do SDK), então
 * pra quem já paga por cartão o "dias grátis" vira um desconto proporcional
 * na próxima cobrança, aplicado pelo mesmo motor dos descontos de missão
 * (ver /api/cron/mp-renovacoes). Pra quem paga por Pix/débito mensal (onde
 * nós mesmos geramos cada cobrança) dá pra simplesmente adiar
 * `mp_periodo_fim` direto, sem limitação nenhuma do MP.
 */
export async function darDiasGratis(
  admin: SupabaseClient,
  prestadoraId: string,
  dias: number,
  origem: string
): Promise<void> {
  const { data: p } = await admin
    .from('prestadoras')
    .select('assinatura_ativa, e_trial, trial_fim, mp_metodo_pagamento, mp_periodo_fim')
    .eq('id', prestadoraId)
    .maybeSingle()

  if (!p) return

  if (p.assinatura_ativa && !p.e_trial && p.mp_metodo_pagamento === 'cartao') {
    const percentual = Math.min(100, Math.round((dias / 30) * 100))
    await admin.from('missoes_descontos').insert({ prestadora_id: prestadoraId, percentual, origem })
    return
  }

  if (p.assinatura_ativa && !p.e_trial && (p.mp_metodo_pagamento === 'pix' || p.mp_metodo_pagamento === 'debito')) {
    const base = p.mp_periodo_fim ? new Date(p.mp_periodo_fim) : new Date()
    const novoFim = new Date(Math.max(base.getTime(), Date.now()) + dias * MS_DIA)
    await admin.from('prestadoras').update({ mp_periodo_fim: novoFim.toISOString() }).eq('id', prestadoraId)
    return
  }

  if (p.assinatura_ativa && p.e_trial && p.trial_fim) {
    const base = new Date(p.trial_fim)
    const novoFim = new Date(Math.max(base.getTime(), Date.now()) + dias * MS_DIA)
    await admin.from('prestadoras').update({ trial_fim: novoFim.toISOString() }).eq('id', prestadoraId)
    return
  }

  const novoFim = new Date(Date.now() + dias * MS_DIA)
  await admin.from('prestadoras').update({
    assinatura_ativa: true,
    plano: 'start',
    e_trial: true,
    trial_fim: novoFim.toISOString(),
  }).eq('id', prestadoraId)
}

/**
 * Busca (ou cria, na primeira assinatura) o preapproval_plan do MP pra um
 * plano de assinatura de CLIENTE (planos_prestadora — ex.: "4 cortes por
 * mês"), pago por cartão de crédito. Diferente de getOrCreatePlanoMensal
 * (planos de tier do BelleBook, compartilhados entre todas as prestadoras):
 * aqui cada plano é específico de uma prestadora com preço/intervalo
 * próprios, então o id fica salvo direto na linha (planos_prestadora.
 * mp_preapproval_plan_id) em vez de em app_config.
 */
export async function getOrCreatePreapprovalPlanoCliente(
  admin: SupabaseClient,
  plano: { id: string; nome: string; preco: number; intervalo: 'mensal' | 'bimensal' | 'trimestral' | 'semestral' | 'anual'; mp_preapproval_plan_id: string | null },
  prestadoraSlug: string
): Promise<string> {
  if (plano.mp_preapproval_plan_id) return plano.mp_preapproval_plan_id

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not set')

  const mesesPorIntervalo: Record<typeof plano.intervalo, number> = {
    mensal: 1, bimensal: 2, trimestral: 3, semestral: 6, anual: 12,
  }

  const criado = await preApprovalPlan.create({
    body: {
      reason: `BelleBook — Plano ${plano.nome}`,
      auto_recurring: {
        frequency: mesesPorIntervalo[plano.intervalo],
        frequency_type: 'months',
        transaction_amount: plano.preco,
        currency_id: 'BRL',
      },
      back_url: `${appUrl}/n/${prestadoraSlug}?assinatura=sucesso`,
      payment_methods_allowed: { payment_types: [{ id: 'credit_card' }] },
    },
  })

  const id = criado.id
  if (!id) throw new Error('Mercado Pago não retornou id do plano criado')

  await admin.from('planos_prestadora').update({ mp_preapproval_plan_id: id }).eq('id', plano.id)
  return id
}
