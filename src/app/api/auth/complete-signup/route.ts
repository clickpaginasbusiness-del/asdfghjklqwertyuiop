import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { processarRecompensaCadastro } from '@/lib/indicacao'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function sanitizeSlug(raw: string): string {
  return String(raw).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 50)
}

function generateCodigoIndicacao(nome: string): string {
  const letters = nome
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z]/g, '')
    .slice(0, 5)
    .padEnd(2, 'X')
  const digits = Math.floor(1000 + Math.random() * 9000)
  return `${letters}${digits}`
}

export async function POST(request: NextRequest) {
  // Session is set in cookies by verifyOtp on the client (via @supabase/ssr)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Sessão inválida. Verifique o código novamente.' },
      { status: 401 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { nome, email, senha, slug, telefone, refCode } = body as {
    nome?: string
    email?: string
    senha?: string
    slug?: string
    telefone?: string
    refCode?: string
  }

  if (!nome || !email || !senha || !slug || !telefone) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const nomeLimpo = String(nome).trim().slice(0, 100)
  const emailLimpo = String(email).trim().toLowerCase()
  const slugLimpo = sanitizeSlug(String(slug))
  const telefoneLimpo = String(telefone).trim()
  const senhaStr = String(senha)

  if (nomeLimpo.length < 2) return NextResponse.json({ error: 'Nome muito curto' }, { status: 400 })
  if (slugLimpo.length < 3) return NextResponse.json({ error: 'Link muito curto (mínimo 3 caracteres)' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailLimpo)) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  if (senhaStr.length < 6) return NextResponse.json({ error: 'Senha muito curta' }, { status: 400 })

  // Prevent duplicate signups for this phone user
  const { data: existing } = await supabaseAdmin
    .from('prestadoras')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Conta já cadastrada para este telefone. Faça login.' },
      { status: 409 }
    )
  }

  // Add email + password to the phone auth user
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    email: emailLimpo,
    password: senhaStr,
    email_confirm: true,
    phone_confirm: true,
  })

  if (updateError) {
    const msg = updateError.message ?? ''
    if (msg.includes('email') || msg.includes('already')) {
      return NextResponse.json({ error: 'Este email já está em uso.' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Bloqueia reaproveitamento do trial gratuito por números que já usaram
  // antes (mesmo que a conta anterior tenha sido deletada).
  const { data: telefoneJaUsado } = await supabaseAdmin
    .from('telefones_usados_trial')
    .select('id')
    .eq('telefone', telefoneLimpo)
    .maybeSingle()

  const semTrial = Boolean(telefoneJaUsado)
  const trialFim = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // Resolve referrer pelo código de indicação
  let referrerId: string | null = null
  if (refCode) {
    const { data: referrer } = await supabaseAdmin
      .from('prestadoras')
      .select('id')
      .eq('codigo_indicacao', String(refCode).toUpperCase())
      .maybeSingle()
    referrerId = referrer?.id ?? null
  }

  // Gera código de indicação único para a nova prestadora
  let codigoIndicacao: string | null = null
  for (let i = 0; i < 5; i++) {
    const tentativa = generateCodigoIndicacao(nomeLimpo)
    const { data: colisao } = await supabaseAdmin
      .from('prestadoras')
      .select('id')
      .eq('codigo_indicacao', tentativa)
      .maybeSingle()
    if (!colisao) { codigoIndicacao = tentativa; break }
  }

  const { data: novaPrestadora, error: insertError } = await supabaseAdmin
    .from('prestadoras')
    .insert({
      user_id: user.id,
      nome: nomeLimpo,
      email: emailLimpo,
      slug: slugLimpo,
      telefone: telefoneLimpo,
      plano: 'start',
      assinatura_ativa: !semTrial,
      trial_fim: semTrial ? null : trialFim,
      e_trial: !semTrial,
      codigo_indicacao: codigoIndicacao,
      indicado_por: referrerId,
    })
    .select('id')
    .single()

  if (insertError) {
    const mensagem = insertError.code === '23505'
      ? 'Esse link já está em uso. Escolha outro.'
      : insertError.message
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }

  // Recompensa de indicação — estágio 1 (+7 dias para quem indicou)
  if (referrerId && novaPrestadora) {
    await processarRecompensaCadastro(supabaseAdmin, novaPrestadora.id, nomeLimpo, referrerId)
  }

  return NextResponse.json({ ok: true, semTrial })
}
