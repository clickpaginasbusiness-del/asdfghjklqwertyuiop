import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let body: { nota?: number; comentario?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const nota = Number(body.nota)
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    return NextResponse.json({ error: 'Nota inválida' }, { status: 400 })
  }
  const comentario = body.comentario?.trim().slice(0, 1000) || null

  // Nome e email vêm da própria conta autenticada, não do corpo da
  // requisição — evita que o client mande valores falsos para o registro.
  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('id, nome, email')
    .eq('user_id', user.id)
    .single()

  if (!prestadora) {
    return NextResponse.json({ error: 'Prestadora não encontrada' }, { status: 404 })
  }

  const { error } = await supabase.from('feedbacks_prestadora').insert({
    prestadora_id: prestadora.id,
    nome_prestadora: prestadora.nome,
    email_prestadora: prestadora.email,
    nota,
    comentario,
  })

  if (error) {
    console.error('[feedback] erro ao salvar:', error.message)
    return NextResponse.json({ error: 'Erro ao enviar feedback' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
