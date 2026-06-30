import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  let body: { agendamentoId?: string; nota?: number; comentario?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { agendamentoId, nota, comentario } = body

  if (!agendamentoId || typeof nota !== 'number' || nota < 1 || nota > 5) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: agendamento } = await admin
    .from('agendamentos')
    .select('id, prestadora_id, status, data_hora')
    .eq('id', agendamentoId)
    .maybeSingle()

  if (!agendamento) {
    return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 })
  }

  if (agendamento.status === 'cancelado') {
    return NextResponse.json({ error: 'Não é possível avaliar um agendamento cancelado.' }, { status: 400 })
  }

  if (new Date(agendamento.data_hora) > new Date()) {
    return NextResponse.json({ error: 'O agendamento ainda não aconteceu.' }, { status: 400 })
  }

  const { error } = await admin.from('avaliacoes').insert({
    agendamento_id: agendamentoId,
    prestadora_id: agendamento.prestadora_id,
    nota: Math.round(nota),
    comentario: typeof comentario === 'string' && comentario.trim() ? comentario.trim() : null,
  })

  if (error) {
    // Constraint UNIQUE(agendamento_id) — avaliação já existe
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Este agendamento já foi avaliado.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao salvar avaliação.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
