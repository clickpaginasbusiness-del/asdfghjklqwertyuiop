import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParceiraComissao, ParceiraSaque } from '@/lib/types'

/**
 * Motor do sistema de Parceiras/Afiliadas: comissão recorrente (20% ou 30%)
 * sobre a assinatura de cada prestadora indicada.
 */

const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000
const VALOR_MINIMO_SAQUE = 50

type Admin = SupabaseClient

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Quantas comissões (não canceladas) foram geradas nos últimos 30 dias — usado tanto pra decidir o tier quanto pro "X de 10" exibido no relatório. */
export async function contarComissoesUltimos30Dias(admin: Admin, parceiraId: string): Promise<number> {
  const trintaDiasAtras = new Date(Date.now() - TRINTA_DIAS_MS)
  const { count } = await admin
    .from('parceiras_comissoes')
    .select('id', { count: 'exact', head: true })
    .eq('parceira_id', parceiraId)
    .neq('status', 'cancelado')
    .gte('created_at', trintaDiasAtras.toISOString())
  return count ?? 0
}

/**
 * Regra dos 30 dias rolantes: se a parceira bateu 10 novas assinaturas nos
 * últimos 30 dias, sobe (ou renova) o período de 30%. Caso contrário, só
 * continua em 30% se ainda estiver dentro de um período já conquistado
 * antes (30 dias a partir de `parceira_periodo_30_inicio`) — senão volta
 * pro padrão de 20%. Chamada a cada nova comissão gerada.
 */
export async function atualizarComissaoParceira(admin: Admin, parceiraId: string): Promise<void> {
  const { data: parceira } = await admin
    .from('prestadoras')
    .select('parceira_periodo_30_inicio')
    .eq('id', parceiraId)
    .maybeSingle()

  const agora = new Date()
  const count = await contarComissoesUltimos30Dias(admin, parceiraId)

  if (count >= 10) {
    await admin.from('prestadoras').update({
      parceira_periodo_30_inicio: agora.toISOString(),
      parceira_comissao_percentual: 30,
    }).eq('id', parceiraId)
    return
  }

  const inicio = parceira?.parceira_periodo_30_inicio ? new Date(parceira.parceira_periodo_30_inicio) : null
  const aindaNoPeriodo = inicio ? inicio.getTime() + TRINTA_DIAS_MS > agora.getTime() : false

  await admin.from('prestadoras').update({
    parceira_comissao_percentual: aindaNoPeriodo ? 30 : 20,
  }).eq('id', parceiraId)
}

/**
 * Chamada quando uma fatura é paga (webhook invoice.paid). Só gera comissão
 * se quem pagou tiver `indicado_por` e quem indicou for `e_parceira`.
 * Idempotente por stripe_invoice_id (o índice único no banco é quem
 * garante isso de verdade em entregas concorrentes do webhook).
 */
export async function criarComissaoSeAplicavel(
  admin: Admin,
  { indicadaId, invoiceId, valorAssinatura }: { indicadaId: string; invoiceId: string; valorAssinatura: number }
): Promise<void> {
  const { data: indicada } = await admin
    .from('prestadoras')
    .select('id, indicado_por')
    .eq('id', indicadaId)
    .maybeSingle()

  if (!indicada?.indicado_por) return

  const { data: parceira } = await admin
    .from('prestadoras')
    .select('id, e_parceira, parceira_comissao_percentual')
    .eq('id', indicada.indicado_por)
    .maybeSingle()

  if (!parceira?.e_parceira) return

  const { data: existente } = await admin
    .from('parceiras_comissoes')
    .select('id')
    .eq('stripe_invoice_id', invoiceId)
    .maybeSingle()
  if (existente) return

  const percentual = parceira.parceira_comissao_percentual ?? 20
  const valorComissao = round2((valorAssinatura * percentual) / 100)
  const disponivelEm = new Date(Date.now() + TRINTA_DIAS_MS)

  const { error } = await admin.from('parceiras_comissoes').insert({
    parceira_id: parceira.id,
    indicada_id: indicadaId,
    stripe_invoice_id: invoiceId,
    valor_assinatura: valorAssinatura,
    percentual,
    valor_comissao: valorComissao,
    status: 'pendente',
    disponivel_em: disponivelEm.toISOString(),
  })

  // Índice único de stripe_invoice_id pode rejeitar um insert concorrente
  // duplicado — nesse caso não é erro de verdade, só idempotência funcionando.
  if (error && error.code !== '23505') {
    console.error('[parceiras] erro ao criar comissão', invoiceId, error)
    return
  }
  if (error) return

  await atualizarComissaoParceira(admin, parceira.id)
}

/** Cancela a comissão pendente ligada a uma fatura (reembolso, void, ou assinatura da indicada cancelada). */
export async function cancelarComissaoPendente(admin: Admin, invoiceId: string | null | undefined): Promise<void> {
  if (!invoiceId) return
  await admin
    .from('parceiras_comissoes')
    .update({ status: 'cancelado' })
    .eq('stripe_invoice_id', invoiceId)
    .eq('status', 'pendente')
}

/** Libera (pendente → disponivel) comissões cujo prazo de espera já passou. Roda lazily sempre que o relatório é aberto. */
export async function liberarComissoesVencidas(admin: Admin, parceiraId?: string): Promise<void> {
  let query = admin
    .from('parceiras_comissoes')
    .update({ status: 'disponivel' })
    .eq('status', 'pendente')
    .lte('disponivel_em', new Date().toISOString())

  if (parceiraId) query = query.eq('parceira_id', parceiraId)
  await query
}

export interface ResumoParceira {
  disponivelParaSaque: number
  pendente: number
  totalGanhoHistorico: number
  comissaoAtualPercentual: number
  periodoPremiumAte: string | null
  progressoPara30: number
  stats: {
    cadastradas: number
    pagantesAtivas: number
    canceladas: number
    taxaConversao: number
  }
  historico: ParceiraComissao[]
  historicoSaques: ParceiraSaque[]
  pixSalvo: string | null
}

/** Monta todo o resumo financeiro/estatísticas usado no relatório de parceira (self ou admin). */
export async function getResumoParceira(admin: Admin, parceiraId: string): Promise<ResumoParceira> {
  await liberarComissoesVencidas(admin, parceiraId)

  const [{ data: parceira }, { data: comissoes }, { data: saques }, { data: indicadas }, progressoPara30] = await Promise.all([
    admin
      .from('prestadoras')
      .select('parceira_comissao_percentual, parceira_periodo_30_inicio, parceira_pix')
      .eq('id', parceiraId)
      .maybeSingle(),
    admin
      .from('parceiras_comissoes')
      .select('*')
      .eq('parceira_id', parceiraId)
      .order('created_at', { ascending: false }),
    admin
      .from('parceiras_saques')
      .select('*')
      .eq('parceira_id', parceiraId)
      .order('solicitado_em', { ascending: false }),
    admin
      .from('prestadoras')
      .select('id, assinatura_ativa, e_trial')
      .eq('indicado_por', parceiraId),
    contarComissoesUltimos30Dias(admin, parceiraId),
  ])

  const todasComissoes = (comissoes ?? []) as ParceiraComissao[]
  const disponivelParaSaque = todasComissoes.filter((c) => c.status === 'disponivel').reduce((s, c) => s + c.valor_comissao, 0)
  const pendente = todasComissoes.filter((c) => c.status === 'pendente').reduce((s, c) => s + c.valor_comissao, 0)
  const totalGanhoHistorico = todasComissoes.filter((c) => c.status !== 'cancelado').reduce((s, c) => s + c.valor_comissao, 0)

  const comissaoAtualPercentual = parceira?.parceira_comissao_percentual ?? 20
  let periodoPremiumAte: string | null = null
  if (comissaoAtualPercentual === 30 && parceira?.parceira_periodo_30_inicio) {
    periodoPremiumAte = new Date(new Date(parceira.parceira_periodo_30_inicio).getTime() + TRINTA_DIAS_MS).toISOString()
  }

  const todasIndicadas = indicadas ?? []
  const cadastradas = todasIndicadas.length
  const pagantesAtivas = todasIndicadas.filter((p) => p.assinatura_ativa && !p.e_trial).length
  const canceladas = todasIndicadas.filter((p) => !p.assinatura_ativa).length
  const taxaConversao = cadastradas > 0 ? Math.round((pagantesAtivas / cadastradas) * 100) : 0

  return {
    disponivelParaSaque: round2(disponivelParaSaque),
    pendente: round2(pendente),
    totalGanhoHistorico: round2(totalGanhoHistorico),
    comissaoAtualPercentual,
    periodoPremiumAte,
    progressoPara30: Math.min(progressoPara30, 10),
    stats: { cadastradas, pagantesAtivas, canceladas, taxaConversao },
    historico: todasComissoes,
    historicoSaques: (saques ?? []) as ParceiraSaque[],
    pixSalvo: parceira?.parceira_pix ?? null,
  }
}

export type SolicitarSaqueResultado = { ok: true } | { ok: false; error: string }

/** Valida e processa um pedido de saque — marca comissões disponíveis como "pago" (FIFO) até cobrir o valor sacado. */
export async function solicitarSaque(
  admin: Admin,
  parceiraId: string,
  valor: number,
  pixChave: string,
  whatsappTelefone: string | null
): Promise<SolicitarSaqueResultado> {
  const { data: parceira } = await admin.from('prestadoras').select('e_parceira').eq('id', parceiraId).maybeSingle()
  if (!parceira?.e_parceira) return { ok: false, error: 'Você não é parceira.' }

  if (!Number.isFinite(valor) || valor < VALOR_MINIMO_SAQUE) {
    return { ok: false, error: `O valor mínimo para saque é R$${VALOR_MINIMO_SAQUE}.` }
  }

  const { data: ultimoSaque } = await admin
    .from('parceiras_saques')
    .select('solicitado_em')
    .eq('parceira_id', parceiraId)
    .order('solicitado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ultimoSaque && Date.now() - new Date(ultimoSaque.solicitado_em).getTime() < SETE_DIAS_MS) {
    return { ok: false, error: 'Você só pode solicitar um novo saque 7 dias após o último.' }
  }

  await liberarComissoesVencidas(admin, parceiraId)

  const { data: disponiveis } = await admin
    .from('parceiras_comissoes')
    .select('id, valor_comissao')
    .eq('parceira_id', parceiraId)
    .eq('status', 'disponivel')
    .order('created_at', { ascending: true })

  const lista = disponiveis ?? []
  const total = lista.reduce((s, c) => s + c.valor_comissao, 0)
  if (total < valor) {
    return { ok: false, error: 'Saldo disponível insuficiente para esse valor.' }
  }

  const idsUsados: string[] = []
  let acumulado = 0
  for (const c of lista) {
    if (acumulado >= valor) break
    idsUsados.push(c.id)
    acumulado += c.valor_comissao
  }

  const { error: erroInsert } = await admin.from('parceiras_saques').insert({
    parceira_id: parceiraId,
    valor,
    pix_chave: pixChave,
    whatsapp_telefone: whatsappTelefone,
  })
  if (erroInsert) {
    console.error('[parceiras] erro ao criar saque', parceiraId, erroInsert)
    return { ok: false, error: 'Erro ao solicitar saque. Tente novamente.' }
  }

  if (idsUsados.length) {
    await admin.from('parceiras_comissoes').update({ status: 'pago' }).in('id', idsUsados)
  }

  await admin.from('prestadoras').update({ parceira_pix: pixChave }).eq('id', parceiraId)

  return { ok: true }
}
