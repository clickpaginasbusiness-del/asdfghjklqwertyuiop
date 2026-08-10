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
  servicos?: ServicoIncluido[]
}

const INTERVALOS_VALIDOS = new Set(['mensal', 'bimensal', 'trimestral', 'semestral', 'anual'])

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: prestadora } = await supabase.from('prestadoras').select('id').eq('user_id', user.id).single()
  if (!prestadora) return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })

  const { data: planos } = await supabase
    .from('planos_prestadora')
    .select('*, planos_servicos(id, servico_id, quantidade, servicos(nome)), planos_assinaturas(id, status)')
    .eq('prestadora_id', prestadora.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ planos: planos ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: prestadora } = await supabase.from('prestadoras').select('id').eq('user_id', user.id).single()
  if (!prestadora) return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })

  let body: Body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const nome = body.nome?.trim()
  if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  if (!body.preco || body.preco <= 0) return NextResponse.json({ error: 'Preço inválido' }, { status: 400 })
  if (!body.intervalo || !INTERVALOS_VALIDOS.has(body.intervalo)) {
    return NextResponse.json({ error: 'Intervalo inválido' }, { status: 400 })
  }

  const { data: plano, error } = await supabase
    .from('planos_prestadora')
    .insert({
      prestadora_id: prestadora.id,
      nome,
      descricao: body.descricao?.trim() || null,
      preco: body.preco,
      intervalo: body.intervalo,
      desconto_tipo: body.descontoTipo ?? 'percentual',
      desconto_valor: body.descontoValor ?? 0,
      creditos_acumulam: body.creditosAcumulam ?? false,
      limite_vagas: body.limiteVagas ?? null,
    })
    .select()
    .single()

  if (error || !plano) {
    console.error('[planos] erro ao criar plano', error)
    return NextResponse.json({ error: 'Erro ao criar plano' }, { status: 500 })
  }

  const servicos = (body.servicos ?? []).filter((s) => s.servicoId && s.quantidade > 0)
  if (servicos.length > 0) {
    await supabase.from('planos_servicos').insert(
      servicos.map((s) => ({ plano_id: plano.id, servico_id: s.servicoId, quantidade: s.quantidade }))
    )
  }

  return NextResponse.json({ plano })
}
