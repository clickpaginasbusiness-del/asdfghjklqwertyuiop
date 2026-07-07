import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const prestadoraId = searchParams.get('prestadoraId')
  const data = searchParams.get('data')
  const profissionalId = searchParams.get('profissionalId')

  if (!prestadoraId || !data) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  const inicioDia = new Date(data)
  if (Number.isNaN(inicioDia.getTime())) {
    return NextResponse.json({ error: 'Data inválida.' }, { status: 400 })
  }
  inicioDia.setHours(0, 0, 0, 0)
  const fimDia = new Date(inicioDia)
  fimDia.setDate(fimDia.getDate() + 1)

  const supabaseAdmin = createAdminClient()

  let query = supabaseAdmin
    .from('agendamentos')
    .select('data_hora, servicos(duracao_minutos)')
    .eq('prestadora_id', prestadoraId)
    .gte('data_hora', inicioDia.toISOString())
    .lt('data_hora', fimDia.toISOString())
    .eq('status', 'confirmado')

  if (profissionalId) {
    query = query.eq('profissional_id', profissionalId)
  }

  const { data: agendamentos } = await query
  const ocupados = ((agendamentos ?? []) as unknown as { data_hora: string; servicos: { duracao_minutos: number } | null }[]).map((a) => {
    const startMs = new Date(a.data_hora).getTime()
    const durMin = a.servicos?.duracao_minutos ?? 30
    return { start: startMs, end: startMs + durMin * 60000 }
  })

  return NextResponse.json({ ocupados })
}
