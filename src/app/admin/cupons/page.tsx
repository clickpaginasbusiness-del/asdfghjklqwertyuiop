import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin'
import CuponsAdminClient from './CuponsAdminClient'
import type { Cupom } from '@/lib/types'

export default async function CuponsAdminPage() {
  const supabase = await createClient()
  if (!(await requireAdmin(supabase))) redirect('/painel')

  const admin = createAdminClient()
  const { data: cupons } = await admin
    .from('cupons')
    .select('*')
    .order('created_at', { ascending: false })

  return <CuponsAdminClient cuponsIniciais={(cupons ?? []) as Cupom[]} />
}
