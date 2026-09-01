import type { SupabaseClient } from '@supabase/supabase-js'
import { formatDateKey, dateKeyToDate, limitesDoMesSP, mesAnteriorSP } from '@/lib/utils'

/** Chave única pra ligar/desligar a feature inteira (acesso no painel + geração
 * automática mensal via cron) sem apagar nenhuma retrospectiva já gerada.
 * Reative voltando isso pra `true`. */
export const RETROSPECTIVAS_ATIVAS = false

export interface DadosRetrospectiva {
  tem_dados: boolean
  total_agendamentos: number
  servico_mais_pedido: string | null
  dia_semana_mais_movimentado: number | null // 0=domingo .. 6=sábado
  cliente_mais_agendou: string | null
  total_mes_anterior: number | null
  variacao_percentual: number | null
  profissional_destaque: string | null
}

export interface Retrospectiva {
  id: string
  prestadora_id: string
  mes: number
  ano: number
  dados: DadosRetrospectiva
  created_at: string
}

export const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const DIAS_SEMANA_PLURAL = [
  'Domingos', 'Segundas-feiras', 'Terças-feiras', 'Quartas-feiras',
  'Quintas-feiras', 'Sextas-feiras', 'Sábados',
]

type Admin = SupabaseClient

const AGENDAMENTO_SELECT_CONTABIL = 'id, data_hora, cliente_id, profissional_id, servicos(nome), clientes(nome)'

type AgendamentoContabil = {
  id: string
  data_hora: string
  cliente_id: string
  profissional_id: string | null
  servicos: { nome: string } | null
  clientes: { nome: string } | null
}

/** Chave com mais ocorrências num Map de contagens — usado pra achar o
 * serviço/dia/cliente/profissional "campeão" do mês. */
function maisFrequente<T>(contagens: Map<T, number>): T | null {
  let top: T | null = null
  let max = 0
  for (const [chave, count] of contagens) {
    if (count > max) { top = chave; max = count }
  }
  return top
}

/** Só o primeiro nome — nunca telefone nem nome completo (dado exposto num
 * card pensado pra ser compartilhado publicamente). */
function primeiroNome(nomeCompleto: string): string {
  const limpo = nomeCompleto.trim()
  if (!limpo) return 'Cliente'
  return limpo.split(/\s+/)[0]
}

async function contarConcluidosDoMes(admin: Admin, prestadoraId: string, mes: number, ano: number): Promise<number> {
  const { inicio, fim } = limitesDoMesSP(mes, ano)
  const { count } = await admin
    .from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('prestadora_id', prestadoraId)
    .eq('status', 'concluido')
    .eq('agendamento_manual', false)
    .eq('cliente_e_prestadora', false)
    .gte('data_hora', inicio.toISOString())
    .lt('data_hora', fim.toISOString())
  return count ?? 0
}

/**
 * Calcula os dados de uma retrospectiva mensal a partir do histórico real —
 * não grava nada, só lê. `salvarRetrospectivaDoMes` (abaixo) é quem persiste.
 */
export async function gerarDadosRetrospectiva(
  admin: Admin,
  prestadora: { id: string; created_at: string },
  mes: number,
  ano: number
): Promise<DadosRetrospectiva> {
  const { inicio, fim } = limitesDoMesSP(mes, ano)

  const { data } = await admin
    .from('agendamentos')
    .select(AGENDAMENTO_SELECT_CONTABIL)
    .eq('prestadora_id', prestadora.id)
    .eq('status', 'concluido')
    .eq('agendamento_manual', false)
    .eq('cliente_e_prestadora', false)
    .gte('data_hora', inicio.toISOString())
    .lt('data_hora', fim.toISOString())

  const lista = (data ?? []) as unknown as AgendamentoContabil[]

  const vazio: DadosRetrospectiva = {
    tem_dados: false,
    total_agendamentos: 0,
    servico_mais_pedido: null,
    dia_semana_mais_movimentado: null,
    cliente_mais_agendou: null,
    total_mes_anterior: null,
    variacao_percentual: null,
    profissional_destaque: null,
  }
  if (lista.length === 0) return vazio

  const total_agendamentos = lista.length

  // Serviço mais pedido
  const porServico = new Map<string, number>()
  for (const a of lista) {
    if (!a.servicos?.nome) continue
    porServico.set(a.servicos.nome, (porServico.get(a.servicos.nome) ?? 0) + 1)
  }
  const servico_mais_pedido = maisFrequente(porServico)

  // Dia da semana mais movimentado — calendário de São Paulo, não UTC do
  // servidor (mesma técnica de AgendaDoDiaSection.tsx: chave 'yyyy-MM-dd' em
  // SP, convertida de volta pra um instante estável só pra ler getUTCDay()).
  const porDia = new Map<number, number>()
  for (const a of lista) {
    const dia = dateKeyToDate(formatDateKey(a.data_hora)).getUTCDay()
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1)
  }
  const dia_semana_mais_movimentado = maisFrequente(porDia)

  // Cliente que mais agendou — só primeiro nome, nunca telefone/nome completo
  const porCliente = new Map<string, { nome: string; count: number }>()
  for (const a of lista) {
    const atual = porCliente.get(a.cliente_id)
    if (atual) atual.count += 1
    else porCliente.set(a.cliente_id, { nome: a.clientes?.nome ?? '', count: 1 })
  }
  let clienteTop: { nome: string; count: number } | null = null
  for (const c of porCliente.values()) {
    if (!clienteTop || c.count > clienteTop.count) clienteTop = c
  }
  const cliente_mais_agendou = clienteTop ? primeiroNome(clienteTop.nome) : null

  // Comparação com o mês anterior — só faz sentido se a prestadora já
  // existia antes do mês desta retrospectiva (senão não há "mês anterior"
  // de verdade pra ela, mesmo que a conta tenha sido criada no meio do mês).
  const criadaNesteMes = new Date(prestadora.created_at) >= inicio && new Date(prestadora.created_at) < fim
  let total_mes_anterior: number | null = null
  let variacao_percentual: number | null = null
  if (!criadaNesteMes) {
    const anterior = mesAnteriorSP(mes, ano)
    total_mes_anterior = await contarConcluidosDoMes(admin, prestadora.id, anterior.mes, anterior.ano)
    variacao_percentual = total_mes_anterior > 0
      ? Math.round(((total_agendamentos - total_mes_anterior) / total_mes_anterior) * 100)
      : null
  }

  // Profissional destaque — só quando há mais de 1 profissional ativa (senão
  // "destacar" a única que existe não diz nada).
  const { count: profissionaisAtivas } = await admin
    .from('profissionais')
    .select('id', { count: 'exact', head: true })
    .eq('prestadora_id', prestadora.id)
    .eq('ativa', true)

  let profissional_destaque: string | null = null
  if ((profissionaisAtivas ?? 0) > 1) {
    const porProfissional = new Map<string, number>()
    for (const a of lista) {
      if (!a.profissional_id) continue
      porProfissional.set(a.profissional_id, (porProfissional.get(a.profissional_id) ?? 0) + 1)
    }
    const idDestaque = maisFrequente(porProfissional)
    if (idDestaque) {
      const { data: prof } = await admin.from('profissionais').select('nome').eq('id', idDestaque).maybeSingle()
      profissional_destaque = prof?.nome ?? null
    }
  }

  return {
    tem_dados: true,
    total_agendamentos,
    servico_mais_pedido,
    dia_semana_mais_movimentado,
    cliente_mais_agendou,
    total_mes_anterior,
    variacao_percentual,
    profissional_destaque,
  }
}

/** Calcula e grava (upsert) a retrospectiva de um mês — usado tanto pelo cron mensal quanto pela rota de teste manual do admin. */
export async function salvarRetrospectivaDoMes(
  admin: Admin,
  prestadora: { id: string; created_at: string },
  mes: number,
  ano: number
): Promise<DadosRetrospectiva> {
  const dados = await gerarDadosRetrospectiva(admin, prestadora, mes, ano)
  const { error } = await admin
    .from('retrospectivas')
    .upsert({ prestadora_id: prestadora.id, mes, ano, dados }, { onConflict: 'prestadora_id,mes,ano' })
  if (error) throw new Error(`Erro ao gravar retrospectiva: ${error.message}`)
  return dados
}
