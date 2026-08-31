import type { SupabaseClient } from '@supabase/supabase-js'
import { processarRecompensaCadastro } from '@/lib/indicacao'

export function sanitizeSlug(raw: string): string {
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

export type CriarPrestadoraResultado =
  | { ok: true; semTrial: boolean }
  | { ok: false; error: string; status: number }

/**
 * Cria a prestadora nova com trial de 30 dias (ou sem trial, se o telefone já
 * usou antes — ver telefones_usados_trial), resolve indicação e gera um
 * código de indicação único. Lógica compartilhada entre o cadastro por
 * telefone/OTP (api/auth/complete-signup) e por Google (api/auth/google/
 * completar), que antes reimplementavam isso quase palavra por palavra em
 * paralelo — uma correção num não necessariamente chegava no outro.
 */
export async function criarPrestadoraComTrial(
  admin: SupabaseClient,
  { userId, nome, email, slug, telefone, refCode }: {
    userId: string
    nome: string
    email: string
    slug: string
    telefone: string
    refCode?: string
  }
): Promise<CriarPrestadoraResultado> {
  const { data: telefoneJaUsado } = await admin
    .from('telefones_usados_trial')
    .select('id')
    .eq('telefone', telefone)
    .maybeSingle()

  const semTrial = Boolean(telefoneJaUsado)
  const trialFim = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  let referrerId: string | null = null
  if (refCode) {
    const { data: referrer } = await admin
      .from('prestadoras')
      .select('id')
      .eq('codigo_indicacao', refCode.toUpperCase())
      .maybeSingle()
    referrerId = referrer?.id ?? null
  }

  let codigoIndicacao: string | null = null
  for (let i = 0; i < 5; i++) {
    const tentativa = generateCodigoIndicacao(nome)
    const { data: colisao } = await admin
      .from('prestadoras')
      .select('id')
      .eq('codigo_indicacao', tentativa)
      .maybeSingle()
    if (!colisao) { codigoIndicacao = tentativa; break }
  }

  const { data: novaPrestadora, error: insertError } = await admin
    .from('prestadoras')
    .insert({
      user_id: userId,
      nome,
      email,
      slug,
      telefone,
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
    return { ok: false, error: mensagem, status: 400 }
  }

  if (referrerId && novaPrestadora) {
    await processarRecompensaCadastro(admin, novaPrestadora.id, nome, referrerId)
  }

  return { ok: true, semTrial }
}
