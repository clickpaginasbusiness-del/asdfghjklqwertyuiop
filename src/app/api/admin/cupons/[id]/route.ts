import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { id } = await params

  let body: { ativo?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (typeof body.ativo !== 'boolean') {
    return NextResponse.json({ error: 'Campo "ativo" obrigatório' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: cupom, error } = await admin
    .from('cupons')
    .update({ ativo: body.ativo })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('[admin/cupons] erro ao atualizar cupom', id, error)
    return NextResponse.json({ error: 'Erro ao atualizar cupom' }, { status: 500 })
  }
  if (!cupom) {
    return NextResponse.json({ error: 'Cupom não encontrado' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, cupom })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { id } = await params
  const admin = createAdminClient()

  const { error } = await admin.from('cupons').delete().eq('id', id)

  if (error) {
    console.error('[admin/cupons] erro ao excluir cupom', id, error)
    return NextResponse.json({ error: 'Erro ao excluir cupom' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
