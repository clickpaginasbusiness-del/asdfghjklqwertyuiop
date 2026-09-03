import { createAdminClient } from '@/lib/supabase/admin'
import { startOfTodaySP, formatDateKey, dateKeyToDate } from '@/lib/utils'
import { addDays } from 'date-fns'
import { NextRequest, NextResponse } from 'next/server'

type Regra = {
  id: string
  prestadora_id: string
  descricao: string
  valor: number
  categoria: string
  intervalo_dias: number
  ate: string
  duracao_dias: number | null
}

/**
 * Roda 1x/dia (ver vercel.json). Gera novas ocorrências de lançamentos
 * financeiros recorrentes (aluguel, fornecedor, etc.) — a primeira ocorrência
 * de cada regra já é criada na hora pelo painel (ver FinanceiroTabClient),
 * esse cron só cuida das seguintes. Em loop por regra pra cobrir o caso do
 * cron ter ficado parado por alguns dias sem rodar.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const hoje = formatDateKey(startOfTodaySP())

  const { data: regras, error } = await admin
    .from('lancamentos_recorrencias')
    .select('id, prestadora_id, descricao, valor, categoria, intervalo_dias, ate, duracao_dias')
    .eq('ativo', true)

  if (error) {
    console.error('[cron/lancamentos-recorrentes] erro ao buscar regras', error)
    return NextResponse.json({ error: 'Erro ao buscar regras' }, { status: 500 })
  }

  let geradas = 0
  let falhas = 0

  for (const regra of (regras ?? []) as Regra[]) {
    try {
      geradas += await gerarOcorrenciasPendentes(admin, regra, hoje)
    } catch (err) {
      falhas++
      console.error('[cron/lancamentos-recorrentes] erro ao gerar ocorrências', regra.id, err)
    }
  }

  console.log('[cron/lancamentos-recorrentes] concluído', { total: regras?.length ?? 0, geradas, falhas })
  return NextResponse.json({ ok: true, total: regras?.length ?? 0, geradas, falhas })
}

async function gerarOcorrenciasPendentes(
  admin: ReturnType<typeof createAdminClient>,
  regra: Regra,
  hoje: string
): Promise<number> {
  const { data: ultima, error } = await admin
    .from('lancamentos_financeiros')
    .select('data')
    .eq('recorrencia_id', regra.id)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  // Nunca deveria acontecer (a primeira ocorrência é criada junto com a
  // regra) — sem uma âncora não tem como saber a partir de quando gerar.
  if (!ultima) return 0

  let ultimaData = ultima.data as string
  let criadas = 0

  for (;;) {
    const proximaData = formatDateKey(addDays(dateKeyToDate(ultimaData), regra.intervalo_dias))
    if (proximaData > regra.ate || proximaData > hoje) break

    const dataFim = regra.duracao_dias != null
      ? formatDateKey(addDays(dateKeyToDate(proximaData), regra.duracao_dias))
      : null

    const { error: erroInsert } = await admin.from('lancamentos_financeiros').insert({
      prestadora_id: regra.prestadora_id,
      descricao: regra.descricao,
      valor: regra.valor,
      categoria: regra.categoria,
      data: proximaData,
      data_fim: dataFim,
      recorrencia_id: regra.id,
    })
    if (erroInsert) throw erroInsert

    ultimaData = proximaData
    criadas++
  }

  return criadas
}
