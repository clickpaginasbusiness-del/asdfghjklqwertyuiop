import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCreditosPorServico } from '@/lib/planosPrestadora'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: planoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: prestadora } = await supabase.from('prestadoras').select('id').eq('user_id', user.id).single()
  if (!prestadora) return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })

  const { data: plano } = await supabase.from('planos_prestadora').select('id, prestadora_id').eq('id', planoId).maybeSingle()
  if (!plano || plano.prestadora_id !== prestadora.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { data: assinaturas } = await supabase
    .from('planos_assinaturas')
    .select('*, clientes(nome, telefone)')
    .eq('plano_id', planoId)
    .order('created_at', { ascending: false })

  // Detalhamento por serviço (getCreditosPorServico usa admin porque cruza
  // planos_servicos/planos_usos, fora do escopo de RLS da sessão da prestadora).
  const admin = createAdminClient()
  const assinaturasComCreditos = await Promise.all(
    (assinaturas ?? []).map(async (a) => ({
      ...a,
      creditosPorServico: await getCreditosPorServico(admin, a.id),
    }))
  )

  return NextResponse.json({ assinaturas: assinaturasComCreditos })
}
