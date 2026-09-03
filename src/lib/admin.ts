import type { SupabaseClient } from '@supabase/supabase-js'

export const ADMIN_EMAIL = 'clickpaginasbusiness@gmail.com'

// Acesso admin hoje depende inteiramente dessa única conta (auditoria
// apontou como ponto único de falha operacional) — ADMIN_EMAILS_EXTRA
// permite adicionar mais e-mails sem mudar código, sem forçar nenhum agora
// (env var ausente = comportamento idêntico ao de sempre, só o ADMIN_EMAIL).
const emailsAdicionais = (process.env.ADMIN_EMAILS_EXTRA ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export async function requireAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return false
  const email = user.email.toLowerCase()
  return email === ADMIN_EMAIL.toLowerCase() || emailsAdicionais.includes(email)
}
