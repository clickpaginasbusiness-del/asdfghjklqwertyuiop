import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { token } = body as { token?: string }
  if (!token) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) {
    return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })
  }

  const userAgent = request.headers.get('user-agent')

  // Mesmo raciocínio do dedup em push_subscriptions: o token do FCM rotaciona
  // periodicamente — sem essa limpeza, o token antigo do mesmo aparelho fica
  // esquecido na tabela e cada notificação é enviada duas vezes pro mesmo celular.
  if (userAgent) {
    await supabase
      .from('fcm_tokens')
      .delete()
      .eq('prestadora_id', prestadora.id)
      .eq('user_agent', userAgent)
      .neq('token', token)
  }

  const { error } = await supabase.from('fcm_tokens').upsert({
    prestadora_id: prestadora.id,
    token,
    user_agent: userAgent,
  }, { onConflict: 'token' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
