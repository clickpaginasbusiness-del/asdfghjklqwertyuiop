import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { salvarRetrospectivaDoMes } from '@/lib/retrospectiva'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Ferramenta de QA exclusiva do admin — gera (ou regenera) a retrospectiva
 * de uma prestadora pra qualquer mês passado, sem precisar esperar o cron
 * do dia 1. Mesmo motor de cálculo do cron (ver lib/retrospectiva.ts).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  let body: { prestadora_id?: string; mes?: number; ano?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { prestadora_id: prestadoraId, mes, ano } = body
  if (!prestadoraId || !mes || !ano || mes < 1 || mes > 12) {
    return NextResponse.json({ error: 'prestadora_id, mes (1-12) e ano são obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: prestadora } = await admin
    .from('prestadoras')
    .select('id, created_at')
    .eq('id', prestadoraId)
    .maybeSingle()

  if (!prestadora) {
    return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })
  }

  try {
    const dados = await salvarRetrospectivaDoMes(admin, prestadora, mes, ano)
    return NextResponse.json({ ok: true, dados })
  } catch (err) {
    console.error('[admin/gerar-retrospectiva] erro ao gerar', prestadoraId, mes, ano, err)
    return NextResponse.json({ error: 'Erro ao gerar retrospectiva' }, { status: 500 })
  }
}
