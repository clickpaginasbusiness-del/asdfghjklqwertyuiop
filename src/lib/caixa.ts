import type { SupabaseClient } from '@supabase/supabase-js'
import type { CaixaPrestadora, CaixaSaque } from '@/lib/types'
import { calcularValorLiquido, TAXA_PLATAFORMA_PERCENTUAL } from '@/lib/sinal'

/**
 * Caixa da prestadora: sinal/pagamento de serviço recebido pelo app,
 * liberado 7 dias após o pagamento (ver /api/mp/webhook e
 * /api/cron/mp-renovacoes). Mesmo desenho de src/lib/parceiras.ts
 * (pendente → disponivel → sacado), mas separado porque é um saldo
 * diferente — pagamento de agendamento, não comissão de indicação.
 */

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000
const VALOR_MINIMO_SAQUE = 20

type Admin = SupabaseClient

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Cria a entrada no caixa quando o webhook confirma o pagamento de um
 * agendamento (sinal ou valor total do serviço). */
export async function criarEntradaCaixa(
  admin: Admin,
  {
    prestadoraId, agendamentoId, tipo, valorBruto, paymentId,
  }: {
    prestadoraId: string
    agendamentoId: string
    tipo: 'sinal' | 'pagamento_servico'
    valorBruto: number
    paymentId: string
  }
): Promise<void> {
  const valorLiquido = calcularValorLiquido(valorBruto)
  const disponivelEm = new Date(Date.now() + SETE_DIAS_MS).toISOString()

  const { error } = await admin.from('caixa_prestadora').insert({
    prestadora_id: prestadoraId,
    tipo,
    valor: valorLiquido,
    valor_bruto: round2(valorBruto),
    taxa_percentual: TAXA_PLATAFORMA_PERCENTUAL,
    status: 'pendente',
    agendamento_id: agendamentoId,
    mp_payment_id: paymentId,
    disponivel_em: disponivelEm,
  })

  if (error) {
    console.error('[caixa] erro ao criar entrada no caixa', prestadoraId, agendamentoId, error)
  }
}

/** Reembolso/cancelamento de um pagamento já lançado no caixa — marca a
 * entrada como reembolsada em vez de deixá-la pendente/disponível pra saque. */
export async function reembolsarEntradaCaixa(admin: Admin, paymentId: string | null | undefined): Promise<void> {
  if (!paymentId) return
  await admin
    .from('caixa_prestadora')
    .update({ status: 'reembolsado' })
    .eq('mp_payment_id', paymentId)
    .in('status', ['pendente', 'disponivel'])
}

/** Libera (pendente → disponivel) entradas do caixa cujo prazo de espera já
 * passou. Chamado pelo cron diário (ver /api/cron/mp-renovacoes) e
 * lazily sempre que a aba Caixa é aberta. */
export async function liberarCaixaVencido(admin: Admin, prestadoraId?: string): Promise<void> {
  let query = admin
    .from('caixa_prestadora')
    .update({ status: 'disponivel' })
    .eq('status', 'pendente')
    .lte('disponivel_em', new Date().toISOString())

  if (prestadoraId) query = query.eq('prestadora_id', prestadoraId)
  await query
}

/** Uma entrada do caixa pra exibição — nunca inclui nome de cliente, só o
 * nome do serviço (via join com agendamentos), de propósito. */
export type CaixaTransacao = CaixaPrestadora & { servicoNome: string | null }

export interface ResumoCaixa {
  disponivelParaSaque: number
  pendente: number
  totalRecebidoHistorico: number
  historico: CaixaTransacao[]
  historicoSaques: CaixaSaque[]
}

/** Monta o resumo financeiro/histórico usado em /painel/caixa. Nunca busca
 * dados de clientes — a aba Caixa não mostra nome de cliente nenhum. */
export async function getResumoCaixa(admin: Admin, prestadoraId: string): Promise<ResumoCaixa> {
  await liberarCaixaVencido(admin, prestadoraId)

  const [{ data: entradas }, { data: saques }] = await Promise.all([
    admin
      .from('caixa_prestadora')
      .select('*, agendamentos(servicos(nome))')
      .eq('prestadora_id', prestadoraId)
      .order('created_at', { ascending: false }),
    admin
      .from('caixa_saques')
      .select('*')
      .eq('prestadora_id', prestadoraId)
      .order('solicitado_em', { ascending: false }),
  ])

  const brutas = (entradas ?? []) as unknown as (CaixaPrestadora & { agendamentos: { servicos: { nome: string } | null } | null })[]
  const todasEntradas: CaixaTransacao[] = brutas.map(({ agendamentos, ...resto }) => ({
    ...resto,
    servicoNome: agendamentos?.servicos?.nome ?? null,
  }))

  const disponivelParaSaque = todasEntradas.filter((c) => c.status === 'disponivel').reduce((s, c) => s + c.valor, 0)
  const pendente = todasEntradas.filter((c) => c.status === 'pendente').reduce((s, c) => s + c.valor, 0)
  const totalRecebidoHistorico = todasEntradas.filter((c) => c.status !== 'reembolsado').reduce((s, c) => s + c.valor, 0)

  return {
    disponivelParaSaque: round2(disponivelParaSaque),
    pendente: round2(pendente),
    totalRecebidoHistorico: round2(totalRecebidoHistorico),
    historico: todasEntradas,
    historicoSaques: (saques ?? []) as CaixaSaque[],
  }
}

export type SolicitarSaqueCaixaResultado = { ok: true } | { ok: false; error: string }

/** Valida e processa um pedido de saque do caixa — marca entradas
 * disponíveis como "sacado" (FIFO) até cobrir o valor sacado. Mínimo R$20,
 * no máximo 1 solicitação por semana. */
export async function solicitarSaqueCaixa(
  admin: Admin,
  prestadoraId: string,
  valor: number,
  pixChave: string
): Promise<SolicitarSaqueCaixaResultado> {
  if (!Number.isFinite(valor) || valor < VALOR_MINIMO_SAQUE) {
    return { ok: false, error: `O valor mínimo para saque é R$${VALOR_MINIMO_SAQUE}.` }
  }

  const { data: ultimoSaque } = await admin
    .from('caixa_saques')
    .select('solicitado_em')
    .eq('prestadora_id', prestadoraId)
    .order('solicitado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ultimoSaque && Date.now() - new Date(ultimoSaque.solicitado_em).getTime() < SETE_DIAS_MS) {
    return { ok: false, error: 'Você só pode solicitar um novo saque 7 dias após o último.' }
  }

  await liberarCaixaVencido(admin, prestadoraId)

  const { data: disponiveis } = await admin
    .from('caixa_prestadora')
    .select('id, valor')
    .eq('prestadora_id', prestadoraId)
    .eq('status', 'disponivel')
    .order('created_at', { ascending: true })

  const lista = disponiveis ?? []
  const total = lista.reduce((s, c) => s + c.valor, 0)
  if (total < valor) {
    return { ok: false, error: 'Saldo disponível insuficiente para esse valor.' }
  }

  const idsUsados: string[] = []
  let acumulado = 0
  for (const c of lista) {
    if (acumulado >= valor) break
    idsUsados.push(c.id)
    acumulado += c.valor
  }

  const { error: erroInsert } = await admin.from('caixa_saques').insert({
    prestadora_id: prestadoraId,
    valor,
    pix_chave: pixChave,
  })
  if (erroInsert) {
    console.error('[caixa] erro ao criar saque', prestadoraId, erroInsert)
    return { ok: false, error: 'Erro ao solicitar saque. Tente novamente.' }
  }

  if (idsUsados.length) {
    await admin.from('caixa_prestadora').update({ status: 'sacado' }).in('id', idsUsados)
  }

  return { ok: true }
}
