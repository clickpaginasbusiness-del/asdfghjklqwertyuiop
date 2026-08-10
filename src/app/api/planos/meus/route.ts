import { createAdminClient } from '@/lib/supabase/admin'
import { verifyClientToken } from '@/lib/clientAuth'
import { NextRequest, NextResponse } from 'next/server'

/** "Meus planos" — assinaturas da cliente logada com a prestadora da página
 * pública atual (não mistura planos de outras prestadoras nessa lista). */
export async function POST(request: NextRequest) {
  let body: { token?: string; prestadoraId?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const session = verifyClientToken(body.token)
  if (!session) return NextResponse.json({ error: 'Faça login.' }, { status: 401 })
  if (!body.prestadoraId) return NextResponse.json({ error: 'prestadoraId obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data: assinaturas } = await admin
    .from('planos_assinaturas')
    .select('*, plano:planos_prestadora(nome, preco, intervalo)')
    .eq('cliente_id', session.clienteId)
    .eq('prestadora_id', body.prestadoraId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ assinaturas: assinaturas ?? [] })
}
