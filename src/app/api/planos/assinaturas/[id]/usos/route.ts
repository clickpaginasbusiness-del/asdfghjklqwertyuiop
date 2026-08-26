import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getHistoricoUsos } from '@/lib/planosPrestadora'
import { NextResponse } from 'next/server'

/** Histórico de uso de créditos de uma assinatura — buscado sob demanda,
 * quando a prestadora abre o detalhe/edição de uma assinante específica na
 * tela de gestão de créditos. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: assinaturaId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: prestadora } = await supabase.from('prestadoras').select('id').eq('user_id', user.id).single()
  if (!prestadora) return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })

  const admin = createAdminClient()
  const { data: assinatura } = await admin
    .from('planos_assinaturas')
    .select('id, prestadora_id')
    .eq('id', assinaturaId)
    .maybeSingle()

  if (!assinatura || assinatura.prestadora_id !== prestadora.id) {
    return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })
  }

  const usos = await getHistoricoUsos(admin, assinaturaId)
  return NextResponse.json({ usos })
}
