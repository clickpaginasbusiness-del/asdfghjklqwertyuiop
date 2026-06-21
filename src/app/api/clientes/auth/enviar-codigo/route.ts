import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarCodigoVerificacao } from '@/lib/twilioVerify'
import { cleanTelefone, toE164 } from '@/lib/utils'

const UMA_HORA_MS = 60 * 60 * 1000
const MAX_TENTATIVAS_POR_HORA = 3

export async function POST(request: NextRequest) {
  let body: { telefone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const digits = cleanTelefone(body.telefone ?? '')
  if (digits.length < 10 || digits.length > 11) {
    return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()

  const desde = new Date(Date.now() - UMA_HORA_MS).toISOString()
  const { count } = await supabaseAdmin
    .from('otp_tentativas')
    .select('id', { count: 'exact', head: true })
    .eq('telefone', digits)
    .gte('created_at', desde)

  if ((count ?? 0) >= MAX_TENTATIVAS_POR_HORA) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em 1 hora.' },
      { status: 429 }
    )
  }

  await supabaseAdmin.from('otp_tentativas').insert({ telefone: digits })

  try {
    await enviarCodigoVerificacao(toE164(digits))
  } catch (err) {
    console.error('[clientes/auth/enviar-codigo] erro Twilio:', err)
    return NextResponse.json(
      { error: 'Não foi possível enviar o código. Tente novamente.' },
      { status: 500 }
    )
  }

  const { data: clienteExistente } = await supabaseAdmin
    .from('clientes')
    .select('id')
    .eq('telefone', digits)
    .maybeSingle()

  return NextResponse.json({ ok: true, clienteExistente: !!clienteExistente })
}
