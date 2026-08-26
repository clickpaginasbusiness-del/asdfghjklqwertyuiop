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

/** Lê a linha de crédito por (assinatura, serviço) — `null` quando o plano é
 * genérico (sem planos_servicos vinculado) ou, em tese, quando o backfill
 * ainda não rodou pra essa assinatura; nos dois casos quem chama cai pro
 * agregado antigo. */
async function buscarCreditoServico(
  admin: Admin, assinaturaId: string, servicoId: string
): Promise<{ quantidade: number; creditos_restantes: number } | null> {
  const { data } = await admin
    .from('planos_assinaturas_servicos')
    .select('quantidade, creditos_restantes')
    .eq('assinatura_id', assinaturaId)
    .eq('servico_id', servicoId)
    .maybeSingle()
  return data ?? null
}

/** Checa se uma assinatura já existente ainda tem crédito disponível pro
 * serviço informado — usado antes de conceder desconto de plano num
 * pagamento (nunca confia num valor lido antes; reconfere aqui mesmo, igual
 * ao padrão de aplicarUsoCredito/buscarAssinaturaComCredito). Planos com
 * planos_servicos configurado usam a linha por serviço; planos genéricos
 * (sem nenhum serviço vinculado) continuam no agregado da assinatura. */
export async function temCreditoDisponivel(
  admin: Admin, { assinaturaId, servicoId }: { assinaturaId: string; servicoId: string }
): Promise<boolean> {
  const creditoServico = await buscarCreditoServico(admin, assinaturaId, servicoId)
  if (creditoServico) return creditoServico.creditos_restantes > 0

  const { data: assinatura } = await admin
    .from('planos_assinaturas')
    .select('creditos_restantes')
    .eq('id', assinaturaId)
    .maybeSingle()
  return !!assinatura && assinatura.creditos_restantes > 0
}

/**
 * Assinatura ativa da cliente que cobre o serviço informado (o plano precisa
 * ter esse serviço em planos_servicos) e ainda tem crédito sobrando. `null`
 * se não houver nenhuma — quem chama trata como "sem plano aplicável".
 *
 * Planos com planos_servicos configurado (ex.: "3 manutenções + 1
 * alongamento") usam o crédito POR SERVIÇO como fonte de verdade — um
 * serviço nunca usado continua elegível mesmo que outro serviço do mesmo
 * plano já tenha esgotado seu próprio saldo. Planos genéricos (sem nenhum
 * planos_servicos, ex. "5 créditos pra qualquer coisa") continuam 100% no
 * agregado da assinatura, sem granularidade nenhuma — não force isso.
 */
export async function buscarAssinaturaComCredito(
  admin: Admin,
  { clienteId, prestadoraId, servicoId }: { clienteId: string; prestadoraId: string; servicoId: string }
): Promise<(PlanoAssinatura & { plano: PlanoPrestadora; creditoDisponivel: number }) | null> {
  const { data: assinaturas } = await admin
    .from('planos_assinaturas')
    .select('*, plano:planos_prestadora(*)')
    .eq('cliente_id', clienteId)
    .eq('prestadora_id', prestadoraId)
    .eq('status', 'ativa')

  if (!assinaturas || assinaturas.length === 0) return null

  for (const a of assinaturas as unknown as (PlanoAssinatura & { plano: PlanoPrestadora })[]) {
    const { data: planoServicos } = await admin
      .from('planos_servicos')
      .select('servico_id')
      .eq('plano_id', a.plano_id)

    const servicosDoPlano = planoServicos ?? []
    const planoGenerico = servicosDoPlano.length === 0
    const incluiServico = servicosDoPlano.some((ps) => ps.servico_id === servicoId)

    if (planoGenerico) {
      if (a.creditos_restantes > 0) return { ...a, creditoDisponivel: a.creditos_restantes }
      continue
    }

    if (!incluiServico) continue

    const creditoServico = await buscarCreditoServico(admin, a.id, servicoId)
    if (creditoServico && creditoServico.creditos_restantes > 0) {
      return { ...a, creditoDisponivel: creditoServico.creditos_restantes }
    }
  }
  return null
}

/** Consome 1 crédito da assinatura pro agendamento que acabou de ser criado.
 * Trava otimista: o UPDATE só grava se `creditos_restantes` ainda for
 * exatamente o valor lido aqui dentro (nunca um valor passado por quem
 * chama — reconfere sempre, pra não confiar num saldo que pode ter mudado
 * entre a hora em que o caller leu e a hora em que consome de fato) — se
 * outra requisição já consumiu um crédito nesse meio-tempo (duas reservas
 * quase simultâneas, por exemplo), a atualização não encontra a linha e
 * retorna `false` sem inserir o uso. Sem essa trava, "ler, calcular -1 em
 * JS, escrever" perde decrementos quando duas chamadas leem o mesmo valor
 * antes de qualquer uma escrever — o log de planos_usos fica certo, mas o
 * saldo fica maior do que deveria.
 *
 * Planos com planos_servicos configurado consomem a linha de
 * planos_assinaturas_servicos do serviço específico; planos genéricos (sem
 * nenhum serviço vinculado) continuam consumindo o agregado da assinatura,
 * exatamente como antes. */
export async function aplicarUsoCredito(
  admin: Admin,
  { assinaturaId, agendamentoId, servicoId }: {
    assinaturaId: string
    agendamentoId: string
    servicoId: string
  }
): Promise<boolean> {
  const creditoServico = await buscarCreditoServico(admin, assinaturaId, servicoId)

  if (creditoServico) {
    if (creditoServico.creditos_restantes <= 0) return false
    const { data } = await admin
      .from('planos_assinaturas_servicos')
      .update({ creditos_restantes: creditoServico.creditos_restantes - 1 })
      .eq('assinatura_id', assinaturaId)
      .eq('servico_id', servicoId)
      .eq('creditos_restantes', creditoServico.creditos_restantes)
      .select('id')
      .maybeSingle()
    if (!data) return false
  } else {
    const { data: assinatura } = await admin
      .from('planos_assinaturas')
      .select('creditos_restantes')
      .eq('id', assinaturaId)
      .maybeSingle()
    if (!assinatura || assinatura.creditos_restantes <= 0) return false

    const { data } = await admin
      .from('planos_assinaturas')
      .update({ creditos_restantes: Math.max(0, assinatura.creditos_restantes - 1) })
      .eq('id', assinaturaId)
      .eq('creditos_restantes', assinatura.creditos_restantes)
      .select('id')
      .maybeSingle()
    if (!data) return false
  }

  await admin.from('planos_usos').insert({
    assinatura_id: assinaturaId,
    agendamento_id: agendamentoId,
    servico_id: servicoId,
    tipo: 'automatico',
  })
  return true
}

/** Edita o número de créditos restantes de um serviço diretamente (tela de
 * gestão de créditos da prestadora) — em vez de só "descontar 1 uso", ela
 * digita o valor final. Sempre limitado a `[0, quota]` (não deixa criar
 * crédito além do que o plano promete). Mesma trava otimista de
 * `aplicarUsoCredito`, com o mesmo caminho duplo (linha por serviço vs.
 * agregado do plano genérico — `servicoId: null` indica plano genérico).
 * Grava sempre um registro em `planos_usos` (`tipo: 'ajuste'`) com o delta
 * no texto, pra manter rastro de auditoria mesmo numa edição direta —
 * `descricao` do chamador é opcional e só complementa esse texto. */
export async function ajustarCreditoServico(
  admin: Admin,
  { assinaturaId, servicoId, novoValor, descricao }: {
    assinaturaId: string
    servicoId: string | null
    novoValor: number
    descricao?: string
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (servicoId) {
    const creditoServico = await buscarCreditoServico(admin, assinaturaId, servicoId)
    if (!creditoServico) return { ok: false, error: 'Serviço não encontrado nessa assinatura' }

    const valorFinal = Math.max(0, Math.min(novoValor, creditoServico.quantidade))
    const { data } = await admin
      .from('planos_assinaturas_servicos')
      .update({ creditos_restantes: valorFinal })
      .eq('assinatura_id', assinaturaId)
      .eq('servico_id', servicoId)
      .eq('creditos_restantes', creditoServico.creditos_restantes)
      .select('id')
      .maybeSingle()
    if (!data) return { ok: false, error: 'O saldo mudou nesse meio-tempo — tente novamente' }

    await admin.from('planos_usos').insert({
      assinatura_id: assinaturaId,
      servico_id: servicoId,
      tipo: 'ajuste',
      descricao: `Ajuste manual: ${creditoServico.creditos_restantes} → ${valorFinal} restantes.${descricao ? ` ${descricao}` : ''}`,
    })
    return { ok: true }
  }

  const { data: assinatura } = await admin
    .from('planos_assinaturas')
    .select('creditos_restantes, creditos_totais')
    .eq('id', assinaturaId)
    .maybeSingle()
  if (!assinatura) return { ok: false, error: 'Assinatura não encontrada' }

  const valorFinal = Math.max(0, Math.min(novoValor, assinatura.creditos_totais))
  const { data } = await admin
    .from('planos_assinaturas')
    .update({ creditos_restantes: valorFinal })
    .eq('id', assinaturaId)
    .eq('creditos_restantes', assinatura.creditos_restantes)
    .select('id')
    .maybeSingle()
  if (!data) return { ok: false, error: 'O saldo mudou nesse meio-tempo — tente novamente' }

  await admin.from('planos_usos').insert({
    assinatura_id: assinaturaId,
    servico_id: null,
    tipo: 'ajuste',
    descricao: `Ajuste manual: ${assinatura.creditos_restantes} → ${valorFinal} restantes.${descricao ? ` ${descricao}` : ''}`,
  })
  return { ok: true }
}

export interface CreditoServico {
  servicoId: string
  servicoNome: string
  quantidadeTotal: number
  usados: number
  restantes: number
}

/** Detalhamento de crédito por serviço de uma assinatura — lê direto de
 * planos_assinaturas_servicos, a mesma tabela que aplicarUsoCredito e
 * ajustarCreditoServico decrementam, então nunca diverge do que é de fato
 * gasto (antes disso era recalculado contando planos_usos a cada leitura;
 * agora é uma leitura simples). Assinatura de plano genérico (sem
 * planos_servicos) não tem linha nenhuma aqui, retorna lista vazia — quem
 * chama já trata isso caindo pro agregado da assinatura. Usado tanto no
 * relatório da prestadora quanto em "meus créditos" da cliente. */
export async function getCreditosPorServico(admin: Admin, assinaturaId: string): Promise<CreditoServico[]> {
  const { data } = await admin
    .from('planos_assinaturas_servicos')
    .select('servico_id, quantidade, creditos_restantes, servicos(nome)')
    .eq('assinatura_id', assinaturaId)

  const linhas = (data ?? []) as unknown as { servico_id: string; quantidade: number; creditos_restantes: number; servicos: { nome: string } | null }[]

  return linhas
    .filter((l) => l.servicos)
    .map((l) => ({
      servicoId: l.servico_id,
      servicoNome: l.servicos!.nome,
      quantidadeTotal: l.quantidade,
      usados: l.quantidade - l.creditos_restantes,
      restantes: l.creditos_restantes,
    }))
}

export interface UsoHistorico {
  id: string
  servicoId: string | null
  servicoNome: string | null
  tipo: 'automatico' | 'manual' | 'ajuste'
  descricao: string | null
  createdAt: string
}

/** Histórico completo (todos os ciclos, não só o atual) de uso de créditos
 * de uma assinatura, mais recente primeiro — usado na tela de gestão de
 * créditos da prestadora pra ela auditar o que aconteceu, não só ver o
 * número final. Buscado sob demanda (só quando ela abre o detalhe de uma
 * assinatura específica), não junto com a lista de assinantes. */
export async function getHistoricoUsos(admin: Admin, assinaturaId: string): Promise<UsoHistorico[]> {
  const { data } = await admin
    .from('planos_usos')
    .select('id, servico_id, tipo, descricao, created_at, servicos(nome)')
    .eq('assinatura_id', assinaturaId)
    .order('created_at', { ascending: false })

  const linhas = (data ?? []) as unknown as {
    id: string; servico_id: string | null; tipo: 'automatico' | 'manual' | 'ajuste'; descricao: string | null
    created_at: string; servicos: { nome: string } | null
  }[]

  return linhas.map((u) => ({
    id: u.id,
    servicoId: u.servico_id,
    servicoNome: u.servicos?.nome ?? null,
    tipo: u.tipo,
    descricao: u.descricao,
    createdAt: u.created_at,
  }))
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

  const { data: planoServicosData } = await admin.from('planos_servicos').select('servico_id, quantidade').eq('plano_id', planoId)
  const servicosDoPlano = planoServicosData ?? []
  // Plano sem nenhum serviço vinculado (genérico) usa 1 crédito por padrão,
  // igual sempre foi — só não ganha linha nenhuma em
  // planos_assinaturas_servicos, continua puramente no agregado abaixo.
  const quantidadeCreditos = servicosDoPlano.length > 0
    ? servicosDoPlano.reduce((soma, s) => soma + s.quantidade, 0)
    : 1

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

  // Espelha o mesmo cálculo (soma se acumula, reseta se não) por serviço —
  // plano genérico não entra aqui, não ganha linha nenhuma.
  for (const ps of servicosDoPlano) {
    const { data: linhaExistente } = await admin
      .from('planos_assinaturas_servicos')
      .select('creditos_restantes')
      .eq('assinatura_id', assinatura.id)
      .eq('servico_id', ps.servico_id)
      .maybeSingle()

    const restantes = linhaExistente && plano.creditos_acumulam
      ? linhaExistente.creditos_restantes + ps.quantidade
      : ps.quantidade

    await admin.from('planos_assinaturas_servicos').upsert(
      { assinatura_id: assinatura.id, servico_id: ps.servico_id, quantidade: ps.quantidade, creditos_restantes: restantes },
      { onConflict: 'assinatura_id,servico_id' }
    )
  }

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
