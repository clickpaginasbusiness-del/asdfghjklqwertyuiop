import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Registra um envio de WhatsApp (lembrete ou confirmação) pra contar nas
 * missões 'lembretes'/'confirmacoes'. Chamada no clique dos botões de
 * WhatsApp nos painéis — não bloqueia a navegação pro wa.me, é só um
 * registro auxiliar (se falhar, o envio em si não é afetado).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: { tipo?: string; clienteId?: string; agendamentoId?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { tipo, clienteId, agendamentoId } = body
  if (tipo !== 'lembrete' && tipo !== 'confirmacao') {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }
  if (!clienteId) {
    return NextResponse.json({ error: 'clienteId obrigatório' }, { status: 400 })
  }

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })

  const admin = createAdminClient()
  const { error } = await admin.from('missoes_eventos').insert({
    prestadora_id: prestadora.id,
    tipo,
    cliente_id: clienteId,
    agendamento_id: agendamentoId ?? null,
  })

  if (error) {
    console.error('[missoes/evento] erro ao registrar evento', error)
    return NextResponse.json({ error: 'Erro ao registrar evento.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
