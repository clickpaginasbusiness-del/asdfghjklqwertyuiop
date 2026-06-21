import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanTelefone } from '@/lib/utils'
import { signClientToken } from '@/lib/clientAuth'
import { compararSenha } from '@/lib/passwordHash'

const UMA_HORA_MS = 60 * 60 * 1000
const MAX_TENTATIVAS_POR_HORA = 5

export async function POST(request: NextRequest) {
  let body: { telefone?: string; senha?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const digits = cleanTelefone(body.telefone ?? '')
  const senha = body.senha ?? ''
  if (digits.length < 10 || digits.length > 11 || !senha) {
    return NextResponse.json({ error: 'Telefone ou senha inválidos.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()

  const desde = new Date(Date.now() - UMA_HORA_MS).toISOString()
  const { count } = await supabaseAdmin
    .from('login_tentativas')
    .select('id', { count: 'exact', head: true })
    .eq('telefone', digits)
    .gte('created_at', desde)

  if ((count ?? 0) >= MAX_TENTATIVAS_POR_HORA) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em 1 hora.' },
      { status: 429 }
    )
  }

  await supabaseAdmin.from('login_tentativas').insert({ telefone: digits })

  const { data: cliente } = await supabaseAdmin
    .from('clientes')
    .select('id, nome, telefone, senha_hash')
    .eq('telefone', digits)
    .maybeSingle()

  if (!cliente) {
    return NextResponse.json({ error: 'Telefone ou senha inválidos.' }, { status: 401 })
  }

  if (!cliente.senha_hash) {
    return NextResponse.json(
      { error: 'Esta conta ainda não tem senha. Use "Esqueci minha senha" para criar uma.', semSenha: true },
      { status: 400 }
    )
  }

  const senhaValida = await compararSenha(senha, cliente.senha_hash)
  if (!senhaValida) {
    return NextResponse.json({ error: 'Telefone ou senha inválidos.' }, { status: 401 })
  }

  const token = signClientToken({ clienteId: cliente.id, telefone: cliente.telefone })

  return NextResponse.json({
    token,
    cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone },
  })
}
