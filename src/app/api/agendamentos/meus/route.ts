import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyClientToken } from '@/lib/clientAuth'

export async function POST(request: NextRequest) {
  let body: { token?: string; prestadoraId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const session = verifyClientToken(body.token)
  if (!session) {
    return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })
  }

  if (!body.prestadoraId) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()
  const { data: agendamentos } = await supabaseAdmin
    .from('agendamentos')
    .select('*, servicos(*), profissionais(*)')
    .eq('cliente_id', session.clienteId)
    .eq('prestadora_id', body.prestadoraId)
    .order('data_hora', { ascending: false })
    .limit(10)

  return NextResponse.json({ agendamentos: agendamentos ?? [] })
}
