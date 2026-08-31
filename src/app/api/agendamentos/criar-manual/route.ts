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

  // Checagem de sobreposição + insert acontecem atomicamente dentro da
  // função (lock + checagem + insert numa transação única) — evita a race
  // condition de duas reservas concorrentes passarem no "select" ao mesmo
  // tempo (ver 20260829_criar_agendamento_seguro.sql). Diferente do fluxo
  // público, não bloqueia por dia fechado/bloqueado: agendamento manual é
  // uma ferramenta de override da própria prestadora sobre a própria agenda.
  const { data: agendamentoCriado, error: rpcError } = await admin.rpc('criar_agendamento_seguro', {
    p_prestadora_id: prestadora.id,
    p_profissional_id: profissionalId,
    p_servico_id: servicoId,
    p_cliente_id: clienteId,
    p_data_hora: dataHora,
    p_status: 'confirmado',
    p_agendamento_manual: true,
    p_cliente_e_prestadora: mesmoTelefone(cliente.telefone, prestadora.telefone),
  })

  if (rpcError) {
    if (rpcError.message.includes('horario_conflitante')) {
      return NextResponse.json({ error: 'Esse horário já foi reservado. Escolha outro.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao agendar. Tente novamente.' }, { status: 500 })
  }

  const { data: ag, error } = await admin
    .from('agendamentos')
    .select('*, servicos(*), clientes(id, nome, telefone), profissionais(*)')
    .eq('id', (agendamentoCriado as unknown as { id: string }).id)
    .single()

  if (error || !ag) {
    return NextResponse.json({ error: 'Erro ao agendar. Tente novamente.' }, { status: 500 })
  }

  return NextResponse.json({ agendamento: ag })
}
