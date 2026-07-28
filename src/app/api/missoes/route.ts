import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMissoesDoMes } from '@/lib/missoes'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, plano')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })

  const admin = createAdminClient()
  const plano = prestadora.plano === 'pro' ? 'pro' : 'basico'

  try {
    const resultado = await getMissoesDoMes(admin, prestadora.id, plano)
    return NextResponse.json(resultado)
  } catch (err) {
    console.error('[missoes] erro ao buscar missões do mês', err)
    return NextResponse.json({ error: 'Erro ao buscar missões.' }, { status: 500 })
  }
}
