import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checarCodigoVerificacao } from '@/lib/twilioVerify'
import { cleanTelefone, toE164 } from '@/lib/utils'
import { signClientToken } from '@/lib/clientAuth'

export async function POST(request: NextRequest) {
  let body: { telefone?: string; codigo?: string; nome?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const digits = cleanTelefone(body.telefone ?? '')
  const codigo = (body.codigo ?? '').trim()
  if (digits.length < 10 || digits.length > 11 || codigo.length < 4) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const aprovado = await checarCodigoVerificacao(toE164(digits), codigo)
  if (!aprovado) {
    return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 401 })
  }

  const supabaseAdmin = createAdminClient()

  const { data: clienteExistente } = await supabaseAdmin
    .from('clientes')
    .select('*')
    .eq('telefone', digits)
    .maybeSingle()

  let cliente = clienteExistente

  if (!cliente) {
    const nome = (body.nome ?? '').trim()
    if (nome.length < 2) {
      return NextResponse.json({ error: 'Nome é obrigatório para novo cadastro.' }, { status: 400 })
    }
    const { data: novoCliente, error } = await supabaseAdmin
      .from('clientes')
      .insert({ nome, telefone: digits, verificado_em: new Date().toISOString() })
      .select()
      .single()
    if (error || !novoCliente) {
      return NextResponse.json({ error: 'Erro ao criar cadastro.' }, { status: 500 })
    }
    cliente = novoCliente
  } else if (!cliente.verificado_em) {
    await supabaseAdmin
      .from('clientes')
      .update({ verificado_em: new Date().toISOString() })
      .eq('id', cliente.id)
  }

  const token = signClientToken({ clienteId: cliente.id, telefone: digits })

  return NextResponse.json({
    token,
    cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone },
  })
}
