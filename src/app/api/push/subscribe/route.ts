import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { subscription } = body as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  }

  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: 'Inscrição inválida' }, { status: 400 })
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

  // O token do FCM/push rotaciona periodicamente — quando isso acontece, o
  // navegador gera um endpoint novo para o mesmo dispositivo. Sem essa
  // limpeza, a inscrição antiga (do mesmo aparelho) fica esquecida na tabela
  // e cada notificação passa a ser enviada duas vezes para o mesmo celular.
  if (userAgent) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('prestadora_id', prestadora.id)
      .eq('user_agent', userAgent)
      .neq('endpoint', subscription.endpoint)
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    prestadora_id: prestadora.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    user_agent: userAgent,
  }, { onConflict: 'endpoint' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
