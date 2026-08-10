import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyClientToken } from '@/lib/clientAuth'
import { preApproval } from '@/lib/mercadopago'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Cancela uma assinatura de plano de cliente — chamado tanto pela cliente
 * ("Meus planos" na página pública, autenticação por token próprio) quanto
 * pela prestadora (Relatórios > Planos, sessão do Supabase). Confere que
 * quem está pedindo é dona da assinatura de um jeito ou de outro.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: assinaturaId } = await params
  const admin = createAdminClient()

  const { data: assinatura } = await admin
    .from('planos_assinaturas')
    .select('id, cliente_id, prestadora_id, mp_subscription_id, status')
    .eq('id', assinaturaId)
    .maybeSingle()

  if (!assinatura) return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })

  let body: { token?: string } = {}
  try { body = await request.json() } catch { /* corpo vazio é válido (cancelamento pela prestadora) */ }

  let autorizado = false

  if (body.token) {
    const session = verifyClientToken(body.token)
    autorizado = !!session && session.clienteId === assinatura.cliente_id
  }

  if (!autorizado) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: prestadora } = await supabase.from('prestadoras').select('id').eq('user_id', user.id).single()
      autorizado = prestadora?.id === assinatura.prestadora_id
    }
  }

  if (!autorizado) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  if (assinatura.mp_subscription_id) {
    try {
      await preApproval.update({ id: assinatura.mp_subscription_id, body: { status: 'cancelled' } })
    } catch (err) {
      console.error('[planos/cancelar] falha ao cancelar preapproval no MP', assinaturaId, err)
    }
  }

  const { error } = await admin
    .from('planos_assinaturas')
    .update({ status: 'cancelada', cancelado_em: new Date().toISOString() })
    .eq('id', assinaturaId)

  if (error) return NextResponse.json({ error: 'Erro ao cancelar assinatura' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
