import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyClientToken } from '@/lib/clientAuth'
import { formatDateShort, formatDateKey, dateKeyToDate, diaAtivoPadrao, mesmoTelefone } from '@/lib/utils'
import { buscarAssinaturaComCredito, aplicarUsoCredito } from '@/lib/planosPrestadora'

type Body = {
  token?: string
  prestadoraId?: string
  servicoId?: string
  profissionalId?: string | null
  dataHora?: string
  usarCreditoPlano?: boolean
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

  const [{ data: servico }, { data: prestadora }] = await Promise.all([
    supabaseAdmin
      .from('servicos')
      .select('id, duracao_minutos')
      .eq('id', servicoId)
      .eq('prestadora_id', prestadoraId)
      .maybeSingle(),
    supabaseAdmin
      .from('prestadoras')
      .select('telefone')
      .eq('id', prestadoraId)
      .maybeSingle(),
  ])

  if (!servico) {
    return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 })
  }

  // Defesa em profundidade: o front-end já esconde dias fechados/bloqueados no
  // calendário, mas sem checar de novo aqui um request direto à API (ou um bug
  // futuro no front) conseguia criar agendamento num dia desativado — foi
  // exatamente esse o bug relatado (domingo desativado, mas aceitava reserva).
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

  // Nunca confia no client sobre ter crédito de plano — reconfere aqui
  // mesmo se usarCreditoPlano vier true no corpo da requisição.
  const assinaturaComCredito = body.usarCreditoPlano
    ? await buscarAssinaturaComCredito(supabaseAdmin, { clienteId: session.clienteId, prestadoraId, servicoId })
    : null

  const { data: ag, error } = await supabaseAdmin
    .from('agendamentos')
    .insert({
      prestadora_id: prestadoraId,
      profissional_id: profissionalId,
      servico_id: servicoId,
      cliente_id: session.clienteId,
      data_hora: dataHora,
      status: 'confirmado',
      plano_assinatura_id: assinaturaComCredito?.id ?? null,
    })
    .select('*, servicos(*), clientes(*), profissionais(*)')
    .single()

  if (error || !ag) {
    return NextResponse.json({ error: 'Erro ao agendar. Tente novamente.' }, { status: 500 })
  }

  let creditosRestantesApos: number | null = null
  if (assinaturaComCredito) {
    await aplicarUsoCredito(supabaseAdmin, {
      assinaturaId: assinaturaComCredito.id,
      agendamentoId: ag.id,
      creditosRestantes: assinaturaComCredito.creditos_restantes,
    })
    creditosRestantesApos = Math.max(0, assinaturaComCredito.creditos_restantes - 1)
  }

  // Cliente testando o próprio sistema (mesmo telefone da prestadora) — não
  // bloqueia o agendamento, só sinaliza pra exibir "(Você)" no painel e,
  // futuramente, excluir esse agendamento de missões/objetivos.
  if (mesmoTelefone(ag.clientes?.telefone, prestadora?.telefone)) {
    await supabaseAdmin.from('agendamentos').update({ cliente_e_prestadora: true }).eq('id', ag.id)
    ag.cliente_e_prestadora = true
  }

  const profNome = ag.profissionais ? ` com ${ag.profissionais.nome}` : ''
  await supabaseAdmin.from('notificacoes').insert({
    prestadora_id: prestadoraId,
    tipo: 'agendamento',
    mensagem: `Nova cliente! ${ag.clientes?.nome} agendou ${ag.servicos?.nome}${profNome} para ${formatDateShort(dataHora)}`,
  })

  // Precisa ser aguardado: sem o await, a função serverless pode ser
  // encerrada antes do fetch completar e a notificação nunca é enviada.
  try {
    const pushRes = await fetch(new URL('/api/push/send', request.nextUrl.origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
      },
      body: JSON.stringify({ agendamentoId: ag.id }),
    })
    if (!pushRes.ok) {
      const pushErr = await pushRes.json().catch(() => ({}))
      console.error('[agendamentos/criar] push/send falhou — status:', pushRes.status, pushErr)
    }
  } catch (err) {
    console.error('[agendamentos/criar] erro de rede ao chamar push/send:', err)
  }

  return NextResponse.json({ agendamento: ag, creditosRestantesApos })
}
