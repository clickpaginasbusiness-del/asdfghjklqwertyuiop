import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { solicitarSaque } from '@/lib/parceiras'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: { valor?: number; pixChave?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const valor = Number(body.valor)
  const pixChave = (body.pixChave ?? '').trim()

  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 })
  }
  if (pixChave.length < 3) {
    return NextResponse.json({ error: 'Informe uma chave Pix válida.' }, { status: 400 })
  }

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, whatsapp, telefone')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })

  const admin = createAdminClient()
  const resultado = await solicitarSaque(
    admin,
    prestadora.id,
    valor,
    pixChave,
    prestadora.whatsapp ?? prestadora.telefone ?? null
  )

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, mensagem: 'Seu saque será processado em até 7 dias úteis.' })
}
