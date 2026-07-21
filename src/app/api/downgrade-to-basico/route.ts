import { createClient } from '@/lib/supabase/server'
import { aplicarDowngradeParaBasico } from '@/lib/downgrade'
import { NextResponse } from 'next/server'

/**
 * Aplica de uma vez só as restrições do Plano Básico na conta autenticada
 * (desativa profissionais extras, limpa avaliações em destaque, reseta cor do
 * tema). Não mexe em cobrança/Stripe — isso é feito por quem chama.
 * Usado pelo webhook do Stripe e pela expiração do trial Pro; existe como rota
 * própria pra permitir reaplicar manualmente se precisar.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) {
    return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })
  }

  await aplicarDowngradeParaBasico(supabase, prestadora.id)

  const { error } = await supabase
    .from('prestadoras')
    .update({ plano: 'basico', downgrade_aviso: true })
    .eq('id', prestadora.id)

  if (error) {
    console.error('[downgrade-to-basico] erro ao aplicar downgrade', error)
    return NextResponse.json({ error: 'Erro ao aplicar downgrade' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
