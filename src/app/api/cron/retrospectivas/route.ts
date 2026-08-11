import { createAdminClient } from '@/lib/supabase/admin'
import { salvarRetrospectivaDoMes } from '@/lib/retrospectiva'
import { mesAnoAtualSP, mesAnteriorSP } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Roda 1x/mês, no dia 1 (ver vercel.json). Vercel Cron só dispara via GET
 * (não POST — mesmo esquema de autenticação por Bearer CRON_SECRET de
 * /api/cron/mp-renovacoes, que já roda assim há meses).
 *
 * No dia 1, o mês que "fechou" é o anterior ao mês atual em horário de São
 * Paulo — por isso calcula mesAnoAtualSP() e pega o mês anterior a partir
 * dali, nunca do relógio UTC do servidor.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const atual = mesAnoAtualSP()
  const { mes, ano } = mesAnteriorSP(atual.mes, atual.ano)

  const { data: prestadoras, error } = await admin
    .from('prestadoras')
    .select('id, created_at')
    .or('assinatura_ativa.eq.true,e_parceira.eq.true')

  if (error) {
    console.error('[cron/retrospectivas] erro ao buscar prestadoras', error)
    return NextResponse.json({ error: 'Erro ao buscar prestadoras' }, { status: 500 })
  }

  let geradas = 0
  let semDados = 0
  let falhas = 0

  for (const prestadora of prestadoras ?? []) {
    try {
      const dados = await salvarRetrospectivaDoMes(admin, prestadora, mes, ano)
      if (dados.tem_dados) geradas++
      else semDados++
    } catch (err) {
      falhas++
      console.error('[cron/retrospectivas] erro ao gerar retrospectiva', prestadora.id, err)
    }
  }

  console.log('[cron/retrospectivas] concluído', { mes, ano, total: prestadoras?.length ?? 0, geradas, semDados, falhas })
  return NextResponse.json({ ok: true, mes, ano, total: prestadoras?.length ?? 0, geradas, semDados, falhas })
}
