import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyClientToken } from '@/lib/clientAuth'
import { formatDateKey, dateKeyToDate, diaAtivoPadrao } from '@/lib/utils'

type Body = {
  token?: string
  prestadoraId?: string
  servicoId?: string
  profissionalId?: string | null
  dataHora?: string
}

/**
 * Cria um agendamento "temporário" (status aguardando_pagamento) antes de
 * mandar a cliente pro checkout de sinal/pagamento — segura os dados da
 * reserva (serviço, profissional, horário) até o webhook do MP confirmar o
 * pagamento (ver /api/mp/webhook) e virar 'confirmado'. Mesma validação de
 * /api/agendamentos/criar, exceto que não notifica a prestadora nem manda
 * push aqui — isso só acontece quando o pagamento é confirmado de verdade.
 */
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
    .select('id, duracao_minutos, preco, aceitar_pagamento_online, sinal_tipo, sinal_valor, sinal_obrigatorio')
    .eq('id', servicoId)
    .eq('prestadora_id', prestadoraId)
    .maybeSingle()

  if (!servico) {
    return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 })
  }
  if (!servico.aceitar_pagamento_online) {
    return NextResponse.json({ error: 'Esse serviço não aceita pagamento online.' }, { status: 400 })
  }

  // Mesma defesa em profundidade de /api/agendamentos/criar: confere de novo
  // se o dia está disponível, sem confiar só no front-end.
  const diaChave = formatDateKey(dataHora)
  const diaSemana = dateKeyToDate(diaChave).getUTCDay()

  const [{ data: horarioDia }, { data: diaBloqueado }] = await Promise.all([
    supabaseAdmin
      .from('horarios_funcionamento')
      .select('ativo')
      .eq('prestadora_id', prestadoraId)
      .eq('dia_semana', diaSemana)
      .maybeSingle(),
    supabaseAdmin
      .from('dias_bloqueados')
      .select('id')
      .eq('prestadora_id', prestadoraId)
      .eq('data', diaChave)
      .maybeSingle(),
  ])

  const diaAtivo = horarioDia ? horarioDia.ativo : diaAtivoPadrao(diaSemana)
  if (!diaAtivo || diaBloqueado) {
    return NextResponse.json({ error: 'Esse dia não está disponível para agendamento.' }, { status: 409 })
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
      status: 'aguardando_pagamento',
    })
    .select('id')
    .single()

  if (error || !ag) {
    return NextResponse.json({ error: 'Erro ao agendar. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ agendamentoId: ag.id })
}
