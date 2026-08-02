import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { darDiasGratis } from '@/lib/mercadopago'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { prestadora_id } = await request.json() as { prestadora_id?: string }
  if (!prestadora_id) return NextResponse.json({ error: 'prestadora_id obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data: p } = await admin
    .from('prestadoras')
    .select('id')
    .eq('id', prestadora_id)
    .single()

  if (!p) return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })

  try {
    await darDiasGratis(admin, prestadora_id, 30, 'admin_mes_gratis')
  } catch (err) {
    console.error('[admin/dar-mes-gratis]', err)
    return NextResponse.json({ error: 'Erro ao processar benefício' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
