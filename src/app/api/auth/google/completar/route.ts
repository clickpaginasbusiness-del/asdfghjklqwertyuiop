import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checarCodigoVerificacao } from '@/lib/twilioVerify'
import { sanitizeSlug, criarPrestadoraComTrial } from '@/lib/onboardingPrestadora'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { nome, slug, telefone, codigo, refCode } = body as {
    nome?: string; slug?: string; telefone?: string; codigo?: string; refCode?: string
  }

  if (!nome || !slug || !telefone || !codigo) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const nomeLimpo = String(nome).trim().slice(0, 100)
  const slugLimpo = sanitizeSlug(String(slug))
  const telefoneLimpo = String(telefone).trim()
  const codigoLimpo = String(codigo).trim()

  if (nomeLimpo.length < 2) return NextResponse.json({ error: 'Nome muito curto' }, { status: 400 })
  if (slugLimpo.length < 3) return NextResponse.json({ error: 'Link muito curto' }, { status: 400 })

  // Verifica OTP via Twilio
  const aprovado = await checarCodigoVerificacao(telefoneLimpo, codigoLimpo)
  if (!aprovado) return NextResponse.json({ error: 'Código inválido ou expirado.' }, { status: 400 })

  const admin = createAdminClient()

  // Verifica se telefone já vinculado a outra prestadora
  const { data: telefoneEmUso } = await admin
    .from('prestadoras')
    .select('id')
    .eq('telefone', telefoneLimpo)
    .maybeSingle()

  if (telefoneEmUso) {
    return NextResponse.json({ error: 'Este número já está vinculado a outra conta.' }, { status: 409 })
  }

  // Verifica se já tem prestadora para esse user_id
  const { data: jaExiste } = await admin
    .from('prestadoras')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (jaExiste) {
    return NextResponse.json({ error: 'Conta já cadastrada para este usuário.' }, { status: 409 })
  }

  // Checa trial/indicação e cria a prestadora — lógica compartilhada com
  // api/auth/complete-signup (ver onboardingPrestadora.ts).
  const resultado = await criarPrestadoraComTrial(admin, {
    userId: user.id,
    nome: nomeLimpo,
    email: user.email,
    slug: slugLimpo,
    telefone: telefoneLimpo,
    refCode,
  })

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status })
  }

  return NextResponse.json({ ok: true, semTrial: resultado.semTrial })
}
