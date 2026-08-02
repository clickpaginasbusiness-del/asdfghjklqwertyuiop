import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { codigo } = await request.json()
  const code = (codigo ?? '').trim().toUpperCase()

  if (!code) {
    return NextResponse.json({ error: 'Informe o código do cupom' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: cupom } = await admin
    .from('cupons')
    .select('percentual, valor_fixo, ativo, expira_em, max_usos, usos')
    .eq('codigo', code)
    .maybeSingle()

  const valido = cupom && cupom.ativo
    && (!cupom.expira_em || new Date(cupom.expira_em) > new Date())
    && (cupom.max_usos == null || cupom.usos < cupom.max_usos)

  if (!valido) {
    return NextResponse.json({ error: 'Cupom inválido ou expirado' }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    percent_off: cupom.percentual,
    amount_off: cupom.valor_fixo != null ? Math.round(cupom.valor_fixo * 100) : null,
  })
}
