import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanTelefone } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'

type Admin = SupabaseClient

// Só permite editar/excluir clientes manuais que têm pelo menos um
// agendamento com essa prestadora — evita que uma prestadora mexa numa
// cliente manual de outra, ou numa conta real (cliente_manual = false).
async function clienteManualDaPrestadora(admin: Admin, clienteId: string, prestadoraId: string): Promise<boolean> {
  const [{ data: cliente }, { data: agendamento }] = await Promise.all([
    admin.from('clientes').select('id, cliente_manual').eq('id', clienteId).maybeSingle(),
    admin.from('agendamentos').select('id').eq('cliente_id', clienteId).eq('prestadora_id', prestadoraId).limit(1).maybeSingle(),
  ])
  return Boolean(cliente?.cliente_manual && agendamento)
}

async function autenticarPrestadora() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: prestadora } = await supabase.from('prestadoras').select('id').eq('user_id', user.id).single()
  return prestadora
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const prestadora = await autenticarPrestadora()
  if (!prestadora) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const autorizado = await clienteManualDaPrestadora(admin, id, prestadora.id)
  if (!autorizado) return NextResponse.json({ error: 'Cliente não encontrada ou não editável.' }, { status: 404 })

  let body: { nome?: string; telefone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const nome = (body.nome ?? '').trim()
  if (nome.length < 2) {
    return NextResponse.json({ error: 'Informe o nome da cliente.' }, { status: 400 })
  }
  const telefoneLimpo = body.telefone ? cleanTelefone(body.telefone) : ''
  const telefone = telefoneLimpo.length > 0 ? telefoneLimpo : null

  const { data: cliente, error } = await admin
    .from('clientes')
    .update({ nome, telefone })
    .eq('id', id)
    .select('id, nome, telefone, cliente_manual, verificado_em, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Já existe uma cliente com esse telefone.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao editar cliente.' }, { status: 500 })
  }

  return NextResponse.json({ cliente })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const prestadora = await autenticarPrestadora()
  if (!prestadora) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const autorizado = await clienteManualDaPrestadora(admin, id, prestadora.id)
  if (!autorizado) return NextResponse.json({ error: 'Cliente não encontrada ou não editável.' }, { status: 404 })

  // cliente_id em agendamentos é ON DELETE CASCADE — excluir a cliente
  // também exclui o histórico de agendamentos dela. O front avisa isso antes
  // de confirmar.
  const { error } = await admin.from('clientes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Erro ao excluir cliente.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
