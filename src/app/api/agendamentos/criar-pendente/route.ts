import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyClientToken } from '@/lib/clientAuth'
import { formatDateKey, dateKeyToDate, diaAtivoPadrao } from '@/lib/utils'
import { buscarAssinaturaComCredito } from '@/lib/planosPrestadora'

type Body = {
  token?: string
  prestadoraId?: string
  servicoId?: string
  profissionalId?: string | null
  dataHora?: string
  usarCreditoPlano?: boolean
  modoPagamento?: 'sinal' | 'completo'
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

  // Guarda a intenção de usar crédito (reconferida aqui, nunca confia no
  // client) — o crédito só é debitado de verdade quando o pagamento é
  // confirmado pelo webhook do MP (ver processarPagamentoAgendamento em
  // /api/mp/webhook), pra não consumir crédito de um pagamento abandonado.
  const assinaturaComCredito = body.usarCreditoPlano
    ? await buscarAssinaturaComCredito(supabaseAdmin, { clienteId: session.clienteId, prestadoraId, servicoId })
    : null

  // Modo de pagamento é significativo só quando o sinal é obrigatório — fora
  // disso o serviço só tem o modo "completo" (mesmo comportamento de hoje).
  // Quando é obrigatório e o client não manda nada válido, o default é
  // 'sinal', preservando o comportamento anterior à Fase 5.
  const tipoPagamento: 'sinal' | 'completo' = !servico.sinal_obrigatorio
    ? 'completo'
    : body.modoPagamento === 'completo' ? 'completo' : 'sinal'

  // Checagem de sobreposição + insert acontecem atomicamente dentro da
  // função (lock + checagem + insert numa transação única) — evita a race
  // condition de duas reservas concorrentes passarem no "select" ao mesmo
  // tempo (ver 20260829_criar_agendamento_seguro.sql). Considera tanto
  // 'confirmado' quanto 'aguardando_pagamento' como bloqueio.
  const { data: ag, error } = await supabaseAdmin.rpc('criar_agendamento_seguro', {
    p_prestadora_id: prestadoraId,
    p_profissional_id: profissionalId,
    p_servico_id: servicoId,
    p_cliente_id: session.clienteId,
    p_data_hora: dataHora,
    p_status: 'aguardando_pagamento',
    p_plano_assinatura_id: assinaturaComCredito?.id ?? null,
    p_tipo_pagamento: tipoPagamento,
  })

  if (error) {
    if (error.message.includes('horario_conflitante')) {
      return NextResponse.json({ error: 'Esse horário já foi reservado. Escolha outro.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao agendar. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ agendamentoId: (ag as unknown as { id: string }).id })
}
