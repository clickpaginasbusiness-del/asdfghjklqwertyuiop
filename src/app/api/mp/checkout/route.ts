import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { preApprovalPlan, preference, getOrCreatePlanoMensal, registrarUsoCupomInicial, PRECOS, NOME_PLANO, aplicarDesconto, type Plano, type Ciclo, type MetodoPagamento } from '@/lib/mercadopago'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const PLANOS_VALIDOS = new Set<Plano>(['basico', 'pro'])
const CICLOS_VALIDOS = new Set<Ciclo>(['mensal', 'anual'])
const METODOS_VALIDOS = new Set<MetodoPagamento>(['cartao', 'pix', 'debito'])

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await request.json()
  const plano = body.plano as Plano
  const ciclo = body.ciclo as Ciclo
  const metodo = body.metodo as MetodoPagamento
  const cupomCodigo = (body.cupom as string | undefined)?.trim().toUpperCase() || undefined

  if (!PLANOS_VALIDOS.has(plano)) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }
  if (!CICLOS_VALIDOS.has(ciclo)) {
    return NextResponse.json({ error: 'Ciclo inválido' }, { status: 400 })
  }
  if (!METODOS_VALIDOS.has(metodo)) {
    return NextResponse.json({ error: 'Método de pagamento inválido' }, { status: 400 })
  }

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, nome, email, e_trial')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) {
    return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })
  }
  const prestadoraId = prestadora.id

  const admin = createAdminClient()

  // Resolve e "consome" o cupom, se informado. Igual à validação em
  // /api/mp/validate-coupon, mas aqui já incrementa `usos` e registra o
  // resgate em cupons_usos (cobracas_aplicadas=1 — a cobrança que está
  // prestes a acontecer já é a 1ª das `duracao_cobracas` permitidas).
  let cupomRow: { id: string; percentual: number | null; valor_fixo: number | null } | null = null
  if (cupomCodigo) {
    const { data: cupom } = await admin
      .from('cupons')
      .select('id, percentual, valor_fixo, ativo, expira_em, max_usos, usos')
      .eq('codigo', cupomCodigo)
      .maybeSingle()

    const valido = cupom && cupom.ativo
      && (!cupom.expira_em || new Date(cupom.expira_em) > new Date())
      && (cupom.max_usos == null || cupom.usos < cupom.max_usos)

    if (!valido) {
      return NextResponse.json({ error: 'Cupom inválido ou expirado', tipo: 'cupom' }, { status: 400 })
    }
    cupomRow = { id: cupom.id, percentual: cupom.percentual, valor_fixo: cupom.valor_fixo }
    await admin.from('cupons').update({ usos: cupom.usos + 1 }).eq('id', cupom.id)
  }

  const valorBase = PRECOS[plano][ciclo]
  const valorFinal = aplicarDesconto(valorBase, cupomRow)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not set')

  // Registra esse checkout pra correlacionar com o webhook depois — o MP não
  // garante que a `metadata` enviada na criação volte de forma confiável no
  // evento, então prestadora_id/plano/ciclo/metodo ficam guardados aqui e são
  // recuperados via `mp_referencia` (ver /api/mp/webhook).
  async function registrarCheckout(mpReferencia: string) {
    await admin.from('mp_checkouts').insert({
      prestadora_id: prestadoraId,
      plano, ciclo, metodo,
      valor: valorFinal,
      mp_referencia: mpReferencia,
    })
  }

  try {
    // ── Anual (qualquer método) — pagamento avulso via Checkout Pro. Aceita
    // Pix, débito e crédito porque não é uma cobrança recorrente do MP.
    if (ciclo === 'anual') {
      const referencia = randomUUID()
      const pref = await preference.create({
        body: {
          items: [{ id: `${plano}_anual`, title: `BelleBook Plano ${NOME_PLANO[plano]} Anual`, quantity: 1, unit_price: valorFinal, currency_id: 'BRL' }],
          payer: { email: prestadora.email },
          back_urls: { success: `${appUrl}/planos/sucesso?plano=${plano}&ciclo=anual`, failure: `${appUrl}/planos`, pending: `${appUrl}/planos` },
          auto_return: 'approved',
          external_reference: referencia,
        },
      })
      await registrarCheckout(referencia)
      if (cupomRow) await registrarUsoCupomInicial(admin, cupomRow.id, prestadoraId)
      return NextResponse.json({ url: pref.init_point })
    }

    // ── Mensal + Pix/Débito — pagamento avulso recorrente: cada mês gera uma
    // nova cobrança avulsa (ver /api/cron/mp-renovacoes), não uma assinatura
    // do MP — Pix e débito não têm cobrança automática recorrente no MP.
    if (metodo === 'pix' || metodo === 'debito') {
      const referencia = randomUUID()
      const pref = await preference.create({
        body: {
          items: [{ id: `${plano}_mensal`, title: `BelleBook Plano ${NOME_PLANO[plano]} Mensal`, quantity: 1, unit_price: valorFinal, currency_id: 'BRL' }],
          payer: { email: prestadora.email },
          back_urls: { success: `${appUrl}/planos/sucesso?plano=${plano}&ciclo=mensal`, failure: `${appUrl}/planos`, pending: `${appUrl}/planos` },
          auto_return: 'approved',
          external_reference: referencia,
          payment_methods: { excluded_payment_types: [{ id: 'credit_card' }] },
        },
      })
      await registrarCheckout(referencia)
      await admin.from('prestadoras').update({ mp_pagamento_pendente_id: pref.id }).eq('id', prestadora.id)
      if (cupomRow) await registrarUsoCupomInicial(admin, cupomRow.id, prestadoraId)
      return NextResponse.json({ url: pref.init_point })
    }

    // ── Mensal + Cartão — assinatura recorrente via preapproval. Trial de 30
    // dias é exclusivo do Básico pra quem nunca usou; cupom e/ou trial exigem
    // um preapproval_plan próprio (não o compartilhado) porque o preço/trial
    // fica embutido no plano — usar o plano compartilhado aplicaria pra
    // qualquer outra assinante que passasse por ele depois.
    const incluirTrial = plano === 'basico' && !prestadora.e_trial
    let planId: string
    let planoCustomizado = false
    if (cupomRow || incluirTrial) {
      const criado = await preApprovalPlan.create({
        body: {
          reason: `BelleBook — Plano ${NOME_PLANO[plano]} Mensal${cupomRow ? ` (cupom ${cupomCodigo})` : ''}`,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: valorFinal,
            currency_id: 'BRL',
            ...(incluirTrial ? { free_trial: { frequency: 30, frequency_type: 'days' } } : {}),
          },
          back_url: `${appUrl}/planos/sucesso?plano=${plano}&ciclo=mensal`,
          payment_methods_allowed: { payment_types: [{ id: 'credit_card' }] },
        },
      })
      if (!criado.id) throw new Error('Mercado Pago não retornou id do plano criado')
      planId = criado.id
      planoCustomizado = true
    } else {
      planId = await getOrCreatePlanoMensal(admin, plano)
    }

    // Só registra em mp_checkouts quando o plano é exclusivo desse checkout —
    // o plano compartilhado (sem cupom/trial) é reusado por várias
    // prestadoras, então não serve como chave por-checkout; nesse caso o
    // webhook identifica a prestadora pelo payer_email (ver back_url abaixo).
    if (planoCustomizado) await registrarCheckout(planId)
    if (cupomRow) await registrarUsoCupomInicial(admin, cupomRow.id, prestadoraId)

    const planoCompleto = await preApprovalPlan.get({ preApprovalPlanId: planId })
    if (!planoCompleto.init_point) throw new Error('Plano sem init_point')

    const url = `${planoCompleto.init_point}&payer_email=${encodeURIComponent(prestadora.email)}`
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[mp/checkout] erro ao criar cobrança', err)
    return NextResponse.json({ error: 'Erro ao criar cobrança' }, { status: 500 })
  }
}
