import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checarCodigoVerificacao } from '@/lib/twilioVerify'
import { NextRequest, NextResponse } from 'next/server'

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

  // Checa se telefone já usou trial
  const { data: telefoneJaUsado } = await admin
    .from('telefones_usados_trial')
    .select('id')
    .eq('telefone', telefoneLimpo)
    .maybeSingle()

  const semTrial = Boolean(telefoneJaUsado)
  const trialFim = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // Resolve código de indicação do referrer
  let referrerId: string | null = null
  if (refCode) {
    const { data: referrer } = await admin
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
    const { data: colisao } = await admin
      .from('prestadoras')
      .select('id')
      .eq('codigo_indicacao', tentativa)
      .maybeSingle()
    if (!colisao) { codigoIndicacao = tentativa; break }
  }

  const { error: insertError } = await admin.from('prestadoras').insert({
    user_id: user.id,
    nome: nomeLimpo,
    email: user.email,
    slug: slugLimpo,
    telefone: telefoneLimpo,
    plano: 'basico',
    assinatura_ativa: !semTrial,
    trial_fim: semTrial ? null : trialFim,
    e_trial: !semTrial,
    codigo_indicacao: codigoIndicacao,
    indicado_por: referrerId,
  })

  if (insertError) {
    const mensagem = insertError.code === '23505'
      ? 'Esse link já está em uso. Escolha outro.'
      : insertError.message
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }

  return NextResponse.json({ ok: true, semTrial })
}
