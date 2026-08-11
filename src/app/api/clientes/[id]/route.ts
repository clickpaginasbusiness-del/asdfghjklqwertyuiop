import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanTelefone } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'

type Admin = SupabaseClient

// Confirma que a cliente pertence a essa prestadora (tem pelo menos um
// agendamento com ela) — evita que uma prestadora mexa em cliente de outra.
// Usado tanto pra notas (qualquer cliente) quanto, com o filtro extra de
// cliente_manual, pra editar nome/telefone e excluir (só clientes manuais).
async function clienteDaPrestadora(
  admin: Admin, clienteId: string, prestadoraId: string
): Promise<{ id: string; cliente_manual: boolean } | null> {
  const [{ data: cliente }, { data: agendamento }] = await Promise.all([
    admin.from('clientes').select('id, cliente_manual').eq('id', clienteId).maybeSingle(),
    admin.from('agendamentos').select('id').eq('cliente_id', clienteId).eq('prestadora_id', prestadoraId).limit(1).maybeSingle(),
  ])
  if (!cliente || !agendamento) return null
  return cliente
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
  const cliente = await clienteDaPrestadora(admin, id, prestadora.id)
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrada.' }, { status: 404 })

  let body: { nome?: string; telefone?: string; data_nascimento?: string | null; notas?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  // Nome/telefone fazem parte da identidade do cadastro manual — só
  // editáveis pra clientes criadas manualmente pela prestadora, nunca pra
  // contas reais (cliente_manual = false) que a própria cliente controla
  // via o cadastro dela na página pública.
  if (body.nome !== undefined || body.telefone !== undefined) {
    if (!cliente.cliente_manual) {
      return NextResponse.json({ error: 'Só é possível editar nome e telefone de clientes manuais.' }, { status: 403 })
    }
    if (body.nome !== undefined) {
      const nome = body.nome.trim()
      if (nome.length < 2) return NextResponse.json({ error: 'Informe o nome da cliente.' }, { status: 400 })
      updates.nome = nome
    }
    if (body.telefone !== undefined) {
      const telefoneLimpo = body.telefone ? cleanTelefone(body.telefone) : ''
      updates.telefone = telefoneLimpo.length > 0 ? telefoneLimpo : null
    }
  }

  // Data de nascimento e notas: qualquer cliente com histórico com essa
  // prestadora, manual ou não — são anotações/dados de acompanhamento da
  // prestadora sobre a cliente, não identidade que a cliente controla.
  if (body.data_nascimento !== undefined) {
    updates.data_nascimento = body.data_nascimento || null
  }
  if (body.notas !== undefined) {
    updates.notas = body.notas?.trim() || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('clientes')
    .update(updates)
    .eq('id', id)
    .select('id, nome, telefone, cliente_manual, verificado_em, data_nascimento, notas, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Já existe uma cliente com esse telefone.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao editar cliente.' }, { status: 500 })
  }

  return NextResponse.json({ cliente: data })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const prestadora = await autenticarPrestadora()
  if (!prestadora) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const cliente = await clienteDaPrestadora(admin, id, prestadora.id)
  if (!cliente?.cliente_manual) return NextResponse.json({ error: 'Cliente não encontrada ou não editável.' }, { status: 404 })

  // cliente_id em agendamentos é ON DELETE CASCADE — excluir a cliente
  // também exclui o histórico de agendamentos dela. O front avisa isso antes
  // de confirmar.
  const { error } = await admin.from('clientes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Erro ao excluir cliente.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
