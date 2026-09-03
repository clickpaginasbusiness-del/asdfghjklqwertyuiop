import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// Sem exigência de login de propósito: é usada pela landing page (visitante
// anônimo, antes de criar conta) além do checkout de quem já é prestadora.
// Só confirma se um código existe/está ativo e devolve o desconto — sem PII,
// sem efeito colateral. Quem de fato consome o cupom (incrementa `usos`) é
// /api/mp/checkout, que exige login e faz isso com compare-and-swap. Abuso
// por tentativa (força bruta de código) já é coberto pelo rate limit por IP
// dessa rota em proxy.ts, independente de autenticação.
export async function POST(request: NextRequest) {
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
