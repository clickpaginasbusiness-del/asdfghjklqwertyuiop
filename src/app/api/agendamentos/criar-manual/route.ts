import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mesmoTelefone } from '@/lib/utils'

type Body = {
  clienteId?: string
  servicoId?: string
  profissionalId?: string | null
  dataHora?: string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, telefone')
    .eq('user_id', user.id)
    .single()
  if (!prestadora) return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })

  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { clienteId, servicoId, dataHora } = body
  const profissionalId = body.profissionalId ?? null
  if (!clienteId || !servicoId || !dataHora) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const [{ data: servico }, { data: cliente }] = await Promise.all([
    admin
      .from('servicos')
      .select('id, duracao_minutos')
      .eq('id', servicoId)
      .eq('prestadora_id', prestadora.id)
      .maybeSingle(),
    admin
      .from('clientes')
      .select('id, nome, telefone')
      .eq('id', clienteId)
      .maybeSingle(),
  ])

  if (!servico) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 })
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrada.' }, { status: 404 })

  if (profissionalId) {
    const { data: prof } = await admin
      .from('profissionais')
      .select('id')
      .eq('id', profissionalId)
      .eq('prestadora_id', prestadora.id)
      .maybeSingle()
    if (!prof) return NextResponse.json({ error: 'Profissional não encontrada.' }, { status: 404 })
  }

  // Mesma checagem de sobreposição do agendamento público — impede dois
  // agendamentos confirmados no mesmo horário/profissional. Diferente do
  // fluxo público, não bloqueia por dia fechado/bloqueado: agendamento manual
  // é uma ferramenta de override da própria prestadora sobre a própria agenda.
  const novoInicio = new Date(dataHora).getTime()
  const novoFim = novoInicio + servico.duracao_minutos * 60000
  const inicioDia = new Date(novoInicio)
  inicioDia.setHours(0, 0, 0, 0)
  const fimDia = new Date(inicioDia)
  fimDia.setDate(fimDia.getDate() + 1)

  let conflitosQuery = admin
    .from('agendamentos')
    .select('data_hora, servicos(duracao_minutos)')
    .eq('prestadora_id', prestadora.id)
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

  const { data: ag, error } = await admin
    .from('agendamentos')
    .insert({
      prestadora_id: prestadora.id,
      profissional_id: profissionalId,
      servico_id: servicoId,
      cliente_id: clienteId,
      data_hora: dataHora,
      status: 'confirmado',
      agendamento_manual: true,
      cliente_e_prestadora: mesmoTelefone(cliente.telefone, prestadora.telefone),
    })
    .select('*, servicos(*), clientes(*), profissionais(*)')
    .single()

  if (error || !ag) {
    return NextResponse.json({ error: 'Erro ao agendar. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ agendamento: ag })
}
