import type { SupabaseClient } from '@supabase/supabase-js'

export const ADMIN_EMAIL = 'clickpaginasbusiness@gmail.com'

export async function requireAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  return !!user && user.email === ADMIN_EMAIL
}
