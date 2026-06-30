import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyVerificationToken, signClientToken } from '@/lib/clientAuth'
import { hashSenha } from '@/lib/passwordHash'

export async function POST(request: NextRequest) {
  let body: { verificationToken?: string; nome?: string; senha?: string; email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const session = verifyVerificationToken(body.verificationToken)
  if (!session || session.finalidade !== 'cadastro') {
    return NextResponse.json({ error: 'Verificação inválida ou expirada.' }, { status: 401 })
  }

  const nome = (body.nome ?? '').trim()
  const senha = body.senha ?? ''
  const email = (body.email ?? '').trim() || null
  if (nome.length < 2) {
    return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 })
  }
  if (senha.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()
  const senhaHash = await hashSenha(senha)

  const { data: clienteExistente } = await supabaseAdmin
    .from('clientes')
    .select('id')
    .eq('telefone', session.telefone)
    .maybeSingle()

  let cliente: { id: string; nome: string; telefone: string } | null = null

  if (clienteExistente) {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .update({ nome, senha_hash: senhaHash, verificado_em: new Date().toISOString(), ...(email ? { email } : {}) })
      .eq('id', clienteExistente.id)
      .select('id, nome, telefone')
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'Erro ao concluir cadastro.' }, { status: 500 })
    }
    cliente = data
  } else {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .insert({
        nome,
        telefone: session.telefone,
        senha_hash: senhaHash,
        verificado_em: new Date().toISOString(),
        ...(email ? { email } : {}),
      })
      .select('id, nome, telefone')
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'Erro ao criar cadastro.' }, { status: 500 })
    }
    cliente = data
  }

  const token = signClientToken({ clienteId: cliente.id, telefone: cliente.telefone })

  return NextResponse.json({ token, cliente })
}
