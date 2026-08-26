import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ajustarCreditoServico } from '@/lib/planosPrestadora'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: assinaturaId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: prestadora } = await supabase.from('prestadoras').select('id').eq('user_id', user.id).single()
  if (!prestadora) return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })

  let body: { servicoId?: string | null; novoValor?: number; descricao?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  if (typeof body.novoValor !== 'number' || body.novoValor < 0 || !Number.isInteger(body.novoValor)) {
    return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: assinatura } = await admin
    .from('planos_assinaturas')
    .select('id, prestadora_id, plano_id')
    .eq('id', assinaturaId)
    .maybeSingle()

  if (!assinatura || assinatura.prestadora_id !== prestadora.id) {
    return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })
  }

  const servicoId = body.servicoId ?? null
  if (servicoId) {
    const { data: servicoNoPlano } = await admin
      .from('planos_servicos')
      .select('id')
      .eq('plano_id', assinatura.plano_id)
      .eq('servico_id', servicoId)
      .maybeSingle()
    if (!servicoNoPlano) return NextResponse.json({ error: 'Serviço não faz parte deste plano' }, { status: 400 })
  }

  const resultado = await ajustarCreditoServico(admin, {
    assinaturaId, servicoId, novoValor: body.novoValor, descricao: body.descricao?.trim() || undefined,
  })
  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: 400 })

  return NextResponse.json({ ok: true })
}
