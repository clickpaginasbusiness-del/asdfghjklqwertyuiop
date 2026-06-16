import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function sanitizeSlug(raw: string): string {
  return String(raw).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 50)
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { userId, nome, email, slug } = body as {
    userId?: string
    nome?: string
    email?: string
    slug?: string
  }

  if (!userId || !nome || !email || !slug) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const nomeLimpo = String(nome).trim().slice(0, 100)
  const emailLimpo = String(email).trim().toLowerCase().slice(0, 200)
  const slugLimpo = sanitizeSlug(String(slug))

  if (nomeLimpo.length < 2) {
    return NextResponse.json({ error: 'Nome muito curto' }, { status: 400 })
  }
  if (slugLimpo.length < 3) {
    return NextResponse.json({ error: 'Link muito curto (mínimo 3 caracteres)' }, { status: 400 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailLimpo)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  // Verify the userId actually belongs to this email — prevents using another user's ID
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(String(userId))
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 400 })
  }
  if (authData.user.email?.toLowerCase() !== emailLimpo) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('prestadoras').insert({
    user_id: String(userId),
    nome: nomeLimpo,
    email: emailLimpo,
    slug: slugLimpo,
  })

  if (error) {
    const mensagem = error.code === '23505'
      ? 'Esse link já está em uso. Escolha outro.'
      : error.message
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
