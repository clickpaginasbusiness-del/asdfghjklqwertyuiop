import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: cupons, error } = await admin
    .from('cupons')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/cupons] erro ao listar cupons', error)
    return NextResponse.json({ error: 'Erro ao listar cupons' }, { status: 500 })
  }

  return NextResponse.json({ cupons })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  let body: {
    codigo?: string
    tipo?: 'percentual' | 'fixo'
    valor?: number
    maxUsos?: number | null
    expiraEm?: string | null
    duracaoTipo?: 'primeira' | 'meses' | 'vitalicio'
    duracaoMeses?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const codigo = (body.codigo ?? '').trim().toUpperCase()
  const tipo = body.tipo
  const valor = Number(body.valor)

  if (!codigo) {
    return NextResponse.json({ error: 'Informe o código do cupom' }, { status: 400 })
  }
  if (tipo !== 'percentual' && tipo !== 'fixo') {
    return NextResponse.json({ error: 'Tipo de desconto inválido' }, { status: 400 })
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: 'Informe um valor de desconto válido' }, { status: 400 })
  }
  if (tipo === 'percentual' && valor > 100) {
    return NextResponse.json({ error: 'Desconto percentual não pode passar de 100%' }, { status: 400 })
  }

  const maxUsos = body.maxUsos != null && Number.isFinite(Number(body.maxUsos)) && Number(body.maxUsos) > 0
    ? Math.trunc(Number(body.maxUsos))
    : null
  const expiraEm = body.expiraEm ? new Date(body.expiraEm).toISOString() : null

  const duracaoTipo = body.duracaoTipo ?? 'primeira'
  let duracaoCobracas: number | null
  if (duracaoTipo === 'vitalicio') {
    duracaoCobracas = null
  } else if (duracaoTipo === 'meses') {
    const meses = Number(body.duracaoMeses)
    if (!Number.isFinite(meses) || meses <= 0) {
      return NextResponse.json({ error: 'Informe uma duração em meses válida' }, { status: 400 })
    }
    duracaoCobracas = Math.trunc(meses)
  } else {
    duracaoCobracas = 1
  }

  const admin = createAdminClient()
  const { data: cupom, error } = await admin
    .from('cupons')
    .insert({
      codigo,
      percentual: tipo === 'percentual' ? valor : null,
      valor_fixo: tipo === 'fixo' ? valor : null,
      max_usos: maxUsos,
      expira_em: expiraEm,
      duracao_cobracas: duracaoCobracas,
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Já existe um cupom com esse código' }, { status: 409 })
    }
    console.error('[admin/cupons] erro ao criar cupom', error)
    return NextResponse.json({ error: 'Erro ao criar cupom' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, cupom })
}
