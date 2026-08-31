import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanTelefone } from '@/lib/utils'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!prestadora) return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })

  let body: { nome?: string; telefone?: string; data_nascimento?: string | null }
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
  const dataNascimento = body.data_nascimento || null

  const admin = createAdminClient()

  // Se já existe uma cliente com esse telefone (conta real ou outra manual),
  // reaproveita em vez de tentar criar duplicata — a UNIQUE em telefone
  // rejeitaria o insert de qualquer forma. Não sobrescreve nome/cliente_manual
  // dela: se já é uma conta real, continua sendo.
  type ClienteBase = { id: string; nome: string; telefone: string | null; cliente_manual: boolean; verificado_em: string | null; created_at: string }
  let clienteBase: ClienteBase | undefined

  if (telefone) {
    const { data: existente } = await admin
      .from('clientes')
      .select('id, nome, telefone, cliente_manual, verificado_em, created_at')
      .eq('telefone', telefone)
      .maybeSingle()
    if (existente) clienteBase = existente
  }

  if (!clienteBase) {
    const { data: cliente, error } = await admin
      .from('clientes')
      .insert({ nome, telefone, cliente_manual: true })
      .select('id, nome, telefone, cliente_manual, verificado_em, created_at')
      .single()

    if (error || !cliente) {
      return NextResponse.json({ error: 'Erro ao criar cliente.' }, { status: 500 })
    }
    clienteBase = cliente
  }

  const clienteId = clienteBase.id

  // data_nascimento é anotação da PRESTADORA, não da cliente global — mesmo
  // reaproveitando uma cliente já cadastrada por outra prestadora, o que essa
  // prestadora informar aqui vira a ficha DELA, sem tocar na de mais ninguém.
  if (dataNascimento) {
    await admin
      .from('clientes_prestadora_dados')
      .upsert({ cliente_id: clienteId, prestadora_id: prestadora.id, data_nascimento: dataNascimento }, { onConflict: 'cliente_id,prestadora_id' })
  }

  const { data: dadosPrestadora } = await admin
    .from('clientes_prestadora_dados')
    .select('notas, data_nascimento')
    .eq('cliente_id', clienteId)
    .eq('prestadora_id', prestadora.id)
    .maybeSingle()

  return NextResponse.json({
    cliente: {
      ...clienteBase,
      notas: dadosPrestadora?.notas ?? null,
      data_nascimento: dadosPrestadora?.data_nascimento ?? null,
    },
  })
}
