import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyClientToken } from '@/lib/clientAuth'

export async function POST(request: NextRequest) {
  let body: { token?: string; nome?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const session = verifyClientToken(body.token)
  if (!session) {
    return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })
  }

  const nome = (body.nome ?? '').trim()
  if (nome.length < 2) {
    return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()
  const { error } = await supabaseAdmin
    .from('clientes')
    .update({ nome })
    .eq('id', session.clienteId)

  if (error) {
    return NextResponse.json({ error: 'Erro ao atualizar nome.' }, { status: 500 })
  }

  return NextResponse.json({ nome })
}
