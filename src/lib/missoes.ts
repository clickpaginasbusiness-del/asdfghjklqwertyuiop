import type { SupabaseClient } from '@supabase/supabase-js'
import { limitesDoMesSP, mesAnoAtualSP, formatDateKey, dateKeyToDate } from '@/lib/utils'
import type { Missao, MissaoProgresso, MissaoDesconto } from '@/lib/types'

/**
 * Motor do sistema de Missões/Objetivos mensais.
 *
 * Estratégia: em vez de incrementar contadores a cada evento (agendamento
 * concluído, avaliação recebida, etc.), o progresso de cada missão é
 * RECALCULADO do zero a partir dos dados de origem toda vez que o painel
 * pede a lista de missões (`getMissoesDoMes`). Isso evita ter que caçar
 * todo ponto do código que poderia mexer numa métrica — e como cada
 * `calcularMetrica` já faz COUNT(DISTINCT cliente_id) na fonte, o "cooldown
 * por cliente" (cada cliente conta no máximo 1x por missão/mês) sai de
 * graça, sem precisar de tabela de dedupe.
 *
 * Única exceção: 'indicacao_bonus', que só é concluída via webhook do
 * Mercado Pago (assinatura real de uma indicada) — nunca pelo recompute genérico.
 */

const MESES_HISTORICO = 3
const TIPOS_ONBOARDING_PERMANENTE = ['perfil_completo', 'icones_servicos', 'cor_tema']
const TIPOS_INVERSOS = new Set(['cancelamentos']) // "menos é melhor" — só fecha no fim do mês

type Admin = SupabaseClient

/* ───────────────────────── Cálculo de métricas por tipo ───────────────────────── */

async function agendamentosConcluidos(admin: Admin, prestadoraId: string, mes: number, ano: number) {
  const { inicio, fim } = limitesDoMesSP(mes, ano)
  const { data } = await admin
    .from('agendamentos')
    .select('cliente_id')
    .eq('prestadora_id', prestadoraId)
    .eq('status', 'concluido')
    .eq('cliente_e_prestadora', false)
    .eq('agendamento_manual', false)
    .gte('data_hora', inicio.toISOString())
    .lt('data_hora', fim.toISOString())
  return (data ?? []) as { cliente_id: string }[]
}

async function cancelamentosMes(admin: Admin, prestadoraId: string, mes: number, ano: number): Promise<number> {
  const { inicio, fim } = limitesDoMesSP(mes, ano)
  const { count } = await admin
    .from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('prestadora_id', prestadoraId)
    .eq('status', 'cancelado')
    .eq('cliente_e_prestadora', false)
    .eq('agendamento_manual', false)
    .gte('data_hora', inicio.toISOString())
    .lt('data_hora', fim.toISOString())
  return count ?? 0
}

async function zeroCancelamentos14Dias(admin: Admin, prestadoraId: string, mes: number, ano: number): Promise<number> {
  const { inicio, fim } = limitesDoMesSP(mes, ano)
  const agora = new Date()
  const limite = agora < fim ? agora : fim
  const { data } = await admin
    .from('agendamentos')
    .select('data_hora')
    .eq('prestadora_id', prestadoraId)
    .eq('status', 'cancelado')
    .eq('cliente_e_prestadora', false)
    .eq('agendamento_manual', false)
    .gte('data_hora', inicio.toISOString())
    .lt('data_hora', limite.toISOString())
    .order('data_hora')

  const marcos = [inicio, ...(data ?? []).map((a) => new Date(a.data_hora)), limite]
  const CATORZE_DIAS = 14 * 24 * 60 * 60 * 1000
  for (let i = 1; i < marcos.length; i++) {
    if (marcos[i].getTime() - marcos[i - 1].getTime() >= CATORZE_DIAS) return 1
  }
  return 0
}

async function historicoAnterior(admin: Admin, prestadoraId: string, clienteIds: string[], antesDe: Date) {
  if (!clienteIds.length) return [] as { cliente_id: string; data_hora: string }[]
  const { data } = await admin
    .from('agendamentos')
    .select('cliente_id, data_hora')
    .eq('prestadora_id', prestadoraId)
    .in('cliente_id', clienteIds)
    .in('status', ['confirmado', 'concluido'])
    .eq('agendamento_manual', false)
    .lt('data_hora', antesDe.toISOString())
  return (data ?? []) as { cliente_id: string; data_hora: string }[]
}

async function clientesNovosMes(admin: Admin, prestadoraId: string, mes: number, ano: number): Promise<number> {
  const { inicio, fim } = limitesDoMesSP(mes, ano)
  const doMes = await agendamentosConcluidos(admin, prestadoraId, mes, ano)
  const clienteIds = [...new Set(doMes.map((a) => a.cliente_id))]
  if (!clienteIds.length) return 0

  // "Novo" = a primeira reserva ATIVA desse cliente com essa prestadora, em
  // qualquer época, cai dentro deste mês — busca o histórico completo (sem
  // limite inferior de data) pra achar o mínimo real, não só o deste mês.
  const { data: todoHistorico } = await admin
    .from('agendamentos')
    .select('cliente_id, data_hora')
    .eq('prestadora_id', prestadoraId)
    .in('cliente_id', clienteIds)
    .in('status', ['confirmado', 'concluido'])
    .eq('agendamento_manual', false)

  const primeira = new Map<string, number>()
  for (const a of (todoHistorico ?? []) as { cliente_id: string; data_hora: string }[]) {
    const t = new Date(a.data_hora).getTime()
    if (!primeira.has(a.cliente_id) || t < primeira.get(a.cliente_id)!) primeira.set(a.cliente_id, t)
  }

  let count = 0
  for (const id of clienteIds) {
    const t = primeira.get(id)
    if (t !== undefined && t >= inicio.getTime() && t < fim.getTime()) count++
  }
  return count
}

async function clientesRecorrentesMes(admin: Admin, prestadoraId: string, mes: number, ano: number): Promise<number> {
  const { inicio } = limitesDoMesSP(mes, ano)
  const doMes = await agendamentosConcluidos(admin, prestadoraId, mes, ano)
  const porCliente = new Map<string, number[]>()
  for (const a of doMes) {
    const arr = porCliente.get(a.cliente_id) ?? []
    arr.push(inicio.getTime())
    porCliente.set(a.cliente_id, arr)
  }
  const clienteIds = [...porCliente.keys()]
  if (!clienteIds.length) return 0

  const anteriores = await historicoAnterior(admin, prestadoraId, clienteIds, inicio)
  const ultimaAnterior = new Map<string, number>()
  for (const a of anteriores) {
    const t = new Date(a.data_hora).getTime()
    if (!ultimaAnterior.has(a.cliente_id) || t > ultimaAnterior.get(a.cliente_id)!) ultimaAnterior.set(a.cliente_id, t)
  }

  const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000
  let count = 0
  for (const clienteId of clienteIds) {
    const anterior = ultimaAnterior.get(clienteId)
    if (anterior !== undefined && inicio.getTime() - anterior > TRINTA_DIAS) count++
  }
  return count
}

async function taxaRetornoMes(admin: Admin, prestadoraId: string, mes: number, ano: number): Promise<number> {
  const { inicio } = limitesDoMesSP(mes, ano)
  const doMes = await agendamentosConcluidos(admin, prestadoraId, mes, ano)
  const clienteIds = [...new Set(doMes.map((a) => a.cliente_id))]
  if (!clienteIds.length) return 0
  const anteriores = await historicoAnterior(admin, prestadoraId, clienteIds, inicio)
  const comHistorico = new Set(anteriores.map((a) => a.cliente_id))
  const retornantes = clienteIds.filter((id) => comHistorico.has(id)).length
  return Math.round((retornantes / clienteIds.length) * 100)
}

async function clientesFidelizadosMes(admin: Admin, prestadoraId: string, mes: number, ano: number): Promise<number> {
  const doMes = await agendamentosConcluidos(admin, prestadoraId, mes, ano)
  const contagem = new Map<string, number>()
  for (const a of doMes) contagem.set(a.cliente_id, (contagem.get(a.cliente_id) ?? 0) + 1)
  return [...contagem.values()].filter((n) => n >= 2).length
}

async function avaliacoesDoMes(admin: Admin, prestadoraId: string, mes: number, ano: number) {
  const { inicio, fim } = limitesDoMesSP(mes, ano)
  const { data: avals } = await admin
    .from('avaliacoes')
    .select('id, nota, agendamento_id')
    .eq('prestadora_id', prestadoraId)
    .gte('created_at', inicio.toISOString())
    .lt('created_at', fim.toISOString())

  if (!avals || !avals.length) return { clientesDistintos: 0, media: 0 }

  const agIds = avals.map((a) => a.agendamento_id)
  const { data: ags } = await admin
    .from('agendamentos')
    .select('id, cliente_id, cliente_e_prestadora, agendamento_manual')
    .in('id', agIds)

  const clienteValido = new Map(
    (ags ?? []).filter((a) => !a.cliente_e_prestadora && !a.agendamento_manual).map((a) => [a.id, a.cliente_id])
  )
  const validas = avals.filter((a) => clienteValido.has(a.agendamento_id))
  const clientesDistintos = new Set(validas.map((a) => clienteValido.get(a.agendamento_id))).size
  const media = validas.length ? validas.reduce((s, a) => s + a.nota, 0) / validas.length : 0
  return { clientesDistintos, media }
}

async function eventosDistintos(admin: Admin, prestadoraId: string, tipo: 'lembrete' | 'confirmacao', mes: number, ano: number): Promise<number> {
  const { inicio, fim } = limitesDoMesSP(mes, ano)
  const { data } = await admin
    .from('missoes_eventos')
    .select('cliente_id')
    .eq('prestadora_id', prestadoraId)
    .eq('tipo', tipo)
    .gte('created_at', inicio.toISOString())
    .lt('created_at', fim.toISOString())
  return new Set((data ?? []).map((e) => e.cliente_id)).size
}

async function confirmacoesSemanaAtual(admin: Admin, prestadoraId: string): Promise<number> {
  const hojeSP = dateKeyToDate(formatDateKey(new Date()))
  const offsetSegunda = (hojeSP.getUTCDay() + 6) % 7 // 0=domingo..6=sabado → dias desde a última segunda
  const inicioSemana = new Date(hojeSP)
  inicioSemana.setUTCDate(hojeSP.getUTCDate() - offsetSegunda)
  const fimSemana = new Date(inicioSemana)
  fimSemana.setUTCDate(inicioSemana.getUTCDate() + 7)

  const { data: agsSemana } = await admin
    .from('agendamentos')
    .select('id')
    .eq('prestadora_id', prestadoraId)
    .eq('status', 'confirmado')
    .eq('agendamento_manual', false)
    .gte('data_hora', inicioSemana.toISOString())
    .lt('data_hora', fimSemana.toISOString())

  const total = agsSemana?.length ?? 0
  if (!total) return 0

  const { data: eventos } = await admin
    .from('missoes_eventos')
    .select('agendamento_id')
    .eq('prestadora_id', prestadoraId)
    .eq('tipo', 'confirmacao')
    .in('agendamento_id', agsSemana!.map((a) => a.id))

  const confirmados = new Set((eventos ?? []).map((e) => e.agendamento_id)).size
  return confirmados >= total ? 1 : 0
}

async function servicosCriadosMes(admin: Admin, prestadoraId: string, mes: number, ano: number): Promise<number> {
  const { inicio, fim } = limitesDoMesSP(mes, ano)
  const { count } = await admin
    .from('servicos')
    .select('id', { count: 'exact', head: true })
    .eq('prestadora_id', prestadoraId)
    .gte('created_at', inicio.toISOString())
    .lt('created_at', fim.toISOString())
  return count ?? 0
}

async function iconesPersonalizados(admin: Admin, prestadoraId: string): Promise<number> {
  const { data } = await admin.from('servicos').select('icone').eq('prestadora_id', prestadoraId).eq('ativo', true)
  if (!data || !data.length) return 0
  return data.every((s) => s.icone && s.icone !== 'Scissors') ? 1 : 0
}

async function galeriaCriadaMes(admin: Admin, prestadoraId: string, mes: number, ano: number): Promise<number> {
  const { inicio, fim } = limitesDoMesSP(mes, ano)
  const { count } = await admin
    .from('galeria')
    .select('id', { count: 'exact', head: true })
    .eq('prestadora_id', prestadoraId)
    .gte('created_at', inicio.toISOString())
    .lt('created_at', fim.toISOString())
  return count ?? 0
}

async function galeriaTotal(admin: Admin, prestadoraId: string): Promise<number> {
  const { count } = await admin.from('galeria').select('id', { count: 'exact', head: true }).eq('prestadora_id', prestadoraId)
  return count ?? 0
}

async function perfilCompleto(admin: Admin, prestadoraId: string): Promise<number> {
  const { data } = await admin.from('prestadoras').select('bio, foto_url, whatsapp, instagram').eq('id', prestadoraId).maybeSingle()
  if (!data) return 0
  const ok = Boolean(data.bio?.trim()) && Boolean(data.foto_url) && Boolean(data.whatsapp || data.instagram)
  return ok ? 1 : 0
}

async function corPersonalizada(admin: Admin, prestadoraId: string): Promise<number> {
  const { data } = await admin.from('prestadoras').select('cor_tema').eq('id', prestadoraId).maybeSingle()
  return data?.cor_tema && data.cor_tema !== 'rosa' ? 1 : 0
}

type FaturamentoLinha = { data_hora: string; preco: number }

async function faturamentoLinhasDoMes(admin: Admin, prestadoraId: string, mes: number, ano: number): Promise<FaturamentoLinha[]> {
  const { inicio, fim } = limitesDoMesSP(mes, ano)
  const { data } = await admin
    .from('agendamentos')
    .select('data_hora, servicos(preco)')
    .eq('prestadora_id', prestadoraId)
    .eq('status', 'concluido')
    .eq('cliente_e_prestadora', false)
    .eq('agendamento_manual', false)
    .gte('data_hora', inicio.toISOString())
    .lt('data_hora', fim.toISOString())
  return ((data ?? []) as unknown as { data_hora: string; servicos: { preco: number } | null }[]).map((a) => ({
    data_hora: a.data_hora,
    preco: a.servicos?.preco ?? 0,
  }))
}

function melhorSemana(linhas: FaturamentoLinha[], inicioMes: Date): number {
  const semanas = new Map<number, number>()
  for (const l of linhas) {
    const dias = Math.floor((new Date(l.data_hora).getTime() - inicioMes.getTime()) / (24 * 60 * 60 * 1000))
    const semana = Math.floor(dias / 7)
    semanas.set(semana, (semanas.get(semana) ?? 0) + l.preco)
  }
  return semanas.size ? Math.max(...semanas.values()) : 0
}

/** Calcula o valor bruto da métrica de um tipo de missão pra um mês específico. */
export async function calcularMetrica(admin: Admin, tipo: string, prestadoraId: string, mes: number, ano: number): Promise<number> {
  switch (tipo) {
    case 'agendamentos':
      return (await agendamentosConcluidos(admin, prestadoraId, mes, ano)).length
    case 'clientes_diferentes':
      return new Set((await agendamentosConcluidos(admin, prestadoraId, mes, ano)).map((a) => a.cliente_id)).size
    case 'avaliacoes':
      return (await avaliacoesDoMes(admin, prestadoraId, mes, ano)).clientesDistintos
    case 'nota_media':
      return (await avaliacoesDoMes(admin, prestadoraId, mes, ano)).media >= 4.5 ? 1 : 0
    case 'cancelamentos':
      return cancelamentosMes(admin, prestadoraId, mes, ano)
    case 'zero_cancelamentos':
      return zeroCancelamentos14Dias(admin, prestadoraId, mes, ano)
    case 'clientes_novos':
      return clientesNovosMes(admin, prestadoraId, mes, ano)
    case 'clientes_recorrentes':
      return clientesRecorrentesMes(admin, prestadoraId, mes, ano)
    case 'lembretes':
      return eventosDistintos(admin, prestadoraId, 'lembrete', mes, ano)
    case 'confirmacoes':
      return confirmacoesSemanaAtual(admin, prestadoraId)
    case 'servicos':
      return servicosCriadosMes(admin, prestadoraId, mes, ano)
    case 'icones_servicos':
      return iconesPersonalizados(admin, prestadoraId)
    case 'galeria':
      return galeriaCriadaMes(admin, prestadoraId, mes, ano)
    case 'galeria_minima':
      return galeriaTotal(admin, prestadoraId)
    case 'faturamento': {
      const linhas = await faturamentoLinhasDoMes(admin, prestadoraId, mes, ano)
      return Math.round(linhas.reduce((s, l) => s + l.preco, 0))
    }
    case 'faturamento_semanal': {
      const { inicio } = limitesDoMesSP(mes, ano)
      const linhas = await faturamentoLinhasDoMes(admin, prestadoraId, mes, ano)
      return Math.round(melhorSemana(linhas, inicio))
    }
    case 'perfil_completo':
      return perfilCompleto(admin, prestadoraId)
    case 'cor_tema':
      return corPersonalizada(admin, prestadoraId)
    case 'clientes_fidelizados':
      return clientesFidelizadosMes(admin, prestadoraId, mes, ano)
    case 'taxa_retorno':
      return taxaRetornoMes(admin, prestadoraId, mes, ano)
    case 'indicacao_bonus':
      return 0 // só avança via webhook do Mercado Pago, nunca pelo recompute genérico
    default:
      return 0
  }
}

function bateuMeta(tipo: string, valor: number, meta: number, mesFechado: boolean): boolean {
  if (TIPOS_INVERSOS.has(tipo)) {
    if (!mesFechado) return false // só sabemos se "deu certo" quando o mês inteiro já passou
    return valor < meta
  }
  return valor >= meta
}

/* ───────────────────────── Meta adaptativa ───────────────────────── */

function ultimosNMeses(mes: number, ano: number, n: number): { mes: number; ano: number }[] {
  const lista: { mes: number; ano: number }[] = []
  let m = mes
  let a = ano
  for (let i = 0; i < n; i++) {
    m -= 1
    if (m < 1) { m = 12; a -= 1 }
    lista.push({ mes: m, ano: a })
  }
  return lista
}

async function calcularMetaAdaptada(admin: Admin, missao: Missao, prestadoraId: string, mes: number, ano: number): Promise<number> {
  const { data: anteriores } = await admin
    .from('missoes_progresso')
    .select('concluida, mes, ano')
    .eq('prestadora_id', prestadoraId)
    .eq('missao_id', missao.id)
    .order('ano', { ascending: false })
    .order('mes', { ascending: false })
    .limit(1)

  // Primeira vez que essa missão é sorteada pra essa prestadora → usa a meta_base do catálogo.
  if (!anteriores || anteriores.length === 0) return missao.meta_base

  const cumpriuUltimaVez = anteriores[0].concluida

  const meses = ultimosNMeses(mes, ano, MESES_HISTORICO)
  const valores = await Promise.all(meses.map((m) => calcularMetrica(admin, missao.tipo, prestadoraId, m.mes, m.ano)))
  const media = valores.reduce((s, v) => s + v, 0) / valores.length

  const fator = cumpriuUltimaVez ? 1.2 : 0.9
  return Math.max(1, Math.round(media * fator))
}

/* ───────────────────────── Sorteio mensal ───────────────────────── */

function sortearAleatorias<T>(lista: T[], quantidade: number): T[] {
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia.slice(0, Math.min(quantidade, copia.length))
}

async function sortearMissoesDoMes(admin: Admin, prestadoraId: string, plano: 'basico' | 'pro', mes: number, ano: number): Promise<void> {
  const { data: existentes } = await admin
    .from('missoes_progresso')
    .select('id')
    .eq('prestadora_id', prestadoraId)
    .eq('mes', mes)
    .eq('ano', ano)
    .limit(1)

  if (existentes && existentes.length > 0) return // já sorteado esse mês

  const colunaDisponivel = plano === 'pro' ? 'disponivel_pro' : 'disponivel_basico'
  const { data: catalogo } = await admin
    .from('missoes')
    .select('*')
    .eq('ativo', true)
    .eq(colunaDisponivel, true)
    .neq('tipo', 'indicacao_bonus')

  // Exclui missões de onboarding já concluídas permanentemente (perfil
  // completo, ícones personalizados, cor do tema) — uma vez feito, não faz
  // sentido sortear de novo.
  const { data: concluidasOnboarding } = await admin
    .from('missoes_progresso')
    .select('missao_id, missoes!inner(tipo)')
    .eq('prestadora_id', prestadoraId)
    .eq('concluida', true)
    .in('missoes.tipo', TIPOS_ONBOARDING_PERMANENTE)

  const idsExcluidos = new Set((concluidasOnboarding ?? []).map((r) => r.missao_id as string))
  const pool = ((catalogo ?? []) as Missao[]).filter((m) => !idsExcluidos.has(m.id))

  const quantidade = plano === 'pro' ? 3 : 2
  const sorteadas = sortearAleatorias(pool, quantidade)

  const linhas = await Promise.all(
    sorteadas.map(async (m) => ({
      prestadora_id: prestadoraId,
      missao_id: m.id,
      mes,
      ano,
      meta_adaptada: await calcularMetaAdaptada(admin, m, prestadoraId, mes, ano),
      e_bonus: false,
    }))
  )

  // Missão bônus de indicação — 15% de chance de vir como extra.
  if (Math.random() < 0.15) {
    const { data: bonusMissao } = await admin.from('missoes').select('*').eq('tipo', 'indicacao_bonus').eq('ativo', true).maybeSingle()
    if (bonusMissao) {
      linhas.push({
        prestadora_id: prestadoraId,
        missao_id: bonusMissao.id,
        mes,
        ano,
        meta_adaptada: bonusMissao.meta_base,
        e_bonus: true,
      })
    }
  }

  if (linhas.length) await admin.from('missoes_progresso').insert(linhas)
}

/* ───────────────────────── Conclusão + desconto ───────────────────────── */

/** Início do mês seguinte (UTC) — mesmo instante de `date_trunc('month', now()) + interval '1 month'` no Postgres. */
function inicioProximoMesUTC(): Date {
  const agora = new Date()
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1, 0, 0, 0))
}

async function concluirMissao(admin: Admin, prestadoraId: string, linhaId: string, missao: Missao): Promise<void> {
  await admin.from('missoes_progresso').update({
    concluida: true,
    concluida_em: new Date().toISOString(),
    desconto_aplicado: missao.tipo !== 'indicacao_bonus',
  }).eq('id', linhaId)

  // Missão de indicação: a recompensa (extensão de 30 dias) já é concedida
  // pelo fluxo de indicação existente no webhook do Mercado Pago — aqui só
  // marcamos a missão como concluída pra fins de exibição, sem gerar desconto
  // de novo. Não expira (não entra na fila de descontos percentuais).
  if (missao.tipo === 'indicacao_bonus') {
    return
  }

  // Desconto vale só até o início do próximo mês — se não for aplicado numa
  // fatura até lá, expira (não acumula pro mês seguinte).
  await admin.from('missoes_descontos').insert({
    prestadora_id: prestadoraId,
    percentual: missao.desconto_percentual,
    origem: missao.titulo,
    expira_em: inicioProximoMesUTC().toISOString(),
  })

  await admin.from('notificacoes').insert({
    prestadora_id: prestadoraId,
    tipo: 'missao',
    mensagem: `🎯 Missão concluída! Você ganhou ${missao.desconto_percentual}% de desconto na próxima fatura!`,
  })
}

/** Recalcula progresso de todas as linhas de um mês; fecha (concluida definitiva) se `mesFechado`. */
async function recomputarProgresso(admin: Admin, prestadoraId: string, mes: number, ano: number, mesFechado: boolean): Promise<void> {
  const { data: linhas } = await admin
    .from('missoes_progresso')
    .select('*, missoes(*)')
    .eq('prestadora_id', prestadoraId)
    .eq('mes', mes)
    .eq('ano', ano)
    .eq('concluida', false)

  for (const linha of (linhas ?? []) as (MissaoProgresso & { missoes: Missao })[]) {
    const missao = linha.missoes
    if (!missao || missao.tipo === 'indicacao_bonus') continue

    const valor = await calcularMetrica(admin, missao.tipo, prestadoraId, mes, ano)
    const concluiu = bateuMeta(missao.tipo, valor, linha.meta_adaptada, mesFechado)

    await admin.from('missoes_progresso').update({ progresso: valor }).eq('id', linha.id)

    if (concluiu) {
      await concluirMissao(admin, prestadoraId, linha.id, missao)
    }
  }
}

/** Fecha missões de meses passados que ainda estavam em aberto (ex: 'cancelamentos' só é avaliado no fim do mês). */
async function fecharMesesAnteriores(admin: Admin, prestadoraId: string, mesAtual: number, anoAtual: number): Promise<void> {
  const { data: pendentes } = await admin
    .from('missoes_progresso')
    .select('mes, ano')
    .eq('prestadora_id', prestadoraId)
    .eq('concluida', false)
    .or(`ano.lt.${anoAtual},and(ano.eq.${anoAtual},mes.lt.${mesAtual})`)

  const periodos = new Map<string, { mes: number; ano: number }>()
  for (const p of pendentes ?? []) periodos.set(`${p.ano}-${p.mes}`, { mes: p.mes, ano: p.ano })

  for (const { mes, ano } of periodos.values()) {
    await recomputarProgresso(admin, prestadoraId, mes, ano, true)
  }
}

/**
 * Job de limpeza: descontos com prazo vencido que nunca foram aplicados numa
 * fatura são marcados como "aplicado" (consumidos/expirados) — não acumulam
 * pro mês seguinte. Roda a cada vez que o painel busca as missões, o que na
 * prática cobre "início de cada mês" (mesma cadência lazy do sorteio mensal,
 * sem precisar de um cron dedicado).
 */
async function expirarDescontosVencidos(admin: Admin, prestadoraId: string): Promise<void> {
  await admin
    .from('missoes_descontos')
    .update({ aplicado: true, aplicado_em: new Date().toISOString() })
    .eq('prestadora_id', prestadoraId)
    .eq('aplicado', false)
    .not('expira_em', 'is', null)
    .lte('expira_em', new Date().toISOString())
}

/* ───────────────────────── API pública do módulo ───────────────────────── */

export interface MissaoComProgresso extends MissaoProgresso {
  missoes: Missao
}

export async function getMissoesDoMes(admin: Admin, prestadoraId: string, plano: 'basico' | 'pro'): Promise<{
  missoes: MissaoComProgresso[]
  descontosPendentes: MissaoDesconto[]
}> {
  const { mes, ano } = mesAnoAtualSP()

  await fecharMesesAnteriores(admin, prestadoraId, mes, ano)
  await expirarDescontosVencidos(admin, prestadoraId)
  await sortearMissoesDoMes(admin, prestadoraId, plano, mes, ano)
  await recomputarProgresso(admin, prestadoraId, mes, ano, false)

  const { data: linhas } = await admin
    .from('missoes_progresso')
    .select('*, missoes(*)')
    .eq('prestadora_id', prestadoraId)
    .eq('mes', mes)
    .eq('ano', ano)
    .order('created_at')

  const { data: descontos } = await admin
    .from('missoes_descontos')
    .select('*')
    .eq('prestadora_id', prestadoraId)
    .eq('aplicado', false)
    .order('expira_em')

  return {
    missoes: (linhas ?? []) as unknown as MissaoComProgresso[],
    descontosPendentes: (descontos ?? []) as MissaoDesconto[],
  }
}

/**
 * Chamada a partir do webhook do Mercado Pago (pagamento aprovado) quando
 * uma prestadora indicada assina um plano. Marca a missão 'indicacao_bonus'
 * do mês corrente do referrer (se ela estiver ativa) como concluída — a
 * recompensa em si (extensão de 30 dias) já é aplicada pelo fluxo de
 * indicação existente, isso aqui é só pra refletir no drawer de missões.
 */
export async function concluirMissaoIndicacaoBonus(admin: Admin, referrerId: string): Promise<void> {
  const { mes, ano } = mesAnoAtualSP()
  const { data: linha } = await admin
    .from('missoes_progresso')
    .select('id, missoes!inner(tipo)')
    .eq('prestadora_id', referrerId)
    .eq('mes', mes)
    .eq('ano', ano)
    .eq('concluida', false)
    .eq('missoes.tipo', 'indicacao_bonus')
    .maybeSingle()

  if (!linha) return

  await admin.from('missoes_progresso').update({
    progresso: 1,
    concluida: true,
    concluida_em: new Date().toISOString(),
    desconto_aplicado: true,
  }).eq('id', linha.id)

  await admin.from('notificacoes').insert({
    prestadora_id: referrerId,
    tipo: 'missao',
    mensagem: '🎯 Missão concluída! Sua indicada assinou um plano — você ganhou 1 mês grátis!',
  })
}
