import { MercadoPagoConfig, PreApproval, PreApprovalPlan, Payment, Preference } from 'mercadopago'
import type { SupabaseClient } from '@supabase/supabase-js'

const mpConfig = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })

export const preApproval = new PreApproval(mpConfig)
export const preApprovalPlan = new PreApprovalPlan(mpConfig)
export const mpPayment = new Payment(mpConfig)
export const preference = new Preference(mpConfig)

export type Plano = 'basico' | 'pro'
export type Ciclo = 'mensal' | 'anual'
export type MetodoPagamento = 'cartao' | 'pix' | 'debito'

/** Preços em reais — únicos "price IDs" que existem são os 2 preapproval_plan
 * de cartão+mensal (ver getOrCreatePlanoMensal); anual é sempre pagamento
 * avulso via Preference, com o preço fixo lido daqui direto. */
export const PRECOS: Record<Plano, Record<Ciclo, number>> = {
  basico: { mensal: 49, anual: 470 },
  pro: { mensal: 89, anual: 855 },
}

export const NOME_PLANO: Record<Plano, string> = {
  basico: 'Básico',
  pro: 'Pro',
}

/**
 * Busca (ou cria, na primeira vez) o preapproval_plan do MP pro plano+mensal
 * via cartão de crédito — o único caso que usa um plano do MP de verdade,
 * já que anual e pix/débito mensal são pagamento avulso (ver checkout).
 * O id criado fica em app_config porque uma rota serverless não tem como
 * persistir variável de ambiente em runtime.
 */
export async function getOrCreatePlanoMensal(admin: SupabaseClient, plano: Plano): Promise<string> {
  const chave = `mp_plano_${plano}_mensal`
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
      back_url: `${appUrl}/painel?subscribed=1`,
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
    plano: 'basico',
    e_trial: true,
    trial_fim: novoFim.toISOString(),
  }).eq('id', prestadoraId)
}
