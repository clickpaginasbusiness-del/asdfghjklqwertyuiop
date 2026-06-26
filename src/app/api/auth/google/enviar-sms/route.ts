import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarCodigoVerificacao } from '@/lib/twilioVerify'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  let body: { telefone?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const telefone = String(body.telefone ?? '').trim()
  if (!telefone || !/^\+55\d{10,11}$/.test(telefone)) {
    return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verifica se o telefone já está vinculado a outra prestadora
  const { data: existing } = await admin
    .from('prestadoras')
    .select('id')
    .eq('telefone', telefone)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Este número já está vinculado a outra conta.' }, { status: 409 })
  }

  try {
    await enviarCodigoVerificacao(telefone)
  } catch (err) {
    console.error('[google/enviar-sms]', err)
    return NextResponse.json({ error: 'Falha ao enviar SMS' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
