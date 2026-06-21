import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyVerificationToken, signClientToken } from '@/lib/clientAuth'
import { hashSenha } from '@/lib/passwordHash'

export async function POST(request: NextRequest) {
  let body: { verificationToken?: string; novaSenha?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const session = verifyVerificationToken(body.verificationToken)
  if (!session || session.finalidade !== 'recuperacao') {
    return NextResponse.json({ error: 'Verificação inválida ou expirada.' }, { status: 401 })
  }

  const novaSenha = body.novaSenha ?? ''
  if (novaSenha.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()

  const { data: cliente } = await supabaseAdmin
    .from('clientes')
    .select('id, nome, telefone')
    .eq('telefone', session.telefone)
    .maybeSingle()

  if (!cliente) {
    return NextResponse.json({ error: 'Número não encontrado.' }, { status: 404 })
  }

  const senhaHash = await hashSenha(novaSenha)
  await supabaseAdmin.from('clientes').update({ senha_hash: senhaHash }).eq('id', cliente.id)

  const token = signClientToken({ clienteId: cliente.id, telefone: cliente.telefone })

  return NextResponse.json({ token, cliente })
}
