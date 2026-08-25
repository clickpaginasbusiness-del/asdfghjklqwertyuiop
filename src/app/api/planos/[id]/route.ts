import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type ServicoIncluido = { servicoId: string; quantidade: number }

type Body = {
  nome?: string
  descricao?: string | null
  preco?: number
  intervalo?: 'mensal' | 'bimensal' | 'trimestral' | 'semestral' | 'anual'
  descontoTipo?: 'percentual' | 'fixo'
  descontoValor?: number
  creditosAcumulam?: boolean
  limiteVagas?: number | null
  ativo?: boolean
  servicos?: ServicoIncluido[]
}

async function getPrestadoraDoPlano(supabase: Awaited<ReturnType<typeof createClient>>, planoId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: prestadora } = await supabase.from('prestadoras').select('id').eq('user_id', user.id).single()
  if (!prestadora) return null

  const { data: plano } = await supabase
    .from('planos_prestadora')
    .select('id, prestadora_id, preco, intervalo')
    .eq('id', planoId)
    .maybeSingle()
  if (!plano || plano.prestadora_id !== prestadora.id) return null

  return { prestadora, plano }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const contexto = await getPrestadoraDoPlano(supabase, id)
  if (!contexto) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  const { plano: planoAtual } = contexto

  let body: Body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body.nome !== undefined) patch.nome = body.nome.trim()
  if (body.descricao !== undefined) patch.descricao = body.descricao?.trim() || null
  if (body.preco !== undefined) patch.preco = body.preco
  if (body.intervalo !== undefined) patch.intervalo = body.intervalo
  if (body.descontoTipo !== undefined) patch.desconto_tipo = body.descontoTipo
  if (body.descontoValor !== undefined) patch.desconto_valor = body.descontoValor
  if (body.creditosAcumulam !== undefined) patch.creditos_acumulam = body.creditosAcumulam
  if (body.limiteVagas !== undefined) patch.limite_vagas = body.limiteVagas
  if (body.ativo !== undefined) patch.ativo = body.ativo

  // O preapproval_plan do Mercado Pago trava transaction_amount/frequency no
  // momento da criação — se preço ou intervalo mudam aqui, o id cacheado em
  // mp_preapproval_plan_id fica apontando pro plano com os termos antigos, e
  // getOrCreatePreapprovalPlanoCliente (src/lib/mercadopago.ts) só recria
  // quando esse campo está nulo. Invalida o cache pra próxima assinatura no
  // cartão recriar o plano no MP com os termos atuais — assinantes que já
  // têm preapproval ativo não são afetadas, cada uma já travou seu próprio
  // valor no momento em que assinou.
  const mudouTermos =
    (body.preco !== undefined && body.preco !== planoAtual.preco) ||
    (body.intervalo !== undefined && body.intervalo !== planoAtual.intervalo)
  if (mudouTermos) patch.mp_preapproval_plan_id = null

  const { error } = await supabase.from('planos_prestadora').update(patch).eq('id', id)
  if (error) {
    console.error('[planos/id] erro ao atualizar', error)
    return NextResponse.json({ error: 'Erro ao atualizar plano' }, { status: 500 })
  }

  if (body.servicos) {
    const servicos = body.servicos.filter((s) => s.servicoId && s.quantidade > 0)
    await supabase.from('planos_servicos').delete().eq('plano_id', id)
    if (servicos.length > 0) {
      await supabase.from('planos_servicos').insert(
        servicos.map((s) => ({ plano_id: id, servico_id: s.servicoId, quantidade: s.quantidade }))
      )
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const contexto = await getPrestadoraDoPlano(supabase, id)
  if (!contexto) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { count } = await supabase
    .from('planos_assinaturas')
    .select('id', { count: 'exact', head: true })
    .eq('plano_id', id)
    .eq('status', 'ativa')

  if (count && count > 0) {
    return NextResponse.json({
      error: 'Esse plano tem assinantes ativas. Desative-o em vez de excluir, ou cancele as assinaturas primeiro.',
    }, { status: 409 })
  }

  const { error } = await supabase.from('planos_prestadora').delete().eq('id', id)
  if (error) {
    console.error('[planos/id] erro ao excluir', error)
    return NextResponse.json({ error: 'Erro ao excluir plano' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
