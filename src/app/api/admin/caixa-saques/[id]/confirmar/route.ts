import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { id } = await params
  const admin = createAdminClient()

  const { data: saque, error } = await admin
    .from('caixa_saques')
    .update({ status: 'pago', pago_em: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'solicitado')
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('[admin/caixa-saques/confirmar] erro ao confirmar saque', id, error)
    return NextResponse.json({ error: 'Erro ao confirmar saque.' }, { status: 500 })
  }
  if (!saque) {
    return NextResponse.json({ error: 'Saque não encontrado ou já processado.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, saque })
}
