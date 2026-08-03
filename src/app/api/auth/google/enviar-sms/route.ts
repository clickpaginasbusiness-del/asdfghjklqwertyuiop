import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarCodigoVerificacao } from '@/lib/twilioVerify'
import { telefoneLocal } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

const UMA_HORA_MS = 60 * 60 * 1000
const MAX_TENTATIVAS_POR_HORA = 3

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

  // Mesmo limite de /api/clientes/auth/enviar-codigo (3/hora por telefone) —
  // sem isso, uma sessão Google autenticada (grátis/trivial de conseguir)
  // conseguia mandar SMS via Twilio pra qualquer número, sem nenhum limite.
  const digitsLocal = telefoneLocal(telefone)
  const desde = new Date(Date.now() - UMA_HORA_MS).toISOString()
  const { count } = await admin
    .from('otp_tentativas')
    .select('id', { count: 'exact', head: true })
    .eq('telefone', digitsLocal)
    .gte('created_at', desde)

  if ((count ?? 0) >= MAX_TENTATIVAS_POR_HORA) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em 1 hora.' },
      { status: 429 }
    )
  }

  await admin.from('otp_tentativas').insert({ telefone: digitsLocal })

  try {
    await enviarCodigoVerificacao(telefone)
  } catch {
    // Não loga o erro completo: a resposta de erro do Twilio costuma incluir
    // o próprio número de telefone (campo "To"), então logar `err` aqui
    // vazaria o telefone do usuário nos logs do servidor.
    console.error('[google/enviar-sms] erro ao enviar SMS')
    return NextResponse.json({ error: 'Falha ao enviar SMS' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
