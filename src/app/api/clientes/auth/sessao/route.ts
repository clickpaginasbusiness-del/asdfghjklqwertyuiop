import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyClientToken } from '@/lib/clientAuth'

export async function POST(request: NextRequest) {
  let body: { token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Fluxo de retorno do Google OAuth: o token vem num cookie httpOnly de uso
  // único (setado pelo /api/clientes/auth/google/callback) em vez do corpo,
  // já que o client ainda não tem o token salvo em localStorage nesse ponto.
  const cookieToken = request.cookies.get('cliente_google_token')?.value
  const token = body.token ?? cookieToken

  const session = verifyClientToken(token)
  if (!session) {
    return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })
  }

  const supabaseAdmin = createAdminClient()
  const { data: cliente } = await supabaseAdmin
    .from('clientes')
    .select('id, nome, telefone')
    .eq('id', session.clienteId)
    .maybeSingle()

  if (!cliente) {
    return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })
  }

  const res = NextResponse.json({ cliente, token })
  if (cookieToken) res.cookies.delete('cliente_google_token')
  return res
}
