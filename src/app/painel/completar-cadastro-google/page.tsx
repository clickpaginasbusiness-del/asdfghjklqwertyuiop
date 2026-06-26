import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CompletarCadastroGoogleClient from './CompletarCadastroGoogleClient'

export default async function CompletarCadastroGooglePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/painel/login')

  // Verifica se já tem prestadora (ex: login Google com conta já existente)
  const admin = createAdminClient()
  const { data: prestadora } = await admin
    .from('prestadoras')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (prestadora) redirect('/painel')

  const sp = await searchParams
  const nomeGoogle = (user.user_metadata?.full_name as string | undefined) ?? ''

  return (
    <CompletarCadastroGoogleClient
      email={user.email ?? ''}
      nomeInicial={nomeGoogle}
      refCode={sp.ref ?? ''}
    />
  )
}
