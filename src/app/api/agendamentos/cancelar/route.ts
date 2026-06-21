import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyClientToken } from '@/lib/clientAuth'

export async function POST(request: NextRequest) {
  let body: { token?: string; agendamentoId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const session = verifyClientToken(body.token)
  if (!session) {
    return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401 })
  }

  if (!body.agendamentoId) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()

  const { data: agendamento } = await supabaseAdmin
    .from('agendamentos')
    .select('*, servicos(*), profissionais(*), clientes(*)')
    .eq('id', body.agendamentoId)
    .maybeSingle()

  if (!agendamento) {
    return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 })
  }

  if (agendamento.cliente_id !== session.clienteId) {
    return NextResponse.json({ error: 'Você não pode cancelar este agendamento.' }, { status: 403 })
  }

  if (agendamento.status === 'cancelado') {
    return NextResponse.json({ ok: true })
  }

  await supabaseAdmin
    .from('agendamentos')
    .update({ status: 'cancelado', cancelado_por: 'cliente' })
    .eq('id', agendamento.id)

  const profNome = agendamento.profissionais?.nome ? ` com ${agendamento.profissionais.nome}` : ''
  await supabaseAdmin.from('notificacoes').insert({
    prestadora_id: agendamento.prestadora_id,
    tipo: 'cancelamento',
    mensagem: `${agendamento.clientes?.nome} cancelou o agendamento - ${agendamento.servicos?.nome}${profNome} em ${format(new Date(agendamento.data_hora), "dd/MM 'às' HH'h'mm")}`,
  })

  // Precisa ser aguardado: sem o await, a função serverless pode ser
  // encerrada antes do fetch completar e a notificação nunca é enviada.
  await fetch(new URL('/api/push/send', request.nextUrl.origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agendamentoId: agendamento.id }),
  }).catch((err) => console.error('[agendamentos/cancelar] erro ao notificar push:', err))

  return NextResponse.json({ ok: true })
}
