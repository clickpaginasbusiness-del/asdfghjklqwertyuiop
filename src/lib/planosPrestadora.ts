import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularValorLiquido } from '@/lib/sinal'
import type { PlanoPrestadora, PlanoAssinatura } from '@/lib/types'

type Admin = SupabaseClient

const MS_DIA = 24 * 60 * 60 * 1000

/** Meses por ciclo — usado tanto pra calcular periodo_fim quanto pra criar o
 * preapproval_plan no Mercado Pago (frequency_type: 'months'). */
export const MESES_POR_INTERVALO: Record<PlanoPrestadora['intervalo'], number> = {
  mensal: 1,
  bimensal: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
}

export const NOME_INTERVALO: Record<PlanoPrestadora['intervalo'], string> = {
  mensal: 'mês',
  bimensal: '2 meses',
  trimestral: '3 meses',
  semestral: '6 meses',
  anual: 'ano',
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Clientes não têm email cadastrado no sistema (só telefone — ver tipo
 * Cliente), mas o preapproval do MP exige um payer_email pra identificar a
 * assinatura no checkout hospedado. Sintetiza um email só-MP que já
 * codifica plano+cliente, porque a criação do preapproval acontece do lado
 * do MP (fluxo de checkout hospedado via init_point, mesmo padrão da
 * assinatura da prestadora — ver getOrCreatePlanoMensal/mp/checkout), não
 * via chamada direta preApproval.create() daqui — então não dá pra confiar
 * em external_reference for correlacionar de volta no webhook (isso só é
 * garantido em Preference, usado no caminho Pix). O payer_email é o único
 * campo que comprovadamente volta intacto no preapproval autorizado.
 */
export function payerEmailPlanoCliente(planoId: string, clienteId: string): string {
  return `plano-${planoId}-cliente-${clienteId}@clientes.bellebook.invalid`
}

export function parsePayerEmailPlanoCliente(email: string | null | undefined): { planoId: string; clienteId: string } | null {
  if (!email) return null
  const match = email.match(/^plano-([0-9a-f-]+)-cliente-([0-9a-f-]+)@clientes\.bellebook\.invalid$/i)
  if (!match) return null
  return { planoId: match[1], clienteId: match[2] }
}

export function calcularPeriodoFim(intervalo: PlanoPrestadora['intervalo'], base: Date = new Date()): Date {
  const fim = new Date(base)
  fim.setMonth(fim.getMonth() + MESES_POR_INTERVALO[intervalo])
  return fim
}

/**
 * Assinatura ativa da cliente que cobre o serviço informado (o plano precisa
 * ter esse serviço em planos_servicos) e ainda tem crédito sobrando. `null`
 * se não houver nenhuma — quem chama trata como "sem plano aplicável".
 */
export async function buscarAssinaturaComCredito(
  admin: Admin,
  { clienteId, prestadoraId, servicoId }: { clienteId: string; prestadoraId: string; servicoId: string }
): Promise<(PlanoAssinatura & { plano: PlanoPrestadora }) | null> {
  const { data: assinaturas } = await admin
    .from('planos_assinaturas')
    .select('*, plano:planos_prestadora(*)')
    .eq('cliente_id', clienteId)
    .eq('prestadora_id', prestadoraId)
    .eq('status', 'ativa')
    .gt('creditos_restantes', 0)

  if (!assinaturas || assinaturas.length === 0) return null

  for (const a of assinaturas as unknown as (PlanoAssinatura & { plano: PlanoPrestadora })[]) {
    const { data: incluiServico } = await admin
      .from('planos_servicos')
      .select('id')
      .eq('plano_id', a.plano_id)
      .eq('servico_id', servicoId)
      .maybeSingle()
    if (incluiServico) return a
  }
  return null
}

/** Consome 1 crédito da assinatura pro agendamento que acabou de ser criado. */
export async function aplicarUsoCredito(
  admin: Admin,
  { assinaturaId, agendamentoId, creditosRestantes }: { assinaturaId: string; agendamentoId: string; creditosRestantes: number }
): Promise<void> {
  await admin
    .from('planos_assinaturas')
    .update({ creditos_restantes: Math.max(0, creditosRestantes - 1) })
    .eq('id', assinaturaId)

  await admin.from('planos_usos').insert({
    assinatura_id: assinaturaId,
    agendamento_id: agendamentoId,
    tipo: 'automatico',
  })
}

/** Desconto manual de 1 crédito pela prestadora (ex.: atendimento combinado
 * fora do app) — mesmo efeito de um uso automático, mas sem agendamento
 * vinculado e com descrição livre. */
export async function descontarUsoManual(
  admin: Admin,
  { assinaturaId, descricao }: { assinaturaId: string; descricao: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: assinatura } = await admin
    .from('planos_assinaturas')
    .select('creditos_restantes')
    .eq('id', assinaturaId)
    .maybeSingle()

  if (!assinatura) return { ok: false, error: 'Assinatura não encontrada' }
  if (assinatura.creditos_restantes <= 0) return { ok: false, error: 'Assinatura sem créditos restantes' }

  await admin
    .from('planos_assinaturas')
    .update({ creditos_restantes: assinatura.creditos_restantes - 1 })
    .eq('id', assinaturaId)

  await admin.from('planos_usos').insert({
    assinatura_id: assinaturaId,
    tipo: 'manual',
    descricao,
  })

  return { ok: true }
}

/** Soma das quantidades dos serviços de um plano — vira creditos_totais de
 * uma assinatura nova (ver criarOuRenovarAssinatura). Plano sem nenhum
 * serviço vinculado (genérico) usa 1 crédito por padrão. */
async function somarQuantidadesDoPlano(admin: Admin, planoId: string): Promise<number> {
  const { data } = await admin.from('planos_servicos').select('quantidade').eq('plano_id', planoId)
  if (!data || data.length === 0) return 1
  return data.reduce((soma, s) => soma + s.quantidade, 0)
}

/**
 * Cria (primeira cobrança aprovada) ou renova (cobranças seguintes) a
 * assinatura da cliente — chamado pelo webhook do MP quando um pagamento de
 * plano de cliente é aprovado. Idempotente o bastante pro caso de reentrega
 * do webhook: uma renovação só readiciona/reseta os créditos se a cobrança
 * for de fato nova (controlado por quem chama via mp_eventos_processados,
 * mesmo mecanismo do restante do webhook).
 */
export async function criarOuRenovarAssinatura(
  admin: Admin,
  {
    planoId, clienteId, prestadoraId, mpSubscriptionId, metodo,
  }: {
    planoId: string
    clienteId: string
    prestadoraId: string
    mpSubscriptionId: string | null
    metodo: 'cartao' | 'pix'
  }
): Promise<PlanoAssinatura> {
  const { data: plano } = await admin.from('planos_prestadora').select('*').eq('id', planoId).single()
  if (!plano) throw new Error(`Plano ${planoId} não encontrado`)

  const quantidadeCreditos = await somarQuantidadesDoPlano(admin, planoId)
  const periodoFim = calcularPeriodoFim(plano.intervalo).toISOString()

  const { data: existente } = await admin
    .from('planos_assinaturas')
    .select('*')
    .eq('plano_id', planoId)
    .eq('cliente_id', clienteId)
    .maybeSingle()

  const creditosRestantes = existente && plano.creditos_acumulam
    ? existente.creditos_restantes + quantidadeCreditos
    : quantidadeCreditos

  const patch = {
    plano_id: planoId,
    cliente_id: clienteId,
    prestadora_id: prestadoraId,
    status: 'ativa' as const,
    mp_subscription_id: mpSubscriptionId,
    mp_metodo: metodo,
    creditos_restantes: creditosRestantes,
    creditos_totais: quantidadeCreditos,
    periodo_inicio: new Date().toISOString(),
    periodo_fim: periodoFim,
    cancelado_em: null,
  }

  const { data: assinatura, error } = existente
    ? await admin.from('planos_assinaturas').update(patch).eq('id', existente.id).select().single()
    : await admin.from('planos_assinaturas').insert(patch).select().single()

  if (error || !assinatura) throw new Error(`Erro ao criar/renovar assinatura: ${error?.message}`)
  return assinatura as PlanoAssinatura
}

/** Lança a receita líquida da cobrança de um plano no caixa da prestadora —
 * mesmo mecanismo de sinal/pagamento de agendamento (ver src/lib/caixa.ts),
 * só que sem agendamento_id (cobrança recorrente, não ligada a um
 * agendamento específico) e com o plano_assinatura_id pra rastrear no
 * relatório de planos. */
export async function creditarCaixaPlano(
  admin: Admin,
  { prestadoraId, assinaturaId, valorBruto, paymentId }: {
    prestadoraId: string
    assinaturaId: string
    valorBruto: number
    paymentId: string
  }
): Promise<void> {
  const valorLiquido = calcularValorLiquido(valorBruto)
  const SETE_DIAS_MS = 7 * MS_DIA
  const disponivelEm = new Date(Date.now() + SETE_DIAS_MS).toISOString()

  await admin.from('caixa_prestadora').insert({
    prestadora_id: prestadoraId,
    tipo: 'plano_assinatura',
    valor: valorLiquido,
    valor_bruto: round2(valorBruto),
    taxa_percentual: 7,
    status: 'pendente',
    agendamento_id: null,
    plano_assinatura_id: assinaturaId,
    mp_payment_id: paymentId,
    disponivel_em: disponivelEm,
  })
}

/** Notifica a prestadora quando uma cliente renova/assina um plano. */
export async function notificarRenovacaoPlano(
  admin: Admin,
  { prestadoraId, clienteNome, planoNome }: { prestadoraId: string; clienteNome: string; planoNome: string }
): Promise<void> {
  await admin.from('notificacoes').insert({
    prestadora_id: prestadoraId,
    tipo: 'pagamento',
    mensagem: `${clienteNome} renovou o Plano ${planoNome}!`,
  })
}

export interface ResumoPlano {
  plano: PlanoPrestadora
  assinantesAtivos: number
  receitaHistorica: number
  creditosUsadosEsseMes: number
}

export interface ResumoPlanos {
  totalAssinantesAtivos: number
  receitaMensalEstimada: number
  planosAtivos: number
  planos: ResumoPlano[]
}

/** Usado em /painel/relatorios (aba Planos). */
export async function getResumoPlanos(admin: Admin, prestadoraId: string): Promise<ResumoPlanos> {
  const { data: planos } = await admin
    .from('planos_prestadora')
    .select('*')
    .eq('prestadora_id', prestadoraId)
    .order('created_at', { ascending: false })

  const listaPlanos = (planos ?? []) as PlanoPrestadora[]
  if (listaPlanos.length === 0) {
    return { totalAssinantesAtivos: 0, receitaMensalEstimada: 0, planosAtivos: 0, planos: [] }
  }

  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const resumos: ResumoPlano[] = []
  let totalAssinantesAtivos = 0
  let receitaMensalEstimada = 0

  for (const plano of listaPlanos) {
    const { count: assinantesAtivos } = await admin
      .from('planos_assinaturas')
      .select('id', { count: 'exact', head: true })
      .eq('plano_id', plano.id)
      .eq('status', 'ativa')

    const { data: assinaturasDoPlano } = await admin
      .from('planos_assinaturas')
      .select('id')
      .eq('plano_id', plano.id)

    const idsAssinaturas = (assinaturasDoPlano ?? []).map((a) => a.id)

    let receitaHistorica = 0
    let creditosUsadosEsseMes = 0

    if (idsAssinaturas.length > 0) {
      const { data: entradasCaixa } = await admin
        .from('caixa_prestadora')
        .select('valor')
        .in('plano_assinatura_id', idsAssinaturas)
        .neq('status', 'reembolsado')
      receitaHistorica = (entradasCaixa ?? []).reduce((s, e) => s + e.valor, 0)

      const { count } = await admin
        .from('planos_usos')
        .select('id', { count: 'exact', head: true })
        .in('assinatura_id', idsAssinaturas)
        .gte('created_at', inicioMes.toISOString())
      creditosUsadosEsseMes = count ?? 0
    }

    const ativos = assinantesAtivos ?? 0
    totalAssinantesAtivos += ativos
    if (plano.ativo) receitaMensalEstimada += (ativos * plano.preco) / MESES_POR_INTERVALO[plano.intervalo]

    resumos.push({ plano, assinantesAtivos: ativos, receitaHistorica: round2(receitaHistorica), creditosUsadosEsseMes })
  }

  return {
    totalAssinantesAtivos,
    receitaMensalEstimada: round2(receitaMensalEstimada),
    planosAtivos: listaPlanos.filter((p) => p.ativo).length,
    planos: resumos,
  }
}
