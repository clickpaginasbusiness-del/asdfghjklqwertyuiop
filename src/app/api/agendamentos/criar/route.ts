import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyClientToken } from '@/lib/clientAuth'

type Body = {
  token?: string
  prestadoraId?: string
  servicoId?: string
  profissionalId?: string | null
  dataHora?: string
}

export async function POST(request: NextRequest) {
  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const session = verifyClientToken(body.token)
  if (!session) {
    return NextResponse.json({ error: 'Faça login para agendar.' }, { status: 401 })
  }

  const { prestadoraId, servicoId, dataHora } = body
  const profissionalId = body.profissionalId ?? null
  if (!prestadoraId || !servicoId || !dataHora) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()

  const { data: servico } = await supabaseAdmin
    .from('servicos')
    .select('id, duracao_minutos')
    .eq('id', servicoId)
    .eq('prestadora_id', prestadoraId)
    .maybeSingle()

  if (!servico) {
    return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 })
  }

  const novoInicio = new Date(dataHora).getTime()
  const novoFim = novoInicio + servico.duracao_minutos * 60000
  const inicioDia = new Date(novoInicio)
  inicioDia.setHours(0, 0, 0, 0)
  const fimDia = new Date(inicioDia)
  fimDia.setDate(fimDia.getDate() + 1)

  let conflitosQuery = supabaseAdmin
    .from('agendamentos')
    .select('data_hora, servicos(duracao_minutos)')
    .eq('prestadora_id', prestadoraId)
    .eq('status', 'confirmado')
    .gte('data_hora', inicioDia.toISOString())
    .lt('data_hora', fimDia.toISOString())

  if (profissionalId) {
    conflitosQuery = conflitosQuery.eq('profissional_id', profissionalId)
  }

  const { data: conflitos } = await conflitosQuery
  const sobrepoe = ((conflitos ?? []) as unknown as { data_hora: string; servicos: { duracao_minutos: number } | null }[]).some((a) => {
    const inicio = new Date(a.data_hora).getTime()
    const fim = inicio + (a.servicos?.duracao_minutos ?? 30) * 60000
    return novoInicio < fim && novoFim > inicio
  })

  if (sobrepoe) {
    return NextResponse.json({ error: 'Esse horário já foi reservado. Escolha outro.' }, { status: 409 })
  }

  const { data: ag, error } = await supabaseAdmin
    .from('agendamentos')
    .insert({
      prestadora_id: prestadoraId,
      profissional_id: profissionalId,
      servico_id: servicoId,
      cliente_id: session.clienteId,
      data_hora: dataHora,
      status: 'confirmado',
    })
    .select('*, servicos(*), clientes(*), profissionais(*)')
    .single()

  if (error || !ag) {
    return NextResponse.json({ error: 'Erro ao agendar. Tente novamente.' }, { status: 500 })
  }

  const profNome = ag.profissionais ? ` com ${ag.profissionais.nome}` : ''
  await supabaseAdmin.from('notificacoes').insert({
    prestadora_id: prestadoraId,
    tipo: 'agendamento',
    mensagem: `Nova cliente! ${ag.clientes?.nome} agendou ${ag.servicos?.nome}${profNome} para ${format(new Date(dataHora), "dd/MM 'às' HH'h'mm")}`,
  })

  // Precisa ser aguardado: sem o await, a função serverless pode ser
  // encerrada antes do fetch completar e a notificação nunca é enviada.
  await fetch(new URL('/api/push/send', request.nextUrl.origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agendamentoId: ag.id }),
  }).catch((err) => console.error('[agendamentos/criar] erro ao notificar push:', err))

  return NextResponse.json({ agendamento: ag })
}
